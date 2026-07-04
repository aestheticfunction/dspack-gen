# Eval results

- Contract: shadcn/ui (dspack 0.4, sha256 868bec778fbc…)
- Matrix sha256: 22005d0e7e6a… · maxRepairs: 2

## Per model

(rates are over non-error runs; `errors` are contained infrastructure crashes, not model behavior)

| model | runs | errors | schema-valid | 1st-attempt violation | repair success | e2e pass | S3-clean gate failures |
|---|---|---|---|---|---|---|---|
| ollama:gemma4:e4b | 72 | 0 | 100% | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | 72 | 0 | 100% | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | 72 | 0 | 94.4% | 94.4% | 0% | 0% | 0 |

## Per rule (first-attempt violations across all cells)

| rule | violations | repaired | unrepaired |
|---|---|---|---|
| rule.alertdialog-requires-cancel | 52 | 0 | 52 |
| rule.button-no-interactive-descendants | 76 | 0 | 76 |
| rule.destructive-requires-alertdialog | 6 | 0 | 6 |
| rule.trigger-carries-label | 204 | 0 | 204 |

## Per cell

| model | prompt | shape | template | ADR-D1 probe | errors | violation | repair | e2e | gate-fail |
|---|---|---|---|---|---|---|---|---|---|
| ollama:gemma4:e4b | p01-delete-account | substitution | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p01-delete-account | substitution | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p02-revoke-access | substitution | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p02-revoke-access | substitution | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p03-delete-repository | substitution | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p03-delete-repository | substitution | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p04-cancel-subscription | substitution | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p04-cancel-subscription | substitution | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p05-remove-member-table | restructuring | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p05-remove-member-table | restructuring | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p06-single-button-confirm | addition | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p06-single-button-confirm | addition | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p07-no-title-confirm | addition | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p07-no-title-confirm | addition | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p08-button-wraps-input | deletion | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p08-button-wraps-input | deletion | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p09-nested-trigger-button | deletion | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p09-nested-trigger-button | deletion | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p10-title-as-badge | restructuring | standard | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p10-title-as-badge | restructuring | permit-restructuring | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p11-styled-title-nested | restructuring | standard | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p11-styled-title-nested | restructuring | permit-restructuring | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p12-textless-trigger | addition | standard | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | p12-textless-trigger | addition | permit-restructuring | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p01-delete-account | substitution | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p01-delete-account | substitution | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p02-revoke-access | substitution | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p02-revoke-access | substitution | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p03-delete-repository | substitution | standard |  | 0 | 66.7% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p03-delete-repository | substitution | permit-restructuring |  | 0 | 66.7% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p04-cancel-subscription | substitution | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p04-cancel-subscription | substitution | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p05-remove-member-table | restructuring | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p05-remove-member-table | restructuring | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p06-single-button-confirm | addition | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p06-single-button-confirm | addition | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p07-no-title-confirm | addition | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p07-no-title-confirm | addition | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p08-button-wraps-input | deletion | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p08-button-wraps-input | deletion | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p09-nested-trigger-button | deletion | standard |  | 0 | 66.7% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p09-nested-trigger-button | deletion | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p10-title-as-badge | restructuring | standard | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p10-title-as-badge | restructuring | permit-restructuring | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p11-styled-title-nested | restructuring | standard | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p11-styled-title-nested | restructuring | permit-restructuring | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p12-textless-trigger | addition | standard | yes | 0 | 66.7% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | p12-textless-trigger | addition | permit-restructuring | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p01-delete-account | substitution | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p01-delete-account | substitution | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p02-revoke-access | substitution | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p02-revoke-access | substitution | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p03-delete-repository | substitution | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p03-delete-repository | substitution | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p04-cancel-subscription | substitution | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p04-cancel-subscription | substitution | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p05-remove-member-table | restructuring | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p05-remove-member-table | restructuring | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p06-single-button-confirm | addition | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p06-single-button-confirm | addition | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p07-no-title-confirm | addition | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p07-no-title-confirm | addition | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p08-button-wraps-input | deletion | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p08-button-wraps-input | deletion | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p09-nested-trigger-button | deletion | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p09-nested-trigger-button | deletion | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p10-title-as-badge | restructuring | standard | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p10-title-as-badge | restructuring | permit-restructuring | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p11-styled-title-nested | restructuring | standard | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p11-styled-title-nested | restructuring | permit-restructuring | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p12-textless-trigger | addition | standard | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p12-textless-trigger | addition | permit-restructuring | yes | 0 | 100% | 0% | 0% | 0 |
