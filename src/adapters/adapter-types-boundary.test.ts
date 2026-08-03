/**
 * Adapter-types seam (composer Phase 0): hosts implementing their own
 * GenerationAdapter (a Cloudflare Worker, a browser shell) must be able to
 * import the adapter contract without pulling Node transport code, and
 * consumers folding the event stream (dspack-studio's agui-bridge) must get
 * PipelineEvent from the package root instead of hand-mirroring the union.
 *
 * Static checks in the repo's core-boundary style.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AdapterOutputError, parseJsonOutput } from "./types.js";

describe("adapter-types boundary", () => {
  it("src/adapters/types.ts imports nothing (runtime-neutral by construction)", () => {
    const source = readFileSync("src/adapters/types.ts", "utf8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"|import\s*\(\s*"([^"]+)"\s*\)/g)].map(
      (m) => m[1] ?? m[2],
    );
    expect(imports).toEqual([]);
  });

  it("is exported as the ./adapter-types subpath", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.exports["./adapter-types"]).toEqual({
      types: "./dist/adapters/types.d.ts",
      import: "./dist/adapters/types.js",
    });
  });

  it("carries the runtime pieces of the contract", () => {
    expect(typeof parseJsonOutput).toBe("function");
    const err = new AdapterOutputError("test:adapter", "raw", "why");
    expect(err.name).toBe("AdapterOutputError");
  });

  it("the package root re-exports PipelineEvent (no more hand-mirrored unions downstream)", () => {
    const source = readFileSync("src/index.ts", "utf8");
    expect(source).toMatch(/PipelineEvent/);
  });
});
