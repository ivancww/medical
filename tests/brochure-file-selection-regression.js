const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const syncSource = fs.readFileSync('medical-official-sync.js', 'utf8');
const syncContext = { window: null, globalThis: null };
syncContext.window = syncContext;
syncContext.globalThis = syncContext;
vm.runInNewContext(syncSource, syncContext, { filename: 'medical-official-sync.js' });
const sync = syncContext.MedicalOfficialSync;

const plans = [
  { record_id: 'elite_plan', record_type: 'PLAN', brochure_url: 'https://old.example/elite.pdf' },
  { record_id: 'wise_plan', record_type: 'PLAN', brochure_url: '' },
  { record_id: 'flexi_plan', record_type: 'PLAN', brochure_url: '' }
];
const pdf = { name: 'AIA-Elite-Brochure.pdf', type: 'application/pdf', size: 4.2 * 1024 * 1024 };
const image = { name: 'elite-benefits.jpg', type: 'image/jpeg', size: 1.8 * 1024 * 1024 };

assert.equal(sync.validateBrochureFile(pdf).type, 'application/pdf');
assert.equal(sync.validateBrochureFile(pdf).size, pdf.size);
assert.equal(sync.makePendingBrochureUpload(plans[0], pdf).recordId, 'elite_plan');
assert.equal(sync.makePendingBrochureUpload(plans[0], pdf).canonicalPlanId, 'ELITE');
assert.equal(sync.makePendingBrochureUpload(plans[1], image).canonicalPlanId, 'WISE');
assert.equal(sync.makePendingBrochureUpload(plans[2], image).canonicalPlanId, 'FLEXI');
assert.equal(sync.makePendingBrochureUpload(plans[0], pdf).file, pdf, 'File object remains memory-only and identity-preserved');
assert.throws(() => sync.validateBrochureFile({ name: 'bad.exe', type: 'application/octet-stream', size: 10 }), /不支援此檔案格式/);
assert.throws(() => sync.validateBrochureFile({ name: 'large.pdf', type: 'application/pdf', size: 21 * 1024 * 1024 }), /20MB/);

assert.match(syncSource, /const pendingBrochureUploads = new Map\(\)/, 'pending brochure state is memory-only');
assert.match(syncSource, /input\.onchange = \(\) => selectBrochureFile\(input\)/, 'current file input captures the native change event');
assert.match(syncSource, /data-brochure-selection/, 'selected filename/type/size has a rendered feedback target');
assert.match(syncSource, /data-brochure-upload .*disabled/, 'upload is inactive before valid selection');
assert.match(syncSource, /pendingBrochureUploads\.get\(recordIdValue\)/, 'upload reads the pending record-bound File, not input.value');
assert.match(syncSource, /pendingBrochureUploads\.clear\(\)/, 'switching plan records clears pending selection and prevents cross-upload');
assert.match(syncSource, /Firebase 上載失敗：/, 'Firebase failure is reported at the Firebase stage');
assert.match(syncSource, /官方資料發布失敗：/, 'Official write failure is reported at the Official stage');
assert.doesNotMatch(syncSource.slice(syncSource.indexOf('pendingBrochureUploads'), syncSource.indexOf('function mount')), /localStorage|sessionStorage|indexedDB|FileReader|readAsDataURL|base64/i, 'File is not placed into browser structured storage');
assert.match(syncSource, /uploadOfficialBrochure\(\{\s*planId,\s*file/, 'Firebase receives the canonical plan ID and captured File');
assert.match(syncSource, /authorizedRequest\(\{ action: "updateOfficialRecord"/, 'Official write remains after Firebase URL acquisition');

console.log('Medical brochure file-selection and pending-state regression PASS');
