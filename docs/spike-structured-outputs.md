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
