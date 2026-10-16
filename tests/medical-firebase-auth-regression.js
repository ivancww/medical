const assert = require('node:assert/strict');
const fs = require('node:fs');

const frontend = fs.readFileSync('medical-firebase.js', 'utf8');
const bootstrap = fs.readFileSync('medical-firebase-bootstrap.js', 'utf8');
const provider = fs.readFileSync('medical-firebase-module.js', 'utf8');
const sync = fs.readFileSync('medical-official-sync.js', 'utf8');
const gas = fs.readFileSync('gas/MedicalProductionFinal.gs', 'utf8');
const rules = fs.readFileSync('firebase/storage.rules', 'utf8');
const connector = fs.readFileSync('ava-admin-connector.mjs', 'utf8');

assert.match(provider, /firebase-app\.js/);
assert.match(provider, /firebase-storage\.js/);
assert.match(provider, /projectId: "medical-and-ci"/);
assert.match(provider, /storageBucket: "medical-and-ci\.firebasestorage\.app"/);
assert.match(frontend, /uploadBytesResumable/);
assert.match(frontend, /getDownloadURL/);
assert.match(frontend, /getMetadata/);
assert.match(frontend, /FIREBASE_UPLOAD_TIMEOUT_MS = 120000/);
assert.doesNotMatch(`${frontend}\n${bootstrap}\n${provider}`, /firebase-auth\.js|getAuth|signInWithCustomToken|inMemoryPersistence|setPersistence|issueFirebaseAuthorization/);
assert.doesNotMatch(`${frontend}\n${bootstrap}\n${provider}`, /-----BEGIN (?:RSA )?PRIVATE KEY-----|localStorage|sessionStorage|indexedDB|base64/i);
assert.match(frontend, /medical\/official\/brochures/);
assert.doesNotMatch(frontend, /critical-illness\/official/);

// Admin authentication still gates the Official Sheet write independently of
// the deliberately public Official-media Storage namespace.
assert.match(sync, /MedicalAdminAuth\?\.hasSession\(\)/);
assert.match(sync, /authorizedRequest\(\{ action: "updateOfficialRecord"/);
assert.match(sync, /official-verification/);
assert.match(sync, /pendingBrochureUploads\.delete\(recordIdValue\)/);

// The obsolete Firebase custom-token/service-account path is removed from
// Medical GAS. Admin authorization remains the only gate for Sheet writes.
for (const obsolete of [
  'MEDICAL_FIREBASE_CUSTOM_TOKEN_AUDIENCE',
  'MEDICAL_FIREBASE_STORAGE_CONTRACT',
  'MEDICAL_FIREBASE_SERVICE_ACCOUNT_EMAIL_PROPERTY',
  'MEDICAL_FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY_PROPERTY',
  'MEDICAL_FIREBASE_AUTH_BROKER_URL_PROPERTY',
  'MEDICAL_FIREBASE_AUTH_BROKER_SECRET_PROPERTY',
  'medicalFirebaseError_',
  'base64Url_',
  'firebaseServiceAccount_',
  'issueDirectFirebaseAdminToken_',
  'issueFirebaseAuthorization_',
  'issueFirebaseAuthorization'
]) assert.doesNotMatch(gas, new RegExp(obsolete));
assert.match(gas, /body\.action === "exchangeAdminSession"/);
assert.match(gas, /body\.action === "exchangeAppLaunch"/);
assert.match(gas, /body\.action === "updateOfficialRecord"/);
assert.match(gas, /body\.action === "createOfficialRecord"/);
assert.doesNotMatch(`${frontend}\n${bootstrap}\n${provider}`, /MEDICAL_FIREBASE_SERVICE_ACCOUNT|privateKey|serviceAccount/i);
assert.match(connector, /payload\?\.error\?\.code/);

assert.match(rules, /match \/critical-illness\/official\/\{planId\}\/\{allPaths=\*\*\}/);
assert.match(rules, /match \/critical-illness\/official\/\{planId\}\/\{allPaths=\*\*\}[\s\S]*?allow read: if true;[\s\S]*?allow create, update: if validMedia\(\);[\s\S]*?allow delete: if false;/);
assert.match(rules, /match \/medical\/official\/brochures\/\{allPaths=\*\*\}/);
assert.match(rules, /match \/medical\/official\/brochures\/\{allPaths=\*\*\}[\s\S]*?allow read: if true;[\s\S]*?allow create, update: if validMedia\(\);[\s\S]*?allow delete: if false;/);
assert.doesNotMatch(rules, /match \/medical\/official\/\{allPaths=\*\*\}/);
assert.doesNotMatch(rules, /allow read, write: if true/);
assert.match(rules, /match \/critical-illness\/users\/\{userScope\}\/\{allPaths=\*\*\}/);
assert.match(rules, /match \/\{allPaths=\*\*\} \{[\s\S]*?allow read, write: if false;/);

console.log('Medical public Official-media Firebase boundary, Admin Sheet-write gate, narrow shared rules and credential-safety regression PASS');
