/**
 * Core-boundary gate (ADR-10): `@aestheticfunction/dspack-gen/core` must stay
 * zero-network and emitter-free — ds-mcp's read-only/no-network security
 * posture depends on importing exactly this subset.
 *
 * Static check over every module under src/core: no network-capable imports,
 * no fetch calls, no imports reaching outside core (adapters, run, emitters).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CORE_DIR = "src/core";
const FORBIDDEN_MODULES = [
  "node:http",
  "node:https",
  "node:net",
  "node:tls",
  "node:dgram",
  "node:child_process",
  "undici",
];

const files = readdirSync(CORE_DIR, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => join(CORE_DIR, f));

describe("core boundary", () => {
  it("covers the core modules", () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  it.each(files)("%s imports no network modules and nothing outside core", (file) => {
    const source = readFileSync(file, "utf8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"|import\s*\(\s*"([^"]+)"\s*\)/g)].map(
      (m) => m[1] ?? m[2],
    );
    for (const specifier of imports) {
      expect(FORBIDDEN_MODULES, `${file} imports ${specifier}`).not.toContain(specifier);
      if (specifier.startsWith(".")) {
        // Relative imports may traverse within core (lint/ -> ../contract.js)
        // but must never escape src/core itself.
        const depth = file.split("/").length - 2; // segments below src/
        const ups = specifier.match(/\.\.\//g)?.length ?? 0;
        expect(ups, `${file} escapes core via ${specifier}`).toBeLessThan(depth);
      } else {
        // Bare imports: node built-ins (non-network, checked above) and the
        // pure-computation validator ajv only.
        const allowed = specifier.startsWith("node:") || specifier === "ajv" || specifier.startsWith("ajv/") || specifier === "ajv-formats";
        expect(allowed, `${file} bare-imports ${specifier}`).toBe(true);
      }
    }
    expect(source, `${file} performs network I/O`).not.toMatch(/\bfetch\s*\(/);
  });
});
