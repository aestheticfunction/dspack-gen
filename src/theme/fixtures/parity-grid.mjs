/**
 * The parity grid: a deterministic set of theme-direction v1 proposals in which every enum member appears at
 * least once. parity-golden.json records what the compiler produced for each, in both schemes, when it was
 * graduated from its incubation in af-site (scripts/theme-parity-golden.mjs wrote it). The tests hold the
 * graduated compiler to those outputs, so the move changed nothing a consumer can observe.
 */
const F = ["red", "ember", "amber", "gold", "olive", "green", "sage", "teal", "cyan", "sky", "blue", "indigo", "violet", "magenta", "rose", "neutral"];
const A = F.slice(0, 15);
const NUDGE = ["-12", "-6", "0", "+6", "+12"], TINT = ["none", "whisper", "tinted", "saturated"], DEPTH = ["abyss", "deep", "dim", "dusk"];
const WARM = ["cool", "neutral", "warm"], CONTRAST = ["soft", "standard", "stark"], CHROMA = ["muted", "soft", "clear", "vivid", "electric"];
const PRESENCE = ["recede", "balance", "carry"], VOICE = ["brand", "expressive", "technical", null], WEIGHT = ["light", "regular", "medium", "semibold", "bold"];
const TRACK = ["tight", "normal", "open"], ELEV = ["flat", "soft", "standard", "dramatic"];
export function grid() {
  const out = [];
  for (let i = 0; i < 48; i++) {
    const typography = { headlineWeight: WEIGHT[i % 5], headlineTracking: TRACK[(i + 1) % 3] };
    const voice = VOICE[i % 4];
    if (voice) typography.displayVoice = voice;
    out.push({
      id: `grid-${String(i).padStart(2, "0")}`,
      proposal: {
        directionVersion: "1", refusal: false, refusalCategory: "none", interpretation: `Parity grid proposal ${i}.`,
        surface: { hueFamily: F[i % 16], hueNudge: NUDGE[i % 5], tint: TINT[(i >> 1) % 4], depth: DEPTH[(i >> 2) % 4] },
        ink: { warmth: WARM[i % 3], contrastCharacter: CONTRAST[(i >> 1) % 3] },
        accent: { hueFamily: A[(i * 7) % 15], hueNudge: NUDGE[(i + 2) % 5], chroma: CHROMA[(i >> 1) % 5], presence: PRESENCE[(i + 1) % 3] },
        typography,
        elevation: { character: ELEV[(i + 3) % 4] },
      },
    });
  }
  return out;
}
