# AVA Medical — Product Rules v1

## Scope
Adult Medical only. Two journeys: Ready and Not Ready. Child Medical/CI is outside this app.

## Shared ownership
Common architecture/UI/responsive/navigation/modes/PWA/local-first patterns follow AVA Mother Rules and canonical Design System. This file owns only Medical-specific product behaviour.

## Official data
Official API:
`https://script.google.com/macros/s/AKfycbzOOtrQy-LfaMlTuLhJJD0ibfSuns4mkF4rWhn6BBTekb09O_UG9-aYH-JGMDZ1lekejw/exec`

Core official sheets: Config, Pages, Options, Plans, Claim_Rules, Claim_Cases, Premium_Settings plus recognized premium tables.

Local-first: render valid Official cache immediately, run lightweight checkVersion, refresh Official cache only when version changes. User overrides remain separate and take precedence until reset.

## Ready journey
R01 Concern Setup → R02 Existing Medical (company medical / no medical only) → conditional R03 Company Medical Setup → R04 Real Claim Case → R05 Coverage Layers + company continuity reminder → R06 Plan claim/follow-up comparison → R07 Plan Coverage & Features → R08 Concern Reflection → R09 Premium/Health Program/Age/Discount → R10 one-click live presentation.

Stable IDs, never visible-text branching. Customer-facing claim content uses a Simple Claim Illustration: Medical Cost → Company Medical → Personal Medical → You Pay. ELITE/WISE illustrate deductible-then-cover and FLEXI uses the Official approximate illustration rate (currently 85%). This is a communication illustration, not a guaranteed claim result. Detailed surgery classes, per-benefit limits and other claim-engine internals must not be exposed in the customer journey; relevant product conditions belong in R07.

## Not Ready journey
N01 public/private/depends → N02 trade-offs → N03 current private medical-cost reference → N04 adjustable medical-cost growth illustration → N05 funding source → N06 one-click Medical Funding Report → N07 future arrangement; “了解醫療保障可以負擔幾多” may transition to Ready.

N05 official options: bank savings, stocks, ETF/funds, family financial resources, retirement funds.

Reference cost/inflation values come from Official Config. They are illustrations, not quotes or guaranteed future costs.

## Fixed pages
Functional/calculation pages are fixed. UI marks them “* 固定頁”. Their functional contract cannot be deleted/hidden or reordered in a way that breaks dependencies. Permitted presentation text remains editable.

## User / Admin
User = Frontstage + Edit permission: Edit → Preview → Save Local. User changes only User Layer.

Admin = AVA Studio pattern for Official Pages, Options, Plans, Claim Rules, Claim Cases, Premium Settings and publishing/sync.

## AI / Manual intake
Both Admin and User support “AI 自動讀取文件” and “手動輸入”; both converge on a confirmation step.

Admin confirmed Official intake may write structured Official data and, where configured, source files to Official storage. User intake never silently writes Official data; after confirmation, ask whether to save to User Layer or use for session only.

CRM AI adapter is an integration reference only. Current CRM endpoint:
`https://script.google.com/macros/s/AKfycbzPIlJHqcGWDMeJd_Tc_tpDz-r-vVW9lNXBiVXnD2o0ulVNoGkUHy-Ve3rAxnsWh9dhUQ/exec`
Medical extraction uses its own schema contract and must not pretend the CRM policy schema is a Medical claim/brochure schema. If backend support is unavailable, show a clear fallback to manual input.

## Presentation
Use explicit units/currency/assumptions. Historical claim facts and current-plan simulations must be labelled distinctly. Do not call simulated reimbursement an actual historical claim.

## Current Mother Rules alignment

AVA Platform's merged Mother Rules and canonical Design System are the authority for shared architecture, responsive behaviour, navigation, modes, Local-first patterns, Media, Portable User Data, Backup / Restore, QR Restore and security. Medical applies those rules without copying or reimplementing the shared Platform services. The authoritative study baseline for this MVP is AVA Platform commit `5bd6db94832e32a92d74bb90f0356b87d8b88644` (merged main, 2026-09-24).

Medical-specific application:

- Official Pages, Options, Plans, Claim Rules, Claim Cases and Premium data remain Official/read-only to Users. User title/subtitle edits are local User Overrides and never mutate Official data; fixed page calculation, journey and dependency contracts remain protected.
- The current MVP supports fixed R01–R10 and N01–N07 pages only. It does not yet implement User-created Pages, Media Pages, or the Platform Portable User Data adapter. If added, Medical must preserve stable page IDs, Flow order, visibility, metadata, media references and fixed-page dependencies.
- Image Page and Video Page are distinct future page types. Medical must not infer type from a URL. The Mother limits apply when Medical enables them: six images maximum with up to three responsive columns, or one responsive non-autoplay video with normal controls.
- Medical stores structured Official/User data locally for Local-first operation. It does not store User Media binary in IndexedDB, LocalStorage, Base64 App data or ordinary backups. Media binary, Media failure handling, lazy restore, QR restore and Cloud authorization belong to AVA Platform shared infrastructure.
- Pre-integration `編輯` and `Admin` controls remain temporary QA entry points. Formal integration routes User editing through AVA Platform → Settings → Medical and Admin configuration through AVA Studio → Medical; the underlying Medical capabilities remain App-owned.
- The Frontstage keeps a persistent `返回 AVA` control, including Customer Presentation mode, and uses the shared responsive ranges. Physical iPad/HONOR Magic V5 and installed-PWA QA remain User Review unless executed on those devices.

## Gap classification for the current MVP

| Finding | Classification | Treatment |
| --- | --- | --- |
| Official/User separation, Local-first cache, fixed pages, protected calculations, no-fabrication Claim Case/Premium handling, and Return to AVA | A — already compliant | Preserve and regression-test |
| Mother authority, User Override precedence, media/page types, and portable-data boundaries | B — documentation alignment | Defined here; shared rules remain in AVA Platform |
| Keep Return to AVA visible during Customer Presentation | C — safe Medical implementation | Keep navigation outside `ava-agent-only` chrome |
| User-created Pages, Media binary storage, Portable User Data, Backup/Restore, QR Restore, common auth and version services | D — Mother/shared dependency | Integrate with Platform contracts; do not build parallel Medical services |
| Which Medical page/content fields become User-editable, and whether Medical enables Media Pages | E — product decision | Not implemented in this batch |
| Provider-specific Cloud Media, authentication, security, or production backup transport | F — higher-risk Cloud/Security decision | Not implemented; assess Sol only when this architecture is actually in scope |

Current limitations are intentional: this repository cannot claim Cloud Media upload, Media reconnect, portable backup, QR restore, or cross-device User Data restore until the corresponding AVA Platform services and Medical integration contract are available. Fail-safe empty/unavailable states remain preferable to simulated success.
