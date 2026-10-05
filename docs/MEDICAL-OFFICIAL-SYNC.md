# Medical Official Data Sync Contract

## Ownership

AVA Platform owns unified Admin authentication, AVA Studio and the one-time
Medical launch ticket. Medical owns this editor, its dataset schema, validation,
GAS API and Google Sheet mapping. User Override data is never part of an
Official write payload.

## Dataset classification

| Dataset | Admin status | Allowed mutation fields |
| --- | --- | --- |
| Pages | Editable Official | `title`, `subtitle`, `description`, `enabled`, `sort_order` |
| Options | Editable Official | display/description/reflection text, `enabled`, `sort_order` |
| Plans / Features | Editable Official | plan display text, `enabled`, `sort_order` |
| Claim Rules | Editable Official | verified descriptive/parameter fields in the allowlist |
| Claim Cases | Editable Official | verified case content and publication flags; empty is valid |
| Premium Settings | Editable Official | existing setting `value`, `enabled`, `description` fields only |
| Config | Editable Official | existing setting `value`, `enabled`, `description` fields only |
| Premium tables | Read-only until canonical row schema is verified | none |
| Calculations, auth, service worker, Platform rules | Read-only / protected | none |

The UI derives editable controls from fields actually present in the current
Official row. It does not fabricate missing rows or Claim Cases.

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
  "expectedVersion": "current-official-version"
}
```

The GAS backend must verify `medicalVerifyAppGrant_(appGrant,
"official-write")`, reject unsupported fields and stale versions, update only
the addressed row, bump the Official revision, re-read the canonical payload,
and return the persisted payload. The action must be merged into the existing
production GAS `doPost`; it is not a second endpoint or a replacement project.
