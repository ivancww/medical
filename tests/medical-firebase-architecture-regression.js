const assert = require('node:assert/strict');
const fs = require('node:fs');

const orchestration = fs.readFileSync('medical-firebase.js', 'utf8');
const bootstrap = fs.readFileSync('medical-firebase-bootstrap.js', 'utf8');
const provider = fs.readFileSync('medical-firebase-module.js', 'utf8');
const sync = fs.readFileSync('medical-official-sync.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const rules = fs.readFileSync('firebase/storage.rules', 'utf8');

assert.match(orchestration, /MedicalFirebaseMedia/);
assert.match(orchestration, /validateBrochureFile/);
assert.match(orchestration, /officialBrochurePath/);
assert.doesNotMatch(orchestration, /admin-proof/);
assert.match(orchestration, /uploadBytesResumable/);
assert.match(orchestration, /getMetadata/);
assert.match(orchestration, /getDownloadURL/);
assert.match(orchestration, /FIREBASE_UPLOAD_TIMEOUT_MS = 120000/);
assert.match(orchestration, /medical\/official\/brochures/);
assert.match(orchestration, /application\/pdf/);
assert.match(orchestration, /image\/png/);
assert.match(orchestration, /image\/jpeg/);
assert.match(orchestration, /image\/webp/);
assert.match(orchestration, /MAX_BYTES = 20 \* 1024 \* 1024/);
assert.doesNotMatch(orchestration, /https:\/\/www\.gstatic\.com\/firebase/);

assert.match(bootstrap, /MedicalFirebaseReady = ready/);
assert.match(bootstrap, /import\(MODULE_URL\)/);
assert.match(bootstrap, /module-bootstrap/);
assert.match(bootstrap, /module-import/);
assert.match(bootstrap, /sdk-import/);
assert.match(bootstrap, /MODULE_LOAD_TIMEOUT_MS = 18000/);

assert.match(provider, /firebase-app\.js/);
assert.match(provider, /firebase-storage\.js/);
assert.match(provider, /getApps/);
assert.match(provider, /initializeApp/);
assert.match(provider, /getStorage/);
assert.match(provider, /getMetadata/);
assert.match(provider, /uploadBytesResumable/);
assert.match(provider, /getDownloadURL/);
assert.match(provider, /candidate\.name === "ava-medical"/);
assert.doesNotMatch(provider, /firebase-auth\.js|getAuth|signInWithCustomToken|setPersistence|inMemoryPersistence/);

assert.doesNotMatch(sync, /MedicalAdminAuth\?\.getSessionProof\?\.\(\)/);
assert.match(sync, /authorizedRequest\(\{ action: "updateOfficialRecord"/);
assert.match(sync, /official-verification/);
assert.match(sync, /pendingBrochureUploads\.delete\(recordIdValue\)/);
assert.match(index, /medical-firebase-bootstrap\.js\?v=1\.2\.7/);
assert.match(index, /medical-firebase\.js\?v=1\.2\.7/);
assert.match(sw, /medical-firebase-bootstrap\.js\?v=1\.2\.7/);
assert.match(sw, /medical-firebase\.js\?v=1\.2\.7/);
assert.match(sw, /medical-firebase-module\.js\?v=1\.2\.7/);

assert.match(rules, /match \/critical-illness\/official\/\{planId\}\/\{allPaths=\*\*\}[\s\S]*?allow read: if true;[\s\S]*?allow create, update: if validMedia\(\);[\s\S]*?allow delete: if false;/);
assert.match(rules, /match \/critical-illness\/users\/\{userScope\}\/\{allPaths=\*\*\}/);
assert.match(rules, /match \/medical\/official\/brochures\/\{allPaths=\*\*\}[\s\S]*?allow read: if true;[\s\S]*?allow create, update: if validMedia\(\);[\s\S]*?allow delete: if false;/);
assert.match(rules, /match \/\{allPaths=\*\*\} \{[\s\S]*?allow read, write: if false;/);
assert.doesNotMatch(`${orchestration}\n${bootstrap}\n${provider}`, /PRIVATE KEY|service-account|custom-token|signInWithCustomToken/i);

console.log('Medical CI-v0.6.5 Firebase three-layer architecture regression PASS');
