/**
 * PR-6 acceptance gates: the orchestrator with a scripted fake adapter —
 * fully deterministic, offline.
 *
 * - Repair path: attempt 1 = golden violating fixture F1 → violation detected
 *   → repair message equals the checked-in golden (ADR-7 template) → attempt 2
 *   = the contract's worked example → S1–S3 PASS (incl. the
 *   required-composition rule verified, not assumed) → emitted surface passes
 *   A1–A3 for both A2UI versions → outcome "passed", exit 0.
 * - The audit report validates against schemas/audit-report.v1.schema.json
 *   and records the full trail with all gates independently reported.
 * - Exhaustion: always-violating script → "failed-lint-exhausted", exit 2,
 *   maxRepairs+1 attempts.
 * - Emitter-gate failure: lint-clean surface whose emission violates the
 *   catalog (TextField without label) → "failed-gate", exit 3, A3 FAIL.
 * - Adapter failure: typed error → "failed-adapter", exit 1.
 * - The system prompt is immutable across attempts; the only delta is the
 *   model's own output + the repair feedback.
 */
import { readFileSync, writeFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import type { Contract, Surface } from "../core/contract.js";
import { ScriptedAdapter } from "../adapters/fake.js";
import { runPipeline } from "./orchestrator.js";
import { renderMarkdown } from "../audit/report.js";

const contract = JSON.parse(readFileSync("fixtures/shadcn.v0_3.dspack.json", "utf8")) as Contract;
const violatingF1 = JSON.parse(readFileSync("fixtures/golden/violating/F1-dialog-for-delete.dsurface.json", "utf8"));
const workedExample = contract.examples!.find((e) => e.id === "ex.delete-account-confirmation")!.surface;

const validateReport = new Ajv2020({ strict: false }).compile(
  JSON.parse(readFileSync("schemas/audit-report.v1.schema.json", "utf8")),
);

const fixedClock = (() => {
  let tick = 0;
  return () => new Date(1750000000000 + 1000 * tick++);
})();

const baseOptions = {
  contract,
  intent: "destructive-action",
  prompt: "a screen to delete my account",
  now: fixedClock,
};

describe("repair path (the flagship trail)", async () => {
  const adapter = new ScriptedAdapter([{ output: violatingF1 }, { output: workedExample }]);
  const result = await runPipeline({ ...baseOptions, adapter });

  it("detects the violation, repairs once, passes everything", () => {
    expect(result.report.outcome).toBe("passed");
    expect(result.exitCode).toBe(0);
    expect(result.report.attempts.length).toBe(2);

    const first = result.report.attempts[0];
    expect(first.gates!.map((g) => `${g.gate}:${g.status}`)).toEqual(["S1:PASS", "S2:PASS", "S3:FAIL"]);
    expect(first.findings!.map((f) => f.ruleId)).toEqual([
      "rule.destructive-requires-alertdialog",
      "rule.destructive-requires-alertdialog",
    ]);

    const second = result.report.attempts[1];
    expect(second.gates!.map((g) => `${g.gate}:${g.status}`)).toEqual(["S1:PASS", "S2:PASS", "S3:PASS"]);
    expect(second.findings).toEqual([]);
  });

  it("repair message equals the checked-in golden (one findings object, two serializations)", () => {
    expect(result.report.repairMessages.length).toBe(1);
    const goldenPath = "fixtures/golden/repair/F1.repair.txt";
    if (process.env.UPDATE_GOLDEN) writeFileSync(goldenPath, result.report.repairMessages[0]);
    expect(result.report.repairMessages[0]).toBe(readFileSync(goldenPath, "utf8"));
    expect(result.report.repairMessages[0]).toContain("rule.destructive-requires-alertdialog");
    expect(result.report.repairMessages[0]).toContain("A correct example (ex.delete-account-confirmation)");
  });

  it("system prompt is immutable; the conversation delta is output + repair only", () => {
    expect(adapter.requests.length).toBe(2);
    expect(adapter.requests[0].system).toBe(adapter.requests[1].system);
    expect(adapter.requests[1].messages.length).toBe(adapter.requests[0].messages.length + 2);
    expect(adapter.requests[1].messages.at(-2)).toEqual({ role: "assistant", content: JSON.stringify(violatingF1) });
    expect(adapter.requests[1].messages.at(-1)!.content).toBe(result.report.repairMessages[0]);
  });

  it("emits and passes A1–A3 for both A2UI versions", () => {
    const validations = result.report.emitted!.validations;
    expect(validations.map((v) => v.a2uiVersion)).toEqual(["0.9.1", "1.0"]);
    for (const validation of validations) {
      expect(validation.gates.map((g) => `${g.gate}:${g.pass}`)).toEqual(["A1:true", "A2:true", "A3:true"]);
    }
    expect(result.surfaceMessages).toBeDefined();
  });

  it("the audit report validates against its schema and renders to markdown", () => {
    const ok = validateReport(JSON.parse(JSON.stringify(result.report)));
    expect(validateReport.errors ?? []).toEqual([]);
    expect(ok).toBe(true);

    const md = renderMarkdown(result.report);
    expect(md).toContain("**Outcome:** passed");
    expect(md).toContain("gate S3 governance: **FAIL**");
    expect(md).toContain("Repair feedback sent");
    expect(md).toContain("[0.9.1] gate A3 instance: **PASS**");
  });
});

describe("failure paths are first-class artifacts", () => {
  it("exhaustion: always-violating → failed-lint-exhausted, exit 2, maxRepairs+1 attempts", async () => {
    const adapter = new ScriptedAdapter([
      { output: violatingF1 },
      { output: violatingF1 },
      { output: violatingF1 },
    ]);
    const result = await runPipeline({ ...baseOptions, adapter, maxRepairs: 2 });
    expect(result.report.outcome).toBe("failed-lint-exhausted");
    expect(result.exitCode).toBe(2);
    expect(result.report.attempts.length).toBe(3);
    expect(result.report.repairMessages.length).toBe(2);
    expect(validateReport(JSON.parse(JSON.stringify(result.report)))).toBe(true);
  });

  it("emitter-gate failure: lint-clean surface that fails A3 → failed-gate, exit 3", async () => {
    // Governed (alert-dialog present & complete) but the input node has no
    // text, so the emitted TextField lacks its required label — A3 fails.
    const gateBreaker: Surface = {
      dspackSurface: "0.1",
      system: "shadcn/ui",
      intent: "destructive-action",
      root: {
        component: "card",
        children: [
          (workedExample.root.children![0] as Surface["root"]),
          { component: "input", props: { type: "email" } },
        ],
      },
    };
    const adapter = new ScriptedAdapter([{ output: gateBreaker }]);
    const result = await runPipeline({ ...baseOptions, adapter });
    expect(result.report.outcome).toBe("failed-gate");
    expect(result.exitCode).toBe(3);
    const gates = result.report.emitted!.validations[0].gates;
    expect(gates.find((g) => g.gate === "A3")!.pass).toBe(false);
    expect(validateReport(JSON.parse(JSON.stringify(result.report)))).toBe(true);
  });

  it("emitter REFUSAL: lint-clean surface the emitter cannot project at all → failed-gate, exit 3, refusal recorded", async () => {
    // The live-eval discovery (2026-07-03, qwen): a sub-component outside its
    // compound parent is in-vocabulary (S2), ungoverned (S3), but the a2ui
    // profile cannot emit it standalone — EmitSurfaceError. That is the
    // target-equivalent emitter-gate failure, never a crash.
    const refusalBreaker: Surface = {
      dspackSurface: "0.1",
      system: "shadcn/ui",
      intent: "destructive-action",
      root: {
        component: "card",
        children: [
          (workedExample.root.children![0] as Surface["root"]),
          { component: "card-header", text: "stray sub-component" },
        ],
      },
    };
    const adapter = new ScriptedAdapter([{ output: refusalBreaker }]);
    const result = await runPipeline({ ...baseOptions, adapter });
    expect(result.report.outcome).toBe("failed-gate");
    expect(result.exitCode).toBe(3);
    expect(result.report.emitted!.refusal).toContain("card-header");
    expect(result.report.emitted!.validations).toEqual([]);
    expect(result.surfaceMessages).toBeUndefined();
    expect(validateReport(JSON.parse(JSON.stringify(result.report)))).toBe(true);
  });

  it("a throwing onEvent hook never aborts the pipeline or changes the outcome", async () => {
    const adapter = new ScriptedAdapter([{ output: violatingF1 }, { output: workedExample }]);
    const result = await runPipeline({
      ...baseOptions,
      adapter,
      onEvent: () => {
        throw new Error("client disconnected mid-stream");
      },
    });
    expect(result.report.outcome).toBe("passed");
    expect(result.exitCode).toBe(0);
  });

  it("adapter failure → failed-adapter, exit 1, recorded in the report", async () => {
    const adapter = new ScriptedAdapter([{ error: "model output is not valid JSON" }]);
    const result = await runPipeline({ ...baseOptions, adapter });
    expect(result.report.outcome).toBe("failed-adapter");
    expect(result.exitCode).toBe(1);
    expect(result.report.attempts[0].adapterError).toMatch(/not valid JSON/);
    expect(validateReport(JSON.parse(JSON.stringify(result.report)))).toBe(true);
  });
});
