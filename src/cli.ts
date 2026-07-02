#!/usr/bin/env -S npx tsx
/**
 * dspack-gen CLI.
 *
 *   dspack-gen context --dspack <contract.json> --intent <id> [--depth N] [--no-steering]
 *
 * Prints the compiled generation context ({ system, schema, fewshot }) as JSON.
 * Later PRs add `lint` (surface gates S1–S3) and `run` (the full pipeline).
 *
 * Exit codes (full table in README): 0 clean, 1 internal/usage error,
 * 2 governance failure, 3 emitter-gate failure, 4 unknown rule type.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Contract } from "./core/contract.js";
import { compileContext } from "./core/compiler.js";

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

const BOOLEAN_FLAGS = new Set(["no-steering"]);

function parseFlags(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) fail(`unexpected argument '${token}' (flags start with --)`);
    const eq = token.indexOf("=");
    if (eq !== -1) {
      flags.set(token.slice(2, eq), token.slice(eq + 1));
    } else if (BOOLEAN_FLAGS.has(token.slice(2))) {
      flags.set(token.slice(2), "true");
    } else {
      const value = argv[++i];
      if (value === undefined) fail(`flag '${token}' is missing a value`);
      flags.set(token.slice(2), value);
    }
  }
  return flags;
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== "context") fail(`unknown command '${command ?? ""}' (available: context)`);

  const flags = parseFlags(rest);
  const contractPath = flags.get("dspack") ?? fail("--dspack <contract.json> is required");
  const intent = flags.get("intent") ?? fail("--intent <id> is required");

  const contract = JSON.parse(readFileSync(resolve(contractPath), "utf8")) as Contract;
  let context;
  try {
    context = compileContext(contract, intent, {
      depth: flags.has("depth") ? Number(flags.get("depth")) : undefined,
      omitRuleSteering: flags.get("no-steering") === "true",
    });
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
  process.stdout.write(JSON.stringify(context, null, 2) + "\n");
}

main();
