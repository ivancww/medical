const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('gas/MedicalProductionFinal.gs', 'utf8');
assert.equal((source.match(/function doGet\s*\(/g) || []).length, 1);
assert.equal((source.match(/function doPost\s*\(/g) || []).length, 1);
assert.match(source, /PLAN_COMPARISON: "Plan_Comparison"/);
assert.match(source, /planComparison: \{ sheet: "Plan_Comparison"/);
assert.match(source, /plancomparison: "plan_comparison"/);
assert.match(source, /comparisonitems: "plan_comparison"/);
assert.match(source, /comparison_items: "plan_comparison"/);
assert.match(source, /planComparison: snapshot\.planComparison/);
assert.match(source, /const payload = \{ pages, options, plans, claimRules, claimCases, premiumSettings, planComparison, premiumTables/);
assert.match(source, /legacyKeys = \[.*"planComparison"/);
assert.match(source, /initializeMedicalPlanComparisonSheet_/);
assert.match(source, /createOfficialRecord/);
assert.match(source, /Only Plan_Comparison records may be created/);

const headers = [
  'comparison_id', 'item_key', 'item_name', 'plan_id', 'condition_state',
  'main_value', 'sub_value', 'enabled', 'sort_order', 'source_name',
  'source_url', 'verified', 'notes'
];
const comparisonRows = [
  ['CMP-1', 'post_discharge_followup', '出院後覆診', 'ELITE', 'DEFAULT', 'fixture elite', 'fixture source', true, 1, 'fixture', '', true, ''],
  ['CMP-2', 'post_discharge_followup', '出院後覆診', 'WISE', 'WISE_SEMI_PRIVATE', 'fixture wise semi', 'fixture source', true, 2, 'fixture', '', true, ''],
  ['CMP-3', 'post_discharge_followup', '出院後覆診', 'WISE', 'WISE_GENERAL_ROOM', 'fixture wise general', 'fixture source', true, 3, 'fixture', '', true, '']
];

class FakeSheet {
  constructor(values) { this.values = values.map(row => row.slice()); }
  getDataRange() { return { getValues: () => this.values.map(row => row.slice()) }; }
  getLastColumn() { return this.values[0]?.length || 0; }
  getLastRow() { return this.values.length; }
  getRange(row, column, numRows = 1, numColumns = 1) {
    return {
      getValues: () => this.values.slice(row - 1, row - 1 + numRows).map(line => line.slice(column - 1, column - 1 + numColumns)),
      setValue: value => { this.values[row - 1][column - 1] = value; },
      setValues: values => { values.forEach((line, rowOffset) => { this.values[row - 1 + rowOffset] = line.slice(); }); }
    };
  }
}

const sheetValues = {
  Config: [['config_key', 'config_value'], ['data_version', 'fixture-1']],
  Pages: [['page_id', 'title', 'enabled', 'sort_order'], ['R07', 'P7', true, 7]],
  Options: [['option_id', 'display_name', 'enabled', 'sort_order'], ['x', 'X', true, 1]],
  Plans: [['record_id', 'plan_name', 'enabled', 'sort_order'], ['ELITE', 'Elite', true, 1]],
  Claim_Rules: [['plan_id', 'plan_name', 'default_rate', 'deductible_enabled'], ['ELITE', 'Elite', 1, true]],
  Claim_Cases: [['case_id', 'case_title', 'verified', 'enabled', 'sort_order'], ['C1', 'Case', true, true, 1]],
  Premium_Settings: [['setting_id', 'title', 'enabled', 'sort_order'], ['S1', 'Setting', true, 1]],
  Plan_Comparison: [headers, ...comparisonRows]
};
const sheets = Object.fromEntries(Object.entries(sheetValues).map(([name, values]) => [name, new FakeSheet(values)]));
const spreadsheet = {
  getSheetByName(name) { return sheets[name] || null; },
  insertSheet(name) { const sheet = new FakeSheet([]); sheets[name] = sheet; return sheet; }
};

const sandbox = {
  Date, JSON, Object, Number, String, Boolean, Array, isFinite,
  SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'UTC' },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest(_algorithm, value) { return [...crypto.createHash('sha256').update(String(value), 'utf8').digest()].map(byte => byte > 127 ? byte - 256 : byte); },
    formatDate(date) { return date.toISOString().slice(0, 10); }
  }
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'MedicalProductionFinal.gs' });

const first = sandbox.medicalOfficialReadSnapshot_();
assert.equal(first.planComparison.length, 3);
assert.equal(first.adminDatasets.planComparison[0].comparison_id, 'CMP-1');
assert.match(first.revision, /^[a-f0-9]{64}$/);
assert.equal(sandbox.medicalFullBootstrap_().planComparison.length, 3, 'full bootstrap includes planComparison');
for (const alias of ['planComparison', 'plan_comparison', 'comparisonItems', 'comparison_items']) {
  const result = sandbox.getDataset_(alias);
  assert.equal(result.status, 'success');
  assert.equal(result.data.length, 3, alias + ' returns comparison rows');
}

const beforeRevision = first.revision;
sheets.Plan_Comparison.values[1][5] = 'fixture elite changed';
const afterRevision = sandbox.medicalOfficialReadSnapshot_();
assert.notEqual(afterRevision.revision, beforeRevision, 'Plan_Comparison changes affect Official revision');

const updated = sandbox.medicalUpdateOfficialRecord_({
  dataset: 'planComparison', recordId: 'CMP-1', expectedVersion: afterRevision.revision,
  changes: { main_value: 'fixture elite persisted', verified: false }
});
assert.equal(updated.success, true);
assert.equal(updated.data.planComparison[0].main_value, 'fixture elite persisted');
assert.equal(updated.data.planComparison[0].verified, false);
const created = sandbox.medicalCreateOfficialRecord_({
  dataset: 'planComparison', recordId: 'CMP-NEW', expectedVersion: updated.revision,
  changes: { item_key: 'diagnostic_imaging', item_name: '診斷影像', plan_id: 'ELITE', condition_state: 'DEFAULT', main_value: '可顯示', sub_value: '', enabled: true, sort_order: 5, source_name: 'fixture', source_url: '', verified: false, notes: '' }
});
assert.equal(created.success, true, 'targeted create succeeds');
assert.equal(created.data.planComparison.some(row => row.comparison_id === 'CMP-NEW'), true);
assert.throws(() => sandbox.medicalUpdateOfficialRecord_({
  dataset: 'planComparison', recordId: 'CMP-1', expectedVersion: updated.revision,
  changes: { comparison_id: 'changed' }
}), /read-only or unsupported/);
assert.throws(() => sandbox.medicalUpdateOfficialRecord_({
  dataset: 'planComparison', recordId: 'CMP-1', expectedVersion: beforeRevision,
  changes: { main_value: 'stale' }
}), /Stale Official version/);
assert.throws(() => sandbox.medicalUpdateOfficialRecord_({
  dataset: 'premiumTables', recordId: 'anything', expectedVersion: updated.revision,
  changes: { value: 1 }
}), /Unsupported Medical Official dataset/);
assert.throws(() => sandbox.medicalOfficialRejectLegacyBulkWrite_({ planComparison: [] }), /Legacy bulk Official write is disabled/);

console.log('Medical P7 Plan_Comparison read, aliases, revision, targeted write/create, validation, premium read-only and legacy rejection checks passed');
