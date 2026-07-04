/** ADR-M3-4 escalation diagnostic: at depth 1, how many components does the
 * hosted grammar ceiling admit? Slices the contract vocabulary (components
 * map prefix) — a diagnostic for the escalation report, not an experiment. */
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { buildGenerationSchema } from "../../../src/core/generation-schema.js";

const full = JSON.parse(readFileSync(new URL("../../../fixtures/", import.meta.url).pathname + "shadcn.v0_4.dspack.json", "utf8"));
const client = new Anthropic({ timeout: 120_000 });
const ids = Object.keys(full.components);
for (const k of [6, 4, 2, 1]) {
  const contract = { ...full, components: Object.fromEntries(ids.slice(0, k).map(id => [id, full.components[id]])) };
  const subs = Object.values(contract.components).reduce((n, c) => n + (((c as {composition?:{subComponents?:unknown[]}}).composition?.subComponents ?? []).length), 0);
  const schema = buildGenerationSchema(contract, "destructive-action", { depth: 1 });
  const size = JSON.stringify(schema).length;
  try {
    await client.messages.create({
      model: "claude-sonnet-5", max_tokens: 16,
      messages: [{ role: "user", content: "a screen" }],
      output_config: { format: { type: "json_schema", schema: schema as never } },
    } as never);
    console.log(`depth 1, ${k} components (+${subs} subs, ${(size/1024).toFixed(1)} KB): ACCEPTED`);
  } catch (e) {
    const err = e as { message?: string };
    const grammar = /grammar is too large/i.test(err.message ?? "");
    console.log(`depth 1, ${k} components (+${subs} subs, ${(size/1024).toFixed(1)} KB): ${grammar ? "REJECTED (grammar)" : "ERROR: " + (err.message ?? "").slice(0, 80)}`);
  }
}
