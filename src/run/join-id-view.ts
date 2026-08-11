/**
 * Join-id schema view (P3a generation-quality mechanism, sibling of
 * casualtyFreeView).
 *
 * A profile-declared Collect JOIN pairs sub-component families by id
 * (`on: {left: self.id, right: self.id}` — tabs-trigger/tabs-content — or an
 * item id referenced by a counterpart key). The generation schema leaves `id`
 * optional on every node, so a model can omit the keys (keyless items) or
 * free-style a prefix convention (`trigger-x` / `content-x`) that the exact-
 * match join must refuse — both measured as the dominant join failure on the
 * Gateway corpus after Phase 2. This view makes `id` REQUIRED in the
 * generation schema for exactly the components whose join participation keys
 * on `self.id`, derived from the active profile.
 *
 * Run-layer on purpose: core stays profile-free. Only GENERATION sees the
 * tightened schema — S-gates and the contract are untouched (requiring a key
 * the emitter will demand is ambiguity removal, not governance change).
 */
import type { Profile } from "@aestheticfunction/dspack-emit";

type Json = Record<string, unknown>;

/** Component names whose collect/join participation keys on `self.id`. */
export function joinIdComponents(profile?: Profile): Set<string> {
  const out = new Set<string>();
  if (!profile) return out;
  const components = (profile as unknown as { components?: Array<Json> }).components ?? [];
  for (const plan of components) {
    const surface = (plan.surface ?? {}) as Json;
    const collects = (surface.collects ?? []) as Array<Json>;
    for (const collect of collects) {
      const join = collect.join as Json | undefined;
      if (!join) continue;
      const on = (join.on ?? {}) as { left?: string; right?: string };
      const item = (collect.item ?? {}) as Record<string, string>;
      const itemKeysOnId = on.left === "self.id" || Object.values(item).includes("self.id");
      if (itemKeysOnId) for (const name of (collect.of ?? []) as string[]) out.add(name);
      if (on.right === "self.id") for (const name of (join.with ?? []) as string[]) out.add(name);
    }
  }
  return out;
}

/**
 * The generation schema with `id` required on every unroll level's branch for
 * join-participating components. Returns the SAME schema object when the
 * profile declares no id-keyed joins (identity — digests and callers relying
 * on reference equality are unaffected).
 */
export function requireJoinIds(schema: Json, profile?: Profile): Json {
  const idComponents = joinIdComponents(profile);
  if (idComponents.size === 0) return schema;

  const defs = schema.$defs as Record<string, Json> | undefined;
  if (!defs) return schema;

  let changed = false;
  const nextDefs: Record<string, Json> = {};
  for (const [name, def] of Object.entries(defs)) {
    const anyOf = def.anyOf as Array<Json> | undefined;
    if (!anyOf) {
      nextDefs[name] = def;
      continue;
    }
    const nextAnyOf = anyOf.map((branch) => {
      const componentConst = ((branch.properties as Json | undefined)?.component as Json | undefined)?.const;
      if (typeof componentConst !== "string" || !idComponents.has(componentConst)) return branch;
      const required = (branch.required as string[] | undefined) ?? [];
      if (required.includes("id")) return branch;
      changed = true;
      return { ...branch, required: [...required, "id"] };
    });
    nextDefs[name] = nextAnyOf.some((b, i) => b !== anyOf[i]) ? { ...def, anyOf: nextAnyOf } : def;
  }
  return changed ? { ...schema, $defs: nextDefs } : schema;
}
