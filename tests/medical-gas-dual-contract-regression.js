const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('gas/MedicalProductionFinal.gs', 'utf8');
assert.equal((source.match(/function doGet\s*\(/g) || []).length, 1);
assert.equal((source.match(/function doPost\s*\(/g) || []).length, 1);
assert.match(source, /body\.action === "exchangeAdminSession" \|\| body\.action === "exchangeAppLaunch"/);
assert.match(source, /Exactly one Medical Admin credential is required/);

const calls = [];
const responses = [];
const endpoint = 'https://platform.example/exec';
const future = () => new Date(Date.now() + 60_000).toISOString();

function queue(payload, status = 200) {
  responses.push({ payload, status });
}

const sandbox = {
  Date,
  JSON,
  Object,
  Number,
  String,
  Boolean,
  Array,
  isFinite,
  PropertiesService: {
    getScriptProperties() {
      return { getProperty() { return endpoint; } };
    }
  },
  UrlFetchApp: {
    fetch(_url, init) {
      const body = JSON.parse(init.payload);
      calls.push(body);
      const next = responses.shift() || { payload: { success: false }, status: 401 };
      return {
        getResponseCode: () => next.status,
        getContentText: () => JSON.stringify(next.payload)
      };
    }
  },
  SpreadsheetApp: {
    getActiveSpreadsheet() {
      throw new Error('OFFICIAL_DATA_MUTATION_REACHED');
    }
  },
  LockService: {
    getScriptLock() {
      return { waitLock() {}, releaseLock() {} };
    }
  },
  Utilities: {
    computeDigest() { return []; },
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' }
  },
  Session: { getScriptTimeZone: () => 'UTC' },
  ContentService: {
    MimeType: { JSON: 'application/json', JAVASCRIPT: 'application/javascript' },
    createTextOutput(value) { return { value, setMimeType() { return this; } }; }
  }
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'MedicalProductionFinal.gs' });

queue({ success: true, appId: 'medical', adminSessionProof: 'old-proof', expiresAt: future(), contract: 'ava-admin-session-v1' });
const oldExchange = sandbox.medicalAdminAuthAction_({
  action: 'exchangeAdminSession', appId: 'medical', launchTicket: 'old-ticket',
  browserProof: 'browser-proof', launchNonce: 'nonce-1'
});
assert.equal(oldExchange.adminSessionProof, 'old-proof');
assert.deepEqual(calls.at(-1), {
  action: 'exchangeAdminSession', appId: 'medical', launchTicket: 'old-ticket',
  browserProof: 'browser-proof', launchNonce: 'nonce-1'
});

queue({ success: true, appId: 'medical', appGrant: 'new-grant', expiresAt: future(), contract: 'ava-legacy-app-grant-v1' });
const newExchange = sandbox.medicalAdminAuthAction_({
  action: 'exchangeAppLaunch', appId: 'medical', launchTicket: 'new-ticket'
});
assert.equal(newExchange.appGrant, 'new-grant');
assert.deepEqual(calls.at(-1), {
  action: 'exchangeAppLaunch', appId: 'medical', launchTicket: 'new-ticket'
});

assert.throws(() => sandbox.medicalAdminAuthAction_({ action: 'exchangeAppLaunch', appId: 'wrong', launchTicket: 'ticket' }), /Invalid Medical Admin launch/);

queue({ success: true, appId: 'medical', adminSessionProof: 'old-proof', contract: 'ava-admin-session-v1', operation: 'official-write' });
sandbox.medicalVerifyAdminSession_('old-proof', 'official-write');
assert.equal(calls.at(-1).action, 'verifyAdminSession');
assert.equal(calls.at(-1).adminSessionProof, 'old-proof');

queue({ success: true, appId: 'medical', operation: 'medical:official-write', expiresAt: future(), contract: 'ava-legacy-app-grant-v1' });
sandbox.medicalVerifyAppGrant_('new-grant', 'medical:official-write');
assert.equal(calls.at(-1).action, 'verifyAppGrant');
assert.equal(calls.at(-1).appGrant, 'new-grant');

queue({ success: true, appId: 'medical', operation: 'medical:official-write', expiresAt: new Date(Date.now() - 60_000).toISOString(), contract: 'ava-legacy-app-grant-v1' });
assert.throws(() => sandbox.medicalVerifyAppGrant_('expired-grant', 'medical:official-write'), /Invalid or expired/);

assert.throws(() => sandbox.medicalOfficialDataAction_({ action: 'updateOfficialRecord', appId: 'medical' }), /Exactly one/);
assert.throws(() => sandbox.medicalOfficialDataAction_({ action: 'updateOfficialRecord', appId: 'medical', adminSessionProof: 'old', appGrant: 'new' }), /Exactly one/);
assert.throws(() => sandbox.medicalOfficialDataAction_({ action: 'updateOfficialRecord', appId: 'medical', appGrant: 'new', operation: 'wrong' }), /Invalid Medical Official operation/);

queue({ success: false, appId: 'medical', contract: 'ava-legacy-app-grant-v1' }, 401);
assert.throws(() => sandbox.medicalOfficialDataAction_({
  action: 'updateOfficialRecord', appId: 'medical', operation: 'medical:official-write',
  appGrant: 'invalid', dataset: 'pages', recordId: 'R01', changes: { title: 'blocked' }, expectedVersion: 'v1'
}), /Invalid or expired/);

queue({ success: false, appId: 'medical', contract: 'ava-admin-session-v1' }, 401);
assert.throws(() => sandbox.medicalOfficialDataAction_({
  action: 'updateOfficialRecord', appId: 'medical', adminSessionProof: 'invalid',
  dataset: 'pages', recordId: 'R01', changes: { title: 'blocked' }, expectedVersion: 'v1'
}), /Invalid or expired/);

console.log('Medical GAS dual-contract routing, exact-one-credential, expiry, rejection and no-pre-auth-mutation checks passed');
