/**
 * Scripted adapter — the deterministic instrument behind CI gates, the demo's
 * verification mode, and the eval harness's golden runs. Returns the scripted
 * outputs in order; a script entry of `{ error: "..." }` raises a typed
 * AdapterOutputError instead.
 */
import { AdapterOutputError, type GenerateRequest, type GenerateResult, type GenerationAdapter } from "./types.js";

export type ScriptEntry = { output: unknown } | { error: string };

export class ScriptedAdapter implements GenerationAdapter {
  readonly id = "fake:scripted";
  /** Every request received, for assertions on repair-loop conversation state. */
  readonly requests: GenerateRequest[] = [];
  private cursor = 0;

  constructor(private readonly script: ScriptEntry[]) {}

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    this.requests.push(request);
    const entry = this.script[this.cursor++];
    if (!entry) throw new Error(`ScriptedAdapter: script exhausted after ${this.script.length} generation(s)`);
    if ("error" in entry) throw new AdapterOutputError(this.id, entry.error);
    return {
      json: entry.output,
      raw: JSON.stringify(entry.output),
      model: "fake-model",
      usage: { inputTokens: 0, outputTokens: 0 },
      meta: { provider: "fake" },
    };
  }
}
