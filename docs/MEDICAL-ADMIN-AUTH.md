# Medical Unified Admin Auth Integration

Medical App ID: `medical`.

Medical Admin keeps the existing authenticated route and owns the Official
data editor. `medical-official-sync.js` edits only allowlisted Medical Official
fields; User Overrides remain local and are never submitted to the Sheet.
`gas/MedicalOfficialData.gs` is the checked-in mutation contract to merge into
the existing Medical GAS project without replacing its read endpoint.

The browser accepts `?avaEntry=admin` only as a route selector. It requires the
short-lived, one-time `avaAdminLaunch` issued by AVA Studio. The Medical Official
GAS endpoint exchanges that ticket server-to-server with the Platform using the
`exchangeAppLaunch` contract. The opaque Medical App Grant is held in memory only;
it is not written to LocalStorage, IndexedDB, User backup, restore data, QR, or a
URL. The launch query parameter is removed after a successful exchange.

Deploy the helpers in `gas/MedicalAdminAuth.gs` alongside the existing Medical
Official GAS code, configure `AVA_PLATFORM_ADMIN_AUTH_URL`, and route
`exchangeAppLaunch` through `medicalAdminAuthAction_`. Official writes call
`medicalVerifyAppGrant_(appGrant, "official-write")` before validation, use a
script lock and expected Official version, preserve the stable record ID, and
re-read the Sheet before reporting success. The read adapter and production
deployment must be wired and verified before claiming a real round trip.
