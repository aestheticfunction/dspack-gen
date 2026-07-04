/**
 * Eval runner: matrix × pipeline → retained audit reports + aggregated
 * results. Every cell run goes through the SAME runPipeline the CLI and demo
 * use — the harness adds no second pipeline, only iteration and aggregation.
 *
 * Determinism contract (the CI gate runs the fake matrix): with `--adapter
 * fake` every generation is scripted from fixtures and the injected clock is
 * fixed, so retained reports and `results.json` are byte-stable. Live runs
 * (`--adapter live`) are documented, never CI-gating.
 *
 * Containment contract (the 2026-07-03 live-run lesson): one run can never
 * kill the matrix. Adapters type their transport failures (failed-adapter
 * outcome, with a report); anything that still escapes a run is contained
 * here as an explicit `error` run — recorded in the distribution with its
 * message and a retained .error.json, never silent, never fatal. The one
 * deliberate exception is UnknownRuleTypeError: a bad contract fails every
 * run identically, so the matrix fails loudly (the linter's exit-4 class).
 * `resume: true` skips runs whose audit report is already retained
 * (summarizing from the retained report) and retries error records.
 *
 * Metric definitions (stated once, computed nowhere else; every rate is
 * over the NON-ERROR runs — contained errors are infrastructure, not
 * observations of the model, and are reported via `errorRuns`):
 * - schemaValidityRate  — runs whose attempt-1 S1 gate passed / non-error runs.
 * - firstAttemptViolationRate — runs whose attempt 1 had ≥1 error-level S3
 *   finding / non-error runs.
 * - repairSuccessRate   — among runs with a first-attempt violation, the
 *   fraction that reached an S3-clean attempt within maxRepairs (outcome
 *   `passed` or `failed-gate`); null when no run violated (0/0 is not 0).
 * - endToEndPassRate    — outcome === "passed" / non-error runs.
 * - s3CleanGateFailures — count of `failed-gate` outcomes: S3 accepted a
 *   surface an emitter gate refused (the ADR-D1 family signal; recorded for
 *   every cell, probe-marked or not).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Contract } from "../core/contract.js";
import { runPipeline } from "../run/orchestrator.js";
import { UnknownRuleTypeError } from "../core/lint/index.js";
import { adapterFor } from "../adapters/index.js";
import { ScriptedAdapter, type ScriptEntry } from "../adapters/fake.js";
import { contractDigest, sha256, type AuditReportV1 } from "../audit/report.js";
import type { RepairTemplate } from "../repair/render.js";
import type {
  CellMetrics,
  CellResult,
  EvalMatrix,
  EvalResults,
  RunSummary,
  ScriptStep,
} from "./types.js";

export interface RunMatrixOptions {
  matrixPath: string;
  outDir: string;
  adapterMode: "fake" | "live";
  /** Fixed clock for deterministic retained reports (fake mode). */
  now?: () => Date;
  /**
   * Skip runs whose audit report is already retained in outDir (summarize
   * from the retained report instead); contained-error records are retried.
   * Makes an interrupted matrix resumable without re-burning compute.
   */
  resume?: boolean;
  /** Progress lines (CLI); observational. */
  log?: (line: string) => void;
}

export async function runMatrix(options: RunMatrixOptions): Promise<EvalResults> {
  const matrixAbs = resolve(options.matrixPath);
  const matrixRaw = readFileSync(matrixAbs, "utf8");
  const matrix = JSON.parse(matrixRaw) as EvalMatrix;
  const matrixDir = dirname(matrixAbs);
  const log = options.log ?? (() => {});
  const maxRepairs = matrix.maxRepairs ?? 2;
  // PR-21: matrix-level emission target; default a2ui (byte-identical prior behavior).
  const emitTarget = matrix.emitTarget ?? "a2ui";
  const templates: RepairTemplate[] = matrix.repairTemplates ?? ["standard"];

  const contract = JSON.parse(readFileSync(resolve(matrixDir, matrix.contract), "utf8")) as Contract;

  const models = resolveModels(matrix, options.adapterMode);
  const outDir = resolve(options.outDir);
  mkdirSync(outDir, { recursive: true });

  const cells: CellResult[] = [];
  for (const model of models) {
    for (const prompt of matrix.prompts) {
      for (const repairTemplate of templates) {
        const runs: RunSummary[] = [];
        for (let run = 1; run <= matrix.runsPerCell; run++) {
          const reportPath = reportRelPath(model, prompt.id, repairTemplate, run);
          // Resume: a retained audit report is a completed observation —
          // summarize it instead of re-running. Contained-error records
          // (.error.json) are NOT skipped: errors are retryable. A retained
          // file that fails to read/parse (e.g. a partial write from the
          // very crash being resumed from) is treated as not retained and
          // the run re-executes — the containment contract applies to the
          // resume path too.
          if (options.resume && existsSync(join(outDir, reportPath))) {
            let retained: AuditReportV1 | null = null;
            try {
              retained = JSON.parse(readFileSync(join(outDir, reportPath), "utf8")) as AuditReportV1;
            } catch {
              log(`${model} × ${prompt.id} × ${repairTemplate} run ${run}/${matrix.runsPerCell}: retained report unreadable — re-running`);
            }
            if (retained) {
              runs.push(summarize(run, retained, exitCodeFor(retained.outcome), reportPath));
              log(`${model} × ${prompt.id} × ${repairTemplate} run ${run}/${matrix.runsPerCell}: ${retained.outcome} (resumed from retained report)`);
              continue;
            }
          }
          const adapter =
            options.adapterMode === "fake"
              ? scriptedAdapter(matrix, prompt.id, matrixDir)
              : adapterFor(model);
          try {
            const result = await runPipeline({
              contract,
              intent: prompt.intent,
              prompt: prompt.prompt,
              adapter,
              maxRepairs,
              repairTemplate,
              emitTarget,
              now: options.now,
            });
            retain(outDir, reportPath, result.report);
            runs.push(summarize(run, result.report, result.exitCode, reportPath));
            log(
              `${model} × ${prompt.id} × ${repairTemplate} run ${run}/${matrix.runsPerCell}: ${result.report.outcome}`,
            );
          } catch (error) {
            // Per-run containment: a raw crash (anything the pipeline did
            // not convert into an outcome) is recorded as an explicit
            // `error` run — visible in the distribution, never silent, and
            // never fatal to the rest of the matrix. Deliberate exception:
            // UnknownRuleTypeError means the CONTRACT is bad — every run
            // would fail identically, so the matrix fails loudly (exit 4).
            if (error instanceof UnknownRuleTypeError) throw error;
            const message = error instanceof Error ? `${error.constructor.name}: ${error.message}` : String(error);
            const errorPath = reportPath.replace(/\.audit-report\.json$/, ".error.json");
            retainRaw(outDir, errorPath, JSON.stringify({ error: message }, null, 2) + "\n");
            runs.push({
              run,
              outcome: "error",
              exitCode: -1,
              attempts: 0,
              error: message,
              firstAttemptSchemaValid: false,
              firstAttemptViolated: false,
              firstAttemptRuleIds: [],
              s3CleanButGateFailed: false,
              reportPath: errorPath,
            });
            log(`${model} × ${prompt.id} × ${repairTemplate} run ${run}/${matrix.runsPerCell}: ERROR (contained) — ${message}`);
          }
        }
        cells.push({
          model,
          promptId: prompt.id,
          repairShape: prompt.repairShape,
          repairTemplate,
          adrD1Probe: prompt.adrD1Probe ?? false,
          runs,
          metrics: computeMetrics(runs),
        });
      }
    }
  }

  const results: EvalResults = {
    matrixSha256: sha256(matrixRaw),
    contract: contractDigest(contract),
    maxRepairs,
    cells,
    byModel: rollupByModel(cells),
    byRule: rollupByRule(cells),
  };
  writeFileSync(join(outDir, "results.json"), JSON.stringify(results, null, 2) + "\n");
  writeFileSync(join(outDir, "report.md"), renderReportMarkdown(results));
  return results;
}

function resolveModels(matrix: EvalMatrix, mode: "fake" | "live"): string[] {
  if (mode === "fake") {
    if (!matrix.scripts) throw new Error("fake mode requires `scripts` in the matrix");
    return ["fake:scripted"];
  }
  if (!matrix.models || matrix.models.length === 0) {
    throw new Error("live mode requires `models` in the matrix (model ids are config, never code)");
  }
  return matrix.models;
}

function scriptedAdapter(matrix: EvalMatrix, promptId: string, matrixDir: string): ScriptedAdapter {
  const steps = matrix.scripts?.[promptId];
  if (!steps) throw new Error(`fake matrix has no script for prompt '${promptId}'`);
  const entries: ScriptEntry[] = steps.map((step: ScriptStep) =>
    "error" in step
      ? { error: step.error }
      : { output: JSON.parse(readFileSync(resolve(matrixDir, step.fixture), "utf8")) as unknown },
  );
  return new ScriptedAdapter(entries);
}

function reportRelPath(model: string, promptId: string, template: RepairTemplate, run: number): string {
  const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return join("reports", `${slug(model)}--${promptId}--${template}--r${run}.audit-report.json`);
}

function retain(outDir: string, rel: string, report: AuditReportV1): void {
  retainRaw(outDir, rel, JSON.stringify(report, null, 2) + "\n");
}

function retainRaw(outDir: string, rel: string, content: string): void {
  mkdirSync(join(outDir, "reports"), { recursive: true });
  writeFileSync(join(outDir, rel), content);
}

/** The CLI's exit-code mapping, reproduced for resumed (retained) reports. */
function exitCodeFor(outcome: string): number {
  return outcome === "passed" ? 0 : outcome === "failed-lint-exhausted" ? 2 : outcome === "failed-gate" ? 3 : 1;
}

/**
 * dspack-gen#19: classify a failed-adapter from its typed error message.
 * Conservative by design — only KNOWN infrastructure signatures classify as
 * `no-generation` (and thereby leave the denominators); anything else is
 * treated as a model observation.
 */
export function classifyAdapterFailure(adapterError: string): "no-generation" | "generation-then-bad-output" {
  const infrastructure =
    /HTTP \d{3}/.test(adapterError) ||
    /grammar is too large/i.test(adapterError) ||
    /fetch failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|socket|network|timed? ?out/i.test(adapterError);
  return infrastructure ? "no-generation" : "generation-then-bad-output";
}

/**
 * Per #19's definition, `no-generation` applies only when NO attempt produced
 * output: a run whose repair attempt dies on transport still observed the
 * model on attempt 1 and stays counted.
 */
export function classifyFailedAdapterRun(
  attempts: Array<{ surface?: unknown; adapterError?: string }>,
): "no-generation" | "generation-then-bad-output" {
  if (attempts.some((a) => a.surface !== undefined)) return "generation-then-bad-output";
  return classifyAdapterFailure(attempts.find((a) => a.adapterError)?.adapterError ?? "");
}

function summarize(run: number, report: AuditReportV1, exitCode: number, reportPath: string): RunSummary {
  const first = report.attempts[0];
  const firstGates = first?.gates ?? [];
  const s1 = firstGates.find((g) => g.gate === "S1");
  const errorFindings = (first?.findings ?? []).filter((f) => f.level === "error");
  const firstAttemptViolated = errorFindings.length > 0;
  const lintCleanReached = report.outcome === "passed" || report.outcome === "failed-gate";
  return {
    run,
    outcome: report.outcome,
    exitCode,
    attempts: report.attempts.length,
    firstAttemptSchemaValid: s1?.status === "PASS",
    firstAttemptViolated,
    firstAttemptRuleIds: [...new Set(errorFindings.map((f) => f.ruleId))].sort(),
    ...(firstAttemptViolated ? { repaired: lintCleanReached } : {}),
    s3CleanButGateFailed: report.outcome === "failed-gate",
    ...(report.outcome === "failed-adapter" ? { adapterFailureClass: classifyFailedAdapterRun(report.attempts) } : {}),
    reportPath,
  };
}

export function computeMetrics(runs: RunSummary[]): CellMetrics {
  // Contained `error` runs and pre-generation failed-adapters (dspack-gen#19)
  // are infrastructure, not model behavior: counted (visible) but excluded
  // from every rate denominator below.
  const errorRuns = runs.filter((r) => r.outcome === "error").length;
  const noGeneration = runs.filter((r) => r.adapterFailureClass === "no-generation").length;
  const observed = runs.filter((r) => r.outcome !== "error" && r.adapterFailureClass !== "no-generation");
  const n = observed.length;
  const violated = observed.filter((r) => r.firstAttemptViolated);
  const rate = (k: number, d: number): number => (d === 0 ? 0 : round4(k / d));
  return {
    runs: runs.length,
    errorRuns,
    noGenerationRuns: noGeneration,
    schemaValidityRate: rate(observed.filter((r) => r.firstAttemptSchemaValid).length, n),
    firstAttemptViolationRate: rate(violated.length, n),
    repairSuccessRate: violated.length === 0 ? null : round4(violated.filter((r) => r.repaired).length / violated.length),
    endToEndPassRate: rate(observed.filter((r) => r.outcome === "passed").length, n),
    s3CleanGateFailures: observed.filter((r) => r.s3CleanButGateFailed).length,
  };
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

function rollupByModel(cells: CellResult[]): Record<string, CellMetrics> {
  const byModel: Record<string, CellMetrics> = {};
  const keys = [...new Set(cells.map((c) => c.model))].sort();
  for (const model of keys) {
    byModel[model] = computeMetrics(cells.filter((c) => c.model === model).flatMap((c) => c.runs));
  }
  return byModel;
}

function rollupByRule(cells: CellResult[]): EvalResults["byRule"] {
  const byRule: EvalResults["byRule"] = {};
  for (const cell of cells) {
    for (const run of cell.runs) {
      for (const ruleId of run.firstAttemptRuleIds) {
        const entry = (byRule[ruleId] ??= { firstAttemptViolations: 0, repaired: 0, unrepaired: 0 });
        entry.firstAttemptViolations++;
        if (run.repaired) entry.repaired++;
        else entry.unrepaired++;
      }
    }
  }
  return Object.fromEntries(Object.entries(byRule).sort(([a], [b]) => a.localeCompare(b)));
}

/** Human view — derived, never the artifact. */
export function renderReportMarkdown(results: EvalResults): string {
  const lines: string[] = [
    "# Eval results",
    "",
    `- Contract: ${results.contract.name} (dspack ${results.contract.dspack}, sha256 ${results.contract.sha256.slice(0, 12)}…)`,
    `- Matrix sha256: ${results.matrixSha256.slice(0, 12)}… · maxRepairs: ${results.maxRepairs}`,
    "",
    "## Per model",
    "",
    "(rates are over observed runs; `errors` are contained crashes and `no-gen` are pre-generation adapter failures — both infrastructure, not model behavior; dspack-gen#19)",
    "",
    "| model | runs | errors | no-gen | schema-valid | 1st-attempt violation | repair success | e2e pass | S3-clean gate failures |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const [model, m] of Object.entries(results.byModel)) {
    lines.push(
      `| ${model} | ${m.runs} | ${m.errorRuns} | ${m.noGenerationRuns} | ${pct(m.schemaValidityRate)} | ${pct(m.firstAttemptViolationRate)} | ${m.repairSuccessRate === null ? "n/a" : pct(m.repairSuccessRate)} | ${pct(m.endToEndPassRate)} | ${m.s3CleanGateFailures} |`,
    );
  }
  lines.push("", "## Per rule (first-attempt violations across all cells)", "", "| rule | violations | repaired | unrepaired |", "|---|---|---|---|");
  for (const [rule, r] of Object.entries(results.byRule)) {
    lines.push(`| ${rule} | ${r.firstAttemptViolations} | ${r.repaired} | ${r.unrepaired} |`);
  }
  lines.push(
    "",
    "## Per cell",
    "",
    "| model | prompt | shape | template | ADR-D1 probe | errors | no-gen | violation | repair | e2e | gate-fail |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  );
  for (const c of results.cells) {
    lines.push(
      `| ${c.model} | ${c.promptId} | ${c.repairShape} | ${c.repairTemplate} | ${c.adrD1Probe ? "yes" : ""} | ${c.metrics.errorRuns} | ${c.metrics.noGenerationRuns} | ${pct(c.metrics.firstAttemptViolationRate)} | ${c.metrics.repairSuccessRate === null ? "n/a" : pct(c.metrics.repairSuccessRate)} | ${pct(c.metrics.endToEndPassRate)} | ${c.metrics.s3CleanGateFailures} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function pct(x: number): string {
  return `${Math.round(x * 1000) / 10}%`;
}
