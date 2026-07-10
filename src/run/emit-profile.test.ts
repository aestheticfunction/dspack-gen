/**
 * RunOptions.emitProfile: the a2ui emission target accepts a caller-supplied
 * mapping profile, so non-shadcn contracts (the Astryx path) can emit and
 * gate-validate over A2UI. Default behavior (no profile) stays the shadcn
 * profile — the Astryx contract must still refuse there, proving the option
 * is what unlocks it rather than a behavior change for existing callers.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Profile } from "@aestheticfunction/dspack-emit";
import type { Contract } from "../core/contract.js";
import { ScriptedAdapter } from "../adapters/fake.js";
import { runPipeline } from "./orchestrator.js";

const astryx = JSON.parse(readFileSync("fixtures/astryx.v0_1_2.dspack.json", "utf8")) as Contract;
const workedExample = (astryx.examples ?? []).find((e) => e.id === "ex.delete-project-confirmation")!;

const DynStr = { $ref: "#/$defs/DynamicString" };
const CompId = { $ref: "#/$defs/ComponentId" };

/** Minimal Astryx profile covering the worked example's vocabulary. */
const miniAstryxProfile: Profile = {
  catalogTitle: "Astryx mini (test)",
  catalogDescription: "Test profile covering the worked example only.",
  catalogIdBase: "https://example.invalid/catalogs/astryx-mini",
  instructions: "Use Column for layout.",
  primaryColorToken: { category: "color", name: "primary" },
  surfaceSynthesis: {
    textComponent: "Text",
    textProp: "text",
    wrapComponent: "Column",
    wrapChildrenProp: "children",
  },
  components: [
    {
      a2ui: "Button",
      dspackId: "button",
      commons: ["ComponentCommon"],
      structural: {
        action: {
          schema: { $ref: "#/$defs/Action" },
          description: "Dispatched on activation.",
          synthNote: "A2UI requires a declarative action.",
        },
      },
      propMap: {
        label: { a2ui: "label", kind: "string", description: "Visible label." },
        variant: {
          a2ui: "variant",
          kind: "enum",
          targetEnum: ["primary", "secondary", "ghost", "destructive"],
          default: "primary",
          description: "Carried verbatim.",
        },
      },
      required: ["label", "action"],
      surfacePlan: { actionProp: "action" },
    },
    {
      a2ui: "Card",
      dspackId: "card",
      commons: ["ComponentCommon"],
      structural: {
        child: { schema: CompId, description: "Single child id.", synthNote: "Children collapse to one slot." },
      },
      required: ["child"],
      surfacePlan: { childProp: "child" },
    },
    {
      a2ui: "AlertDialog",
      dspackId: "alert-dialog",
      commons: ["ComponentCommon"],
      structural: {
        action: { schema: { $ref: "#/$defs/Action" }, description: "Confirm action.", synthNote: "Synthesized." },
      },
      propMap: {
        title: { a2ui: "title", kind: "string", description: "Title." },
        description: { a2ui: "description", kind: "string", description: "Consequences." },
        actionLabel: { a2ui: "actionLabel", kind: "string", description: "Specific confirm label." },
        cancelLabel: { a2ui: "cancelLabel", kind: "string", description: "Cancel label." },
        actionVariant: {
          a2ui: "actionVariant",
          kind: "enum",
          targetEnum: ["primary", "secondary", "ghost", "destructive"],
          default: "destructive",
          description: "Confirm button variant.",
        },
      },
      required: ["title", "actionLabel", "action"],
      surfacePlan: { actionProp: "action" },
    },
    {
      a2ui: "Text",
      dspackId: "text",
      commons: ["ComponentCommon"],
      structural: {
        text: { schema: DynStr, description: "Content.", synthNote: "From node text." },
      },
      propMap: {
        as: {
          a2ui: "variant",
          kind: "enum",
          targetEnum: ["h1", "h2", "h3", "body", "caption"],
          valueMap: { h1: "h1", h2: "h2", h3: "h3", p: "body", span: "body", div: "body", label: "caption" },
          default: "body",
          description: "Projected element/type.",
        },
      },
      required: ["text"],
      surfacePlan: { textProp: "text" },
    },
  ],
  synthesized: [
    {
      a2ui: "Column",
      commons: ["ComponentCommon"],
      description: "Vertical layout primitive.",
      structural: {
        children: { schema: { $ref: "#/$defs/ChildList" }, description: "Child ids.", synthNote: "Synthesized." },
      },
      required: ["children"],
    },
  ],
  casualtyComponents: [],
};

describe("RunOptions.emitProfile (a2ui target, non-shadcn contracts)", () => {
  it("the Astryx worked example emits and passes A-gates with its own profile", async () => {
    const adapter = new ScriptedAdapter([{ output: workedExample.surface }]);
    const result = await runPipeline({
      contract: astryx,
      intent: "destructive-action",
      prompt: "a screen to delete a project",
      adapter,
      maxRepairs: 0,
      emitProfile: miniAstryxProfile,
    });
    expect(result.report.outcome).toBe("passed");
    expect(result.exitCode).toBe(0);
    const emitted = result.report.emitted as {
      target: string;
      validations: Array<{ a2uiVersion: string; gates: Array<{ gate: string; pass: boolean }> }>;
    };
    expect(emitted.target).toBe("a2ui");
    expect(emitted.validations.map((v) => v.a2uiVersion)).toEqual(["0.9.1", "1.0"]);
    for (const v of emitted.validations) {
      expect(v.gates.every((g) => g.pass)).toBe(true);
    }
  });

  it("without emitProfile the Astryx contract still refuses under the default shadcn profile", async () => {
    const adapter = new ScriptedAdapter([{ output: workedExample.surface }]);
    const result = await runPipeline({
      contract: astryx,
      intent: "destructive-action",
      prompt: "a screen to delete a project",
      adapter,
      maxRepairs: 0,
    });
    expect(result.report.outcome).toBe("failed-gate");
    expect(result.exitCode).toBe(3);
  });
});
