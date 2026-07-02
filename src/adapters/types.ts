/**
 * Generation adapter interface (ADR-9) — the thesis-bearing seam between the
 * pipeline and model providers. Stateless: one attempt per call; the repair
 * loop owns conversation state.
 *
 * Model identity is CONFIGURATION: adapters require an explicit model ID
 * (config/env/CLI flag) and no default model name exists in this codebase —
 * defaults are resolved at implementation/run time and recorded in config.
 *
 * Honesty note (S0 spike, docs/spike-structured-outputs.md): constrained
 * decoding cannot be assumed to have been applied — Ollama's mlx engine
 * silently ignores `format`. Adapters guarantee only that the result parses
 * as JSON (AdapterOutputError otherwise); schema/vocabulary/governance
 * conformance is judged by the surface gates S1/S2/S3 over the artifact.
 */

export interface GenerateMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateRequest {
  system: string;
  messages: GenerateMessage[];
  /** The generation schema (constrained decoding / output schema). */
  jsonSchema: Record<string, unknown>;
  params?: {
    /** Sent to providers that accept it (Ollama). Never sent to Anthropic (removed on current models). */
    temperature?: number;
    maxTokens?: number;
  };
}

export interface GenerateResult {
  /** The parsed JSON output — shape-checked by gates, not here. */
  json: unknown;
  /** The raw text the model produced. */
  raw: string;
  /** The model that actually served the request, as reported by the provider. */
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  /** Provider-specific timings/engine info, recorded verbatim in audit reports. */
  meta?: Record<string, unknown>;
}

export interface GenerationAdapter {
  /** Stable identity for audit reports, e.g. "ollama:<model-tag>" or "anthropic:<model-id>". */
  readonly id: string;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

/** The model produced output the adapter cannot hand to the pipeline (non-JSON, refusal, empty). */
export class AdapterOutputError extends Error {
  constructor(
    readonly adapterId: string,
    message: string,
    readonly rawHead?: string,
  ) {
    super(`[${adapterId}] ${message}${rawHead ? ` (output head: ${JSON.stringify(rawHead.slice(0, 200))})` : ""}`);
    this.name = "AdapterOutputError";
  }
}

/** Injectable for offline, deterministic tests. */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function parseJsonOutput(adapterId: string, raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new AdapterOutputError(
      adapterId,
      "model output is not valid JSON — constrained decoding was not applied or failed (see docs/spike-structured-outputs.md: some engines silently ignore output schemas)",
      raw,
    );
  }
}

/**
 * Parse a `--model` flag: "ollama:<model-id>" or "anthropic:<model-id>".
 * The model id itself may contain colons (ollama tags carry a size suffix).
 */
export function parseModelRef(ref: string): { provider: "ollama" | "anthropic"; model: string } {
  const sep = ref.indexOf(":");
  const provider = sep === -1 ? ref : ref.slice(0, sep);
  const model = sep === -1 ? "" : ref.slice(sep + 1);
  if ((provider !== "ollama" && provider !== "anthropic") || model === "") {
    throw new Error(`invalid model reference '${ref}' (expected ollama:<model-id> or anthropic:<model-id>)`);
  }
  return { provider, model };
}
