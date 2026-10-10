# Medical Legacy App Grant Admin Integration

Medical App ID: `medical`.

During the migration window, the canonical Medical GAS source supports the
existing browser-bound `ava-admin-session-v1` contract and the new
`ava-legacy-app-grant-v1` contract. These are separate credential paths; a
failed verification in one path never falls back to the other.

Medical Admin keeps the existing authenticated route and owns the Official
data editor. The App bundles the Medical AVA Legacy App Grant Connector
(`ava-admin-connector.mjs`) and uses its authorization state.
`medical-official-sync.js` edits only allowlisted Medical Official fields;
User Overrides remain local and are never submitted to the Sheet.
`gas/MedicalOfficialData.gs` is the checked-in mutation-contract reference for
the existing Medical GAS project. The complete production bundle remains
`gas/MedicalProductionFinal.gs`.

The browser accepts `?avaEntry=admin` only as a route selector. The existing
V15 browser-bound frontend continues to use `exchangeAdminSession` with
`browserProof`, `launchNonce` and `adminSessionProof`. The migrated frontend
uses the short-lived, one-time `avaAdminLaunch` issued by AVA Studio. The
Medical Official GAS endpoint exchanges that ticket server-to-server with the
Platform using the `exchangeAppLaunch` contract. The resulting App Grant is held in memory only;
it is not written to LocalStorage, IndexedDB, User backup, restore data, QR, or a
URL. The launch query parameter is removed after a successful exchange.

`gas/MedicalProductionFinal.gs` is the sole canonical deployable bundle.
`gas/MedicalAdminAuth.gs` and `gas/MedicalOfficialData.gs` are focused reference
snippets only and must not be concatenated into the production bundle. Configure
`AVA_PLATFORM_ADMIN_AUTH_URL`, and route both `exchangeAdminSession` and
`exchangeAppLaunch` through `medicalAdminAuthAction_`. Official writes require
exactly one of `adminSessionProof` or `appGrant`; the corresponding Platform
verification route runs before validation, followed by the script lock, expected
Official version, stable record ID and read-after-write verification. The read
adapter and production deployment must be wired and verified before claiming a
real round trip.
