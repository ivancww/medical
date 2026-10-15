const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const ui = fs.readFileSync('medical-official-sync.js', 'utf8');
const auth = fs.readFileSync('medical-admin-auth.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');

const context = {};
context.window = context;
context.globalThis = context;
vm.runInNewContext(ui, context, { filename: 'medical-official-sync.js' });
const sync = context.MedicalOfficialSync;
const expected = [
  ['pages', '頁面設定'], ['options', '選項設定'], ['plans', '產品及保障'],
  ['claimRules', '理賠規則'], ['claimCases', '理賠案例'],
  ['premiumSettings', '保費設定'], ['planComparison', 'P7 保障比較'], ['config', '系統設定']
];

assert.equal(JSON.stringify(sync.DATASETS.map(({ key, label }) => [key, label])), JSON.stringify(expected), 'Medical keeps all eight App-owned Admin domains');
assert.equal(JSON.stringify(sync.READ_ONLY), JSON.stringify(['premiumTables', 'premium_tables']), 'Medical premium tables remain read-only');
assert.equal(sync.FIELD_LABELS.source_name, '資料來源名稱');
assert.match(ui, /role="tablist"/);
assert.match(ui, /role="tab"/);
assert.match(ui, /role="tabpanel"/);
assert.match(ui, /aria-selected/);
assert.match(ui, /aria-hidden/);
assert.match(ui, /data-sync-domain/);
assert.match(ui, /data-record-select/);
assert.match(ui, /selectedRecords/);
assert.match(ui, /ArrowRight/);
assert.match(ui, /ArrowLeft/);
assert.match(ui, /event\.key === "Home"/);
assert.match(ui, /event\.key === "End"/);
assert.match(ui, /hasUnsavedChanges/);
assert.match(ui, /目前記錄有未儲存的變更/);
assert.match(ui, /global\.confirm/);
assert.match(ui, /data-field-type="checkbox"/);
assert.match(ui, /type === "number"/);
assert.match(ui, /<textarea/);
assert.match(ui, /其他欄位已保留/);
assert.match(ui, /MedicalAdminAuth\.authorizedRequest/);
assert.match(ui, /expectedVersion: state\.official\?\.revision \|\| state\.official\?\.version/);
assert.match(ui, /payload|result\.success/);
assert.match(ui, /read-after-write|回讀/);
assert.match(ui, /comparison_id/);
assert.match(ui, /data-comparison-filter/);
assert.match(ui, /data-create-comparison/);
assert.match(ui, /createOfficialRecord/);
assert.match(ui, /建立並發布/);
assert.match(ui, /已核實/);
assert.match(ui, /未核實/);
assert.match(ui, /source_name/);
assert.match(ui, /source_url/);
assert.match(index, /id="adminLabel"/);
assert.match(index, /id="officialSyncPanel"/);
assert.match(index, /<details class="admin-system-info"><summary>系統資料<\/summary>/);
assert.match(index, /返回 AVA/);
assert.doesNotMatch(index, /class="admin-head"/);
assert.doesNotMatch(index, /class="admin-status-bar"/);
assert.match(index, /medical-official-sync\.js\?v=1\.2\.3/);
assert.match(index, /app\.js\?v=1\.2\.3/);
assert.doesNotMatch(auth, /Script Property|session proof|adminSessionProof/);
assert.match(css, /\.admin-tabs\{[^}]*display:grid/);
assert.match(css, /grid-template-columns:repeat\(8,minmax\(0,1fr\)\)/);
assert.match(css, /\.admin-domain\[hidden\],\.sync-record\[hidden\]\{display:none!important\}/);
assert.match(css, /\.admin-system-info summary/);
assert.match(css, /@media\(max-width:760px\)/);
assert.match(css, /@media\(max-width:430px\)/);
assert.match(app, /MedicalOfficialSync\.mount/);
assert.match(app, /APP_VERSION=window\.AVA_MEDICAL_VERSION\|\|'v1\.2\.3'/);

const official = {
  pages: [{ page_id: 'R01', title: 'Concern', enabled: true, unknown: { keep: true } }],
  revision: 'a'.repeat(64)
};
assert.equal(sync.rows(official, 'pages').length, 1);
assert.equal(sync.recordId(official.pages[0], sync.definition('pages')), 'R01');
const mutation = {
  success: true,
  dataset: 'pages',
  recordId: 'R01',
  revision: official.revision,
  data: { ...official, pages: [{ ...official.pages[0], title: 'Updated' }] }
};
assert.equal(sync.validateMutationResult(mutation, { dataset: 'pages', recordId: 'R01', changes: { title: 'Updated' } }).pages[0].unknown.keep, true, 'Unknown fields remain preserved in confirmed snapshots');

console.log('Medical Saving V1.8 Admin workspace regression passed');

