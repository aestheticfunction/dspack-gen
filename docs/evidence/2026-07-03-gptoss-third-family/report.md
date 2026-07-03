# Eval results

- Contract: shadcn/ui (dspack 0.3, sha256 4c86ba94156f…)
- Matrix sha256: 49bc3a26ecae… · maxRepairs: 2

## Per model

(rates are over non-error runs; `errors` are contained infrastructure crashes, not model behavior)

| model | runs | errors | schema-valid | 1st-attempt violation | repair success | e2e pass | S3-clean gate failures |
|---|---|---|---|---|---|---|---|
| ollama:gpt-oss:latest | 72 | 0 | 100% | 56.9% | 36.6% | 38.9% | 18 |

## Per rule (first-attempt violations across all cells)

| rule | violations | repaired | unrepaired |
|---|---|---|---|
| rule.alertdialog-requires-cancel | 11 | 2 | 9 |
| rule.button-no-interactive-descendants | 33 | 15 | 18 |
| rule.destructive-requires-alertdialog | 2 | 0 | 2 |

## Per cell

| model | prompt | shape | template | ADR-D1 probe | errors | violation | repair | e2e | gate-fail |
|---|---|---|---|---|---|---|---|---|---|
| ollama:gpt-oss:latest | p01-delete-account | substitution | standard |  | 0 | 0% | n/a | 66.7% | 1 |
| ollama:gpt-oss:latest | p01-delete-account | substitution | permit-restructuring |  | 0 | 0% | n/a | 100% | 0 |
| ollama:gpt-oss:latest | p02-revoke-access | substitution | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p02-revoke-access | substitution | permit-restructuring |  | 0 | 0% | n/a | 100% | 0 |
| ollama:gpt-oss:latest | p03-delete-repository | substitution | standard |  | 0 | 0% | n/a | 100% | 0 |
| ollama:gpt-oss:latest | p03-delete-repository | substitution | permit-restructuring |  | 0 | 66.7% | 50% | 66.7% | 0 |
| ollama:gpt-oss:latest | p04-cancel-subscription | substitution | standard |  | 0 | 0% | n/a | 100% | 0 |
| ollama:gpt-oss:latest | p04-cancel-subscription | substitution | permit-restructuring |  | 0 | 100% | 33.3% | 33.3% | 0 |
| ollama:gpt-oss:latest | p05-remove-member-table | restructuring | standard |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p05-remove-member-table | restructuring | permit-restructuring |  | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p06-single-button-confirm | addition | standard |  | 0 | 66.7% | 0% | 0% | 1 |
| ollama:gpt-oss:latest | p06-single-button-confirm | addition | permit-restructuring |  | 0 | 100% | 66.7% | 33.3% | 1 |
| ollama:gpt-oss:latest | p07-no-title-confirm | addition | standard |  | 0 | 0% | n/a | 100% | 0 |
| ollama:gpt-oss:latest | p07-no-title-confirm | addition | permit-restructuring |  | 0 | 33.3% | 100% | 100% | 0 |
| ollama:gpt-oss:latest | p08-button-wraps-input | deletion | standard |  | 0 | 100% | 100% | 33.3% | 2 |
| ollama:gpt-oss:latest | p08-button-wraps-input | deletion | permit-restructuring |  | 0 | 100% | 100% | 0% | 3 |
| ollama:gpt-oss:latest | p09-nested-trigger-button | deletion | standard |  | 0 | 100% | 66.7% | 33.3% | 1 |
| ollama:gpt-oss:latest | p09-nested-trigger-button | deletion | permit-restructuring |  | 0 | 100% | 33.3% | 0% | 1 |
| ollama:gpt-oss:latest | p10-title-as-badge | restructuring | standard | yes | 0 | 66.7% | 0% | 0% | 1 |
| ollama:gpt-oss:latest | p10-title-as-badge | restructuring | permit-restructuring | yes | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | p11-styled-title-nested | restructuring | standard | yes | 0 | 66.7% | 50% | 33.3% | 1 |
| ollama:gpt-oss:latest | p11-styled-title-nested | restructuring | permit-restructuring | yes | 0 | 66.7% | 0% | 33.3% | 0 |
| ollama:gpt-oss:latest | p12-textless-trigger | addition | standard | yes | 0 | 0% | n/a | 0% | 3 |
| ollama:gpt-oss:latest | p12-textless-trigger | addition | permit-restructuring | yes | 0 | 0% | n/a | 0% | 3 |
