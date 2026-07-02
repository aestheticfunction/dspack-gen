/**
 * @aestheticfunction/dspack-gen — public entry.
 *
 * Currently re-exports `core` (compiler; linter from PR-4). The pipeline
 * orchestrator, adapters, and audit report join here in later PRs; `./core`
 * stays the zero-network subpath ds-mcp depends on.
 */
export * from "./core/index.js";
