# Medical v1.2.12 — Guided Flow and Plan Hub review

This is a frontend-only Draft PR. Do not merge or deploy without Product Owner approval.

## Sources and baseline

- Medical latest remote main: `23150e6315aef7c8589fe569d4d9626efb0b206b` (v1.2.11); fetched before development and rechecked before publication.
- Open PRs inspected: #41 Admin startup hotfix, #39 Official media expansion, #5 Return to AVA. None covers this scope; no other PR was changed.
- Current Mother authority: `ivancww/avaplatform` main `a12beaea002df9ae13e676f890c16951d4f21b28`, root AGENTS, Mother Rules, Design System and canonical frontend/component CSS. Read-only study; no Platform changes.
- Requested CI workflow reference: `ivancww/critical-illness-` **v0.6.16**, commit `bc868d776fcbf925546e7db8da42c1ce9a1a3f6e`. Studied only its Guided Flow / Actual Plans navigation. Medical retains its own cards, engines and architecture.

## Result

Every Guided Flow page can open the Plan Hub and return to its exact originating page. The Hub overlays the active journey, retaining its answers and live calculation state. The existing Ready R07 entry and home shortcut also reach the Hub. Native buttons provide direct access to 三個醫療計劃, 保費參考 and 索償案例／索償示範, with plans as the default. Next from the ordinary Ready Hub continues to R08; premiums and claims no longer require sequential pages. N07 insurance exploration returns to N07 and keeps its summary route.

The existing three parallel Elite / Wise / Flexi cards, comparison content, selection checkboxes and responsive behavior remain. Their `planVisibility` state filters premium cards and deductible controls directly, including the Flexi-only and empty-selection cases. No second selection control is introduced. Premium table lookup, formulas, payment factors, Vitality and VHIS assumptions stay in the existing unchanged `product-data.js`.

Active Ready order is R01 → R02 → conditional R03 → R05 → R07 Hub → R08 → FINAL_SUMMARY. R04 and R09 remain Official stable IDs. Old R04 session pointers resume at R05; old R09 pointers resume at the Hub premium section. All verified, enabled, complete real cases appear in the Hub, separately from the existing claim simulation. An unavailable real-case message is confined to that area.

R03 adds a medical-expense input sharing `claimCost` with existing illustrations. Its breakdown uses `min(expense, applicable eligible-expense ceiling) × rate`; the assumption is visible outside the reflection-question area. The actual derived reimbursement is retained in `companyPaid`. Exactly the two requested Chinese question sentences appear in two separate cards, each prefixed with 💭, with no subtitles or additional descriptions.

The existing claim engine now accepts the full bill and company payment, computes eligible deductible credit and remaining deductible, and clamps reimbursement/customer payment so an expense cannot be paid twice. R05 retains its cards, selectors, bars and typography. Amount-dependent bar text is omitted from segments too narrow to read; a break opportunity after HK$ and amount wrapping prevent unfolded-viewport overflow without rearranging the cards.

## R03 labels and Plan Comparison audit follow-up

See the [read-only Sheet-to-UI pipeline audit](PLAN-COMPARISON-PIPELINE-AUDIT.md) for the latest scope, 35-row Sheet evidence, deployed-endpoint verification boundary and mapping/cache regressions. R03 now labels its green LEFT segment 公司 and blue RIGHT segment 自己, with ordered amounts beneath and no clipped inside labels. Both 💭 questions and the accepted R05 remain unchanged. The latest local suites pass 31 Node scripts, 582 Guided Flow/Hub/R03 browser assertions and 24 synthetic pipeline/browser checks, plus the existing Ready suite. Live GAS access from this workspace remains HTTP 403; CI run 43918053812 independently returned all 35 rows from the deployed endpoint and both aliases, with the exact display digest of the read-only canonical Sheet snapshot; captured-payload rendering also passed. Latest all-plan DOM coverage is recorded in the pipeline audit and PR checks.

## Final UI polish on the same Draft PR

Continued PR #50 from its fetched head `f96a1eb3e7b2a93a5909206787cd35d37e49a1ee`; the target remains v1.2.12. R03 now reuses the accepted R05 reimbursement palette: insurance reimbursement is green (`#dcfce7`), and customer unpaid expense is blue (`#dbeafe`). The two existing question sentences each have a 💭 prefix; their wording, card structure and calculation inputs remain unchanged.

The Hub navigation now orders **返回 Guided Flow → 三個醫療計劃 → 保費參考 → 索償案例／索償示範** in a single navigation container. The old separate return row is removed. Browser checks verify Return immediately to the left of Plans on the same row, and all four controls on one row for the tested iPad and unfolded-HONOR viewports. Mobile retains natural wrapping without overflow. Exact-page return and all existing state-persistence checks still pass.

R05 is accepted by the Product Owner and received no presentation or calculation changes in this refinement. Its renderer functions and claim engine are unchanged from the accepted head, and **all five regenerated R05 PNG files are byte-for-byte identical**. Nine R03/Hub screenshots were updated. All previous regression coverage is retained; the question assertions now include the requested emoji prefix, and the browser suite adds palette and navigation-row checks for a total of 456 passing assertions. All 30 Node scripts, the existing Ready browser suite, syntax checks, Pages validation and static build passed again. Physical-device/installed-PWA acceptance remains outside these emulated browser results.

## R05 simplified illustration — Product Owner confirmed release scope

The Product Owner deferred future Claims/Official claim dataset updates. R05 must
continue to calculate with the existing Official Claim_Rules fields
(`plan_id`, `illustration_method`, `default_rate`, `deductible_enabled`)
and the current medical expense, company reimbursement and selected deductible.

For ELITE and WISE's existing `deductible_then_cover` simplified illustration,
eligible company reimbursement counts toward the deductible:

- `credit = min(selectedDeductible, eligibleCompanyPaid)`
- `remainingDeductible = max(0, selectedDeductible - credit)`
- `personalPlanPaid = min(unpaidBill, max(0, unpaidBill - remainingDeductible) * planRate)`
- `customerPaid = medicalExpense - companyPaid - personalPlanPaid`

`eligibleCompanyPaid` defaults to the current company medical reimbursement for
the simplified illustration and may be supplied explicitly to narrow credit.
FLEXI remains on its existing percentage illustration. Monetary results are
bounded to prevent double payment or negative amounts.

The new `company_deductible_offset_verified` and
`company_deductible_offset_allowed` columns are **not** required for this
customer-facing simplified calculation. The new null-result gate was removed.
This is a communication illustration, **not** a contract-specific claim
adjudication or guaranteed actual settlement. Real Claim Cases and contract
verification remain separate future work; no production Sheet/GAS writes
are required by this change.

### Review limits

The code change and updated Node/Chromium tests cover calculation without
new Official columns. A fresh GitHub CI pass on the updated head is required
before approving any merge. Physical-device and installed-PWA acceptance
remain outstanding. Previously captured R05 screenshots from the gated
version are historical QA artifacts; regenerate them before release if needed.

## Executed validation

| Check | Status | Evidence / limit |
| --- | --- | --- |
| Existing and new Node regression scripts | PASS | 30/30, including Admin auth/session, Official/User isolation, shell update, premium data, P7 and journey regressions |
| Deductible coordination | PASS | Full, partial, none, exact, excess, eligible-subset and verified-ineligible credit; rate preservation; nonnegative/conservation matrix; unchanged Flexi; unknown rules return null |
| JavaScript/module syntax | PASS | All frontend JS/MJS and Node test files |
| Pages validation contract | PASS | Executed existing validate job locally |
| Static site build | PASS | Existing Pages assembly copied the complete shell and generated release/build identity in a local scratch artifact; no deployment |
| Guided Plan Hub Chromium suite | PASS | 456 assertions: eight selections; exact-page returns across both journeys; input/section/reload persistence; retired-ID migration; all verified cases; two exact questions; company reimbursement cases; deductible examples; controls and responsive QA |
| Existing Ready Chromium suite | PASS | Premium/deductible/gender/discount/payment handling, P7 Wise states, Back state, User Edit, Preview, Save Local and custom comparison items |
| Responsive rendering | PASS | Chromium 154.0.8037.57: iPad landscape 1180×820; iPad portrait 820×1180; HONOR Magic V5 unfolded CSS viewport 795×720; mobile 390×844; boundaries 650/651 and 1000/1001px. Existing suite additionally checks 720/1500px |
| Diff and protected-file review | PASS | No changes to premium engine/data, Official sync engine, GAS, Firebase configuration/rules, media connector implementation, other repositories, storage keys or backup format |
| Live Official GAS read from this Cloud workspace | BLOCKED | Network request returned HTTP 403; browser suites use explicit synthetic fixtures and pinned canonical CSS |
| Physical iPad Safari / HONOR / installed PWA acceptance | NOT TESTED | Viewport emulation and service-worker regression are not physical-device certification |
| Merge / deployment | NOT PERFORMED | Draft review only |

GitHub CI runs the existing claim, static and live Official-data jobs plus the new browser regression job. Its actual run/check result is reported on the PR; local results do not substitute for GitHub CI.

## Screenshots

Every screenshot is rendered from **synthetic QA data**, not a production customer record, verified product contract or real historical claim. In `*-verified-fixture` and the responsive R05 images, explicit synthetic rule flags exercise the requested deductible examples. The unverified image demonstrates the live-safe fallback when those flags are absent.

| Surface | Screenshots |
| --- | --- |
| R03 + Guided Flow shortcut | [iPad landscape](qa/v1.2.12/ipad-landscape-r03.png), [iPad portrait](qa/v1.2.12/ipad-portrait-r03.png), [HONOR unfolded](qa/v1.2.12/honor-magic-v5-unfolded-r03.png), [mobile](qa/v1.2.12/mobile-r03.png) |
| R05 | [Unverified-rule fallback](qa/v1.2.12/ipad-landscape-r05-unverified.png), [verified synthetic full-credit example](qa/v1.2.12/ipad-landscape-r05-verified-fixture.png), [iPad portrait](qa/v1.2.12/ipad-portrait-r05.png), [HONOR unfolded](qa/v1.2.12/honor-magic-v5-unfolded-r05.png), [mobile](qa/v1.2.12/mobile-r05.png) |
| Hub + Return Guided Flow | [iPad landscape](qa/v1.2.12/ipad-landscape-plan-hub.png), [iPad portrait](qa/v1.2.12/ipad-portrait-r07.png), [HONOR unfolded](qa/v1.2.12/honor-magic-v5-unfolded-r07.png), [mobile](qa/v1.2.12/mobile-r07.png) |
| Real-case unavailable + separate illustration | [Claim Hub](qa/v1.2.12/ipad-landscape-claim-hub.png) |

Reproduce with a Chromium runtime and the inspected Mother checkout:

```sh
CHROMIUM_PATH=/usr/bin/chromium AVA_MOTHER_ROOT=/path/to/avaplatform python tests/guided-plan-hub-browser.py
CHROMIUM_PATH=/usr/bin/chromium AVA_MOTHER_ROOT=/path/to/avaplatform python tests/ready-product-browser.py
node tests/guided-plan-hub-regression.js
```

GitHub CI installs its own Playwright Chromium runtime; `CHROMIUM_PATH` is optional.

## Changed files

- Application: `app.js`, `claim-engine.js`, `index.html`, `ready-product.css`.
- Release identity only: `release-version.json`, `app-build.js`, `sw.js`, `medical-admin-auth.js` (connector query version only), `docs/MEDICAL-ADMIN-CONNECTOR-PIN.md`.
- Product/review documentation: `docs/PRODUCT-RULES.md`, this report and 14 requested QA screenshots.
- CI: `.github/workflows/test.yml` adds deductible/browser coverage and screenshot artifacts; deployment workflow unchanged.
- New tests: `tests/guided-plan-hub-regression.js`, `tests/guided-plan-hub-browser.py`.
- Updated journey/browser fixtures: `tests/ready-flow-regression.js`, `tests/ready-product-browser.py`, `tests/notready-cost-funding-routing-regression.js`, `tests/post-v1.2.1-repair-regression.js`.
- Release-version assertions: `tests/release-version-regression.js`, `tests/platform-entry-regression.js`, `tests/medical-admin-auth-regression.js`, `tests/medical-admin-ui-regression.js`, `tests/medical-firebase-architecture-regression.js`, `tests/post-v1.2.4-module-summary-regression.js`.
