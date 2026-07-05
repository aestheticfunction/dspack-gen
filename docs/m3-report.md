# M3 report — the amendment arc, and governance-by-API-shape

**Thesis:** *A2UI defines what can render. dspack defines what is correct.* Milestone 1
proved the loop; Milestone 2 proved protocol neutrality and produced the first governance
numbers. Milestone 3 set out to do two things — close the projection gap those numbers
exposed, and prove the rule system outlives its birth contract — and ended up measuring
something neither goal predicted: what happens to "the enforcement layer" when the API
itself absorbs the thing being enforced.

**Tagged state:**
[dspack@m3](https://github.com/aestheticfunction/dspack/releases/tag/m3) ·
[dspack-emit@m3](https://github.com/aestheticfunction/dspack-emit/releases/tag/m3)
([`@aestheticfunction/dspack-emit@0.3.1`](https://www.npmjs.com/package/@aestheticfunction/dspack-emit)
on npm, registry shasum verified against the pack dry-run) ·
[dspack-gen@m3](https://github.com/aestheticfunction/dspack-gen/releases/tag/m3) ·
[ds-mcp@m3](https://github.com/aestheticfunction/ds-mcp/releases/tag/m3).
Every number below is computed from retained audit reports in `docs/evidence/` and is
recomputable; the headline count has a committed one-command verifier.

## What M3 shipped

- **dspack v0.4** (draft): the `required-props` rule type — *a component must carry named
  content directly* — and **component categories** (a contract-defined registry that
  `forbidden-composition` can select by, ending hand-enumerated descendant lists). Both
  lifted from v0.3's documented ceiling by measured evidence, not speculation.
- **The v0.4 amendment** (`textScope: subtree`, ∃-quantified `within`, and an **audited
  label lift** in the a2ui emitter): the correction the first live run of v0.4 forced,
  measured as a three-stage A/B below.
- **A second real contract**: a nine-component slice of Meta's
  [Astryx](https://github.com/facebook/astryx) (MIT, pinned v0.1.2), authored from the
  repository's own structured `*.doc.mjs` files with per-rule provenance quotes, run as a
  full eval column through the json-render target.
- **Harness**: the `failed-adapter` denominator split (pre-generation infrastructure vs.
  model observations, reclassifiable from retained reports), and a selectable emission
  target with per-run J2/J3 gates.
- **A closed question**: the hosted structured-outputs path, measured to its ceiling and
  closed (below).

## The amendment arc — the projection gap, closed the right way

M2 left one number above all others: **78/78** emitter-gate failures across three local
model families shared a single signature — a governance-clean surface whose trigger label
sat where the emitter's projection could not lift it
(verify: `python3 docs/evidence/verify-signature-78.py`). v0.4's `required-props` rule was
filed to convert that class from unrepairable post-emit refusals into repairable pre-emit
findings. The first live run showed the rule as authored was *stricter than the
projection it protected* — its ∀-semantics rejected 67 surfaces the emitter accepted —
and the amendment that followed was measured stage by stage, byte-identical prompts
throughout:

| | v0.3 baseline | v0.4 as shipped (∀) | amended rules only | **full amendment** |
|---|---|---|---|---|
| end-to-end passes | 28/216 | 0/216 | 49/216 | **67/216** |
| gate failures (signature) | 78 (78/78) | 0¹ | 32 (31) | **7 (0)** |
| gemma · qwen · gpt-oss e2e | 0 · 0 · 28 | 0 · 0 · 0 | 7 · 0 · 42 | **17 · 9 · 41** |

¹ zero gate failures bought with zero passes: the ∀ rule consumed everything upstream.

At the full amendment the signature is **extinct** — and extinct honestly. The emitter's
new lift is *relocation of existing text, audited per instance* (`surface-label-lifted`,
28 runs on record), never synthesis: surfaces with no label text anywhere still fail
governance, as they should. **All three families now pass live** — gemma's first passes
in any run arrived with the amended rules, qwen's with the lift — and the seven residual
gate failures decompose into two known, different classes (three emitter refusals of
stranded sub-components; four surfaces with no trigger at all — a contract-composition
hole filed as [dspack#16](https://github.com/aestheticfunction/dspack/issues/16), not
patched inside a findings cycle).

The transferable lesson, now written into the spec's amendment note: **a governance rule
should state exactly the precondition of the projection it protects — no stricter, no
looser.** Stricter requirements are their own rules with their own rationales.

## Finding B — governance-by-API-shape

The Astryx column was designed to test whether the rule system generalizes. It does — and
the most important result is what *didn't* happen. Three of the contract's six rules are
prop-presence rules converted verbatim from Meta's own guidance ("always provide a
label…"). Across 216 live runs, on prompts engineered to elicit the violations, **they
never fired once** — because Astryx's API is props-based: when the label *is* the prop,
models supply it. The rules are not mis-authored; a committed negative control
(`fixtures/golden/violating-astryx/`, golden-locked) proves each fires exactly as
specified on a genuinely violating surface. They are **pre-empted by the API's shape**.

Read against the shadcn arc, this is the milestone's reframing: the projection gap and
label governance — the problems that consumed most of M2 and M3 — are artifacts of
*compositional* APIs. Astryx internalized them at the type level (labels and dialog
content are required props), and its governance load concentrated onto the one genuinely
behavioral rule: **choice** (`destructive-requires-alertdialog`: 92 first-attempt
violations, 52 repaired — models pick the dismissible dialog for destructive flows in
every API style). The enforcement layer does not disappear under a well-shaped API; it
narrows to what no API shape can absorb.

**Scope, stated exactly:** this is one contract pair — shadcn/a2ui (compositional) vs.
Astryx/json-render (props-based) — with the emitter varying alongside the API style. Real,
measured, and not yet generalizable beyond n=1 pairs. The Astryx column ran json-render
only and by construction does not exercise the A2UI projection gap.

The column's own numbers: end-to-end 53/72 · 59/72 · 58/72 (gemma · qwen · gpt-oss),
repair success 54–63%, and **zero emitter-gate failures in 216 runs** — the
contract-generated-catalog pairing is lossless at scale, with its one documented casualty
(Astryx's data-driven array props) excluded loudly at catalog generation and never
reached by generated surfaces.

## The hosted question, closed with a ceiling measurement

The hosted structured-outputs column produced zero governance observations in M2 because
the generation schema's compiled grammar was rejected. M3 ran the pre-agreed probes
instead of a workaround: **every unroll depth from 6 to 1 is rejected — including 9 KB at
depth 1 — and the width control shows the ceiling admits roughly two components.** The
smallest honest destructive-action vocabulary already exceeds it, which closes not only
the matched-schema design but the vocabulary-pruning fallback
([#20](https://github.com/aestheticfunction/dspack-gen/issues/20), closed; scripts and
raw outputs in `docs/evidence/2026-07-04-hosted-probes/`). A differently-compiled
constrained path (forced tool-use schemas) is filed as
[#33](https://github.com/aestheticfunction/dspack-gen/issues/33), untested.

## The deconfound, superseded

M1 owed a repair-shape deconfound (≥2 rules per shape). M3 built the cross-contract
matrix and the answer dissolved the question: the same semantic rule repairs at **0/7 on
shadcn and 52/92 on Astryx** — between-contract variance on one rule exceeds every
between-shape difference observed. Substitution achieved its two distinct fired rules;
addition's Astryx analogs were pre-empted by the API (Finding B); restructuring had no
Astryx analog by construction. Verdict, per the pre-agreed reporting rule: the shape
hypothesis is **superseded, not resolved** — repair difficulty looks primarily
contract-idiom-dependent — and the powered design is filed as
[#34](https://github.com/aestheticfunction/dspack-gen/issues/34), not scheduled.

## The conversion census

Of ~104 structured `bestPractices` entries across the nine harvested Astryx components,
**six became machine-checkable rules** — all shipped, each with a verbatim provenance
quote. The misses are the useful part: max-cardinality ("no more than one primary button
per view"), ancestor requirements ("destructive variant needs a confirmation step"),
quality judgments, and runtime behavior — the first evidence-named contents of the next
ceiling, exactly the input v0.3 §9 said future rule types must be driven by.

## Honest scope

Two contracts, one intent each, three local model families, `runsPerCell` = 3 throughout;
per-family rates carry small n's and are reported as k/n in the findings. The hosted path
is closed at this API's ceiling, not proven impossible everywhere. Finding B is an n=1
contract-pair observation. The v0.4 spec remains a draft; its semantics freeze at
release, and the amendment is part of its draft history, recorded in the spec text.
Stage runs were dual-host (model digests byte-verified; one pre-0.31 Ollama server
rejected structured outputs loudly — a third face of the S0 engine-dependence finding —
and its partial reports were scrubbed before analysis, on the record in the findings).

## What's next

M4 is trigger-gated (A2UI v1.0 leaving Candidate status; ADR-5) and starts as its own
ADR-driven prompt when its trigger fires. Until then the backlog holds:
[dspack#16](https://github.com/aestheticfunction/dspack/issues/16) (trigger composition),
[#33](https://github.com/aestheticfunction/dspack-gen/issues/33) (tool-use constrained
path), [#34](https://github.com/aestheticfunction/dspack-gen/issues/34) (contract-idiom
repair study), and the M6 question now has its first concrete input: the census's
unenforceable-guidance classes exist, named and quoted — whether they are valuable enough
to justify a heuristic tier is a judgment the evidence can now inform but not make.
