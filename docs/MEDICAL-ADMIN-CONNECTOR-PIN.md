# Medical Admin Connector pin

- Connector version: `0.1.1`
- Compatibility contract: `ava-admin-session-v1`
- Canonical source commit: `408099060a579c883a6a97f2731c5e4d93e74766`
- Vendored same-origin artifact: `ava-admin-connector.mjs`
- Medical release: `v1.1.6`

The vendored artifact is pinned for this Medical pilot and must not be edited
independently. A future Connector change must update the canonical source,
run the Connector suite, then intentionally update this pin in an App PR.

Medical retains its own GAS endpoint, Official Data schema, allowed fields,
revision contract, Google Sheet and business logic. Connector version and
Medical App version remain independent.
