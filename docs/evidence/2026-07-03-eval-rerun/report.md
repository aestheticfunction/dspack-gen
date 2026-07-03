# Eval results

- Contract: shadcn/ui (dspack 0.3, sha256 4c86ba94156f…)
- Matrix sha256: 16725ed80563… · maxRepairs: 2

## Per model

(rates are over non-error runs; `errors` are contained infrastructure crashes, not model behavior)

| model | runs | errors | schema-valid | 1st-attempt violation | repair success | e2e pass | S3-clean gate failures |
|---|---|---|---|---|---|---|---|
| anthropic:claude-sonnet-5 | 72 | 0 | 0% | 0% | n/a | 0% | 0 |
| ollama:gemma4:e4b | 72 | 0 | 100% | 44.4% | 9.4% | 0% | 43 |
| ollama:qwen3.6:35b | 72 | 0 | 98.6% | 87.5% | 14.3% | 0% | 17 |

## Per rule (first-attempt violations across all cells)

| rule | violations | repaired | unrepaired |
|---|---|---|---|
| rule.alertdialog-requires-cancel | 15 | 4 | 11 |
| rule.button-no-interactive-descendants | 75 | 7 | 68 |
| rule.destructive-requires-alertdialog | 7 | 1 | 6 |

## Per cell

| model | prompt | shape | template | ADR-D1 probe | errors | violation | repair | e2e | gate-fail |
|---|---|---|---|---|---|---|---|---|---|
| ollama:gemma4:e4b | p01-delete-account | substitution | standard |  | 0 | 33.3% | 0% | 0% | 2 |
| ollama:gemma4:e4b | p01-delete-account | substitution | permit-restructuring |  | 0 | 66.7% | 0% | 0% | 1 |
| ollama:gemma4:e4b | p02-revoke-access | substitution | standard |  | 0 | 33.3% | 0% | 0% | 2 |
| ollama:gemma4:e4b | p02-revoke-access | substitution | permit-restructuring |  | 0 | 33.3% | 0% | 0% | 2 |
| ollama:gemma4:e4b | p03-delete-repository | substitution | standard |  | 0 | 0% | n/a | 0% | 3 |
| ollama:gemma4:e4b | p03-delete-repository | substitution | permit-restructuring |  | 0 | 0% | n/a | 0% | 3 |
| ollama:gemma4:e4b | p04-cancel-subscription | substitution | standard |  | 0 | 0% | n/a | 0% | 3 |
| ollama:gemma4:e4b | p04-cancel-subscription | substitution | permit-restructuring |  | 0 | 0% | n/a | 0% | 3 |
| ollama:gemma4:e4b | p05-remove-member-table | restructuring | standard |  | 0 | 100% | 33.3% | 0% | 1 |
| ollama:gemma4:e4b | p05-remove-member-table | restructuring | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p06-single-button-confirm | addition | standard |  | 0 | 0% | n/a | 0% | 3 |
| ollama:gemma4:e4b | p06-single-button-confirm | addition | permit-restructuring |  | 0 | 33.3% | 0% | 0% | 2 |
| ollama:gemma4:e4b | p07-no-title-confirm | addition | standard |  | 0 | 0% | n/a | 0% | 3 |
| ollama:gemma4:e4b | p07-no-title-confirm | addition | permit-restructuring |  | 0 | 33.3% | 0% | 0% | 2 |
| ollama:gemma4:e4b | p08-button-wraps-input | deletion | standard |  | 0 | 100% | 33.3% | 0% | 1 |
| ollama:gemma4:e4b | p08-button-wraps-input | deletion | permit-restructuring |  | 0 | 100% | 33.3% | 0% | 1 |
| ollama:gemma4:e4b | p09-nested-trigger-button | deletion | standard |  | 0 | 33.3% | 0% | 0% | 2 |
| ollama:gemma4:e4b | p09-nested-trigger-button | deletion | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p10-title-as-badge | restructuring | standard | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p10-title-as-badge | restructuring | permit-restructuring | yes | 0 | 66.7% | 0% | 0% | 1 |
| ollama:gemma4:e4b | p11-styled-title-nested | restructuring | standard | yes | 0 | 66.7% | 0% | 0% | 1 |
| ollama:gemma4:e4b | p11-styled-title-nested | restructuring | permit-restructuring | yes | 0 | 66.7% | 0% | 0% | 1 |
| ollama:gemma4:e4b | p12-textless-trigger | addition | standard | yes | 0 | 0% | n/a | 0% | 3 |
| ollama:gemma4:e4b | p12-textless-trigger | addition | permit-restructuring | yes | 0 | 0% | n/a | 0% | 3 |
| ollama:qwen3.6:35b | p01-delete-account | substitution | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p01-delete-account | substitution | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p02-revoke-access | substitution | standard |  | 0 | 100% | 66.7% | 0% | 2 |
| ollama:qwen3.6:35b | p02-revoke-access | substitution | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p03-delete-repository | substitution | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p03-delete-repository | substitution | permit-restructuring |  | 0 | 100% | 33.3% | 0% | 1 |
| ollama:qwen3.6:35b | p04-cancel-subscription | substitution | standard |  | 0 | 100% | 33.3% | 0% | 1 |
| ollama:qwen3.6:35b | p04-cancel-subscription | substitution | permit-restructuring |  | 0 | 100% | 33.3% | 0% | 1 |
| ollama:qwen3.6:35b | p05-remove-member-table | restructuring | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p05-remove-member-table | restructuring | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p06-single-button-confirm | addition | standard |  | 0 | 66.7% | 0% | 0% | 1 |
| ollama:qwen3.6:35b | p06-single-button-confirm | addition | permit-restructuring |  | 0 | 100% | 33.3% | 0% | 1 |
| ollama:qwen3.6:35b | p07-no-title-confirm | addition | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p07-no-title-confirm | addition | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p08-button-wraps-input | deletion | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p08-button-wraps-input | deletion | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p09-nested-trigger-button | deletion | standard |  | 0 | 66.7% | 50% | 0% | 1 |
| ollama:qwen3.6:35b | p09-nested-trigger-button | deletion | permit-restructuring |  | 0 | 100% | 66.7% | 0% | 2 |
| ollama:qwen3.6:35b | p10-title-as-badge | restructuring | standard | yes | 0 | 0% | n/a | 0% | 3 |
| ollama:qwen3.6:35b | p10-title-as-badge | restructuring | permit-restructuring | yes | 0 | 66.7% | 0% | 0% | 1 |
| ollama:qwen3.6:35b | p11-styled-title-nested | restructuring | standard | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p11-styled-title-nested | restructuring | permit-restructuring | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p12-textless-trigger | addition | standard | yes | 0 | 33.3% | 0% | 0% | 2 |
| ollama:qwen3.6:35b | p12-textless-trigger | addition | permit-restructuring | yes | 0 | 66.7% | 0% | 0% | 1 |
| anthropic:claude-sonnet-5 | p01-delete-account | substitution | standard |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p01-delete-account | substitution | permit-restructuring |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p02-revoke-access | substitution | standard |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p02-revoke-access | substitution | permit-restructuring |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p03-delete-repository | substitution | standard |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p03-delete-repository | substitution | permit-restructuring |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p04-cancel-subscription | substitution | standard |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p04-cancel-subscription | substitution | permit-restructuring |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p05-remove-member-table | restructuring | standard |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p05-remove-member-table | restructuring | permit-restructuring |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p06-single-button-confirm | addition | standard |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p06-single-button-confirm | addition | permit-restructuring |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p07-no-title-confirm | addition | standard |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p07-no-title-confirm | addition | permit-restructuring |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p08-button-wraps-input | deletion | standard |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p08-button-wraps-input | deletion | permit-restructuring |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p09-nested-trigger-button | deletion | standard |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p09-nested-trigger-button | deletion | permit-restructuring |  | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p10-title-as-badge | restructuring | standard | yes | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p10-title-as-badge | restructuring | permit-restructuring | yes | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p11-styled-title-nested | restructuring | standard | yes | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p11-styled-title-nested | restructuring | permit-restructuring | yes | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p12-textless-trigger | addition | standard | yes | 0 | 0% | n/a | 0% | 0 |
| anthropic:claude-sonnet-5 | p12-textless-trigger | addition | permit-restructuring | yes | 0 | 0% | n/a | 0% | 0 |
