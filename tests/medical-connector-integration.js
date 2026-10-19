const assert = require('node:assert/strict');

const expiry = () => new Date(Date.now() + 60000).toISOString();

function fakeWindow(href) {
  const historyCalls = [];
  return { location: { href }, name: '', opener: null, addEventListener() {}, removeEventListener() {}, history: { replaceState(_state, _title, value) { historyCalls.push(value); } }, historyCalls };
}

async function run() {
  const { createAdminConnector, ADMIN_CONTRACT } = await import('../ava-admin-connector.mjs');
  const ticket = 'medical-ticket';
  const nonce = 'medical-nonce';
  const windowObject = fakeWindow(`https://ivancww.github.io/medical/?avaEntry=admin&avaAdminLaunch=${ticket}&avaAdminLaunchNonce=${nonce}`);
  windowObject.name = `ava-admin-session-v1:${JSON.stringify({ type: 'ava-admin-session-context', appId: 'medical', launchTicket: ticket, launchNonce: nonce, browserProof: 'browser-proof-1', expiresAt: expiry(), contract: ADMIN_CONTRACT })}`;
  const calls = [];
  const connector = createAdminConnector({
    appId: 'medical',
    gasEndpoint: 'https://script.google.com/macros/s/medical/exec',
    locationObject: windowObject.location,
    historyObject: windowObject.history,
    windowObject,
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body); calls.push(body);
      if (body.action === 'exchangeAdminSession') return { ok: true, json: async () => ({ success: true, appId: 'medical', adminSessionProof: 'session-1', expiresAt: expiry(), contract: ADMIN_CONTRACT }) };
      return { ok: true, json: async () => ({ success: true, data: { version: 'medical-v1' }, version: 'medical-v1' }) };
    }
  });
  await connector.initialize();
  assert.deepEqual(calls[0], { action: 'exchangeAdminSession', appId: 'medical', launchTicket: ticket, launchNonce: nonce, browserProof: 'browser-proof-1' });
  assert.equal(windowObject.historyCalls[0], '/medical/?avaEntry=admin');
  assert.equal(windowObject.name, '');
  assert.equal(connector.isAuthorized(), true);

  const result = await connector.authorizedRequest({ action: 'updateOfficialRecord', operation: 'medical:official-write', body: { dataset: 'pages', recordId: 'R01', changes: { title: 'safe' }, expectedVersion: 'v1' } });
  assert.equal(result.success, true);
  assert.equal(calls[1].action, 'updateOfficialRecord');
  assert.equal(calls[1].appId, 'medical');
  assert.equal(calls[1].operation, 'medical:official-write');
  assert.equal(calls[1].adminSessionProof, 'session-1');
  assert.equal(connector.getSessionProof(), 'session-1');
  assert.equal(JSON.stringify(calls[1]).includes('appGrant'), false);

  await assert.rejects(connector.exchangeAppLaunch(), error => error.code === 'ADMIN_LAUNCH_REPLAY');

  const copied = fakeWindow(`https://ivancww.github.io/medical/?avaEntry=admin&avaAdminLaunch=${ticket}&avaAdminLaunchNonce=${nonce}`);
  const copiedCalls = [];
  const copiedConnector = createAdminConnector({ appId: 'medical', gasEndpoint: 'https://script.google.com/macros/s/medical/exec', locationObject: copied.location, historyObject: copied.history, fetchImpl: async (_url, init) => { copiedCalls.push(JSON.parse(init.body)); return { ok: false, json: async () => ({ success: false, error: 'Invalid or expired Admin launch' }) }; } });
  await assert.rejects(copiedConnector.initialize(), error => error.code === 'ADMIN_BROWSER_BINDING_REQUIRED');
  assert.equal(copiedCalls.length, 0);
  console.log('Medical Admin Session v1 exchange, browser binding, memory-only proof and replay contract passed');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
