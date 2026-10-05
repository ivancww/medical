/** Medical-owned Official Sheet mutation/read contract. Merge into the
 * existing Medical Apps Script project; do not replace its doPost/doGet. */
const MEDICAL_OFFICIAL_DATASETS = Object.freeze({
  pages: { sheet: "Pages", ids: ["page_id"], fields: ["page_name", "title", "subtitle", "enabled", "sort_order", "highlight_text"], types: { enabled: "boolean", sort_order: "number" } },
  options: { sheet: "Options", ids: ["option_id"], fields: ["display_name", "subtitle", "reflection_text", "enabled", "sort_order"], types: { enabled: "boolean", sort_order: "number" } },
  plans: { sheet: "Plans", ids: ["record_id"], fields: ["plan_name", "category", "title", "description", "brochure_url", "enabled", "sort_order"], types: { enabled: "boolean", sort_order: "number" } },
  claimRules: { sheet: "Claim_Rules", ids: ["plan_id"], fields: ["plan_name", "default_rate", "deductible_enabled", "note"], types: { default_rate: "number", deductible_enabled: "boolean" } },
  claimCases: { sheet: "Claim_Cases", ids: ["case_id"], fields: ["case_title", "condition_name", "treatment_name", "medical_cost", "actual_reimbursement", "case_date", "source_type", "source_url", "verified", "enabled", "sort_order"], types: { medical_cost: "number", actual_reimbursement: "number", verified: "boolean", enabled: "boolean", sort_order: "number" } },
  premiumSettings: { sheet: "Premium_Settings", ids: ["setting_id"], fields: ["title", "description", "value", "start_date", "end_date", "enabled", "sort_order"], types: { enabled: "boolean", sort_order: "number" } },
  config: { sheet: "Config", ids: ["config_key"], fields: ["config_value", "description"], types: {} }
});

// Canonical read-only tables. They have age/value columns but no explicit
// stable record-ID column, so they are not exposed to targeted mutation.
const MEDICAL_OFFICIAL_PREMIUM_SHEETS = Object.freeze([
  "女靈活計劃", "男靈活計劃", "睿選0自付額", "睿選8800自付額",
  "睿選18000自付額", "睿選30000自付額", "尊顯0自付額", "尊顯16000自付額",
  "尊顯25000自付額", "OPCEO16000自付額", "OPCEO25000自付額"
]);

function medicalOfficialDataAction_(body) {
  if (body.action !== "updateOfficialRecord") throw new Error("Unsupported Medical Official action");
  if (String(body.appId || "") !== String(MEDICAL_ADMIN_APP_ID)) throw new Error("Invalid Medical App ID");
  medicalVerifyAppGrant_(body.appGrant, "official-write");
  return medicalUpdateOfficialRecord_(body);
}

function medicalUpdateOfficialRecord_(body) {
  const dataset = String(body.dataset || ""), definition = MEDICAL_OFFICIAL_DATASETS[dataset], changes = body.changes;
  if (!definition) throw new Error("Unsupported Medical Official dataset");
  if (!changes || typeof changes !== "object" || Array.isArray(changes) || !Object.keys(changes).length) throw new Error("No Official changes supplied");
  Object.keys(changes).forEach(field => {
    if (!definition.fields.includes(field)) throw new Error("Official field is read-only or unsupported: " + field);
    medicalOfficialValidateValue_(field, changes[field], definition.types[field]);
  });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const snapshot = medicalOfficialReadSnapshot_(), currentToken = String(snapshot.revision || snapshot.version || "");
    if (String(body.expectedVersion || "") !== currentToken) throw new Error("Stale Official version; refresh before saving");
    const record = (snapshot.adminDatasets[dataset] || []).find(row => String(medicalOfficialRecordId_(row, definition.ids)) === String(body.recordId || ""));
    if (!record) throw new Error("Official record not found");
    const stableId = String(medicalOfficialRecordId_(record, definition.ids));
    if (!stableId || stableId !== String(body.recordId || "")) throw new Error("Stable Official record ID is required");
    const sheet = medicalOfficialSheet_(definition.sheet), values = sheet.getDataRange().getValues();
    if (values.length < 2) throw new Error("Official sheet has no data rows");
    const headers = values[0].map(String);
    const rowIndex = values.findIndex((row, index) => index > 0 && String(medicalOfficialRecordId_(medicalOfficialRow_(headers, row), definition.ids)) === stableId);
    if (rowIndex < 1) throw new Error("Official record row not found");
    Object.entries(changes).forEach(([field, value]) => {
      const column = headers.indexOf(field);
      if (column < 0) throw new Error("Official field is absent from Sheet: " + field);
      sheet.getRange(rowIndex + 1, column + 1).setValue(value);
    });
    const persisted = medicalOfficialReadSnapshot_();
    return { success: true, dataset, recordId: stableId, version: persisted.version, revision: persisted.revision, data: persisted };
  } finally { lock.releaseLock(); }
}

function medicalOfficialValidateValue_(field, value, type) {
  if (value !== null && typeof value === "object") throw new Error("Official value must be scalar");
  if (type === "number" && (typeof value !== "number" || !isFinite(value))) throw new Error("Official field must be numeric: " + field);
  if (type === "boolean" && typeof value !== "boolean") throw new Error("Official field must be boolean: " + field);
}

function medicalOfficialRecordId_(row, ids) { for (const id of ids) if (row && row[id] !== undefined && row[id] !== "") return row[id]; return ""; }
function medicalOfficialRow_(headers, row) { return headers.reduce((out, header, index) => { out[header] = medicalOfficialCell_(row[index]); return out; }, {}); }
function medicalOfficialCell_(value) { return value instanceof Date ? Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd") : value; }
function medicalOfficialSheet_(name) {
  const id = PropertiesService.getScriptProperties().getProperty("MEDICAL_OFFICIAL_SPREADSHEET_ID");
  if (!id) throw new Error("Medical Official Sheet is not configured");
  const sheet = SpreadsheetApp.openById(id).getSheetByName(name);
  if (!sheet) throw new Error("Medical Official sheet tab not found: " + name);
  return sheet;
}

function medicalOfficialReadRows_(sheetName, idFields, warnings) {
  const sheet = medicalOfficialSheet_(sheetName), values = sheet.getDataRange().getValues();
  if (!values.length || !values[0].length) return [];
  const headers = values[0].map(String), rows = [];
  values.slice(1).forEach((row, offset) => {
    if (row.every(value => value === "" || value === null)) return;
    const record = medicalOfficialRow_(headers, row), id = medicalOfficialRecordId_(record, idFields);
    if (!id) { warnings.push(sheetName + " row " + (offset + 2) + " skipped: missing stable ID"); return; }
    rows.push(record);
  });
  return rows;
}

function medicalOfficialReadPremiumTable_(sheetName, warnings) {
  const sheet = medicalOfficialSheet_(sheetName), values = sheet.getDataRange().getValues();
  if (values.length < 2 || values[0].length < 2) return {};
  const table = {};
  values.slice(1).forEach((row, offset) => {
    const age = row[0], premium = row[1];
    if (age === "" || age === null) { warnings.push(sheetName + " row " + (offset + 2) + " skipped: missing age"); return; }
    table[String(age)] = premium;
  });
  return table;
}

function medicalOfficialSha256_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return bytes.map(byte => { const hex = (byte < 0 ? byte + 256 : byte).toString(16); return hex.length === 1 ? "0" + hex : hex; }).join("");
}

/** One canonical model for Admin reads and Official write validation. */
function medicalOfficialReadSnapshot_() {
  const warnings = [], datasets = {};
  Object.entries(MEDICAL_OFFICIAL_DATASETS).forEach(([key, definition]) => { datasets[key] = medicalOfficialReadRows_(definition.sheet, definition.ids, warnings); });
  const config = {};
  datasets.config.forEach(row => { config[String(row.config_key)] = row.config_value; });
  const premiumTables = {};
  MEDICAL_OFFICIAL_PREMIUM_SHEETS.forEach(name => { premiumTables[name] = medicalOfficialReadPremiumTable_(name, warnings); });
  const adminDatasets = Object.keys(datasets).reduce((out, key) => { out[key] = datasets[key]; return out; }, {});
  const payload = { pages: datasets.pages, options: datasets.options, plans: datasets.plans, claimRules: datasets.claimRules, claimCases: datasets.claimCases, premiumSettings: datasets.premiumSettings, config, premiumTables, adminDatasets, warnings };
  const revision = medicalOfficialSha256_(JSON.stringify(payload));
  const versionRow = datasets.config.find(row => String(row.config_key) === "data_version");
  return Object.assign({ success: true, version: String(versionRow ? versionRow.config_value : "unknown"), revision }, payload);
}
