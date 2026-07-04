/**
 * Eval harness (PR-10) — matrix configuration and result shapes.
 *
 * Model identity is configuration: every model ID lives in the matrix file
 * (`eval/matrix.json`), never in code. The prompt set deliberately spans
 * repair shapes — substitution, addition, deletion, restructuring — and the
 * matrix crosses the resistant (removal-shaped) prompts with a repair
 * template variant (see src/repair/render.ts), per the repair-shape
 * hypothesis recorded as design input in the plan (hypothesis, not finding).
 */
import type { RepairTemplate } from "../repair/render.js";

/** The repair shape a prompt is designed to elicit, per the plan's PR-10 matrix design. */
export type RepairShape = "substitution" | "addition" | "deletion" | "restructuring";

export interface EvalPrompt {
  id: string;
  intent: string;
  prompt: string;
  /** The repair shape this prompt targets (metadata for aggregation, never asserted). */
  repairShape: RepairShape;
  /** Rules this prompt is designed to tempt violations of (metadata, never asserted). */
  targetRules?: string[];
  /**
   * Design-input marker: prompts probing the ADR-D1 gap family (S3-clean
   * surfaces the emitter cannot project — text placement/absence). Scored on
   * the S3-clean → A-gate outcome every cell already records.
   */
  adrD1Probe?: boolean;
}

export interface EvalMatrix {
  /** Path to the contract, relative to the matrix file. */
  contract: string;
  /** Independent runs per cell — rate-with-spread, not anecdote (the n=1 question). */
  runsPerCell: number;
  maxRepairs?: number;
  /**
   * Model refs (`ollama:<tag>` | `anthropic:<id>`), verified against the
   * live providers at config-authoring time. Fake matrices omit this and
   * define `scripts` instead.
   */
  models?: string[];
  /** Repair templates to cross with the prompts (default: ["standard"]). */
  repairTemplates?: RepairTemplate[];
  prompts: EvalPrompt[];
  /**
   * Fake mode (`--adapter fake`): per prompt id, the scripted generation
   * sequence, as fixture paths (relative to the matrix file) or inline
   * `{ error }` entries. Deterministic — this is the CI gate's mode.
   */
  scripts?: Record<string, ScriptStep[]>;
}

export type ScriptStep = { fixture: string } | { error: string };

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface RunSummary {
  run: number;
  /**
   * A pipeline outcome (`passed` | `failed-lint-exhausted` | `failed-gate` |
   * `failed-adapter`) or `error` — a contained per-run crash (a raw
   * exception the pipeline did not convert into an outcome). `error` runs
   * are visible in the distribution but are NOT observations of the model:
   * they are excluded from the model-behavior rate denominators.
   */
  outcome: string;
  exitCode: number;
  attempts: number;
  /** The contained crash message (outcome "error" only). */
  error?: string;
  /** Attempt-1 S1 gate passed (schema validity — verified, never assumed). */
  firstAttemptSchemaValid: boolean;
  /** Attempt 1 had ≥1 error-level S3 finding. */
  firstAttemptViolated: boolean;
  /** Rule ids of attempt-1 error findings. */
  firstAttemptRuleIds: string[];
  /**

   * Reached an S3-clean attempt after at least one repair (defined only
   * when firstAttemptViolated).
   */
  repaired?: boolean;
  /** S3-clean but refused by an emitter gate — the ADR-D1 signal. */
  s3CleanButGateFailed: boolean;
  /**
   * Classification of a `failed-adapter` outcome (dspack-gen#19), from the
   * report's typed adapterError message: `no-generation` — the request never
   * yielded a model turn (transport failure, HTTP/API reject incl. the
   * grammar-too-large 400s) — is infrastructure and excluded from
   * model-behavior denominators exactly like a contained `error`;
   * `generation-then-bad-output` — the request completed and the MODEL
   * produced unusable output (empty, non-JSON, truncated, refusal) — is a
   * real observation and stays counted. Unknown messages default to
   * `generation-then-bad-output`: only known infrastructure signatures may
   * shrink a denominator.
   */
  adapterFailureClass?: "no-generation" | "generation-then-bad-output";
  /** Relative path of the retained audit report. */
  reportPath: string;
}

export interface CellResult {
  model: string;
  promptId: string;
  repairShape: RepairShape;
  repairTemplate: RepairTemplate;
  adrD1Probe: boolean;
  runs: RunSummary[];
  metrics: CellMetrics;
}

export interface CellMetrics {
  /** Total runs, including contained errors. */
  runs: number;
  /** Contained per-run crashes — infrastructure, not model behavior. */
  errorRuns: number;
  /** Pre-generation failed-adapters (dspack-gen#19) — infrastructure, not model behavior. */
  noGenerationRuns: number;
  /** All rates below are over the observed runs (runs − errorRuns − noGenerationRuns). */
  schemaValidityRate: number;
  firstAttemptViolationRate: number;
  /** Over runs with a first-attempt violation; null when none occurred. */
  repairSuccessRate: number | null;
  endToEndPassRate: number;
  s3CleanGateFailures: number;
}

export interface EvalResults {
  matrixSha256: string;
  contract: { name: string; dspack: string; sha256: string };
  maxRepairs: number;
  cells: CellResult[];
  /** Per model × template rollup (the eval:assert surface). */
  byModel: Record<string, CellMetrics>;
  /** Per rule: first-attempt violation and repair-success counts across all cells. */
  byRule: Record<string, { firstAttemptViolations: number; repaired: number; unrepaired: number }>;
}
