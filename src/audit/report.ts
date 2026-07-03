/**
 * Audit report v1 (ADR-8): a versioned, schema'd artifact from day one.
 * JSON is the artifact (schemas/audit-report.v1.schema.json); the Markdown
 * rendering is a derived view. Stability guarantee: additive-only within
 * reportVersion "1" (docs/AUDIT.md).
 */
import { createHash } from "node:crypto";
import type { Contract } from "../core/contract.js";
import type { Finding, GateReport } from "../core/lint/findings.js";

export const REPORT_VERSION = "1";

export type Outcome = "passed" | "failed-lint-exhausted" | "failed-gate" | "failed-adapter";

/** Emitter gate result, keyed by the architecture-wide A-gate names. */
export interface EmitterGate {
  gate: "A1" | "A2" | "A3";
  name: string;
  pass: boolean;
  errors?: string[];
}

export interface AttemptRecord {
  index: number;
  /** The generated dspack surface (absent when the adapter failed). */
  surface?: unknown;
  model?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  meta?: Record<string, unknown>;
  adapterError?: string;
  /** Surface gates S1/S2/S3, independently reported. */
  gates?: GateReport[];
  findings?: Finding[];
}

export interface EmittedValidation {
  a2uiVersion: string;
  gates: EmitterGate[];
}

export interface AuditReportV1 {
  reportVersion: typeof REPORT_VERSION;
  createdAt: string;
  request: {
    prompt: string;
    intent: string;
    contract: { name: string; dspack: string; sha256: string };
  };
  generation: {
    adapterId: string;
    schemaSha256: string;
    maxRepairs: number;
    ruleSteering: boolean;
    /** ADR-7 repair template variant used for feedback (additive in v1; absent ⇒ "standard"). */
    repairTemplate?: string;
  };
  attempts: AttemptRecord[];
  /** Repair messages verbatim — rendered from the same findings objects above. */
  repairMessages: string[];
  outcome: Outcome;
  emitted?: {
    target: "a2ui";
    surfaceMessages: unknown;
    /** Emitter warnings — every synthesis/drop, nothing silent. */
    warnings: Array<{ code: string; message: string }>;
    validations: EmittedValidation[];
  };
  timings: { totalMs: number };
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

export function contractDigest(contract: Contract): { name: string; dspack: string; sha256: string } {
  return { name: contract.name, dspack: contract.dspack, sha256: sha256(contract as unknown as Record<string, unknown>) };
}

/** Human view of the JSON artifact — derived, never the source of truth. */
export function renderMarkdown(report: AuditReportV1): string {
  const lines: string[] = [
    `# Audit report (v${report.reportVersion})`,
    "",
    `- **Outcome:** ${report.outcome}`,
    `- **Prompt:** ${report.request.prompt}`,
    `- **Intent:** ${report.request.intent}`,
    `- **Contract:** ${report.request.contract.name} (dspack ${report.request.contract.dspack}, sha256 ${report.request.contract.sha256.slice(0, 12)}…)`,
    `- **Adapter:** ${report.generation.adapterId} (max repairs: ${report.generation.maxRepairs}, rule steering: ${report.generation.ruleSteering})`,
    `- **Created:** ${report.createdAt} · **Duration:** ${report.timings.totalMs} ms`,
  ];

  report.attempts.forEach((attempt) => {
    lines.push("", `## Attempt ${attempt.index + 1}`);
    if (attempt.adapterError) {
      lines.push(`- Adapter error: ${attempt.adapterError}`);
      return;
    }
    if (attempt.model) lines.push(`- Model: ${attempt.model}`);
    for (const gate of attempt.gates ?? []) {
      lines.push(`- gate ${gate.gate} ${gate.name}: **${gate.status}**`);
    }
    for (const finding of attempt.findings ?? []) {
      lines.push(
        `  - ${finding.level} [${finding.requirement}] ${finding.ruleId} at ${finding.location.path} — ${finding.message}`,
      );
    }
    const repair = report.repairMessages[attempt.index];
    if (repair) {
      lines.push("", "### Repair feedback sent", "", "```", repair, "```");
    }
  });

  if (report.emitted) {
    lines.push("", "## Emitted (A2UI)");
    for (const validation of report.emitted.validations) {
      for (const gate of validation.gates) {
        lines.push(`- [${validation.a2uiVersion}] gate ${gate.gate} ${gate.name}: **${gate.pass ? "PASS" : "FAIL"}**`);
      }
    }
    for (const warning of report.emitted.warnings) {
      lines.push(`- note ${warning.code}: ${warning.message}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
