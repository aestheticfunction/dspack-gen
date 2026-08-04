/**
 * Conversational refinement seed (Phase 3, dspack-studio):
 * RunOptions.conversation — prior turns inserted between the contract's
 * few-shot examples and the new user prompt.
 *
 * Ratified constraints pinned here:
 *  - the prior generated surface is ACTUALLY SUPPLIED to the adapter, in
 *    position (after few-shot, before the new prompt);
 *  - refinement is non-vacuous: an adapter that conditions on the prior
 *    surface produces a different, still-governed result;
 *  - the system prompt stays immutable (ADR-7) — conversation seeds the
 *    message list only;
 *  - bounded repair still appends AFTER the seeded conversation;
 *  - the audit report records the seed verbatim (absent when unused, so
 *    existing reports are byte-identical).
 */
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import type { Contract } from "../core/contract.js";
import type { GenerateRequest } from "../adapters/types.js";
import { ScriptedAdapter } from "../adapters/fake.js";
import { runPipeline } from "./orchestrator.js";

const contract = JSON.parse(readFileSync("fixtures/shadcn.v0_4.dspack.json", "utf8")) as Contract;
const violatingF1 = JSON.parse(readFileSync("fixtures/golden/violating/F1-dialog-for-delete.dsurface.json", "utf8"));
const workedExample = contract.examples!.find((e) => e.id === "ex.delete-account-confirmation")!.surface;

const validateReport = new Ajv2020({ strict: false }).compile(
  JSON.parse(readFileSync("schemas/audit-report.v1.schema.json", "utf8")),
);

const fixedClock = (() => {
  let tick = 0;
  return () => new Date(1750000000000 + 1000 * tick++);
})();

const INTENT = "destructive-action";
// Deliberately NOT a phrase that appears in the contract's few-shot corpus.
const PRIOR_PROMPT = "the prior turn's original request (unique marker)";
const REFINE_PROMPT = "keep it, but make the cancel action more prominent";

/**
 * The prior generated surface: byte-distinguishable from every few-shot
 * example (root id marker), still fully governed for the intent.
 */
const priorSurface = (() => {
  const s = structuredClone(workedExample) as { root: Record<string, unknown> };
  s.root = { ...s.root, id: "prior-run" };
  return s;
})();

const priorTurns = [
  { role: "user" as const, content: PRIOR_PROMPT },
  { role: "assistant" as const, content: JSON.stringify(priorSurface) },
];

describe("RunOptions.conversation (refinement seed)", () => {
  it("supplies the prior surface to the adapter, between few-shot and the new prompt", async () => {
    const adapter = new ScriptedAdapter([{ output: workedExample }]);
    const run = await runPipeline({
      contract,
      intent: INTENT,
      prompt: REFINE_PROMPT,
      adapter,
      conversation: priorTurns,
      now: fixedClock,
    });
    expect(run.report.outcome).toBe("passed");

    const messages = adapter.requests[0].messages;
    // Tail: [user original, assistant prior surface, user refinement].
    expect(messages.at(-1)).toEqual({ role: "user", content: REFINE_PROMPT });
    expect(messages.at(-2)).toEqual({ role: "assistant", content: JSON.stringify(priorSurface) });
    expect(messages.at(-3)).toEqual({ role: "user", content: PRIOR_PROMPT });
    // Few-shot precedes the seed, untouched (first message is few-shot user).
    expect(messages.length).toBeGreaterThan(3);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).not.toBe(PRIOR_PROMPT);
  });

  it("refinement is non-vacuous: an adapter conditioning on the prior surface produces a different governed result", async () => {
    // Structurally different but still governed for THE SAME intent: the
    // marked clone with a changed root id — different bytes, same rules.
    const refined = (() => {
      const s = structuredClone(workedExample) as { root: Record<string, unknown> };
      s.root = { ...s.root, id: "refined-run" };
      return s;
    })();
    expect(JSON.stringify(refined)).not.toBe(JSON.stringify(workedExample));

    const conditioning = {
      id: "test:conditioning",
      async generate(request: GenerateRequest) {
        // The seed marker cannot collide with few-shot: only the refinement
        // conversation carries a surface whose root id is "prior-run".
        const sawPrior = request.messages.some((m) => m.role === "assistant" && m.content.includes('"prior-run"'));
        const json = sawPrior ? refined : workedExample;
        return { json, raw: JSON.stringify(json), model: "test-model", usage: { inputTokens: 0, outputTokens: 0 }, meta: {} };
      },
    };

    const fresh = await runPipeline({ contract, intent: INTENT, prompt: PRIOR_PROMPT, adapter: conditioning, now: fixedClock });
    const refinement = await runPipeline({
      contract,
      intent: INTENT,
      prompt: REFINE_PROMPT,
      adapter: conditioning,
      conversation: priorTurns,
      now: fixedClock,
    });

    expect(fresh.report.outcome).toBe("passed");
    expect(refinement.report.outcome).toBe("passed");
    const surfaceOf = (r: typeof fresh) => JSON.stringify(r.report.attempts.at(-1)!.surface);
    expect(surfaceOf(fresh)).toBe(JSON.stringify(workedExample));
    expect(surfaceOf(refinement)).toBe(JSON.stringify(refined));
    expect(surfaceOf(refinement)).not.toBe(surfaceOf(fresh)); // the prior surface changed the outcome
  });

  it("keeps the system prompt immutable: identical with and without a conversation seed", async () => {
    const a = new ScriptedAdapter([{ output: workedExample }]);
    const b = new ScriptedAdapter([{ output: workedExample }]);
    await runPipeline({ contract, intent: INTENT, prompt: PRIOR_PROMPT, adapter: a, now: fixedClock });
    await runPipeline({ contract, intent: INTENT, prompt: REFINE_PROMPT, adapter: b, conversation: priorTurns, now: fixedClock });
    expect(b.requests[0].system).toBe(a.requests[0].system);
  });

  it("bounded repair appends AFTER the seeded conversation and still converges", async () => {
    const adapter = new ScriptedAdapter([{ output: violatingF1 }, { output: workedExample }]);
    const run = await runPipeline({
      contract,
      intent: INTENT,
      prompt: REFINE_PROMPT,
      adapter,
      conversation: priorTurns,
      now: fixedClock,
    });
    expect(run.report.outcome).toBe("passed");
    expect(adapter.requests).toHaveLength(2);

    const second = adapter.requests[1].messages;
    // The seed survives verbatim at its position in attempt 2...
    const seedAt = second.findIndex((m) => m.role === "assistant" && m.content === JSON.stringify(priorSurface));
    expect(seedAt).toBeGreaterThan(0);
    expect(second[seedAt - 1]).toEqual({ role: "user", content: PRIOR_PROMPT });
    // ...and the repair exchange is appended at the tail, after the refinement prompt.
    expect(second.at(-2)!.role).toBe("assistant");
    expect(JSON.parse(second.at(-2)!.content)).toEqual(violatingF1);
    expect(second.at(-1)!.role).toBe("user");
    expect(second.at(-1)!.content).toBe(run.report.repairMessages[0]);
  });

  it("records the seed verbatim in the audit report; absent when unused (byte-stable for existing callers)", async () => {
    const withSeed = await runPipeline({
      contract,
      intent: INTENT,
      prompt: REFINE_PROMPT,
      adapter: new ScriptedAdapter([{ output: workedExample }]),
      conversation: priorTurns,
      now: fixedClock,
    });
    expect(withSeed.report.conversation).toEqual(priorTurns);
    expect(validateReport(withSeed.report), JSON.stringify(validateReport.errors)).toBe(true);

    const without = await runPipeline({
      contract,
      intent: INTENT,
      prompt: PRIOR_PROMPT,
      adapter: new ScriptedAdapter([{ output: workedExample }]),
      now: fixedClock,
    });
    expect(without.report.conversation).toBeUndefined();
    expect("conversation" in without.report).toBe(false);
    expect(validateReport(without.report), JSON.stringify(validateReport.errors)).toBe(true);
  });
});
