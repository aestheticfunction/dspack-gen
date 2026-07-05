/**
 * PR-4 acceptance gates: surface gates S1–S3 over the golden fixtures.
 *
 * Violating goldens F1–F7 each reproduce their checked-in *.expected.json
 * exactly (regenerate deliberately with UPDATE_GOLDEN=1 npm test — the diff
 * is the review artifact). F6b is the no-text-anywhere projection-gap variant
 * (the irreducible governance residue after the 2026-07-04 amendment); the
 * formerly-violating nested-label shape (old F6a) moved to the CLEAN goldens —
 * under the amended rule (textScope: subtree) it lints clean and the a2ui
 * target lifts its label, audited (dspack-emit). F7 is the category-based
 * forbidden-composition form. S1/S2 are independently reported; unknown rule
 * types throw (CLI exit 4). All three v0.3 evaluators plus v0.4's
 * required-props (as amended: textScope, ∃-within) are active.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Contract } from "../contract.js";
import { lintSurface, UnknownRuleTypeError } from "./index.js";

const contract = JSON.parse(readFileSync("fixtures/shadcn.v0_4.dspack.json", "utf8")) as Contract;
const VIOLATING = "fixtures/golden/violating";

const load = (path: string) => JSON.parse(readFileSync(path, "utf8"));

describe("violating goldens reproduce their expected reports exactly", () => {
  const fixtures = readdirSync(VIOLATING).filter((f) => f.endsWith(".dsurface.json"));

  it("all seven violating fixtures are present", () => {
    expect(fixtures.length).toBe(7);
  });

  it.each(fixtures)("%s", (fixture) => {
    const report = lintSurface(load(join(VIOLATING, fixture)), contract);
    const expectedPath = join(VIOLATING, fixture.replace(".dsurface.json", ".expected.json"));
    const rendered = JSON.stringify(report, null, 2) + "\n";
    if (process.env.UPDATE_GOLDEN) writeFileSync(expectedPath, rendered);
    expect(rendered).toBe(readFileSync(expectedPath, "utf8"));
    expect(report.pass).toBe(false);
    expect(report.errorCount).toBeGreaterThan(0);
  });
});

describe("expected findings, spot-checked (goldens carry the full detail)", () => {
  it("F1: dialog forbidden AND alert-dialog required — two findings of rule.destructive-requires-alertdialog", () => {
    const report = lintSurface(load(join(VIOLATING, "F1-dialog-for-delete.dsurface.json")), contract);
    const ids = report.findings.map((f) => f.ruleId);
    expect(ids.filter((id) => id === "rule.destructive-requires-alertdialog").length).toBe(2);
    expect(report.findings[0].location.component).toBe("dialog");
    expect(report.findings[0].level).toBe("error");
    expect(report.findings[0].requirement).toBe("must");
    expect(report.gates.map((g) => `${g.gate}:${g.status}`)).toEqual(["S1:PASS", "S2:PASS", "S3:FAIL"]);
  });

  it("F3: missing cancel — required-composition names the sub-component and count", () => {
    const report = lintSurface(load(join(VIOLATING, "F3-missing-cancel.dsurface.json")), contract);
    const cancel = report.findings.find((f) => f.ruleId === "rule.alertdialog-requires-cancel")!;
    expect(cancel.message).toBe(
      "Required sub-component 'alert-dialog-cancel' (min 1) not found among descendants (found 0).",
    );
    expect(cancel.location.component).toBe("alert-dialog");
  });

  it("F5: nested interactive — finding located AT the offending descendant (spec §5.3)", () => {
    const report = lintSurface(load(join(VIOLATING, "F5-nested-interactive.dsurface.json")), contract);
    const nested = report.findings.find((f) => f.ruleId === "rule.button-no-interactive-descendants")!;
    expect(nested.location.path).toBe("$.root.children[1].children[0]");
    expect(nested.location.component).toBe("input");
    expect(nested.message).toMatch(/inside 'button' \(at \$\.root\.children\[1\], id "subscribe"\)/);
  });

  it("nested label (old F6a) is CLEAN under the amended rule — the lift's precondition holds", () => {
    const report = lintSurface(load("fixtures/golden/clean/nested-trigger-label.dsurface.json"), contract);
    expect(report.gates.map((g) => `${g.gate}:${g.status}`)).toEqual(["S1:PASS", "S2:PASS", "S3:PASS"]);
    expect(report.findings).toEqual([]);
  });

  it("F6b: no label text anywhere under the trigger — fires AT the trigger with the subtree message", () => {
    const report = lintSurface(load(join(VIOLATING, "F6b-trigger-label-missing.dsurface.json")), contract);
    const labels = report.findings.filter((f) => f.ruleId === "rule.trigger-carries-label");
    expect(labels.length).toBe(1);
    expect(labels[0].location.component).toBe("alert-dialog-trigger");
    expect(labels[0].message).toBe(
      "'alert-dialog-trigger' must carry non-empty text somewhere in its subtree (none found).",
    );
    expect(report.findings.length).toBe(1);
  });

  it("F7: category-forbidden descendant — the finding names the concrete id AND the category", () => {
    const report = lintSurface(load(join(VIOLATING, "F7-nested-overlay.dsurface.json")), contract);
    const overlays = report.findings.filter((f) => f.ruleId === "rule.alertdialog-no-nested-overlays");
    expect(overlays.length).toBe(1);
    expect(overlays[0].location.component).toBe("dropdown-menu");
    expect(overlays[0].message).toMatch(/'dropdown-menu' \(category 'overlay'\) inside 'alert-dialog'/);
    expect(report.findings.length).toBe(1);
  });

  it("within is ∃-quantified (2026-07-04 amendment): one satisfying sibling clears the scope; none fires AT the scope", () => {
    const withinRule = {
      id: "rule.within-unit",
      type: "required-props",
      severity: "must",
      component: "button",
      within: "alert-dialog-trigger",
      requiredText: true,
      rationale: "Unit rule pinning ∃-within semantics.",
    } as const;
    const scoped: Contract = { ...contract, rules: [withinRule] };
    const surfaceWith = (triggerChildren: unknown[]) => ({
      dspackSurface: "0.1",
      system: "shadcn/ui",
      intent: "destructive-action",
      root: { component: "alert-dialog", children: [{ component: "alert-dialog-trigger", children: triggerChildren }] },
    });

    // One labeled + one textless button: ∃ satisfied — the textless sibling no longer fails the scope.
    const mixed = lintSurface(
      surfaceWith([{ component: "button", text: "Delete" }, { component: "button" }]),
      scoped,
    );
    expect(mixed.findings).toEqual([]);

    // All buttons textless: one finding, at the scope.
    const none = lintSurface(surfaceWith([{ component: "button" }, { component: "button" }]), scoped);
    expect(none.findings.length).toBe(1);
    expect(none.findings[0].location.component).toBe("alert-dialog-trigger");
    expect(none.findings[0].message).toBe(
      "No 'button' inside 'alert-dialog-trigger' satisfies the required content (2 checked).",
    );

    // No button at all: the existence clause, unchanged.
    const empty = lintSurface(surfaceWith([{ component: "badge", text: "Delete" }]), scoped);
    expect(empty.findings.length).toBe(1);
    expect(empty.findings[0].message).toBe("'alert-dialog-trigger' contains no 'button' to carry the required content.");
  });
});

describe("clean golden and gate independence", () => {
  it("the contract's worked example passes all gates", () => {
    const report = lintSurface(load("fixtures/golden/clean/delete-account.dsurface.json"), contract);
    expect(report.gates.map((g) => `${g.gate}:${g.status}`)).toEqual(["S1:PASS", "S2:PASS", "S3:PASS"]);
    expect(report.pass).toBe(true);
    expect(report.findings).toEqual([]);
  });

  it("S1 failure is reported independently and skips S2/S3", () => {
    const report = lintSurface({ dspackSurface: "0.1", system: "shadcn/ui", intent: "destructive-action", root: { text: "no component" } }, contract);
    expect(report.gates.map((g) => `${g.gate}:${g.status}`)).toEqual(["S1:FAIL", "S2:SKIPPED", "S3:SKIPPED"]);
    expect(report.pass).toBe(false);
  });

  it("S2 failure (out-of-vocabulary) is reported independently; S3 still runs", () => {
    const report = lintSurface(
      { dspackSurface: "0.1", system: "shadcn/ui", intent: "destructive-action", root: { component: "carousel" } },
      contract,
    );
    const s2 = report.gates.find((g) => g.gate === "S2")!;
    expect(s2.status).toBe("FAIL");
    expect(s2.errors!.join("\n")).toMatch(/'carousel' is not a component/);
    expect(report.gates.find((g) => g.gate === "S3")!.status).toBe("FAIL"); // alert-dialog still required
  });

  it("warn-level (should) findings never fail the lint in v0.3", () => {
    const softContract: Contract = {
      ...contract,
      rules: [
        {
          id: "rule.soft-preference",
          type: "component-choice",
          severity: "should",
          appliesTo: { intents: ["destructive-action"] },
          require: ["badge"],
          rationale: "Soft preference for testing the warn tier.",
        },
      ],
    };
    const report = lintSurface(load("fixtures/golden/clean/delete-account.dsurface.json"), softContract);
    expect(report.warnCount).toBe(1);
    expect(report.errorCount).toBe(0);
    expect(report.pass).toBe(true);
    expect(report.findings[0]).toMatchObject({ requirement: "should", level: "warn" });
  });

  it("duplicate sub-component ids fail S2 loudly, naming the id and every declaring component", () => {
    const ambiguous: Contract = {
      ...contract,
      components: {
        ...contract.components,
        "widget-a": {
          name: "WidgetA",
          description: "First parent.",
          composition: { subComponents: [{ id: "shared-part", name: "SharedPart" }] },
        },
        "widget-b": {
          name: "WidgetB",
          description: "Second parent.",
          composition: { subComponents: [{ id: "shared-part", name: "SharedPart" }] },
        },
      },
    };
    const report = lintSurface(load("fixtures/golden/clean/delete-account.dsurface.json"), ambiguous);
    const s2 = report.gates.find((g) => g.gate === "S2")!;
    expect(s2.status).toBe("FAIL");
    expect(s2.errors!.join("\n")).toMatch(
      /sub-component id 'shared-part' is declared by multiple components \(widget-a, widget-b\)/,
    );
    expect(report.pass).toBe(false);
  });

  it("unknown rule types throw UnknownRuleTypeError (CLI exit 4), never skip", () => {
    const futureContract: Contract = {
      ...contract,
      rules: [
        {
          id: "rule.from-the-future",
          type: "layout-order",
          severity: "must",
          rationale: "A future rule type this linter does not know.",
        },
      ],
    };
    expect(() => lintSurface(load("fixtures/golden/clean/delete-account.dsurface.json"), futureContract)).toThrowError(
      UnknownRuleTypeError,
    );
  });
});

describe("Astryx negative fixtures — the prop-presence rules CAN fire (Finding B's control)", () => {
  // Finding B (findings.md, 2026-07-05) reports these rules fired 0/216 in
  // the live Astryx column because the props-based API pre-empts the
  // violation. A rule that never fires is only a finding if it fires on a
  // deliberately violating surface — these are that control (the M2
  // never-fired discipline). Goldens regenerate with UPDATE_GOLDEN=1.
  const astryx = JSON.parse(readFileSync("fixtures/astryx.v0_1_2.dspack.json", "utf8")) as Contract;
  const cases: Array<[string, string, string]> = [
    ["FA1-button-no-label", "rule.button-carries-label", "Required prop 'label' is not present on 'button' itself."],
    ["FA2-alertdialog-missing-content", "rule.alertdialog-carries-content", "Required prop 'description' is not present on 'alert-dialog' itself."],
    ["FA3-input-no-label", "rule.input-carries-label", "Required prop 'label' is not present on 'text-input' itself."],
  ];

  it.each(cases)("%s fires %s and reproduces its golden", (fixture, ruleId, message) => {
    const report = lintSurface(load(join("fixtures/golden/violating-astryx", `${fixture}.dsurface.json`)), astryx);
    const expectedPath = join("fixtures/golden/violating-astryx", `${fixture}.expected.json`);
    const rendered = JSON.stringify(report, null, 2) + "\n";
    if (process.env.UPDATE_GOLDEN) writeFileSync(expectedPath, rendered);
    expect(rendered).toBe(readFileSync(expectedPath, "utf8"));
    expect(report.pass).toBe(false);
    // A rule can emit several findings (FA2: description AND actionLabel
    // missing) — assert set membership, not first-match order.
    const messages = report.findings.filter((f) => f.ruleId === ruleId).map((f) => f.message);
    expect(messages.length, `${ruleId} must fire`).toBeGreaterThan(0);
    expect(messages).toContain(message);
  });
});
