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
 *
 * Phase-2 representability: an a2ui EmitSurfaceError (the emitter refusing a
 * contract-legal surface) rides the same bounded repair loop — the refusal
 * text becomes the repair turn — and generation compiles from a casualty-free
 * view of the contract so the model is not steered into refusals at all.
 */
import {
  buildCatalogModel,
  emitJsonRenderSpec,
  EmitJsonRenderError,
  emitSurface,
  EmitSurfaceError,
  transform,
  type A2uiVersion,
  type DspackDoc,
  type DspackSurface,
  type EmitSurfaceResult,
  type Profile,
  validateSpecAgainstModel,
} from "@aestheticfunction/dspack-emit";
import type { Contract } from "../core/contract.js";
import { applicableRules, compileContext, type CompileOptions } from "../core/compiler.js";
import { casualtyFreeView } from "./casualty-view.js";
import { requireJoinIds } from "./join-id-view.js";
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
  /**
   * Emission target (PR-21). Default "a2ui" — byte-identical behavior for
   * existing callers. "json-render" emits via emitJsonRenderSpec against the
   * contract-generated catalog model (empty profile — the asymmetry
   * finding's pairing) with per-run gates J2 (emission accepted) and J3
   * (instance validates against the generated model). J1 (generated modules
   * compile under real zod) is a dspack-emit CI gate, not per-run.
   */
  emitTarget?: "a2ui" | "json-render";
  /**
   * A2UI mapping profile for the "a2ui" target (default: the emitter's
   * shadcn profile, byte-identical behavior for existing callers). Pass the
   * contract's own profile to emit non-shadcn contracts (e.g. Astryx).
   */
  emitProfile?: Profile;
  /**
   * Prior turns seeded between the contract's few-shot examples and the new
   * user prompt — the conversational-refinement contract (dspack-studio
   * Phase 3): pass the immediately prior generated surface as an assistant
   * message plus its originating user prompt, and ask for the change in
   * `prompt`. The system prompt stays immutable (ADR-7); generation still
   * produces a COMPLETE surface judged by the full gate ladder; the repair
   * loop appends after the seed exactly as it appends after a first attempt.
   * Not a chat-history abstraction: callers own what (if anything) carries
   * over between runs. Recorded verbatim in the audit report when present.
   */
  conversation?: GenerateMessage[];
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

/**
 * Refusal-class detection over the emitter's message text: one targeted hint
 * per class, matched in declaration order. The emitter's refusal strings are
 * typed API surface in spirit (dspack-emit pins them in its own tests), so
 * matching on them is the honest seam short of structured refusal codes.
 */
const REFUSAL_HINTS: ReadonlyArray<{ pattern: RegExp; hint: string }> = [
  {
    pattern: /declared casualty/,
    hint: "Do not use that component with this profile — express the same meaning with other approved components.",
  },
  {
    pattern: /donation boundary/,
    hint: "Each transparent form wrapper (e.g. 'field') must contain exactly one labeled control.",
  },
  {
    pattern: /carries no key|dangling counterpart|join/,
    hint: "Give every collected sub-component item a unique `id`, and make paired items (e.g. tabs-trigger/tabs-content) use matching ids.",
  },
];

/**
 * The representability repair turn (Phase-2): the emitter refusal verbatim —
 * it names the offending component/path precisely — plus at most one
 * class-targeted hint. Unlike S3 repair messages this is not rendered from
 * findings (there are none: the surface is lint-clean); the refusal IS the
 * finding.
 */
function representabilityRepairMessage(refusal: string): string {
  const base =
    "The surface passed all governance gates but cannot be represented by the active emit profile. " +
    `Emitter refusal: ${refusal}. Correct the composition and return the complete corrected JSON object.`;
  const hint = REFUSAL_HINTS.find(({ pattern }) => pattern.test(refusal))?.hint;
  return hint ? `${base} ${hint}` : base;
}

export async function runPipeline(options: RunOptions): Promise<RunResult> {
  const { contract, intent, prompt, adapter } = options;
  const maxRepairs = options.maxRepairs ?? 2;
  const repairTemplate = options.repairTemplate ?? "standard";
  const now = options.now ?? (() => new Date());
  const startedAt = now();

  // Generation compiles from the casualty-free view of the contract: the
  // active emit profile's declared casualties leave the system-prompt
  // vocabulary, the generation schema, and the few-shot exemplars, so the
  // model is never steered into components the emitter must refuse. ONLY
  // generation sees the view — lintSurface below keeps the ORIGINAL contract
  // (the S-gates govern the contract as ratified; S2 vocabulary is unchanged)
  // and so does contractDigest (report identity must not vary with the
  // emit profile).
  const generationContract = casualtyFreeView(contract, options.emitProfile);
  const compiled = compileContext(generationContract, intent, options.compile);
  // P3a: sub-components the profile joins by id must CARRY an id — the schema
  // requires it for exactly those components (join-id-view.ts). Same layering
  // as the casualty view: generation-only, profile-derived, gates untouched.
  const context = { ...compiled, schema: requireJoinIds(compiled.schema as Record<string, unknown>, options.emitProfile) };
  const conversation: GenerateMessage[] = [
    ...context.fewshot,
    ...(options.conversation ?? []),
    { role: "user", content: prompt },
  ];
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
      ...(options.conversation && options.conversation.length > 0 ? { conversation: options.conversation } : {}),
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

      if (options.emitTarget === "json-render") {
        // Second-emitter path (PR-21): same refusal semantics as a2ui — a
        // typed emit error is the gate-failure class, never a crash.
        try {
          const model = buildCatalogModel(doc, {});
          const { spec } = emitJsonRenderSpec(surface, doc, {});
          const findings = validateSpecAgainstModel(spec, model);
          const gates = [
            { gate: "J2" as const, name: "emission accepted", pass: true },
            {
              gate: "J3" as const,
              name: "instance validates against the generated catalog model",
              pass: findings.length === 0,
              ...(findings.length ? { errors: findings.map((f) => f.message) } : {}),
            },
          ];
          const pass = gates.every((g) => g.pass);
          const emitted = { target: "json-render" as const, spec, warnings: [], validations: [{ gates }] };
          emit({ type: "emitted", validations: [{ gates }], warnings: [] });
          const result = pass ? finalize("passed", 0, { surface }, emitted) : finalize("failed-gate", 3, {}, emitted);
          emit({ type: "done", outcome: result.report.outcome, exitCode: result.exitCode, report: result.report });
          return result;
        } catch (error) {
          if (error instanceof EmitJsonRenderError) {
            const emitted = { target: "json-render" as const, refusal: error.message, warnings: [], validations: [] };
            emit({ type: "emitted", validations: [], warnings: [] });
            const result = finalize("failed-gate", 3, {}, emitted);
            emit({ type: "done", outcome: result.report.outcome, exitCode: result.exitCode, report: result.report });
            return result;
          }
          throw error;
        }
      }

      // The emitter can REFUSE a lint-clean surface outright (typed
      // EmitSurfaceError — declared casualties, transparent-dissolution
      // donation boundaries, Collect join key violations: in-vocabulary for
      // S2, ungoverned by S3, unprojectable by the profile). That is the
      // emitter-gate failure class ("target equivalent" in the exit-code
      // table), not a crash — and since Phase-2 it is a REPAIRABLE one: the
      // refusal text is a precise repair instruction, so while repair budget
      // remains it becomes the next repair turn instead of dying terminal.
      // Exhausted budget keeps the original semantics: outcome failed-gate,
      // exit 3, refusal recorded in the report (ADR-D1 family evidence, same
      // as an A3 rejection).
      let emission: EmitSurfaceResult;
      try {
        emission = emitSurface(surface, doc, options.emitProfile ? { profile: options.emitProfile } : {});
      } catch (error) {
        if (error instanceof EmitSurfaceError) {
          attempts[attempts.length - 1].representability = { pass: false, refusal: error.message };
          if (index < maxRepairs) {
            const repair = representabilityRepairMessage(error.message);
            repairMessages.push(repair);
            conversation.push({ role: "assistant", content: generated.raw }, { role: "user", content: repair });
            emit({ type: "repair", index, message: repair });
            continue;
          }
          const emitted = { target: "a2ui" as const, refusal: error.message, warnings: [], validations: [] };
          emit({ type: "emitted", validations: [], warnings: [] });
          const result = finalize("failed-gate", 3, {}, emitted);
          emit({ type: "done", outcome: result.report.outcome, exitCode: result.exitCode, report: result.report });
          return result;
        }
        throw error;
      }
      const { messages, warnings } = emission;

      const validations: EmittedValidation[] = [];
      let gatesPass = true;
      for (const version of options.a2uiVersions ?? (["0.9.1", "1.0"] as A2uiVersion[])) {
        const { validation } = transform(doc, version, { messages }, options.emitProfile);
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
      // The post-emit validations-fail branch stays TERMINAL (no repair):
      // emit-side self-validation (dspack-emit ≥0.7 gates its own output
      // before returning) makes this branch unreachable from emit output —
      // it remains as the guard for older emitters and caller-supplied
      // a2uiVersions the profile was never validated against.
      const result = gatesPass
        ? finalize("passed", 0, { surface, surfaceMessages: { messages } }, emitted)
        : finalize("failed-gate", 3, {}, emitted);
      emit({ type: "done", outcome: result.report.outcome, exitCode: result.exitCode, report: result.report, surfaceMessages: result.surfaceMessages });
      return result;
    }

    if (index < maxRepairs) {
      // S2 errors ride the repair message alongside governance findings
      // (spec v0.4 §5.1: containment defects must be repairable in-loop).
      const s2Errors = lint.gates.find((g) => g.gate === "S2")?.errors ?? [];
      const repair = renderRepairMessage(lint.findings, contract, repairTemplate, s2Errors);
      repairMessages.push(repair);
      conversation.push({ role: "assistant", content: generated.raw }, { role: "user", content: repair });
      emit({ type: "repair", index, message: repair });
    }
  }

  const exhausted = finalize("failed-lint-exhausted", 2);
  emit({ type: "done", outcome: exhausted.report.outcome, exitCode: exhausted.exitCode, report: exhausted.report });
  return exhausted;
}
