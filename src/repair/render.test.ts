/**
 * Repair-feedback serialization for the v0.4 finding types (ADR-7: one
 * findings object, two serializations). renderRepairMessage is generic over
 * findings — no per-type branches — so this golden locks the serialization
 * for a required-props finding exactly as the F1 golden does for
 * component-choice (pipeline.test.ts). Regenerate deliberately with
 * UPDATE_GOLDEN=1 npm test — the diff is the review artifact.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Contract } from "../core/contract.js";
import { lintSurface } from "../core/lint/index.js";
import { renderRepairMessage } from "./render.js";

const contract = JSON.parse(readFileSync("fixtures/shadcn.v0_4.dspack.json", "utf8")) as Contract;

describe("repair feedback for v0.4 finding types", () => {
  it("required-props finding (F6a) renders to the checked-in golden, corrected reference included", () => {
    const surface = JSON.parse(
      readFileSync("fixtures/golden/violating/F6a-trigger-label-nested.dsurface.json", "utf8"),
    );
    const report = lintSurface(surface, contract);
    const message = renderRepairMessage(report.findings, contract);

    const goldenPath = "fixtures/golden/repair/F6a.repair.txt";
    if (process.env.UPDATE_GOLDEN) writeFileSync(goldenPath, message);
    expect(message).toBe(readFileSync(goldenPath, "utf8"));

    expect(message).toContain("rule.trigger-carries-label");
    expect(message).toContain("non-empty direct text");
    // The rule links the worked example, so the corrected reference rides along (ADR-3).
    expect(message).toContain("A correct example (ex.delete-account-confirmation)");
  });
});
