export * from "./types.js";
export { OllamaAdapter, type OllamaAdapterOptions } from "./ollama.js";
export { AnthropicAdapter, type AnthropicAdapterOptions } from "./anthropic.js";

import { OllamaAdapter } from "./ollama.js";
import { AnthropicAdapter } from "./anthropic.js";
import { parseModelRef, type GenerationAdapter } from "./types.js";

/** Build an adapter from a `--model` reference (ollama:<id> | anthropic:<id>). */
export function adapterFor(modelRef: string): GenerationAdapter {
  const { provider, model } = parseModelRef(modelRef);
  return provider === "ollama" ? new OllamaAdapter({ model }) : new AnthropicAdapter({ model });
}
