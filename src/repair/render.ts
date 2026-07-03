/**
 * Repair feedback (ADR-7): ONE findings object, two serializations. This
 * module renders the linter's findings — the same objects embedded verbatim
 * in the audit report — into the deterministic user message appended for a
 * repair attempt. The system prompt is never mutated between attempts; this
 * message is the only delta.
 */
import type { Contract } from "../core/contract.js";
import type { Finding } from "../core/lint/findings.js";

/**
 * Template variants (PR-10 matrix design input, hypothesis-testing only):
 * the standard template's "Do not change parts that were not flagged" may
 * inhibit removal/restructuring-shaped repairs (e.g. un-nesting an
 * interactive element). `permit-restructuring` swaps exactly that one
 * instruction; everything else — findings serialization, corrected
 * references, schema instruction — is byte-identical, so eval A/Bs isolate
 * the single variable. The variant is recorded in the audit report.
 */
export type RepairTemplate = "standard" | "permit-restructuring";

const CLOSING_INSTRUCTION: Record<RepairTemplate, string> = {
  standard: "Do not change parts of the surface that were not flagged.",
  "permit-restructuring":
    "Remove or restructure whatever is necessary to fix the violations, including deleting the offending elements; preserve unaffected content where possible.",
};

export function renderRepairMessage(
  findings: Finding[],
  contract: Contract,
  template: RepairTemplate = "standard",
): string {
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
    CLOSING_INSTRUCTION[template],
    "Respond with a single JSON object conforming to the provided schema. No commentary.",
  );
  return lines.join("\n");
}
