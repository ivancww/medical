const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');
const product = fs.readFileSync('product-data.js', 'utf8');
const sync = fs.readFileSync('medical-official-sync.js', 'utf8');
const firebase = fs.readFileSync('medical-firebase.js', 'utf8');
const boundary = fs.readFileSync('docs/MEDICAL-BROCHURE-MEDIA-BOUNDARY.md', 'utf8');

assert.match(product, /brochure_url/);
assert.match(app, /function brochureIcon\(/);
assert.match(app, /aria-label="查看.*產品資料/);
assert.match(sync, /brochure_url/);
assert.match(sync, /data-brochure-upload/);
assert.match(sync, /authorizedRequest\(\{ action: "updateOfficialRecord"/);
assert.match(firebase, /projectId: "medical-and-ci"/);
assert.match(firebase, /storageBucket: "medical-and-ci\.firebasestorage\.app"/);
for (const name of ['initializeApp', 'getStorage', 'ref', 'uploadBytes', 'getDownloadURL']) assert.match(firebase, new RegExp(name));
assert.doesNotMatch(firebase, /getAnalytics|measurementId/);
assert.match(firebase, /medical\/official\/brochures\//);
assert.match(firebase, /application\/pdf|image\/jpeg|image\/png|image\/webp/);
assert.match(sync, /record_type.*PLAN/);
assert.match(boundary, /approved shared AVA Cloud Media service/);
assert.doesNotMatch(app, /firebase|initializeApp|uploadBytes|getDownloadURL/i);
assert.match(app, /function brochureIcon\(plan\)\{[^}]*brochure_url/);
assert.doesNotMatch(app.match(/function planFeaturesBlockV2\([\s\S]*?\nfunction concernReflection/)[0], /FileReader|readAsDataURL|base64|data:/i);

console.log('Medical brochure reference, accessibility and storage-boundary regression PASS');
