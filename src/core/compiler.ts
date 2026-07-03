/**
 * Prompt/context compiler: dspack v0.3 contract × declared intent →
 * { system, schema, fewshot }.
 *
 * - `system`: the compiled system prompt — vocabulary, governance rules
 *   rendered as instructions with rationales, and design-intent guidance.
 *   Deterministic (golden-file tested) and immutable across repair attempts
 *   (ADR-7: the only delta between attempts is the repair feedback).
 * - `schema`: the generation schema (see generation-schema.ts). Shape only,
 *   never governance — the prompt's rules section is steering; the guarantee
 *   is gate S3.
 * - `fewshot`: user/assistant message pairs from the contract's examples for
 *   the intent, verbatim (ADR-3: the surface format IS the generation format,
 *   so exemplars are exactly in-distribution).
 */
import {
  type Contract,
  type ExampleEntry,
  type IntentEntry,
  type RuleEntry,
  categoryIndex,
  enumValues,
  getIntent,
} from "./contract.js";
import { buildGenerationSchema, type GenerationSchemaOptions } from "./generation-schema.js";

export interface FewshotMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompiledContext {
  system: string;
  schema: Record<string, unknown>;
  fewshot: FewshotMessage[];
}

export interface CompileOptions extends GenerationSchemaOptions {
  /**
   * Omit the governance-rules section from the system prompt. The linter (S3)
   * is unaffected — this only removes prompt steering. Used by demos/evals to
   * observe first-attempt violation rates honestly.
   */
  omitRuleSteering?: boolean;
}

/** Rules that fire for an intent: universal rules plus intent-scoped ones. */
export function applicableRules(contract: Contract, intentId: string): RuleEntry[] {
  return (contract.rules ?? []).filter(
    (rule) => !rule.appliesTo || rule.appliesTo.intents.includes(intentId),
  );
}

export function compileContext(
  contract: Contract,
  intentId: string,
  options: CompileOptions = {},
): CompiledContext {
  const intent = getIntent(contract, intentId);
  const rules = applicableRules(contract, intentId);
  const examples = (contract.examples ?? []).filter((e) => e.intent === intentId);

  return {
    system: renderSystemPrompt(contract, intent, options.omitRuleSteering ? [] : rules, options),
    schema: buildGenerationSchema(contract, intentId, options),
    fewshot: examples.flatMap((example) => fewshotPair(example)),
  };
}

function fewshotPair(example: ExampleEntry): FewshotMessage[] {
  return [
    { role: "user", content: example.prompt ?? example.description ?? example.id },
    { role: "assistant", content: JSON.stringify(example.surface) },
  ];
}

function renderSystemPrompt(
  contract: Contract,
  intent: IntentEntry,
  rules: RuleEntry[],
  options: CompileOptions,
): string {
  const lines: string[] = [
    `You generate user interface surfaces for the "${contract.name}" design system. You must respond`,
    "with a single JSON object conforming to the provided schema — a dspack surface document.",
    "",
    "## Component vocabulary",
    "You may use only these components (with the listed props and allowed values):",
  ];

  for (const [id, component] of Object.entries(contract.components ?? {})) {
    const props = Object.entries(component.props ?? {})
      .map(([name, descriptor]) => {
        const values = enumValues(descriptor);
        return values ? `${name} ∈ {${values.map(String).join(", ")}}` : name;
      })
      .join("; ");
    const subs = (component.composition?.subComponents ?? []).map((s) => s.id).join(", ");
    let line = `- ${id} — ${component.description}`;
    if (props) line += ` Props: ${props}.`;
    if (subs) line += ` Sub-components (used as children): ${subs}.`;
    lines.push(line);
  }

  if (rules.length > 0) {
    lines.push(
      "",
      `## Governance rules in effect (intent: ${intent.id})`,
      "These are hard requirements. Surfaces violating them will be rejected:",
    );
    rules.forEach((rule, i) => {
      lines.push(`${i + 1}. [${rule.id} / ${rule.severity}] ${ruleInstruction(rule, contract)} Why: ${rule.rationale}`);
    });
  }

  lines.push("", "## Design intent", `Intent "${intent.id}": ${intent.description}`);
  for (const patternId of intent.relatedPatterns ?? []) {
    const pattern = (contract.patterns ?? []).find((p) => p.id === patternId);
    if (pattern?.guidance) lines.push(`Related pattern "${pattern.name ?? pattern.id}": ${pattern.guidance}`);
  }

  lines.push("", "Output only the JSON object. No commentary.");
  void options;
  return lines.join("\n");
}

/** One-sentence imperative rendering of a rule (the rationale is appended by the caller). */
export function ruleInstruction(rule: RuleEntry, contract?: Contract): string {
  switch (rule.type) {
    case "component-choice": {
      const r = rule as { require?: string[]; forbid?: string[] };
      const parts: string[] = [];
      if (r.require?.length) parts.push(`Use ${r.require.join(", ")} for this surface`);
      if (r.forbid?.length) parts.push(`${r.forbid.join(", ")} ${r.forbid.length === 1 ? "is" : "are"} forbidden`);
      return `${parts.join("; ")}.`;
    }
    case "required-composition": {
      const r = rule as { component: string; requiredSubComponents?: Array<{ id: string }>; requiredProps?: Array<{ prop: string; oneOf: unknown[] }> };
      const needs: string[] = [];
      if (r.requiredSubComponents?.length) needs.push(r.requiredSubComponents.map((s) => s.id).join(" and "));
      if (r.requiredProps?.length)
        needs.push(r.requiredProps.map((p) => `${p.prop} set to one of ${p.oneOf.map(String).join("/")}`).join(" and "));
      return `Every ${r.component} must contain ${needs.join(", plus ")}.`;
    }
    case "forbidden-composition": {
      const r = rule as {
        component: string;
        forbiddenDescendants?: string[];
        forbiddenProps?: Array<{ prop: string; values: unknown[] }>;
        forbiddenCategories?: string[];
      };
      const parts: string[] = [];
      if (r.forbiddenDescendants?.length)
        parts.push(`Never place ${r.forbiddenDescendants.join(" or ")} inside a ${r.component}`);
      for (const category of r.forbiddenCategories ?? []) {
        // Steering names the category AND its resolved member ids, so the
        // model sees concrete vocabulary (mirrors the finding message).
        const members = contract
          ? [...categoryIndex(contract)].filter(([, cats]) => cats.includes(category)).map(([id]) => id)
          : [];
        parts.push(
          `never place ${category}-category components${members.length ? ` (${members.join(", ")})` : ""} inside ${r.component}`,
        );
      }
      if (r.forbiddenProps?.length)
        parts.push(
          r.forbiddenProps
            .map((p) => `never set ${p.prop} to ${p.values.map(String).join("/")} on ${r.component}`)
            .join("; "),
        );
      return `${parts.join("; ")}.`;
    }
    case "required-props": {
      const r = rule as {
        component: string;
        within?: string;
        requiredText?: true;
        requiredProps?: Array<{ prop: string; oneOf?: unknown[] }>;
      };
      const scope = r.within ? `Every ${r.component} inside ${r.within}` : `Every ${r.component}`;
      const needs: string[] = [];
      if (r.requiredText) needs.push("carry its label as its own `text` field (never nested in a child component)");
      for (const p of r.requiredProps ?? []) {
        needs.push(p.oneOf ? `set ${p.prop} to one of ${p.oneOf.map(String).join("/")}` : `set ${p.prop} directly`);
      }
      const existence = r.within ? `; every ${r.within} must contain a ${r.component}` : "";
      return `${scope} must ${needs.join(", and ")}${existence}.`;
    }
    default:
      // The linter hard-errors on unknown types (exit 4); the compiler simply
      // does not render steering it cannot phrase.
      return `Follow rule ${rule.id}.`;
  }
}
