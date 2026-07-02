/**
 * @aestheticfunction/dspack-gen/core — the zero-network, emitter-free subset:
 * prompt/context compiler (+ the governance linter, from PR-4 on).
 *
 * ds-mcp's `get-generation-context` / `validate-ui` tools import exactly this
 * subpath; its no-network/read-only invariants depend on this boundary, which
 * is enforced by src/core/core-boundary.test.ts.
 */
export * from "./contract.js";
export * from "./generation-schema.js";
export * from "./compiler.js";
export * from "./lint/index.js";
