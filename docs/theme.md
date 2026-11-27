# The deterministic theme compiler (`./theme`)

`@aestheticfunction/dspack-gen/theme` turns a **theme-direction proposal** into governed design-token values, or into nothing. A proposal is closed enums only, defined by `theme-direction.v1.schema.json`. It covers:
- surface hue, tint and depth;
- ink warmth and contrast;
- accent hue, chroma and presence;
- display voice, weight and tracking;
- elevation.

No colour, CSS, font reference or token name can be expressed in it. The compiler derives every value itself.

The compiler has four properties:
- **Deterministic.** No clock, randomness, environment, network or model. The same proposal, compiler version and contract give byte-identical output.
- **Fail-closed.** A proposal compiles to a complete, validated token set, or `tokens` is `null`. Nothing is ever partly applied.
- **Constrained.** Every result is evaluated against the ratified WCAG constraint set (`CONSTRAINTS`, C1 to C18b).
- **Bounded repair.** The only repair is a named lightness re-solve at fixed hue and chroma, and it is reported.

`compileRealizations` compiles one proposal for both schemes, dark and light. It accepts the proposal only if both compile.

```js
import { compileRealizations } from "@aestheticfunction/dspack-gen/theme";

const out = compileRealizations({ proposal, contract: { tokens: {} } });
if (out.ok) applyTokens(out.realizations.dark.tokens);
```

## Provenance and licence

- **Origin.** The compiler incubated in Aesthetic Function's private website repository, as `scripts/theme-direction/` at commit `910ca7c`. Its own incubation notice named this package as its destination once a second consumer appeared. dspack-studio's Composer is that consumer.
- **Licence.** Aesthetic Function, as owner, authorized releasing the compiler under this package's licence, Apache-2.0.
  - **Released:** the three modules, the proposal schema, the tests and this documentation.
  - **Not released, and still private:** the website, its brand contract, its gates, its fonts, and the optional hosted natural-language front end that proposes enums from a phrase.
  - **Third-party code:** none. The colour arithmetic is the WCAG 2.x definition, written for this module.
  - **Fonts:** the compiler names three display families (Oswald, Anton, Saira Condensed, all OFL-1.1). It ships none of them; a consumer supplies its own faces.
- **Moved verbatim.** `compile.mjs`, `constraints.mjs`, `solve.mjs` and the schema are byte-identical to the incubation copy.
  - Their comments still cite the website's internal design records (CANON, DR-n, TH-n, P-n, F-n). They are kept as provenance; they are not needed to use the compiler.
  - `src/theme/fixtures/parity-golden.json` records what the incubation copy produced for a 48-proposal grid covering every enum member, in both schemes. The tests hold this package to it.

## Public API

Everything in `index.d.ts`. The main entry points:

| Export | What it does |
|---|---|
| `compileProposal({ proposal, contract, scheme })` | One scheme. `{ ok, tokens, constraints, repairs, reasons }` |
| `compileRealizations({ proposal, contract })` | Both schemes, or none |
| `normalizeProposal(proposal)` | Fills the optional `displayVoice` with `brand`. Compilation already does this |
| `CONSTRAINTS`, `evaluate`, `contrastRatio`, `relativeLuminance` | The constraint set and the WCAG arithmetic |
| `solveToRatio`, `hslToHex`, `rgbToHsl` | The solver primitives |
| `COMPILER_VERSION` | The compiler's identity. It moves whenever any derivation constant or the output set changes |

The modules are also exported as files (`./theme/compile.mjs`, `./theme/constraints.mjs`, `./theme/solve.mjs`, `./theme/theme-direction.v1.schema.json`). A consumer that ships the compiler to a browser as one classic script can concatenate them without re-implementing anything.

The `contract` argument is read only for its token shape (`tokens.<category>.values.<name>.value`). Constraint evaluation runs over the resolved set. Every token the constraints name is produced by the compiler, so `{ tokens: {} }` is a valid contract.

## The workspace layer (`compileWorkspace`)

A working environment needs more than a site's appearance does. `compileWorkspace({ proposal, scheme, options })` calls `compileProposal` and adds tokens; it never changes one the compiler produced, and `COMPILER_VERSION` does not move for it. Its own identity is `WORKSPACE_VERSION`.

- **Status colours.** `status.success`, `status.warning`, `status.error`, `status.info` and `status.link` are solved to 4.5:1 against the hardest surface and checked on `bg`, `bg-1` and `bg-2` (W1 to W15). The link is re-solved at fixed hue and chroma if needed, and the repair is reported.
- **Workspace choices**, all closed enums, defaults first:
  - `density`: `comfortable` | `compact` → `space.scale`;
  - `textScale`: `standard` | `large` → `type.scale`;
  - `labelCase`: `sentence` | `capitals` → `label.transform`, `label.tracking`;
  - `display`: `brand` | `plain` → `type.workspace-display`;
  - `surround`: `workspace` | `light` | `dark` → `surround.bg`, a backdrop for the canvas that need not follow the chrome.
- **Fail-closed**, like the compiler: an unknown choice or a rejected proposal gives `tokens: null`.

## Versioning and consumers

- **The theme subpath is versioned with the package**, from 0.6.0. `COMPILER_VERSION` is the finer identity a stored theme or a receipt should record.
- **Consumers pin an exact package version**, because a compiler change re-derives every theme:
  - Aesthetic Function's website uses it for the visitor's composed appearance;
  - dspack-studio's Composer uses it for workspace appearances.
- **One implementation.** Consumers do not copy, fork or re-implement the compiler.
