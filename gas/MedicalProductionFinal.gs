/**
 * AVA Medical production Google Apps Script source.
 *
 * Deploy this complete source in the existing 成人醫療 Apps Script project.
 * It preserves the canonical Medical read API and replaces the legacy bulk
 * Official writer with the authenticated, targeted Official mutation contract.
 *
 * Credentials, launch tickets, grants and session values remain outside this
 * source in Script Properties and the AVA Platform authorization service.
 */

const MEDICAL_ADMIN_APP_ID = "medical";
const AVA_PLATFORM_ADMIN_AUTH_URL_PROPERTY = "AVA_PLATFORM_ADMIN_AUTH_URL";
const MEDICAL_ADMIN_SESSION_CONTRACT = "ava-admin-session-v1";
const MEDICAL_APP_GRANT_CONTRACT = "ava-legacy-app-grant-v1";

const AVA_MEDICAL = Object.freeze({
  APP: "AVA Medical",
  SCHEMA_VERSION: "1.0.0",
  SHEETS: Object.freeze({
    CONFIG: "Config",
    PAGES: "Pages",
    OPTIONS: "Options",
    PLANS: "Plans",
    CLAIM_RULES: "Claim_Rules",
    CLAIM_CASES: "Claim_Cases",
    PREMIUM_SETTINGS: "Premium_Settings"
  }),
  PREMIUM_SHEETS: Object.freeze([
    "女靈活計劃",
    "男靈活計劃",
    "睿選0自付額",
    "睿選8800自付額",
    "睿選18000自付額",
    "睿選30000自付額",
    "尊顯0自付額",
    "尊顯16000自付額",
    "尊顯25000自付額",
    "OPCEO16000自付額",
    "OPCEO25000自付額"
  ])
});

const MEDICAL_OFFICIAL_DATASETS = Object.freeze({
  pages: { sheet: "Pages", ids: ["page_id"], fields: ["page_name", "title", "subtitle", "enabled", "sort_order", "highlight_text"], types: { enabled: "boolean", sort_order: "number" } },
  options: { sheet: "Options", ids: ["option_id"], fields: ["display_name", "subtitle", "reflection_text", "enabled", "sort_order"], types: { enabled: "boolean", sort_order: "number" } },
  plans: { sheet: "Plans", ids: ["record_id"], fields: ["plan_name", "category", "title", "description", "brochure_url", "enabled", "sort_order"], types: { enabled: "boolean", sort_order: "number" } },
  claimRules: { sheet: "Claim_Rules", ids: ["plan_id"], fields: ["plan_name", "default_rate", "deductible_enabled", "note"], types: { default_rate: "number", deductible_enabled: "boolean" } },
  claimCases: { sheet: "Claim_Cases", ids: ["case_id"], fields: ["case_title", "condition_name", "treatment_name", "medical_cost", "actual_reimbursement", "case_date", "source_type", "source_url", "verified", "enabled", "sort_order"], types: { medical_cost: "number", actual_reimbursement: "number", verified: "boolean", enabled: "boolean", sort_order: "number" } },
  premiumSettings: { sheet: "Premium_Settings", ids: ["setting_id"], fields: ["title", "description", "value", "start_date", "end_date", "enabled", "sort_order"], types: { enabled: "boolean", sort_order: "number" } },
  config: { sheet: "Config", ids: ["config_key"], fields: ["config_value", "description"], types: {} }
});

function output_(value, callback) {
  const json = JSON.stringify(value);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(String(callback))) {
    return ContentService.createTextOutput(String(callback) + "(" + json + ")").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function error_(message, code) {
  return { success: false, error: { code: code || "REQUEST_REJECTED", message: String(message) } };
}

/** The single production GET router. */
function doGet(e) {
  const parameters = e && e.parameter || {};
  const callback = parameters.callback || "";
  try {
    const action = String(parameters.action || "");
    if (action === "checkVersion") return output_(checkVersion_(), callback);
    if (action === "getDataset") return output_(getDataset_(parameters.dataset), callback);
    if (!action) return output_(medicalFullBootstrap_(), callback);
    return output_(error_("Unsupported action", "UNSUPPORTED_ACTION"), callback);
  } catch (error) {
    return output_(error_(error.message, error.code || "READ_FAILED"), callback);
  }
}

/**
 * The single production POST router. JSON is parsed once. Legacy bulk keys
 * are rejected before any action or writer can run.
 */
function doPost(e) {
  try {
    const body = JSON.parse(e && e.postData && e.postData.contents || "{}");
    medicalOfficialRejectLegacyBulkWrite_(body);
    if (body.action === "exchangeAdminSession" || body.action === "exchangeAppLaunch") return output_(medicalAdminAuthAction_(body));
    if (body.action === "updateOfficialRecord") return output_(medicalOfficialPostAction_(body));
    throw new Error("Unsupported Medical POST action");
  } catch (error) {
    return output_(error_(error.message, error.code || "REQUEST_REJECTED"));
  }
}

function checkVersion_() {
  const config = readKeyValueSheet_(medicalSheet_(AVA_MEDICAL.SHEETS.CONFIG));
  return {
    status: "success",
    schemaVersion: AVA_MEDICAL.SCHEMA_VERSION,
    version: String(config.data_version || AVA_MEDICAL.SCHEMA_VERSION),
    config
  };
}

function getDataset_(requested) {
  const requestedDataset = String(requested || "").toLowerCase();
  const dataset = {
    claimrules: "claim_rules",
    claimcases: "claim_cases",
    premiumsettings: "premium_settings",
    premiumtables: "premiums",
    premium_tables: "premiums"
  }[requestedDataset] || requestedDataset;
  const config = readKeyValueSheet_(medicalSheet_(AVA_MEDICAL.SHEETS.CONFIG));
  const version = String(config.data_version || AVA_MEDICAL.SCHEMA_VERSION);
  const data = {
    config,
    pages: medicalOfficialReadObjects_(medicalSpreadsheet_(), AVA_MEDICAL.SHEETS.PAGES, "sort_order"),
    options: medicalOfficialReadObjects_(medicalSpreadsheet_(), AVA_MEDICAL.SHEETS.OPTIONS, "sort_order"),
    plans: medicalOfficialReadObjects_(medicalSpreadsheet_(), AVA_MEDICAL.SHEETS.PLANS, "sort_order"),
    claim_rules: medicalOfficialReadObjects_(medicalSpreadsheet_(), AVA_MEDICAL.SHEETS.CLAIM_RULES, "sort_order"),
    claim_cases: medicalOfficialReadObjects_(medicalSpreadsheet_(), AVA_MEDICAL.SHEETS.CLAIM_CASES, "sort_order"),
    premium_settings: medicalOfficialReadObjects_(medicalSpreadsheet_(), AVA_MEDICAL.SHEETS.PREMIUM_SETTINGS, "sort_order"),
    premiums: readPremiumTables_(medicalSpreadsheet_())
  };
  if (!Object.prototype.hasOwnProperty.call(data, dataset)) throw new Error("Unsupported dataset");
  return { status: "success", version, dataset: requestedDataset, data: data[dataset] };
}

function medicalFullBootstrap_() {
  const snapshot = medicalOfficialReadSnapshot_();
  return {
    status: "success",
    app: AVA_MEDICAL.APP,
    schemaVersion: AVA_MEDICAL.SCHEMA_VERSION,
    version: snapshot.version,
    generatedAt: new Date().toISOString(),
    config: snapshot.config,
    pages: snapshot.pages,
    options: snapshot.options,
    plans: snapshot.plans,
    claimRules: snapshot.claimRules,
    claimCases: snapshot.claimCases,
    premiumSettings: snapshot.premiumSettings,
    premiumTables: snapshot.premiumTables
  };
}

/** AVA Platform browser-bound and Legacy App Grant launch-ticket exchange. */
function medicalAdminAuthAction_(body) {
  if (body.action === "exchangeAdminSession") {
    return medicalExchangeAdminSession_(body.launchTicket, body.appId, body.browserProof, body.launchNonce);
  }
  if (body.action === "exchangeAppLaunch") {
    return medicalExchangeAppLaunch_(body.launchTicket, body.appId);
  }
  throw new Error("Unsupported Medical Admin action");
}

/** Existing V15 browser-bound Admin Session exchange. */
function medicalExchangeAdminSession_(launchTicket, appId, browserProof, launchNonce) {
  if (String(appId || "") !== MEDICAL_ADMIN_APP_ID || !String(launchTicket || "")) {
    throw new Error("Invalid Medical Admin launch");
  }
  const endpoint = PropertiesService.getScriptProperties().getProperty(AVA_PLATFORM_ADMIN_AUTH_URL_PROPERTY);
  if (!endpoint) throw new Error("Medical Admin authorization is not configured");
  const response = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "text/plain;charset=utf-8",
    payload: JSON.stringify({ action: "exchangeAdminSession", launchTicket: String(launchTicket), browserProof: String(browserProof || ""), launchNonce: String(launchNonce || ""), appId: MEDICAL_ADMIN_APP_ID }),
    muteHttpExceptions: true
  });
  let payload;
  try { payload = JSON.parse(response.getContentText() || "{}"); } catch (_) { throw new Error("Invalid AVA Admin response"); }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || payload.success !== true || payload.appId !== MEDICAL_ADMIN_APP_ID || !payload.adminSessionProof || payload.contract !== MEDICAL_ADMIN_SESSION_CONTRACT) {
    throw new Error("Invalid or expired AVA Admin launch");
  }
  return { success: true, appId: MEDICAL_ADMIN_APP_ID, adminSessionProof: String(payload.adminSessionProof), expiresAt: payload.expiresAt, contract: MEDICAL_ADMIN_SESSION_CONTRACT };
}

function medicalExchangeAppLaunch_(launchTicket, appId) {
  if (String(appId || "") !== MEDICAL_ADMIN_APP_ID || !String(launchTicket || "")) {
    throw new Error("Invalid Medical Admin launch");
  }
  const endpoint = PropertiesService.getScriptProperties().getProperty(AVA_PLATFORM_ADMIN_AUTH_URL_PROPERTY);
  if (!endpoint) throw new Error("Medical Admin authorization is not configured");
  const response = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "text/plain;charset=utf-8",
    payload: JSON.stringify({ action: "exchangeAppLaunch", launchTicket: String(launchTicket), appId: MEDICAL_ADMIN_APP_ID }),
    muteHttpExceptions: true
  });
  let payload;
  try { payload = JSON.parse(response.getContentText() || "{}"); } catch (_) { throw new Error("Invalid AVA Admin response"); }
  const expiry = Date.parse(String(payload.expiresAt || ""));
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || payload.success !== true || payload.appId !== MEDICAL_ADMIN_APP_ID || !payload.appGrant || payload.contract !== MEDICAL_APP_GRANT_CONTRACT || !Number.isFinite(expiry) || expiry <= Date.now()) {
    throw new Error("Invalid or expired AVA Admin launch");
  }
  return { success: true, appId: MEDICAL_ADMIN_APP_ID, appGrant: String(payload.appGrant), expiresAt: String(payload.expiresAt), contract: MEDICAL_APP_GRANT_CONTRACT };
}

/** Canonical backend App Grant verification; no credential is stored here. */
function medicalVerifyAppGrant_(appGrant, operation) {
  const endpoint = PropertiesService.getScriptProperties().getProperty(AVA_PLATFORM_ADMIN_AUTH_URL_PROPERTY);
  if (!endpoint || !String(appGrant || "")) throw new Error("Medical Admin authorization is required");
  const response = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "text/plain;charset=utf-8",
    payload: JSON.stringify({ action: "verifyAppGrant", appGrant: String(appGrant), appId: MEDICAL_ADMIN_APP_ID, operation: String(operation || "official-write") }),
    muteHttpExceptions: true
  });
  let payload;
  try { payload = JSON.parse(response.getContentText() || "{}"); } catch (_) { throw new Error("Invalid AVA Admin response"); }
  const expectedOperation = String(operation || "official-write");
  const expiry = Date.parse(String(payload.expiresAt || ""));
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || payload.success !== true || payload.appId !== MEDICAL_ADMIN_APP_ID || payload.operation !== expectedOperation || payload.contract !== MEDICAL_APP_GRANT_CONTRACT || !Number.isFinite(expiry) || expiry <= Date.now()) {
    throw new Error("Invalid or expired Medical Admin authorization");
  }
  return payload;
}

/** Existing V15 browser-bound Admin Session verification. */
function medicalVerifyAdminSession_(adminSessionProof, operation) {
  const endpoint = PropertiesService.getScriptProperties().getProperty(AVA_PLATFORM_ADMIN_AUTH_URL_PROPERTY);
  if (!endpoint || !String(adminSessionProof || "")) throw new Error("Medical Admin authorization is required");
  const expectedOperation = String(operation || "official-write");
  const response = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "text/plain;charset=utf-8",
    payload: JSON.stringify({ action: "verifyAdminSession", adminSessionProof: String(adminSessionProof), appId: MEDICAL_ADMIN_APP_ID, operation: expectedOperation }),
    muteHttpExceptions: true
  });
  let payload;
  try { payload = JSON.parse(response.getContentText() || "{}"); } catch (_) { throw new Error("Invalid AVA Admin response"); }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || payload.success !== true || payload.appId !== MEDICAL_ADMIN_APP_ID || payload.operation !== expectedOperation || payload.contract !== MEDICAL_ADMIN_SESSION_CONTRACT) {
    throw new Error("Invalid or expired Medical Admin authorization");
  }
  return payload;
}

function medicalSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function medicalSheet_(name) {
  const sheet = medicalSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error("Medical Official sheet tab not found: " + name);
  return sheet;
}

function readKeyValueSheet_(sheet) {
  if (!sheet) return {};
  const values = sheet.getDataRange().getValues();
  if (!values.length) return {};
  const headers = values[0].map(String);
  const keyIndex = headers.indexOf("config_key") >= 0 ? headers.indexOf("config_key") : headers.indexOf("key") >= 0 ? headers.indexOf("key") : 0;
  const valueIndex = headers.indexOf("config_value") >= 0 ? headers.indexOf("config_value") : headers.indexOf("value") >= 0 ? headers.indexOf("value") : 1;
  const result = {};
  values.slice(1).forEach(row => {
    const key = String(row[keyIndex] == null ? "" : row[keyIndex]).trim();
    if (key) result[key] = normalizeValue_(row[valueIndex]);
  });
  return result;
}

function readObjectSheet_(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (!values.length) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(value => value !== "" && value != null)).map(row => {
    const result = {};
    headers.forEach((header, index) => { if (header) result[header] = normalizeValue_(row[index]); });
    return result;
  });
}

function sortByOrder_(rows, key) {
  return (rows || []).sort((left, right) => {
    const a = Number(left && left[key] != null ? left[key] : 0), b = Number(right && right[key] != null ? right[key] : 0);
    return (Number.isFinite(a) ? a : 0) - (Number.isFinite(b) ? b : 0);
  });
}

function medicalOfficialSort_(rows, key) {
  return sortByOrder_(rows, key);
}

function medicalOfficialReadObjects_(ss, sheetName, orderKey) {
  return medicalOfficialSort_(readObjectSheet_(ss.getSheetByName(sheetName)) || [], orderKey);
}

function normalizeValue_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  if (Array.isArray(value)) return value.map(normalizeValue_);
  if (value && typeof value === "object") {
    const result = {};
    Object.keys(value).forEach(key => { result[key] = normalizeValue_(value[key]); });
    return result;
  }
  return value;
}

function premiumTableValue_(row, headers) {
  const ageHeader = headers.find(key => ["age", "實際年齡", "年齡", "attained_age"].includes(key));
  const valueHeader = headers.find(key => ["annual_premium", "年繳保費(港元)", "年繳保費 (港元)", "premium", "value"].includes(key));
  if (!ageHeader || !valueHeader) return null;
  const age = String(row[ageHeader] == null ? "" : row[ageHeader]).trim();
  const value = Number(row[valueHeader]);
  if (!age || !Number.isFinite(value) || value < 0) return null;
  return { age, value };
}

function readPremiumTables_(ss) {
  const result = {};
  AVA_MEDICAL.PREMIUM_SHEETS.forEach(sheetName => {
    const rows = readObjectSheet_(ss.getSheetByName(sheetName));
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const table = {};
    rows.forEach(row => {
      const item = premiumTableValue_(row, headers);
      if (item) table[item.age] = item.value;
    });
    result[sheetName] = table;
  });
  return result;
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

/** Canonical snapshot shared by full bootstrap and targeted mutation. */
function medicalOfficialReadSnapshot_() {
  const ss = medicalSpreadsheet_();
  const config = readKeyValueSheet_(ss.getSheetByName(AVA_MEDICAL.SHEETS.CONFIG)) || {};
  const pages = medicalOfficialReadObjects_(ss, AVA_MEDICAL.SHEETS.PAGES, "sort_order");
  const options = medicalOfficialReadObjects_(ss, AVA_MEDICAL.SHEETS.OPTIONS, "sort_order");
  const plans = medicalOfficialReadObjects_(ss, AVA_MEDICAL.SHEETS.PLANS, "sort_order");
  const claimRules = medicalOfficialReadObjects_(ss, AVA_MEDICAL.SHEETS.CLAIM_RULES, "sort_order");
  const claimCases = medicalOfficialReadObjects_(ss, AVA_MEDICAL.SHEETS.CLAIM_CASES, "sort_order");
  const premiumSettings = medicalOfficialReadObjects_(ss, AVA_MEDICAL.SHEETS.PREMIUM_SETTINGS, "sort_order");
  const premiumTables = readPremiumTables_(ss) || {};
  const adminDatasets = { pages, options, plans, claimRules, claimCases, premiumSettings, config: medicalOfficialConfigRows_(config) };
  const payload = { pages, options, plans, claimRules, claimCases, premiumSettings, premiumTables, config, adminDatasets };
  const version = String(config.data_version || AVA_MEDICAL.SCHEMA_VERSION || "unknown");
  return Object.assign({ success: true, version, revision: medicalOfficialRevision_(payload) }, payload);
}

function medicalOfficialDataAction_(body) {
  if (body.action !== "updateOfficialRecord") throw new Error("Unsupported Medical Official action");
  if (String(body.appId || "") !== MEDICAL_ADMIN_APP_ID) throw new Error("Invalid Medical App ID");
  const hasAdminSessionProof = Boolean(String(body.adminSessionProof || ""));
  const hasAppGrant = Boolean(String(body.appGrant || ""));
  if (hasAdminSessionProof === hasAppGrant) throw new Error("Exactly one Medical Admin credential is required");
  const operation = String(body.operation || "");
  if (operation && operation !== "medical:official-write") throw new Error("Invalid Medical Official operation");
  if (hasAdminSessionProof) {
    medicalVerifyAdminSession_(body.adminSessionProof, "official-write");
  } else {
    if (operation !== "medical:official-write") throw new Error("Invalid Medical Official operation");
    medicalVerifyAppGrant_(body.appGrant, operation);
  }
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
    const sheet = medicalSheet_(definition.sheet), values = sheet.getDataRange().getValues();
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
  } finally {
    lock.releaseLock();
  }
}

function medicalOfficialValidateValue_(field, value, type) {
  if (value !== null && typeof value === "object") throw new Error("Official value must be scalar");
  if (type === "number" && (typeof value !== "number" || !isFinite(value))) throw new Error("Official field must be numeric: " + field);
  if (type === "boolean" && typeof value !== "boolean") throw new Error("Official field must be boolean: " + field);
}

function medicalOfficialRecordId_(row, ids) {
  for (const id of ids) if (row && row[id] !== undefined && row[id] !== "") return row[id];
  return "";
}

function medicalOfficialRow_(headers, row) {
  return headers.reduce((out, header, index) => { out[header] = normalizeValue_(row[index]); return out; }, {});
}

/** Legacy bulk writes are rejected before any writer or compatibility branch. */
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
