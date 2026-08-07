/**
 * Gate S2 — contract vocabulary. A check on ANY produced surface (model
 * output, hand-authored, fixture), regardless of how generation was
 * constrained: the S0 spike caught Ollama's mlx engine silently ignoring
 * `format`, which is why S2 is never assumed from generation.
 *
 * Scope per spec v0.3 §8 + the v0.4 §5.1 amendment: component/sub-component
 * ids, prop names on components, enum prop values, declared slot names,
 * surface-level consistency (registered intent, matching system name), and
 * sub-component CONTAINMENT — a sub-declared id may appear only within the
 * subtree of an instance of a declaring compound, unless the contract also
 * declares the id as a top-level component (independently usable).
 * Ownership comes only from composition.subComponents; it is never inferred
 * from names, prefixes, adjacency, or examples. Deliberately NOT checked:
 * acceptsChildren semantics, non-enum prop types, ordering (containment is
 * ownership, not order).
 */
import { type Contract, type Surface, type SurfaceNode, duplicateSubComponentIds, enumValues, subComponentIndex } from "../contract.js";
import { walkSurface } from "./walk.js";

export function checkVocabulary(surface: Surface, contract: Contract): string[] {
  const errors: string[] = [];
  const components = contract.components ?? {};
  const subIndex = subComponentIndex(contract);

  // Ambiguous vocabulary fails loudly before any id-dependent check — S2 and
  // rule resolution must never depend on object iteration order (mirrors the
  // dspack validate harness; spec v0.3 §5).
  for (const [id, declaredBy] of duplicateSubComponentIds(contract)) {
    errors.push(
      `contract: sub-component id '${id}' is declared by multiple components (${declaredBy.join(", ")}); ` +
        `sub-component ids must be unique document-wide for deterministic S2 and rule resolution`,
    );
  }

  if (surface.system !== contract.name) {
    errors.push(`$.system: surface.system '${surface.system}' does not match contract name '${contract.name}'`);
  }
  if (!(contract.intents ?? []).some((i) => i.id === surface.intent)) {
    errors.push(`$.intent: intent '${surface.intent}' is not registered in the contract`);
  }

  for (const { node, path } of walkSurface(surface)) {
    const isComponent = node.component in components;
    const isSub = subIndex.has(node.component);
    if (!isComponent && !isSub) {
      errors.push(`${path}: component '${node.component}' is not a component or sub-component of the contract`);
      continue;
    }
    if (node.props && Object.keys(node.props).length > 0) {
      if (isSub) {
        errors.push(`${path}: sub-component '${node.component}' does not declare props in this contract`);
      } else {
        const declared = components[node.component].props ?? {};
        for (const [name, value] of Object.entries(node.props)) {
          const descriptor = declared[name];
          if (!descriptor) {
            errors.push(`${path}: prop '${name}' is not declared on component '${node.component}'`);
            continue;
          }
          const allowed = enumValues(descriptor);
          if (allowed && !allowed.includes(value)) {
            errors.push(
              `${path}: prop '${name}' on '${node.component}' has value ${JSON.stringify(value)}; allowed: ${allowed
                .map((v) => JSON.stringify(v))
                .join(", ")}`,
            );
          }
        }
      }
    }
    if (node.slots && isComponent) {
      const declaredSlots = new Set(
        (components[node.component].composition?.subComponents ?? [])
          .map((s) => s.slot)
          .filter((s): s is string => Boolean(s)),
      );
      for (const slot of Object.keys(node.slots)) {
        if (!declaredSlots.has(slot)) {
          errors.push(`${path}: slot '${slot}' is not declared on component '${node.component}'`);
        }
      }
    }
  }

  // Containment (spec v0.4 §5.1): every sub-declared id needs a declaring
  // compound among its ANCESTORS (any depth — intermediate structure is
  // fine; parent-only would be a different, stricter rule). Owners are the
  // full declaration set (exactly one today, since duplicate sub ids refuse
  // above; the set form is the spec's, not a behavior). An id that is also
  // a top-level component is a component everywhere and exempt. The
  // ancestor-carrying walk mirrors walkSurface exactly (children + slots).
  const owners = new Map<string, string[]>();
  for (const [id, component] of Object.entries(components)) {
    for (const sub of component.composition?.subComponents ?? []) {
      owners.set(sub.id, [...(owners.get(sub.id) ?? []), id]);
    }
  }
  const containment = (node: SurfaceNode, path: string, ancestors: ReadonlySet<string>): void => {
    const id = node.component;
    const declaredBy = owners.get(id);
    if (declaredBy && !(id in components) && !declaredBy.some((owner) => ancestors.has(owner))) {
      const ownerList = declaredBy.map((o) => `'${o}'`).join(" or ");
      errors.push(
        `${path}: sub-component '${id}' of ${ownerList} appears outside any ${ownerList} subtree — ` +
          `a declared sub-component is only valid within its declaring compound (declare '${id}' as a top-level ` +
          `component if it is independently usable)`,
      );
    }
    const next = new Set(ancestors);
    next.add(id);
    (node.children ?? []).forEach((child, i) => containment(child, `${path}.children[${i}]`, next));
    for (const slot of Object.keys(node.slots ?? {}).sort()) {
      node.slots![slot].forEach((child, i) => containment(child, `${path}.slots.${slot}[${i}]`, next));
    }
  };
  containment(surface.root, "$.root", new Set());

  return errors;
}
