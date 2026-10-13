# Medical Official `Plan_Comparison` Sheet

The Medical-owned P7 comparison domain uses a dedicated Google Sheet tab named
`Plan_Comparison`. It is created safely by the GAS helper
`initializeMedicalPlanComparisonSheet_()`; the helper creates the tab only when
it is missing and validates headers in place when it already exists. It never
clears, reorders, or republishes existing rows.

## Stable header order

```text
comparison_id,item_key,item_name,plan_id,condition_state,main_value,sub_value,enabled,sort_order,source_name,source_url,verified,notes
```

`comparison_id` is the stable write identity. The allowed plan IDs are
`ELITE`, `WISE`, and `FLEXI`. The allowed condition states are `DEFAULT`,
`WISE_SEMI_PRIVATE`, and `WISE_GENERAL_ROOM`.

The initial approved presentation categories are:

| item_key | item_name | supported condition states |
| --- | --- | --- |
| `post_discharge_followup` | 出院後覆診 | `DEFAULT`, Wise states where sourced |
| `post_discharge_tcm` | 出院後中醫 | `DEFAULT`, Wise states where sourced |
| `room_downgrade_cash` | 次級病房每日現金津貼 | `DEFAULT`, Wise states where sourced |
| `non_surgical_cancer` | 非手術癌症長遠開支 | `DEFAULT`, Wise states where sourced |

No comparison benefit values are seeded in this repository because the
existing committed Medical references and current Official payload do not
establish a verified source for the screenshot-only values previously shown
in the P7 prototype. This template therefore publishes zero customer-visible
rows. Rows must identify `source_name`, include `source_url` when available,
and set `verified` to `TRUE` only after provenance is confirmed.

Customer P7 eligibility is exactly `enabled = TRUE` and `verified = TRUE`.
Missing or unverified rows are rendered as `未有可核實資料` and are not
silently replaced with screenshot values.

Production Sheet modification is intentionally not performed by this change.
