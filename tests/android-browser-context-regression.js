const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const future = new Date(Date.now() + 60000).toISOString();
const context = {
  type: 'ava-admin-session-context',
  appId: 'medical',
  launchTicket: 'ticket-1',
  launchNonce: 'nonce-1',
  browserProof: 'proof-1',
  expiresAt: future,
  contract: 'ava-admin-session-v1'
};
const calls = [];
const location = { search: '?avaEntry=admin&avaAdminLaunch=ticket-1&avaAdminLaunchNonce=nonce-1', href: 'https://ivancww.github.io/medical/?avaEntry=admin&avaAdminLaunch=ticket-1&avaAdminLaunchNonce=nonce-1', pathname: '/medical/', hash: '' };
const browserWindow = {
  name: 'ava-admin-session-v1:' + JSON.stringify(context),
  opener: null,
  location,
  history: { replaceState() {} },
  document: { title: 'Medical' },
  fetch: async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ success: true, appId: 'medical', adminSessionProof: 'session-proof', expiresAt: future, contract: 'ava-admin-session-v1' }) };
  },
  setTimeout,
  clearTimeout
};
vm.runInNewContext(fs.readFileSync('medical-admin-auth.js', 'utf8'), { window: browserWindow, URL, URLSearchParams, Date, Error, Promise, setTimeout, clearTimeout });

(async () => {
  await browserWindow.MedicalAdminAuth.exchangeAdminSession();
  assert.equal(browserWindow.name, '', 'context proof is cleared before server exchange');
  assert.deepEqual(calls[0], { action: 'exchangeAdminSession', launchTicket: 'ticket-1', launchNonce: 'nonce-1', browserProof: 'proof-1', appId: 'medical' });
  assert.equal(browserWindow.MedicalAdminAuth.hasSession(), true);

  const copied = { ...browserWindow, name: '', opener: null, fetch: async () => { throw new Error('copied URL must not call GAS'); } };
  vm.runInNewContext(fs.readFileSync('medical-admin-auth.js', 'utf8'), { window: copied, URL, URLSearchParams, Date, Error, Promise, setTimeout, clearTimeout });
  await assert.rejects(() => copied.MedicalAdminAuth.exchangeAdminSession(), /安全視窗開啟/);
  console.log('Medical Android browsing-context binding and copied-URL rejection passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
