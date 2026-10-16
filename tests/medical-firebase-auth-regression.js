const assert = require('node:assert/strict');
const fs = require('node:fs');

const frontend = fs.readFileSync('medical-firebase-module.js', 'utf8');
const bootstrap = fs.readFileSync('medical-firebase.js', 'utf8');
const sync = fs.readFileSync('medical-official-sync.js', 'utf8');
const gas = fs.readFileSync('gas/MedicalProductionFinal.gs', 'utf8');
const rules = fs.readFileSync('firebase/storage.rules', 'utf8');
const connector = fs.readFileSync('ava-admin-connector.mjs', 'utf8');

assert.match(frontend, /firebase-app\.js/);
assert.match(frontend, /firebase-storage\.js/);
assert.match(frontend, /projectId: "medical-and-ci"/);
assert.match(frontend, /storageBucket: "medical-and-ci\.firebasestorage\.app"/);
assert.match(frontend, /uploadBytesResumable/);
assert.match(frontend, /getDownloadURL/);
assert.match(frontend, /FIREBASE_UPLOAD_TIMEOUT_MS = 120000/);
assert.doesNotMatch(frontend, /firebase-auth\.js|getAuth|signInWithCustomToken|inMemoryPersistence|setPersistence|issueFirebaseAuthorization/);
assert.doesNotMatch(`${frontend}\n${bootstrap}`, /-----BEGIN (?:RSA )?PRIVATE KEY-----|localStorage|sessionStorage|indexedDB|base64/i);
assert.match(frontend, /medical\/official\/brochures/);
assert.doesNotMatch(frontend, /critical-illness\/official/);

// Admin authentication still gates the Official Sheet write independently of
// the deliberately public Official-media Storage namespace.
assert.match(sync, /MedicalAdminAuth\?\.hasSession\(\)/);
assert.match(sync, /authorizedRequest\(\{ action: "updateOfficialRecord"/);
assert.match(sync, /official-verification/);
assert.match(sync, /pendingBrochureUploads\.delete\(recordIdValue\)/);

// Service-account/custom-token material remains server-side only. The legacy
// GAS action may remain for compatibility, but the browser no longer calls it.
for (const property of [
  'MEDICAL_FIREBASE_SERVICE_ACCOUNT_EMAIL',
  'MEDICAL_FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY',
  'MEDICAL_FIREBASE_AUTH_BROKER_URL',
  'MEDICAL_FIREBASE_AUTH_BROKER_SECRET'
]) assert.match(gas, new RegExp(property));
assert.match(gas, /function issueFirebaseAuthorization_\(/);
assert.doesNotMatch(frontend, /MEDICAL_FIREBASE_SERVICE_ACCOUNT|privateKey|serviceAccount/i);
assert.match(connector, /payload\?\.error\?\.code/);

assert.match(rules, /match \/critical-illness\/official\/\{planId\}\/\{allPaths=\*\*\}/);
assert.match(rules, /allow create, update: if validMedia\(\);/);
assert.match(rules, /match \/medical\/official\/brochures\/\{allPaths=\*\*\}/);
assert.match(rules, /match \/medical\/official\/brochures\/\{allPaths=\*\*\}[\s\S]*?allow read: if true;[\s\S]*?allow create, update: if validMedia\(\);[\s\S]*?allow delete: if false;/);
assert.doesNotMatch(rules, /match \/medical\/official\/\{allPaths=\*\*\}/);
assert.doesNotMatch(rules, /allow read, write: if true/);
assert.match(rules, /match \/critical-illness\/users\/\{userScope\}\/\{allPaths=\*\*\}/);

console.log('Medical public Official-media Firebase boundary, Admin Sheet-write gate, narrow shared rules and credential-safety regression PASS');
