/**
 * Per-contract generation schema: the JSON Schema handed to constrained
 * decoding (Ollama `format`, hosted output schemas).
 *
 * Derivation from the contract: full component + sub-component vocabulary as
 * anyOf branches, per-component prop enums, `intent`/`system`/`dspackSurface`
 * as consts, and recursion depth-unrolled ($defs node_0..node_{D-1}; the last
 * level is a leaf) so the schema is non-recursive by construction. Default
 * depth 6 was confirmed by the S0 spike (docs/spike-structured-outputs.md):
 * depths 3–8 compile and are enforced on grammar-backed engines.
 *
 * The three layers, deliberately: this schema encodes vocabulary and shape
 * ONLY — never governance. Encoding rules here would make violations
 * unobservable and the audit trail vacuous. Gate S2 is *defined* as a check on
 * the produced surface; this schema may be reused to implement it, but S2 is
 * always reported independently.
 *
 * Spike-inherited simplifications (documented): children accept the full
 * vocabulary at every level (per-parent child constraints are S3 territory),
 * `text` is allowed on every node, and `slots` are not generated (composition
 * is expressed via children; the surface schema still accepts slots on
 * hand-authored surfaces).
 */
import { type Contract, type ContractComponent, enumValues } from "./contract.js";

export const DEFAULT_UNROLL_DEPTH = 6;

export interface GenerationSchemaOptions {
  /** Levels of tree nesting the schema admits. S0-confirmed default: 6. */
  depth?: number;
}

type Json = Record<string, unknown>;

export function buildGenerationSchema(
  contract: Contract,
  intentId: string,
  options: GenerationSchemaOptions = {},
): Json {
  const depth = options.depth ?? DEFAULT_UNROLL_DEPTH;
  if (!Number.isInteger(depth) || depth < 1) throw new Error(`invalid unroll depth ${depth}`);

  const components = contract.components ?? {};
  const $defs: Json = {};
  for (let level = 0; level < depth; level++) {
    const branches: Json[] = [];
    for (const [id, component] of Object.entries(components)) {
      branches.push(branch(id, componentProps(component), level, depth));
      for (const sub of component.composition?.subComponents ?? []) {
        branches.push(branch(sub.id, null, level, depth));
      }
    }
    $defs[`node_${level}`] = { anyOf: branches };
  }

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["dspackSurface", "system", "intent", "root"],
    properties: {
      dspackSurface: { const: "0.1" },
      system: { const: contract.name },
      intent: { const: intentId },
      root: { $ref: "#/$defs/node_0" },
    },
    $defs,
  };
}

function componentProps(component: ContractComponent): Json | null {
  const entries = Object.entries(component.props ?? {});
  if (entries.length === 0) return null;
  const properties: Json = {};
  for (const [name, descriptor] of entries) {
    const values = enumValues(descriptor);
    properties[name] = values
      ? { enum: values }
      : descriptor.type === "boolean"
        ? { type: "boolean" }
        : descriptor.type === "number"
          ? { type: "number" }
          : { type: "string" };
  }
  return { type: "object", additionalProperties: false, properties };
}

function branch(id: string, props: Json | null, level: number, depth: number): Json {
  const properties: Json = {
    component: { const: id },
    id: { type: "string" },
    text: { type: "string" },
  };
  if (props) properties.props = props;
  if (level < depth - 1) {
    properties.children = { type: "array", items: { $ref: `#/$defs/node_${level + 1}` } };
  }
  return { type: "object", additionalProperties: false, required: ["component"], properties };
}
