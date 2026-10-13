# Medical Official `Plan_Comparison` Sheet

The Medical-owned P7 comparison domain uses a dedicated Google Sheet tab named
`Plan_Comparison`. It is created safely by the GAS helper
`initializeMedicalPlanComparisonSheet_()`; the helper creates the tab only
when it is missing and validates headers in place when it already exists. It
never clears, reorders, or republishes existing rows.

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
| `pre_surgery_outpatient_consultation` | 手術前門診諮詢服務 | `DEFAULT`, `WISE_SEMI_PRIVATE`, `WISE_GENERAL_ROOM` |

The production `AVA-Medical` spreadsheet is populated with the initial
user-approved table. Its `source_name` records the approved PR #29
presentation source; `source_url` is retained for future brochure references.
`verified` may be maintained as governance metadata, but does not gate
customer display because the Official Sheet is the publication source.

Customer P7 eligibility is exactly `enabled = TRUE` plus a non-empty
`main_value` or `sub_value`. Missing plan/state cells are rendered as
`未有資料`, without removing the item row.

If the tab is absent, run `initializeMedicalPlanComparisonSheet_()`; it creates
the tab without touching other Medical sheets. Existing tabs are validated in
place and are not destructively rewritten.
