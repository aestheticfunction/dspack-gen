/**
 * PR-21: the json-render emission target in the pipeline (the Astryx eval
 * path). Same refusal semantics as a2ui; gates J2/J3 run per-run against the
 * contract-generated catalog model. Deterministic: fake adapter plays the
 * contract's own worked example.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Contract } from "../core/contract.js";
import { ScriptedAdapter } from "../adapters/fake.js";
import { runPipeline } from "./orchestrator.js";

const astryx = JSON.parse(readFileSync("fixtures/astryx.v0_1_2.dspack.json", "utf8")) as Contract;
const workedExample = (astryx.examples ?? []).find((e) => e.id === "ex.delete-project-confirmation")!;

describe("json-render emission target (PR-21)", () => {
  it("the Astryx worked example passes end-to-end with J2/J3 gates in the report", async () => {
    const adapter = new ScriptedAdapter([{ output: workedExample.surface }]);
    const result = await runPipeline({
      contract: astryx,
      intent: "destructive-action",
      prompt: "a screen to delete a project",
      adapter,
      maxRepairs: 2,
      emitTarget: "json-render",
    });
    expect(result.report.outcome).toBe("passed");
    const emitted = result.report.emitted as { target: string; validations: Array<{ gates: Array<{ gate: string; pass: boolean }> }> };
    expect(emitted.target).toBe("json-render");
    expect(emitted.validations[0].gates.map((g) => `${g.gate}:${g.pass}`)).toEqual(["J2:true", "J3:true"]);
  });

  it("default target remains a2ui — existing callers byte-unchanged", async () => {
    const shadcn = JSON.parse(readFileSync("fixtures/shadcn.v0_4.dspack.json", "utf8")) as Contract;
    const example = (shadcn.examples ?? []).find((e) => e.id === "ex.delete-account-confirmation")!;
    const adapter = new ScriptedAdapter([{ output: example.surface }]);
    const result = await runPipeline({
      contract: shadcn,
      intent: "destructive-action",
      prompt: "a screen to delete my account",
      adapter,
      maxRepairs: 2,
    });
    expect(result.report.outcome).toBe("passed");
    expect((result.report.emitted as { target: string }).target).toBe("a2ui");
  });
});
