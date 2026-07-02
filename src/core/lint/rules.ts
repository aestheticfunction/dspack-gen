/**
 * Gate S3 — the rule-type registry and evaluators (normative semantics:
 * spec/dspack-v0.3.md §5.3).
 *
 * The registry is the thesis-bearing seam: new rule types land additively in
 * v0.4 by adding an entry — never by touching existing evaluators. A rule
 * whose type has no registry entry is a HARD error (UnknownRuleTypeError →
 * CLI exit 4): silently skipping would misreport a surface as governed.
 *
 * All three v0.3 evaluators are implemented. (The M1 plan deferred
 * `forbidden-composition` to M2, but the v0.3 shadcn contract carries a
 * UNIVERSAL forbidden-composition rule and spec §5.4 forbids skipping — a
 * two-evaluator linter would hard-error on every lint of the real contract.
 * Deviation flagged for maintainer review in the PR; the evaluator is ~40
 * lines and fixture F5 activates with it.)
 */
import type {
  ComponentChoiceRule,
  Contract,
  ForbiddenCompositionRule,
  RequiredCompositionRule,
  RuleEntry,
  Surface,
} from "../contract.js";
import { LEVEL_OF, type Finding } from "./findings.js";
import { descendantsOf, walkSurface, type VisitedNode } from "./walk.js";

export class UnknownRuleTypeError extends Error {
  constructor(readonly ruleId: string, readonly ruleType: string, detail: string) {
    super(`rule '${ruleId}' has unknown or unimplemented type '${ruleType}': ${detail}`);
    this.name = "UnknownRuleTypeError";
  }
}

type Evaluator = (rule: RuleEntry, surface: Surface, contract: Contract) => Finding[];

/** The rule-type registry. Additive-only across spec versions. */
const REGISTRY: Record<string, Evaluator> = {
  "component-choice": evaluateComponentChoice,
  "required-composition": evaluateRequiredComposition,
  "forbidden-composition": evaluateForbiddenComposition,
};

export function evaluateRules(surface: Surface, contract: Contract): Finding[] {
  const findings: Finding[] = [];
  for (const rule of contract.rules ?? []) {
    if (rule.appliesTo && !rule.appliesTo.intents.includes(surface.intent)) continue;
    const evaluator = REGISTRY[rule.type];
    if (evaluator === undefined) {
      throw new UnknownRuleTypeError(rule.id, rule.type, "not a v0.3 rule type");
    }
    findings.push(...evaluator(rule, surface, contract));
  }
  return findings;
}

function finding(rule: RuleEntry, message: string, location: Finding["location"]): Finding {
  return {
    ruleId: rule.id,
    type: rule.type,
    requirement: rule.severity,
    level: LEVEL_OF[rule.severity],
    message,
    rationale: rule.rationale,
    location,
    exampleIds: rule.examples ?? [],
  };
}

const SURFACE_LOCATION = { path: "$.root", component: "surface" } as const;

/** Human reference to a node for messages: path plus id when present. */
function describeNode(visited: VisitedNode): string {
  return visited.node.id ? `at ${visited.path}, id "${visited.node.id}"` : `at ${visited.path}`;
}

function locationOf(visited: VisitedNode): Finding["location"] {
  return { path: visited.path, component: visited.node.component, nodeId: visited.node.id };
}

/**
 * component-choice: every id in `require` MUST appear ≥1 time (finding at the
 * surface root per missing id); every id in `forbid` MUST appear 0 times
 * (finding per matching node).
 */
function evaluateComponentChoice(entry: RuleEntry, surface: Surface): Finding[] {
  const rule = entry as ComponentChoiceRule;
  const findings: Finding[] = [];
  const nodes = walkSurface(surface);

  for (const id of rule.forbid ?? []) {
    for (const visited of nodes.filter((v) => v.node.component === id)) {
      findings.push(
        finding(rule, `Component '${id}' is forbidden for intent '${surface.intent}'.`, locationOf(visited)),
      );
    }
  }
  for (const id of rule.require ?? []) {
    if (!nodes.some((v) => v.node.component === id)) {
      findings.push(finding(rule, `Required component '${id}' does not appear in the surface.`, SURFACE_LOCATION));
    }
  }
  return findings;
}

/**
 * required-composition: for EVERY node matching `component`, each
 * requiredSubComponents entry MUST have ≥ min matching descendants, and each
 * requiredProps entry MUST hold (on the node itself, or on every descendant
 * matching `on` — of which at least one must exist).
 */
function evaluateRequiredComposition(entry: RuleEntry, surface: Surface): Finding[] {
  const rule = entry as RequiredCompositionRule;
  const findings: Finding[] = [];

  for (const visited of walkSurface(surface).filter((v) => v.node.component === rule.component)) {
    const descendants = descendantsOf(visited);

    for (const requirement of rule.requiredSubComponents ?? []) {
      const min = requirement.min ?? 1;
      const found = descendants.filter((d) => d.node.component === requirement.id).length;
      if (found < min) {
        findings.push(
          finding(
            rule,
            `Required sub-component '${requirement.id}' (min ${min}) not found among descendants (found ${found}).`,
            locationOf(visited),
          ),
        );
      }
    }

    for (const requirement of rule.requiredProps ?? []) {
      const holds = (candidate: VisitedNode): boolean =>
        requirement.oneOf.includes(candidate.node.props?.[requirement.prop] as never);
      if (requirement.on === undefined) {
        if (!holds(visited)) {
          findings.push(
            finding(
              rule,
              `Required prop '${requirement.prop}' must be one of ${requirement.oneOf.map((v) => JSON.stringify(v)).join(", ")}.`,
              locationOf(visited),
            ),
          );
        }
      } else {
        const targets = descendants.filter((d) => d.node.component === requirement.on);
        if (targets.length === 0) {
          findings.push(
            finding(
              rule,
              `No descendant '${requirement.on}' found to satisfy required prop '${requirement.prop}'.`,
              locationOf(visited),
            ),
          );
        }
        for (const target of targets.filter((t) => !holds(t))) {
          findings.push(
            finding(
              rule,
              `Required prop '${requirement.prop}' on '${requirement.on}' must be one of ${requirement.oneOf.map((v) => JSON.stringify(v)).join(", ")}.`,
              locationOf(target),
            ),
          );
        }
      }
    }
  }
  return findings;
}

/**
 * forbidden-composition: for EVERY node matching `component`, no descendant
 * may match any forbiddenDescendants id — per spec §5.3 the finding is
 * LOCATED AT the offending descendant (the message names the matching origin
 * node) — and no forbiddenProps entry may hold (on the node itself, or on
 * descendants matching `on`, located at the checked node).
 */
function evaluateForbiddenComposition(entry: RuleEntry, surface: Surface): Finding[] {
  const rule = entry as ForbiddenCompositionRule;
  const findings: Finding[] = [];

  for (const visited of walkSurface(surface).filter((v) => v.node.component === rule.component)) {
    const descendants = descendantsOf(visited);

    for (const id of rule.forbiddenDescendants ?? []) {
      for (const offender of descendants.filter((d) => d.node.component === id)) {
        findings.push(
          finding(
            rule,
            `Forbidden descendant '${id}' inside '${rule.component}' (${describeNode(visited)}).`,
            locationOf(offender),
          ),
        );
      }
    }

    for (const constraint of rule.forbiddenProps ?? []) {
      const violates = (candidate: VisitedNode): boolean =>
        constraint.values.includes(candidate.node.props?.[constraint.prop] as never);
      const targets =
        constraint.on === undefined ? [visited] : descendants.filter((d) => d.node.component === constraint.on);
      for (const target of targets.filter(violates)) {
        findings.push(
          finding(
            rule,
            `Forbidden value ${JSON.stringify(target.node.props?.[constraint.prop])} for prop '${constraint.prop}'${constraint.on ? ` on '${constraint.on}'` : ""}.`,
            locationOf(target),
          ),
        );
      }
    }
  }
  return findings;
}
