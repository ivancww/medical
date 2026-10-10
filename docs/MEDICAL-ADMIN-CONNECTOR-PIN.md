# Medical Admin Connector pin

- Connector version: `0.2.0`
- Compatibility contract: `ava-legacy-app-grant-v1`
- Canonical source: Medical feature branch implementation
- Vendored artifact: `ava-admin-connector.mjs`
- Medical release: `v1.1.7`

The vendored artifact is part of the Medical App Grant implementation and must
remain aligned with the Medical GAS contract. Any future Connector change must
run the Connector suite and intentionally update this pin in an App PR.

Medical retains its own GAS endpoint, Official Data schema, allowed fields,
revision contract, Google Sheet and business logic. Connector version and
Medical App version remain independent.
