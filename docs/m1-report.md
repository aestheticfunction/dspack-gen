# M1 report — the governed-generation vertical slice

**Thesis:** *A2UI defines what can render. dspack defines what is correct.* Milestone 1 is
the smallest coherent system that proves it end to end: a design-system contract whose
governance is machine-checkable, an LLM generating UI under schema constraint, a
deterministic linter enforcing the contract's rules with rationales, a bounded repair loop
that never pretends, protocol emission behind its own gates, and a versioned audit report
carrying the whole trail.

**Tagged state:**
[dspack@m1](https://github.com/aestheticfunction/dspack/releases/tag/m1) ·
[dspack-to-a2ui@m1](https://github.com/aestheticfunction/dspack-to-a2ui/releases/tag/m1) ·
[dspack-gen@m1](https://github.com/aestheticfunction/dspack-gen/releases/tag/m1) ·
[`@aestheticfunction/dspack-to-a2ui@0.2.0` on npm](https://www.npmjs.com/package/@aestheticfunction/dspack-to-a2ui).

## The pipeline and its gates

```
dspack v0.3 contract (intents · rules · examples)
  → compiled context (system prompt + generation schema + few-shot)
  → schema-constrained generation (Ollama structured outputs | Anthropic; model ids are config)
  → S1 surface schema · S2 contract vocabulary · S3 governance   ← pre-emission, protocol-neutral
  → bounded repair (≤2; feedback rendered from the same findings the report embeds)
  → A2UI emission (every synthesis audited)
  → A1 schema-compile · A2 catalog-shape · A3 instance           ← per emitted target
  → render via @a2ui/react v0.9.1 · audit report v1
```

Three layers, never collapsed: the schema answers *can this object exist*, the linter
answers *is this object correct*, the renderer answers *can this render*. The generation
schema deliberately encodes vocabulary and shape only — encoding governance there would
make violations unobservable and the audit trail vacuous.

## The two recordings

Both takes ship with their audit report
(`docs/evidence/2026-07-02-recordings/`), each schema-valid against
[`audit-report.v1`](../schemas/audit-report.v1.schema.json).

### Take 1 — scripted architecture replay ([video](https://github.com/aestheticfunction/dspack-gen/releases/download/m1/take1.mp4))

A **scripted fixture replay** (labeled as such on screen), not live generation: the
deterministic adapter plays the golden violating fixture, then the contract's worked
example. It exists to show the intended machine-verified trail — the same one the CI
Playwright gate asserts: `Dialog` rejected for `destructive-action` with the contract's
rationale verbatim → the exact repair message → a clean attempt whose S3 card lists every
applicable rule as *verified by the linter, not assumed from prompt steering* → A1–A3 green
for both A2UI versions → the AlertDialog rendering off the generated catalog with
cancel-before-confirm → the downloadable report. Outcome: `passed`.

### Take 2 — live local model ([video](https://github.com/aestheticfunction/dspack-gen/releases/download/m1/take2.mp4))

Live generation on `ollama:qwen3.6:35b` (the strongest local model), flagship prompt,
rule steering in the prompt. What actually happened, in the report's own vocabulary:

1. **Attempt 1:** S1/S2 pass; **S3 fails** — one `rule.button-no-interactive-descendants`
   finding (the model nested an interactive element inside a button despite the steering).
2. **Repair:** one deterministic repair message, carrying the rule's linked corrected
   reference.
3. **Attempt 2:** **S1/S2/S3 all pass** — the repaired structure is verified by governance.
4. **Emission:** gates **A1/A2 pass, A3 fails** on both A2UI versions — the surface placed
   the AlertDialog's title text where S3's presence semantics accept it but the emitter's
   documented flattening cannot project it (the ADR-D1 text-placement gap, previously
   observed in the candidate evidence), so the emitted instance is invalid against the
   generated catalog.
5. **Outcome: `failed-gate`, exit 3.** No surface rendered; the report names the failing
   gate and instance.

This is the enterprise story stated plainly: a schema-valid, prompt-steered, and — after
one repair — **governance-clean** generation still produced an artifact the downstream gate
had to refuse, and the pipeline refused it loudly with a machine-readable trail instead of
degrading. The repair loop and the governance layer worked; the emitter gate worked; the
failure is attributed precisely to the projection gap, which is a named v0.4 candidate
(plan, ADR-D1).

*Two disclosure notes:* live findings locate at the offending descendant per the
spec-conformance fix that landed after the historical evidence was recorded, so they do not
byte-match the older reports — expected. And take 2 ran against the current contract
revision (post-`table`, sha `4c86ba94…`), a later revision than the A/B matrix below.

## Findings, at measured strength

- **Structured outputs are engine-dependent in Ollama 0.31.1.** llama.cpp-engine (GGUF)
  models were schema-valid in 16/16 spike runs at unroll depths 3–8 (29–81 KB schemas);
  **mlx-engine models silently ignore `format`** — no error, unconstrained output, failing
  even a trivial two-field schema. Paired same-architecture variants isolate it to the
  engine. Filed upstream as
  [ollama/ollama#17013](https://github.com/ollama/ollama/issues/17013). This is why S1/S2
  are independent gates over the produced artifact, never assumptions about generation.
- **Prompt steering is not enforcement.** Local models passed S1/S2 while violating S3 —
  most persistently `rule.button-no-interactive-descendants` — with the rules verbatim in
  the prompt. First-attempt violation and repair-success rates per rule × model are the
  eval harness's (PR-10's) questions.
- **The example-link A/B was a clean negative.** Linking the existing worked example to the
  one rule that lacked a corrected reference (a contract gap on independent design grounds)
  changed repair feedback only — generation context byte-identical — and produced **no
  repair convergence change in 11/11 matrix runs**
  (`docs/evidence/2026-07-02-flagship-candidates{,-post-example-link}/`). The corrected
  reference is not reliably sufficient for this rule/prompt/model set. One additional
  observation since: in the recorded take (later contract revision, n=1), the same rule
  *did* repair on the first attempt — consistent with run-to-run non-determinism, and no
  more than that is claimed.
- **A repair-shape hypothesis is recorded as PR-10 matrix design input, not a finding:**
  the rules that repaired reliably call for substitution/addition; the resistant rule
  requires removal/restructuring, which the repair template's "do not change unflagged
  parts" may inhibit. PR-10's prompt set spans repair shapes and includes a repair-template
  variant for removal cases.

## Honest scope

The slice proves governed generation against one contract, one intent, one protocol target
(A2UI v0.9.1 rendered, v1.0 validated). Compound composition flattens per documented
casualties with every synthesis audited; the surface format is an intermediate
representation, never rendered or transported; deterministic rules only — no LLM-as-judge
tier. Failures are named with the report's own vocabulary (`failed-lint-exhausted`,
`failed-gate`, `failed-adapter`); precision in attribution, not avoidance of the word
"failed", is the standard throughout.

## What's next (M2)

The json-render emitter (the protocol-neutrality experiment's second consumer), the eval
harness (schema-validity, first-attempt violation, and repair-success rates per rule ×
model × engine), ds-mcp's `get-generation-context` / `validate-ui` tools (the agent-driven
loop), and contract-copy drift prevention
([#7](https://github.com/aestheticfunction/dspack-gen/issues/7)).
