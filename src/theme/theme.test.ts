/**
 * The deterministic theme compiler (./theme), graduated from its incubation in Aesthetic Function's website.
 * These tests hold the graduated modules to what the incubation copy produced, and to the properties its own
 * gates enforced: determinism, fail-closed compilation, the ratified constraint set, bounded repair, the closed
 * proposal schema, and no side effects.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import golden from "./fixtures/parity-golden.json";
import { grid } from "./fixtures/parity-grid.mjs";
import * as theme from "./index.mjs";
import schema from "./theme-direction.v1.schema.json";

const { compileProposal, compileRealizations, COMPILER_VERSION, CONSTRAINTS, contrastRatio, evaluate, normalizeProposal, solveToRatio, TEXT_RATIO } = theme;
const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const empty = { tokens: {} };
const base = () => structuredClone(grid().find((g: { id: string }) => g.id === "grid-04")!.proposal) as Record<string, any>;

describe("parity with the incubation copy", () => {
  it("every proposal of the parity grid compiles to exactly what the incubation copy produced, in both schemes", () => {
    expect(golden.compilerVersion).toBe(COMPILER_VERSION);
    const cases = grid();
    expect(cases.map((c: { id: string }) => c.id)).toEqual(golden.cases.map((c) => c.id));
    for (const c of cases) {
      const recorded = golden.cases.find((g) => g.id === c.id)!;
      expect(c.proposal, c.id).toEqual(recorded.proposal);
      const out = compileRealizations({ proposal: c.proposal, contract: empty });
      expect(out.ok, c.id).toBe(recorded.ok);
      expect(sha(out), c.id).toBe(recorded.sha256);
    }
    for (const f of golden.full) expect(compileRealizations({ proposal: grid().find((c: { id: string }) => c.id === f.id)!.proposal, contract: empty })).toEqual(f.output);
  });

  it("the grid covers every member of every enum in the schema", () => {
    const seen = new Map<string, Set<string>>();
    const walk = (o: unknown, path: string) => {
      if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
      else if (typeof o === "string") (seen.get(path) ?? seen.set(path, new Set()).get(path)!).add(o);
    };
    for (const c of grid()) walk(c.proposal, "");
    const enums: Array<[string, string[]]> = [];
    const collect = (o: any, path: string) => {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o.enum)) enums.push([path, o.enum]);
      for (const [k, v] of Object.entries(o.properties ?? {})) collect(v, `${path}.${k}`);
    };
    collect(schema, "");
    for (const [path, values] of enums) {
      if (path === ".refusalCategory") continue; // a refusal compiles to nothing; covered below
      for (const v of values) expect(seen.get(path)?.has(v), `${path} = ${v}`).toBe(true);
    }
  });
});

describe("determinism and fail-closed compilation", () => {
  it("the same proposal compiles to byte-identical output every time", () => {
    for (const c of grid().slice(0, 12)) expect(JSON.stringify(compileRealizations({ proposal: c.proposal, contract: empty }))).toBe(JSON.stringify(compileRealizations({ proposal: c.proposal, contract: empty })));
  });

  it("anything outside the vocabulary compiles to nothing applicable: tokens are null, never partial", () => {
    const wrongVersion = { ...base(), directionVersion: "9" };
    const refused = { ...base(), refusal: true, refusalCategory: "hateful" };
    const unknownHue = base();
    unknownHue.surface.hueFamily = "chartreuse";
    const unknownNudge = base();
    unknownNudge.accent.hueNudge = "+7";
    const unknownVoice = base();
    unknownVoice.typography.displayVoice = "gothic";
    for (const p of [wrongVersion, refused, unknownHue, unknownNudge, unknownVoice, null, "a string"]) {
      const out = compileProposal({ proposal: p, contract: empty });
      expect(out.ok).toBe(false);
      expect(out.tokens).toBeNull();
    }
    expect(compileProposal({ proposal: refused, contract: empty })).toMatchObject({ rejection: { refused: true, refusalCategory: "hateful" } });
    expect(compileProposal({ proposal: base(), contract: empty, scheme: "sepia" as never })).toMatchObject({ ok: false, tokens: null });
  });

  it("both realizations, or none: a proposal is accepted only when dark and light both compile", () => {
    const out = compileRealizations({ proposal: base(), contract: empty });
    expect(out.ok).toBe(true);
    if (out.ok) expect(Object.keys(out.realizations).sort()).toEqual(["dark", "light"]);
    const bad = compileRealizations({ proposal: { ...base(), directionVersion: "2" }, contract: empty });
    expect(bad).toMatchObject({ ok: false, realizations: null });
  });

  it("the compiler reads only the token shape of a contract: an empty contract gives the same result", () => {
    const contract = { tokens: { ink: { values: { fg: { value: "#ffffff" } } }, surface: { values: { bg: { value: "#000000" } } } } };
    expect(JSON.stringify(compileRealizations({ proposal: base(), contract }))).toBe(JSON.stringify(compileRealizations({ proposal: base(), contract: empty })));
  });
});

describe("the ratified constraint set and bounded repair", () => {
  it("every accepted realization satisfies every constraint, re-evaluated here from its tokens", () => {
    for (const c of grid()) {
      const out = compileRealizations({ proposal: c.proposal, contract: empty });
      if (!out.ok) continue;
      for (const scheme of ["dark", "light"] as const) {
        const tokens = out.realizations[scheme].tokens;
        for (const r of evaluate({ tokens })) expect(r.disposition, `${c.id} ${scheme} ${r.id}`).not.toBe("failed");
        for (const con of CONSTRAINTS) expect(contrastRatio(tokens[con.fg]!, tokens[con.bg]!)!, `${c.id} ${scheme} ${con.id}`).toBeGreaterThanOrEqual(con.min - 1e-9);
      }
    }
  });

  it("repairs are only the named lightness re-solve, at fixed hue and chroma", () => {
    for (const c of grid()) {
      const out = compileRealizations({ proposal: c.proposal, contract: empty });
      if (!out.ok) continue;
      for (const scheme of ["dark", "light"] as const) for (const r of out.realizations[scheme].repairs) expect(r.operation).toBe("resolve-lightness-at-fixed-hue-and-chroma");
    }
  });

  it("WCAG arithmetic: black on white is 21:1, and the solver lands on the requested ratio", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
    const hex = solveToRatio({ hue: 72, sat: 0.3, against: "#131310", target: TEXT_RATIO })!;
    expect(contrastRatio(hex, "#131310")!).toBeGreaterThanOrEqual(TEXT_RATIO);
  });

  it("an absent display voice is the brand voice, and a weight is clamped to faces the family has", () => {
    const p = base();
    delete p.typography.displayVoice;
    expect(normalizeProposal(p).typography.displayVoice).toBe("brand");
    const anton = base();
    anton.typography.displayVoice = "expressive";
    anton.typography.headlineWeight = "bold";
    const out = compileProposal({ proposal: anton, contract: empty });
    expect(out.ok && out.tokens["type.hl-weight"]).toBe("400");
  });
});

describe("the proposal schema", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  it("accepts every proposal of the parity grid", () => {
    for (const c of grid()) expect(validate(c.proposal), `${c.id}: ${ajv.errorsText(validate.errors)}`).toBe(true);
  });

  it("refuses anything through which a value could pass: extra fields, colours, unknown members", () => {
    expect(validate({ ...base(), css: "body{}" })).toBe(false);
    const colour = base();
    colour.accent.hueFamily = "#ff0000";
    expect(validate(colour)).toBe(false);
    const extra = base();
    extra.surface.value = "#000";
    expect(validate(extra)).toBe(false);
  });
});

describe("types", () => {
  it("every runtime export of ./theme is declared in index.d.ts", () => {
    const dts = readFileSync(fileURLToPath(new URL("./index.d.ts", import.meta.url)), "utf8");
    const missing = Object.keys(theme).filter((k) => !new RegExp(`\\b(const|function) ${k}\\b`).test(dts));
    expect(missing).toEqual([]);
  });
});

describe("no side effects", () => {
  it("the compiler's modules read no clock, randomness, environment or network, and import only each other", () => {
    for (const file of ["compile.mjs", "constraints.mjs", "solve.mjs", "workspace.mjs"]) {
      const source = readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(source, file).not.toMatch(/Date\.now|new Date|Math\.random|process\.|globalThis|fetch\(|XMLHttpRequest|require\(/);
      for (const m of source.matchAll(/^import .* from "([^"]+)";$/gm)) expect(m[1], file).toMatch(/^\.\/(compile|constraints|solve)\.mjs$/);
    }
  });
});
