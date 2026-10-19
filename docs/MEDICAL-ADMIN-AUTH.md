# Medical Admin Session v1 Integration

Medical App ID: `medical`.

The Medical frontend uses the browser-bound `ava-admin-session-v1` contract.
The canonical Medical GAS source temporarily retains the legacy
`ava-legacy-app-grant-v1` verification path for deployed compatibility, but
the frontend never sends an App Grant.

Medical Admin keeps the existing authenticated route and owns the Official
data editor. The App bundles the Medical AVA Legacy App Grant Connector
(`ava-admin-connector.mjs`) and uses its authorization state.
`medical-official-sync.js` edits only allowlisted Medical Official fields;
User Overrides remain local and are never submitted to the Sheet.
`gas/MedicalOfficialData.gs` is the checked-in mutation-contract reference for
the existing Medical GAS project. The complete production bundle remains
`gas/MedicalProductionFinal.gs`.

The browser accepts `?avaEntry=admin` only as a route selector. AVA Studio
provides a short-lived one-time `avaAdminLaunch` and `avaAdminLaunchNonce`,
plus a browser-bound proof in the current Platform context envelope. Medical
exchanges that context through `exchangeAdminSession`. The resulting
`adminSessionProof` is held in closure memory only; it is not written to
LocalStorage, IndexedDB, User backup, restore data, QR, or a URL. Launch query
parameters and the consumed browser context are cleared after the exchange
starts.

`gas/MedicalProductionFinal.gs` is the sole canonical deployable bundle.
`gas/MedicalAdminAuth.gs` and `gas/MedicalOfficialData.gs` are focused reference
snippets only and must not be concatenated into the production bundle. Configure
`AVA_PLATFORM_ADMIN_AUTH_URL`, and route both `exchangeAdminSession` and the
temporary `exchangeAppLaunch` compatibility route through
`medicalAdminAuthAction_`. Official writes require exactly one of
`adminSessionProof` or the legacy `appGrant`; the corresponding Platform
verification route runs before validation, followed by the script lock, expected
Official version, stable record ID and read-after-write verification. The read
adapter and production deployment must be wired and verified before claiming a
real round trip.
