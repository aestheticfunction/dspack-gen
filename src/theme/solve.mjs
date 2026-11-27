/* ============================================================
   theme-direction/solve — deterministic feasibility and repair over
   the constraint set (P4.6 F6).

   Incubation notice and graduation path: see ./constraints.mjs.

   Two questions, both answered by arithmetic on committed values:

     roleFeasibility(role, tokens)
       Given the surfaces a theme actually declares, what interval of
       luminance may this role occupy? Empty means no value can work,
       and the caller gets the numbers rather than a verdict to trust.

     solveRole(role, tokens)
       If the interval is non-empty, return a concrete value inside it,
       found by bisection on lightness while holding hue and chroma —
       so a repair reads as the same colour, corrected, rather than as
       a different colour.

   ── The claim this module has to earn ────────────────────────────
   DR-5 withheld the Daylight theme with a specific arithmetic finding:
   accent.green as text on surface.bg-2 needs relative luminance
   <= 0.1202, while beneath the fixed #10120c label it needs >= 0.2006,
   and the ranges do not overlap. That verdict was reached by hand,
   independently of this code, and is quoted in the shipped contract.

   So the first thing this solver must do is REPRODUCE it — the same
   two numbers, to four decimal places, from the committed theme. A
   solver that cannot re-derive a conclusion the project already
   reached by hand is not yet evidence of anything. check-solver holds
   it to that, and then to the converse: that the same solver finds the
   split (accent-text distinct from accent-fill) feasible, which is the
   whole reason those roles exist.

   ── Not in scope, by authorization ───────────────────────────────
   No prompt interpretation, no model call, no provider selection, no
   hosted generation, no Worker endpoint, no probabilistic output, no
   second rendering path. Nothing here runs in a browser or ships to
   one. P5 remains unauthorized.
   ============================================================ */

import { CONSTRAINTS, TEXT_RATIO, contrastRatio, feasibleLuminance, parseColor, relativeLuminance } from "./constraints.mjs";

/* Which constraints govern a given role, and on which side it sits. */
export function constraintsForRole(role, constraints = CONSTRAINTS) {
  return constraints.filter((c) => (c.solveFor === "fg" && c.fg === role) || (c.solveFor === "bg" && c.bg === role));
}

/* The luminance interval a role may occupy, given everything else fixed.

   Each governing constraint contributes either a union of two intervals
   (when the role is TEXT on a fixed surface: it may be darker or lighter)
   or a single lower bound (when the role is the FILL beneath fixed ink:
   it must be light enough). Intersecting them is the feasibility question.

   Returned as explicit branches rather than a boolean, because the useful
   output when a theme is impossible is the arithmetic, not the word "no". */
export function roleFeasibility(role, tokens, constraints = CONSTRAINTS) {
  const governing = constraintsForRole(role, constraints);
  if (!governing.length) return { role, governing: [], feasible: true, reason: "no constraint governs this role" };

  let darkUpper = 1; // as text: must be at most this to be darker than every surface
  let lightLower = 0; // as text: must be at least this to be lighter than every surface
  /* As FILL, the ink on top must read. Which side of that ink the fill has to
     sit on depends on the ink: beneath a near-black label the fill must be
     light enough, beneath a near-white one it must be dark enough. Recording
     only the lighter bound was a dark-scheme assumption - the site's label
     was always near-black - and it made every light realization look
     infeasible no matter how much contrast it actually had (DR-25). */
  let fillLower = 0;
  let fillUpper = 1;
  const terms = [];

  for (const c of governing) {
    if (c.solveFor === "fg") {
      const L = relativeLuminance(tokens[c.bg]);
      if (L === null) continue;
      const { maxDark, minLight } = feasibleLuminance(L, c.min);
      darkUpper = Math.min(darkUpper, maxDark);
      lightLower = Math.max(lightLower, minLight);
      terms.push({ id: c.id, against: c.bg, as: "text", maxDark: round(maxDark), minLight: round(minLight) });
    } else {
      const L = relativeLuminance(tokens[c.fg]);
      if (L === null) continue;
      const { maxDark, minLight } = feasibleLuminance(L, c.min);
      fillLower = Math.max(fillLower, minLight);
      fillUpper = Math.min(fillUpper, maxDark);
      terms.push({ id: c.id, beneath: c.fg, as: "fill", maxDark: round(maxDark), minLight: round(minLight) });
    }
  }

  /* Two disjoint branches survive: darker than every surface, or lighter than
     every surface. Each takes the fill bound that points the same way, so a
     dark fill under a light label and a light fill under a dark label are both
     reachable - which is what makes one role work in both schemes. */
  const darkBranch = { lo: 0, hi: Math.min(darkUpper, fillUpper), ok: 0 <= Math.min(darkUpper, fillUpper) };
  const lightBranch = { lo: Math.max(lightLower, fillLower), hi: 1 };
  lightBranch.ok = lightBranch.lo <= lightBranch.hi;

  return {
    role,
    governing: governing.map((c) => c.id),
    terms,
    darkBranch: { lo: round(darkBranch.lo), hi: round(darkBranch.hi), ok: darkBranch.ok },
    lightBranch: { lo: round(lightBranch.lo), hi: round(lightBranch.hi), ok: lightBranch.ok },
    feasible: darkBranch.ok || lightBranch.ok,
  };
}

const round = (n) => Number(n.toFixed(4));

/* ---------- solving ----------

   Bisection on LIGHTNESS in HSL, holding hue and saturation. Lightness is
   monotonic in luminance for fixed hue/saturation, so bisection converges;
   holding hue and chroma is what makes a repair read as the same colour
   corrected rather than as a different colour substituted.

   Fixed iteration count, no randomness, no wall-clock: the same inputs
   produce the same output on every machine, which is the only reason this
   is allowed to be called a deterministic solver. */
export const ITERATIONS = 40;

export function rgbToHsl(hex) {
  const [r, g, b] = parseColor(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

export function hslToHex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))));
  };
  return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/* Find a value for `role` that satisfies every governing constraint, keeping
   the hue and saturation of `seed`. Returns null when the role is infeasible
   — the solver never returns a value that fails, because a repair that does
   not repair is worse than an honest refusal. */
export function solveRole(role, tokens, { seed = tokens[role], constraints = CONSTRAINTS } = {}) {
  const f = roleFeasibility(role, tokens, constraints);
  if (!f.feasible) return { role, solved: false, feasibility: f, reason: "no value can satisfy every governing constraint" };
  if (!parseColor(seed)) return { role, solved: false, feasibility: f, reason: "seed is not a plain hex value" };

  const [h, s] = rgbToHsl(seed);
  const satisfies = (hex) =>
    constraintsForRole(role, constraints).every((c) => {
      const a = c.solveFor === "fg" ? hex : tokens[c.fg];
      const b = c.solveFor === "fg" ? tokens[c.bg] : hex;
      const r = contrastRatio(a, b);
      return r !== null && r >= c.min;
    });

  if (satisfies(seed)) return { role, solved: true, value: seed, moved: false, feasibility: f, iterations: 0 };

  /* Try both branches; prefer the one nearer the seed's own lightness, so a
     dark theme stays dark and a light theme stays light. */
  const [, , seedL] = rgbToHsl(seed);
  const branches = [
    { name: "dark", lo: 0, hi: seedL },
    { name: "light", lo: seedL, hi: 1 },
  ].sort((a, b) => Math.abs(seedL - (a.lo + a.hi) / 2) - Math.abs(seedL - (b.lo + b.hi) / 2));

  for (const br of branches) {
    let lo = br.lo, hi = br.hi, found = null;
    for (let i = 0; i < ITERATIONS; i++) {
      const mid = (lo + hi) / 2;
      const hex = hslToHex(h, s, mid);
      if (satisfies(hex)) { found = hex; }
      /* Walk toward the extreme of this branch: darker for "dark", lighter
         for "light". The satisfying set is a tail of the interval, so once
         found we tighten toward the seed to keep the smallest change. */
      if (br.name === "dark") { if (satisfies(hex)) lo = mid; else hi = mid; }
      else { if (satisfies(hex)) hi = mid; else lo = mid; }
    }
    if (found) return { role, solved: true, value: found, moved: true, branch: br.name, feasibility: f, iterations: ITERATIONS };
  }
  /* Feasible by luminance arithmetic but not reachable at this hue and
     saturation — reported honestly rather than papered over by desaturating. */
  return { role, solved: false, feasibility: f, reason: `feasible by luminance, but no value at hue ${round(h * 360)}° and saturation ${round(s)} reaches it` };
}

export { TEXT_RATIO };
