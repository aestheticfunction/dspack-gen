# dspack-gen

**Generation + governance pipeline for [dspack](https://github.com/aestheticfunction/dspack)
contracts.** Compiles a dspack v0.3 contract into generation context, generates dspack
surfaces via schema-constrained LLMs (Ollama local or hosted — interchangeable adapters),
lints them deterministically against the contract's governance rules, repairs bounded, emits
to protocols (A2UI and json-render via
[dspack-emit](https://github.com/aestheticfunction/dspack-emit)), and
produces a versioned audit report.

> *A2UI defines what can render. dspack defines what is correct.*

**Status: Milestone 1 complete** —
[m1 tag](https://github.com/aestheticfunction/dspack-gen/releases/tag/m1),
write-up in [docs/m1-report.md](docs/m1-report.md). M2 in progress (second
emitter target landed in dspack-emit; eval harness and ds-mcp tools next).
The emitter repo was renamed `dspack-to-a2ui` → `dspack-emit` (ADR-D2); its
npm package remains `@aestheticfunction/dspack-to-a2ui` until the next
publish — this repo's dependency string tracks the npm name.

## The three layers (never collapse them)

1. **Schema** answers *"can this object exist"* — the generation schema encodes vocabulary and
   shape only, never governance.
2. **Linter** answers *"is this object correct"* — deterministic typed rules (gate S3), each
   with a rationale.
3. **Renderer** answers *"can this render"* — protocol emitters compile the surface; the
   target's gates (A1–A3 for A2UI) validate the result.

## Gates

| Gate | Check | Where |
|---|---|---|
| S1 | generic dspack surface schema | here (pre-emission) |
| S2 | contract vocabulary (components, sub-components, props, enum values, slots) | here (pre-emission) |
| S3 | governance rules (typed, deterministic, rationale-bearing) | here (pre-emission) |
| A1–A3 | schema-compile / catalog-shape / instance validation | dspack-emit (per emitted target) |

S1/S2 are checks on **any** produced surface; constrained decoding may implement S2 during
generation but the gates are always reported independently — the S0 spike found Ollama's mlx
engine silently ignoring `format`, which is exactly why.

## CLI

```bash
npm run context -- --dspack fixtures/shadcn.v0_3.dspack.json --intent destructive-action
# prints { system, schema, fewshot } — the compiled generation context
```

`lint` (S1–S3) and `run` (full pipeline) land in later M1 PRs.

### Exit codes (whole CLI surface)

| Code | Meaning |
|---|---|
| 0 | clean |
| 1 | internal / usage error |
| 2 | governance failure (any S-gate error) |
| 3 | emitter-gate failure (A1–A3 or target equivalent) |
| 4 | unknown rule type (fail-loud; never silently skipped) |

(Distinct from dspack-emit's exit codes, where `3` = strict-coverage failure and `4` =
surface-emission failure.)

## Library

`@aestheticfunction/dspack-gen/core` is the **zero-network, emitter-free** subpath (compiler +
linter) that [ds-mcp](https://github.com/aestheticfunction/ds-mcp) consumes without breaking
its read-only/no-network security posture. The boundary is enforced by
`src/core/core-boundary.test.ts`.

## Development

```bash
npm ci
npm test        # vitest: golden context, generation-schema behavior, core boundary
```

## License

Apache-2.0. Copyright 2026 Aesthetic Function, LLC.
