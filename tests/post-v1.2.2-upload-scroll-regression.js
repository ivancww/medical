const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const firebase = fs.readFileSync('medical-firebase.js', 'utf8');
const firebaseBootstrap = fs.readFileSync('medical-firebase-bootstrap.js', 'utf8');
const firebaseProvider = fs.readFileSync('medical-firebase-module.js', 'utf8');
const sync = fs.readFileSync('medical-official-sync.js', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');

assert.match(firebase, /uploadBytesResumable/);
assert.doesNotMatch(firebase, /\buploadBytes\s*\(/);
assert.match(firebase, /uploadTask\.on\("state_changed"/);
assert.match(firebase, /bytesTransferred/);
assert.match(firebase, /totalBytes/);
assert.match(firebase, /percentage/);
assert.match(firebase, /uploadTask\.cancel\(\)/);
assert.match(firebase, /FIREBASE_UPLOAD_TIMEOUT_MS = 120000/);
assert.doesNotMatch(firebase, /stageError\("admin-proof"/);
assert.match(firebase, /stageError\("upload"/);
assert.match(firebase, /stageError\("object-verification"/);
assert.match(firebase, /stageError\("download-url"/);
assert.match(firebaseProvider, /getDownloadURL/);
assert.match(firebaseProvider, /getMetadata/);
assert.match(firebase, /onProgress/);
assert.match(firebase, /onStage/);
assert.match(firebaseBootstrap, /MedicalFirebaseReady = ready/);
assert.match(firebaseBootstrap, /medical-firebase-module\.js\?v=\" \+ RELEASE/);
assert.match(firebaseBootstrap, /module-bootstrap/);
assert.doesNotMatch(`${firebase}\n${firebaseBootstrap}\n${firebaseProvider}`, /localStorage|sessionStorage|indexedDB|FileReader|readAsDataURL|base64/i);

assert.match(sync, /正在上載至 Firebase… .*percentage/);
assert.match(sync, /Firebase 上載完成，正在取得產品資料連結/);
assert.match(sync, /正在取得 Firebase 產品資料連結/);
assert.match(sync, /產品資料已上載，正在發布 Official URL/);
assert.match(sync, /產品資料已成功上載及發布/);
assert.match(sync, /Firebase 上載逾時，請檢查網絡後再試/);
assert.match(sync, /storage\/unauthorized/);
assert.match(sync, /Firebase Storage 權限不足/);
assert.match(sync, /產品資料上載已取消/);
assert.match(sync, /Firebase 上載逾時或重試失敗，請稍後再試/);
assert.match(sync, /storage\/unknown/);
assert.match(sync, /Firebase Storage 發生未明錯誤/);
assert.match(sync, /official-verification/);
assert.match(sync, /官方資料驗證失敗/);
assert.match(sync, /pending\.uploading = true/);
assert.match(sync, /pending\.uploading = false/);
assert.match(sync, /resetUploadButton\(button\)/);
assert.match(sync, /authorizedRequest\(\{ action: "updateOfficialRecord"/);
assert.match(sync, /pendingBrochureUploads\.delete\(recordIdValue\)/);
assert.doesNotMatch(sync.slice(sync.indexOf('const pendingBrochureUploads'), sync.indexOf('function mount')), /localStorage|sessionStorage|indexedDB|FileReader|readAsDataURL|base64/i);

assert.match(app, /function scrollJourneyPageToTop\(\)/);
assert.match(app, /window\.scrollTo\(\{top,behavior:'auto'\}\)/);
assert.match(app, /function navigateJourney\(delta\)/);
assert.match(app, /renderPage\(\{scrollToTop:true\}\)/);
assert.match(app, /pageChanged=state\.renderedPageId!==id/);
assert.match(app, /if\(scrollToTop&&pageChanged\)scrollJourneyPageToTop\(\)/);
assert.match(app, /state\.index\+delta/);

const nodes = new Map();
const scrollCalls = [];
const fakeNode = (extra = {}) => ({ hidden: false, textContent: '', innerHTML: '', dataset: {}, className: '', setAttribute() {}, addEventListener() {}, ...extra });
nodes.set('#pageCard', fakeNode({ getBoundingClientRect: () => ({ top: 800 }) }));
nodes.set('#progressText', fakeNode());
nodes.set('#nextBtn', fakeNode());
nodes.set('.app-header', fakeNode({ getBoundingClientRect: () => ({ height: 60 }) }));
nodes.set('.journey-top', fakeNode({ getBoundingClientRect: () => ({ height: 40 }) }));
const memory = new Map();
const context = {
  scrollCalls,
  window: {
    AVA_MEDICAL_VERSION: 'v1.2.10',
    AVA_MEDICAL_BUILD: 'test',
    scrollY: 100,
    requestAnimationFrame: callback => callback(),
    scrollTo: options => scrollCalls.push(options)
  },
  document: {
    querySelector: selector => nodes.get(selector) || fakeNode(),
    querySelectorAll: () => []
  },
  localStorage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) },
  sessionStorage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) },
  MedicalAdminAuth: { hasSession: () => false },
  URLSearchParams,
  console
};
context.window.document = context.document;
vm.runInNewContext(app.slice(0, app.indexOf('setEntry();')), context, { filename: 'medical-page-navigation.js' });

const result = vm.runInNewContext(`
  state.entry = 'frontend';
  state.official = { pages: [
    { page_id: 'R01', title: '一', enabled: true },
    { page_id: 'R02', title: '二', enabled: true },
    { page_id: 'R03', title: '三', enabled: true },
    { page_id: 'R04', title: '四', enabled: true },
    { page_id: 'N01', title: '五', enabled: true },
    { page_id: 'N02', title: '六', enabled: true }
  ], options: [] };
  state.journey = 'ready';
  state.index = 0;
  renderPage({scrollToTop:true});
  const afterInitial = scrollCalls.length;
  state.claimCost = 123456;
  renderPage();
  const afterSamePage = scrollCalls.length;
  navigateJourney(1);
  const afterNext = scrollCalls.length;
  navigateJourney(1);
  const afterDirectAdvance = scrollCalls.length;
  navigateJourney(-1);
  const afterBack = scrollCalls.length;
  const readyCurrent = state.renderedPageId;
  state.journey = 'notready';
  state.index = 1;
  state.renderedPageId = null;
  renderPage({scrollToTop:true});
  const notReadyBeforeBack = scrollCalls.length;
  goBack();
  const notReadyAfterBack = scrollCalls.length;
  ({afterInitial, afterSamePage, afterNext, afterDirectAdvance, afterBack, current: readyCurrent, notReadyBeforeBack, notReadyAfterBack, notReadyIndex: state.index});
`, context);

assert.equal(result.afterInitial, 1, 'initial journey page transition scrolls once');
assert.equal(result.afterSamePage, 1, 'same-page rerender does not scroll');
assert.equal(result.afterNext, 2, 'next logical page scrolls to top');
assert.equal(result.afterDirectAdvance, 3, 'direct advance scrolls to top');
assert.equal(result.afterBack, 4, 'back navigation scrolls to top');
assert.equal(result.current, 'R02');
assert.equal(result.notReadyAfterBack, result.notReadyBeforeBack + 1, 'Not Ready back navigation scrolls to top');
assert.equal(result.notReadyIndex, 0, 'Not Ready back navigation returns to the previous logical page');
assert.equal(scrollCalls.at(-1).top, 788, 'scroll offset accounts for sticky Medical header and journey controls');

console.log('Post-v1.2.10 observable brochure upload and journey top-reset regression PASS');
