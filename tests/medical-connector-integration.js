const assert = require('node:assert/strict');

const expiry = () => new Date(Date.now() + 60000).toISOString();

function fakeWindow(href) {
  const historyCalls = [];
  return { location: { href }, history: { replaceState(_state, _title, value) { historyCalls.push(value); } }, historyCalls };
}

async function run() {
  const { createAdminConnector, ADMIN_CONTRACT } = await import('../ava-admin-connector.mjs');
  const ticket = 'medical-ticket';
  const windowObject = fakeWindow(`https://ivancww.github.io/medical/?avaEntry=admin&avaAdminLaunch=${ticket}`);
  const calls = [];
  const connector = createAdminConnector({
    appId: 'medical',
    gasEndpoint: 'https://script.google.com/macros/s/medical/exec',
    locationObject: windowObject.location,
    historyObject: windowObject.history,
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body); calls.push(body);
      if (body.action === 'exchangeAppLaunch') return { ok: true, json: async () => ({ success: true, appId: 'medical', appGrant: 'grant-1', expiresAt: expiry(), contract: ADMIN_CONTRACT }) };
      return { ok: true, json: async () => ({ success: true, data: { version: 'medical-v1' }, version: 'medical-v1' }) };
    }
  });
  await connector.initialize();
  assert.deepEqual(calls[0], { action: 'exchangeAppLaunch', appId: 'medical', launchTicket: ticket });
  assert.equal(windowObject.historyCalls[0], '/medical/?avaEntry=admin');
  assert.equal(connector.isAuthorized(), true);

  const result = await connector.authorizedRequest({ action: 'updateOfficialRecord', operation: 'medical:official-write', body: { dataset: 'pages', recordId: 'R01', changes: { title: 'safe' }, expectedVersion: 'v1' } });
  assert.equal(result.success, true);
  assert.equal(calls[1].action, 'updateOfficialRecord');
  assert.equal(calls[1].appId, 'medical');
  assert.equal(calls[1].operation, 'medical:official-write');
  assert.equal(calls[1].appGrant, 'grant-1');
  assert.equal(connector.getSessionProof(), undefined);
  assert.equal(JSON.stringify(calls[1]).includes('adminSessionProof'), false);

  await assert.rejects(connector.exchangeAppLaunch(), error => error.code === 'ADMIN_LAUNCH_REPLAY');

  const copied = fakeWindow(`https://ivancww.github.io/medical/?avaEntry=admin&avaAdminLaunch=${ticket}`);
  const copiedCalls = [];
  const copiedConnector = createAdminConnector({ appId: 'medical', gasEndpoint: 'https://script.google.com/macros/s/medical/exec', locationObject: copied.location, historyObject: copied.history, fetchImpl: async (_url, init) => { copiedCalls.push(JSON.parse(init.body)); return { ok: false, json: async () => ({ success: false, error: 'Invalid or expired Admin launch' }) }; } });
  await assert.rejects(copiedConnector.initialize(), error => error.code === 'ADMIN_EXCHANGE_HTTP');
  assert.equal(copiedCalls[0].action, 'exchangeAppLaunch');
  console.log('Medical Legacy App Grant exchange, memory-only grant, URL cleanup and replay contract passed');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
