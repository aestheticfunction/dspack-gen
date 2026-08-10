/**
 * Casualty-free generation view (Phase-2 representability mechanism, part 2).
 *
 * A profile's `casualtyComponents` are contract components the active emit
 * target cannot represent — the emitter refuses them by design. Compiling the
 * generation context from the FULL contract steers the model straight into
 * those refusals: the casualty sits in the system-prompt vocabulary, in the
 * generation schema, and (worst) in few-shot examples the model is told to
 * imitate. This view removes them from what GENERATION sees, and nothing else.
 *
 * Run-layer on purpose: `core` stays protocol-neutral and profile-unaware.
 * The caller (orchestrator) uses the view ONLY for compileContext — the
 * S-gates (lintSurface) and the report's contract digest keep the ratified
 * original, so governance and report identity never vary with the profile.
 */
import type { Profile } from "@aestheticfunction/dspack-emit";
import type { Contract, ExampleEntry } from "../core/contract.js";

/**
 * The contract minus the profile's declared casualties: casualty component
 * entries are dropped, and every example whose surface tree uses a casualty
 * is dropped with them (a few-shot exemplar of a refused component is a
 * steering bug, not a teaching aid). Shallow-copied; the original contract is
 * never mutated. Without a profile — or with no declared casualties — the
 * SAME contract object is returned, so identity checks and digests are
 * trivially unaffected.
 */
export function casualtyFreeView(contract: Contract, profile?: Profile): Contract {
  const casualtyIds = new Set((profile?.casualtyComponents ?? []).map((c) => c.dspackId));
  if (casualtyIds.size === 0) return contract;

  const view: Contract = { ...contract };
  if (contract.components) {
    view.components = Object.fromEntries(
      Object.entries(contract.components).filter(([id]) => !casualtyIds.has(id)),
    );
  }
  if (contract.examples) {
    view.examples = contract.examples.filter((example: ExampleEntry) => !usesCasualty(example.surface, casualtyIds));
  }
  return view;
}

/** Walk any object/array shape for a node with `component` ∈ casualtyIds. */
function usesCasualty(value: unknown, casualtyIds: Set<string>): boolean {
  if (Array.isArray(value)) return value.some((entry) => usesCasualty(entry, casualtyIds));
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.component === "string" && casualtyIds.has(record.component)) return true;
    return Object.values(record).some((entry) => usesCasualty(entry, casualtyIds));
  }
  return false;
}
