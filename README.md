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
The emitter is consumed from npm as `@aestheticfunction/dspack-emit`
(renamed from `@aestheticfunction/dspack-to-a2ui` with the ADR-D2 repo
rename; the old package is deprecated with a pointer).

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

## Eval harness

```bash
npm run eval -- --adapter fake --matrix eval/matrix.fake.json   # deterministic; the CI gate
npm run eval -- --adapter live --matrix eval/matrix.json        # documented live run; never CI
npm run eval -- --adapter live --matrix eval/matrix.json --out out/eval/<dir> --resume   # resume an interrupted run
npm run eval:assert -- --results out/eval/fake/results.json --model <ref> --min-repair-success 0.9
```

Every cell run goes through the same `runPipeline` as the CLI and demo; the
harness only iterates and aggregates. **Model ids live in `eval/matrix.json`
(config), never in code.** Per cell (model × prompt × repair template,
`runsPerCell` runs): schema-validity, first-attempt-violation, repair-success
(null over zero violations), end-to-end pass rates, and the count of S3-clean
surfaces refused by emitter gates (the ADR-D1 signal; `p10`–`p12` probe it
deliberately). Prompts span repair shapes — substitution, addition, deletion,
restructuring — and every prompt crosses the two ADR-7 repair templates
(`standard` vs `permit-restructuring`, a one-instruction-line delta recorded
in each audit report). One run can never kill the matrix: adapter transport failures are typed
(`failed-adapter`, with a report) and anything that still escapes a run is
contained as an explicit `error` run — visible in the distribution with a
retained `.error.json`, excluded from the model-behavior rate denominators
(`errorRuns` reports the count). `--resume` skips already-retained reports
and retries error records. Every run's audit report is retained under
`out/eval/…/reports/`; `results.json` is the artifact, `report.md` the
derived view; findings go to [docs/findings.md](docs/findings.md) at measured
strength. The hosted-model `eval:assert` threshold is the only hard eval gate
in M2; local models are report-only.

## Library

`@aestheticfunction/dspack-gen/core` is the **zero-network, emitter-free** subpath (compiler +
linter) that [ds-mcp](https://github.com/aestheticfunction/ds-mcp) consumes without breaking
its read-only/no-network security posture. The boundary is enforced by
`src/core/core-boundary.test.ts`.

## Development

```bash
npm ci
npm test          # vitest: golden context, generation-schema behavior, core boundary
npm run check:sync  # contract-copy drift check vs the dspack repo (CI-run; --write re-syncs)
```

`fixtures/shadcn.v0_3.dspack.json` is a byte copy of the spec repo's
`examples/shadcn-ui.dspack.json`; CI fails loudly if they diverge
(dspack-gen#7). After `--write`, regenerate the derived goldens (context
golden, F-fixture expected outputs, eval fake golden) and commit the sync +
regeneration together.

## License

Apache-2.0. Copyright 2026 Aesthetic Function, LLC.
