# Ready P7 comparison data provenance

P7 keeps the approved comparison presentation: plan visibility chips, adaptive
columns, the three Wise conditions, and the qualified/downgraded status.

The comparison row labels are stable presentation labels. Benefit values are
not sourced from screenshots or from a legacy fallback. They are read only
from an Official comparison collection when one is published under one of the
supported Official fields: `comparisonItems`, `comparison_items`, `planItems`,
`plan_items`, `productComparison`, or `product_comparison`.

The Medical repository history and the current Official product payload expose
plan names, deductible rules, premium tables, and high-level feature
descriptions, but do not provide the P7 per-benefit values introduced by the
previous Ready UX patch. The related legacy calculator's presentation fallback
is not an authoritative Medical comparison source, so those values are not
copied into this app.

When an Official comparison record is unavailable, P7 displays `未有可核實資料`
for that benefit cell. This preserves the comparison layout and Wise state
logic without publishing an unverified insurance value. Claim calculations,
deductibles, premiums, Official GAS, and the Google Sheet schema are unchanged.
