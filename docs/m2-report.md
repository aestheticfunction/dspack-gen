# M2 report — protocol neutrality, and the first governance numbers

**Thesis:** *A2UI defines what can render. dspack defines what is correct.* Milestone 1
built the smallest system that proves it end to end. Milestone 2 asked the two questions
that decide whether the design survives contact: **is the governance layer actually
protocol-neutral** (a second emitter, unchanged CSR), and **what do real models actually
do under it** (an eval harness with published rates, not anecdotes). Both answers are in,
and neither is the answer we would have written in advance.

**Tagged state:**
[dspack@m2](https://github.com/aestheticfunction/dspack/releases/tag/m2) ·
[dspack-emit@m2](https://github.com/aestheticfunction/dspack-emit/releases/tag/m2) ·
[dspack-gen@m2](https://github.com/aestheticfunction/dspack-gen/releases/tag/m2) ·
[ds-mcp@m2](https://github.com/aestheticfunction/ds-mcp/releases/tag/m2) ·
[`@aestheticfunction/dspack-emit@0.3.0` on npm](https://www.npmjs.com/package/@aestheticfunction/dspack-emit)
(the rename cycle: old package deprecated with a pointer, both consumers swapped, the
chain proven in CI against the published tarball).

## What M2 shipped

- **The json-render target** ([dspack-emit#9](https://github.com/aestheticfunction/dspack-emit/pull/9)):
  a second protocol emitter behind its own gates (J1 generated modules compile · J2
  `validateSpec` · J3 `catalog.validate`), consuming the same governed CSR the A2UI
  target consumes. The thesis test at its precise claim: governed CSRs are accepted by
  both emitters — no protocol-expressiveness-equivalence claim.
- **The eval harness** ([dspack-gen#12](https://github.com/aestheticfunction/dspack-gen/pull/12)):
  model × prompt × repair-template matrices with per-run audit reports as the unit of
  evidence, two failure classes that are never blended into a single "pass rate," a
  deterministic fake-matrix CI golden, and live runs that are documented, never CI-gating.
- **ds-mcp generation tools** (ds-mcp PR-11 series): `get-generation-context` /
  `validate-ui` — the agent-driven loop, `generate_ui` deliberately absent (the MCP host
  is the generator; ds-mcp stays no-network/read-only) — plus the repo's first CI.
- **Drift prevention** ([dspack-gen#7](https://github.com/aestheticfunction/dspack-gen/issues/7)
  closed): byte-match CI checks in every consumer repo against the spec repo's contract.

## Finding: emitter asymmetry (measured over exactly n=2 emitters, one contract)

The A2UI target needs a ~400-line hand-authored profile — per-component flattening
directives, documented casualties, synthesized primitives — because A2UI's component
vocabulary is fixed and shape-mismatched with the contract's. The json-render target's
profile is near-empty, because its catalog is *generated from the contract*: every
component 1:1, compound composition surviving as real nesting, enum values verbatim.

Projection lossiness lived in the **pairing** — fixed-vocabulary protocol vs.
contract-generated catalog — not in the CSR and not in the emission engine. No claim
beyond the two targets measured; it is, however, exactly the shape of result the
protocol-neutral CSR design predicts, and it matters again below.

## The eval: three local model families, one governed contract

The [findings doc](findings.md) carries the full analysis; every rate is computed from
retained audit reports (evidence directories linked there), shown as k/n, never rounded
away. Contract: shadcn v0.3; 12 prompts × 2 repair templates × 3 runs per model.

| model | n | schema-valid | 1st-attempt S3 violation | repair success | exhausted (S3) | gate-failed (A-gate) | **end-to-end pass** |
|---|---|---|---|---|---|---|---|
| `gemma4:e4b` | 72 | 72/72 | 32/72 | 3/32 | 29/72 | 43/72 | **0/72** |
| `qwen3.6:35b` | 72 | 71/72¹ | 63/72 | 9/63 | 54/72 | 17/72 | **0/72** |
| `gpt-oss:latest` | 72 | 72/72 | 41/72 | 15/41 | 26/72 | 18/72 | **28/72** |
| `claude-sonnet-5` (hosted) | 72 | — blocked pre-generation, see below — | | | | | — |

¹ one genuine adapter failure: empty output after 12.3 minutes — a model observation,
not infrastructure.

Three results, in the order they surprised us:

### 1. The projection gap is the entire gate-failure story — across model families

Every one of the 60 gate failures in the first two families (43 gemma + 17 qwen) shares
one signature: a **governance-clean surface whose trigger-button label sits where the
A2UI emitter's documented projection cannot lift it** (`alert-dialog-trigger > button >
badge{text}`), so the emitted instance misses an A3-required prop and the gate refuses
it. Not on the deliberate probes — on ordinary prompts. The third family run
(gpt-oss, the addendum in the findings doc) extends it: **18/18 of its gate
failures carry the identical signature** (10 on ordinary prompts), making it
**78/78 across three model families**. And gpt-oss sharpens the claim: this is
the family that otherwise *passes* — even where generation and repair succeed,
the only remaining downstream failure is the one S3 cannot express.

S3 accepts these surfaces because no rule requires a trigger to carry its label as
direct text. The rule *can't be written* in v0.3's three rule types. That is a
measured expressiveness gap with a named fix — see M3 below.

### 2. Pass rates are model-specific; the governance floor is not one number

The first two families produced **zero end-to-end passes in 144 runs** — by different
routes (gemma dominated by gate failures, qwen by governance exhaustion at an 88%
first-attempt violation rate). The third family broke the pattern: **gpt-oss passed
end to end 28/72 — the pipeline's first live passes**, exercising the full success
path (S1–S3, bounded repair, A1–A3, audit report `passed`) outside the deterministic
CI gate for the first time. The spread across three families — **0/72 · 0/72 ·
28/72** — is the point. The honest generalization is narrow: these are rates for these
model tags against this contract — but the spread itself is the finding. A governance
layer that reports per-model rates is measuring something real; a benchmark that
averaged them would be hiding it.

### 3. Repair is weak everywhere measured, and one n=1 got answered

Repair success: gemma 3/32, qwen 9/63, gpt-oss 15/41 (the outlier, driven almost
entirely by one rule the other families almost never repaired). The M1 recording's on-camera
repair of `rule.button-no-interactive-descendants` (n=1) did **not** replicate: 0/6 on
the exact prompt/model pair. The repair-shape hypothesis (restructuring-shaped repairs
succeed less) remains **unanswerable from this matrix** — each shape is exercised by
essentially one rule, so shape and rule identity are confounded. The deconfound (≥2
rules per shape) is scheduled, not claimed. The repair-template A/B was null at this n.

## The infrastructure pair: independent gates, proven from both directions

Two findings about the *path*, not the models — and together they are the strongest
argument M2 produced for the independent-gates design:

- **Local (M1, held):** Ollama's mlx engine silently ignores `format` — no error,
  unconstrained output ([ollama/ollama#17013](https://github.com/ollama/ollama/issues/17013)).
  If S1/S2 were assumptions about generation instead of gates over the artifact, every
  mlx run would have been reported as schema-constrained when it wasn't.
- **Hosted (M2, new):** all 72 hosted runs failed **pre-generation** with `400: compiled
  grammar too large` — the depth-6, full-vocabulary generation schema exceeds the
  hosted structured-outputs ceiling. The hosted column is **unmeasured, not 0%**: the
  model never ran. The obvious fix (prune the schema for the hosted column) would
  change the generation context and confound model with schema — so it is filed as a
  designed experiment ([dspack-gen#20](https://github.com/aestheticfunction/dspack-gen/issues/20)),
  not patched silently.

One engine lies about constraints; one refuses them outright. A pipeline that trusts
its generation layer would have shipped both as data.

Harness hardening bought with those failures, in-cycle: per-run crash containment with
typed transport errors (#15), emitter refusal reclassified as a failed-gate outcome —
found live by #15's containment (#16), and transport timeout ceilings raised after the
undici default killed long 35B generations (#17).

## Honest scope

One contract, one intent, three local model families, a blocked hosted path. Small n's
(3 runs per cell), shown as k/n throughout. The live success path is exercised by
exactly one family (gpt-oss); the fake-adapter CI gate remains the deterministic
end-to-end demonstration. Failure classes are never blended; failures are named in the
report's own vocabulary (`failed-lint-exhausted`, `failed-gate`, `failed-adapter`).
Nothing here claims "local models can't do governed generation" — it claims these tags,
this contract, these rates.

## What's next (M3)

M3's sentence: **dspack v0.4 turns the eval's unrepairable projection-gap failures into
repairable governance findings, and proves the rule system outlives its birth contract
by governing a second real design system.**

- **`required-props` (v0.4):** the rule S3 couldn't express — *a component must carry
  its label as direct text* — becomes the fourth typed rule. The measured prediction:
  the trigger-label gate-failure signature converts from post-emit refusal
  (unrepairable) to pre-emit S3 finding (repairable). Category metadata ships in the
  same revision (contract-defined categories; `forbiddenCategories`), so rules like
  "no interactive descendants" stop hand-enumerating component ids.
- **A second real contract: [Astryx](https://github.com/facebook/astryx).** Meta's
  open-source design system (MIT, 160+ components, Beta) is explicitly
  guidance-over-enforcement — *"design opinions live in docs and examples; if you pass
  a value, the component renders it"* — and ships a CLI and MCP server so agents can
  discover what exists. The layer that checks what agents *build* with it is exactly
  the layer dspack adds: M3 authors a pinned ~15-component Astryx contract, converting
  its prose guidance into machine-checkable rules (through the json-render target,
  whose contract-generated catalog is the asymmetry finding's good side; the A2UI
  projection-gap work above is tested on the shadcn column, not on Astryx).
- **The matched-schema hosted design** (#20): the grammar ceiling gets a measured
  answer — probe the ceiling, measure real surface depths, run every column on one
  identical schema or escalate with the numbers. No hosted governance number is
  reported until the columns are comparable.
