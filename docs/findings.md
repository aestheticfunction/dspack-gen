# Eval findings

**Status: pending the M2 live run.** This document is the publishable
deliverable of the eval harness (PR-10); it is populated from a documented
live run of `eval/matrix.json` and makes claims at exactly the measured
strength. Until that run lands, only the questions and definitions below are
fixed — no findings are claimed.

## What the matrix measures

Per cell (model × prompt × repair template, `runsPerCell` independent runs;
definitions live in `src/eval/runner.ts` and are computed nowhere else):

- **schema-validity rate** — attempt-1 gate S1 passed. Measured even though
  constrained decoding should saturate it: the claim is verified, never
  assumed (the S0 spike found an engine silently ignoring `format`).
- **first-attempt governance-violation rate** — attempt 1 had error-level S3
  findings; also broken out per rule.
- **repair-success rate** — among violating runs, the fraction reaching an
  S3-clean attempt within `maxRepairs`. Undefined (not 0) over zero
  violations.
- **end-to-end pass rate** — outcome `passed`.
- **error runs** — contained per-run infrastructure crashes: counted and
  visible (`errorRuns`), excluded from every rate denominator above —
  they are not observations of the model.
- **S3-clean gate failures** — outcome `failed-gate`: governance accepted a
  surface an emitter gate refused (the ADR-D1 gap family), recorded for
  every cell and probed deliberately by the `adrD1Probe` prompts.

## Open questions the live run must answer

1. **Repair-shape hypothesis (design input, not a finding):** do
   removal/restructuring-shaped repairs succeed less often than
   substitution/addition-shaped ones, and does the `permit-restructuring`
   repair-template variant change that? The matrix crosses every prompt with
   both templates; the only delta between templates is one instruction line.
2. **The n=1 repair-success observation:** recorded take 2 saw
   `rule.button-no-interactive-descendants` repair on the first attempt
   (post-`table` contract) after 0/11 repaired passes in the earlier A/B
   matrix (pre-`table` contract revision). Contract-revision effect,
   non-determinism, or something else? Every retained audit report records
   the contract sha; the per-rule rollup puts a rate with spread on it.
3. **ADR-D1 systematic rates:** how often do S3-clean surfaces fail A-gates
   on text placement/absence when prompts invite it (`p10`–`p12`), per
   model? The refinement decision (v0.4 `requiredProps`-style rule) wants
   rates, not the two incidental catches on record.
4. **The local-model floor:** first-attempt violation and repair-success per
   local model vs. the hosted model — the "local is reliable from N B up"
   question. The hosted repair-success threshold (`eval:assert
   --min-repair-success 0.9`) is the only hard gate; local models are
   report-only in M2.
