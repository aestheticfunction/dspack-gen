/**
 * 0.1.1 grammar-alignment regressions. Grammar-constrained decoders (Ollama
 * structured outputs / llama.cpp) enforce the generation schema's declared
 * property ORDER and TYPES verbatim, so both are load-bearing API:
 *
 * - array-typed contract props must reach the schema as arrays (0.1.0's
 *   string fallback made the grammar forbid the arrays models plan);
 * - `text` must be declared AFTER `props` (models and worked examples
 *   serialize props first; declared the other way round, node text becomes
 *   unreachable the moment props is emitted — measured as text-less nodes
 *   in every live generation before 0.1.1).
 *
 * The Astryx worked examples double as regression oracles: each example
 * surface must validate against its own intent's generation schema. Under
 * 0.1.0 the recipe example FAILS (its table's `columns`/`data` arrays hit a
 * string-typed schema) — that is the fails-on-0.1.0/passes-on-0.1.1 gate.
 */
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import type { Contract } from "./contract.js";
import { compileContext } from "./compiler.js";
import { lintSurface } from "./lint/index.js";

const astryx = JSON.parse(readFileSync("fixtures/astryx.v0_1_2.dspack.json", "utf8")) as Contract;
const ajv = new Ajv2020({ strict: false });

const branchesOf = (schema: any) =>
  Object.keys(schema.$defs)
    .filter((k) => k.startsWith("node_"))
    .flatMap((k) => schema.$defs[k].anyOf ?? [schema.$defs[k]]);

describe("array props reach the grammar as arrays", () => {
  const schema = compileContext(astryx, "structured-editing").schema as any;
  const table = branchesOf(schema).find((b: any) => b.properties.component.const === "table");

  it("table.columns is an array of strings (was type:string under 0.1.0)", () => {
    expect(table.properties.props.properties.columns).toEqual({ type: "array", items: { type: "string" } });
  });

  it("table.data is an array of { cells: string[] } records (contract-declared items pass through)", () => {
    expect(table.properties.props.properties.data).toMatchObject({
      type: "array",
      items: { type: "object", required: ["cells"] },
    });
  });

  it("a grammar-shaped table node validates; the 0.1.0-era string shape is rejected", () => {
    const validate = ajv.compile(schema);
    const node = (props: unknown) => ({
      dspackSurface: "0.1",
      system: astryx.name,
      intent: "structured-editing",
      root: { component: "table", id: "t", props },
    });
    expect(validate(node({ columns: ["Ingredient", "Amount"], data: [{ cells: ["Spaghetti", "180 g"] }] }))).toBe(true);
    // What the string-typed 0.1.0 schema forced models toward:
    expect(validate(node({ columns: "Ingredient,Amount" }))).toBe(false);
    expect(validate(node({ columns: [{ key: "a", header: "A" }] }))).toBe(false);
  });
});

describe("node text stays reachable under order-enforcing grammars", () => {
  it("every branch declares text AFTER props (and children last)", () => {
    for (const intent of astryx.intents ?? []) {
      const schema = compileContext(astryx, intent.id).schema as any;
      for (const branch of branchesOf(schema)) {
        const keys = Object.keys(branch.properties);
        const [iProps, iText] = [keys.indexOf("props"), keys.indexOf("text")];
        if (iProps !== -1) {
          expect(iText, `text before props in ${branch.properties.component.const}`).toBeGreaterThan(iProps);
        }
        if (keys.includes("children")) expect(keys.at(-1)).toBe("children");
      }
    }
  });

  it("a node serialized props-first with trailing text validates", () => {
    const schema = compileContext(astryx, "structured-editing").schema as any;
    const validate = ajv.compile(schema);
    // Exactly the member order models emit; JSON.parse preserves it and the
    // grammar built from this schema admits it only with text declared last.
    const surface = JSON.parse(
      '{"dspackSurface":"0.1","system":"Astryx","intent":"structured-editing",' +
        '"root":{"component":"text","id":"title","props":{"type":"display-3"},"text":"Weeknight pasta"}}',
    );
    expect(validate(surface)).toBe(true);
  });
});

describe("worked examples validate against their own generation schemas", () => {
  // The fails-on-0.1.0 gate: ex.recipe-creator's table props hit the string
  // fallback there. All intents covered so no example regresses silently.
  for (const example of astryx.examples ?? []) {
    it(`${example.id} (${example.intent}) is schema-valid and lints clean`, () => {
      const schema = compileContext(astryx, example.intent).schema as any;
      const validate = ajv.compile(schema);
      const doc = { dspackSurface: "0.1", system: astryx.name, intent: example.intent, root: example.surface.root };
      const ok = validate(doc);
      expect(ok, JSON.stringify(validate.errors ?? []).slice(0, 400)).toBe(true);
      const report = lintSurface(example.surface, astryx);
      for (const gate of report.gates) expect(gate.status, `${example.id} ${gate.gate}`).not.toBe("FAIL");
    });
  }
});
