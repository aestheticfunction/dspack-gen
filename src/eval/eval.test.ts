/**
 * PR-10 acceptance gates: the eval harness.
 *
 * - The fake matrix (scripted fixtures, fixed clock) produces the golden
 *   results.json byte-for-byte — the deterministic CI gate. The scripted
 *   cells cover every outcome: passed (clean-first and after-repair),
 *   failed-lint-exhausted, failed-adapter, and failed-gate (an S3-clean
 *   surface the emitter refuses — the ADR-D1 probe path).
 * - Metric definitions are pinned by construction cases, including the 0/0
 *   guard: repairSuccessRate is null (not 0, not 1) when nothing violated.
 * - The repair-template variant changes exactly one instruction line and is
 *   recorded in the audit report; the standard rendering is unchanged
 *   against its golden (fixtures/golden/repair/F1.repair.txt).
 * - eval:assert thresholds: pass 0, fail 2, undefined-rate fail 2.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Contract } from "../core/contract.js";
import { lintSurface } from "../core/lint/index.js";
import { renderRepairMessage } from "../repair/render.js";
import { computeMetrics } from "./runner.js";
import type { RunSummary } from "./types.js";

const contract = JSON.parse(readFileSync("fixtures/shadcn.v0_3.dspack.json", "utf8")) as Contract;

describe("fake-matrix eval (the CI gate)", () => {
  const outDir = mkdtempSync(join(tmpdir(), "eval-fake-"));
  execFileSync("npx", ["tsx", "src/eval/run.ts", "--adapter", "fake", "--matrix", "eval/matrix.fake.json", "--out", outDir], {
    stdio: ["ignore", "ignore", "ignore"],
  });
  const results = readFileSync(join(outDir, "results.json"), "utf8");

  it("produces the golden results.json byte-for-byte", () => {
    expect(results).toBe(readFileSync("fixtures/golden/eval/results.fake.json", "utf8"));
  });

  it("retained audit reports carry the repair template used", () => {
    const report = JSON.parse(
      readFileSync(join(outDir, "reports", "fake-scripted--p01-violation-then-repair--permit-restructuring--r1.audit-report.json"), "utf8"),
    ) as { generation: { repairTemplate: string }; repairMessages: string[] };
    expect(report.generation.repairTemplate).toBe("permit-restructuring");
    expect(report.repairMessages[0]).toContain("Remove or restructure");
    expect(report.repairMessages[0]).not.toContain("Do not change parts");
  });

  it("eval:assert — threshold met exits 0, unmet exits 2", () => {
    const run = (min: string) =>
      spawnSync("npx", ["tsx", "src/eval/assert.ts", "--results", join(outDir, "results.json"), "--model", "fake:scripted", "--min-repair-success", min]);
    expect(run("0.5").status).toBe(0); // golden matrix: repair-success 0.5
    expect(run("0.9").status).toBe(2);
  });

  it("contains per-run crashes as explicit `error` runs — visible, never silent, never matrix-fatal", () => {
    // p06's empty script makes the ScriptedAdapter throw a RAW Error on the
    // first generation; the matrix must complete anyway, with the crash
    // recorded in the distribution and an .error.json retained.
    const parsed = JSON.parse(results) as {
      cells: Array<{ promptId: string; metrics: { errorRuns: number; runs: number }; runs: Array<{ outcome: string; error?: string; reportPath: string }> }>;
    };
    const crashCells = parsed.cells.filter((c) => c.promptId === "p06-contained-crash");
    expect(crashCells).toHaveLength(2); // both templates ran despite the crashes
    for (const cell of crashCells) {
      expect(cell.metrics.errorRuns).toBe(cell.metrics.runs);
      for (const run of cell.runs) {
        expect(run.outcome).toBe("error");
        expect(run.error).toContain("script exhausted");
        expect(readFileSync(join(outDir, run.reportPath), "utf8")).toContain("script exhausted");
      }
    }
    // Cells AFTER the crash cell in matrix order completed normally.
    expect(parsed.cells.some((c) => c.promptId === "p05-s3-clean-gate-fail" && c.metrics.errorRuns === 0)).toBe(true);
  });

  it("--resume reproduces the identical results.json from retained reports (and retries error records)", () => {
    execFileSync("npx", ["tsx", "src/eval/run.ts", "--adapter", "fake", "--matrix", "eval/matrix.fake.json", "--out", outDir, "--resume"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    expect(readFileSync(join(outDir, "results.json"), "utf8")).toBe(results);
  });

  it("--resume re-runs (not crashes) on a corrupted retained report — containment covers the resume path", () => {
    // Simulate the partial write a mid-run crash leaves behind: truncate one
    // retained report, then resume. The run must re-execute and the final
    // results.json must still equal the golden byte-for-byte.
    const victim = join(outDir, "reports", "fake-scripted--p02-clean-first-attempt--standard--r1.audit-report.json");
    writeFileSync(victim, '{"reportVersion": "1", "attempts": [{');
    execFileSync("npx", ["tsx", "src/eval/run.ts", "--adapter", "fake", "--matrix", "eval/matrix.fake.json", "--out", outDir, "--resume"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    expect(readFileSync(join(outDir, "results.json"), "utf8")).toBe(results);
    expect(JSON.parse(readFileSync(victim, "utf8"))).toBeTruthy(); // rewritten whole
  });
});

describe("metric definitions", () => {
  const base: Omit<RunSummary, "run"> = {
    outcome: "passed",
    exitCode: 0,
    attempts: 1,
    firstAttemptSchemaValid: true,
    firstAttemptViolated: false,
    firstAttemptRuleIds: [],
    s3CleanButGateFailed: false,
    reportPath: "r",
  };

  it("repairSuccessRate is null over zero violations (0/0 is not a rate)", () => {
    const m = computeMetrics([{ run: 1, ...base }]);
    expect(m.repairSuccessRate).toBeNull();
    expect(m.endToEndPassRate).toBe(1);
  });

  it("contained error runs are counted but excluded from every rate denominator", () => {
    const m = computeMetrics([
      { run: 1, ...base }, // one clean pass
      { run: 2, ...base, outcome: "error", exitCode: -1, attempts: 0, firstAttemptSchemaValid: false, error: "boom" },
    ]);
    expect(m.runs).toBe(2);
    expect(m.errorRuns).toBe(1);
    // The error run does not drag the model's rates down: 1/1, not 1/2.
    expect(m.schemaValidityRate).toBe(1);
    expect(m.endToEndPassRate).toBe(1);
  });

  it("failed-gate counts as repaired (lint-clean reached) AND as an S3-clean gate failure", () => {
    const m = computeMetrics([
      { run: 1, ...base, outcome: "failed-gate", exitCode: 3, firstAttemptViolated: true, firstAttemptRuleIds: ["rule.x"], repaired: true, s3CleanButGateFailed: true },
    ]);
    expect(m.repairSuccessRate).toBe(1);
    expect(m.endToEndPassRate).toBe(0);
    expect(m.s3CleanGateFailures).toBe(1);
  });
});

describe("repair template variant (ADR-7, single-variable A/B)", () => {
  const violating = JSON.parse(
    readFileSync("fixtures/golden/violating/F1-dialog-for-delete.dsurface.json", "utf8"),
  ) as unknown;
  const findings = lintSurface(violating, contract).findings;
  const standard = renderRepairMessage(findings, contract);
  const variant = renderRepairMessage(findings, contract, "permit-restructuring");

  it("standard rendering is unchanged (golden)", () => {
    expect(standard).toBe(readFileSync("fixtures/golden/repair/F1.repair.txt", "utf8"));
  });

  it("the variant differs in exactly one line", () => {
    const a = standard.split("\n");
    const b = variant.split("\n");
    expect(a.length).toBe(b.length);
    const differing = a.map((line, i) => (line === b[i] ? null : i)).filter((i) => i !== null);
    expect(differing).toHaveLength(1);
    expect(b[differing[0]!]).toContain("Remove or restructure");
  });
});

describe("the ADR-D1 probe fixture is what it claims", () => {
  it("fixtures/eval/text-placement-gate-fail.dsurface.json is S3-clean (the gap is real, not a lint miss)", () => {
    const surface = JSON.parse(readFileSync("fixtures/eval/text-placement-gate-fail.dsurface.json", "utf8")) as unknown;
    const lint = lintSurface(surface, contract);
    expect(lint.pass).toBe(true);
  });
});
