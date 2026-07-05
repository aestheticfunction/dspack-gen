# Eval results

- Contract: Astryx (dspack 0.4, sha256 f4ea9be8e50d…)
- Matrix sha256: a369d0d4a139… · maxRepairs: 2

## Per model

(rates are over observed runs; `errors` are contained crashes and `no-gen` are pre-generation adapter failures — both infrastructure, not model behavior; dspack-gen#19)

| model | runs | errors | no-gen | schema-valid | 1st-attempt violation | repair success | e2e pass | S3-clean gate failures |
|---|---|---|---|---|---|---|---|---|
| ollama:gemma4:e4b | 72 | 0 | 0 | 100% | 56.9% | 53.7% | 73.6% | 0 |
| ollama:gpt-oss:latest | 72 | 0 | 0 | 100% | 52.8% | 63.2% | 80.6% | 0 |
| ollama:qwen3.6:35b | 72 | 0 | 0 | 91.7% | 22.2% | 56.3% | 81.9% | 0 |

## Per rule (first-attempt violations across all cells)

| rule | violations | repaired | unrepaired |
|---|---|---|---|
| rule.alertdialog-action-label-specific | 3 | 3 | 0 |
| rule.destructive-requires-alertdialog | 92 | 52 | 40 |
| rule.dialog-no-nested-overlays | 2 | 2 | 0 |

## Per cell

| model | prompt | shape | template | ADR-D1 probe | errors | no-gen | violation | repair | e2e | gate-fail |
|---|---|---|---|---|---|---|---|---|---|---|
| ollama:gemma4:e4b | a01-delete-project | substitution | standard |  | 0 | 0 | 66.7% | 0% | 33.3% | 0 |
| ollama:gemma4:e4b | a01-delete-project | substitution | permit-restructuring |  | 0 | 0 | 100% | 33.3% | 33.3% | 0 |
| ollama:gemma4:e4b | a02-revoke-key | substitution | standard |  | 0 | 0 | 66.7% | 100% | 100% | 0 |
| ollama:gemma4:e4b | a02-revoke-key | substitution | permit-restructuring |  | 0 | 0 | 66.7% | 100% | 100% | 0 |
| ollama:gemma4:e4b | a03-wipe-workspace | substitution | standard |  | 0 | 0 | 66.7% | 0% | 33.3% | 0 |
| ollama:gemma4:e4b | a03-wipe-workspace | substitution | permit-restructuring |  | 0 | 0 | 100% | 33.3% | 33.3% | 0 |
| ollama:gemma4:e4b | a04-minimal-confirm | addition | standard |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:gemma4:e4b | a04-minimal-confirm | addition | permit-restructuring |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:gemma4:e4b | a05-icon-toolbar | addition | standard |  | 0 | 0 | 66.7% | 0% | 33.3% | 0 |
| ollama:gemma4:e4b | a05-icon-toolbar | addition | permit-restructuring |  | 0 | 0 | 66.7% | 0% | 33.3% | 0 |
| ollama:gemma4:e4b | a06-quick-form | addition | standard |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:gemma4:e4b | a06-quick-form | addition | permit-restructuring |  | 0 | 0 | 33.3% | 100% | 100% | 0 |
| ollama:gemma4:e4b | a07-generic-confirm | substitution | standard |  | 0 | 0 | 100% | 100% | 100% | 0 |
| ollama:gemma4:e4b | a07-generic-confirm | substitution | permit-restructuring |  | 0 | 0 | 100% | 66.7% | 66.7% | 0 |
| ollama:gemma4:e4b | a08-menu-in-dialog | deletion | standard |  | 0 | 0 | 100% | 100% | 100% | 0 |
| ollama:gemma4:e4b | a08-menu-in-dialog | deletion | permit-restructuring |  | 0 | 0 | 100% | 100% | 100% | 0 |
| ollama:gemma4:e4b | a09-members-table | deletion | standard |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:gemma4:e4b | a09-members-table | deletion | permit-restructuring |  | 0 | 0 | 100% | 0% | 0% | 0 |
| ollama:gemma4:e4b | a10-ordinary-cancel-sub | substitution | standard |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:gemma4:e4b | a10-ordinary-cancel-sub | substitution | permit-restructuring |  | 0 | 0 | 33.3% | 0% | 66.7% | 0 |
| ollama:gemma4:e4b | a11-bulk-delete | addition | standard |  | 0 | 0 | 33.3% | 100% | 100% | 0 |
| ollama:gemma4:e4b | a11-bulk-delete | addition | permit-restructuring |  | 0 | 0 | 66.7% | 100% | 100% | 0 |
| ollama:gemma4:e4b | a12-danger-zone | addition | standard |  | 0 | 0 | 33.3% | 0% | 66.7% | 0 |
| ollama:gemma4:e4b | a12-danger-zone | addition | permit-restructuring |  | 0 | 0 | 66.7% | 50% | 66.7% | 0 |
| ollama:qwen3.6:35b | a01-delete-project | substitution | standard |  | 0 | 0 | 33.3% | 100% | 100% | 0 |
| ollama:qwen3.6:35b | a01-delete-project | substitution | permit-restructuring |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:qwen3.6:35b | a02-revoke-key | substitution | standard |  | 0 | 0 | 33.3% | 0% | 66.7% | 0 |
| ollama:qwen3.6:35b | a02-revoke-key | substitution | permit-restructuring |  | 0 | 0 | 33.3% | 0% | 66.7% | 0 |
| ollama:qwen3.6:35b | a03-wipe-workspace | substitution | standard |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:qwen3.6:35b | a03-wipe-workspace | substitution | permit-restructuring |  | 0 | 0 | 66.7% | 100% | 100% | 0 |
| ollama:qwen3.6:35b | a04-minimal-confirm | addition | standard |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:qwen3.6:35b | a04-minimal-confirm | addition | permit-restructuring |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:qwen3.6:35b | a05-icon-toolbar | addition | standard |  | 0 | 0 | 0% | n/a | 66.7% | 0 |
| ollama:qwen3.6:35b | a05-icon-toolbar | addition | permit-restructuring |  | 0 | 0 | 33.3% | 100% | 100% | 0 |
| ollama:qwen3.6:35b | a06-quick-form | addition | standard |  | 0 | 0 | 0% | n/a | 66.7% | 0 |
| ollama:qwen3.6:35b | a06-quick-form | addition | permit-restructuring |  | 0 | 0 | 0% | n/a | 66.7% | 0 |
| ollama:qwen3.6:35b | a07-generic-confirm | substitution | standard |  | 0 | 0 | 33.3% | 0% | 66.7% | 0 |
| ollama:qwen3.6:35b | a07-generic-confirm | substitution | permit-restructuring |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:qwen3.6:35b | a08-menu-in-dialog | deletion | standard |  | 0 | 0 | 66.7% | 100% | 100% | 0 |
| ollama:qwen3.6:35b | a08-menu-in-dialog | deletion | permit-restructuring |  | 0 | 0 | 66.7% | 100% | 100% | 0 |
| ollama:qwen3.6:35b | a09-members-table | deletion | standard |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:qwen3.6:35b | a09-members-table | deletion | permit-restructuring |  | 0 | 0 | 66.7% | 0% | 0% | 0 |
| ollama:qwen3.6:35b | a10-ordinary-cancel-sub | substitution | standard |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:qwen3.6:35b | a10-ordinary-cancel-sub | substitution | permit-restructuring |  | 0 | 0 | 33.3% | 100% | 100% | 0 |
| ollama:qwen3.6:35b | a11-bulk-delete | addition | standard |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:qwen3.6:35b | a11-bulk-delete | addition | permit-restructuring |  | 0 | 0 | 33.3% | 0% | 33.3% | 0 |
| ollama:qwen3.6:35b | a12-danger-zone | addition | standard |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:qwen3.6:35b | a12-danger-zone | addition | permit-restructuring |  | 0 | 0 | 33.3% | 0% | 33.3% | 0 |
| ollama:gpt-oss:latest | a01-delete-project | substitution | standard |  | 0 | 0 | 100% | 33.3% | 33.3% | 0 |
| ollama:gpt-oss:latest | a01-delete-project | substitution | permit-restructuring |  | 0 | 0 | 66.7% | 0% | 33.3% | 0 |
| ollama:gpt-oss:latest | a02-revoke-key | substitution | standard |  | 0 | 0 | 100% | 66.7% | 66.7% | 0 |
| ollama:gpt-oss:latest | a02-revoke-key | substitution | permit-restructuring |  | 0 | 0 | 66.7% | 0% | 33.3% | 0 |
| ollama:gpt-oss:latest | a03-wipe-workspace | substitution | standard |  | 0 | 0 | 33.3% | 100% | 100% | 0 |
| ollama:gpt-oss:latest | a03-wipe-workspace | substitution | permit-restructuring |  | 0 | 0 | 66.7% | 100% | 100% | 0 |
| ollama:gpt-oss:latest | a04-minimal-confirm | addition | standard |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:gpt-oss:latest | a04-minimal-confirm | addition | permit-restructuring |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:gpt-oss:latest | a05-icon-toolbar | addition | standard |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:gpt-oss:latest | a05-icon-toolbar | addition | permit-restructuring |  | 0 | 0 | 33.3% | 100% | 100% | 0 |
| ollama:gpt-oss:latest | a06-quick-form | addition | standard |  | 0 | 0 | 33.3% | 100% | 100% | 0 |
| ollama:gpt-oss:latest | a06-quick-form | addition | permit-restructuring |  | 0 | 0 | 33.3% | 0% | 66.7% | 0 |
| ollama:gpt-oss:latest | a07-generic-confirm | substitution | standard |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:gpt-oss:latest | a07-generic-confirm | substitution | permit-restructuring |  | 0 | 0 | 0% | n/a | 100% | 0 |
| ollama:gpt-oss:latest | a08-menu-in-dialog | deletion | standard |  | 0 | 0 | 66.7% | 50% | 66.7% | 0 |
| ollama:gpt-oss:latest | a08-menu-in-dialog | deletion | permit-restructuring |  | 0 | 0 | 66.7% | 100% | 100% | 0 |
| ollama:gpt-oss:latest | a09-members-table | deletion | standard |  | 0 | 0 | 33.3% | 100% | 100% | 0 |
| ollama:gpt-oss:latest | a09-members-table | deletion | permit-restructuring |  | 0 | 0 | 66.7% | 100% | 100% | 0 |
| ollama:gpt-oss:latest | a10-ordinary-cancel-sub | substitution | standard |  | 0 | 0 | 100% | 0% | 0% | 0 |
| ollama:gpt-oss:latest | a10-ordinary-cancel-sub | substitution | permit-restructuring |  | 0 | 0 | 100% | 66.7% | 66.7% | 0 |
| ollama:gpt-oss:latest | a11-bulk-delete | addition | standard |  | 0 | 0 | 66.7% | 50% | 66.7% | 0 |
| ollama:gpt-oss:latest | a11-bulk-delete | addition | permit-restructuring |  | 0 | 0 | 66.7% | 100% | 100% | 0 |
| ollama:gpt-oss:latest | a12-danger-zone | addition | standard |  | 0 | 0 | 66.7% | 100% | 100% | 0 |
| ollama:gpt-oss:latest | a12-danger-zone | addition | permit-restructuring |  | 0 | 0 | 100% | 100% | 100% | 0 |
