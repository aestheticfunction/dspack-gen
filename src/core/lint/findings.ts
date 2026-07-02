/**
 * Lint findings and the gate report — ONE object, two serializations (ADR-7):
 * the JSON here is embedded verbatim in audit reports and rendered
 * deterministically into repair feedback; `renderText` is the human CLI view.
 *
 * Severity carries both faces (ADR-11): `requirement` is the contract's
 * RFC 2119 term (must|should), `level` the tool mapping (error|warn).
 */
import type { RuleSeverity } from "../contract.js";

export type FindingLevel = "error" | "warn";

export const LEVEL_OF: Record<RuleSeverity, FindingLevel> = {
  must: "error",
  should: "warn",
};

export interface FindingLocation {
  /** Path from the surface root, e.g. `$.root.children[0]`; `$.root` for surface-wide findings. */
  path: string;
  /** The component id at the location, or "surface" for surface-wide findings. */
  component: string;
  nodeId?: string;
}

export interface Finding {
  ruleId: string;
  type: string;
  requirement: RuleSeverity;
  level: FindingLevel;
  message: string;
  rationale: string;
  location: FindingLocation;
  exampleIds: string[];
}

export type GateName = "S1" | "S2" | "S3";
export type GateStatus = "PASS" | "FAIL" | "SKIPPED";

export interface GateReport {
  gate: GateName;
  name: string;
  status: GateStatus;
  /** S1/S2 error strings; S3 uses `findings` instead. */
  errors?: string[];
}

export interface LintReport {
  gates: GateReport[];
  findings: Finding[];
  /** Errors only (warn findings never fail the lint in v0.3). */
  errorCount: number;
  warnCount: number;
  pass: boolean;
}

export function renderText(report: LintReport): string {
  const lines: string[] = [];
  for (const gate of report.gates) {
    lines.push(`gate ${gate.gate} ${gate.name.padEnd(21)} ${gate.status}`);
    for (const error of gate.errors ?? []) lines.push(`  ✖ ${error}`);
  }
  for (const finding of report.findings) {
    const mark = finding.level === "error" ? "✖" : "▲";
    lines.push(`${mark} ${finding.level} [${finding.requirement}]  ${finding.ruleId}  [${finding.type}]`);
    const where = finding.location.nodeId
      ? `${finding.location.path}  (component: ${finding.location.component}, id: "${finding.location.nodeId}")`
      : `${finding.location.path}  (component: ${finding.location.component})`;
    lines.push(`   at ${where}`);
    lines.push(`   ${finding.message}`);
    lines.push(`   Rationale: ${finding.rationale}`);
    if (finding.exampleIds.length) lines.push(`   See example: ${finding.exampleIds.join(", ")}`);
  }
  lines.push(
    report.pass
      ? `lint: PASS — 0 error(s), ${report.warnCount} warning(s)`
      : `lint: FAIL — ${report.errorCount} error(s), ${report.warnCount} warning(s)`,
  );
  return lines.join("\n");
}
