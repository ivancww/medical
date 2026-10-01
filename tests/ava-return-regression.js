const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
// Execute the actual application functions without cloud/bootstrap side effects.
const definitions = app.slice(0, app.lastIndexOf('\nsetEntry();'));
assert.ok(definitions.length > 0 && definitions.length < app.length);
assert.equal((index.match(/<a data-ava-return /g) || []).length, 2);
assert.match(index, /<header[\s\S]*?<a data-ava-return /);
assert.match(index, /id="adminGate"[\s\S]*?<a data-ava-return /);

function fixture(search) {
  const nodes = new Map();
  const returns = [{ href: '' }, { href: '' }];
  const stored = new Map([
    ['ava.medical.user.overrides.v1', JSON.stringify({ R01: { title: 'My title' }, other: { title: 'Keep' } })],
    ['unrelated-user-data', 'keep']
  ]);
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { dataset: {}, hidden: false, textContent: '', innerHTML: '' });
    return nodes.get(selector);
  };
  const context = vm.createContext({
    URL, URLSearchParams, Intl, console,
    window: { location: { search } },
    document: { querySelector: node, querySelectorAll: selector => selector === '[data-ava-return]' ? returns : [] },
    localStorage: {
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value)
    },
    MedicalAdminAuth: { hasGrant: () => false, clear: () => {}, exchangeAppLaunch: async () => { throw Error('Missing launch'); } }
  });
  vm.runInContext(definitions, context);
  const run = code => vm.runInContext(code, context);
  run("state.official={version:1,pages:['R01','R02','N01','N02'].map((page_id,i)=>({page_id,sort_order:i,title:page_id})),options:[]};setEntry()");
  return { run, node, returns, stored, context };
}

async function main() {
  for (const [search, surface] of [
    ['?avaEntry=frontend', 'frontend'], ['?avaEntry=user', 'user'], ['?avaEntry=admin', 'admin'],
    ['', 'frontend'], ['?avaEntry=unsupported', 'frontend'], ['?avaEntry=ADMIN', 'frontend']
  ]) {
    const f = fixture(search + '&avaAdminLaunch=test-only-ticket&sessionToken=test-only-session&appGrant=test-only-grant&returnUrl=https://example.invalid');
    const expected = 'https://ivancww.github.io/avaplatform/' + (surface === 'frontend' ? '' : '?avaSurface=' + surface);
    const before = JSON.stringify([...f.stored]);
    const check = () => {
      assert.equal(f.run('state.entry'), surface);
      assert.equal(f.run('avaReturnUrl()'), expected);
      for (const link of f.returns) assert.equal(link.href, expected);
      assert.equal(JSON.stringify([...f.stored]), before, 'Return/navigation must not write local data');
    };
    check();
    f.run('renderEntry()');
    if (surface === 'admin') {
      assert.equal(f.node('#admin').hidden, true);
      assert.equal(f.node('#adminGate').hidden, false);
      await f.run('authorizeAdmin()');
      assert.equal(f.run('state.adminAuthorized'), false);
      check();
      // Authorized local Admin surfaces/draft navigation retain the originating context.
      f.context.MedicalAdminAuth.hasGrant = () => true;
      f.run("state.adminAuthorized=true;showAdmin();manualForm();renderHome()");
      check();
    } else {
      assert.equal(f.run('state.mode'), surface === 'user' ? 'edit' : 'use');
    }
    // Both customer journeys render within this document, without changing entry.
    for (const journey of ['ready', 'notready']) {
      f.run(`startJourney('${journey}');state.index=1;renderPage();setMode('preview');setMode('presentation');renderHome()`);
      check();
    }
    // Simulate reload with the retained entry query, including after ticket removal.
    const reopened = fixture(surface === 'frontend' ? '?avaEntry=frontend' : '?avaEntry=' + surface);
    assert.equal(reopened.run('avaReturnUrl()'), expected);
  }
  const user = fixture('?avaEntry=user');
  user.run("startJourney('ready');state.draftText={R01:{subtitle:'Local edit'}};setMode('preview');saveOverrides()");
  const overrides = JSON.parse(user.stored.get('ava.medical.user.overrides.v1'));
  assert.equal(overrides.R01.title, 'My title');
  assert.equal(overrides.R01.subtitle, 'Local edit');
  assert.equal(overrides.other.title, 'Keep');
  assert.equal(user.run('state.official.pages[0].title'), 'R01');
  assert.equal(user.returns[0].href, 'https://ivancww.github.io/avaplatform/?avaSurface=user');

  // Exercise existing auth unchanged: missing launch and foreign/rejected grants fail closed.
  const auth = vm.createContext({ URL, URLSearchParams });
  vm.runInContext(fs.readFileSync('medical-admin-auth.js', 'utf8'), auth);
  let calls = 0;
  await assert.rejects(auth.MedicalAdminAuth.exchangeAppLaunch(async () => { calls++; }, { search: '?avaEntry=admin' }));
  assert.equal(calls, 0);
  for (const payload of [
    { success: false }, { success: true, appId: 'another-app', appGrant: 'test-only' },
    { success: true, appId: 'medical' }
  ]) {
    await assert.rejects(auth.MedicalAdminAuth.exchangeAppLaunch(async () => ({ ok: true, json: async () => payload }), { search: '?avaAdminLaunch=test-only' }));
    assert.equal(auth.MedicalAdminAuth.hasGrant(), false);
  }
  let cleanUrl = '';
  const authenticated = vm.createContext({ URL, URLSearchParams, history: { replaceState: (_, __, url) => { cleanUrl = url; } } });
  vm.runInContext(fs.readFileSync('medical-admin-auth.js', 'utf8'), authenticated);
  await authenticated.MedicalAdminAuth.exchangeAppLaunch(async (_, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.action, 'exchangeAppLaunch');
    assert.equal(request.appId, 'medical');
    return { ok: true, json: async () => ({ success: true, appId: 'medical', appGrant: 'test-only-grant' }) };
  }, { search: '?avaEntry=admin&avaAdminLaunch=test-only', href: 'https://ivancww.github.io/medical/?avaEntry=admin&avaAdminLaunch=test-only' });
  assert.equal(cleanUrl, '/medical/?avaEntry=admin');
  assert.equal(authenticated.MedicalAdminAuth.hasGrant(), true);
  authenticated.MedicalAdminAuth.clear();
  assert.equal(authenticated.MedicalAdminAuth.hasGrant(), false);
  assert.doesNotMatch(app.slice(app.indexOf('// Return context'), app.indexOf('function setStatus')), /referrer|localStorage|sessionStorage|indexedDB|avaAdminLaunch/);
  console.log('AVA Return contract, internal journeys, local overrides and fail-closed auth: PASS');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
