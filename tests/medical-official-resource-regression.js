const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const media = fs.readFileSync('medical-firebase.js', 'utf8');
const sync = fs.readFileSync('medical-official-sync.js', 'utf8');
const product = fs.readFileSync('product-data.js', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const rules = fs.readFileSync('firebase/storage.rules', 'utf8');
const productionGas = fs.readFileSync('gas/MedicalProductionFinal.gs', 'utf8');
const adapterGas = fs.readFileSync('gas/MedicalOfficialData.gs', 'utf8');

assert.match(media, /uploadOfficialMedia/);
assert.match(media, /officialResourcePath/);
assert.match(media, /medical\/official\//);
assert.match(media, /product\//);
assert.match(media, /claims\//);
assert.match(media, /uploadBytesResumable/);
assert.match(media, /getMetadata/);
assert.match(media, /getDownloadURL/);
assert.match(media, /FIREBASE_UPLOAD_TIMEOUT_MS = 120000/);
assert.match(media, /ADMIN_PROOF_REQUIRED|admin-proof/);
assert.doesNotMatch(media, /firebase-auth|getAuth|signInWithCustomToken|privateKey|service-account/i);

const context = { window: {}, Date, setTimeout, clearTimeout };
vm.runInNewContext(media, context);
const M = context.window.MedicalFirebaseMedia;
assert.equal(M.officialResourcePath({ planId: 'ELITE', category: 'brochure', contentId: 'x', contentType: 'brochure', filename: 'elite.pdf', timestamp: 1760000000000 }), 'medical/official/ELITE/product/brochure/1760000000000_elite.pdf');
assert.equal(M.officialResourcePath({ planId: 'WISE', category: 'features', contentId: 'x', contentType: 'product_feature', filename: 'features.pdf', timestamp: 1760000000000 }), 'medical/official/WISE/product/features/1760000000000_features.pdf');
assert.equal(M.officialResourcePath({ planId: 'FLEXI', category: 'claims', contentId: 'CASE002', contentType: 'claim_case', filename: '../case image.jpg', timestamp: 1760000000000 }), 'medical/official/FLEXI/claims/CASE002/1760000000000_case-image.jpg');
assert.throws(() => M.officialResourcePath({ planId: 'UNKNOWN', category: 'other', contentType: 'other', filename: 'x.pdf' }), /ELITE|WISE|FLEXI/);
assert.equal(M.sanitizeSegment('../claims/CASE001'), 'claims-CASE001');

assert.match(sync, /key: "productContent"/);
assert.match(sync, /Product_Content/);
assert.match(sync, /data-resource-file/);
assert.match(sync, /createOfficialRecord/);
assert.match(sync, /Claim Case 資源必須填寫/);
assert.match(sync, /owner_id/);
assert.match(product, /resourcesForPlan/);
assert.match(product, /resourcesForClaimCase/);
assert.match(app, /officialResourceLinks/);
assert.match(app, /resourcesForClaimCase/);
assert.doesNotMatch(app, /listAllFirebase|listAll|listAllFiles|listAllObjects/);

assert.match(productionGas, /PRODUCT_CONTENT: "Product_Content"/);
assert.match(productionGas, /productContent:/);
assert.match(productionGas, /initializeMedicalProductContentSheet_/);
assert.match(productionGas, /dataset === "productContent"/);
assert.match(adapterGas, /productContent:/);
assert.match(rules, /match \/medical\/official\/\{planId\}\/\{allPaths=\*\*\}/);
assert.match(rules, /allow create, update: if validMedia\(\);/);
assert.match(rules, /allow delete: if false;/);
assert.match(rules, /match \/\{allPaths=\*\*\} \{[\s\S]*allow read, write: if false;/);
assert.doesNotMatch(rules, /medical\/users|medical\/private/);

console.log('Medical categorized Official resource architecture regression PASS');
