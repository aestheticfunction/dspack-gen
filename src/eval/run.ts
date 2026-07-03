#!/usr/bin/env -S npx tsx
/**
 * `npm run eval -- --adapter fake --matrix eval/matrix.fake.json [--out out/eval/fake]`
 * `npm run eval -- --adapter live --matrix eval/matrix.json      [--out out/eval/<ts>]`
 *
 * Fake mode is deterministic (scripted fixtures, fixed clock) and is the CI
 * gate; live mode talks to the configured providers and is documented, never
 * CI-gating. Exit 0 on completion (results are data, not a pass/fail —
 * thresholds are `eval:assert`'s job); exit 1 on usage/internal error.
 */
import { runMatrix } from "./runner.js";

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function parseFlags(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();
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
  return flags;
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const adapterMode = flags.get("adapter") ?? fail("--adapter fake|live is required");
  if (adapterMode !== "fake" && adapterMode !== "live") fail("--adapter must be 'fake' or 'live'");
  const matrixPath = flags.get("matrix") ?? fail("--matrix <matrix.json> is required");
  const outDir =
    flags.get("out") ??
    (adapterMode === "fake" ? "out/eval/fake" : `out/eval/${new Date().toISOString().replace(/[:.]/g, "-")}`);

  const results = await runMatrix({
    matrixPath,
    outDir,
    adapterMode,
    // Fixed clock in fake mode: retained reports and results.json are byte-stable.
    now: adapterMode === "fake" ? () => new Date("2026-01-01T00:00:00.000Z") : undefined,
    log: (line) => console.error(line),
  });
  console.error(`eval: ${results.cells.length} cell(s) -> ${outDir}/results.json`);
}

void main();
