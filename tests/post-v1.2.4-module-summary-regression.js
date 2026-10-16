const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const orchestration = fs.readFileSync('medical-firebase.js', 'utf8');
const bootstrap = fs.readFileSync('medical-firebase-bootstrap.js', 'utf8');
const firebase = fs.readFileSync('medical-firebase-module.js', 'utf8');
const sync = fs.readFileSync('medical-official-sync.js', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

assert.match(bootstrap, /MedicalFirebaseReady = ready/);
assert.match(bootstrap, /import\(MODULE_URL\)/);
assert.match(bootstrap, /module-bootstrap/);
assert.match(bootstrap, /module-import/);
assert.match(bootstrap, /sdk-import/);
assert.match(bootstrap, /clearTimeout\(timer\)/);
assert.match(bootstrap, /medical-firebase-module\.js\?v=\" \+ RELEASE/);
assert.match(orchestration, /MedicalFirebaseMedia/);
assert.match(orchestration, /admin-proof/);
assert.match(orchestration, /getMetadata/);
assert.match(firebase, /uploadBytesResumable/);
assert.match(firebase, /getMetadata/);
assert.match(firebase, /getDownloadURL/);
assert.doesNotMatch(`${orchestration}\n${bootstrap}\n${firebase}`, /firebase-auth\.js|getAuth|signInWithCustomToken|inMemoryPersistence|setPersistence|issueFirebaseAuthorization/);
assert.doesNotMatch(firebase, /MedicalFirebaseReady/);
assert.doesNotMatch(`${orchestration}\n${bootstrap}\n${firebase}`, /localStorage|sessionStorage|indexedDB/);
assert.match(sync, /module-bootstrap/);
assert.match(sync, /sdk-import/);
assert.match(sync, /admin-proof/);
assert.match(sync, /object-verification/);
assert.match(sync, /Firebase SDK 載入失敗/);
assert.match(index, /medical-firebase-bootstrap\.js\?v=1\.2\.5/);
assert.match(index, /medical-firebase\.js\?v=1\.2\.5/);
assert.match(sw, /medical-firebase-bootstrap\.js\?v=1\.2\.5/);
assert.match(sw, /medical-firebase\.js\?v=1\.2\.5/);
assert.match(sw, /medical-firebase-module\.js\?v=1\.2\.5/);
assert.match(fs.readFileSync('firebase/storage.rules', 'utf8'), /match \/medical\/official\/brochures\/\{allPaths=\*\*\}/);
assert.doesNotMatch(index, /1\.2\.3/);
assert.doesNotMatch(sw, /1\.2\.3/);

const nodes = new Map();
const fakeNode = () => ({ hidden: false, textContent: '', innerHTML: '', dataset: {}, className: '', setAttribute() {}, addEventListener() {} });
const context = {
  window: {
    AVA_MEDICAL_VERSION: 'v1.2.5',
    AVA_MEDICAL_BUILD: 'test',
    AVAMedicalProductData: {
      getProductData: () => [
        { id: 'ELITE', name: '尊耀醫療計劃', rule: {}, deductibles: [16000] },
        { id: 'WISE', name: '睿選醫療計劃', rule: {}, deductibles: [8800] },
        { id: 'FLEXI', name: '靈活醫療計劃', rule: {}, deductibles: [] }
      ],
      deductibleOptions: (_official, id) => id === 'ELITE' ? [16000] : id === 'WISE' ? [8800] : [],
      lookupPremium: () => 10000,
      calculatePremium: () => ({ charged: 10000, period: 'year' })
    },
    location: { search: '' }
  },
  document: { querySelector: selector => nodes.get(selector) || fakeNode(), querySelectorAll: () => [] },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  URLSearchParams,
  Intl,
  console
};
context.window.document = context.document;
vm.runInNewContext(app.slice(0, app.indexOf('setEntry();')), context, { filename: 'medical-summary.js' });

function summary(plan, conditions = { hospital: true, networkDoctor: true, preapproval: true }) {
  return vm.runInNewContext(`
    state.official = { options: [], plans: [], planComparison: [] };
    state.selectedPlan = ${JSON.stringify(plan)};
    state.eliteDeductible = 16000;
    state.wiseDeductible = 8800;
    state.wiseConditions = ${JSON.stringify(conditions)};
    readySummaryBlock();
  `, context);
}

let html = summary('ELITE');
assert.match(html, /已選計劃/);
assert.match(html, /尊耀醫療計劃/);
assert.match(html, /尊耀 HK\$16,000/);
assert.doesNotMatch(html, /睿選 HK\$8,800|睿選狀態|指定醫院/);

html = summary('WISE');
assert.match(html, /睿選 HK\$8,800/);
assert.match(html, /符合條件（享半私家）/);
assert.match(html, /✓ 4間指定醫院/);
assert.match(html, /✓ 經「睿選網絡醫生」掛單/);
assert.match(html, /✓ 完成「費用預先批核」/);
assert.doesNotMatch(html, /尊耀 HK\$16,000/);

html = summary('WISE', { hospital: true, networkDoctor: false, preapproval: true });
assert.match(html, /條件未符（降為普通房級別）/);
assert.match(html, /✕ 經「睿選網絡醫生」掛單/);
assert.match(html, /✓ 4間指定醫院/);
assert.match(html, /✓ 完成「費用預先批核」/);

html = summary('FLEXI');
assert.match(html, /自付額<\/span><strong>不適用/);
assert.doesNotMatch(html, /尊耀 HK\$16,000|睿選 HK\$8,800|睿選狀態|指定醫院/);

console.log('Post-v1.2.5 Firebase module readiness and selected-plan summary regression PASS');
