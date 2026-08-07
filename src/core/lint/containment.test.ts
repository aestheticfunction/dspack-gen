/**
 * S2 sub-component containment (spec v0.4 §5.1, the 2026-08-07 amendment).
 *
 * The ratified invariant, verbatim:
 *
 *   A component declared as a sub-component of a compound may appear only
 *   within the subtree of a valid owning compound, unless the contract
 *   explicitly declares that component as independently usable.
 *
 * Fail-first (captured before implementation): the four production shapes
 * below — root-level `form-label`, `select-trigger` beside its `select`,
 * bare `alert-dialog-content` duplicated next to a nested one, and the
 * field-trio exemplar corruption (dspack#40) — all PASSED S2 as membership,
 * were inexpressible in every S3 rule type, and died terminally at the
 * emitter after the repair loop had already run (post-T3 Build matrix:
 * 2/6 scenarios; probe: 19% of generated nodes).
 *
 * Ownership comes ONLY from composition.subComponents — never names,
 * prefixes, adjacency, or examples.
 */
import { describe, expect, it } from "vitest";
import { lintSurface } from "./index.js";
import { renderRepairMessage } from "../../repair/render.js";
import type { Contract } from "../contract.js";
import type { Surface } from "../surface-schema.js";

/** Hermetic contract mirroring the four measured production shapes. */
const contract: Contract = {
  dspack: "0.4",
  name: "containment-fixture",
  description: "S2 containment pins",
  version: "0.0.1",
  components: {
    card: {
      name: "Card", description: "A container.", props: {},
      composition: { subComponents: [{ id: "card-header", description: "Header region." }] },
    },
    form: {
      name: "Form", description: "A form.", props: {},
      composition: { subComponents: [{ id: "form-item", description: "One field.", slot: "body" }, { id: "form-label", description: "The field label.", acceptsChildren: "text" }] },
    },
    select: {
      name: "Select", description: "Choose one.", props: {},
      composition: { subComponents: [{ id: "select-trigger", description: "Opens the listbox." }, { id: "select-item", description: "One option." }] },
    },
    "alert-dialog": {
      name: "AlertDialog", description: "Confirm dialog.", props: {},
      composition: { subComponents: [{ id: "alert-dialog-content", description: "The dialog body." }] },
    },
    // The dspack#40 shape as currently (mis)declared: the wrapper trio as subs of field.
    field: {
      name: "Field", description: "One labelled field.", props: {},
      composition: {
        subComponents: [
          { id: "field-set", description: "Groups controls answering one question." },
          { id: "field-legend", description: "Names a FieldSet." },
          { id: "field-group", description: "Stacks Fields." },
          { id: "field-label", description: "The label." },
        ],
      },
    },
    input: { name: "Input", description: "Text entry.", props: {} },
  },
  intents: [{ id: "data-entry", name: "Data entry", description: "Collect input." }],
} as unknown as Contract;

/** The corrected dspack#40 model: the trio promoted per the real shadcn API. */
const corrected: Contract = (() => {
  const c = structuredClone(contract) as unknown as {
    components: Record<string, { composition?: { subComponents: Array<{ id: string; description: string }> } }>;
  };
  c.components.field.composition = { subComponents: [{ id: "field-label", description: "The label." }] };
  c.components["field-set"] = {
    composition: { subComponents: [{ id: "field-legend", description: "Names the set." }] },
    ...( { name: "FieldSet", description: "Groups fields answering one question.", props: {} } as object),
  } as never;
  c.components["field-group"] = { ...( { name: "FieldGroup", description: "Stacks fields.", props: {} } as object) } as never;
  return c as unknown as Contract;
})();

const surface = (root: unknown): Surface =>
  ({ dspackSurface: "0.1", system: "containment-fixture", intent: "data-entry", root }) as Surface;

const s2 = (root: unknown, c: Contract = contract) => {
  const report = lintSurface(surface(root), c);
  const gate = report.gates.find((g) => g.gate === "S2")!;
  return { status: gate.status, errors: gate.errors ?? [] };
};

describe("S2 containment — the four measured production shapes refuse", () => {
  it("1. root-level form-label (no owner anywhere) fails with a pathed finding naming sub and owner", () => {
    const { status, errors } = s2({ component: "form-label", text: "Merchant" });
    expect(status).toBe("FAIL");
    const finding = errors.find((e) => e.includes("form-label"))!;
    expect(finding).toContain("$.root");
    expect(finding).toContain("'form'");
  });

  it("2. select-trigger beside rather than beneath its select fails; properly nested passes", () => {
    const sibling = s2({
      component: "card",
      children: [
        { component: "select" },
        { component: "select-trigger", text: "Role" },
      ],
    });
    expect(sibling.status).toBe("FAIL");
    expect(sibling.errors.some((e) => e.includes("select-trigger") && e.includes("'select'"))).toBe(true);

    const nested = s2({
      component: "card",
      children: [{ component: "select", children: [{ component: "select-trigger", text: "Role" }] }],
    });
    expect(nested.status).toBe("PASS");
  });

  it("3. a bare alert-dialog-content duplicated beside a correctly nested one flags ONLY the bare path", () => {
    const { status, errors } = s2({
      component: "form",
      children: [
        { component: "alert-dialog", children: [{ component: "alert-dialog-content", text: "Are you sure?" }] },
        { component: "alert-dialog-content", text: "Are you sure?" },
      ],
    });
    expect(status).toBe("FAIL");
    const hits = errors.filter((e) => e.includes("alert-dialog-content"));
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain("$.root.children[1]");
  });

  it("4. the dspack#40 exemplar shape fails under the inverted declaration and passes under the corrected one", () => {
    const exemplar = {
      component: "card",
      children: [
        {
          component: "field-set",
          children: [
            { component: "field-legend", text: "Digest" },
            { component: "field-group", children: [{ component: "field", children: [{ component: "field-label", text: "Cadence" }, { component: "input" }] }] },
          ],
        },
      ],
    };
    const inverted = s2(exemplar);
    expect(inverted.status).toBe("FAIL");
    expect(inverted.errors.some((e) => e.includes("field-set") && e.includes("'field'"))).toBe(true);

    // The containment amendment and the field correction converge: the SAME
    // surface is green once ownership is declared the way the family is used.
    expect(s2(exemplar, corrected).status).toBe("PASS");
  });
});

describe("S2 containment — semantics", () => {
  it("valid nested use with arbitrary intermediate structure stays green (owner is an ancestor, not the parent)", () => {
    const { status } = s2({
      component: "form",
      children: [
        {
          component: "card", // intermediate structural node between owner and sub
          children: [{ component: "form-item", children: [{ component: "form-label", text: "A" }, { component: "input" }] }],
        },
      ],
    });
    expect(status).toBe("PASS");
  });

  it("a sub reached through an ancestor's slots is contained (walk parity with S3)", () => {
    const { status } = s2({
      component: "form",
      slots: { body: [{ component: "form-label", text: "A" }] },
    });
    expect(status).toBe("PASS");
  });

  it("an id declared BOTH top-level and as a sub is a component everywhere — containment does not apply", () => {
    const both = structuredClone(contract) as unknown as { components: Record<string, unknown> };
    both.components["form-label"] = { name: "FormLabel", description: "Also independently usable.", props: {} };
    const { status } = s2({ component: "form-label", text: "standalone" }, both as unknown as Contract);
    expect(status).toBe("PASS");
  });

  it("ownership is never inferred: a name-alike inside a name-alike compound still refuses", () => {
    // select-item inside CARD (prefix-similar sibling family present elsewhere):
    // only the declared owner counts.
    const { status, errors } = s2({
      component: "card",
      children: [{ component: "select-item", text: "Admins" }],
    });
    expect(status).toBe("FAIL");
    expect(errors.some((e) => e.includes("select-item") && e.includes("'select'"))).toBe(true);
  });
});

describe("the repair loop receives containment findings", () => {
  it("renderRepairMessage carries S2 vocabulary errors so a repair round can relocate the sub", () => {
    const report = lintSurface(surface({ component: "form-label", text: "Merchant" }), contract);
    const gate = report.gates.find((g) => g.gate === "S2")!;
    const message = renderRepairMessage(report.findings, contract, "standard", gate.errors ?? []);
    expect(message).toContain("form-label");
    expect(message).toContain("'form'");
    expect(message).toContain("$.root");
  });
});
