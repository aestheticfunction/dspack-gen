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
import {
  AdapterOutputError,
  parseJsonOutput,
  type FetchLike,
  type GenerateRequest,
  type GenerateResult,
  type GenerationAdapter,
} from "./types.js";

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
    const response = await this.fetchImpl(`${this.host}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new AdapterOutputError(this.id, `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    const data = (await response.json()) as OllamaChatResponse;
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
