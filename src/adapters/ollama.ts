/**
 * Ollama adapter — local generation via structured outputs (`format` = the
 * generation schema on /api/chat). Mandatory for the local path per the plan;
 * there is no unconstrained-JSON fallback in this design.
 *
 * S0 spike caveat carried here: on mlx-engine models Ollama silently ignores
 * `format`. The adapter cannot detect the engine from the chat response, so
 * it records the model tag in `meta` and relies on gates S1/S2 to catch
 * unconstrained output; non-JSON output raises AdapterOutputError.
 */
import { Agent } from "undici";
import {
  AdapterOutputError,
  parseJsonOutput,
  type FetchLike,
  type GenerateRequest,
  type GenerateResult,
  type GenerationAdapter,
} from "./types.js";

/**
 * Local inference is legitimately slow: a single 35B generation can exceed
 * undici's default 300s headersTimeout, which killed runs at exactly ~301s
 * in the 2026-07-03 eval (reports with zero attempts, "fetch failed").
 * One long-lived dispatcher with the header/body timeouts raised to an hour
 * — a deliberate ceiling, not "no timeout": a truly hung server should
 * still fail rather than block a matrix forever.
 */
const LOCAL_INFERENCE_TIMEOUT_MS = 60 * 60 * 1000;
const localInferenceDispatcher = new Agent({
  headersTimeout: LOCAL_INFERENCE_TIMEOUT_MS,
  bodyTimeout: LOCAL_INFERENCE_TIMEOUT_MS,
});

export interface OllamaAdapterOptions {
  /** Required — no default model exists in code (ADR-9 as amended). */
  model: string;
  /** Defaults to OLLAMA_HOST env or http://localhost:11434. */
  host?: string;
  fetch?: FetchLike;
}

interface OllamaChatResponse {
  model?: string;
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
}

export class OllamaAdapter implements GenerationAdapter {
  readonly id: string;
  private readonly model: string;
  private readonly host: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: OllamaAdapterOptions) {
    if (!options.model) throw new Error("OllamaAdapter requires an explicit model id (config/env/flag)");
    this.model = options.model;
    this.host = options.host ?? process.env.OLLAMA_HOST ?? "http://localhost:11434";
    this.fetchImpl = options.fetch ?? fetch;
    this.id = `ollama:${this.model}`;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const body = {
      model: this.model,
      stream: false,
      format: request.jsonSchema,
      options: { temperature: request.params?.temperature ?? 0.2 },
      messages: [{ role: "system", content: request.system }, ...request.messages],
    };
    // The whole transport exchange is typed: a rejected fetch (connection
    // reset, timeout under a large model load) must surface as a
    // failed-adapter outcome with a report, never as a raw exception that
    // kills a whole eval matrix (the 2026-07-03 live-run crash).
    let data: OllamaChatResponse;
    try {
      const response = await this.fetchImpl(`${this.host}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        // undici extension of fetch(init); ignored by injected test fetches.
        dispatcher: localInferenceDispatcher,
      } as unknown as RequestInit);
      if (!response.ok) {
        // Body read can itself fail on a broken stream — keep the HTTP
        // status in the error either way.
        const detail = await response.text().catch(() => "(response body unreadable)");
        throw new AdapterOutputError(this.id, `HTTP ${response.status}: ${detail.slice(0, 300)}`);
      }
      data = (await response.json()) as OllamaChatResponse;
    } catch (error) {
      if (error instanceof AdapterOutputError) throw error;
      throw new AdapterOutputError(this.id, `transport failure: ${error instanceof Error ? error.message : String(error)}`);
    }
    const raw = data.message?.content ?? "";
    if (raw === "") throw new AdapterOutputError(this.id, "empty model output");

    return {
      json: parseJsonOutput(this.id, raw),
      raw,
      model: data.model ?? this.model,
      usage: { inputTokens: data.prompt_eval_count, outputTokens: data.eval_count },
      meta: {
        provider: "ollama",
        total_duration: data.total_duration,
        load_duration: data.load_duration,
        prompt_eval_duration: data.prompt_eval_duration,
        eval_duration: data.eval_duration,
      },
    };
  }
}
