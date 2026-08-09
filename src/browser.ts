/**
 * Browser-safe generation surface.
 *
 * The package index (`.`) re-exports the WHOLE library, including the Node-only
 * provider adapters (`@anthropic-ai/sdk`, `undici` via Ollama) and the eval/serve
 * helpers (`node:fs`, `node:path`). None of that can be bundled for the browser.
 *
 * This entry exposes only what an in-browser (or edge) host needs to RUN the
 * governed pipeline: `runPipeline` plus the deterministic `ScriptedAdapter`. The
 * host brings its own adapter for real providers (e.g. a fetch-based gateway
 * adapter) — the pipeline is provider-agnostic by design (ADR-9). The reachable
 * subgraph is browser-safe except for `node:crypto` in the audit report's
 * provenance hash, which the host aliases to a synchronous SHA-256 shim.
 *
 * Consumers that want the real Anthropic/Ollama adapters must import them from
 * the package root in a Node/edge runtime that permits their dependencies.
 */
export { runPipeline, type RunOptions, type RunResult, type PipelineEvent } from "./run/orchestrator.js";
export { ScriptedAdapter, type ScriptEntry } from "./adapters/fake.js";
