/**
 * PR-7 acceptance gate: the flagship governed-generation demo, driven with
 * the deterministic fake adapter (golden violating fixture F1 → the
 * contract's worked example). Asserts the full on-screen trail:
 *
 *   violation (S3 FAIL with the contract's rule + rationale)
 *   → the exact repair message
 *   → clean attempt (S3 card lists the required-composition rule as
 *     verified — governance, not prompt steering)
 *   → emitter gates A1–A3 green for both A2UI versions
 *   → the AlertDialog renders off the generated catalog and opens with
 *     cancel-before-confirm
 *   → the downloaded audit report validates against
 *     schemas/audit-report.v1.schema.json.
 */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import Ajv2020 from "ajv/dist/2020.js";

test("prompt → violation → repair → validated output → render → audit report", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("view-generate").click();
  await page.getByTestId("fake-toggle").check();
  await page.getByTestId("run").click();

  // Attempt 1 — the violation, cited with the contract's rule and rationale.
  const attempt1 = page.getByTestId("attempt-1");
  await expect(attempt1.getByTestId("gate-S1-attempt-1")).toContainText("PASS");
  await expect(attempt1.getByTestId("gate-S2-attempt-1")).toContainText("PASS");
  await expect(attempt1.getByTestId("gate-S3-attempt-1")).toContainText("FAIL");
  await expect(attempt1).toContainText("rule.destructive-requires-alertdialog");
  await expect(attempt1).toContainText("Component 'dialog' is forbidden for intent 'destructive-action'.");
  await expect(attempt1).toContainText("Dialog can be dismissed by clicking the overlay or pressing Escape");

  // The exact repair feedback (rendered from the same findings object).
  const repair = page.getByTestId("repair-1");
  await expect(repair).toContainText("Your surface violates 2 governance rule finding(s)");
  await expect(repair).toContainText("A correct example (ex.delete-account-confirmation)");

  // Attempt 2 — clean; the S3 card lists the required-composition rule as
  // verified (the repaired structure is checked by governance, not assumed).
  await expect(page.getByTestId("gate-S3-attempt-2")).toContainText("PASS");
  const clean = page.getByTestId("attempt-2-clean");
  await expect(clean).toContainText("rule.destructive-requires-alertdialog");
  await expect(clean).toContainText("rule.alertdialog-requires-cancel");
  await expect(clean).toContainText("verified by the governance linter");

  // Emitter gates A1–A3, both A2UI versions.
  for (const version of ["0.9.1", "1.0"]) {
    for (const gate of ["A1", "A2", "A3"]) {
      await expect(page.getByTestId(`gate-${gate}-${version}`)).toContainText("PASS");
    }
  }

  // Outcome + render: the AlertDialog trigger renders off the generated
  // catalog; clicking it opens the non-dismissible confirmation.
  await expect(page.getByTestId("outcome")).toContainText("passed");
  const surface = page.getByTestId("rendered-surface");
  await surface.getByRole("button", { name: "Delete account" }).click();
  await expect(page.getByRole("heading", { name: "Delete your account?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Delete your account?" })).toBeHidden();

  // Audit report v1: downloadable and schema-valid.
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("download-report").click();
  const download = await downloadPromise;
  const reportPath = await download.path();
  const report = JSON.parse(readFileSync(reportPath!, "utf8"));

  const validate = new Ajv2020({ strict: false }).compile(
    JSON.parse(readFileSync("schemas/audit-report.v1.schema.json", "utf8")),
  );
  expect(validate(report), JSON.stringify(validate.errors)).toBe(true);
  expect(report.outcome).toBe("passed");
  expect(report.attempts.length).toBe(2);
  expect(report.repairMessages.length).toBe(1);
});
