/**
 * Repair feedback (ADR-7): ONE findings object, two serializations. This
 * module renders the linter's findings — the same objects embedded verbatim
 * in the audit report — into the deterministic user message appended for a
 * repair attempt. The system prompt is never mutated between attempts; this
 * message is the only delta.
 */
import type { Contract } from "../core/contract.js";
import type { Finding } from "../core/lint/findings.js";

export function renderRepairMessage(findings: Finding[], contract: Contract): string {
  const errors = findings.filter((f) => f.level === "error");
  const lines: string[] = [
    `Your surface violates ${errors.length} governance rule finding(s) of the "${contract.name}" design system:`,
    "",
  ];

  errors.forEach((finding, index) => {
    const where = finding.location.nodeId
      ? `${finding.location.path} (component: ${finding.location.component}, id: "${finding.location.nodeId}")`
      : `${finding.location.path} (component: ${finding.location.component})`;
    lines.push(
      `Violation ${index + 1}: [${finding.ruleId} / ${finding.requirement}]`,
      `  At: ${where}`,
      `  ${finding.message}`,
      `  Why: ${finding.rationale}`,
    );
  });

  // Corrected references: each linked example once, verbatim (ADR-3 — the
  // surface format IS the generation format).
  const exampleIds = [...new Set(errors.flatMap((f) => f.exampleIds))];
  for (const exampleId of exampleIds) {
    const example = (contract.examples ?? []).find((e) => e.id === exampleId);
    if (example) {
      lines.push("", `A correct example (${example.id}): ${JSON.stringify(example.surface)}`);
    }
  }

  lines.push(
    "",
    "Produce a corrected dspack surface document that fixes every violation above.",
    "Do not change parts of the surface that were not flagged.",
    "Respond with a single JSON object conforming to the provided schema. No commentary.",
  );
  return lines.join("\n");
}
