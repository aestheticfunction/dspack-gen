/**
 * S3 `requiredCategories` (spec v0.4 §4.3, the 2026-08-07 amendment) — the
 * ten ratified pins. The invariant that motivated it, verbatim from the
 * owner-approved rationale:
 *
 *   A form-control represents the location of the user-editable control in a
 *   field. It must contain an approved interactive control; text-only or
 *   empty form controls are not meaningful form composition.
 *
 * The fail-first record: the T1 Build evaluation produced exactly these
 * zero-control forms, lint-clean under every gate (dspack-emit
 * eval/t1-build-matrix*.json), and no existing rule type could express the
 * category-OR without enumerating ids.
 */
import { describe, expect, it } from "vitest";
import { lintSurface } from "./index.js";
import type { Contract } from "../contract.js";
import type { Surface } from "../surface-schema.js";

const RATIONALE =
  "A form-control represents the location of the user-editable control in a field. It must contain an approved interactive control; text-only or empty form controls are not meaningful form composition.";

/** A hermetic v0.4 contract fragment: a form family + three interactive controls. */
const contract: Contract = {
  dspack: "0.4",
  name: "required-categories-fixture",
  description: "S3 requiredCategories pins",
  version: "0.0.1",
  components: {
    input: { name: "Input", description: "Text entry.", props: {}, categories: ["interactive"] },
    textarea: { name: "Textarea", description: "Long text entry.", props: {}, categories: ["interactive"] },
    select: { name: "Select", description: "Choose one.", props: {}, categories: ["interactive"] },
    badge: { name: "Badge", description: "A label.", props: {}, categories: ["content"] },
    form: {
      name: "Form",
      description: "A form.",
      props: {},
      categories: ["form"],
      composition: {
        subComponents: [
          { id: "form-item", description: "One field." },
          { id: "form-label", description: "The field label.", acceptsChildren: "text" },
          { id: "form-control", description: "Where the control lives." },
        ],
      },
    },
  },
  categories: {
    interactive: { name: "Interactive", description: "Receives activation." },
    content: { name: "Content", description: "Static content." },
    form: { name: "Form", description: "Form structure." },
  },
  intents: [{ id: "data-entry", name: "Data entry", description: "Collect input." }],
  rules: [
    {
      id: "rule.form-control-carries-control",
      type: "required-composition",
      severity: "must",
      component: "form-control",
      requiredCategories: [{ id: "interactive", min: 1 }],
      rationale: RATIONALE,
    },
  ],
} as unknown as Contract;

const surface = (root: unknown): Surface =>
  ({ dspackSurface: "0.1", system: "required-categories-fixture", intent: "data-entry", root }) as Surface;

const govern = (root: unknown, c: Contract = contract) => {
  const report = lintSurface(surface(root), c);
  const gate = report.gates.find((g) => g.name === "governance")!;
  return { status: gate.status, findings: report.findings };
};

const field = (control: unknown) => ({
  component: "form",
  children: [
    {
      component: "form-item",
      children: [{ component: "form-label", text: "L" }, ...(control === undefined ? [] : [control as object])],
    },
  ],
});

describe("requiredCategories — the ten ratified pins", () => {
  it("1. form-control with literal text only → FAIL, carrying rule id and rationale", () => {
    const { status, findings } = govern(field({ component: "form-control", text: "e.g., Client Dinner" }));
    expect(status).toBe("FAIL");
    const f = findings.find((x) => x.ruleId === "rule.form-control-carries-control")!;
    expect(f.rationale).toBe(RATIONALE);
    expect(f.message).toContain("'interactive'");
    expect(f.message).toContain("found 0");
  });

  it("2. empty form-control → FAIL", () => {
    const { status } = govern(field({ component: "form-control" }));
    expect(status).toBe("FAIL");
  });

  it("3. form-control > input → PASS", () => {
    const { status } = govern(field({ component: "form-control", children: [{ component: "input" }] }));
    expect(status).toBe("PASS");
  });

  it("4. form-control > textarea → PASS", () => {
    const { status } = govern(field({ component: "form-control", children: [{ component: "textarea" }] }));
    expect(status).toBe("PASS");
  });

  it("5. form-control > select → PASS (select is an interactive member)", () => {
    const { status } = govern(field({ component: "form-control", children: [{ component: "select" }] }));
    expect(status).toBe("PASS");
  });

  it("6. an interactive control ELSEWHERE does not satisfy an empty form-control — locality", () => {
    const { status, findings } = govern({
      component: "form",
      children: [
        { component: "input" }, // interactive, but outside the form-control
        { component: "form-item", children: [{ component: "form-control", text: "just text" }] },
      ],
    });
    expect(status).toBe("FAIL");
    expect(findings.some((f) => f.message.includes("members elsewhere in the surface do not satisfy"))).toBe(true);
  });

  it("7. min: 2 with one matching descendant → FAIL", () => {
    const strict = structuredClone(contract) as Contract & { rules: Array<{ requiredCategories?: Array<{ id: string; min?: number }> }> };
    strict.rules[0].requiredCategories = [{ id: "interactive", min: 2 }];
    const { status, findings } = govern(field({ component: "form-control", children: [{ component: "input" }] }), strict as Contract);
    expect(status).toBe("FAIL");
    expect(findings[0].message).toContain("min 2");
    expect(findings[0].message).toContain("found 1");
  });

  it("8. multiple entries keep AND semantics: each category independently required", () => {
    const both = structuredClone(contract) as Contract & { rules: Array<{ requiredCategories?: Array<{ id: string }> }> };
    both.rules[0].requiredCategories = [{ id: "interactive" }, { id: "content" }];
    // interactive satisfied, content missing → FAIL on the content entry.
    const failing = govern(field({ component: "form-control", children: [{ component: "input" }] }), both as Contract);
    expect(failing.status).toBe("FAIL");
    expect(failing.findings.some((f) => f.message.includes("'content'"))).toBe(true);
    // Both satisfied → PASS.
    const ok = govern(field({ component: "form-control", children: [{ component: "input" }, { component: "badge", text: "b" }] }), both as Contract);
    expect(ok.status).toBe("PASS");
  });

  it("9. requiredSubComponents behaviour is unchanged alongside the new field", () => {
    const mixed = structuredClone(contract) as Contract & { rules: unknown[] };
    (mixed.rules as Array<Record<string, unknown>>)[0].requiredSubComponents = [{ id: "form-label", min: 1 }];
    // form-control > input, but the rule's node (form-control) has no
    // form-label DESCENDANT (the label is a sibling) → the id requirement
    // fails exactly as it always did, independent of the category pass.
    const { status, findings } = govern(field({ component: "form-control", children: [{ component: "input" }] }), mixed as Contract);
    expect(status).toBe("FAIL");
    expect(findings.some((f) => f.message.includes("'form-label'"))).toBe(true);
  });

  it("10. forbidden-category behaviour is unchanged: the two sides coexist", () => {
    const withForbid = structuredClone(contract) as Contract & { rules: unknown[] };
    (withForbid.rules as Array<Record<string, unknown>>).push({
      id: "rule.label-holds-no-controls",
      type: "forbidden-composition",
      severity: "must",
      component: "form-label",
      forbiddenCategories: ["interactive"],
      rationale: "A label labels; it does not contain the control it labels.",
    });
    expect(govern(field({ component: "form-control", children: [{ component: "input" }] }), withForbid as Contract).status).toBe("PASS");
    const bad = lintSurface(
      surface({
        component: "form",
        children: [
          {
            component: "form-item",
            children: [
              { component: "form-label", text: "L", children: [{ component: "input" }] },
              { component: "form-control", children: [{ component: "input" }] },
            ],
          },
        ],
      }),
      withForbid as Contract,
    );
    const gate = bad.gates.find((g) => g.name === "governance")!;
    expect(gate.status).toBe("FAIL");
    expect(bad.findings.some((f) => f.ruleId === "rule.label-holds-no-controls")).toBe(true);
  });
});
