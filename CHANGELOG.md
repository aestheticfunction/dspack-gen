# Changelog

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
