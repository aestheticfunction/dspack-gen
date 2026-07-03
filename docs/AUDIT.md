# Audit report — versioning and stability guarantees

Every pipeline run — CLI, demo, eval — emits an audit report. **The JSON is the artifact**
(`schemas/audit-report.v1.schema.json`); the Markdown rendering is a derived view and carries
no guarantees.

## Guarantees (reportVersion "1")

- **Additive-only.** Within version "1", fields are only ever added; existing required
  fields, field meanings, and the enums below never change. Consumers MUST tolerate unknown
  properties.
- **Stable enums:**
  - `outcome`: `passed` | `failed-lint-exhausted` | `failed-gate` | `failed-adapter`
    (`failed-adapter` extends the plan's original three: the S0 spike showed model runtimes
    can fail to apply constrained decoding, so adapter failures are a first-class, reported
    outcome — never a silent retry).
  - surface gates: `S1` (surface-schema) / `S2` (contract-vocabulary) / `S3` (governance),
    each `PASS` | `FAIL` | `SKIPPED`, independently reported per attempt.
  - emitter gates: `A1` (schema-compile + no-external-ref) / `A2` (catalog-shape) /
    `A3` (instance), per emitted A2UI version.
  - findings carry both severity faces: `requirement` (`must`|`should`, contract-facing
    RFC 2119) and `level` (`error`|`warn`, tool-facing).
- **One findings object, two serializations (ADR-7):** `attempts[].findings` is embedded
  verbatim, and `repairMessages[]` contains the exact prompt text rendered from those same
  objects. Nothing in the trail is paraphrased.
- **Reproducibility fields:** `request.contract.sha256` (the exact contract),
  `generation.schemaSha256` (the exact generation schema), `generation.adapterId` +
  `attempts[].model` (the model that actually served each attempt, as reported by the
  provider), `attempts[].meta` (provider timings/engine info, recorded verbatim).
- **Honesty fields:** `generation.ruleSteering` records whether governance steering was in
  the prompt (steering is never the guarantee — S3 is); `emitted.warnings` records every
  emitter synthesis/drop.

### Additive changes within version "1"

- `generation.repairTemplate` (2026-07-02, PR-10): the ADR-7 repair template variant used
  for feedback rendering (`standard` | `permit-restructuring`). Absent means `standard` —
  every report written before this field existed used the standard template.
- `emitted.refusal` (2026-07-03): the emitter's typed refusal message when a lint-clean
  surface could not be emitted at all (a sub-component outside its compound parent, etc.) —
  the target-equivalent emitter-gate failure. Outcome is `failed-gate`; `emitted.validations`
  is empty and `emitted.surfaceMessages` absent in that case. Reports written before this
  field existed never carried refusals (the pipeline crashed instead — the flaw this fixed).

Breaking changes bump `reportVersion` and get a new schema file; version "1" documents stay
valid against the "1" schema forever.
