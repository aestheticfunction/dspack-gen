#!/usr/bin/env node
/**
 * Write src/theme/fixtures/parity-golden.json: the hash of compileRealizations() for every proposal of the
 * parity grid, plus two full outputs for readability. Pass the directory of the compiler to record from
 * (by default, this package's src/theme). It was first run against the af-site incubation copy, before the move.
 *
 * Usage: node scripts/theme-parity-golden.mjs [compilerDir] > src/theme/fixtures/parity-golden.json
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { grid } from "../src/theme/fixtures/parity-grid.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(process.argv[2] ?? path.join(here, "..", "src", "theme"));
const { compileRealizations, COMPILER_VERSION } = await import(pathToFileURL(path.join(dir, "compile.mjs")).href);
const sha = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const cases = grid().map(({ id, proposal }) => {
  const out = compileRealizations({ proposal, contract: { tokens: {} } });
  return { id, proposal, ok: out.ok, sha256: sha(out) };
});
const full = ["grid-00", "grid-17"].map((id) => ({ id, output: compileRealizations({ proposal: cases.find((c) => c.id === id).proposal, contract: { tokens: {} } }) }));
console.log(JSON.stringify({ compilerVersion: COMPILER_VERSION, source: process.argv[3] ?? "this package", hash: "sha256 of JSON.stringify(compileRealizations({ proposal, contract: { tokens: {} } }))", cases, full }, null, 1));
