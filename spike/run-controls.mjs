#!/usr/bin/env node
/**
 * S0 controls: isolate WHERE structured outputs break.
 *  C1 — trivial schema on each model: if violated, `format` is ignored for
 *       that model/engine entirely (not a schema-size problem).
 *  C2 — the real depth-3 generation schema on a non-mlx model (llama.cpp
 *       engine), where grammar-constrained decoding is the known path.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

const OLLAMA = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const CONTRACT = "/Users/ryandombrowski/Desktop/dspack/examples/shadcn-ui.dspack.json";
const MODELS = (process.env.MODELS ?? "gemma4:e4b-mlx,gpt-oss:latest").split(",");

const tiny = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "reason"],
  properties: { ok: { type: "boolean" }, reason: { type: "string", maxLength: 40 } },
};

const depth3 = JSON.parse(
  execFileSync("node", ["spike/build-generation-schema.mjs", CONTRACT, "3"], {
    maxBuffer: 64 * 1024 * 1024,
  }).toString(),
);

async function run(model, schema, label, messages) {
  const t0 = Date.now();
  let out = { model, label };
  try {
    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, stream: false, format: schema, options: { temperature: 0.2 }, messages }),
    });
    out.wallMs = Date.now() - t0;
    if (!res.ok) {
      out.error = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
    } else {
      const data = await res.json();
      const raw = data.message?.content ?? "";
      out.rawHead = raw.slice(0, 200);
      out.evalCount = data.eval_count;
      try {
        const parsed = JSON.parse(raw);
        out.parsedJson = true;
        const validate = new Ajv2020({ strict: false }).compile(schema);
        out.schemaValid = validate(parsed) === true;
        if (!out.schemaValid) out.firstError = validate.errors?.[0];
      } catch (e) {
        out.parsedJson = false;
        out.parseError = String(e).slice(0, 120);
      }
    }
  } catch (e) {
    out.error = String(e).slice(0, 200);
  }
  console.log(
    `${model} ${label}: ${(out.wallMs ?? 0) / 1000}s json=${out.parsedJson} valid=${out.schemaValid}` +
      (out.error ? ` ERROR ${out.error.slice(0, 100)}` : "") +
      (out.parsedJson === false ? ` rawHead=${JSON.stringify(out.rawHead)}` : ""),
  );
  return out;
}

const results = [];
for (const model of MODELS) {
  results.push(
    await run(model, tiny, "C1-tiny", [
      { role: "user", content: "Is the sky blue on a clear day? Answer via the JSON schema." },
    ]),
  );
  results.push(
    await run(model, depth3, "C2-depth3", [
      { role: "system", content: "You generate UI surfaces as dspack surface JSON documents for shadcn/ui." },
      { role: "user", content: "a screen to delete my account" },
    ]),
  );
}
writeFileSync("spike/controls.json", JSON.stringify(results, null, 2));
console.log("wrote spike/controls.json");
