#!/usr/bin/env node
/**
 * S0 spike: hand-written approximation of the per-contract generation schema
 * that the PR-3 prompt compiler will derive.
 *
 * Derivation (from a dspack v0.3 contract):
 *  - full component + sub-component vocabulary as anyOf branches
 *  - per-component props with enum values enforced (bare values and
 *    valueDescriptor objects both supported)
 *  - `intent` as a const; dspackSurface/system consts
 *  - recursion depth-unrolled: $defs node_0..node_{D-1}, node_{D-1} is a leaf
 *    (no children/slots), so the schema is non-recursive by construction
 *
 * Deliberate spike simplifications (recorded in the findings note):
 *  - children accept the full vocabulary at every level (no per-parent child
 *    constraints; that is PR-3/S2 territory)
 *  - `text` is allowed on every node (acceptsChildren semantics not modeled)
 *  - `slots` are omitted; composition is expressed via children only
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , contractPath, depthArg, outPath] = process.argv;
if (!contractPath || !depthArg) {
  console.error("usage: build-generation-schema.mjs <contract.dspack.json> <depth> [out.json]");
  process.exit(1);
}
const DEPTH = Number(depthArg);
const contract = JSON.parse(readFileSync(contractPath, "utf8"));
const intent = contract.intents?.[0]?.id ?? "destructive-action";

function propSchema(descriptor) {
  if (descriptor.type === "enum" && Array.isArray(descriptor.values)) {
    return { enum: descriptor.values.map((v) => (v && typeof v === "object" ? v.value : v)) };
  }
  if (descriptor.type === "boolean") return { type: "boolean" };
  if (descriptor.type === "number") return { type: "number" };
  return { type: "string" };
}

const componentIds = Object.keys(contract.components ?? {});
const subIds = [];
for (const entry of Object.values(contract.components ?? {})) {
  for (const sub of entry.composition?.subComponents ?? []) subIds.push(sub.id);
}

function branch(id, props, level) {
  const properties = { component: { const: id }, id: { type: "string" }, text: { type: "string" } };
  if (props && Object.keys(props).length > 0) {
    properties.props = {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(Object.entries(props).map(([k, d]) => [k, propSchema(d)])),
    };
  }
  if (level < DEPTH - 1) {
    properties.children = { type: "array", items: { $ref: `#/$defs/node_${level + 1}` } };
  }
  return { type: "object", additionalProperties: false, required: ["component"], properties };
}

const $defs = {};
for (let level = 0; level < DEPTH; level++) {
  $defs[`node_${level}`] = {
    anyOf: [
      ...componentIds.map((id) => branch(id, contract.components[id].props, level)),
      ...subIds.map((id) => branch(id, null, level)),
    ],
  };
}

const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["dspackSurface", "system", "intent", "root"],
  properties: {
    dspackSurface: { const: "0.1" },
    system: { const: contract.name },
    intent: { const: intent },
    root: { $ref: "#/$defs/node_0" },
  },
  $defs,
};

const json = JSON.stringify(schema);
if (outPath) writeFileSync(outPath, json);
else process.stdout.write(json);
console.error(
  `generation schema: depth=${DEPTH} vocabulary=${componentIds.length}+${subIds.length} bytes=${json.length}`,
);
