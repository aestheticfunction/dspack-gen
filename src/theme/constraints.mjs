/* ============================================================
   theme-direction/constraints — the accessibility constraint set,
   as DATA rather than as code (P4.6 F6).

   ── Incubation notice (the DR-2 discipline, applied again) ───────
   This directory is a site-local incubation with a written graduation
   path, exactly as scripts/tokens-css/ was for the emitter. It lives
   here because the site is its first and only consumer.

     Public API (stable from day one):
       CONSTRAINTS                     the ratified pair list
       contrastRatio(a, b)             WCAG 2.x contrast
       relativeLuminance(hex)          WCAG relative luminance
       feasibleLuminance(constraint)   the interval a value may occupy
       evaluate({tokens})              every constraint, with its verdict

     Graduation trigger: the first consumer outside this repository —
     in practice Studio, or a second site adopting the contract.
     Destination: dspack-gen, as the constraint half of the
     propose → gate → repair → report loop. The DOM-level probe in
     scripts/lib/contrast-probe.js does NOT graduate; it measures a
     rendered page, which is a website's problem, not a contract's.

     Anti-calcification (DR-7): this module must not be read by more
     than one gate, or consumed by the emitter, without its RFC filed.
     Today check-themes still carries its own copy of the arithmetic;
     unifying them is a deliberate later step, because doing it in the
     same slice that INTRODUCES the module would mean the module's
     first proof was a refactor of the thing it claims to verify.

   ── What this is not ────────────────────────────────────────────
   No prompt interpretation, no model call, no provider, no generation,
   no probabilistic output, no second rendering path. This is
   arithmetic over committed values. P5 remains unauthorized.

   ── Why a constraint SET rather than a pile of checks ────────────
   check-themes grew its rules one incident at a time: TH4's ratified
   pairs, then TH6 when ember shipped at 4.44:1 against a 4.5
   requirement, then TH7's structural feasibility proof, then TH9's
   semantic roles. Each is correct and each is hand-written, so the
   constraint list exists only as the union of four loops. Written as
   data, the same list can be evaluated, explained, and — the point of
   F6 — SOLVED against, rather than only checked.
   ============================================================ */

export const TEXT_RATIO = 4.5;
export const NONTEXT_RATIO = 3.0;

/* Every constraint names the pair it governs, the threshold, why the
   threshold is what it is, and where the rule came from. `role` records
   which of the pair is the value a solver may move. */
export const CONSTRAINTS = [
  { id: "C1", fg: "ink.fg", bg: "surface.bg", min: TEXT_RATIO, kind: "text", source: "TH4" },
  { id: "C2", fg: "ink.fg", bg: "surface.bg-1", min: TEXT_RATIO, kind: "text", source: "TH4" },
  { id: "C3", fg: "ink.fg-body", bg: "surface.bg", min: TEXT_RATIO, kind: "text", source: "TH4" },
  { id: "C4", fg: "ink.fg-body", bg: "surface.bg-1", min: TEXT_RATIO, kind: "text", source: "TH4" },
  { id: "C5", fg: "ink.fg-dim", bg: "surface.bg", min: TEXT_RATIO, kind: "text", source: "TH4" },
  { id: "C6", fg: "ink.fg-dim", bg: "surface.bg-1", min: TEXT_RATIO, kind: "text", source: "TH4" },
  { id: "C7", fg: "accent.green-bright", bg: "surface.bg", min: TEXT_RATIO, kind: "text", source: "TH4" },
  { id: "C8", fg: "accent.green-bright", bg: "surface.bg-1", min: TEXT_RATIO, kind: "text", source: "TH4" },
  { id: "C9", fg: "accent.green", bg: "surface.bg", min: NONTEXT_RATIO, kind: "non-text", source: "TH4",
    note: "focus rings and borders, not text" },
  /* C10-C12: the accent's two roles. This is the pair that made daylight
     unsatisfiable, and the reason accent-text/accent-fill exist. */
  { id: "C10", fg: "ink.on-accent", bg: "accent.green", min: TEXT_RATIO, kind: "text", source: "TH4/TH8", solveFor: "bg",
    note: "the primary-button label sits ON the accent, so here the accent is the BACKGROUND" },
  { id: "C11", fg: "accent.green", bg: "surface.bg", min: TEXT_RATIO, kind: "text", source: "TH6", solveFor: "fg" },
  { id: "C12", fg: "accent.green", bg: "surface.bg-1", min: TEXT_RATIO, kind: "text", source: "TH6", solveFor: "fg" },
  { id: "C13", fg: "accent.green", bg: "surface.bg-2", min: TEXT_RATIO, kind: "text", source: "TH6", solveFor: "fg",
    note: "bg-2 was missing from TH4's ratified pairs, which is how ember shipped at 4.44:1" },
  /* C14-C17: the semantic roles, which exist so the accent stops carrying
     two incompatible jobs (TH9). */
  { id: "C14", fg: "accent.accent-text", bg: "surface.bg", min: TEXT_RATIO, kind: "text", source: "TH9", solveFor: "fg" },
  { id: "C15", fg: "accent.accent-text", bg: "surface.bg-1", min: TEXT_RATIO, kind: "text", source: "TH9", solveFor: "fg" },
  { id: "C16", fg: "accent.accent-text", bg: "surface.bg-2", min: TEXT_RATIO, kind: "text", source: "TH9", solveFor: "fg" },
  { id: "C17", fg: "ink.on-accent", bg: "accent.accent-fill", min: TEXT_RATIO, kind: "text", source: "TH9", solveFor: "bg" },

  /* C18-C18b: the readable secondary tier, ratified at the Scheme Release
     Ceremony (DR-25) in the same commit as the values that satisfy it.

     ink.fg-secondary was split from ink.fg-faint at DR-6 and has carried NO
     constraint since — it was the same value as the decorative token it was
     split from, and it failed at roughly 2.9:1 against surface.bg-2 in all
     three appearances. It also sat QUIETER than ink.fg-dim, which is backwards
     for a role whose entire definition is "secondary text that must stay
     readable".

     The constraint could not land earlier without reddening every build: there
     is no baseline mechanism here and no intention to grow one, so the rule
     arrives with its repair. bg-2 is the binding surface in both schemes — it
     is the lightest in dark and the darkest in light — and bg-1 is listed too
     rather than inferred, because "the hardest one passes" stops being true
     the moment someone re-solves a surface ramp. */
  { id: "C18", fg: "ink.fg-secondary", bg: "surface.bg-2", min: TEXT_RATIO, kind: "text", source: "TH4", solveFor: "fg" },
  { id: "C18b", fg: "ink.fg-secondary", bg: "surface.bg-1", min: TEXT_RATIO, kind: "text", source: "TH4", solveFor: "fg" },
];

/* ---------- WCAG arithmetic ---------- */

export function parseColor(v) {
  const hex = String(v ?? "").trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hex) return null; // rgba() and other forms are not part of the ratified pairs
  const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance(v) {
  const rgb = parseColor(v);
  if (!rgb) return null;
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb;
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- feasibility ----------

   For a required ratio R against a FIXED counterpart of luminance L, the
   value being solved for must satisfy one of two disjoint intervals:

     darker : L_v <= (L + 0.05) / R - 0.05
     lighter: L_v >= R * (L + 0.05) - 0.05

   Legible text may be either darker or lighter than its surface, so the
   feasible set is a union — which is precisely what makes the accent's
   two roles a real question rather than an obvious one. */
export function feasibleLuminance(fixedLuminance, ratio) {
  return {
    maxDark: (fixedLuminance + 0.05) / ratio - 0.05,
    minLight: ratio * (fixedLuminance + 0.05) - 0.05,
  };
}

/* ---------- evaluation ---------- */

export function evaluate({ tokens, constraints = CONSTRAINTS }) {
  return constraints.map((c) => {
    const fg = tokens[c.fg];
    const bg = tokens[c.bg];
    if (fg === undefined || bg === undefined) {
      return { ...c, disposition: "not-applicable", reason: `${fg === undefined ? c.fg : c.bg} is not defined by this theme` };
    }
    const achieved = contrastRatio(fg, bg);
    if (achieved === null) {
      return { ...c, disposition: "unverifiable", reason: "one side is not a plain hex value" };
    }
    return {
      ...c,
      fgValue: fg,
      bgValue: bg,
      achieved: Number(achieved.toFixed(4)),
      disposition: achieved >= c.min ? "passed" : "failed",
    };
  });
}
