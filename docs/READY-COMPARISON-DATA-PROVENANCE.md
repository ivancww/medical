# Ready P7 comparison data provenance

The P7 layout and interaction are approved presentation behavior. They are not
a business-data source. The previous Ready prototype contained values such as
`90-365日`, `上限 $640`, and `每日 $2,400`; repository history identifies those
as presentation constants from the prototype, not as a verified brochure or
Official Medical dataset.

This branch removes those values from the customer-facing implementation. P7
now reads the Medical Official `planComparison` dataset and selects rows by
`item_key + plan_id + condition_state`. Only rows with both `verified = TRUE`
and `enabled = TRUE` can be displayed. When a matching row is absent, the UI
shows `未有可核實資料`.

The new `Plan_Comparison` domain preserves future brochure provenance through
`source_name` and `source_url`. It does not store screenshots, PDF binaries,
or invented benefit values. No verified comparison rows are seeded until an
official product brochure, existing verified Medical reference, or other
authoritative committed source confirms the exact value.
