const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const frontend = fs.readFileSync('medical-firebase-module.js', 'utf8');
const gas = fs.readFileSync('gas/MedicalProductionFinal.gs', 'utf8');
const rules = fs.readFileSync('firebase/storage.rules', 'utf8');
const connector = fs.readFileSync('ava-admin-connector.mjs', 'utf8');

for (const source of [frontend, gas]) assert.doesNotMatch(source, /-----BEGIN (?:RSA )?PRIVATE KEY-----/);
assert.match(frontend, /firebase-auth\.js/);
assert.match(frontend, /getAuth/);
assert.match(frontend, /signInWithCustomToken/);
assert.match(frontend, /inMemoryPersistence/);
assert.match(frontend, /setPersistence\(auth, inMemoryPersistence\)/);
assert.match(frontend, /issueFirebaseAuthorization/);
assert.match(frontend, /ava-medical-storage-v1/);
assert.doesNotMatch(frontend, /localStorage|sessionStorage|indexedDB|base64/i);
assert.match(frontend, /medical\/official\/brochures/);
assert.doesNotMatch(frontend, /critical-illness\/official/);

for (const property of [
  'MEDICAL_FIREBASE_SERVICE_ACCOUNT_EMAIL',
  'MEDICAL_FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY',
  'MEDICAL_FIREBASE_AUTH_BROKER_URL',
  'MEDICAL_FIREBASE_AUTH_BROKER_SECRET'
]) assert.match(gas, new RegExp(property));
assert.match(gas, /function base64Url_\(/);
assert.match(gas, /function firebaseServiceAccount_\(/);
assert.match(gas, /function issueDirectFirebaseAdminToken_\(/);
assert.match(gas, /function issueFirebaseAuthorization_\(/);
assert.match(gas, /avaAdmin: true/);
assert.match(gas, /medical:admin/);
assert.match(gas, /15 \* 60/);
assert.match(gas, /body\.action === "issueFirebaseAuthorization"/);
assert.match(gas, /medicalVerifyAppGrant_\(payload\.appGrant, "medical:official-write"\)/);
assert.match(gas, /medicalVerifyAdminSession_\(payload\.adminSessionProof, "official-write"\)/);
assert.match(connector, /payload\?\.error\?\.code/);

assert.match(rules, /match \/medical\/official\/{allPaths=\*\*}/);
assert.match(rules, /request\.auth\.token\.avaAdmin == true/);
assert.doesNotMatch(rules, /allow write: if true/);
assert.match(rules, /critical-illness\/official/);
assert.match(rules, /critical-illness\/users/);

const endpoint = 'https://platform.example/exec';
const serviceEmail = 'medical-uploader@medical-and-ci.iam.gserviceaccount.com';
const privateKey = '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n';
const propertyState = {
  MEDICAL_FIREBASE_SERVICE_ACCOUNT_EMAIL: serviceEmail,
  MEDICAL_FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: privateKey,
  MEDICAL_FIREBASE_AUTH_BROKER_URL: '',
  MEDICAL_FIREBASE_AUTH_BROKER_SECRET: ''
};
const calls = [];
const responses = [];
const queue = payload => responses.push(payload);
const future = () => new Date(Date.now() + 60_000).toISOString();

const sandbox = {
  Date,
  JSON,
  Object,
  Number,
  String,
  Boolean,
  Array,
  Buffer,
  isFinite,
  PropertiesService: {
    getScriptProperties() {
      return { getProperty(name) { return propertyState[name] || (name === 'AVA_PLATFORM_ADMIN_AUTH_URL' ? endpoint : ''); } };
    }
  },
  UrlFetchApp: {
    fetch(url, init) {
      calls.push({ url, body: JSON.parse(init.payload) });
      const payload = responses.shift() || { success: false };
      return { getResponseCode: () => payload.status || 200, getContentText: () => JSON.stringify(payload.body || payload) };
    }
  },
  Utilities: {
    newBlob(value) { return { getBytes: () => Array.from(Buffer.from(String(value), 'utf8')) }; },
    base64EncodeWebSafe(value) { return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'); },
    computeRsaSha256Signature() { return Array.from(Buffer.from('signature')); },
    computeDigest() { return []; },
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' }
  }
};
vm.createContext(sandbox);
vm.runInContext(gas, sandbox, { filename: 'MedicalProductionFinal.gs' });

queue({ body: { success: true, appId: 'medical', operation: 'medical:official-write', expiresAt: future(), contract: 'ava-legacy-app-grant-v1' } });
const issued = sandbox.issueFirebaseAuthorization_({
  appId: 'medical', mode: 'admin', operation: 'medical:official-write', contract: 'ava-medical-storage-v1', appGrant: 'authorized-grant'
});
assert.equal(issued.success, true);
assert.equal(issued.data.claims.avaAdmin, true);
assert.equal(issued.data.contract, 'ava-medical-storage-v1');
assert.equal(issued.data.provider, 'gas-service-account-custom-token');
assert.equal(Object.keys(issued.data).includes('privateKey'), false);
assert.equal(Object.keys(issued.data).includes('serviceAccount'), false);
assert.equal(issued.data.firebaseCustomToken.split('.').length, 3);
const tokenPayload = JSON.parse(Buffer.from(issued.data.firebaseCustomToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
assert.equal(tokenPayload.uid, 'medical:admin');
assert.equal(tokenPayload.iss, serviceEmail);
assert.equal(tokenPayload.sub, serviceEmail);
assert.match(tokenPayload.aud, /identitytoolkit/);
assert.equal(tokenPayload.claims.avaAdmin, true);
assert.ok(tokenPayload.exp - tokenPayload.iat >= 14 * 60 && tokenPayload.exp - tokenPayload.iat <= 16 * 60);
assert.equal(calls.at(-1).body.action, 'verifyAppGrant');

propertyState.MEDICAL_FIREBASE_SERVICE_ACCOUNT_EMAIL = '';
propertyState.MEDICAL_FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY = '';
queue({ body: { success: true, appId: 'medical', operation: 'medical:official-write', expiresAt: future(), contract: 'ava-legacy-app-grant-v1' } });
assert.throws(() => sandbox.issueFirebaseAuthorization_({ appId: 'medical', mode: 'admin', appGrant: 'authorized-grant' }), error => error.code === 'FIREBASE_AUTH_CONFIGURATION_REQUIRED');

propertyState.MEDICAL_FIREBASE_SERVICE_ACCOUNT_EMAIL = serviceEmail;
propertyState.MEDICAL_FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey;
assert.throws(() => sandbox.issueFirebaseAuthorization_({ appId: 'wrong', mode: 'admin', appGrant: 'authorized-grant' }), error => error.code === 'FIREBASE_AUTH_UNAUTHORIZED');
assert.throws(() => sandbox.issueFirebaseAuthorization_({ appId: 'medical', mode: 'user', appGrant: 'authorized-grant' }), error => error.code === 'FIREBASE_AUTH_UNAUTHORIZED');
assert.throws(() => sandbox.issueFirebaseAuthorization_({ appId: 'medical', mode: 'admin' }), error => error.code === 'FIREBASE_AUTH_UNAUTHORIZED');

console.log('Medical Firebase custom-token issuer, Admin gate, credential boundary, shared namespace and frontend storage-safety regression PASS');
