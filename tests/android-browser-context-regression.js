const assert = require('assert/strict');

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
  const ticket = 'ticket-1';
  const nonce = 'nonce-1';
  const location = { href: `https://ivancww.github.io/medical/?avaEntry=admin&avaAdminLaunch=${ticket}&avaAdminLaunchNonce=${nonce}` };
  const context = { type: 'ava-admin-session-context', appId: 'medical', launchTicket: ticket, launchNonce: nonce, browserProof: 'proof-1', expiresAt: expiry(), contract: ADMIN_CONTRACT };
  const browserWindow = fakeWindow(location.href, { name: BROWSER_CONTEXT_PREFIX + JSON.stringify(context) });
  const calls = [];
  const connector = createAdminConnector({
    appId: 'medical',
    gasEndpoint: 'https://gas.invalid/medical/exec',
    platformOrigin: ORIGIN,
    windowObject: browserWindow,
    locationObject: browserWindow.location,
    historyObject: browserWindow.history,
    fetchImpl: async (_url, options) => {
      calls.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ success: true, appId: 'medical', adminSessionProof: 'session-proof', expiresAt: expiry(), contract: ADMIN_CONTRACT }) };
    }
  });
  await connector.initialize();
  assert.equal(browserWindow.name, '', 'context proof is cleared before server exchange');
  assert.deepEqual(calls[0], { action: 'exchangeAdminSession', appId: 'medical', launchTicket: ticket, launchNonce: nonce, browserProof: 'proof-1' });
  assert.equal(connector.isAuthorized(), true);

  const copiedLocation = { href: location.href };
  const copied = fakeWindow(copiedLocation.href);
  let copiedCalls = 0;
  const copiedConnector = createAdminConnector({ appId: 'medical', gasEndpoint: 'https://gas.invalid/medical/exec', windowObject: copied, locationObject: copied.location, historyObject: copied.history, fetchImpl: async () => { copiedCalls += 1; throw new Error('copied URL must not call GAS'); } });
  await assert.rejects(copiedConnector.initialize(), error => error.code === 'ADMIN_BROWSER_BINDING_REQUIRED');
  assert.equal(copiedCalls, 0);
  console.log('Medical Android browsing-context binding and copied-URL rejection passed');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
