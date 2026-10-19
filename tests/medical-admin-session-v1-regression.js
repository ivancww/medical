const assert = require('node:assert/strict');

function response(payload, ok = true) {
  return { ok, json: async () => payload };
}

async function run() {
  const { createAdminConnector, ADMIN_CONTRACT } = await import('../ava-admin-connector.mjs');
  const ticket = 'one-time-medical-ticket';
  const nonce = 'medical-launch-nonce';
  const expiry = new Date(Date.now() + 60_000).toISOString();
  const context = {
    type: 'ava-admin-session-context',
    appId: 'medical',
    launchTicket: ticket,
    launchNonce: nonce,
    browserProof: 'browser-bound-proof',
    expiresAt: expiry,
    contract: ADMIN_CONTRACT
  };
  const historyCalls = [];
  const windowObject = {
    name: `ava-admin-session-v1:${JSON.stringify(context)}`,
    opener: null,
    location: { href: `https://ivancww.github.io/medical/?avaEntry=admin&avaAdminLaunch=${ticket}&avaAdminLaunchNonce=${nonce}` },
    history: { replaceState(_state, _title, value) { historyCalls.push(value); } },
    addEventListener() {},
    removeEventListener() {}
  };
  const calls = [];
  const connector = createAdminConnector({
    appId: 'medical',
    gasEndpoint: 'https://script.google.com/macros/s/medical/exec',
    locationObject: windowObject.location,
    historyObject: windowObject.history,
    windowObject,
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      if (body.action === 'exchangeAdminSession') return response({ success: true, appId: 'medical', adminSessionProof: 'session-proof', expiresAt: expiry, contract: ADMIN_CONTRACT });
      return response({ success: true, data: { persisted: true, readAfterWrite: true } });
    }
  });

  await connector.initialize();
  assert.equal(windowObject.name, '');
  assert.deepEqual(historyCalls, ['/medical/?avaEntry=admin']);
  assert.equal(connector.getAuthorizationState().compatibility, 'ava-admin-session-v1');
  assert.equal(connector.isAuthorized(), true);

  await connector.authorizedRequest({ action: 'updateOfficialRecord', operation: 'medical:official-write', body: { dataset: 'plans', recordId: 'ELITE', changes: { brochure_url: 'https://example.test/a.pdf' } } });
  await connector.authorizedRequest({ action: 'updateOfficialRecord', operation: 'medical:official-write', body: { dataset: 'plans', recordId: 'ELITE', changes: { brochure_url: 'https://example.test/b.pdf' } } });
  assert.equal(calls.filter(item => item.action === 'exchangeAdminSession').length, 1);
  for (const call of calls.filter(item => item.action === 'updateOfficialRecord')) {
    assert.equal(call.adminSessionProof, 'session-proof');
    assert.equal('appGrant' in call, false);
  }
  assert.equal(connector.getSessionProof(), 'session-proof');

  let currentNow = Date.now();
  const expiring = createAdminConnector({
    appId: 'medical',
    gasEndpoint: 'https://script.google.com/macros/s/medical/exec',
    locationObject: { href: `https://ivancww.github.io/medical/?avaAdminLaunch=${ticket}&avaAdminLaunchNonce=${nonce}` },
    historyObject: { replaceState() {} },
    windowObject: { name: `ava-admin-session-v1:${JSON.stringify({ ...context, expiresAt: new Date(currentNow + 5_000).toISOString() })}`, opener: null },
    now: () => currentNow,
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.action === 'exchangeAdminSession') return response({ success: true, appId: 'medical', adminSessionProof: 'expiring-proof', expiresAt: new Date(currentNow + 5_000).toISOString(), contract: ADMIN_CONTRACT });
      return response({ success: true });
    }
  });
  await expiring.initialize();
  currentNow += 6_000;
  await assert.rejects(() => expiring.authorizedRequest({ action: 'updateOfficialRecord', operation: 'medical:official-write' }), error => error.code === 'ADMIN_SESSION_EXPIRED');
  assert.equal(expiring.getAuthorizationState().status, 'expired');
  console.log('Medical Admin Session v1 one-time exchange, reusable proof, no appGrant and expiry regression PASS');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
