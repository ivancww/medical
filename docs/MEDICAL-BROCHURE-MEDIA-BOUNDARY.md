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

Medical now uses a versioned `medical-firebase.js` classic bootstrap and its
`medical-firebase-module.js` implementation for that existing project. It
uploads only from the authenticated Medical Admin UI, validates
PDF/JPEG/PNG/WEBP and size, creates a deterministic plan-scoped object path,
and returns the HTTPS URL. The current safe boundary is:

`approved cloud media reference → Medical Official Plans.brochure_url → P7`

The browser never writes a binary or Base64 value to Google Sheet, IndexedDB or
LocalStorage. After Firebase upload, only the returned URL is sent through the
existing authenticated Medical Official write path and is accepted after
read-after-write confirmation. Firebase Storage rules were not changed by this
PR. They must be verified in the existing Firebase project before production
Admin upload is declared operational; if the rules do not permit the intended
Admin-controlled write, the minimum rules/auth change must be reviewed before
deployment.
