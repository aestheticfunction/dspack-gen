/* ============================================================
   theme/workspace — a working environment's appearance, compiled from one
   theme-direction proposal plus a few closed workspace choices.

   A tool people work in all day needs more from an appearance than a site
   does: status colours that stay readable on every surface, a density, a
   text scale, a label case, and a backdrop for the thing being designed
   that does not have to follow the chrome. This module derives those, the
   same way the compiler derives everything else:

   DETERMINISTIC and FAIL-CLOSED, like compile.mjs. Every choice is a closed
   enum; an unknown one, or a proposal the compiler rejects, compiles to
   nothing (tokens: null).

   LAYERED, NOT FORKED. It calls compileProposal and adds tokens; it never
   changes a token the compiler produced. A site using compile.mjs alone is
   unaffected, and COMPILER_VERSION does not move. WORKSPACE_VERSION is this
   layer's own identity.

   CONSTRAINED. The status colours and the link are solved to the text ratio
   against the hardest surface and then checked on every surface (W1 to
   W15); the link, which the compiler only holds on bg and bg-1, is
   re-solved at fixed hue and chroma if it falls short on bg-2, and the
   repair is reported, exactly as the compiler reports its own.
   ============================================================ */

import { compileProposal, solveToRatio } from "./compile.mjs";
import { contrastRatio, TEXT_RATIO } from "./constraints.mjs";
import { rgbToHsl } from "./solve.mjs";

export const WORKSPACE_VERSION = "workspace-appearance@1.0.0";

/** The workspace choices: closed enums, each with its default first. */
export const WORKSPACE_OPTIONS = {
  density: ["comfortable", "compact"],
  textScale: ["standard", "large"],
  labelCase: ["sentence", "capitals"],
  display: ["brand", "plain"],
  surround: ["workspace", "light", "dark"],
};

export const DEFAULT_WORKSPACE = Object.freeze({ density: "comfortable", textScale: "standard", labelCase: "sentence", display: "brand", surround: "workspace" });

/** Status hues, in degrees, shared with the compiler's hue table where they coincide. */
export const STATUS_HUES = { success: 108, warning: 38, error: 2, info: 205 };
export const STATUS_SATURATION = 0.5;

/** A neutral backdrop for the canvas, independent of the workspace's own surfaces. */
export const SURROUND = { light: "#e9e8e4", dark: "#121211" };
export const DENSITY_SCALE = { comfortable: "1", compact: "0.8" };
export const TEXT_SCALE = { standard: "1", large: "1.125" };
export const LABEL_CASE = { sentence: { transform: "none", tracking: "0" }, capitals: { transform: "uppercase", tracking: "0.06em" } };

const SURFACES = ["surface.bg", "surface.bg-1", "surface.bg-2"];
const ROLES = ["success", "warning", "error", "info", "link"];

/** Why a set of workspace choices is not valid, or [] if it is. Missing choices take their defaults. */
export function workspaceOptionIssues(options) {
  if (options !== undefined && (options === null || typeof options !== "object" || Array.isArray(options))) return ["workspace options must be an object"];
  const issues = [];
  for (const key of Object.keys(options ?? {})) if (!(key in WORKSPACE_OPTIONS)) issues.push(`unknown workspace option "${key}"`);
  for (const [key, allowed] of Object.entries(WORKSPACE_OPTIONS)) {
    const v = options?.[key];
    if (v !== undefined && !allowed.includes(v)) issues.push(`workspace option ${key} must be one of ${allowed.join(", ")}`);
  }
  return issues;
}

export function compileWorkspace({ proposal, scheme = "dark", options, contract = { tokens: {} } }) {
  const issues = workspaceOptionIssues(options);
  if (issues.length) return reject(issues);
  const choice = { ...DEFAULT_WORKSPACE, ...(options ?? {}) };
  const base = compileProposal({ proposal, contract, scheme });
  if (!base.ok) return reject(base.reasons?.length ? base.reasons : [base.rejection?.message ?? "the proposal did not compile"], base.compilerVersion);

  const tokens = { ...base.tokens };
  const repairs = [];
  // The hardest surface for text: the lightest in dark (bg-2), the darkest in light (bg-2).
  const hardest = tokens["surface.bg-2"];
  for (const [role, hue] of Object.entries(STATUS_HUES)) {
    const hex = solveToRatio({ hue, sat: STATUS_SATURATION, against: hardest, target: TEXT_RATIO });
    if (!hex) return reject([`no ${role} colour reaches ${TEXT_RATIO}:1 on this scheme's surfaces`], base.compilerVersion);
    tokens[`status.${role}`] = hex;
  }
  let link = tokens["accent.accent-link"];
  if ((contrastRatio(link, hardest) ?? 0) < TEXT_RATIO) {
    const [h, s] = rgbToHsl(link);
    const fixed = solveToRatio({ hue: h * 360, sat: s, against: hardest, target: TEXT_RATIO });
    if (!fixed) return reject(["the link colour cannot reach the text ratio on the deepest surface"], base.compilerVersion);
    repairs.push({ constraint: "W-link", operation: "resolve-lightness-at-fixed-hue-and-chroma", token: "status.link", before: link, after: fixed });
    link = fixed;
  }
  tokens["status.link"] = link;

  const constraints = [];
  let n = 0;
  for (const role of ROLES) {
    for (const surface of SURFACES) {
      const achieved = contrastRatio(tokens[`status.${role}`], tokens[surface]);
      constraints.push({ id: `W${++n}`, pair: `status.${role} on ${surface}`, required: TEXT_RATIO, achieved: Math.round(achieved * 100) / 100, disposition: achieved >= TEXT_RATIO ? "satisfied" : "failed" });
    }
  }
  const failed = constraints.filter((c) => c.disposition === "failed");
  if (failed.length) return reject(failed.map((c) => `${c.id}: ${c.pair} = ${c.achieved}:1, below ${c.required}`), base.compilerVersion);

  tokens["space.scale"] = DENSITY_SCALE[choice.density];
  tokens["type.scale"] = TEXT_SCALE[choice.textScale];
  tokens["label.transform"] = LABEL_CASE[choice.labelCase].transform;
  tokens["label.tracking"] = LABEL_CASE[choice.labelCase].tracking;
  tokens["type.workspace-display"] = choice.display === "brand" ? tokens["type.display"] : "plain";
  tokens["surround.bg"] = choice.surround === "workspace" ? tokens["surface.bg"] : SURROUND[choice.surround];

  return {
    ok: true,
    workspaceVersion: WORKSPACE_VERSION,
    compilerVersion: base.compilerVersion,
    scheme,
    options: choice,
    tokens,
    constraints: [...base.constraints, ...constraints],
    repairs: [...base.repairs, ...repairs],
  };
}

function reject(reasons, compilerVersion = null) {
  return { ok: false, workspaceVersion: WORKSPACE_VERSION, compilerVersion, tokens: null, reasons };
}
