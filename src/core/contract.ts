/**
 * Minimal dspack v0.3 contract types — exactly the fields the pipeline reads.
 * Deliberately local: `core` (compiler + linter) is protocol-neutral and
 * depends on no emitter and no network module (enforced by core-boundary
 * tests). dspack documents may carry more; unknown properties are ignored per
 * dspack conformance rules.
 */

export interface Contract {
  dspack: string;
  name: string;
  description?: string;
  tokens?: Record<string, { values?: Record<string, { value?: unknown }> }>;
  components?: Record<string, ContractComponent>;
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
export type RuleType = "component-choice" | "required-composition" | "forbidden-composition";

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
}

export type RuleEntry = ComponentChoiceRule | RequiredCompositionRule | ForbiddenCompositionRule | RuleBase;

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

export function getIntent(contract: Contract, intentId: string): IntentEntry {
  const intent = (contract.intents ?? []).find((i) => i.id === intentId);
  if (!intent) {
    const known = (contract.intents ?? []).map((i) => i.id).join(", ") || "(none)";
    throw new Error(`intent '${intentId}' is not registered in the contract (known: ${known})`);
  }
  return intent;
}
