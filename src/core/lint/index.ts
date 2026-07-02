/**
 * The surface gates, run in order and independently reported (never implicit
 * steps inside generation):
 *   S1 — generic surface schema (vendored dspack.surface.v0_1)
 *   S2 — contract vocabulary
 *   S3 — governance rules (typed evaluators, registry in rules.ts)
 *
 * S1 failure skips S2/S3 (the tree shape is not trustworthy); S2 failure
 * still evaluates S3 (the walk is safe and more findings help repair).
 * `pass` is false iff any gate FAILs; warn-level findings never fail (v0.3).
 */
import Ajv2020 from "ajv/dist/2020.js";
import type { Contract, Surface } from "../contract.js";
import { surfaceSchemaV0_1 } from "../surface-schema.js";
import { type Finding, type GateReport, type LintReport } from "./findings.js";
import { checkVocabulary } from "./vocabulary.js";
import { evaluateRules } from "./rules.js";

export { renderText, LEVEL_OF } from "./findings.js";
export type { Finding, FindingLevel, FindingLocation, GateName, GateReport, GateStatus, LintReport } from "./findings.js";
export { UnknownRuleTypeError } from "./rules.js";
export { walkSurface } from "./walk.js";

const ajv = new Ajv2020({ strict: false, allErrors: true });
const validateSurfaceSchema = ajv.compile(surfaceSchemaV0_1 as unknown as Record<string, unknown>);

export function lintSurface(surface: unknown, contract: Contract): LintReport {
  const gates: GateReport[] = [];
  let findings: Finding[] = [];

  // S1 — generic surface schema.
  const s1Ok = validateSurfaceSchema(surface) as boolean;
  gates.push({
    gate: "S1",
    name: "surface-schema",
    status: s1Ok ? "PASS" : "FAIL",
    errors: s1Ok
      ? undefined
      : (validateSurfaceSchema.errors ?? []).map((e) => `${e.instancePath || "(root)"} ${e.message ?? ""}`.trim()),
  });

  if (!s1Ok) {
    gates.push({ gate: "S2", name: "contract-vocabulary", status: "SKIPPED" });
    gates.push({ gate: "S3", name: "governance", status: "SKIPPED" });
    return summarize(gates, findings);
  }

  const typed = surface as Surface;

  // S2 — contract vocabulary (a check on the artifact, whatever produced it).
  const s2Errors = checkVocabulary(typed, contract);
  gates.push({
    gate: "S2",
    name: "contract-vocabulary",
    status: s2Errors.length === 0 ? "PASS" : "FAIL",
    errors: s2Errors.length ? s2Errors : undefined,
  });

  // S3 — governance. Unknown rule types throw (CLI exit 4), never skip.
  findings = evaluateRules(typed, contract);
  gates.push({
    gate: "S3",
    name: "governance",
    status: findings.some((f) => f.level === "error") ? "FAIL" : "PASS",
  });

  return summarize(gates, findings);
}

function summarize(gates: GateReport[], findings: Finding[]): LintReport {
  const errorCount = findings.filter((f) => f.level === "error").length;
  const warnCount = findings.filter((f) => f.level === "warn").length;
  return {
    gates,
    findings,
    errorCount,
    warnCount,
    pass: gates.every((g) => g.status !== "FAIL"),
  };
}
