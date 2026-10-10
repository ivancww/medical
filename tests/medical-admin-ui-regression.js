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
  ['premiumSettings', '保費設定'], ['config', '系統設定']
];

assert.equal(JSON.stringify(sync.DATASETS.map(({ key, label }) => [key, label])), JSON.stringify(expected), 'Admin exposes the seven independent Chinese tabs');
assert.match(ui, /role="tablist"/);
assert.match(ui, /role="tab"/);
assert.match(ui, /aria-selected/);
assert.match(ui, /ArrowRight/);
assert.match(ui, /ArrowLeft/);
assert.match(ui, /event\.key === "Home"/);
assert.match(ui, /hasUnsavedChanges/);
assert.match(ui, /目前分頁有未儲存的變更/);
assert.match(ui, /MedicalAdminAuth\.authorizedRequest/);
assert.match(ui, /expectedVersion: state\.official\?\.revision \|\| state\.official\?\.version/);
assert.match(index, /id="officialSyncPanel"/);
assert.match(index, /id="cloudInfo"/);
assert.match(index, /新增資料草稿/);
assert.match(index, /AI 文件分析/);
assert.match(index, /返回前台/);
assert.match(index, /medical-official-sync\.js\?v=1\.1\.7/);
assert.match(index, /app\.js\?v=1\.1\.7/);
assert.doesNotMatch(index, /Official Cloud|Dataset Count|Official Data 管理|返回 Frontstage/);
assert.doesNotMatch(ui, /Official Cloud|Dataset Count|Claim Rules|Claim Cases|Premium Settings|Configuration|Validate &amp; Save Official|User Override/);
assert.doesNotMatch(auth, /AVA Admin 瀏覽器|AVA Admin 授權|AVA Admin 管理/);
assert.match(css, /\.admin-tabs\{[^}]*overflow-x:auto/);
assert.match(css, /\.admin-tab\{[^}]*min-height:44px/);
assert.match(css, /@media\(max-width:650px\)\{\.admin-status-bar/);
assert.match(app, /MedicalOfficialSync\.mount/);
assert.match(app, /APP_VERSION=window\.AVA_MEDICAL_VERSION\|\|'v1\.1\.8'/);

console.log('Medical Admin tabs, Chinese labels and unsaved-change guard regression passed');
