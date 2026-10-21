const assert = require('assert');
const fs = require('fs');

const auth = fs.readFileSync('medical-admin-auth.js', 'utf8');
const connector = fs.readFileSync('ava-admin-connector.mjs', 'utf8');
const gas = fs.readFileSync('gas/MedicalProductionFinal.gs', 'utf8');
const helper = fs.readFileSync('gas/MedicalAdminAuth.gs', 'utf8');
const official = fs.readFileSync('gas/MedicalOfficialData.gs', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const sync = fs.readFileSync('medical-official-sync.js', 'utf8');

assert.match(auth, /const APP_ID = "medical"/);
assert.match(auth, /CONNECTOR_COMPATIBILITY = "ava-admin-session-v1"/);
assert.match(auth, /CONNECTOR_MODULE = "\.\/ava-admin-connector\.mjs\?v=1\.2\.9"/);
assert.match(auth, /exchangeAppLaunch/);
assert.match(auth, /ADMIN_SESSION_EXPIRED/);
assert.match(auth, /AUTHORIZED_REQUEST_TIMEOUT/);
assert.doesNotMatch(auth, /sessionStorage|localStorage|indexedDB/);

assert.match(connector, /ADMIN_CONTRACT = 'ava-admin-session-v1'/);
assert.match(connector, /action: 'exchangeAdminSession'/);
assert.match(connector, /browserProof/);
assert.match(connector, /launchNonce/);
assert.match(connector, /windowObject/);
assert.match(connector, /windowObject\?\.opener/);
assert.match(connector, /ava-admin-session-context/);
assert.match(connector, /adminSessionProof/);
assert.match(connector, /launchConsumed = true/);
assert.match(connector, /clearLaunch\(locationObject, historyObject\)/);
assert.match(connector, /getSessionProof: \(\) => adminSessionProof/);
assert.doesNotMatch(connector, /appGrant/);
assert.doesNotMatch(connector, /sessionStorage|localStorage|indexedDB/);

// Medical GAS must retain the current verification path and the temporary
// legacy fallback for deployed compatibility; the frontend must not use it.
assert.match(gas, /action: "exchangeAppLaunch"/);
assert.match(gas, /action: "exchangeAdminSession"/);
assert.match(gas, /action: "verifyAppGrant"/);
assert.match(gas, /action: "verifyAdminSession"/);
assert.match(gas, /ava-legacy-app-grant-v1/);
assert.match(gas, /ava-admin-session-v1/);
assert.match(gas, /medicalExchangeAdminSession_\(body\.launchTicket, body\.appId, body\.browserProof, body\.launchNonce\)/);
assert.match(gas, /medicalVerifyAdminSession_\(body\.adminSessionProof, "official-write"\)/);
assert.match(gas, /medicalVerifyAppGrant_\(body\.appGrant, operation\)/);
assert.match(gas, /Exactly one Medical Admin credential is required/);
assert.match(gas, /Invalid Medical Official operation/);
assert.match(gas, /LockService\.getScriptLock/);
assert.match(gas, /Official read-after-write verification failed/);
assert.match(helper, /ava-legacy-app-grant-v1/);
assert.match(helper, /ava-admin-session-v1/);
assert.match(helper, /action: "exchangeAppLaunch"/);
assert.match(helper, /action: "exchangeAdminSession"/);
assert.match(helper, /action: "verifyAppGrant"/);
assert.match(helper, /action: "verifyAdminSession"/);
assert.match(official, /Exactly one Medical Admin credential is required/);
assert.match(official, /medicalVerifyAdminSession_\(body\.adminSessionProof, "official-write"\)/);
assert.match(official, /medicalVerifyAppGrant_\(body\.appGrant, operation\)/);
assert.match(sync, /MedicalAdminAuth\.authorizedRequest/);
assert.doesNotMatch(sync, /MedicalAdminAuth\?\.getSessionProof\?\.\(\)/);
assert.match(app, /MedicalAdminAuth\.exchangeAppLaunch\(\)/);
assert.match(app, /APP_VERSION=window\.AVA_MEDICAL_VERSION\|\|'v1\.2\.9'/);
console.log('Medical Admin Session v1 frontend, dual GAS contract and protected Official write checks passed');
