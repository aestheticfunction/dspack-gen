/**
 * Gate S2 — contract vocabulary. A check on ANY produced surface (model
 * output, hand-authored, fixture), regardless of how generation was
 * constrained: the S0 spike caught Ollama's mlx engine silently ignoring
 * `format`, which is why S2 is never assumed from generation.
 *
 * Scope per spec §8: component/sub-component ids, prop names on components,
 * enum prop values, declared slot names, plus surface-level consistency
 * (registered intent, matching system name). Deliberately NOT checked:
 * acceptsChildren semantics, non-enum prop types, ordering.
 */
import { type Contract, type Surface, enumValues, subComponentIndex } from "../contract.js";
import { walkSurface } from "./walk.js";

export function checkVocabulary(surface: Surface, contract: Contract): string[] {
  const errors: string[] = [];
  const components = contract.components ?? {};
  const subIndex = subComponentIndex(contract);

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
  return errors;
}
