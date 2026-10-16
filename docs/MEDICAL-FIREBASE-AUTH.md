# Medical Official media upload contract

Medical Official resources use the shared `medical-and-ci` Firebase Web
configuration and the Storage-only SDK path. The browser uploads directly to
Firebase Storage under `medical/official/{PLAN_ID}/...`, observes resumable
progress, obtains an HTTPS download URL, and then uses the existing AVA Admin
authorization contract for the authenticated Medical Official Sheet write.

Firebase Auth, custom tokens, service-account keys, broker credentials, and a
second Firebase login are not part of the Medical Official media flow.

## Shared Storage Rules

`firebase/storage.rules` is a deployment artifact only. The dedicated Medical
Official plan namespace is intentionally public media:

```text
match /medical/official/{planId}/{allPaths=**} {
  allow read: if true;
  allow create, update: if validMedia();
  allow delete: if false;
}
```

The rule validates PDF, PNG, JPEG, and WEBP content up to 20 MB. Unmatched
paths remain denied. The Critical Illness Official namespace uses the same
public-media contract; user-scoped CI media remains authenticated and scoped.

## Publication boundary

Public Storage media does not make Official Sheet editing public. The Admin
flow still requires AVA Admin authorization for `updateOfficialRecord` or
`createOfficialRecord`, followed by read-after-write confirmation before the
new resource URL becomes authoritative.

This source change does not deploy GAS or Firebase Rules. Deploy the reviewed
GAS source and shared Storage Rules through the approved production process,
then run the real-device Admin upload and retry/failure checks.
