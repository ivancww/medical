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

function medicalOfficialDataAction_(body) {
  if (body.action !== "updateOfficialRecord") throw new Error("Unsupported Medical Official action");
  if (String(body.appId || "") !== String(MEDICAL_ADMIN_APP_ID)) throw new Error("Invalid Medical App ID");
  if (String(body.operation || "") !== "medical:official-write") throw new Error("Invalid Medical Official operation");
  medicalVerifyAppGrant_(body.appGrant, "medical:official-write");
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
    const persistedRecord = (persisted.adminDatasets[dataset] || []).find(row => String(medicalOfficialRecordId_(row, definition.ids)) === stableId);
    if (!persistedRecord || Object.entries(changes).some(([field, value]) => JSON.stringify(persistedRecord[field]) !== JSON.stringify(value))) throw new Error("Official read-after-write verification failed");
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error("Medical Official sheet tab not found: " + name);
  return sheet;
}

function medicalOfficialSort_(rows, key) {
  if (typeof sortByOrder_ === "function") sortByOrder_(rows, key);
  return rows;
}

function medicalOfficialReadObjects_(ss, sheetName, orderKey) {
  const rows = readObjectSheet_(ss.getSheetByName(sheetName));
  return medicalOfficialSort_(rows || [], orderKey);
}

function medicalOfficialConfigRows_(config) {
  return Object.keys(config || {}).sort().map(key => ({ config_key: key, config_value: normalizeValue_(config[key]) }));
}

function medicalOfficialStableStringify_(value) {
  if (Array.isArray(value)) return "[" + value.map(medicalOfficialStableStringify_).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + medicalOfficialStableStringify_(value[key])).join(",") + "}";
  return JSON.stringify(normalizeValue_(value));
}

function medicalOfficialRevision_(payload) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, medicalOfficialStableStringify_(payload), Utilities.Charset.UTF_8);
  return bytes.map(byte => { const hex = (byte < 0 ? byte + 256 : byte).toString(16); return hex.length === 1 ? "0" + hex : hex; }).join("");
}

/**
 * Canonical Medical Official snapshot. These are the production read helpers
 * already used by doGet; this adapter intentionally does not reinterpret the
 * workbook schema or maintain a parallel reader.
 */
function medicalOfficialReadSnapshot_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = readKeyValueSheet_(ss.getSheetByName(AVA_MEDICAL.SHEETS.CONFIG)) || {};
  const pages = medicalOfficialReadObjects_(ss, AVA_MEDICAL.SHEETS.PAGES, "sort_order");
  const options = medicalOfficialReadObjects_(ss, AVA_MEDICAL.SHEETS.OPTIONS, "sort_order");
  const plans = medicalOfficialReadObjects_(ss, AVA_MEDICAL.SHEETS.PLANS, "sort_order");
  const claimRules = medicalOfficialReadObjects_(ss, AVA_MEDICAL.SHEETS.CLAIM_RULES, "sort_order");
  const claimCases = medicalOfficialReadObjects_(ss, AVA_MEDICAL.SHEETS.CLAIM_CASES, "sort_order");
  const premiumSettings = medicalOfficialReadObjects_(ss, AVA_MEDICAL.SHEETS.PREMIUM_SETTINGS, "sort_order");
  const premiumTables = readPremiumTables_(ss) || {};
  const adminDatasets = {
    pages, options, plans, claimRules, claimCases, premiumSettings,
    config: medicalOfficialConfigRows_(config)
  };
  const payload = { pages, options, plans, claimRules, claimCases, premiumSettings, premiumTables, config, adminDatasets };
  const version = String(config.data_version || AVA_MEDICAL.SCHEMA_VERSION || "unknown");
  return Object.assign({ success: true, version, revision: medicalOfficialRevision_(payload) }, payload);
}

/**
 * The old doPost accepted arbitrary payload.pages/config/etc. and called the
 * whole-sheet writers. It is not a compatibility path: it must be rejected
 * before any legacy writer can run. The existing doPost should call this for
 * any payload containing legacy bulk Official keys, then route the explicit
 * updateOfficialRecord action to medicalOfficialDataAction_.
 */
function medicalOfficialRejectLegacyBulkWrite_(payload) {
  const legacyKeys = ["config", "pages", "options", "plans", "claimRules", "claimCases", "premiumSettings"];
  if (legacyKeys.some(key => Object.prototype.hasOwnProperty.call(payload || {}, key))) {
    throw new Error("Legacy bulk Official write is disabled; use authenticated updateOfficialRecord");
  }
}

/** Single deterministic Official branch for the existing doPost router. */
function medicalOfficialPostAction_(payload) {
  if (payload && payload.action === "updateOfficialRecord") return medicalOfficialDataAction_(payload);
  medicalOfficialRejectLegacyBulkWrite_(payload);
  throw new Error("Unsupported Medical POST action");
}
