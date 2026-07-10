# Changelog

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
