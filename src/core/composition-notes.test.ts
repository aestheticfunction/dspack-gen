/**
 * P3a fail-first: the system prompt must carry each component's authored
 * composition semantics (contract `composition.notes`, capped), because the
 * Gateway corpus showed the model composing compounds "reasonably but
 * emit-fatally" precisely where the vocabulary line lists sub-components
 * without their nesting semantics. The contract already states the correct
 * idioms ("inside a Field: FieldLabel, the control, …"; "Every TabsTrigger
 * value must match exactly one TabsContent value") — generation just never
 * saw them. Notes are capped at two sentences / 360 chars so the addition
 * removes ambiguity without prompt bloat.
 */
import { describe, expect, it } from "vitest";
import { compileContext } from "./compiler.js";
import type { Contract } from "./contract.js";

const LONG_NOTES =
  "Inside a Wrapper place the WrapperLabel, then the control, then the WrapperHint — in that reading order. " +
  "A Wrapper holds exactly one control and never nests another Wrapper. " +
  "This third sentence is deliberate overflow that the cap must exclude from the prompt.";

const contract: Contract = {
  dspack: "0.4",
  name: "notes-kit",
  version: "1.0.0",
  components: {
    wrapper: {
      description: "A labeled wrapper for one control.",
      props: {},
      composition: {
        subComponents: [{ id: "wrapper-label" }, { id: "wrapper-hint" }],
        notes: LONG_NOTES,
      },
    },
    plain: {
      description: "A plain component with no composition knowledge.",
      props: {},
    },
  },
  intents: [{ id: "demo", description: "Demo intent." }],
  rules: [],
  examples: [],
} as unknown as Contract;

describe("composition notes reach the generation system prompt (P3a)", () => {
  const system = compileContext(contract, "demo").system;

  it("carries the noted component's first two sentences on its vocabulary line", () => {
    expect(system).toContain("Composition: Inside a Wrapper place the WrapperLabel, then the control");
    expect(system).toContain("never nests another Wrapper.");
  });

  it("caps at two sentences — overflow prose never reaches the prompt", () => {
    expect(system).not.toContain("deliberate overflow");
  });

  it("components without notes gain nothing", () => {
    const plainLine = system.split("\n").find((l) => l.startsWith("- plain"));
    expect(plainLine).toBeDefined();
    expect(plainLine).not.toContain("Composition:");
  });

  it("hard ceiling: a single giant sentence is word-truncated near 360 chars with an ellipsis", () => {
    const giant = {
      ...contract,
      components: {
        big: {
          description: "Big.",
          props: {},
          composition: { notes: `${"alpha bravo charlie delta ".repeat(30)}end.` },
        },
      },
    } as unknown as Contract;
    const sys = compileContext(giant, "demo").system;
    const line = sys.split("\n").find((l) => l.startsWith("- big"))!;
    const notes = line.slice(line.indexOf("Composition:"));
    expect(notes.length).toBeLessThanOrEqual(400);
    expect(notes).toMatch(/…$/);
  });
});
