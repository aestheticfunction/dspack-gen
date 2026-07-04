# ADR-M3-4 hosted-ceiling probes — the escalation record (2026-07-04)

The pre-agreed decision rule (M3 plan, ADR-M3-4) ran its probes and hit its
third branch: **no compiling depth exists — width binds — escalate; do not
run.** No hosted eval was executed beyond these probes.

## The probes (scripts + raw outputs in this directory)

- **Probe 2 — observed surface depth** (free, over the 144 retained July-3
  local runs; see `RESULTS.txt`): depths 3–6, with 180/323 surfaces AT the
  depth-6 unroll bound — the distribution is right-censored, so any depth
  reduction truncates observed behavior.
- **Probe 1 — hosted grammar-ceiling bisect** (`depth-bisect.mts`; same
  schema builder and `output_config.format json_schema` request path as the
  eval's hosted column): **every depth 1–6 rejected**, including depth 1 at
  9 KB. The ceiling is not depth-bound.
- **Width control** (`width-control.mts`): at depth 1 the ceiling admits
  **~2 components** (2.4 KB accepted; 5.0 KB with 4 components + 20
  sub-components rejected). The smallest honest destructive-action
  vocabulary (alert-dialog + 8 subs, button, card, text) already exceeds it
  — so the per-intent-pruning fallback (Open Question 5) is ALSO infeasible
  at this ceiling, not merely confounded.

## What this means (input to the #20 disposition, maintainer's call)

The matched-schema hosted design (dspack-gen#20) cannot produce a hosted
governance number on the current structured-outputs API: the grammar
compiler's ceiling sits below any usable governed vocabulary at any depth.
This is the strongest form of the M2 infrastructure finding — the hosted
constrained-decoding path cannot express even a minimal contract — and it is
evidence FOR the independent-gates architecture, not merely a blocker.

Candidate future path (out of M3 scope, different adapter mode): constrained
generation via forced tool-use schemas, whose limits are compiled differently
from `output_config`. Filed as an M4+ candidate, not attempted here.

Reproduce (location-independent): `npx tsx docs/evidence/2026-07-04-hosted-probes/depth-bisect.mts` with ANTHROPIC_API_KEY set (each rejection is a
pre-generation 400; the accepting width-control probes cost ~16 tokens each).
