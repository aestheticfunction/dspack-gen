# Recording evidence — 2026-07-02

The audit reports shipping with the two M1 recordings (videos: assets on the
[m1 release](https://github.com/aestheticfunction/dspack-gen/releases/tag/m1)).
Both validate against `schemas/audit-report.v1.schema.json`. Narrative and
analysis: `docs/m1-report.md`.

| Take | Adapter | Ending | Trail |
|---|---|---|---|
| 1 (scripted fixture replay) | `fake:scripted` | `passed` | S3 violation (fixture) → repair → S1–S3 pass → A1–A3 pass |
| 2 (live) | `ollama:qwen3.6:35b` | `failed-gate` (exit 3) | S3 violation → repair → **S1–S3 pass** → **A3 FAIL** (missing `triggerLabel`: text-less trigger button, unrequired by the rule — ADR-D1 family) |

Both takes ran against the post-`table` contract revision (sha `4c86ba94…`),
later than the A/B matrix evidence in the sibling directories — and live
findings locate at the offending descendant per the spec-conformance fix, so
they intentionally do not byte-match the historical reports.
