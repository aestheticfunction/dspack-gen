# Eval findings — 2026-07-03 rerun

> *Addendum (2026-07-03, later the same day): a **third local family**
> (`ollama:gpt-oss:latest`) was run on the identical matrix after this document
> merged — see [the addendum](#addendum--third-local-family-gpt-oss-2026-07-03)
> at the end. Headline updates: the projection-gap signature extends to
> **78/78** gate failures across three families, and the third family produced
> the pipeline's **first live end-to-end passes** (28/72), so "zero end-to-end
> passes" is a two-family result, not a local-model result. The body below is
> unchanged (it was written from the two-family run and merged as reviewed).*

Written from the aggregated results of the 2026-07-03 rerun; every rate below
is computed from the 216 retained audit reports in
[`docs/evidence/2026-07-03-eval-rerun/`](evidence/2026-07-03-eval-rerun/)
(matrix config, `results.json`, `report.md`, and all per-run reports), and
every claim is checkable against them. Contract: shadcn v0.3, sha
`4c86ba94…`. Repair templates crossed: `standard`, `permit-restructuring`.
`runsPerCell` = 3; 12 prompts × 2 templates × 3 runs = 72 runs per model.

## Scope up front (read before the numbers)

**This is a two-model governance study, not three.** The hosted model
(`anthropic:claude-sonnet-5`) produced **zero governance observations**: all
72 hosted runs failed *before generation* with an identical API error —

> `400 invalid_request_error: The compiled grammar is too large, which would
> cause performance issues. Simplify your tool schemas…`

The depth-6-unrolled, full-shadcn-vocabulary generation schema exceeds the
Anthropic structured-outputs grammar-size ceiling. This is the hosted twin
of the S0 Ollama/mlx finding — a real, reportable fact about the *hosted
path*, not about the model's behavior (the request was well-formed; a 400,
not an auth failure; the model never ran). **The local-model-floor-vs-hosted
comparison the matrix was designed for is therefore not answered by this
run.** See "The hosted path is blocked" below.

The two local models (`gemma4:e4b`, `qwen3.6:35b`) produced **144 real
observations** and are the basis for everything else here.

## Raw distribution

Governance behavior, local models (n = 72 each). The two failure classes —
**governance exhaustion** (the repair loop could not reach an S3-clean
surface) and **projection-gap gate failure** (an S3-clean surface the A2UI
emitter could not turn into a valid instance) — are reported separately and
never blended into a single "pass rate."

| model | n | S1 schema-valid | 1st-attempt S3 violation | repair success | **exhausted** (S3) | **gate-failed** (A-gate) | genuine adapter-fail | **end-to-end pass** |
|---|---|---|---|---|---|---|---|---|
| `gemma4:e4b` | 72 | 72/72 (100%) | 32/72 (44%) | 3/32 (9%) | 29/72 | 43/72 | 0 | **0/72** |
| `qwen3.6:35b` | 72 | 71/72 (99%)¹ | 63/72 (88%) | 9/63 (14%) | 54/72 | 17/72 | 1/72¹ | **0/72** |
| `anthropic:claude-sonnet-5` | 72 | — | — | — | — | — | 72/72² | — |

¹ qwen's one non-schema-valid run is a *genuine* `failed-adapter`: after
12.3 minutes the model returned **empty output** (a real model observation,
not infrastructure — the request completed). Every other qwen generation was
schema-valid.
² All 72 hosted `failed-adapter`s are the pre-generation schema rejection
above — infrastructure, not model behavior; the dashes are "unmeasured," not
"0%."

**Zero end-to-end passes in 144 local runs.** Both local models fail against
this contract, but by different routes: gemma is dominated by projection-gap
gate failures (43) with moderate governance violation (44%); qwen is
dominated by governance exhaustion (54) with a very high first-attempt
violation rate (88%). "Both local models fail" is the honest headline; the
*shape* of the failure is model-specific and is the interesting part.

## Finding 1 — the ADR-D1 projection gap is the whole gate-failure story, cross-model

**Every one of the 60 local gate failures (43 gemma + 17 qwen) shares one
signature:** a governance-clean surface whose trigger-button label sits
where the emitter's documented projection cannot lift it, so the emitted
`AlertDialog` is missing A3-required props (`child`/`triggerLabel`) and gate
A3 refuses it. Concretely, the recurring shape is a trigger button whose
label is a *nested* `badge` child rather than direct button text:

```
alert-dialog-trigger > button > badge{ text: "Delete" }
```

S3 accepts this (the trigger button exists; no rule requires it to carry its
label as direct text), and the emitter's `subButtonText` projection only
lifts a label-bearing component's own text — so `triggerLabel` is never
populated and A3 rejects the instance. This is the same gap the M1 recordings
caught twice (take-2 text-absence; the gemma candidate text-placement pair),
now measured: **60/60 gate failures, across two different model families, on
ordinary prompts** — not only on the deliberate ADR-D1 probes (p10–p12).

At measured strength: for this contract and these two local models, the A2UI
projection gap is not an occasional edge — it is *the* reason governed
surfaces fail downstream. The filed remedies are unchanged and now have a
rate behind them: the v0.4 `requiredProps`-style refinement (require the
sub-component to carry its text directly) and the category-metadata rule form
(ADR-D1). The emitter-refusal class added in this cycle (a sub-component
emitted standalone → typed refusal → `failed-gate`) is the same family's
third face; qwen produced it transiently during the run (recorded in the
retried `.error.json` history), and it reclassifies to `failed-gate` under
the fix that landed mid-run.

## Finding 2 — repair success is low, and the repair-shape reading is confounded

Repair success (an S3-clean surface reached within `maxRepairs`, over
first-attempt-violating runs):

| shape (1 rule each) | gemma | qwen |
|---|---|---|
| substitution | 0/5 | 5/24 |
| addition | 0/2 | 1/14 |
| deletion | 2/10 | 3/11 |
| restructuring | 1/15 | 0/14 |

The repair-shape hypothesis (removal/restructuring-shaped repairs succeed
less often than substitution/addition) is **not answerable from this matrix**
and the numbers above are only *consistent with* — not confirmatory of — it.
The confound is structural: each repair shape is exercised by essentially
**one rule** (substitution ≈ `destructive-requires-alertdialog`, deletion ≈
`button-no-interactive-descendants`, etc.), so "shape effect" and "rule
identity effect" are inseparable here. **The deconfound is still owed:** the
next matrix iteration needs ≥2 rules per shape (likely arriving with the v0.4
rule additions and/or the second contract). Reported as an open design
requirement, not a result.

The repair-template A/B (`standard` vs `permit-restructuring`, the
one-instruction-line delta) shows **no clear effect** at this n: gemma
standard 2/14 vs permit 1/18; qwen standard 4/29 vs permit 5/34. No claim
either way.

## Finding 3 — the take-2 repair did not replicate (n=1 question answered)

The M1 take-2 recording showed `rule.button-no-interactive-descendants`
repairing on the first attempt (n=1). This run put that exact prompt
(`p01-delete-account`, qwen) through 6 runs: **0/6 reached an S3-clean
surface** — all 6 exhausted. The on-camera success was non-deterministic, not
a reliable behavior; the 11/11-non-convergence A/B result from M1 is the
better predictor, and this run is consistent with it. `button-no-interactive-descendants`
is the dominant first-attempt violation for both models (gemma 26, qwen 49)
and the least repairable.

## The hosted path is blocked (not a governance result)

The hosted column cannot be reported as governance data because the schema
never compiled. Two things follow, both honest:

1. **It is not a trivial fix, and the obvious fix breaks the experiment.**
   Reducing the schema (vocabulary pruning per intent, or lower unroll depth)
   would let the hosted grammar compile — but it would make the hosted column
   run against a *different* generation schema than the local columns, so any
   cross-model comparison would confound "model" with "schema." This is the
   vocabulary confound in its sharpest form: you cannot separate "the hosted
   model complies better" from "the hosted model saw a smaller/easier schema"
   without a matched-schema design. That design is M3/PR-10-followup work, not
   a same-day patch.
2. **A harness classification gap is now visible.** A pre-generation
   `failed-adapter` (transport reject, schema reject — zero attempts) is
   infrastructure and should be excluded from model-behavior denominators
   exactly like a contained `error` run; today it is counted, which is why
   the hosted `byModel` row reads "0%" everywhere in `results.json`. Those
   zeros are meaningless and are shown as dashes above. Splitting
   `failed-adapter` into "no-generation (infrastructure)" vs "generation-then-
   bad-output (model)" is a small follow-up; noted, not silently patched.

## What this changes for M3 / v0.4 (input, not decision)

- **The ADR-D1 `requiredProps` refinement is the v0.4 headline candidate on
  the strength of this run** — 60/60 cross-model, two families, ordinary
  prompts — but the evidence is two *local* models; the hosted path is
  unmeasured, so "cross-model" means "cross-local-model" until the hosted
  schema-size problem is solved. Category metadata evaluated in the same
  revision (ADR-D1).
- **The hosted schema-size ceiling is a new, filed constraint** (parallel to
  the S0 mlx finding): the depth-6 full-vocabulary schema is too large for
  Anthropic structured outputs. Resolving it — matched-schema design, or a
  per-intent vocabulary projection with an explicit honesty note (Open
  Question 5) — is prerequisite to any hosted governance number.
- **The repair-shape deconfound (≥2 rules per shape) is owed** before any
  repair-shape claim can move from "consistent with" to "confirms."
- **Against this backdrop the Astryx second contract (ADR-D5) and a v0.4 that
  fixes the projection gap are naturally one milestone:** a contract that
  exercises the gap plus the refinement that closes it.

## Honest limits

One contract, one intent, two local models, a blocked hosted path.
`runsPerCell` = 3 (rates carry small n's — every fraction above is shown as
k/n, not rounded away). Zero end-to-end passes means the pipeline's
*success* path is unexercised by live local models here — the fake-adapter
CI gate is the only place a clean pass is demonstrated end to end. Nothing
here is a claim about "local models" in general; it is about these two tags
against this contract. Failure is attributed with the report's own
vocabulary throughout, and the two failure classes are never blended.

## Addendum — third local family (gpt-oss), 2026-07-03

Run after the two-family body above merged (M3 plan, Phase 0 item E0;
maintainer-directed so the M2 write-up ships as a three-local-family result).
Same matrix, byte-identical prompts, same contract sha, same
`runsPerCell` = 3: 72 runs of `ollama:gpt-oss:latest` (GGUF/llama.cpp engine).
Evidence: [`docs/evidence/2026-07-03-gptoss-third-family/`](evidence/2026-07-03-gptoss-third-family/)
(matrix config, `results.json`, `report.md`, 72 retained reports; zero
contained errors, zero adapter failures).

| model | n | S1 schema-valid | 1st-attempt S3 violation | repair success | **exhausted** (S3) | **gate-failed** (A-gate) | **end-to-end pass** |
|---|---|---|---|---|---|---|---|
| `gpt-oss:latest` | 72 | 72/72 (100%) | 41/72 (57%) | 15/41 (37%) | 26/72 | 18/72 | **28/72 (39%)** |

Three updates to the body's claims, each at measured strength:

1. **Finding 1 extends: the projection-gap signature is now 78/78 across three
   families.** Every one of gpt-oss's 18 gate failures carries the identical
   trigger-label signature (checked against all 18 reports: the emitted
   instance misses A3-required `child`/`triggerLabel`); 10 of the 18 are on
   ordinary prompts, 8 on the deliberate probes (p12 textless-trigger 6/6,
   p10 and p11 one each). Combined with the body: **43 + 17 + 18 = 78/78 gate
   failures, three model families, one signature.** gpt-oss sharpens the
   claim rather than merely repeating it: this is the family that otherwise
   *passes* — even where generation and repair succeed, the only remaining
   downstream failure is the gap S3 cannot express. The v0.4 `required-props`
   case gets stronger, not weaker, from a model that can comply.
2. **"Zero end-to-end passes" was a two-family result.** gpt-oss produced
   **28/72 live end-to-end passes — the pipeline's first**, exercising the
   success path (S1–S3, repair, A1–A3, audit report `passed`) live rather
   than only via the fake-adapter CI gate. The spread across families —
   0/72 · 0/72 · 28/72 — is itself the finding: governance floors are
   model-specific, and a per-model report is measuring something an average
   would hide. The body's "honest limits" line about the unexercised success
   path is superseded for this family.
3. **Repair looks different here, and the confound stands.** Repair success
   15/41 (37%) vs gemma 3/32, qwen 9/63 — driven almost entirely by
   `rule.button-no-interactive-descendants` (15/33 repaired, the rule the
   other two families almost never repaired). Per shape (still **one rule per
   shape** — the body's confound applies unchanged): substitution 2/8,
   addition 3/6, deletion 9/12, restructuring 1/15. Restructuring is again
   the weakest, consistent with — and still not confirmatory of — the
   repair-shape hypothesis; the ≥2-rules-per-shape deconfound remains owed.
   Repair-template A/B remains null at this n (standard 6/18 vs
   permit-restructuring 9/23).

Unchanged by this addendum: the hosted column remains blocked (not attempted
here); Finding 3 (take-2 non-replication) was qwen-specific and was not
re-tested; per-rule first-attempt violation ordering matches the body's
(`button-no-interactive-descendants` dominant: 33 of gpt-oss's 46 rule
findings). Honest limits as in the body: one contract, one intent, small
per-cell n, rates as k/n; this is about this tag against this contract.

## Addendum — the v0.4-effect rerun, 2026-07-04 (PR-15)

The same 12-prompt × 2-template × 3-run matrix, byte-identical prompts, three
local families, against the **v0.4 shadcn contract** (2.1.0: `required-props`
`rule.trigger-carries-label`, category-based
`rule.alertdialog-no-nested-overlays`). The contract revision is the measured
variable — the generation context necessarily changes with it (two more rules
in steering), so this run is compared to the 2026-07-03 v0.3 run as a
contract-level A/B, not a controlled single-variable prompt experiment.
Evidence: [`docs/evidence/2026-07-04-v04-effect/`](evidence/2026-07-04-v04-effect/)
(matrix, `results.json`, `report.md`, 216 retained reports, and the
decomposition script + output the numbers below are checkable against).

| model | n | 1st-attempt S3 violation | repair to clean | exhausted | **gate-failed** (was) | e2e pass (was) | genuine adapter-fail |
|---|---|---|---|---|---|---|---|
| `gemma4:e4b` | 72 | 72/72 | 0 | 72/72 | **0** (43) | 0 (0) | 0 |
| `qwen3.6:35b` | 72 | 68/68¹ | 0 | 68/72 | **0** (17) | 0 (0) | 4/72¹ |
| `gpt-oss:latest` | 72 | 72/72 | 0 | 72/72 | **0** (18) | **0 (28)** | 0 |

¹ qwen's four `failed-adapter`s are genuine model observations of the known
classes (3 × empty output, 1 × unparseable JSON tail) — elevated vs 1/72 on
2026-07-03; noted, not explained.

### The pre-registered check: confirmed — the failure class moved upstream

**Zero emitter-gate failures in 216 runs** (v0.3 baseline: 78/78 runs carrying
the trigger-label signature). Every surface that would have died post-emit at
A3 now dies pre-emit at S3, as a named `rule.trigger-carries-label` finding
with rationale and repair feedback. The ADR-M3-1 conversion claim holds at the
strongest measurable value: the projection gap no longer reaches the emitter.

### The conversion exposed a rule-design decision, not just a model behavior

> **Correction (2026-07-04, later the same day).** The bucket definition
> below counted a trigger's own direct text as projectable-today; the
> pre-amendment emitter's `subButtonText` projection does not consume it
> (verified against `dspack-emit/src/targets/a2ui/surface.ts` and the shadcn
> profile). Corrected decomposition — script and output committed alongside
> the original
> ([`decompose-trigger-label-v2.py`](evidence/2026-07-04-v04-effect/decompose-trigger-label-v2.py),
> [`decomposition-corrected.txt`](evidence/2026-07-04-v04-effect/decomposition-corrected.txt)):
> **67 projectable-today** (labeled button; was reported 73) ·
> **20 liftable** (text exists under the trigger, not on a button) ·
> **117 unmappable** (no text anywhere). The conclusions below are unchanged
> in direction; the ADR-M3-1 amendment (dspack#13) acts on the corrected
> numbers: ∃/`textScope: subtree` semantics recover the 67, the audited
> emitter lift recovers the 20, and the 117 remain governance's irreducible
> job.

Of the 204 runs whose first attempt violates `rule.trigger-carries-label`
(the rule fired in every violating run; it is universal):

- **131 are the measured gap class** (`genuinely-unprojectable`): no trigger
  in the surface carries a projectable label at all — direct trigger text
  absent AND no button descendant with direct text. At v0.3 these were the
  gate-failure/exhaustion feedstock. The rule catches them exactly as filed.
- **73 are `projectable-but-stricter`**: the trigger HAS a labeled bearer —
  A3 would have accepted the emission — but a **textless sibling button**
  trips the rule's for-every-button semantics (spec v0.4 §4.1 is
  ∀-quantified). This is not the class the evidence motivated. It is also
  not obviously wrong: a textless sibling button is an unlabeled interactive
  control (a real accessibility defect — it is why gpt-oss's two-button
  trigger idiom is a smell). But it is **stricter than the projection the
  rule was filed to protect**, and it has a measured cost: **all 28 of
  gpt-oss's v0.3 end-to-end passes used exactly this idiom** (one labeled +
  one unlabeled button in the trigger) and every one of them is a violation
  under v0.4 as authored.

**Decision surfaced to the maintainer (not patched):** keep the ∀ semantics
(own the strictness in the rule's rationale — "every button in a trigger
carries its label" — and accept that v0.4 rejects surfaces v0.3+A3 shipped),
or amend spec v0.4 §4.1 / the rule to an ∃ form ("at least one label-bearing
button") before v0.4 semantics freeze. The per-family split of the 73 is
gemma 29, gpt-oss 31, qwen 13 — the strict bucket is not one model's quirk.

### End-to-end passes went to zero, and repair did not rescue them

0/216 end-to-end (v0.3: 28/216, all gpt-oss). With the universal rule firing
on the dominant trigger idioms of all three families, every run entered the
repair loop and **none reached S3-clean within maxRepairs=2** (findings
decreased in 51 runs, unchanged in 135, increased in 26). The ADR-M3-1
promise is therefore half-realized at these models' repair ability:
*repairable in principle* (the feedback names the exact fix and carries the
corrected reference) but *unrepaired in practice* at n=2 repairs. Direct
text on a specific nested node appears to be a harder repair target than the
rule mix v0.3 exercised — relevant design input for the repair-shape
deconfound (ADR-M3-3), where this rule's two variants were expected to
populate the addition and restructuring shapes.

### Honest limits

Same as the body plus: the v0.3↔v0.4 comparison confounds steering-text and
lint-rule changes by construction (the contract IS the variable); zero
end-to-end passes means the v0.4 success path is exercised only by the
fake-adapter CI gate; `runsPerCell` = 3; one contract, one intent, local
models only — the hosted column remains blocked (Phase 2).

## Addendum — the ADR-M3-1 amendment, measured in three stages (2026-07-04)

The amendment (dspack#13 · dspack-gen#25 · dspack-emit#14, published as
`@aestheticfunction/dspack-emit@0.3.1`) was measured as a three-stage
contract/emitter A/B on byte-identical prompts, three local families,
`runsPerCell` = 3. Stage evidence:
[`2026-07-04-v04-effect/`](evidence/2026-07-04-v04-effect/) (∀ rule, pre-lift
emitter), [`2026-07-04-amendment-effect/`](evidence/2026-07-04-amendment-effect/)
(amended rules, pre-lift emitter 0.3.0),
[`2026-07-04-full-amendment/`](evidence/2026-07-04-full-amendment/) (amended
rules × lifting emitter 0.3.1).

| | v0.3 baseline | v0.4-∀ | rules-only | **full amendment** |
|---|---|---|---|---|
| end-to-end passes | 28/216 | 0/216 | 49/216 | **67/216** |
| emitter-gate failures | 78 | 0¹ | 32 | **7** |
| …carrying the trigger-label signature | 78/78 | — | 31/32 | **0/7²** |
| per-family e2e (gemma · qwen · gpt-oss) | 0 · 0 · 28 | 0 · 0 · 0 | 7 · 0 · 42 | **17 · 9 · 41** |

¹ v0.4-∀'s zero gate failures came at the cost of zero passes: the ∀ rule
consumed everything upstream. ² Four of the seven residuals mention
`triggerLabel` in their schema text but none is the signature — see below.

**Headline, at measured strength:** the projection gap that produced 78/78
unrepairable gate failures at v0.3 is CLOSED at the full amendment — and
closed the right way. End-to-end passes reached 2.4× the v0.3 baseline
(67 vs 28), **all three families now pass live** (gemma 17/72 and qwen 9/72
are each their family's first live passes in any run), and the audited lift
did visible work: **28 runs carry `surface-label-lifted` warnings** (gemma
12, qwen 11, gpt-oss 5) — every one a run that would have gate-failed on the
pre-lift emitter, now emitted with its label relocated and the relocation on
the audit record.

**The seven residual gate failures are two known, different classes:**
three are the sub-component-outside-compound refusal family (#16; a
standalone `card-header`), and four are surfaces with **no
`alert-dialog-trigger` at all** (A3: AlertDialog requires `child`) — the
amended trigger rule is conditional on trigger instances and nothing in the
contract requires the trigger sub-component to exist.
**Filed, not patched:** adding `alert-dialog-trigger` to
`rule.alertdialog-requires-cancel`'s `requiredSubComponents` is a one-line
contract-revision candidate that would convert this residue to repairable
S3 findings.

**Repair under the amended rule works where ∀ made it impossible:** repair
success gemma 8.3%, qwen 10.9%, gpt-oss 31.7% (vs 0% across the board under
∀). First-attempt violation stays high (83–89% for gemma/qwen) — the
governance floor is real; the difference is that repair and emission can now
finish the job.

**Infrastructure notes, for the record:** stages ran dual-host (a second
digest-verified Ollama 0.31.1 box took the gpt-oss and part of the qwen
columns; model digests byte-identical; run provenance in the helper matrix
comments). An earlier attempt on the second box at Ollama 0.20.0 failed
loudly (`HTTP 500: failed to load model vocabulary required for format`) —
a third face of the S0 engine-dependence family (mlx silently ignores
`format`; the hosted API rejects large grammars; pre-0.31 servers hard-fail)
— its five contaminated reports were scrubbed before any analysis. qwen
produced 7 genuine `failed-adapter`s across the two new stages (empty
output / unparseable tail); the #19 classifier's first live application
confirms all 7 as `generation-then-bad-output` (counted), 0 as
`no-generation`.

**Honest limits:** the stages differ by contract revision AND emitter
version by construction (that is what was measured); prompts byte-identical
throughout; small per-cell n; one contract, one intent, local families only
(the hosted path is closed as unreachable — see
[`2026-07-04-hosted-probes/`](evidence/2026-07-04-hosted-probes/) and #20).

## Addendum — the Astryx column and the repair-shape deconfound (2026-07-05, PR-21)

The second contract's eval column: the nine-component Astryx slice
(props-based idiom, pinned v0.1.2), 12 shape-targeted prompts × 2 templates
× 3 runs × three families, emitted via the **json-render target** (per the
ADR-M3-5 caveat this column does not and cannot exercise the A2UI projection
gap). Evidence: [`2026-07-05-astryx/`](evidence/2026-07-05-astryx/)
(216 retained reports; dual-host, digests verified).

| model | 1st-attempt violation | repair success | **e2e pass** | gate failures |
|---|---|---|---|---|
| `gemma4:e4b` | 41/72 | 22/41 | **53/72 (74%)** | 0 |
| `gpt-oss:latest` | 38/72 | 24/38 | **58/72 (81%)** | 0 |
| `qwen3.6:35b` | 16/66¹ | 9/16 | **59/72 (82%)²** | 0 |

¹ six genuine adapter failures (all `generation-then-bad-output`; 0
`no-generation`). ² rate over observed runs.

**Finding A — the props-based idiom is dramatically more governable.**
Against the same families that manage 12–57% e2e on shadcn (full
amendment), Astryx yields 74–82%, with repair success 54–63% (vs 8–32%) and
**zero emitter-gate failures in 216 runs** — the contract-generated-catalog
pairing is lossless at scale, exactly as the asymmetry finding predicted
(its only documented casualty, the data-driven array props, never produced
a gate failure because generation carries labels, not data rows).

**Finding B — governance-by-API-shape.** The three prop-presence rules
(`alertdialog-carries-content`, `button-carries-label`,
`input-carries-label`) **never fired once** in 216 runs, including on the
prompts engineered to elicit them (a04–a06, a11–a12). Astryx's API makes
the violation unnatural: when the label IS the prop, models supply it. The
contract's governance load concentrated on the one genuinely behavioral
rule — `destructive-requires-alertdialog` (92 first-attempt violations,
52 repaired) — plus a trickle on `action-label-specific` (3/3 repaired) and
`dialog-no-nested-overlays` (2/2 repaired). Together with the shadcn arc
this is the ecosystem's sharpest architectural result: **the projection gap
and the label-governance problem are artifacts of compositional APIs;
props-based APIs internalize them** — and what remains for governance
everywhere is *choice* (which component for which intent).

**Finding C — the repair-shape deconfound, per the pre-agreed rule.**
Rule-identity repair rates across both contracts (runs violating →
repaired):

| shape | rules that actually fired | verdict |
|---|---|---|
| substitution | shadcn `destructive-requires-alertdialog` 0/7 · astryx same-id 52/92 · astryx `action-label-specific` 3/3 | **≥2 distinct fired rules ✓** — and the spread (0/7 vs 52/92 for the same semantic rule across contracts) says CONTRACT/vocabulary dominates shape |
| addition | shadcn `alertdialog-requires-cancel` 9/41 · astryx content/label rules 0 fired | **still confounded** (one fired rule) — the Astryx analogs were pre-empted by the API shape (Finding B) |
| deletion | shadcn `button-no-interactive-descendants` 11/106 · astryx `dialog-no-nested-overlays` 2/2 | two fired rules ✓ but the astryx n is 2 — **reported, not powered** |
| restructuring | shadcn only (pre-declared: no Astryx analog) | **still confounded** |
| (v0.4) direct-content | shadcn `trigger-carries-label` 10/88 | single-rule, noted |

The honest verdict: the original hypothesis ("removal/restructuring-shaped
repairs succeed less") is **superseded rather than answered** — the
between-contract variance on the SAME rule (0/7 vs 52/92) is larger than
any between-shape variance observed, so repair difficulty looks primarily
contract-idiom-dependent. The shape question would need same-contract rule
pairs to power; filed as design input for any future matrix, not pursued
further in M3.

**Finding D — the prose→rule conversion census (first pass, one author).**
Of ~104 structured `bestPractices` entries across the nine harvested
components, **6 became machine-checkable rules** (all six shipped;
provenance-quoted in the contract). The non-convertible classes, with
verbatim exemplars: max-cardinality ("Don't place more than one primary
button in the same view" — a documented v0.4 ceiling item), ancestor
requirements ("don't use the destructive variant without a confirmation
step"), quality judgments ("write labels that describe the action"), and
runtime behavior ("show a loading state for actions that take time"). The
census is the M3 exit's answer to "does prose guidance convert?": *the
deterministic core converts; the ceiling items are now named with
evidence.*

### Verification notes (2026-07-05, maintainer audit)

- **The 78/78 signature count is verified by strict gate-error + surface-shape
  analysis** (not string matching):
  [`docs/evidence/verify-signature-78.py`](evidence/verify-signature-78.py),
  one command, asserts the count. Decomposition: 71 single-trigger cases
  (unlabeled or nested-label button) + 7 multi-trigger cases whose only label
  text sits on a trigger node itself — unprojectable by the pre-amendment
  projection per the corrected precondition, hence signature. Zero
  no-trigger, zero refusals, zero unrelated A3 errors across all 78.
- **Finding B's control now exists**: three deliberately violating Astryx
  fixtures ([`fixtures/golden/violating-astryx/`](../fixtures/golden/violating-astryx/))
  prove each never-fired prop-presence rule fires with the exact expected
  finding (golden-locked in `lint.test.ts`). The rules are
  authored-correct-and-preempted, not mis-authored.
