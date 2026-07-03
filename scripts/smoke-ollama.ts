/**
 * Live Ollama smoke check (NOT a CI gate — requires a running Ollama server
 * and a pulled model). One real generation through the compiled context,
 * then the surface gates S1–S3 over the artifact.
 *
 *   npm run smoke:ollama -- --model <ollama-model-tag> [--intent destructive-action] [--no-steering]
 */
import { readFileSync } from "node:fs";
import type { Contract } from "../src/core/contract.js";
import { compileContext } from "../src/core/compiler.js";
import { lintSurface, renderText } from "../src/core/lint/index.js";
import { OllamaAdapter } from "../src/adapters/ollama.js";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const model = flag("model");
if (!model) {
  console.error("usage: npm run smoke:ollama -- --model <ollama-model-tag> [--intent <id>] [--no-steering]");
  process.exit(1);
}
const intent = flag("intent") ?? "destructive-action";

const contract = JSON.parse(readFileSync("fixtures/shadcn.v0_4.dspack.json", "utf8")) as Contract;
const context = compileContext(contract, intent, { omitRuleSteering: args.includes("--no-steering") });
const adapter = new OllamaAdapter({ model });

console.error(`generating with ${adapter.id} (intent: ${intent}, steering: ${!args.includes("--no-steering")})…`);
const result = await adapter.generate({
  system: context.system,
  messages: [...context.fewshot, { role: "user", content: "a screen to delete my account" }],
  jsonSchema: context.schema,
});
console.error(
  `model=${result.model} tokens in/out=${result.usage?.inputTokens}/${result.usage?.outputTokens}`,
);
console.log(JSON.stringify(result.json, null, 2));

const report = lintSurface(result.json, contract);
console.error(renderText(report));
process.exit(report.pass ? 0 : 2);
