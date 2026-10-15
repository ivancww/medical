# Medical Firebase custom-token activation

PR #34 prepares the Medical Admin upload path for the existing shared
`medical-and-ci` Firebase project. The browser requests a short-lived token
from Medical GAS through the existing AVA Admin grant, signs in with
`signInWithCustomToken`, and keeps Firebase Auth persistence in memory only.
The browser never receives a service-account property and never writes a File,
blob, base64 value, or custom token to browser storage.

## Medical GAS Script Properties

Configure these properties in the Medical GAS project before deployment:

`MEDICAL_FIREBASE_SERVICE_ACCOUNT_EMAIL`

Set it to the Firebase service-account JSON `client_email`.

`MEDICAL_FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY`

Set it to the complete JSON `private_key`, including `-----BEGIN PRIVATE KEY-----`
and `-----END PRIVATE KEY-----`. Preserve the PEM newlines. If the value is
pasted with literal `\n` escapes, the issuer normalizes those escapes to real
newlines server-side. Never commit, log, or return this value.

Optional approved server-side broker properties are:

`MEDICAL_FIREBASE_AUTH_BROKER_URL`

`MEDICAL_FIREBASE_AUTH_BROKER_SECRET`

When both are present, Medical GAS uses the broker; otherwise it issues the
token directly from the two Medical service-account properties. The current
contract is `ava-medical-storage-v1`, with `avaAdmin: true` and a 15-minute
expiry.

## Shared Storage Rules

`firebase/storage.rules` is a deployment artifact only. The intended Medical
rule is public read and authenticated Admin-claim write under
`medical/official/**`:

```text
request.auth != null && request.auth.token.avaAdmin == true
```

The artifact preserves the existing Critical Illness namespaces and denies
unmatched paths. Do not deploy a public write rule and do not deploy this
change until the shared-bucket owner confirms the Critical Illness rules are
unchanged.

## Activation boundary

Production activation is still required after this PR:

1. Deploy the Medical GAS source.
2. Configure the two required Script Properties (or the approved broker pair).
3. Confirm Firebase Auth custom-token sign-in is enabled for `medical-and-ci`.
4. Deploy the coordinated Storage Rules change through the approved process.
5. Run the real iPad Admin upload and verify Firebase URL, Official write,
   read-after-write, success UI, retry, and old brochure preservation.

This PR does not deploy GAS, change Script Properties, change production
Sheets, or deploy Firebase Rules.
