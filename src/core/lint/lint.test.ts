/**
 * PR-4 acceptance gates: surface gates S1–S3 over the golden fixtures.
 *
 * Violating goldens F1–F5 each reproduce their checked-in *.expected.json
 * exactly (regenerate deliberately with UPDATE_GOLDEN=1 npm test — the diff
 * is the review artifact). The clean golden (the contract's worked example)
 * passes all gates. S1/S2 are independently reported; unknown rule types
 * throw (CLI exit 4). All three v0.3 evaluators are active — see rules.ts for
 * why forbidden-composition could not defer to M2.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Contract } from "../contract.js";
import { lintSurface, UnknownRuleTypeError } from "./index.js";

const contract = JSON.parse(readFileSync("fixtures/shadcn.v0_3.dspack.json", "utf8")) as Contract;
const VIOLATING = "fixtures/golden/violating";

const load = (path: string) => JSON.parse(readFileSync(path, "utf8"));

describe("violating goldens reproduce their expected reports exactly", () => {
  const fixtures = readdirSync(VIOLATING).filter((f) => f.endsWith(".dsurface.json"));

  it("all five violating fixtures are present", () => {
    expect(fixtures.length).toBe(5);
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
          rationale: "A v0.4 rule type this linter does not know.",
        },
      ],
    };
    expect(() => lintSurface(load("fixtures/golden/clean/delete-account.dsurface.json"), futureContract)).toThrowError(
      UnknownRuleTypeError,
    );
  });
});
