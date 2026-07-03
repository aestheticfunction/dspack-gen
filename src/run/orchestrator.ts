/**
 * The pipeline orchestrator: generate → surface gates S1–S3 → bounded repair
 * (≤ maxRepairs, default 2; ADR-7) → emit via the pinned A2UI emitter →
 * emitter gates A1–A3 → audit report v1.
 *
 * Failure exits are first-class artifacts, never silent: every outcome —
 * passed, failed-lint-exhausted (exit 2), failed-gate (exit 3),
 * failed-adapter (exit 1) — produces a complete audit report. The system
 * prompt is immutable across attempts; the only delta between attempts is
 * the model's own output plus the rendered repair feedback.
 */
import {
  emitSurface,
  transform,
  type A2uiVersion,
  type DspackDoc,
  type DspackSurface,
} from "@aestheticfunction/dspack-emit";
import type { Contract } from "../core/contract.js";
import { applicableRules, compileContext, type CompileOptions } from "../core/compiler.js";
import { lintSurface, type Finding, type GateReport } from "../core/lint/index.js";
import { AdapterOutputError, type GenerateMessage, type GenerationAdapter } from "../adapters/types.js";
import { renderRepairMessage, type RepairTemplate } from "../repair/render.js";
import {
  contractDigest,
  sha256,
  REPORT_VERSION,
  type AttemptRecord,
  type AuditReportV1,
  type EmitterGate,
  type EmittedValidation,
  type Outcome,
} from "../audit/report.js";

export interface RunOptions {
  contract: Contract;
  intent: string;
  prompt: string;
  adapter: GenerationAdapter;
  /** Regeneration attempts after the first (default 2 ⇒ ≤3 generations). */
  maxRepairs?: number;
  /** ADR-7 repair template variant (default "standard"); recorded in the report. */
  repairTemplate?: RepairTemplate;
  compile?: CompileOptions;
  /** A2UI versions to validate the emitted surface against. */
  a2uiVersions?: A2uiVersion[];
  /** Injectable clock for deterministic reports in tests. */
  now?: () => Date;
  /** Live progress events (the demo's NDJSON stream). Purely observational. */
  onEvent?: (event: PipelineEvent) => void;
}

/** Progress events streamed by `dspack-gen serve` (observational; the report is the artifact). */
export type PipelineEvent =
  | { type: "start"; intent: string; prompt: string; adapterId: string; ruleIds: string[] }
  | { type: "attempt"; index: number; model?: string; surface: unknown; gates: GateReport[]; findings: Finding[] }
  | { type: "repair"; index: number; message: string }
  | { type: "emitted"; validations: EmittedValidation[]; warnings: Array<{ code: string; message: string }> }
  | { type: "done"; outcome: Outcome; exitCode: number; report: AuditReportV1; surfaceMessages?: unknown };

export interface RunResult {
  report: AuditReportV1;
  exitCode: 0 | 1 | 2 | 3;
  /** The governed surface and its A2UI emission, when the pipeline passed. */
  surface?: DspackSurface;
  surfaceMessages?: unknown;
}

/** Map the emitter's ajv gate names onto the architecture-wide A1/A2/A3. */
const A_GATE: Record<string, "A1" | "A2" | "A3"> = {
  "schema-compile + no-external-ref": "A1",
  "catalog-shape": "A2",
  instance: "A3",
};

export async function runPipeline(options: RunOptions): Promise<RunResult> {
  const { contract, intent, prompt, adapter } = options;
  const maxRepairs = options.maxRepairs ?? 2;
  const repairTemplate = options.repairTemplate ?? "standard";
  const now = options.now ?? (() => new Date());
  const startedAt = now();

  const context = compileContext(contract, intent, options.compile);
  const conversation: GenerateMessage[] = [...context.fewshot, { role: "user", content: prompt }];
  // Purely observational, enforced: a throwing hook (e.g. a stream write
  // after the client disconnected) must never abort the pipeline or change
  // its outcome — the audit report is the artifact, events are a view.
  const emit = (event: PipelineEvent): void => {
    try {
      options.onEvent?.(event);
    } catch {
      /* observational — swallowed by contract */
    }
  };
  emit({
    type: "start",
    intent,
    prompt,
    adapterId: adapter.id,
    ruleIds: applicableRules(contract, intent).map((rule) => rule.id),
  });

  const attempts: AttemptRecord[] = [];
  const repairMessages: string[] = [];

  const finalize = (outcome: Outcome, exitCode: RunResult["exitCode"], extra: Partial<RunResult> = {}, emitted?: AuditReportV1["emitted"]): RunResult => ({
    report: {
      reportVersion: REPORT_VERSION,
      createdAt: startedAt.toISOString(),
      request: { prompt, intent, contract: contractDigest(contract) },
      generation: {
        adapterId: adapter.id,
        schemaSha256: sha256(context.schema),
        maxRepairs,
        ruleSteering: !options.compile?.omitRuleSteering,
        repairTemplate,
      },
      attempts,
      repairMessages,
      outcome,
      ...(emitted ? { emitted } : {}),
      timings: { totalMs: now().getTime() - startedAt.getTime() },
    },
    exitCode,
    ...extra,
  });

  for (let index = 0; index <= maxRepairs; index++) {
    let generated;
    try {
      // Snapshot per attempt: adapters may hold the request beyond the call.
      generated = await adapter.generate({ system: context.system, messages: [...conversation], jsonSchema: context.schema });
    } catch (error) {
      if (error instanceof AdapterOutputError) {
        attempts.push({ index, adapterError: error.message });
        const failed = finalize("failed-adapter", 1);
        emit({ type: "done", outcome: failed.report.outcome, exitCode: failed.exitCode, report: failed.report });
        return failed;
      }
      throw error;
    }

    // Surface gates S1–S3 over the artifact (UnknownRuleTypeError propagates: CLI exit 4).
    const lint = lintSurface(generated.json, contract);
    attempts.push({
      index,
      surface: generated.json,
      model: generated.model,
      usage: generated.usage,
      meta: generated.meta,
      gates: lint.gates,
      findings: lint.findings,
    });
    emit({ type: "attempt", index, model: generated.model, surface: generated.json, gates: lint.gates, findings: lint.findings });

    if (lint.pass) {
      const surface = generated.json as DspackSurface;
      const doc = contract as unknown as DspackDoc;
      const { messages, warnings } = emitSurface(surface, doc);

      const validations: EmittedValidation[] = [];
      let gatesPass = true;
      for (const version of options.a2uiVersions ?? (["0.9.1", "1.0"] as A2uiVersion[])) {
        const { validation } = transform(doc, version, { messages });
        const gates: EmitterGate[] = validation.gates.map((gate) => ({
          gate: A_GATE[gate.name] ?? "A1",
          name: gate.name,
          pass: gate.pass,
          errors: gate.errors,
        }));
        if (!validation.pass) gatesPass = false;
        validations.push({ a2uiVersion: version, gates });
      }

      const emitted = { target: "a2ui" as const, surfaceMessages: { messages }, warnings, validations };
      emit({ type: "emitted", validations, warnings });
      const result = gatesPass
        ? finalize("passed", 0, { surface, surfaceMessages: { messages } }, emitted)
        : finalize("failed-gate", 3, {}, emitted);
      emit({ type: "done", outcome: result.report.outcome, exitCode: result.exitCode, report: result.report, surfaceMessages: result.surfaceMessages });
      return result;
    }

    if (index < maxRepairs) {
      const repair = renderRepairMessage(lint.findings, contract, repairTemplate);
      repairMessages.push(repair);
      conversation.push({ role: "assistant", content: generated.raw }, { role: "user", content: repair });
      emit({ type: "repair", index, message: repair });
    }
  }

  const exhausted = finalize("failed-lint-exhausted", 2);
  emit({ type: "done", outcome: exhausted.report.outcome, exitCode: exhausted.exitCode, report: exhausted.report });
  return exhausted;
}
