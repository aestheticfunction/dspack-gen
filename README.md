# dspack-gen

**Generation + governance pipeline for [dspack](https://github.com/aestheticfunction/dspack)
contracts.** Compiles a dspack v0.3 contract into generation context, generates dspack
surfaces via schema-constrained LLMs (Ollama local or hosted — interchangeable adapters),
lints them deterministically against the contract's governance rules, repairs bounded, emits
to protocols (A2UI via
[dspack-to-a2ui](https://github.com/aestheticfunction/dspack-to-a2ui); json-render next), and
produces a versioned audit report.

> *A2UI defines what can render. dspack defines what is correct.*

**Status: Milestone 1 in progress.** Landed: S0 spike
([findings](docs/spike-structured-outputs.md)), prompt/context compiler. Coming per the M1
plan: surface gates S1–S3 (linter), adapters, orchestrator + audit report v1, flagship demo.

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
| A1–A3 | schema-compile / catalog-shape / instance validation | dspack-to-a2ui (per emitted target) |

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

(Distinct from dspack-to-a2ui's exit codes, where `3` = strict-coverage failure and `4` =
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
