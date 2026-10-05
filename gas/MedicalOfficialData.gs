/** Medical-owned Official Sheet mutation contract. Merge its action branch
 * into the existing Medical GAS doPost handler; do not replace that project. */
const MEDICAL_OFFICIAL_DATASETS = Object.freeze({
  pages: { sheet: "Pages", ids: ["page_id", "pageId", "id"], fields: ["title", "subtitle", "description", "enabled", "sort_order"] },
  options: { sheet: "Options", ids: ["option_id", "optionKey", "id"], fields: ["display_name", "title", "subtitle", "description", "reflection_text", "enabled", "sort_order"] },
  plans: { sheet: "Plans", ids: ["plan_id", "id"], fields: ["plan_name", "title", "description", "enabled", "sort_order"] },
  claimRules: { sheet: "Claim_Rules", ids: ["rule_id", "claim_rule_id", "plan_id", "id"], fields: ["display_name", "description", "enabled", "default_rate", "max_benefit", "room_level", "follow_up_limit"] },
  claimCases: { sheet: "Claim_Cases", ids: ["case_id", "claim_case_id", "id"], fields: ["case_title", "condition_name", "treatment_name", "case_date", "medical_cost", "actual_reimbursement", "notes", "enabled", "verified"] },
  premiumSettings: { sheet: "Premium_Settings", ids: ["setting_id", "key", "id"], fields: ["value", "enabled", "description"] },
  config: { sheet: "Config", ids: ["key", "config_key", "id"], fields: ["value", "enabled", "description"] }
});
function medicalOfficialDataAction_(body) {
  if (body.action !== "updateOfficialRecord") throw new Error("Unsupported Medical Official action");
  if (String(body.appId || "") !== String(MEDICAL_ADMIN_APP_ID)) throw new Error("Invalid Medical App ID");
  medicalVerifyAppGrant_(body.appGrant, "official-write");
  return medicalUpdateOfficialRecord_(body);
}
function medicalUpdateOfficialRecord_(body) {
  const definition = MEDICAL_OFFICIAL_DATASETS[String(body.dataset || "")], changes = body.changes;
  if (!definition) throw new Error("Unsupported Medical Official dataset");
  if (!changes || typeof changes !== "object" || Array.isArray(changes) || !Object.keys(changes).length) throw new Error("No Official changes supplied");
  Object.keys(changes).forEach(field => { if (!definition.fields.includes(field)) throw new Error("Official field is read-only or unsupported: " + field); });
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const snapshot = medicalOfficialReadSnapshot_();
    if (String(body.expectedVersion || "") !== String(snapshot.version || "")) throw new Error("Stale Official version; refresh before saving");
    const record = (snapshot.datasets?.[body.dataset] || []).find(row => String(medicalOfficialRecordId_(row, definition.ids)) === String(body.recordId || ""));
    if (!record) throw new Error("Official record not found");
    const sheet = medicalOfficialSheet_(definition.sheet), values = sheet.getDataRange().getValues();
    if (values.length < 2) throw new Error("Official sheet has no data rows");
    const headers = values[0].map(String), rowIndex = values.findIndex((row, index) => index > 0 && String(medicalOfficialRecordId_(medicalOfficialRow_(headers, row), definition.ids)) === String(body.recordId || ""));
    if (rowIndex < 1) throw new Error("Official record row not found");
    Object.entries(changes).forEach(([field, value]) => { const column = headers.indexOf(field); if (column < 0) throw new Error("Official field is absent from Sheet: " + field); sheet.getRange(rowIndex + 1, column + 1).setValue(value); });
    medicalOfficialBumpVersion_(); const persisted = medicalOfficialReadSnapshot_();
    return { success: true, dataset: body.dataset, recordId: String(body.recordId), version: persisted.version, data: persisted.payload };
  } finally { lock.releaseLock(); }
}
function medicalOfficialRecordId_(row, ids) { for (const id of ids) if (row && row[id] !== undefined && row[id] !== "") return row[id]; return ""; }
function medicalOfficialRow_(headers, row) { return headers.reduce((out, header, index) => { out[header] = row[index]; return out; }, {}); }
function medicalOfficialSheet_(name) { const id = PropertiesService.getScriptProperties().getProperty("MEDICAL_OFFICIAL_SPREADSHEET_ID"); if (!id) throw new Error("Medical Official Sheet is not configured"); const sheet = SpreadsheetApp.openById(id).getSheetByName(name); if (!sheet) throw new Error("Medical Official sheet tab not found: " + name); return sheet; }
function medicalOfficialBumpVersion_() { const props = PropertiesService.getScriptProperties(); props.setProperty("MEDICAL_OFFICIAL_REVISION", String(Number(props.getProperty("MEDICAL_OFFICIAL_REVISION") || 0) + 1)); }
/** Wire this adapter to the existing canonical read/normalization path before deployment. */
function medicalOfficialReadSnapshot_() { throw new Error("Medical Official read adapter is not wired"); }
