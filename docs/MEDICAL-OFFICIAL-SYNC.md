# Medical Official Data Sync Contract

## Ownership

AVA Platform owns unified Admin authentication, AVA Studio and the one-time
Medical launch ticket. Medical owns this editor, its dataset schema, validation,
GAS API and Google Sheet mapping. User Override data is never part of an
Official write payload.

## Dataset classification

| Dataset | Admin status | Allowed mutation fields |
| --- | --- | --- |
| Pages (`Pages`) | Editable Official | `page_name`, `title`, `subtitle`, `enabled`, `sort_order`, `highlight_text`; stable ID `page_id` |
| Options (`Options`) | Editable Official | `display_name`, `subtitle`, `reflection_text`, `enabled`, `sort_order`; stable ID `option_id` |
| Plans / Features (`Plans`) | Editable Official | `plan_name`, `category`, `title`, `description`, `brochure_url`, `enabled`, `sort_order`; stable ID `record_id` |
| Claim Rules (`Claim_Rules`) | Editable Official | `plan_name`, `default_rate`, `deductible_enabled`, `note`; stable ID `plan_id` |
| Claim Cases (`Claim_Cases`) | Editable Official | case content/publication fields; stable ID `case_id`; empty is valid |
| Premium Settings (`Premium_Settings`) | Editable Official | `title`, `description`, `value`, dates, `enabled`, `sort_order`; stable ID `setting_id` |
| Config (`Config`) | Editable Official | `config_value`, `description`; stable ID `config_key` |
| Premium tables (11 age/value tabs) | Read-only | no explicit stable row ID; no targeted mutation contract |
| Calculations, auth, service worker, Platform rules | Read-only / protected | none |

The UI derives editable controls from fields actually present in the current
Official row. It does not fabricate missing rows or Claim Cases.

The canonical workbook discovered for this contract is spreadsheet
`1G6JirabWJPrTtsdPuzzfyo-D-EPIbbdCM3HvFUW7ZCw` (title `成人醫療`). The
existing GAS project must already have this ID, or set it as the existing
project's `MEDICAL_OFFICIAL_SPREADSHEET_ID` Script Property; no new workbook
is created.

## Write contract

`POST` the existing Medical GAS endpoint with:

```json
{
  "action": "updateOfficialRecord",
  "appId": "medical",
  "appGrant": "memory-only Medical App Grant",
  "dataset": "pages",
  "recordId": "stable-page-id",
  "changes": { "title": "..." },
  "expectedVersion": "current-official-revision"
}
```

The GAS backend must verify `medicalVerifyAppGrant_(appGrant,
"official-write")`, reject unsupported fields and stale versions, update only
the addressed row, re-read the canonical payload and return its content
revision,
and return the persisted payload. The action must be merged into the existing
production GAS `doPost`; it is not a second endpoint or a replacement project.

The existing `doPost` router should dispatch `action ===
"updateOfficialRecord"` to `medicalOfficialDataAction_(body)` alongside its
existing read/auth actions. The existing error envelope and CORS/response
wrapper remain owned by that router.
