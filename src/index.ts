/**
 * @aestheticfunction/dspack-gen — public entry.
 *
 * `./core` remains the zero-network, emitter-free subpath (compiler + linter)
 * that ds-mcp depends on; this root entry adds the network-touching pipeline:
 * adapters, orchestrator, repair rendering, audit report.
 */
export * from "./core/index.js";
export * from "./adapters/index.js";
export { ScriptedAdapter, type ScriptEntry } from "./adapters/fake.js";
export { renderRepairMessage, type RepairTemplate } from "./repair/render.js";
export * from "./audit/report.js";
export { runPipeline, type RunOptions, type RunResult } from "./run/orchestrator.js";
export { runMatrix, computeMetrics, type RunMatrixOptions } from "./eval/runner.js";
export type { EvalMatrix, EvalPrompt, EvalResults, CellResult, CellMetrics, RepairShape } from "./eval/types.js";
