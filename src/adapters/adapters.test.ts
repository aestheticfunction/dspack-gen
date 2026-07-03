/**
 * PR-5 acceptance gates: adapters run offline and deterministic — every HTTP
 * interaction is an injected fetch returning fixture transcripts. Both
 * adapters produce parsed-JSON results; malformed output raises a typed
 * AdapterOutputError (surfaced, never silently retried); the compiled
 * generation schema round-trips into the request body verbatim; model IDs
 * are mandatory configuration (no defaults in code).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Contract } from "../core/contract.js";
import { compileContext } from "../core/compiler.js";
import { AnthropicAdapter } from "./anthropic.js";
import { OllamaAdapter } from "./ollama.js";
import { AdapterOutputError, parseModelRef, type FetchLike } from "./types.js";
import { adapterFor } from "./index.js";

const contract = JSON.parse(readFileSync("fixtures/shadcn.v0_3.dspack.json", "utf8")) as Contract;
const context = compileContext(contract, "destructive-action");
const workedSurface = contract.examples![0].surface;

function fetchFixture(body: unknown, capture: { url?: string; body?: Record<string, unknown> }, status = 200): FetchLike {
  return async (input, init) => {
    capture.url = String(input);
    capture.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
}

const request = {
  system: context.system,
  messages: [...context.fewshot, { role: "user" as const, content: "a screen to delete my account" }],
  jsonSchema: context.schema,
};

describe("OllamaAdapter", () => {
  it("produces a parsed result from a fixture transcript; the generation schema round-trips verbatim", async () => {
    const capture: { url?: string; body?: Record<string, unknown> } = {};
    const adapter = new OllamaAdapter({
      model: "test-model:8b",
      host: "http://ollama.test",
      fetch: fetchFixture(
        { model: "test-model:8b", message: { content: JSON.stringify(workedSurface) }, prompt_eval_count: 100, eval_count: 50 },
        capture,
      ),
    });
    const result = await adapter.generate(request);

    expect(adapter.id).toBe("ollama:test-model:8b");
    expect(capture.url).toBe("http://ollama.test/api/chat");
    expect(capture.body!.format).toEqual(context.schema); // depth-unrolled schema round-trips
    expect(capture.body!.stream).toBe(false);
    expect((capture.body!.messages as unknown[]).length).toBe(request.messages.length + 1); // + system
    expect(result.json).toEqual(workedSurface);
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
  });

  it("raises AdapterOutputError on non-JSON output (mlx silently-unconstrained case)", async () => {
    const adapter = new OllamaAdapter({
      model: "m",
      host: "http://ollama.test",
      fetch: fetchFixture({ message: { content: "```json\n{...}\n```" } }, {}),
    });
    await expect(adapter.generate(request)).rejects.toThrowError(AdapterOutputError);
    await expect(adapter.generate(request)).rejects.toThrowError(/not valid JSON/);
  });

  it("raises AdapterOutputError on HTTP errors and empty output", async () => {
    const httpFail = new OllamaAdapter({ model: "m", host: "http://x", fetch: async () => new Response("boom", { status: 500 }) });
    await expect(httpFail.generate(request)).rejects.toThrowError(/HTTP 500/);

    const empty = new OllamaAdapter({ model: "m", host: "http://x", fetch: fetchFixture({ message: { content: "" } }, {}) });
    await expect(empty.generate(request)).rejects.toThrowError(/empty model output/);
  });
});

describe("AnthropicAdapter", () => {
  const success = {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "test-model-id",
    content: [{ type: "text", text: JSON.stringify(workedSurface) }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 200, output_tokens: 80 },
  };

  it("produces a parsed result; schema-constrained via output_config.format; no sampling params sent", async () => {
    const capture: { url?: string; body?: Record<string, unknown> } = {};
    const adapter = new AnthropicAdapter({
      model: "test-model-id",
      apiKey: "test-key",
      fetch: fetchFixture(success, capture),
    });
    const result = await adapter.generate(request);

    expect(capture.url).toMatch(/\/v1\/messages/);
    const body = capture.body!;
    expect(body.model).toBe("test-model-id");
    expect((body.output_config as Record<string, unknown>).format).toEqual({
      type: "json_schema",
      schema: context.schema,
    });
    expect(body.temperature).toBeUndefined();
    expect(body.top_p).toBeUndefined();
    expect(result.json).toEqual(workedSurface);
    expect(result.usage).toEqual({ inputTokens: 200, outputTokens: 80 });
  });

  it("surfaces refusals as typed errors", async () => {
    const adapter = new AnthropicAdapter({
      model: "m",
      apiKey: "test-key",
      fetch: fetchFixture({ ...success, content: [], stop_reason: "refusal" }, {}),
    });
    await expect(adapter.generate(request)).rejects.toThrowError(/refusal/);
  });

  it("surfaces truncation as typed errors", async () => {
    const adapter = new AnthropicAdapter({
      model: "m",
      apiKey: "test-key",
      fetch: fetchFixture({ ...success, stop_reason: "max_tokens" }, {}),
    });
    await expect(adapter.generate(request)).rejects.toThrowError(/max_tokens/);
  });
});

describe("model identity is configuration", () => {
  it("adapters refuse to construct without an explicit model id", () => {
    expect(() => new OllamaAdapter({ model: "" })).toThrowError(/explicit model id/);
    expect(() => new AnthropicAdapter({ model: "" })).toThrowError(/explicit model id/);
  });

  it("no default model name exists in adapter source", () => {
    for (const file of ["src/adapters/ollama.ts", "src/adapters/anthropic.ts", "src/adapters/types.ts", "src/adapters/index.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} hard-codes a model name`).not.toMatch(/\b(claude-[a-z0-9-]+|qwen[0-9]|llama[0-9]|gpt-oss)\b/);
    }
  });

  it("parseModelRef handles provider prefixes and colon-bearing ollama tags", () => {
    expect(parseModelRef("ollama:qwen-test:8b")).toEqual({ provider: "ollama", model: "qwen-test:8b" });
    expect(parseModelRef("anthropic:some-model-id")).toEqual({ provider: "anthropic", model: "some-model-id" });
    expect(() => parseModelRef("openai:gpt")).toThrowError(/invalid model reference/);
    expect(() => parseModelRef("ollama:")).toThrowError(/invalid model reference/);
    expect(adapterFor("ollama:tag:x").id).toBe("ollama:tag:x");
  });
});

describe("transport failures are typed (2026-07-03 matrix-crash lesson)", () => {
  const request = { system: "s", messages: [], jsonSchema: { type: "object" } };

  it("Ollama: a REJECTED fetch (connection reset/timeout) raises AdapterOutputError, never a raw exception", async () => {
    const adapter = new OllamaAdapter({
      model: "m",
      fetch: () => Promise.reject(new TypeError("fetch failed")),
    });
    await expect(adapter.generate(request)).rejects.toThrowError(AdapterOutputError);
    await expect(adapter.generate(request)).rejects.toThrowError(/transport failure: fetch failed/);
  });

  it("Ollama: a mid-body failure (response.json rejects) is typed too", async () => {
    const adapter = new OllamaAdapter({
      model: "m",
      fetch: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.reject(new Error("terminated")),
          text: () => Promise.resolve(""),
        } as unknown as Response),
    });
    await expect(adapter.generate(request)).rejects.toThrowError(/transport failure: terminated/);
  });

  it("Anthropic: an SDK connection failure raises AdapterOutputError with the error class named", async () => {
    const adapter = new AnthropicAdapter({
      model: "m",
      apiKey: "test-key",
      fetch: () => Promise.reject(new TypeError("Connection error")),
    });
    await expect(adapter.generate(request)).rejects.toThrowError(AdapterOutputError);
    await expect(adapter.generate(request)).rejects.toThrowError(/transport failure/);
  });
});
