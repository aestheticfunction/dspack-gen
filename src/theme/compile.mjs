/* ============================================================
   theme-direction/compile — semantic proposal → governed token values.

   This is the deterministic half of P5, and under CANON §3b it is the
   ONLY thing permitted to produce an applicable value. A model chooses
   enum members; every colour, weight, and shadow below is derived here.

   Incubation notice and graduation path: see ./constraints.mjs.

   ── Properties this module must have, and why ────────────────────
   DETERMINISTIC. No Date.now, no Math.random, no environment reads, no
   network, no model. The same proposal, compiler version, and contract
   produce byte-identical output on every machine — which is what makes
   a receipt replayable without the original provider response.

   FAIL-CLOSED. A proposal either compiles to a fully validated override
   set or produces nothing applicable. There is no partial application:
   `tokens` is null whenever `ok` is false, so a caller cannot
   accidentally apply half a theme.

   CONSTRUCTIVE, NOT CORRECTIVE. Lightness anchors are chosen so the
   ratified constraints hold by construction; the solver is a bounded
   clamp of last resort, not the mechanism. That ordering matters —
   repairing arbitrary values after the fact distorts hue relationships
   and makes the repair fight the intent.

   IT DOES NOT TOUCH THE CONTRACT. Generated directions are runtime
   override sets, never contract themes. Beyond CANON §2c (only
   contract-selectable themes appear in the appearance control), this
   also keeps the committed contract digest stable, so the recorded
   replay evidence never goes stale because of a generated theme.

   ── The legacy dual-role token ──────────────────────────────────
   accent.green is deprecated but still consumed 130 times by frozen
   per-page styleCss, so a generated theme MUST set it and satisfy both
   of its roles at once (C9-C13). On dark surfaces the two roles agree,
   which is exactly why the vocabulary offers no light depth.
   ============================================================ */

import { CONSTRAINTS, TEXT_RATIO, contrastRatio, evaluate, relativeLuminance } from "./constraints.mjs";
import { hslToHex, rgbToHsl } from "./solve.mjs";

export const COMPILER_VERSION = "theme-direction-compiler@2.0.0";
export const BISECTION_STEPS = 42;

/* ---------- ratified derivation constants ----------
   Every number here is part of the compiler's identity: changing one changes
   every theme it has ever produced, so COMPILER_VERSION moves with it and old
   receipts replay against their recorded version. */

export const HUE_DEGREES = {
  red: 2, ember: 18, amber: 38, gold: 48, olive: 72, green: 108, sage: 92,
  teal: 168, cyan: 188, sky: 205, blue: 222, indigo: 252, violet: 278,
  magenta: 305, rose: 340, neutral: 40,
};

export const DEPTH_LIGHTNESS = { abyss: 0.055, deep: 0.075, dim: 0.095, dusk: 0.115 };

/* ---------- the scheme axis (DR-25) ----------

   A composed appearance is ONE semantic art direction with TWO realizations.
   What the visitor chose - the hue families, the tint, the contrast
   character, the chroma, the presence, the typography, the elevation
   character - is shared. What the environment decides is derived per scheme:
   the surfaces, the inks, every accent role, the veil, the shadow.

   The depth vocabulary keeps its meaning in both. `abyss` is the deepest
   the page goes and `dusk` the shallowest; on paper that reads as the most
   and least ink in the stock, so the light table mirrors the dark one
   around the page rather than inventing a second vocabulary. A visitor who
   asked for "abyss" and then switched to Light gets the same intent, not a
   different one. */
export const SCHEMES = ["dark", "light"];

export const DEPTH_LIGHTNESS_BY_SCHEME = {
  dark: DEPTH_LIGHTNESS,
  light: { abyss: 0.93, deep: 0.945, dim: 0.958, dusk: 0.97 },
};

/* On dark the surface ramp steps UP away from the page; on light it steps
   DOWN. Same shape, mirrored, so bg-1/bg-2/line keep their relationship to
   the page in either scheme. Light steps are slightly smaller because the
   eye reads separation on paper at a lower delta than it does on near-black. */
export const SURFACE_STEPS_BY_SCHEME = {
  dark: { "bg-1": 0.018, "bg-2": 0.04, "line-soft": 0.055, line: 0.105 },
  light: { "bg-1": -0.014, "bg-2": -0.032, "line-soft": -0.05, line: -0.115 },
};

/* Presence biases the accent WITHIN its feasible interval. On dark the
   interval opens upward from a floor, so presence pushes lightness up; on
   light it opens downward from a ceiling, so presence pushes it DOWN. The
   magnitudes match: "carry" means the same amount of assertion either way.
   Unmirrored, `carry` on paper would lighten the accent - less contrast,
   the opposite of what the word means. */
export const PRESENCE_BIAS_BY_SCHEME = {
  dark: { recede: 0.0, balance: 0.04, carry: 0.1 },
  light: { recede: 0.0, balance: -0.04, carry: -0.1 },
};

/* The derived accent family, signed per scheme. On dark, "bright" is lighter
   than the accent and "deep" darker; on paper both invert, because the
   emphasis step must move AWAY from the page in each. */
export const ACCENT_STEPS_BY_SCHEME = {
  dark: { bright: 0.09, deep: -0.12, drift: -0.02 },
  light: { bright: -0.09, deep: 0.12, drift: 0.02 },
};

/* The extreme the accent may not pass: nearly white on dark, nearly black on
   light. Expressed as the far end of the feasible run, per scheme. */
export const ACCENT_EXTREME = { dark: 0.92, light: 0.08 };
export const TINT_SATURATION = { none: 0.0, whisper: 0.035, tinted: 0.085, saturated: 0.15 };

/* Lightness offsets from the page background, in HSL L. These reproduce the
   committed default's ramp shape rather than inventing a new one. */
export const SURFACE_STEPS = { "bg-1": 0.018, "bg-2": 0.04, "line-soft": 0.055, line: 0.105 };

export const INK_HUE = { cool: 215, neutral: 45, warm: 32 };
export const INK_SATURATION = 0.06;
/* Target contrast against the page background. fg-faint is decorative and is
   deliberately NOT held to a text ratio; ink.fg-secondary is the readable role
   and carries the 4.5 floor (the split delivered in P4.6 F1). */
export const INK_TARGETS = {
  soft: { fg: 11.0, "fg-body": 8.0, "fg-dim": 5.4, "fg-secondary": 4.8, "fg-faint": 3.1 },
  standard: { fg: 13.0, "fg-body": 9.0, "fg-dim": 5.8, "fg-secondary": 4.9, "fg-faint": 3.2 },
  stark: { fg: 15.5, "fg-body": 10.5, "fg-dim": 6.4, "fg-secondary": 5.1, "fg-faint": 3.3 },
};

export const CHROMA_SATURATION = { muted: 0.18, soft: 0.28, clear: 0.4, vivid: 0.55, electric: 0.72 };
/* `presence` biases WITHIN the feasible interval; it never leaves it.

   Deliberately SMALL lightness steps. The accent's floor is already set by
   readability against the lightest surface, and on a dark page that floor is
   fairly light; pushing much beyond it washes the chroma out entirely. A first
   draft used 0.35/0.75 here and turned "vivid red, carrying the page" into pale
   pink (#ecbec1), which is the wrong answer even though every constraint
   passed. Presence therefore modulates CHROMA primarily and lightness only
   slightly. */
export const PRESENCE_BIAS = { recede: 0.0, balance: 0.04, carry: 0.1 };
export const PRESENCE_CHROMA = { recede: 0.82, balance: 1.0, carry: 1.18 };

export const HEADLINE_WEIGHT = { light: "300", regular: "400", medium: "500", semibold: "600", bold: "700" };
export const HEADLINE_TRACKING = { tight: "-0.02em", normal: "-0.01em", open: "0.01em" };

/* ---------- the display voice (DR-19) ----------
   The model chooses one of these three names and nothing else. Everything a
   browser could act on — the family, the weights that family actually has,
   the tracking that suits it — is derived here, from the committed
   catalogue, and can never come from the proposal.

   `min`/`max` are the weights contract/fonts/catalog.json really commits for
   that family, so a clamped weight always resolves to a face that exists.
   That is what makes synthetic emboldening unreachable rather than merely
   discouraged, and it is why the receipt can state a weight the visitor did
   not ask for: it states the one that renders.

   The tracking rows reproduce the pairings the contract already ratified for
   these families as authoring themes (hl-anton at 0, hl-saira at -0.005em),
   so family and tracking have one authority instead of two that can drift.
   check-theme-compile CC9 asserts that agreement. */
export const DEFAULT_DISPLAY_VOICE = "brand";
export const DISPLAY_VOICE = {
  brand: {
    family: "'Oswald'", min: 300, max: 700,
    tracking: { tight: "-0.02em", normal: "-0.01em", open: "0.01em" },
  },
  expressive: {
    family: "'Anton'", min: 400, max: 400,
    tracking: { tight: "-0.01em", normal: "0", open: "0.02em" },
  },
  technical: {
    family: "'Saira Condensed'", min: 500, max: 700,
    tracking: { tight: "-0.015em", normal: "-0.005em", open: "0.015em" },
  },
};

/* An absent displayVoice is normalised to `brand` HERE, once, and the
   normalised proposal is what compiles, what the receipt reports, what the
   payload hash covers, and what a browser persists. The field is optional in
   v1 on purpose: making it required would have made every proposal recorded
   before this compiler schema-invalid while the schema still promised that
   an old proposal replays forever (F353 seeds exactly that contradiction).
   Optional-and-normalised keeps both promises — old proposals stay valid and
   compile byte-identically to today's Oswald, and no consumer downstream has
   to know the field can be missing. */
export function normalizeProposal(proposal) {
  if (!proposal || typeof proposal !== "object") return proposal;
  const typography = proposal.typography;
  if (!typography || typeof typography !== "object") return proposal;
  if (typeof typography.displayVoice === "string") return proposal;
  return { ...proposal, typography: { ...typography, displayVoice: DEFAULT_DISPLAY_VOICE } };
}
export const ELEVATION_SHADOW = {
  flat: "0 1px 2px rgba(0,0,0,.28)",
  soft: "0 6px 18px rgba(0,0,0,.32)",
  standard: "0 10px 30px rgba(0,0,0,.4)",
  dramatic: "0 18px 48px rgba(0,0,0,.5)",
};
export const VEIL_BY_DEPTH = { abyss: "rgba(0,0,0,.62)", deep: "rgba(0,0,0,.55)", dim: "rgba(0,0,0,.48)", dusk: "rgba(0,0,0,.4)" };

/* The vignette and the menu shadow stay BLACK in both schemes - a shadow is
   an absence of light on paper too - but paper takes a fraction of the
   alpha near-black does, or the page reads as smudged rather than lit. */
export const VEIL_BY_DEPTH_BY_SCHEME = {
  dark: VEIL_BY_DEPTH,
  light: { abyss: "rgba(0,0,0,.10)", deep: "rgba(0,0,0,.08)", dim: "rgba(0,0,0,.06)", dusk: "rgba(0,0,0,.05)" },
};
export const ELEVATION_SHADOW_BY_SCHEME = {
  dark: ELEVATION_SHADOW,
  light: {
    flat: "0 1px 2px rgba(0,0,0,.06)",
    soft: "0 6px 18px rgba(0,0,0,.10)",
    standard: "0 10px 30px rgba(0,0,0,.12)",
    dramatic: "0 18px 48px rgba(0,0,0,.18)",
  },
};

/* ---------- primitives ---------- */

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/* The nudge arrives as a STRING enum ("-12".."+12") so the schema can bound it
   without numeric constraints. That makes Number() the wrong validator on its
   own: Number("+99") is a perfectly good 99, so an out-of-enum nudge used to
   compile into a real theme rather than being refused. The permitted set is
   named here and checked, so the compiler refuses the same values the schema
   refuses even when it is called directly. */
export const PERMITTED_HUE_NUDGES = ["-12", "-6", "0", "+6", "+12"];

export function hueFor(family, nudge) {
  const base = HUE_DEGREES[family];
  if (base === undefined) return null;
  if (!PERMITTED_HUE_NUDGES.includes(String(nudge))) return null;
  const hue = (((base + Number(nudge)) % 360) + 360) % 360;
  return Number.isFinite(hue) ? hue : null;
}

/* Bisection on lightness at fixed hue/saturation to hit a target contrast
   against a fixed colour. Lightness is monotonic in luminance for fixed hue and
   saturation, so this converges; the step count is fixed so the result is
   identical on every machine. `direction` says which side of the background
   to land on; unstated, it is derived from the background's own lightness,
   which is what lets one solver serve both schemes. */
export function solveToRatio({ hue, sat, against, target, direction }) {
  /* Which side of the background to land on. Unstated, it follows the
     background itself: text goes lighter than a dark page and darker than a
     light one. Naming it explicitly still wins, because the accent's fill
     role has to land on a specific side regardless of the page. */
  if (!direction) direction = relativeLuminanceToL(against) > 0.5 ? "darker" : "lighter";
  let lo = direction === "lighter" ? relativeLuminanceToL(against) : 0;
  let hi = direction === "lighter" ? 1 : relativeLuminanceToL(against);
  let best = null;
  for (let i = 0; i < BISECTION_STEPS; i++) {
    const mid = (lo + hi) / 2;
    const hex = hslToHex(hue / 360, sat, mid);
    const r = contrastRatio(hex, against);
    if (r === null) break;
    if (r >= target) { best = hex; if (direction === "lighter") hi = mid; else lo = mid; }
    else if (direction === "lighter") lo = mid; else hi = mid;
  }
  return best;
}

/* Approximate L for a hex, used only to bound the search interval. */
function relativeLuminanceToL(hex) {
  const [, , l] = rgbToHsl(hex);
  return l;
}

/* ---------- compilation ---------- */

export function compileProposal({ proposal: raw, contract, scheme = "dark" }) {
  if (!SCHEMES.includes(scheme)) {
    return { ok: false, compilerVersion: COMPILER_VERSION, directionVersion: null, tokens: null, constraints: [], repairs: [], reasons: [`unknown scheme "${scheme}"`] };
  }
  const repairs = [];
  const reasons = [];
  /* Normalised first, so every path below — including the browser's restore
     path, which compiles straight from persisted state — sees exactly one
     shape. */
  const proposal = normalizeProposal(raw);

  if (!proposal || proposal.directionVersion !== "1") {
    return reject("the proposal does not declare directionVersion 1", { repairs, reasons });
  }
  if (proposal.refusal === true) {
    return reject(`the direction refused the request (${proposal.refusalCategory})`, { repairs, reasons, refused: true, refusalCategory: proposal.refusalCategory });
  }

  /* --- surfaces --- */
  const sHue = hueFor(proposal.surface.hueFamily, proposal.surface.hueNudge);
  if (sHue === null) return reject("unknown surface hue family or nudge", { repairs, reasons });
  const neutralish = proposal.surface.hueFamily === "neutral" ? 0.18 : 1;
  /* Looked up and CHECKED before the multiplication. The guard below used to sit
     after it, testing `sSat === undefined` — but undefined * 0.18 is NaN, not
     undefined, so the check could never fire and an unknown tint reached the
     colour maths as NaN instead of being refused. */
  const tintSat = TINT_SATURATION[proposal.surface.tint];
  const baseL = DEPTH_LIGHTNESS_BY_SCHEME[scheme][proposal.surface.depth];
  if (tintSat === undefined || baseL === undefined) return reject("unknown surface tint or depth", { repairs, reasons });
  const sSat = tintSat * neutralish;

  const tokens = {
    "surface.bg": hslToHex(sHue / 360, sSat, baseL),
    "surface.veil": VEIL_BY_DEPTH_BY_SCHEME[scheme][proposal.surface.depth],
  };
  for (const [name, d] of Object.entries(SURFACE_STEPS_BY_SCHEME[scheme])) {
    tokens[`surface.${name}`] = hslToHex(sHue / 360, sSat, clamp01(baseL + d));
  }

  /* --- ink, solved to target ratios against the page background --- */
  const iHue = INK_HUE[proposal.ink.warmth];
  const targets = INK_TARGETS[proposal.ink.contrastCharacter];
  if (iHue === undefined || !targets) return reject("unknown ink warmth or contrast character", { repairs, reasons });
  for (const [name, target] of Object.entries(targets)) {
    const against = name === "fg-secondary" || name === "fg-faint" ? tokens["surface.bg-2"] : tokens["surface.bg"];
    const hex = solveToRatio({ hue: iHue, sat: INK_SATURATION, against, target });
    if (!hex) return reject(`no ink value reaches ${target}:1 for ink.${name}`, { repairs, reasons });
    tokens[`ink.${name}`] = hex;
  }

  /* --- accent ---
     accent.green must satisfy BOTH roles at once (C9-C13 plus C10's label),
     so it is solved against the hardest surface and then checked as a fill. */
  const aHue = hueFor(proposal.accent.hueFamily, proposal.accent.hueNudge);
  const chromaBias = PRESENCE_CHROMA[proposal.accent.presence];
  const aSat = CHROMA_SATURATION[proposal.accent.chroma] === undefined || chromaBias === undefined
    ? undefined
    : clamp01(CHROMA_SATURATION[proposal.accent.chroma] * chromaBias);
  if (aHue === null || aSat === undefined) return reject("unknown accent hue family or chroma", { repairs, reasons });

  /* The ink that sits ON the accent. On dark it is a very dark tint of the
     accent hue; on light it is a very LIGHT one. This is the token DR-5
     identified as the reason no light theme could exist: fixed near-black,
     it forced the accent fill light while the text role wanted it dark, and
     the two intervals were disjoint. Per scheme, both roles resolve. */
  const onAccentL = scheme === "light" ? 0.97 : 0.055;
  tokens["ink.on-accent"] = hslToHex(aHue / 360, Math.min(aSat, 0.35), onAccentL);

  /* One bound from each role, and the accent must satisfy both:
       TEXT  - readable on the surface furthest from the page (bg-2)
       FILL  - carries ink.on-accent as a label
     On dark both bounds are floors and the feasible run opens upward; on
     light both are ceilings and it opens downward. Same two constraints,
     mirrored, which is exactly what the split accent roles bought. */
  const textBound = solveToRatio({ hue: aHue, sat: aSat, against: tokens["surface.bg-2"], target: TEXT_RATIO });
  const fillBound = solveToRatio({
    hue: aHue, sat: aSat, against: tokens["ink.on-accent"], target: TEXT_RATIO,
    direction: scheme === "light" ? "darker" : "lighter",
  });
  if (!textBound || !fillBound) return reject("the accent cannot satisfy both of its roles at this hue and chroma", { repairs, reasons });

  const tL = rgbToHsl(textBound)[2], fL = rgbToHsl(fillBound)[2];
  /* the stricter of the two bounds, in the direction this scheme opens */
  const boundL = scheme === "light" ? Math.min(tL, fL) : Math.max(tL, fL);
  const extreme = ACCENT_EXTREME[scheme];
  const headroom = scheme === "light" ? Math.max(0, boundL - extreme) : Math.max(0, extreme - boundL);
  const accentL = clamp01(boundL + headroom * PRESENCE_BIAS_BY_SCHEME[scheme][proposal.accent.presence]);
  const accent = hslToHex(aHue / 360, aSat, accentL);

  tokens["accent.green"] = accent;
  tokens["accent.accent-text"] = accent;
  tokens["accent.accent-fill"] = accent;
  /* The successor roles (DR-23 S1). Emitted at the values their
     predecessor roles carry so a composition recolors the repointed
     consumers exactly as it recolored the old ones: edge rides the fill
     value, link and the hover fill ride the bright step. Widening this
     output set moves COMPILER_VERSION — the one recorded recall event. */
  tokens["accent.accent-edge"] = accent;
  const steps = ACCENT_STEPS_BY_SCHEME[scheme];
  const bright = hslToHex(aHue / 360, aSat, clamp01(accentL + steps.bright));
  tokens["accent.green-bright"] = bright;
  tokens["accent.accent-link"] = bright;
  tokens["accent.accent-fill-hover"] = bright;
  tokens["accent.green-deep"] = hslToHex(aHue / 360, aSat, clamp01(accentL + steps.deep));
  tokens["accent.drift"] = hslToHex((((aHue - 28) % 360) + 360) / 360 % 1, Math.max(0, aSat - 0.08), clamp01(accentL + steps.drift));
  const [gr, gg, gb] = hexToRgb(accent);
  const glow = `rgba(${gr},${gg},${gb},.16)`;
  tokens["accent.green-glow"] = glow;
  tokens["accent.accent-glow"] = glow;

  /* --- governed typography and elevation (narrow TH2 amendment; DR-19) --- */
  const voice = DISPLAY_VOICE[proposal.typography.displayVoice];
  if (!voice) return reject("unknown display voice", { repairs, reasons });

  /* The requested weight, then clamped to what this family actually ships.
     `expressive` + `bold` compiles to 400 because Anton has one face, and the
     receipt says 400: the value that renders, not the one that was asked
     for. An unclamped weight would ask the browser to synthesise a face the
     catalogue does not carry. */
  const asked = HEADLINE_WEIGHT[proposal.typography.headlineWeight];
  const tracking = voice.tracking[proposal.typography.headlineTracking];
  if (!asked || !tracking) return reject("unknown typography character", { repairs, reasons });

  tokens["type.display"] = voice.family;
  tokens["type.hl-weight"] = String(Math.min(voice.max, Math.max(voice.min, Number(asked))));
  tokens["type.hl-tracking"] = tracking;
  tokens["elevation.shadow-menu"] = ELEVATION_SHADOW_BY_SCHEME[scheme][proposal.elevation.character];
  if (!tokens["elevation.shadow-menu"]) {
    return reject("unknown elevation character", { repairs, reasons });
  }

  /* --- validate against the RATIFIED constraint set, then bounded repair --- */
  const resolved = resolveWithContract(tokens, contract);
  let checks = evaluate({ tokens: resolved });
  const failed = checks.filter((c) => c.disposition === "failed");

  for (const c of failed) {
    /* The only repair operation authorised: re-solve the FOREGROUND of the
       failing pair on its own axis, holding hue and saturation. Nothing is
       invented, nothing is asked of a model, and the operation is named on the
       receipt. */
    const movable = c.solveFor === "bg" ? c.bg : c.fg;
    if (!movable || !(movable in tokens)) {
      reasons.push(`${c.id} failed (${c.fg} on ${c.bg} = ${c.achieved}:1, needs ${c.min}) and no authorised repair applies to it`);
      continue;
    }
    const [h, s] = rgbToHsl(tokens[movable]);
    const against = c.solveFor === "bg" ? resolved[c.fg] : resolved[c.bg];
    const fixed = solveToRatio({ hue: h * 360, sat: s, against, target: c.min });
    if (!fixed) {
      reasons.push(`${c.id} failed and no value at this hue and chroma reaches ${c.min}:1`);
      continue;
    }
    repairs.push({
      constraint: c.id, pair: `${c.fg} on ${c.bg}`, operation: "resolve-lightness-at-fixed-hue-and-chroma",
      token: movable, before: tokens[movable], after: fixed,
      achievedBefore: c.achieved, requirement: c.min,
      materiallyNarrowed: Math.abs(rgbToHsl(fixed)[2] - rgbToHsl(tokens[movable])[2]) > 0.08,
    });
    tokens[movable] = fixed;
  }

  if (repairs.length) checks = evaluate({ tokens: resolveWithContract(tokens, contract) });
  const stillFailing = checks.filter((c) => c.disposition === "failed");
  if (stillFailing.length) {
    for (const c of stillFailing) reasons.push(`${c.id}: ${c.fg} on ${c.bg} = ${c.achieved}:1, below the required ${c.min}`);
    return reject("the direction cannot satisfy the ratified accessibility constraints", { repairs, reasons, checks });
  }

  return {
    ok: true,
    compilerVersion: COMPILER_VERSION,
    directionVersion: "1",
    tokens,
    constraints: checks.map((c) => ({ id: c.id, pair: `${c.fg} on ${c.bg}`, required: c.min, achieved: c.achieved, disposition: c.disposition })),
    repairs,
    reasons,
  };
}

function reject(message, { repairs = [], reasons = [], checks = [], refused = false, refusalCategory = null } = {}) {
  /* tokens is explicitly null: there is no partial application. */
  return {
    ok: false, tokens: null, compilerVersion: COMPILER_VERSION,
    rejection: { message, refused, refusalCategory },
    constraints: checks.map((c) => ({ id: c.id, pair: `${c.fg} on ${c.bg}`, required: c.min, achieved: c.achieved, disposition: c.disposition })),
    repairs, reasons,
  };
}

/* ---------- both realizations, or none ----------

   The visitor's Color Scheme is a preference about their environment, not a
   second art direction, so one proposal must produce a governed rendering in
   whichever scheme they are in. A composition is ACCEPTED only if both
   realizations compile and satisfy every ratified constraint: half a
   composition would mean a visitor who switches to Light silently loses the
   appearance they chose, which is exactly the partial state DR-25 forbids.

   Fail-closed, symmetrically: if either scheme rejects, nothing is applied
   and the reasons name which scheme failed and why. */
export function compileRealizations({ proposal, contract }) {
  const realizations = {};
  const reasons = [];
  for (const scheme of SCHEMES) {
    const out = compileProposal({ proposal, contract, scheme });
    if (!out.ok) {
      for (const r of out.reasons ?? []) reasons.push(`${scheme}: ${r}`);
      continue;
    }
    realizations[scheme] = { tokens: out.tokens, constraints: out.constraints, repairs: out.repairs };
  }
  const ok = reasons.length === 0 && SCHEMES.every((s) => realizations[s]);
  return {
    ok,
    compilerVersion: COMPILER_VERSION,
    directionVersion: ok ? "1" : null,
    realizations: ok ? realizations : null,
    reasons,
  };
}

/* A generated theme overrides only some tokens; the constraint set is evaluated
   over the FULL resolved set, exactly as a committed theme would be. */
export function resolveWithContract(overrides, contract) {
  const base = {};
  for (const [cat, c] of Object.entries(contract?.tokens ?? {})) {
    for (const [n, v] of Object.entries(c.values ?? {})) base[`${cat}.${n}`] = v.value;
  }
  return { ...base, ...overrides };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export { CONSTRAINTS };
