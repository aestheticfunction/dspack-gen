/**
 * @aestheticfunction/dspack-gen/theme — the deterministic theme compiler.
 *
 * A theme-direction proposal (closed enums only: see theme-direction.v1.schema.json) compiles to governed
 * token values, or to nothing: the compiler is deterministic, fail-closed and holds every result to a
 * ratified WCAG constraint set, repairing only by a bounded, named re-solve. No network, clock, randomness or
 * model is involved. Graduated from Aesthetic Function's website, where it incubated; see docs/theme.md.
 *
 * The three modules are re-exported unchanged, and remain importable on their own
 * (./theme/compile.mjs, ./theme/constraints.mjs, ./theme/solve.mjs) for consumers that need the files.
 */
export * from "./constraints.mjs";
export { constraintsForRole, roleFeasibility, ITERATIONS, rgbToHsl, hslToHex, solveRole } from "./solve.mjs";
export * from "./compile.mjs";
