/**
 * Minimal dspack v0.3/v0.4 contract types — exactly the fields the pipeline
 * reads. Deliberately local: `core` (compiler + linter) is protocol-neutral
 * and depends on no emitter and no network module (enforced by core-boundary
 * tests). dspack documents may carry more; unknown properties are ignored per
 * dspack conformance rules.
 */

export interface Contract {
  dspack: string;
  name: string;
  description?: string;
  tokens?: Record<string, { values?: Record<string, { value?: unknown }> }>;
  components?: Record<string, ContractComponent>;
  /** v0.4: contract-defined category registry (spec v0.4 §3). */
  categories?: Record<string, { name?: string; description: string }>;
  patterns?: ContractPattern[];
  intents?: IntentEntry[];
  rules?: RuleEntry[];
  examples?: ExampleEntry[];
  [k: string]: unknown;
}

export interface ContractComponent {
  name: string;
  description: string;
  props?: Record<string, ContractProp>;
  composition?: { subComponents?: SubComponent[]; notes?: string };
  /** v0.4: membership in registered categories. */
  categories?: string[];
  [k: string]: unknown;
}

export interface ContractProp {
  type: string;
  description?: string;
  values?: Array<string | number | boolean | { value: unknown; description?: string }>;
  default?: unknown;
  [k: string]: unknown;
}

export interface SubComponent {
  id: string;
  name: string;
  description?: string;
  required?: boolean;
  slot?: string;
  acceptsChildren?: string;
  /** v0.4: membership in registered categories. */
  categories?: string[];
}

export interface ContractPattern {
  id: string;
  name?: string;
  guidance?: string;
  [k: string]: unknown;
}

export interface IntentEntry {
  id: string;
  name?: string;
  description: string;
  relatedPatterns?: string[];
  tags?: string[];
}

export type RuleSeverity = "must" | "should";
export type RuleType = "component-choice" | "required-composition" | "forbidden-composition" | "required-props";

export interface RuleBase {
  id: string;
  type: string; // validated against RuleType by the linter; unknown => hard error
  severity: RuleSeverity;
  rationale: string;
  appliesTo?: { intents: string[] };
  examples?: string[];
  tags?: string[];
}

export interface ComponentChoiceRule extends RuleBase {
  type: "component-choice";
  require?: string[];
  forbid?: string[];
}

export interface RequiredCompositionRule extends RuleBase {
  type: "required-composition";
  component: string;
  requiredSubComponents?: Array<{ id: string; min?: number }>;
  requiredProps?: Array<{ on?: string; prop: string; oneOf: unknown[] }>;
}

export interface ForbiddenCompositionRule extends RuleBase {
  type: "forbidden-composition";
  component: string;
  forbiddenDescendants?: string[];
  forbiddenProps?: Array<{ on?: string; prop: string; values: unknown[] }>;
  /** v0.4: forbid descendants by registered category (spec v0.4 §4.2). */
  forbiddenCategories?: string[];
}

/**
 * v0.4 required-props (spec v0.4 §4.1): content every instance of `component`
 * must carry DIRECTLY — its own `text` field and/or directly-present props.
 * The one rule type whose `component` accepts a sub-component id.
 */
export interface RequiredPropsRule extends RuleBase {
  type: "required-props";
  component: string;
  within?: string;
  requiredText?: true;
  /** v0.4 amendment (2026-07-04): where requiredText looks. Default "self". */
  textScope?: "self" | "subtree";
  requiredProps?: Array<{ prop: string; oneOf?: unknown[] }>;
}

export type RuleEntry =
  | ComponentChoiceRule
  | RequiredCompositionRule
  | ForbiddenCompositionRule
  | RequiredPropsRule
  | RuleBase;

export interface ExampleEntry {
  id: string;
  intent: string;
  name?: string;
  description?: string;
  prompt?: string;
  surface: Surface;
}

/** dspack surface v0.1 (schema: dspack repo, dspack.surface.v0_1.schema.json). */
export interface Surface {
  dspackSurface: string;
  system: string;
  intent: string;
  root: SurfaceNode;
}

export interface SurfaceNode {
  component: string;
  id?: string;
  props?: Record<string, unknown>;
  text?: string;
  children?: SurfaceNode[];
  slots?: Record<string, SurfaceNode[]>;
}

/** Bare enum values from a prop descriptor (valueDescriptor objects unwrapped). */
export function enumValues(prop: ContractProp): unknown[] | null {
  if (prop.type !== "enum" || !Array.isArray(prop.values)) return null;
  return prop.values.map((v) => (v && typeof v === "object" ? (v as { value: unknown }).value : v));
}

/** All sub-component ids of the contract, mapped to their parent component id. */
export function subComponentIndex(contract: Contract): Map<string, string> {
  const index = new Map<string, string>();
  for (const [id, component] of Object.entries(contract.components ?? {})) {
    for (const sub of component.composition?.subComponents ?? []) index.set(sub.id, id);
  }
  return index;
}

/**
 * Sub-component ids declared by more than one component, with all declaring
 * parents. Spec v0.3 §5 makes document-wide uniqueness normative for
 * contracts using governance blocks: S2 and rule resolution work by id alone
 * and must never depend on object iteration order.
 */
export function duplicateSubComponentIds(contract: Contract): Map<string, string[]> {
  const parents = new Map<string, string[]>();
  for (const [id, component] of Object.entries(contract.components ?? {})) {
    for (const sub of component.composition?.subComponents ?? []) {
      parents.set(sub.id, [...(parents.get(sub.id) ?? []), id]);
    }
  }
  return new Map([...parents].filter(([, declaredBy]) => declaredBy.length > 1));
}

/**
 * Category memberships by component/sub-component id (v0.4). Ids without
 * memberships are absent. Resolution is through the contract at lint time —
 * categories never appear in surfaces (spec v0.4 §3).
 */
export function categoryIndex(contract: Contract): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const [id, component] of Object.entries(contract.components ?? {})) {
    if (component.categories?.length) index.set(id, component.categories);
    for (const sub of component.composition?.subComponents ?? []) {
      if (sub.categories?.length) index.set(sub.id, sub.categories);
    }
  }
  return index;
}

export function getIntent(contract: Contract, intentId: string): IntentEntry {
  const intent = (contract.intents ?? []).find((i) => i.id === intentId);
  if (!intent) {
    const known = (contract.intents ?? []).map((i) => i.id).join(", ") || "(none)";
    throw new Error(`intent '${intentId}' is not registered in the contract (known: ${known})`);
  }
  return intent;
}
