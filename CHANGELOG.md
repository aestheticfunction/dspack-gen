## 0.5.0 — 2026-08-11

Generation-quality release (P3a): the pipeline teaches the model what the emitter will demand, from knowledge the contract already carries.

- **Composition notes reach the system prompt.** Each component vocabulary line now carries the contract's own `composition.notes` (capped at two sentences / 360 chars). Measured on the Gateway corpus: every field-donation failure and tab/radio key mismatch contradicted prose the contract already states verbatim — generation just never saw it.
- **Join-participating sub-components require `id` in the generation schema** (`run/join-id-view.ts`, profile-derived, generation-only — S-gates and the contract untouched). Keyless and prefix-mismatched join items were the dominant residual join failure.
- Dev/CI stack aligned to dspack-emit 0.7 (lockfile): the p05 eval cell and the pipeline emitter-gate test recalibrated to 0.7 semantics (missing-required-prop surfaces now REFUSE at emission and ride the repair loop; the eval golden regenerated accordingly — refusals terminate as failed-gate, never script-exhaustion errors).

# Changelog

## 0.4.0

- **Representability repair loop** (Phase-2): an a2ui `EmitSurfaceError` — the
  emitter refusing a contract-legal-but-unrepresentable surface (declared
  casualties, transparent-dissolution donation boundaries, Collect join key
  violations) — now rides the bounded repair loop instead of finalizing
  `failed-gate` on first refusal. The refusal text becomes the repair turn,
  with one class-targeted hint; exhausted budget keeps the original terminal
  semantics (`failed-gate`, exit 3, `emitted.refusal`). New additive report
  field `attempts[].representability = { pass: false, refusal }`.
- **Casualty-free generation view**: with `RunOptions.emitProfile` set,
  generation compiles from the contract minus the profile's declared
  `casualtyComponents` (system-prompt vocabulary, generation schema, few-shot
  examples). S-gates and the report's contract digest keep the ratified
  original contract.
- **Ollama `think: false`**: structured-output generation cannot budget
  reasoning tokens — thinking models burned the whole `num_predict` on
  reasoning and returned "empty model output"; harmless on non-thinking
  models.

## 0.3.2

- `./browser` export: a supported browser-safe boundary — `runPipeline`,
  `RunOptions`, `RunResult`, `PipelineEvent`, `ScriptedAdapter`. Hosts bring
  their own adapter for the model turn and alias `node:crypto` to a
  synchronous SHA-256 shim.

## 0.3.1

- dspack-emit peer range admits `^0.6.0`.

## 0.3.0

- **S2 sub-component containment** (spec v0.4 §5.1): a sub-declared id may
  appear only within its declaring compound. Containment errors ride the
  repair message, so they are repairable in-loop.

## 0.2.2

- **S3 evaluates `requiredCategories`** (spec v0.4 §4.3 amendment).

## 0.2.1

- dspack-emit peer range admits `^0.5.0`.

## 0.2.0

- **`RunOptions.conversation`** — prior turns seeded between the contract's
  few-shot examples and the new user prompt: the conversational-refinement
  contract for the Studio composer's chat-driven builder. Pass the
  immediately prior generated surface as an assistant message (plus its
  originating user prompt) and ask for the change in `prompt`. The system
  prompt stays immutable (ADR-7); generation still produces a COMPLETE
  surface judged by the full S1–S3 + emit gate ladder; bounded repair
  appends after the seed exactly as it appends after a first attempt.
  Deliberately not a chat-history abstraction: callers own what carries
  over between runs.
- The audit report records the seed verbatim (`report.conversation`,
  additive in v1; absent when unused — existing reports byte-identical);
  `schemas/audit-report.v1.schema.json` gains the optional property.
- Fail-first tests pin: the prior surface is actually supplied to the
  adapter in position; refinement is non-vacuous (a conditioning adapter
  produces a different governed result only when the seed is present);
  system-prompt immutability; repair-after-seed convergence; report
  recording and absence.

## 0.1.3 — export seams for stream consumers and adapter hosts

Exports only; no pipeline, lint, or schema behavior changes. Contracts
without changes produce byte-identical artifacts.

- `PipelineEvent` is re-exported from the package root, so stream
  consumers (dspack-studio's agui-bridge) can drop their hand-maintained
  structural mirror of the union.
- New `./adapter-types` subpath exposing the adapter contract
  (`GenerationAdapter`, `GenerateRequest`, `GenerateResult`,
  `AdapterOutputError`, `parseJsonOutput`) from a module that imports
  nothing — hosts implementing their own adapter (a Workers runtime, a
  browser shell) get the types without pulling Node transport code. A
  boundary test locks the imports-nothing property.
- The `@aestheticfunction/dspack-emit` range widens to
  `^0.3.1 || ^0.4.0` so consumers depending on emit 0.4.x (profiles as
  data) resolve a single emit version across their tree. dspack-emit
  0.4.0 is additive; every API this package uses is unchanged.

## 0.1.2 — contract-declared required props reach the grammar

- A contract prop descriptor may now declare `required: true`; the
  generation schema lists it in the props object's `required` and makes
  `props` itself required on that component's node branch (an inner
  requirement never binds if the grammar can drop `props` wholesale).
  Grammar-constrained decoders skip optional heavy branches: across ~20
  live record-collection generations (gpt-oss:latest, qwen3-coder:30b),
  a table's nested `data` rows were never emitted while optional scalar
  props were, and repair rounds could not help — the grammar never
  demanded the prop. Verified directly against Ollama structured
  outputs: with `data` required, the same model fills rows first try.
  Contracts without required flags produce byte-identical schemas.

## 0.1.1 — generation-schema grammar alignment

Two fixes to the generation schema for grammar-constrained decoders
(Ollama structured outputs / llama.cpp grammars), which enforce the
schema's declared shapes and property order verbatim:

- Array-typed contract props now reach the schema as `{ type: "array" }`
  (previously the string fallback), with an optional contract-declared
  `items` schema passed through verbatim. The string fallback made the
  grammar forbid the arrays models plan (e.g. table `columns`), measured
  as malformed scalar props, abandoned subtrees, and emit-gate failures.
- Node properties are declared `component, id, props, text, children`
  (previously `text` before `props`). Models and the worked examples
  serialize `props` first; under order-enforcing grammars the old
  declaration made node text unreachable once `props` was emitted —
  measured as text-less nodes in every live generation.

Golden regenerated; no API changes.

## 0.1.0 — first public release

The generation and governance pipeline for dspack contracts, previously
consumed only in-repo and via the bundled core in ds-mcp, published as a
package.

- Root entry (`@aestheticfunction/dspack-gen`): model adapters
  (Ollama/Anthropic/scripted), `runPipeline` (generate → S1/S2/S3 lint →
  bounded repair → protocol emission → audit report), repair-message
  rendering, audit report rendering, and the eval-matrix runner.
- `/core` subpath: the zero-network, emitter-free compiler + linter
  (`compileContext`, `lintSurface`, generation-schema builder) that ds-mcp
  consumes; the boundary is test-enforced (`src/core/core-boundary.test.ts`).
- `dspack-gen` CLI bin: `context`, `lint`, `run`, `serve` (localhost NDJSON
  streaming of the pipeline). Exit codes: 0 clean, 1 usage/internal,
  2 governance failure, 3 emitter gate, 4 unknown rule type.
- Requires Node >= 20. ESM only.
