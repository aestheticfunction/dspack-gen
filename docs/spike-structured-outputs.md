# S0 spike — Ollama structured outputs vs. the real generation schema

**Date:** 2026-07-02 · **Ollama:** 0.31.1 (macOS, Apple Silicon) · **Scripts:** `spike/` (results JSON checked in alongside)

Bounded pre-PR-3 spike per the M1 plan. Three questions, answered below. No prompt
optimization, no eval matrix — that is PR-10.

## Setup

Hand-written approximation of the per-contract generation schema
(`spike/build-generation-schema.mjs`): full shadcn v0.3 vocabulary (7 components + 32
sub-components = 39 anyOf branches per level), per-component prop enums, depth-unrolled
(`$defs.node_0..node_{D-1}`, non-recursive by construction). Schema sizes: depth 3 → 29 KB,
depth 6 → 60 KB, depth 8 → 81 KB. Prompt: compiled-style system prompt (vocabulary + rules
steering + intent) + the worked example as a one-shot few-shot pair + "a screen to delete my
account". `format` = the schema, temperature 0.2, 2 runs per cell.

## Results

| Model | Engine | Depth | JSON parses | Schema-valid | Wall (warm) |
|---|---|---|---|---|---|
| qwen3:8b (~8B) | llama.cpp | 3 | 2/2 | **2/2** | 6–9 s |
| qwen3:8b (~8B) | llama.cpp | 6 | 2/2 | **2/2** | 14–33 s |
| gpt-oss:latest (~20B) | llama.cpp | 3 | 2/2 | **2/2** | 26 s (cold) |
| gpt-oss:latest (~20B) | llama.cpp | 6 | 2/2 | **2/2** | 6 s |
| gpt-oss:latest (~20B) | llama.cpp | 8 | 2/2 | **2/2** | 6–10 s |
| gemma4:e4b-mlx (~4B eff.) | **mlx** | 3, 6 | **0/4** | — | 6–13 s |
| qwen3.6:35b-mlx (35B) | **mlx** | 3, 6 | 2/2 | **0/2** | 32–47 s |

Controls (`spike/run-controls.mjs`): gemma4:e4b-mlx violates even a **trivial**
2-field schema (markdown fences, invented keys) — so the failure is not schema size.
gpt-oss conforms on both the trivial and the real depth-3 schema.
qwen3.6:35b-mlx's outputs were *content-wise* excellent (correct vocabulary, correct
AlertDialog composition — few-shot carries a lot) but exceeded the schema's depth bound,
which grammar enforcement would have made impossible.

## Answers to the three spike questions

1. **Does the schema compile?** Yes. Depths 3–8 (29–81 KB, 39 branches/level) are accepted
   without error and enforced on the grammar-backed engine. No request rejections at any size
   tested.
2. **Does Ollama return schema-shaped output?** **Engine-dependent.** llama.cpp-engine models:
   8/8 valid (qwen3:8b, gpt-oss). **mlx-engine models: `format` is silently ignored** — no
   error, no warning, unconstrained output (gemma emits leading junk tokens; the 35B exceeds
   depth bounds). This is exactly the failure mode the plan's honesty discipline anticipates:
   the runtime itself degrades silently.
3. **Practical unroll depth?** **Default 6 confirmed** (`DEFAULT_UNROLL_DEPTH` in
   `src/core/generation-schema.ts`). Depth 8 also works; grammar overhead is not the dominant
   cost (model load/prompt eval is).

## Contingency assessment (pre-agreed in the plan)

- *"8B adherence unusable"* — **not triggered**: qwen3:8b is 100% schema-valid on the
  llama.cpp engine. The M1 recording can run fully local on an 8B-class model.
- *"Grammar compilation broken across sizes"* — **not triggered**: it works at every size on
  the llama.cpp engine. The mlx gap is an engine property, not a schema property.

## Consequences for the pipeline (carried into PR-5/PR-6/PR-10)

- **OllamaAdapter MUST post-validate** every output against the generation schema and surface
  schema-invalid output as a typed adapter/gate failure — constrained decoding cannot be
  assumed to have been applied. (S1/S2 as independent gates over the produced artifact, per the
  plan, already catch this; the spike turns that design requirement into an observed necessity.)
- The audit report and eval results MUST record the **model and engine** (mlx vs llama.cpp),
  and the eval matrix should prefer/flag engines accordingly. "Schema-validity rate" is a real
  metric, not a formality.
- **Model selection note for the flagship demo:** every schema-valid run chose `alert-dialog`
  when the compiled prompt included rule steering. To reliably demonstrate a violation →
  repair on attempt 1, the demo should use the compiler's `omitRuleSteering` option (built for
  this purpose) and say so on screen — steering removed, enforcement (S3) intact. First-attempt
  violation rates with/without steering are a PR-10 eval question.

## Deliberate spike simplifications (not findings)

Children accept the full vocabulary at every level (per-parent constraints are S3 territory);
`text` allowed on every node; `slots` not generated. The PR-3 compiler inherits these
documented simplifications.

---

## Addendum — 2026-07-02 model refresh (maintainer-requested)

**Ollama:** 0.31.1 (unchanged) · **Scripts:** the same `spike/` harness; results in
`spike/results-gguf-refresh.json` and `spike/controls-mlx-retest.json`.

`qwen3:8b` is retired from this machine; its recorded S0/M1 outputs remain checked in
(`spike/results-qwen3-8b.json`) and the claims above stand at exactly the measured strength.
Newly installed models, tags verified via `ollama list` (each in two formats):

| Tag | Params (ollama show) | Quantization | Engine (inferred from quantization/behavior) |
|---|---|---|---|
| `gemma4:e4b` | 8.0B | Q4_K_M (GGUF) | llama.cpp |
| `gemma4:e4b-mlx` | 8.1B | nvfp4 | mlx |
| `qwen3.6:35b` | 35B-class | GGUF | llama.cpp |
| `qwen3.6:35b-mlx` | 35B-class | mlx | mlx |

### GGUF variants at the confirmed unroll depth (6)

Same protocol as the original spike (2 runs per cell, temperature 0.2, depth-6 schema,
60,294 bytes):

| Model | JSON parses | Schema-valid | Wall (warm) |
|---|---|---|---|
| `gemma4:e4b` | 2/2 | **2/2** | 8–12 s |
| `qwen3.6:35b` | 2/2 | **2/2** | 32–37 s |

Schema compilation and adherence hold at depth 6 on both new GGUF models.

### MLX retest — the silent-`format` behavior REPRODUCES

Controls re-run on the freshly installed MLX variants (`spike/controls-mlx-retest.json`):

| Model | C1 (trivial 2-field schema) | C2 (real depth-3 schema) |
|---|---|---|
| `gemma4:e4b-mlx` | **not JSON** (markdown fence + invented keys) | **not JSON** (markdown fence + invented schema) |
| `qwen3.6:35b-mlx` | parses, **schema-invalid** (invented keys) | **not JSON** (markdown fence) |

The result is treated as **engine-scoped**, and this refresh strengthens that scoping: the
paired `gemma4:e4b` variants are the same model architecture and size, differing only in
quantization/engine (Q4_K_M/llama.cpp vs nvfp4/mlx) — the GGUF variant is 2/2 schema-valid
while the MLX variant fails even the trivial schema.

### Minimal upstream repro (for filing an issue)

- **Environment:** Ollama 0.31.1, macOS/Apple Silicon; model `gemma4:e4b-mlx`
  (nvfp4, `ollama show` reports `requires 0.31.0`).
- **Request:** `POST http://localhost:11434/api/chat`

  ```json
  {
    "model": "gemma4:e4b-mlx",
    "stream": false,
    "options": { "temperature": 0.2 },
    "format": {
      "type": "object",
      "additionalProperties": false,
      "required": ["ok", "reason"],
      "properties": { "ok": { "type": "boolean" },
                      "reason": { "type": "string", "maxLength": 40 } }
    },
    "messages": [{ "role": "user",
                   "content": "Is the sky blue on a clear day? Answer via the JSON schema." }]
  }
  ```
- **Expected:** `message.content` is a JSON object matching the schema.
- **Observed:** unconstrained prose/markdown, e.g. content beginning
  `json\n{```json\n{\n  "question": "Is the sky blue on a clear day?", "answer": true,
  "explanation": "The sky appears blue due to ...` — no error, no warning; the same request
  against the GGUF variant (`gemma4:e4b`) returns schema-conformant JSON.
- Full transcripts: `spike/controls-mlx-retest.json` (this refresh) and
  `spike/controls.json` (original run, different models, same behavior).

### Flagship-prompt endings per candidate recording model (pipeline runs)

Flagship prompt "a screen to delete my account", intent `destructive-action`, maxRepairs 2.
Full audit reports retained in `docs/evidence/2026-07-02-flagship-candidates/`.

| Model | Runs | Endings observed |
|---|---|---|
| `gemma4:e4b` | 4 | failed-lint-exhausted ×2 · failed-gate ×2 |
| `gpt-oss:latest` | 5 | **clean pass ×3 · failed-lint-exhausted ×2** (non-deterministic) |
| `qwen3.6:35b` | 2 | failed-lint-exhausted ×2 |

**No run produced a repaired pass (11/11).** Two measured observations, no cause claims:

- Every persistent lint failure across every exhausted run is
  `rule.button-no-interactive-descendants`. That rule links **no example**
  (`examples: []` in the contract), so its repair feedback carries no corrected reference —
  unlike the two alert-dialog rules, which repaired successfully whenever they fired.
- `gemma4:e4b`'s two `failed-gate` endings are attempt-1 lint-clean surfaces whose emitted
  `AlertDialog` failed instance validation (A3): the title text sat in a nested child of the
  sub-component rather than on its `text` field, which S3's presence check accepts but the
  emitter's flattening does not project. The gate ordering caught it, as designed.

Per-rule × per-model first-attempt violation and repair-success rates are PR-10 (eval
matrix) questions; nothing here claims a cause.
