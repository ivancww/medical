# Medical Admin Connector pin

- Connector version: `0.3.0`
- Compatibility contract: `ava-admin-session-v1`
- Canonical source: Medical feature branch implementation
- Vendored artifact: `ava-admin-connector.mjs`
- Medical release: `v1.2.8`

The vendored artifact is the Medical Admin Session v1 implementation and must
remain aligned with the Medical GAS contract. Any future Connector change must
run the Connector suite and intentionally update this pin in an App PR.

Medical retains its own GAS endpoint, Official Data schema, allowed fields,
revision contract, Google Sheet and business logic. Connector version and
Medical App version remain independent.

