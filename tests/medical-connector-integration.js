const assert = require('node:assert/strict');

const ORIGIN = 'https://ivancww.github.io';
const expiry = () => new Date(Date.now() + 60000).toISOString();

function fakeWindow(href, { name = '', opener = null } = {}) {
  const listeners = new Set();
  return {
    location: { href },
    history: { replaceState() {} },
    name,
    opener,
    setTimeout,
    clearTimeout,
    addEventListener(_type, listener) { listeners.add(listener); },
    removeEventListener(_type, listener) { listeners.delete(listener); },
    emit(event) { for (const listener of [...listeners]) listener(event); }
  };
}

async function run() {
  const { createAdminConnector, ADMIN_CONTRACT, BROWSER_CONTEXT_PREFIX } = await import('../ava-admin-connector.mjs');
  const ticket = 'medical-ticket';
  const nonce = 'medical-nonce';
  const href = `https://ivancww.github.io/medical/?avaEntry=admin&avaAdminLaunch=${ticket}&avaAdminLaunchNonce=${nonce}`;
  const windowObject = fakeWindow(href, { name: BROWSER_CONTEXT_PREFIX + JSON.stringify({ type: 'ava-admin-session-context', appId: 'medical', launchTicket: ticket, launchNonce: nonce, browserProof: 'browser-proof', expiresAt: expiry(), contract: ADMIN_CONTRACT }) });
  const calls = [];
  const connector = createAdminConnector({
    appId: 'medical',
    gasEndpoint: 'https://script.google.com/macros/s/medical/exec',
    platformOrigin: ORIGIN,
    windowObject,
    locationObject: windowObject.location,
    historyObject: windowObject.history,
    fetchImpl: async (_url, init) => {
      calls.push(JSON.parse(init.body));
      const body = JSON.parse(init.body);
      if (body.action === 'exchangeAdminSession') return { ok: true, json: async () => ({ success: true, appId: 'medical', adminSessionProof: 'session-proof', expiresAt: expiry(), contract: ADMIN_CONTRACT }) };
      return { ok: true, json: async () => ({ success: true, dataset: body.dataset, recordId: body.recordId, version: 'medical-v1', data: { version: 'medical-v1' } }) };
    }
  });
  await connector.initialize();
  assert.equal(calls[0].action, 'exchangeAdminSession');
  assert.equal(calls[0].appId, 'medical');
  assert.equal(calls[0].launchTicket, ticket);
  assert.equal(calls[0].launchNonce, nonce);
  assert.equal(calls[0].browserProof, 'browser-proof');
  assert.equal(connector.isAuthorized(), true);

  const result = await connector.authorizedRequest({ action: 'updateOfficialRecord', operation: 'medical:official-write', body: { dataset: 'pages', recordId: 'R01', changes: { title: 'safe' }, expectedVersion: 'v1' } });
  assert.equal(result.success, true);
  assert.equal(calls[1].action, 'updateOfficialRecord');
  assert.equal(calls[1].appId, 'medical');
  assert.equal(calls[1].operation, 'medical:official-write');
  assert.equal(calls[1].adminSessionProof, 'session-proof');
  assert.equal(connector.getSessionProof(), undefined);

  const copied = fakeWindow(href);
  let copiedFetches = 0;
  const copiedConnector = createAdminConnector({ appId: 'medical', gasEndpoint: 'https://script.google.com/macros/s/medical/exec', windowObject: copied, locationObject: copied.location, historyObject: copied.history, fetchImpl: async () => { copiedFetches += 1; throw new Error('copied URL'); } });
  await assert.rejects(copiedConnector.initialize(), error => error.code === 'ADMIN_BROWSER_BINDING_REQUIRED');
  assert.equal(copiedFetches, 0);
  console.log('Medical Connector App ID, exchange, authorized write adapter and copied URL contract passed');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
