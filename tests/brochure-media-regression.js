const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const product = fs.readFileSync('product-data.js', 'utf8');
const sync = fs.readFileSync('medical-official-sync.js', 'utf8');
const orchestration = fs.readFileSync('medical-firebase.js', 'utf8');
const bootstrap = fs.readFileSync('medical-firebase-bootstrap.js', 'utf8');
const firebase = fs.readFileSync('medical-firebase-module.js', 'utf8');
const boundary = fs.readFileSync('docs/MEDICAL-BROCHURE-MEDIA-BOUNDARY.md', 'utf8');

assert.match(product, /brochure_url/);
assert.match(app, /function brochureButton\(/);
assert.match(app, /aria-label="查看.*產品資料/);
assert.match(sync, /brochure_url/);
assert.match(sync, /data-brochure-upload/);
assert.match(sync, /authorizedRequest\(\{ action: "updateOfficialRecord"/);
assert.match(firebase, /projectId: "medical-and-ci"/);
assert.match(firebase, /storageBucket: "medical-and-ci\.firebasestorage\.app"/);
for (const name of ['initializeApp', 'getStorage', 'ref', 'uploadBytesResumable', 'getMetadata', 'getDownloadURL']) assert.match(firebase, new RegExp(name));
assert.doesNotMatch(firebase, /getAnalytics/);
assert.match(orchestration, /medical\/official\/brochures\//);
assert.match(orchestration, /application\/pdf|image\/jpeg|image\/png|image\/webp/);
assert.match(orchestration, /admin-proof/);
assert.match(orchestration, /FIREBASE_UPLOAD_TIMEOUT_MS = 120000/);
assert.match(bootstrap, /MedicalFirebaseReady/);
assert.match(sync, /record_type.*PLAN/);
assert.match(boundary, /approved shared AVA Cloud Media service/);
assert.doesNotMatch(app, /firebase|initializeApp|uploadBytes|getDownloadURL/i);
assert.doesNotMatch(index, /新增資料草稿|AI 文件分析|手動輸入|aiFile|manualBtn|intakePanel/);
assert.doesNotMatch(app, /CRM_AI_API|aiStudy|fileBase64|fallbackManual|manualForm|intakePanel/);
assert.match(app, /function brochureButton\(plan\)\{[^}]*brochure_url/);
assert.doesNotMatch(app.match(/function planFeaturesBlockV2\([\s\S]*?\nfunction concernReflection/)[0], /FileReader|readAsDataURL|base64|data:/i);

console.log('Medical brochure reference, accessibility and storage-boundary regression PASS');

assert.doesNotMatch(app, />ℹ️<|brochureIcon\(/, 'customer brochure access no longer uses info icons');
assert.match(app, />查看產品資料<\/a>/, 'brochure is a visible product-data button');
assert.match(app, /startJourneyAtPage\('ready','R07'\)/, 'home direct-plan action opens the Ready product page');
