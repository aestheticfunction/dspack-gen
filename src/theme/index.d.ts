/**
 * Types for @aestheticfunction/dspack-gen/theme (the modules themselves are plain ES modules; see index.mjs).
 */

export type Scheme = "dark" | "light";
export type HueFamily = "red" | "ember" | "amber" | "gold" | "olive" | "green" | "sage" | "teal" | "cyan" | "sky" | "blue" | "indigo" | "violet" | "magenta" | "rose" | "neutral";
export type HueNudge = "-12" | "-6" | "0" | "+6" | "+12";

/** A theme-direction v1 proposal: closed enums only (theme-direction.v1.schema.json). */
export interface ThemeDirectionProposal {
  directionVersion: "1";
  refusal: boolean;
  refusalCategory: "none" | "hateful" | "harassment" | "unsafe" | "unintelligible";
  interpretation: string;
  surface: { hueFamily: HueFamily; hueNudge: HueNudge; tint: "none" | "whisper" | "tinted" | "saturated"; depth: "abyss" | "deep" | "dim" | "dusk" };
  ink: { warmth: "cool" | "neutral" | "warm"; contrastCharacter: "soft" | "standard" | "stark" };
  accent: { hueFamily: Exclude<HueFamily, "neutral">; hueNudge: HueNudge; chroma: "muted" | "soft" | "clear" | "vivid" | "electric"; presence: "recede" | "balance" | "carry" };
  typography: { headlineWeight: "light" | "regular" | "medium" | "semibold" | "bold"; headlineTracking: "tight" | "normal" | "open"; displayVoice?: "brand" | "expressive" | "technical" };
  elevation: { character: "flat" | "soft" | "standard" | "dramatic" };
}

/** A dspack contract, or any object of the same token shape: only `tokens.<category>.values.<name>.value` is read. */
export interface TokenContract {
  tokens?: Record<string, { values?: Record<string, { value: string }> }>;
}

export interface Constraint {
  id: string;
  fg: string;
  bg: string;
  min: number;
  kind: "text" | "non-text";
  source: string;
  solveFor?: "fg" | "bg";
  note?: string;
}

export interface ConstraintResult {
  id: string;
  pair: string;
  required: number;
  achieved: number;
  disposition: string;
}

export interface Repair {
  constraint: string;
  pair: string;
  operation: "resolve-lightness-at-fixed-hue-and-chroma";
  token: string;
  before: string;
  after: string;
  achievedBefore: number;
  requirement: number;
  materiallyNarrowed: boolean;
}

export type CompileResult =
  | { ok: true; compilerVersion: string; directionVersion: "1"; tokens: Record<string, string>; constraints: ConstraintResult[]; repairs: Repair[]; reasons: string[] }
  | { ok: false; compilerVersion: string; tokens: null; rejection?: { message: string; refused: boolean; refusalCategory: string | null }; constraints: ConstraintResult[]; repairs: Repair[]; reasons: string[] };

export interface Realization {
  tokens: Record<string, string>;
  constraints: ConstraintResult[];
  repairs: Repair[];
}

export type RealizationsResult =
  | { ok: true; compilerVersion: string; directionVersion: "1"; realizations: Record<Scheme, Realization>; reasons: string[] }
  | { ok: false; compilerVersion: string; directionVersion: null; realizations: null; reasons: string[] };

export const COMPILER_VERSION: string;
export const SCHEMES: Scheme[];
export const TEXT_RATIO: number;
export const NONTEXT_RATIO: number;
export const CONSTRAINTS: Constraint[];
export const DISPLAY_VOICE: Record<"brand" | "expressive" | "technical", { family: string; min: number; max: number; tracking: Record<"tight" | "normal" | "open", string> }>;
export const DEFAULT_DISPLAY_VOICE: "brand";
export const HUE_DEGREES: Record<HueFamily, number>;
export const PERMITTED_HUE_NUDGES: HueNudge[];

export function compileProposal(input: { proposal: unknown; contract?: TokenContract; scheme?: Scheme }): CompileResult;
export function compileRealizations(input: { proposal: unknown; contract?: TokenContract }): RealizationsResult;
export function normalizeProposal<T>(proposal: T): T;
export function resolveWithContract(overrides: Record<string, string>, contract?: TokenContract): Record<string, string>;
export function hueFor(family: string, nudge: string | number): number | null;
export function solveToRatio(input: { hue: number; sat: number; against: string; target: number; direction?: "lighter" | "darker" }): string | null;

export function parseColor(value: string): [number, number, number] | null;
export function relativeLuminance(value: string): number | null;
export function contrastRatio(a: string, b: string): number | null;
export function feasibleLuminance(fixedLuminance: number, ratio: number): { maxDark: number; minLight: number };
export function evaluate(input: { tokens: Record<string, string>; constraints?: Constraint[] }): Array<Constraint & { achieved: number; disposition: string }>;

export function rgbToHsl(hex: string): [number, number, number];
export function hslToHex(h: number, s: number, l: number): string;
export const ITERATIONS: number;
export function constraintsForRole(role: string, constraints?: Constraint[]): Constraint[];
export function roleFeasibility(role: string, tokens: Record<string, string>, constraints?: Constraint[]): unknown;
export function solveRole(role: string, tokens: Record<string, string>, options?: { seed?: string; constraints?: Constraint[] }): unknown;
