# Medical frontend release version

`release-version.json` is the source of truth for the human-readable Medical
frontend version. Any user-visible production change, including an Admin-only
change, must update `appVersion` before the change is merged.

The Pages workflow copies the metadata into the published shell and generates
`app-build.js` with both values:

- `AVA_MEDICAL_VERSION`: the human-readable App version shown in the header.
- `AVA_MEDICAL_BUILD`: the Git commit SHA used for technical release tracing.

The Official Data version returned by Medical GAS remains independent and must
not be changed for a frontend-only release. The Service Worker keeps its
automatic update lifecycle; `release-version.json` is included in the shell so
the new release identity is refreshed together with the frontend assets.

For every frontend release, run the release identity regression and confirm
that the header, metadata, generated build script, asset query versions and
Service Worker shell reference the same App version.
