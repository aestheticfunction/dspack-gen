/** ADR-M3-4 Probe 1: hosted grammar-ceiling bisect over unroll depth.
 * Uses the SAME schema builder and request shape as the eval's hosted column
 * (output_config.format json_schema). A grammar-too-large 400 = rejected;
 * a completed (or max_tokens-truncated) response = compiled & accepted.
 */
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { buildGenerationSchema } from "./src/core/generation-schema.js";

const contract = JSON.parse(readFileSync("fixtures/shadcn.v0_4.dspack.json", "utf8"));
const client = new Anthropic({ timeout: 120_000 });
const model = process.env.PROBE_MODEL ?? "claude-sonnet-5";

for (const depth of [6, 5, 4, 3, 2, 1]) {
  const schema = buildGenerationSchema(contract, "destructive-action", { depth });
  const size = JSON.stringify(schema).length;
  try {
    const msg = await client.messages.create({
      model,
      max_tokens: 16,
      messages: [{ role: "user", content: "a screen to delete my account" }],
      output_config: { format: { type: "json_schema", schema: schema as never } },
    } as never);
    console.log(`depth ${depth} (${(size/1024).toFixed(0)} KB): ACCEPTED (stop_reason ${(msg as never as {stop_reason:string}).stop_reason})`);
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const grammar = /grammar is too large/i.test(err.message ?? "");
    console.log(`depth ${depth} (${(size/1024).toFixed(0)} KB): ${grammar ? "REJECTED (grammar too large)" : `ERROR ${err.status}: ${(err.message ?? "").slice(0, 90)}`}`);
  }
}
