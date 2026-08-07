# The shadcn contract-fixture pin

`fixtures/shadcn.v0_4.dspack.json` is **pinned to one upstream commit** instead of tracking `dspack@main` — the same policy, commit, and sha256 already ratified and shipped in [dspack-emit](https://github.com/aestheticfunction/dspack-emit/blob/main/docs/CONTRACT-PIN.md) and [dspack-studio](https://github.com/aestheticfunction/dspack-studio/blob/main/docs/CONTRACT-PIN.md).

| | |
|---|---|
| **Pinned ref** | [`805732c`](https://github.com/aestheticfunction/dspack/commit/805732c154f0f214721c9934a450b0edb2656c99) — shadcn/ui **v2.3.0**, 8 components |
| **sha256** | `ca19f8410a97f2004cf1d6f6dd2d7542abccfbb5430b756e0ccdc1ee954c7bb7` (byte-identical to both sibling pins) |
| **Current upstream** | v3.0.0 production contract (32 components) at [`b573637`](https://github.com/aestheticfunction/dspack/commit/b573637), dspack#35 |
| **Tracking issue** | aestheticfunction/dspack-gen#51 |

> **Not current shadcn/ui coverage.** This package's fixtures, goldens, grammar-alignment corpus, and pipeline tests were built against the 8-component contract. Do not cite them as production-shadcn evidence.

**Why:** dspack#35 moved `main` to the production contract on 2026-08-05; `check:sync` follows `main` and runs before the test suite in CI, so every branch here went red (or green-by-stale-lockfile) with no code change. Syncing forward would break the fixture corpus rather than widen it — the migration is gated on the dspack-emit representation milestone (aestheticfunction/dspack-emit#28).

**Enforcement:** the sync check verifies the pinned artifact's sha256 on every run (a pinned ref must be immutable; a change means force-push or CDN mismatch — `TAMPERED`, exit 1), still fails on local drift, and always prints how far behind `main` the pin sits. Verified: clean → 0, mutated hash → 1, restored → 0.

**Removal:** after the emit representation capabilities land and the profile migration completes — remove the `pin` block, `node scripts/check-sync.mjs --write`, regenerate goldens, commit together.
