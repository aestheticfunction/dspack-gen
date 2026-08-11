/**
 * P3a fail-first: sub-components that participate in a profile-declared
 * Collect JOIN must be REQUIRED to carry `id` in the generation schema.
 * Evidence (Gateway corpus, Phase-2 baseline): keyless `tabs-trigger` /
 * `radio-group-item` and prefix-mismatched trigger/content pairs are the
 * dominant join failure — ids are schema-optional today, so the model omits
 * or free-styles them and the emitter's join refuses after generation ends.
 * Profile-derived (the run layer owns profile knowledge — core stays
 * profile-free, same layering as casualtyFreeView).
 */
import { describe, expect, it } from "vitest";
import { loadProfile } from "@aestheticfunction/dspack-emit";
import { buildGenerationSchema } from "../core/generation-schema.js";
import { compileContext } from "../core/compiler.js";
import type { Contract } from "../core/contract.js";
import { ScriptedAdapter } from "../adapters/fake.js";
import { runPipeline } from "./orchestrator.js";

const contract: Contract = {
  dspack: "0.4",
  name: "join-kit",
  version: "1.0.0",
  components: {
    panes: {
      description: "A paned compound joined by id.",
      props: {},
      composition: {
        subComponents: [{ id: "mini-trigger" }, { id: "mini-content" }],
      },
    },
    chooser: {
      description: "A chooser whose items key labels by htmlFor.",
      props: {},
      composition: { subComponents: [{ id: "mini-item" }] },
    },
    picker: {
      description: "A picker whose items collect WITHOUT a join.",
      props: {},
      composition: { subComponents: [{ id: "mini-option" }] },
    },
    "mini-label": { description: "Standalone label.", props: { htmlFor: { type: "string" } } },
    text: { description: "Text.", props: {} },
  },
  intents: [{ id: "demo", description: "Demo intent." }],
  rules: [],
  examples: [
    {
      id: "ex.panes",
      intent: "demo",
      prompt: "panes",
      surface: {
        dspackSurface: "0.1",
        system: "join-kit",
        intent: "demo",
        root: { component: "panes", id: "p", children: [] },
      },
    },
  ],
} as unknown as Contract;

const profile = loadProfile({
  profileVersion: "2",
  catalogTitle: "Join-kit profile",
  catalogDescription: "Minimal v2 profile for join-id schema tests.",
  catalogIdBase: "https://example.invalid/catalogs/join-kit",
  instructions: "Demo.",
  primaryColorToken: { category: "color", name: "primary" },
  components: [
    {
      a2ui: "Panes",
      dspackId: "panes",
      commons: ["ComponentCommon"],
      structural: {
        sections: {
          schema: { type: "array", items: { type: "object", properties: { title: { type: "string" }, value: { type: "string" }, child: { $ref: "#/$defs/ComponentId" } }, required: ["title"], additionalProperties: false } },
          description: "Paired trigger/panel records.",
          synthNote: "Declared join keyed on ids.",
        },
      },
      propMap: {},
      required: ["sections"],
      surface: {
        collects: [
          {
            of: ["mini-trigger"],
            into: "prop:sections",
            item: { title: "self.text", value: "self.id" },
            join: { with: ["mini-content"], on: { left: "self.id", right: "self.id" }, fields: { child: "children" } },
          },
        ],
      },
    },
    {
      a2ui: "Chooser",
      dspackId: "chooser",
      commons: ["ComponentCommon"],
      structural: {
        options: {
          schema: { type: "array", items: { type: "object", properties: { value: { type: "string" }, label: { type: "string" } }, required: ["value"], additionalProperties: false } },
          description: "Item records keyed by id, labels joined via htmlFor.",
          synthNote: "Declared join; the with-side keys on htmlFor.",
        },
      },
      propMap: {},
      required: ["options"],
      surface: {
        collects: [
          {
            of: ["mini-item"],
            into: "prop:options",
            item: { value: "self.id" },
            join: { with: ["mini-label"], on: { left: "self.id", right: "self.props.htmlFor" }, fields: { label: "self.text" } },
          },
        ],
      },
    },
    {
      a2ui: "Picker",
      dspackId: "picker",
      commons: ["ComponentCommon"],
      structural: {
        options: {
          schema: { type: "array", items: { type: "object", properties: { label: { type: "string" } }, additionalProperties: false } },
          description: "Collected option records (no join).",
          synthNote: "Flat collect.",
        },
      },
      propMap: {},
      required: ["options"],
      surface: {
        collects: [{ of: ["mini-option"], into: "prop:options", item: { label: "self.text" } }],
      },
    },
    { a2ui: "Text", dspackId: "text", commons: ["ComponentCommon"], structural: {}, propMap: {}, required: [], surface: {} },
  ],
  synthesized: [],
  casualtyComponents: [],
  surfaceSynthesis: { textComponent: "Text", textProp: "text", wrapComponent: "Column", wrapChildrenProp: "children" },
});

function branchesFor(schema: Record<string, unknown>, component: string): Array<{ required?: string[] }> {
  const defs = (schema as { $defs?: Record<string, { anyOf?: Array<{ properties?: { component?: { const?: string } }; required?: string[] }> }> }).$defs ?? {};
  const out: Array<{ required?: string[] }> = [];
  for (const def of Object.values(defs)) {
    for (const b of def.anyOf ?? []) if (b.properties?.component?.const === component) out.push(b);
  }
  return out;
}

describe("join-participating sub-components require id in the generation schema (P3a)", () => {
  it("joinIdComponents derives exactly the self.id-keyed participants", async () => {
    const mod = await import("./join-id-view.js");
    const ids = mod.joinIdComponents(profile);
    expect([...ids].sort()).toEqual(["mini-content", "mini-item", "mini-trigger"]);
  });

  it("requireJoinIds makes id required on every unroll level for participants, and only them", async () => {
    const mod = await import("./join-id-view.js");
    const schema = buildGenerationSchema(contract, "demo");
    const tightened = mod.requireJoinIds(schema, profile) as Record<string, unknown>;
    for (const comp of ["mini-trigger", "mini-content", "mini-item"]) {
      const branches = branchesFor(tightened, comp);
      expect(branches.length).toBeGreaterThan(0);
      for (const b of branches) expect(b.required).toContain("id");
    }
    for (const comp of ["mini-option", "mini-label", "text"]) {
      for (const b of branchesFor(tightened, comp)) expect(b.required ?? []).not.toContain("id");
    }
  });

  it("without a profile the schema is returned unchanged by reference", async () => {
    const mod = await import("./join-id-view.js");
    const schema = buildGenerationSchema(contract, "demo");
    expect(mod.requireJoinIds(schema, undefined)).toBe(schema);
  });

  it("the pipeline hands adapters the tightened schema when an emit profile is active", async () => {
    const surface = contract.examples![0]!.surface;
    const adapter = new ScriptedAdapter([{ output: surface }]);
    await runPipeline({ contract, intent: "demo", prompt: "panes", adapter, maxRepairs: 0, emitProfile: profile }).catch(() => undefined);
    const seen = adapter.requests.at(0)?.jsonSchema as Record<string, unknown>;
    expect(seen).toBeDefined();
    const branches = branchesFor(seen, "mini-trigger");
    expect(branches.length).toBeGreaterThan(0);
    for (const b of branches) expect(b.required).toContain("id");
  });
});
