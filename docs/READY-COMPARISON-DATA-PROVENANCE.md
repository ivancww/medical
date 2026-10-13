# Ready P7 comparison data provenance

The P7 layout and interaction are approved presentation behavior. For this
release, the user-approved P7 comparison table is also the authorized initial
presentation source for the Medical Official `Plan_Comparison` Sheet.

P7 reads every enabled, populated Medical Official `planComparison` row and
selects rows by `item_key + plan_id + condition_state`. `verified` remains
governance metadata in Admin but is not a customer display gate. When a
matching plan/state row is absent, the UI shows `未有資料`; the item remains
visible so future Sheet rows do not require a frontend deployment.

The `Plan_Comparison` domain preserves future provenance through `source_name`
and `source_url`. It does not store screenshots, PDF binaries, or raw
documents. The production Sheet was explicitly updated with the initial five
user-approved item groups; future Admin additions are consumed dynamically.
User edits/additions are structured local User Layer data and do not write back
to Official.
