const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');
const product = fs.readFileSync('product-data.js', 'utf8');
const sync = fs.readFileSync('medical-official-sync.js', 'utf8');
const boundary = fs.readFileSync('docs/MEDICAL-BROCHURE-MEDIA-BOUNDARY.md', 'utf8');

assert.match(product, /brochure_url/);
assert.match(app, /function brochureIcon\(/);
assert.match(app, /aria-label="查看.*產品資料/);
assert.match(sync, /brochure_url/);
assert.match(boundary, /approved shared AVA Cloud Media service/);
assert.doesNotMatch(app, /firebase|initializeApp|uploadBytes|getDownloadURL/i);
assert.match(app, /function brochureIcon\(plan\)\{[^}]*brochure_url/);
assert.doesNotMatch(app.match(/function brochureIcon\(plan\)[\s\S]*?\nfunction planFeaturesBlockV2/)[0], /FileReader|readAsDataURL|base64|data:/i);

console.log('Medical brochure reference, accessibility and storage-boundary regression PASS');
