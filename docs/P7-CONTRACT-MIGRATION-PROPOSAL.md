# P7 benefit contract — migration proposal (not deployed)

## Current gate

`Plan_Comparison` is the live legacy source. Its 13 columns and existing
`comparison_id` values remain untouched. Its two display strings and room
state do not independently identify service context, individual material
conditions, the four surgery classifications or SMM triggers. The deployed
GAS source/version has not been verified against this repository. Do not
change production GAS, Sheet or the public application based on this proposal.

The current Wise general-room outpatient $640 and TCM $600 entries are not
proof that ordinary-room patients necessarily receive non-network care. A
room state must never select a network rate by itself. A row without verified
room and service-context evidence must remain unverified; lack of a match must
not fall back to the other room. The verified AIA SelectWise brochure places
the outpatient and TCM values under network/non-network headings and supplies
the qualifying periods and frequencies. Source:
https://www.aia.com.hk/content/dam/hk-wise/pdf/products/individuals/zh-hk/selectwise/vhis-selectwise_tc.pdf

## Proposed model for isolated validation

Preserve legacy rows as the compatibility projection and maintain their stable
IDs. A separately versioned authoritative structured benefit dataset should
associate a stable benefit identity and plan with an explicit applicability
relationship: room eligibility (semi-private, general, or genuinely shared),
service context (network, non-network, or truly context-independent), and
jurisdiction. Each benefit has ordered typed components containing the value,
unit, period, scope and material conditions with source attribution. Surgery
classification entries are typed child components, not extra visible benefit
rows. SMM must independently represent its per-policy-year-per-disability
limit, eligible-expense coinsurance and benefit-specific triggers. Values and
conditions must have one authoritative source; any legacy representation must
be a deterministic validated projection of that source.

The exact table/field encoding and deployed GAS API are not approved or
verified by this document. Do not infer network context from a room selection,
parse arbitrary free text as a structural contract, or treat this proposal as a
deployed schema. Existing source data may be incomplete and must fail closed.
Admin create/update needs explicit allowlists, types, validation and verified
read-after-write; a generic object reader is not evidence of write support.

## Required compatibility and migration sequence

1. Obtain and compare the actual deployed GAS project and deployment version,
   including effective routes and all source files, against the repo. Resolve
   any divergence before editing GAS code.
2. Specify the final validated contract and deterministic legacy projection;
   populate a separate test dataset using only verified official evidence.
3. Test new and legacy readers, Admin validation and read-after-write on an
   isolated Sheet and GAS test environment. Test incomplete and contradictory
   data, all eight Wise condition combinations, local overrides and session
   restoration. Never infer coverage from a missing record.
4. Verify migration and rollback against a fresh snapshot of production without
   writing production. Create and review a single focused PR. Stop before
   merge, GAS deployment or live Sheet change.
5. With separate production authorization, recheck exact deployed versions,
   create a fresh verified backup, install and verify compatible transport and
   App in an agreed order, then publish the validated projection atomically or
   in a proven safe stage. Verify fresh and cached legacy/new clients and
   official readback. Only report production after actual deployment succeeds.

## Rollback

Prior to cutover retain exact deployment IDs, prior App release, full Sheet
backup including formulas, IDs and formatting, and migration revision. If
verification fails, stop writes, restore the last verified compatible App/GAS
deployment and Sheet data as a coordinated set, verify readback and cache
refresh, and record any concurrent edits for reconciliation. Rollback execution
requires its own production authorization and must not overwrite later edits.

## Current work status

PR #48 currently prepares only the missing-room display and tests. It does not
implement the contract above, the new rows, colour highlighting, AVF surgical
details, SMM or v1.2.11 release. No screenshots or production compatibility
claim are supported until these are implemented and tested.
