/**
 * PR-3 acceptance gates: the prompt/context compiler.
 *
 * - Golden: the compiled context for shadcn × destructive-action equals the
 *   checked-in fixture byte-for-byte (regenerate deliberately with
 *   UPDATE_GOLDEN=1 npm test — the diff is the review artifact).
 * - The generation schema compiles under ajv, ACCEPTS the contract's worked
 *   example surface, and REJECTS out-of-vocabulary components, out-of-enum
 *   prop values, and nesting beyond the unroll depth.
 * - The rules section is steering only: --no-steering removes it without
 *   touching schema or fewshot (the guarantee lives in gate S3, not here).
 */
import { readFileSync, writeFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import type { Contract, Surface, SurfaceNode } from "./contract.js";
import { compileContext } from "./compiler.js";
import { DEFAULT_UNROLL_DEPTH } from "./generation-schema.js";

const contract = JSON.parse(readFileSync("fixtures/shadcn.v0_4.dspack.json", "utf8")) as Contract;
const workedSurface = contract.examples!.find((e) => e.id === "ex.delete-account-confirmation")!.surface;
const GOLDEN = "fixtures/golden/context/shadcn.destructive-action.json";

const context = compileContext(contract, "destructive-action");

describe("compileContext golden", () => {
  it("matches the checked-in golden fixture", () => {
    const rendered = JSON.stringify(context, null, 2) + "\n";
    if (process.env.UPDATE_GOLDEN) writeFileSync(GOLDEN, rendered);
    expect(rendered).toBe(readFileSync(GOLDEN, "utf8"));
  });

  it("renders every applicable rule with its rationale into the system prompt", () => {
    // The contract carries intent-scoped rules for more than one intent
    // (v2.3.0 added record-collection); the destructive-action context
    // renders exactly the rules that apply to it — unscoped rules plus its
    // own — and none of another intent's.
    const applies = (rule: NonNullable<typeof contract.rules>[number]) =>
      !rule.appliesTo || rule.appliesTo.intents.includes("destructive-action");
    for (const rule of contract.rules!) {
      if (applies(rule)) {
        expect(context.system).toContain(rule.id);
        expect(context.system).toContain(rule.rationale);
      } else {
        expect(context.system).not.toContain(rule.id);
      }
    }
    expect(context.system).toContain("dialog is forbidden");
  });

  it("fewshot is the worked example verbatim", () => {
    expect(context.fewshot).toEqual([
      { role: "user", content: "a screen to delete my account" },
      { role: "assistant", content: JSON.stringify(workedSurface) },
    ]);
  });

  it("unregistered intents are rejected", () => {
    expect(() => compileContext(contract, "bulk-edit")).toThrowError(/not registered/);
  });
});

describe("generation schema", () => {
  const ajv = new Ajv2020({ strict: false });
  const validate = ajv.compile(context.schema);

  it("compiles under ajv and accepts the worked example surface", () => {
    expect(validate(workedSurface)).toBe(true);
  });

  const variant = (root: SurfaceNode): Surface => ({
    dspackSurface: "0.1",
    system: contract.name,
    intent: "destructive-action",
    root,
  });

  it("rejects out-of-vocabulary components", () => {
    expect(validate(variant({ component: "carousel" }))).toBe(false);
  });

  it("rejects out-of-enum prop values", () => {
    expect(validate(variant({ component: "button", props: { variant: "danger" }, text: "x" }))).toBe(false);
  });

  it("rejects nesting beyond the unroll depth (schema is non-recursive)", () => {
    let node: SurfaceNode = { component: "button", text: "leaf" };
    for (let i = 0; i < DEFAULT_UNROLL_DEPTH; i++) node = { component: "card", children: [node] };
    expect(validate(variant(node))).toBe(false);

    let shallow: SurfaceNode = { component: "button", text: "leaf" };
    for (let i = 0; i < DEFAULT_UNROLL_DEPTH - 1; i++) shallow = { component: "card", children: [shallow] };
    expect(validate(variant(shallow))).toBe(true);
  });

  it("schema encodes shape only — never governance (dialog remains schema-valid)", () => {
    // 'dialog' is FORBIDDEN by rule for this intent, but MUST be schema-valid:
    // encoding governance into the schema would make violations unobservable.
    expect(validate(variant({ component: "dialog", text: "Confirm?" }))).toBe(true);
  });
});

describe("steering is separable from the guarantee", () => {
  it("--no-steering removes the rules section but not schema/fewshot", () => {
    const bare = compileContext(contract, "destructive-action", { omitRuleSteering: true });
    expect(bare.system).not.toContain("Governance rules in effect");
    expect(bare.schema).toEqual(context.schema);
    expect(bare.fewshot).toEqual(context.fewshot);
  });
});
