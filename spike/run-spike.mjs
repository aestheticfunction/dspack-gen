#!/usr/bin/env node
/**
 * S0 spike runner: models × depths, Ollama structured outputs (/api/chat with
 * `format` = the generation schema). Measures wall time + Ollama's own timing
 * fields, validates each output against the same schema (ajv), and records an
 * informal governance signal (dialog vs alert-dialog usage) — the linter does
 * not exist yet; that signal is observational only.
 *
 * Bounded per the plan: no prompt optimization, no extra models, no eval matrix.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";

const CONTRACT = process.env.CONTRACT ?? "/Users/ryandombrowski/Desktop/dspack/examples/shadcn-ui.dspack.json";
const MODELS = (process.env.MODELS ?? "gemma4:e4b-mlx,qwen3.6:35b-mlx").split(",");
const DEPTHS = (process.env.DEPTHS ?? "3,6").split(",").map(Number);
const RUNS = Number(process.env.RUNS ?? 2);
const OLLAMA = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const OUT = process.env.OUT ?? "spike/results.json";

const contract = JSON.parse(readFileSync(CONTRACT, "utf8"));
const example = contract.examples[0];

const system = [
  `You generate user interface surfaces for the "${contract.name}" design system.`,
  "You must respond with a single JSON object conforming to the provided schema — a dspack surface document.",
  "",
  "## Component vocabulary",
  "You may use only these components:",
  ...Object.entries(contract.components).map(([id, c]) => {
    const props = Object.entries(c.props ?? {})
      .map(([p, d]) => (d.values ? `${p} ∈ {${d.values.map((v) => (v && typeof v === "object" ? v.value : v)).join(", ")}}` : p))
      .join("; ");
    const subs = (c.composition?.subComponents ?? []).map((s) => s.id).join(", ");
    return `- ${id} — ${c.description}${props ? ` Props: ${props}.` : ""}${subs ? ` Sub-components (used as children): ${subs}.` : ""}`;
  }),
  "",
  "## Governance rules in effect (intent: destructive-action)",
  "These are hard requirements. Surfaces violating them will be rejected:",
  ...(contract.rules ?? []).map((r, i) => `${i + 1}. [${r.id} / ${r.severity}] ${ruleText(r)} Why: ${r.rationale}`),
  "",
  "## Design intent",
  `Intent "destructive-action": ${contract.intents[0].description}`,
  "",
  "Output only the JSON object. No commentary.",
].join("\n");

function ruleText(r) {
  if (r.type === "component-choice")
    return `${r.require ? `Use ${r.require.join(", ")} for this surface` : ""}${r.forbid ? `; ${r.forbid.join(", ")} is forbidden.` : "."}`;
  if (r.type === "required-composition")
    return `Every ${r.component} must contain ${(r.requiredSubComponents ?? []).map((s) => s.id).join(" and ")}.`;
  if (r.type === "forbidden-composition")
    return `Never place ${(r.forbiddenDescendants ?? []).join(" or ")} inside a ${r.component}.`;
  return "";
}

function collectComponents(node, acc = new Set()) {
  if (!node || typeof node !== "object") return acc;
  if (node.component) acc.add(node.component);
  for (const child of node.children ?? []) collectComponents(child, acc);
  for (const nodes of Object.values(node.slots ?? {})) for (const n of nodes) collectComponents(n, acc);
  return acc;
}

async function chat(model, schema) {
  const body = {
    model,
    stream: false,
    format: schema,
    options: { temperature: 0.2 },
    messages: [
      { role: "system", content: system },
      { role: "user", content: example.prompt },
      { role: "assistant", content: JSON.stringify(example.surface) },
      { role: "user", content: "a screen to delete my account" },
    ],
  };
  const t0 = Date.now();
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const wallMs = Date.now() - t0;
  if (!res.ok) return { wallMs, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
  const data = await res.json();
  return { wallMs, data };
}

const results = [];
for (const depth of DEPTHS) {
  const schemaJson = execFileSync("node", ["spike/build-generation-schema.mjs", CONTRACT, String(depth)], {
    maxBuffer: 64 * 1024 * 1024,
  }).toString();
  const schema = JSON.parse(schemaJson);
  const validate = new Ajv2020({ strict: false }).compile(schema);
  console.log(`\n=== depth ${depth} (schema ${schemaJson.length} bytes) ===`);

  for (const model of MODELS) {
    for (let run = 1; run <= RUNS; run++) {
      process.stdout.write(`${model} depth=${depth} run=${run} … `);
      let record = { model, depth, run, schemaBytes: schemaJson.length };
      try {
        const { wallMs, data, error } = await chat(model, schema);
        record.wallMs = wallMs;
        if (error) {
          record.error = error;
        } else {
          record.timings = {
            total_duration: data.total_duration,
            load_duration: data.load_duration,
            prompt_eval_count: data.prompt_eval_count,
            prompt_eval_duration: data.prompt_eval_duration,
            eval_count: data.eval_count,
            eval_duration: data.eval_duration,
          };
          const raw = data.message?.content ?? "";
          record.outputBytes = raw.length;
          try {
            const parsed = JSON.parse(raw);
            record.parsedJson = true;
            record.schemaValid = validate(parsed) === true;
            if (!record.schemaValid) record.schemaErrors = (validate.errors ?? []).slice(0, 5);
            const used = [...collectComponents(parsed.root)];
            record.componentsUsed = used;
            record.usedAlertDialog = used.includes("alert-dialog");
            record.usedDialog = used.includes("dialog");
            record.output = parsed;
          } catch (e) {
            record.parsedJson = false;
            record.parseError = String(e).slice(0, 200);
            record.rawHead = raw.slice(0, 400);
          }
        }
      } catch (e) {
        record.error = String(e).slice(0, 300);
      }
      results.push(record);
      console.log(
        record.error
          ? `ERROR ${record.error.slice(0, 120)}`
          : `${(record.wallMs / 1000).toFixed(1)}s json=${record.parsedJson} valid=${record.schemaValid} alertDialog=${record.usedAlertDialog} dialog=${record.usedDialog}`,
      );
      writeFileSync(OUT, JSON.stringify(results, null, 2));
    }
  }
}
console.log(`\nwrote ${OUT} (${results.length} runs)`);
