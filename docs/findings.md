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
