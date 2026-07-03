/**
 * Anthropic adapter — hosted generation via the official SDK with
 * schema-constrained output (`output_config.format`, type json_schema).
 *
 * The generation schema is compatible by construction: depth-unrolled (the
 * structured-outputs API rejects recursive schemas) and additionalProperties:
 * false on every object. No sampling parameters are sent — they are removed
 * on current Claude models. `stop_reason: "refusal"` is surfaced as a typed
 * AdapterOutputError (never retried silently; retries are the repair loop's
 * job and only for lint findings).
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  AdapterOutputError,
  parseJsonOutput,
  type FetchLike,
  type GenerateRequest,
  type GenerateResult,
  type GenerationAdapter,
} from "./types.js";

export interface AnthropicAdapterOptions {
  /** Required — no default model exists in code (ADR-9 as amended). */
  model: string;
  /** Defaults to the SDK's environment resolution (ANTHROPIC_API_KEY, auth token, profile). */
  apiKey?: string;
  baseURL?: string;
  fetch?: FetchLike;
}

export class AnthropicAdapter implements GenerationAdapter {
  readonly id: string;
  private readonly model: string;
  private readonly client: Anthropic;

  constructor(options: AnthropicAdapterOptions) {
    if (!options.model) throw new Error("AnthropicAdapter requires an explicit model id (config/env/flag)");
    this.model = options.model;
    this.client = new Anthropic({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      fetch: options.fetch as never,
    });
    this.id = `anthropic:${this.model}`;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    // Typed transport: SDK connection/API errors surface as failed-adapter
    // outcomes (with a report), never as raw exceptions that kill a matrix.
    let response;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.params?.maxTokens ?? 16000,
        system: request.system,
        messages: request.messages,
        output_config: {
          format: { type: "json_schema", schema: request.jsonSchema as never },
        },
      } as never);
    } catch (error) {
      if (error instanceof AdapterOutputError) throw error;
      const name = error instanceof Error ? error.constructor.name : "unknown";
      throw new AdapterOutputError(this.id, `transport failure (${name}): ${error instanceof Error ? error.message : String(error)}`);
    }

    const message = response as Anthropic.Message;
    if (message.stop_reason === "refusal") {
      throw new AdapterOutputError(this.id, "model refused the request (stop_reason: refusal)");
    }
    const raw = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    if (raw === "") throw new AdapterOutputError(this.id, "empty model output");
    if (message.stop_reason === "max_tokens") {
      throw new AdapterOutputError(this.id, "output truncated (stop_reason: max_tokens) — raise params.maxTokens", raw);
    }

    return {
      json: parseJsonOutput(this.id, raw),
      raw,
      model: message.model,
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
      meta: { provider: "anthropic", stop_reason: message.stop_reason },
    };
  }
}
