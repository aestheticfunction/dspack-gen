#!/usr/bin/env -S npx tsx
/**
 * `npm run eval:assert -- --results <results.json> --model <ref> --min-repair-success 0.9`
 *
 * Threshold check over an eval `results.json`: exit 0 when the model's
 * repair-success rate meets the minimum, exit 2 when it does not (or when
 * the rate is undefined because no run violated — a threshold over zero
 * observations is vacuously unmet, stated loudly rather than passed
 * silently). Per the plan, the hosted-model threshold is the only hard eval
 * gate in M2; local models are report-only.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EvalResults } from "./types.js";

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

const flags = new Map<string, string>();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const token = argv[i];
  if (!token.startsWith("--")) fail(`unexpected argument '${token}'`);
  const eq = token.indexOf("=");
  if (eq !== -1) flags.set(token.slice(2, eq), token.slice(eq + 1));
  else {
    const value = argv[++i];
    if (value === undefined) fail(`flag '${token}' is missing a value`);
    flags.set(token.slice(2), value);
  }
}

const resultsPath = flags.get("results") ?? fail("--results <results.json> is required");
const model = flags.get("model") ?? fail("--model <ref> is required");
const minRaw = flags.get("min-repair-success") ?? fail("--min-repair-success <0..1> is required");
const min = Number(minRaw);
if (!(min >= 0 && min <= 1)) fail(`--min-repair-success must be in [0,1] (got '${minRaw}')`);

const results = JSON.parse(readFileSync(resolve(resultsPath), "utf8")) as EvalResults;
const metrics = results.byModel[model];
if (!metrics) fail(`no results for model '${model}' (models present: ${Object.keys(results.byModel).join(", ")})`);

if (metrics.repairSuccessRate === null) {
  console.error(
    `eval:assert FAIL — ${model}: repair-success rate is undefined (no first-attempt violations in ${metrics.runs} run(s)); a threshold cannot be met over zero observations`,
  );
  process.exit(2);
}
const pass = metrics.repairSuccessRate >= min;
console.error(
  `eval:assert ${pass ? "PASS" : "FAIL"} — ${model}: repair-success ${metrics.repairSuccessRate} (min ${min}, over ${metrics.runs} run(s))`,
);
process.exit(pass ? 0 : 2);
