const assert = require('node:assert/strict');

async function run() {
  const { createAdminConnector } = await import('../ava-admin-connector.mjs');
  const location = { href: 'https://ivancww.github.io/medical/?avaEntry=admin' };
  const rejected = createAdminConnector({ appId: 'medical', gasEndpoint: 'https://gas.invalid/medical/exec', locationObject: location, fetchImpl: async () => { throw new Error('no network expected'); } });
  await assert.rejects(rejected.initialize(), error => error.code === 'ADMIN_LAUNCH_REQUIRED');

  const copied = { href: 'https://ivancww.github.io/medical/?avaEntry=admin&avaAdminLaunch=expired-ticket' };
  let sent;
  const copiedConnector = createAdminConnector({
    appId: 'medical',
    gasEndpoint: 'https://gas.invalid/medical/exec',
    locationObject: copied,
    fetchImpl: async (_url, options) => { sent = JSON.parse(options.body); return { ok: true, json: async () => ({ success: false, error: 'Invalid or expired Admin launch' }) }; }
  });
  await assert.rejects(copiedConnector.initialize(), error => error.code === 'ADMIN_UNAUTHORIZED');
  assert.equal(sent.action, 'exchangeAppLaunch');
  assert.equal(Object.keys(sent).includes('browserProof'), false);
  assert.equal(Object.keys(sent).includes('launchNonce'), false);
  console.log('Missing ticket, expired ticket and browser-context independence regressions passed');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
