# Medical brochure media boundary

Medical Plans already carries the Official `brochure_url` field. The frontend
reads that field from the Official `Plans` dataset and does not contain a
brochure URL allowlist.

The latest AVA Platform source was reviewed before this change. It contains an
`AVAStorage` provider abstraction whose shared provider is local storage. A
Firebase Storage upload implementation exists inside the 5pay module, but it
is not exposed as an approved shared AVA Cloud Media service or Medical Admin
upload contract. The user has now explicitly authorized the existing
`medical-and-ci` Firebase project for Medical / CI brochure storage.

Medical now uses a versioned three-layer client: `medical-firebase.js` is the
Official-media orchestration layer, `medical-firebase-bootstrap.js` is the
classic readiness gate, and `medical-firebase-module.js` is the thin
Storage-only SDK provider for that existing project. Official media upload uses the same public-write Firebase namespace
model as current Critical Illness; the Admin session still gates the later
Official Sheet write. It validates
PDF/JPEG/PNG/WEBP and size, creates a deterministic plan-scoped object path,
and returns the HTTPS URL. The current safe boundary is:

`approved cloud media reference → Medical Official Plans.brochure_url → P7`

The browser never writes a binary or Base64 value to Google Sheet, IndexedDB or
LocalStorage. After Firebase upload, only the returned URL is sent through the
existing authenticated Medical Official write path and is accepted after
read-after-write confirmation. The intended public rule is limited to
`medical/official/brochures/**`; user/private and unrelated bucket paths remain
denied.
