# PR #50 — R03 bar and Plan Comparison pipeline audit

Target stays **v1.2.12** on the same Draft PR. Starting head: `e51d42dea8fedf95f694b46b8f755a52ee31b8d4`. No production Sheet records, GAS deployment, Firebase settings or R05 calculation/presentation were changed.

## R03 presentation

The left-to-right order is always **公司 — green #dcfce7 → 自己 — blue #dbeafe**. Inside labels use the accepted R05 palette, and corresponding amounts appear underneath in that same order. The existing three amount cards remain. The formula remains `min(medical expense, eligible-expense ceiling) × reimbursement rate`; only labels and R03-scoped styles changed.

The two segments use the actual paid and remaining amounts as percentages of the bill. Horizontal padding cannot inflate a tiny or zero segment. An inside label is hidden only when its own segment is too narrow to fit; its amount remains visible below. Responsive layouts do not reverse the order. Both 💭 questions retain their exact wording.

Browser QA includes below/above ceiling, 0%/partial/100%, zero coverage/expense, 1%/99% segments, 320px/390px phones, iPad and HONOR unfolded. R03 screenshots were refreshed; small-company and small-customer examples were added. All five R05 screenshots remain byte-identical to the accepted head.

## Canonical Sheet — read-only evidence

Source: [AVA-Medical](https://docs.google.com/spreadsheets/d/1G6JirabWJPrTtsdPuzzfyo-D-EPIbbdCM3HvFUW7ZCw/edit), `Plan_Comparison`, sheetId **793647107**. Metadata confirms a 1001×26 grid and one frozen header row. Bounded reads covered A1:M120 and A121:M1001; the populated data ends at row 36. No writes, initialization, inserts, sorting or record recreation were performed.

The Sheet contains **35 enabled, populated comparison rows**, grouped into **8 item keys**:

| Plan | Rows |
| --- | ---: |
| ELITE | 8 |
| WISE | 16 |
| FLEXI | 11 |

| Condition state | Rows |
| --- | ---: |
| DEFAULT | 16 |
| WISE_GENERAL_ROOM | 8 |
| WISE_SEMI_PRIVATE | 8 |
| FLEXI_NON_NETWORK | 3 |

Item keys: `misc_expenses`, `surgical_fees`, `room_and_board`, `post_discharge_followup`, `post_discharge_tcm`, `room_downgrade_cash`, `non_surgical_cancer`, `pre_surgery_outpatient_consultation`.

**Existing source-data observation:** `nsc_wise_general` is reused as `comparison_id` for both Wise room states of `non_surgical_cancer`. These are distinct applicable cells. Both remain intact; the UI groups by item/plan/condition rather than deduplicating by comparison ID. No source-data repair was attempted.

For an order-independent comparison with the deployed response, the normalized display tuple is `[comparison_id,item_key,item_name,plan_id,condition_state,main_value,sub_value,enabledBoolean]`, with absent text as an empty string. JSON tuples are sorted lexically, then SHA-256 hashed. The read-only Sheet snapshot's display digest is:

`f31ee7bbe48e28b9325c821449b1f29f67e6e67ce2561de0a0ca52bd1ef7294d`

This is audit evidence, not a hardcoded runtime data source or fallback benefit table. Existing records were not copied into production code.

## Executed live-read result

[GitHub CI run 43918053812](https://github.com/ivancww/medical/actions/runs/43918053812) passed all four jobs on code head `c0cc753814c6adc5f33b289b4f6a93befd3fb99f`. The read-only endpoint audit returned **35 rows, all enabled**, with ELITE 8 / WISE 16 / FLEXI 11 and all eight item keys. Both `getDataset` aliases returned the same 35-row display digest as the full bootstrap.

The deployed response's digest is exactly the Sheet digest above: **`f31ee7bbe48e28b9325c821449b1f29f67e6e67ce2561de0a0ca52bd1ef7294d`**. This verifies that the populated Sheet display data reached the deployed Official response in the audited read, without missing enabled cells. The frontend mapper checked every applicable live row, including both Wise variants sharing a source comparison ID. No missing benefit values were invented.

The browser job also loaded that captured 35-row response through the app's cache/transport boundary and rendered the existing three cards successfully. Its artifact contains [19 screenshots, including captured live comparison](https://github.com/ivancww/medical/actions/runs/43918053812/artifacts/14250317517). The browser replay now explicitly checks Elite, Wise and Flexi DOM cells across the room/network combinations; latest execution of that additional coverage is reported in the PR's current CI result.

The direct workspace request remains **BLOCKED (HTTP 403)**. CI's successful read does not remove that environment limitation, establish GAS source/deployment equivalence or certify production-browser CORS/PWA behavior.

## Pipeline findings

| Stage | Finding / evidence |
| --- | --- |
| Sheet → repository GAS reader | `medicalOfficialReadObjects_` / `readObjectSheet_` read all nonblank rows from the existing `Plan_Comparison` tab. No enabled/verified/product whitelist filter is applied in the reader. The regression includes all three plans, both Wise states, Flexi non-network, a disabled row and verified=false publication metadata. |
| GAS snapshot / routes | `medicalOfficialReadSnapshot_` includes `planComparison` in both the payload and its revision hash. `medicalFullBootstrap_` returns `planComparison`. `getDataset` aliases `planComparison` and `plan_comparison` both resolve to the same Sheet. These statements describe repository source, not independent proof of deployed-source parity. |
| Deployed endpoint from this Cloud workspace | **BLOCKED: HTTP 403** on the canonical `/exec` URL. No production integration success is inferred from repository source or synthetic fixtures. |
| Deployed endpoint from GitHub CI | A new read-only audit reads the actual full response and both `getDataset` aliases. It requires populated rows for all three plans, checks every applicable cell using the real frontend mapper, and logs row/state counts and a display digest. Alias digests must match the full response. Executed successfully in run 43918053812: all 35 rows and both aliases match the canonical Sheet display digest. The local 403 remains BLOCKED. |
| Payload → frontend | Fixed empty camelCase arrays masking populated snake_case/nested arrays; selection now uses the first populated supported Official array, then a valid empty array. Populated camelCase retains precedence. The frontend does not merge aliases or fabricate values. |
| Row mapping | Item keys retain their stable identity; plan IDs and condition states are trimmed and uppercased. All enabled nonblank values are grouped dynamically. `verified` is publication metadata, not an additional display gate. No hardcoded item whitelist. Missing room/network variants never inherit another context's value. |
| Official cache refresh | Version changes or revision changes fetch and replace the validated Official payload; unchanged version/revision reuse the cache. An absent revision retains the existing full-read fallback. Invalid full responses cannot replace valid in-memory or stored cache. User overrides are untouched. |
| Cache / connection failures | R07 distinguishes a missing dataset field (尚未載入), an explicitly empty dataset (暫未提供), a failed connection with cached values (未能連線…本機已儲存), and an invalid response (資料格式有誤). Healthy data adds no notice. Missing cells retain 資料待核實. |
| Cache → UI | The existing three cards and aligned comparison columns remain. Tests cover all supported aliases, every Wise condition, Flexi network/non-network, dynamically added item keys, sub-value-only rows and repeated comparison IDs across distinct conditions. |
| Captured live payload → browser | CI captures the real full payload, then replays it through the existing cache/transport boundary in Chromium and verifies selected Elite/Wise/Flexi cells and the existing three cards. This verifies captured-data rendering, not production browser CORS/authentication, installed-PWA delivery or physical-device acceptance. |

The complete deployed GAS project's source/version and binding configuration remain unverified. Matching live response data to the Sheet, if observed, establishes response equivalence for the audited read; it does not establish deployed-source identity or certify Official writes.

## Validation and review boundary

- **PASS locally:** 31 Node regression scripts, including the expanded GAS mapping and new frontend/cache pipeline regressions.
- **PASS locally:** existing Ready browser suite; Guided Flow/Plan Hub/R03 suite with **582 checks**; synthetic Plan Comparison transport/cache/browser suite with **24 checks**.
- **PASS locally:** JS/MJS/helper syntax, existing Pages validation and static-site assembly. No deployment occurred.
- **PASS review:** R03 calculation function, R05 renderers, claim engine and all five R05 PNGs unchanged; Official/User storage keys and version v1.2.12 preserved.
- **BLOCKED locally:** direct live GAS GET returned HTTP 403. Live-data and captured-live-rendering results must come from the actual CI run, not these local fixture results.
- **NOT TESTED:** physical iPad Safari/HONOR hardware and installed-PWA acceptance; deployed GAS source parity.

Latest live-read evidence and CI results are recorded on PR #50. Keep it Draft; no merge or deployment without Product Owner approval.

## Screenshots

- [R03 iPad landscape](qa/v1.2.12/ipad-landscape-r03.png), [portrait](qa/v1.2.12/ipad-portrait-r03.png), [HONOR unfolded](qa/v1.2.12/honor-magic-v5-unfolded-r03.png), [mobile](qa/v1.2.12/mobile-r03.png).
- [Tiny company segment](qa/v1.2.12/mobile-r03-small-company.png), [tiny customer segment](qa/v1.2.12/mobile-r03-small-customer.png).
- Distinct synthetic data-state examples: [missing payload field](qa/v1.2.12/plan-comparison-missing-synthetic.png), [offline retained cache](qa/v1.2.12/plan-comparison-offline-synthetic.png).
- CI uploads its captured-live comparison screenshot in the existing browser screenshot artifact. Local screenshots use explicitly synthetic fixtures.
