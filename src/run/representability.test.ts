/**
 * Phase-2 representability repair: a typed EmitSurfaceError — the emitter
 * refusing a contract-legal-but-unrepresentable surface (declared casualties,
 * transparent-dissolution donation boundaries, Collect join key violations) —
 * is a REPAIRABLE event, not an instant terminal failed-gate. The refusal
 * text is a precise repair instruction; the loop gets to spend its remaining
 * attempts on it. And generation stops being steered into refusals at the
 * source: the model's vocabulary/schema/few-shot come from a casualty-free
 * view of the contract, while the S-gates and the report's contract identity
 * keep the ratified original.
 *
 * Deterministic and offline: ScriptedAdapter + an inline minimal contract +
 * a v2 emit profile (loaded through dspack-emit's loadProfile) that declares
 * one contract component ('marquee') a cannot-represent casualty.
 */
import { describe, expect, it } from "vitest";
import { emitSurface, EmitSurfaceError, loadProfile } from "@aestheticfunction/dspack-emit";
import type { Contract, Surface } from "../core/contract.js";
import { compileContext } from "../core/compiler.js";
import { lintSurface } from "../core/lint/index.js";
import { ScriptedAdapter } from "../adapters/fake.js";
import { runPipeline } from "./orchestrator.js";

/**
 * Loaded lazily so the fail-first run of this suite reports the pipeline
 * tests as BEHAVIORAL failures (failed-gate where passed is asserted) instead
 * of dying wholesale on a file-level "cannot find module" — the module lands
 * in the implementation commit. Vitest caches the module; the cost is nil.
 */
const loadCasualtyView = () => import("./casualty-view.js");

/** The corrected equivalent: same announcement, casualty removed. */
const correctedSurface: Surface = {
  dspackSurface: "0.1",
  system: "mini-kit",
  intent: "announce",
  root: {
    component: "card",
    children: [{ component: "button", props: { variant: "primary" }, text: "Shop now" }],
  },
};

/** Contract-legal (S1–S3 clean) but unrepresentable: uses the casualty. */
const casualtySurface: Surface = {
  dspackSurface: "0.1",
  system: "mini-kit",
  intent: "announce",
  root: {
    component: "card",
    children: [
      { component: "marquee", text: "Big summer sale" },
      { component: "button", props: { variant: "primary" }, text: "Shop now" },
    ],
  },
};

const contract: Contract = {
  dspack: "0.4",
  name: "mini-kit",
  tokens: { color: { values: { primary: { value: "#111827" } } } },
  components: {
    button: {
      name: "Button",
      description: "Triggers the surface's primary action.",
      props: { variant: { type: "enum", values: ["primary", "secondary"] } },
    },
    card: { name: "Card", description: "Groups related content on one panel." },
    marquee: { name: "Marquee", description: "Scrolling attention banner." },
  },
  intents: [{ id: "announce", description: "Announce something to the user." }],
  examples: [
    { id: "ex.plain", intent: "announce", prompt: "announce the sale", surface: correctedSurface },
    { id: "ex.flashy", intent: "announce", prompt: "a flashy announcement", surface: casualtySurface },
  ],
};

/** v2 profile: button/card mapped, Text/Column synthesized, marquee a casualty. */
const profile = loadProfile({
  profileVersion: "2",
  catalogTitle: "Mini-kit test profile",
  catalogDescription: "Minimal v2 profile for the representability-repair tests.",
  catalogIdBase: "https://example.invalid/catalogs/mini-kit",
  instructions: "Use Column for layout.",
  primaryColorToken: { category: "color", name: "primary" },
  components: [
    {
      a2ui: "Button",
      dspackId: "button",
      commons: ["ComponentCommon"],
      structural: {
        child: {
          schema: { $ref: "#/$defs/ComponentId" },
          description: "Child component id.",
          synthNote: "The label renders as a Text child.",
        },
        action: {
          schema: { $ref: "#/$defs/Action" },
          description: "Dispatched on activation.",
          synthNote: "A2UI requires a declarative action.",
        },
      },
      propMap: {
        variant: {
          a2ui: "variant",
          kind: "enum",
          targetEnum: ["primary", "secondary"],
          default: "primary",
          description: "Carried verbatim.",
        },
      },
      required: ["child", "action"],
      surface: {
        routes: [
          { from: ["self.text"], to: "textChild:child", overwrite: true },
          { from: ["synthesized.action"], to: "action:action" },
        ],
      },
    },
    {
      a2ui: "Card",
      dspackId: "card",
      commons: ["ComponentCommon"],
      structural: {
        child: {
          schema: { $ref: "#/$defs/ComponentId" },
          description: "Single child id.",
          synthNote: "Children collapse to one slot.",
        },
      },
      required: ["child"],
      surface: { routes: [{ from: ["children"], to: "slot:child" }] },
    },
  ],
  synthesized: [
    {
      a2ui: "Text",
      commons: ["ComponentCommon"],
      description: "Text content primitive (synthesized).",
      structural: {
        text: {
          schema: { $ref: "#/$defs/DynamicString" },
          description: "Text content.",
          synthNote: "Content primitive the contract does not declare.",
        },
      },
      required: ["text"],
    },
    {
      a2ui: "Column",
      commons: ["ComponentCommon"],
      description: "Vertical layout primitive (synthesized).",
      structural: {
        children: {
          schema: { $ref: "#/$defs/ChildList" },
          description: "Child ids.",
          synthNote: "Layout primitive the contract does not declare.",
        },
      },
      required: ["children"],
    },
  ],
  casualtyComponents: [
    {
      dspackId: "marquee",
      attempted: "Marquee",
      class: "cannot-represent",
      reason: "A2UI has no scrolling attention primitive; the motion is the meaning.",
    },
  ],
  surfaceSynthesis: {
    textComponent: "Text",
    textProp: "text",
    wrapComponent: "Column",
    wrapChildrenProp: "children",
  },
});

const baseOptions = {
  contract,
  intent: "announce",
  prompt: "a flashy sale announcement",
  emitProfile: profile,
  maxRepairs: 2,
};

describe("the unrepresentable fixture (premise checks against the CURRENT emitter)", () => {
  it("the casualty surface is contract-legal: S1–S3 all pass", () => {
    const lint = lintSurface(casualtySurface, contract);
    expect(lint.pass).toBe(true);
    expect(lint.gates.map((g) => `${g.gate}:${g.status}`)).toEqual(["S1:PASS", "S2:PASS", "S3:PASS"]);
  });

  it("emitSurface refuses it with the declared-casualty reason", () => {
    expect(() => emitSurface(casualtySurface, contract as never, { profile })).toThrowError(EmitSurfaceError);
    expect(() => emitSurface(casualtySurface, contract as never, { profile })).toThrowError(/declared casualty/);
  });
});

describe("emitter refusal enters the repair loop", async () => {
  const adapter = new ScriptedAdapter([{ output: casualtySurface }, { output: correctedSurface }]);
  const result = await runPipeline({ ...baseOptions, adapter });

  it("refusal → repair → corrected surface → passed", () => {
    expect(result.report.outcome).toBe("passed");
    expect(result.exitCode).toBe(0);
    expect(result.report.attempts.length).toBe(2);
  });

  it("the refusal is recorded on the refused attempt, not only terminally", () => {
    expect(result.report.attempts[0].representability).toEqual({
      pass: false,
      refusal: expect.stringMatching(/casualty/),
    });
    expect(result.report.attempts[1].representability).toBeUndefined();
  });

  it("the repair message carries the refusal verbatim plus the casualty hint", () => {
    expect(result.report.repairMessages.length).toBe(1);
    expect(result.report.repairMessages[0]).toMatch(/cannot be represented .* Emitter refusal/);
    expect(result.report.repairMessages[0]).toContain("marquee");
    expect(result.report.repairMessages[0]).toContain(
      "Do not use that component with this profile — express the same meaning with other approved components.",
    );
  });

  it("the conversation delta is the model's own output + the repair turn (ADR-7 shape)", () => {
    expect(adapter.requests.length).toBe(2);
    expect(adapter.requests[0].system).toBe(adapter.requests[1].system);
    expect(adapter.requests[1].messages.length).toBe(adapter.requests[0].messages.length + 2);
    expect(adapter.requests[1].messages.at(-2)).toEqual({ role: "assistant", content: JSON.stringify(casualtySurface) });
    expect(adapter.requests[1].messages.at(-1)!.content).toBe(result.report.repairMessages[0]);
  });

  it("generation never saw the casualty: system prompt and few-shot are casualty-free", () => {
    expect(adapter.requests[0].system).not.toContain("marquee");
    expect(JSON.stringify(adapter.requests[0].jsonSchema)).not.toContain("marquee");
    // ex.flashy (the casualty example) is excluded: one few-shot pair + the user prompt.
    expect(adapter.requests[0].messages.length).toBe(3);
    expect(JSON.stringify(adapter.requests[0].messages)).not.toContain("marquee");
  });
});

describe("repairs exhausted on refusals", () => {
  it("every attempt refused → terminal failed-gate, exit 3, refusal recorded (unchanged semantics)", async () => {
    const adapter = new ScriptedAdapter([
      { output: casualtySurface },
      { output: casualtySurface },
      { output: casualtySurface },
    ]);
    const result = await runPipeline({ ...baseOptions, adapter });
    expect(result.report.attempts.length).toBe(3);
    expect(result.report.repairMessages.length).toBe(2); // === maxRepairs
    expect(result.report.outcome).toBe("failed-gate");
    expect(result.exitCode).toBe(3);
    expect(result.report.emitted?.refusal).toMatch(/declared casualty/);
    expect(result.report.emitted?.validations).toEqual([]);
    for (const attempt of result.report.attempts) {
      expect(attempt.representability).toEqual({ pass: false, refusal: expect.stringMatching(/declared casualty/) });
    }
  });
});

describe("casualtyFreeView (the generation-side casualty removal)", () => {
  it("compileContext over the view drops the casualty from system prompt, schema, and few-shot", async () => {
    const { casualtyFreeView } = await loadCasualtyView();
    const view = casualtyFreeView(contract, profile);
    const context = compileContext(view, "announce");
    expect(context.system).not.toContain("marquee");
    expect(JSON.stringify(context.schema)).not.toContain("marquee");
    // ex.flashy's surface tree contains the casualty → its pair is excluded.
    expect(context.fewshot.length).toBe(2);
    expect(JSON.stringify(context.fewshot)).not.toContain("marquee");
  });

  it("S-gates are NOT narrowed: the casualty surface still passes S2 against the original contract", () => {
    const lint = lintSurface(casualtySurface, contract);
    expect(lint.gates.find((g) => g.gate === "S2")!.status).toBe("PASS");
    expect(lint.pass).toBe(true);
  });

  it("no profile → the identical contract object (not a copy)", async () => {
    const { casualtyFreeView } = await loadCasualtyView();
    expect(casualtyFreeView(contract, undefined)).toBe(contract);
  });
});
