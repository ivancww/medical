# Medical Unified Admin Auth Integration

Medical App ID: `medical`.

Medical is currently a partial Admin implementation. The existing Admin surface
can read Official data and create a confirmed local intake draft, but this
repository has no Official write endpoint or checked-in backend source. The
integration therefore enables only the authenticated route and preserves the
existing read/draft capability; Official publishing is not applicable until a
Medical-owned write operation exists.

The browser accepts `?avaEntry=admin` only as a route selector. It requires the
short-lived, one-time `avaAdminLaunch` issued by AVA Studio. The Medical Official
GAS endpoint exchanges that ticket server-to-server with the Platform using the
`exchangeAppLaunch` contract. The opaque Medical App Grant is held in memory only;
it is not written to LocalStorage, IndexedDB, User backup, restore data, QR, or a
URL. The launch query parameter is removed after a successful exchange.

Deploy the helpers in `gas/MedicalAdminAuth.gs` alongside the existing Medical
Official GAS code, configure `AVA_PLATFORM_ADMIN_AUTH_URL`, and route
`exchangeAppLaunch` through `medicalAdminAuthAction_`. If a future Official write
is added, call `medicalVerifyAppGrant_(appGrant, operation)` server-side before
Medical payload/business validation and the existing Medical-owned write.
