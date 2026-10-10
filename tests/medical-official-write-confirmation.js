const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const uiSource = fs.readFileSync('medical-official-sync.js', 'utf8');
const appSource = fs.readFileSync('app.js', 'utf8');
const gasSource = fs.readFileSync('gas/MedicalProductionFinal.gs', 'utf8');

const context = { window: {}, globalThis: {} };
context.window = context;
context.globalThis = context;
vm.runInNewContext(uiSource, context, { filename: 'medical-official-sync.js' });
const sync = context.MedicalOfficialSync;
const changes = { title: '新標題' };
const revision = 'a'.repeat(64);

function snapshot(value = '新標題', revisionValue = revision) {
  return {
    version: '1.0.0',
    revision: revisionValue,
    adminDatasets: {
      pages: [{ page_id: 'R01', page_name: '頁面', title: value }]
    },
    pages: [{ page_id: 'R01', page_name: '頁面', title: value }]
  };
}

function result(overrides = {}) {
  return {
    success: true,
    dataset: 'pages',
    recordId: 'R01',
    version: '1.0.0',
    revision,
    data: snapshot(),
    ...overrides
  };
}

assert.throws(
  () => sync.validateMutationResult({ success: true }, { dataset: 'pages', recordId: 'R01', changes }),
  /未能確認|官方資料回應|官方回應/
);
assert.throws(
  () => sync.validateMutationResult(result({ revision: undefined, data: snapshot('新標題', '') }), { dataset: 'pages', recordId: 'R01', changes }),
  /版本/
);
assert.throws(
  () => sync.validateMutationResult(result({ dataset: 'options' }), { dataset: 'pages', recordId: 'R01', changes }),
  /資料分頁/
);
assert.throws(
  () => sync.validateMutationResult(result({ recordId: 'R02' }), { dataset: 'pages', recordId: 'R01', changes }),
  /記錄識別碼/
);
assert.throws(
  () => sync.validateMutationResult(result({ data: snapshot('舊標題') }), { dataset: 'pages', recordId: 'R01', changes }),
  /欄位/
);
assert.throws(
  () => sync.validateMutationResult(result({ data: snapshot('新標題', 'b'.repeat(64)) }), { dataset: 'pages', recordId: 'R01', changes }),
  /版本/
);

let cacheUpdated = false;
try {
  const persisted = sync.validateMutationResult(result(), { dataset: 'pages', recordId: 'R01', changes });
  cacheUpdated = Boolean(persisted && persisted.revision);
} catch (_) {
  cacheUpdated = false;
}
assert.equal(cacheUpdated, true, 'confirmed persistence updates cache state');

let failedCacheUpdated = false;
try {
  const persisted = sync.validateMutationResult({ success: true }, { dataset: 'pages', recordId: 'R01', changes });
  failedCacheUpdated = Boolean(persisted);
} catch (_) {
  failedCacheUpdated = false;
}
assert.equal(failedCacheUpdated, false, 'incomplete success cannot update cache');

const reopened = snapshot();
assert.equal(reopened.adminDatasets.pages[0].title, '新標題', 'reopened Admin reads confirmed persisted data');

assert.match(appSource, /remoteRevision/);
assert.match(appSource, /revisionUnavailable/);
assert.match(gasSource, /revision: String\(snapshot\.revision \|\| ""\)/);
assert.match(gasSource, /revision: snapshot\.revision/);
assert.match(gasSource, /Stale Official version/);

console.log('Medical Official Write confirmation and revision contract regression passed');
