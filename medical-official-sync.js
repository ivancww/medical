(function (global) {
  "use strict";
  const API = global.MedicalAdminAuth?.OFFICIAL_API || "";
  const DATASETS = Object.freeze([
    { key: "pages", label: "Pages", id: ["page_id"], fields: ["page_name", "title", "subtitle", "enabled", "sort_order", "highlight_text"] },
    { key: "options", label: "Options", id: ["option_id"], fields: ["display_name", "subtitle", "reflection_text", "enabled", "sort_order"] },
    { key: "plans", label: "Plans / Features", id: ["record_id"], fields: ["plan_name", "category", "title", "description", "brochure_url", "enabled", "sort_order"] },
    { key: "claimRules", label: "Claim Rules", id: ["plan_id"], fields: ["plan_name", "default_rate", "deductible_enabled", "note"] },
    { key: "claimCases", label: "Claim Cases", id: ["case_id"], fields: ["case_title", "condition_name", "treatment_name", "medical_cost", "actual_reimbursement", "case_date", "source_type", "source_url", "verified", "enabled", "sort_order"] },
    { key: "premiumSettings", label: "Premium Settings", id: ["setting_id"], fields: ["title", "description", "value", "start_date", "end_date", "enabled", "sort_order"] },
    { key: "config", label: "Configuration", id: ["config_key"], fields: ["config_value", "description"] }
  ]);
  const READ_ONLY = Object.freeze(["premiumTables", "premium_tables"]);
  function definition(key) { return DATASETS.find(x => x.key === key) || null; }
  function rows(official, key) { const value = official?.adminDatasets?.[key] ?? official?.[key]; if (Array.isArray(value)) return value; if (value && typeof value === "object") return Object.entries(value).map(([id, record]) => ({ id, ...(record || {}) })); return []; }
  function recordId(record, def) { return def.id.map(key => record?.[key]).find(value => value !== undefined && value !== null && String(value) !== "") ?? ""; }
  function editableFields(record, def) { return def.fields.filter(field => Object.prototype.hasOwnProperty.call(record || {}, field)); }
  function esc(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  async function jsonFetch(url, options) { const response = await fetch(url, options); const payload = await response.json().catch(() => ({})); if (!response.ok || payload.success === false || payload.status === "error") throw new Error(payload.message || `HTTP ${response.status}`); return payload; }
  function valueForEdit(value) { return typeof value === "object" ? JSON.stringify(value) : String(value ?? ""); }
  function parseValue(original, value) { if (typeof original === "boolean") return /^(true|1|yes)$/i.test(value.trim()); if (typeof original === "number") { const number = Number(value); if (!Number.isFinite(number)) throw new Error("數值格式不正確"); return number; } return value; }
  function setMessage(panel, message, cls = "helper") { const node = panel.querySelector("[data-sync-message]"); if (node) { node.textContent = message; node.className = cls; } }
  function mount({ state, panel, onOfficialChanged }) {
    if (!panel) return;
    let selected = DATASETS[0].key;
    panel.innerHTML = `<div class="official-sync-head"><div><p class="eyebrow">OFFICIAL DATA</p><h3>Google Sheet ↔ Medical Admin</h3><p data-sync-message class="helper">只顯示 Medical Official Layer；User Override 不會出現在這裡。</p></div><label>資料集<select data-sync-dataset>${DATASETS.map(x => `<option value="${x.key}">${x.label}</option>`).join("")}</select></label></div><div data-sync-records></div>`;
    const select = panel.querySelector("[data-sync-dataset]"), records = panel.querySelector("[data-sync-records]");
    function render() {
      selected = select.value; const def = definition(selected), data = rows(state.official, selected); if (!data.length) { records.innerHTML = `<div class="empty-official"><strong>此 Official dataset 目前為空</strong><p>不會以假資料填充。請先確認 Google Sheet 是否有已發布資料。</p></div>`; return; }
      records.innerHTML = data.map((record, index) => { const id = recordId(record, def), fields = editableFields(record, def); if (!id || !fields.length) return `<article class="sync-record"><strong>${esc(id || `Record ${index + 1}`)}</strong><p class="helper">此列沒有可安全編輯的 Official 欄位，維持 read-only。</p></article>`; return `<article class="sync-record" data-record-index="${index}"><div class="sync-record-head"><strong>${esc(id)}</strong><span class="helper">Official · ${esc(selected)}</span></div><div class="form-grid">${fields.map(field => `<label>${esc(field)}<input data-field="${esc(field)}" value="${esc(valueForEdit(record[field]))}"></label>`).join("")}</div><div class="nav-actions"><button type="button" class="ava-button" data-save-record>Validate &amp; Save Official</button></div></article>`; }).join("");
      records.querySelectorAll("[data-save-record]").forEach(button => button.onclick = () => saveRecord(button));
    }
    async function saveRecord(button) {
      if (!global.MedicalAdminAuth?.hasSession()) { setMessage(panel, "Permission Error：AVA Admin session proof 不存在。", "error"); return; }
      const article = button.closest("[data-record-index]"), index = Number(article.dataset.recordIndex), def = definition(selected), source = rows(state.official, selected)[index], changes = {};
      try {
        article.querySelectorAll("[data-field]").forEach(input => { const field = input.dataset.field, next = parseValue(source[field], input.value); if (JSON.stringify(next) !== JSON.stringify(source[field])) changes[field] = next; });
        if (!Object.keys(changes).length) { setMessage(panel, "沒有未儲存變更。", "helper"); return; }
        button.disabled = true; button.textContent = "Saving…"; setMessage(panel, "Saving：正在由 Medical GAS 驗證並寫入 Google Sheet…");
        const result = await global.MedicalAdminAuth.authorizedRequest({ action: "updateOfficialRecord", operation: "medical:official-write", body: { dataset: selected, recordId: String(recordId(source, def)), changes, expectedVersion: state.official?.revision || state.official?.version } });
        const next = result.data || result.official; if (next) { state.official = next; onOfficialChanged?.(next); }
        setMessage(panel, `Saved / Synced：Google Sheet 已回讀確認（version ${result.version || state.official?.version || "—"}）。`, "success"); render();
      } catch (error) { setMessage(panel, error.message.includes("version") || error.message.includes("stale") ? "Conflict / stale-data error：請先 Refresh Official Data。" : `Save failed：${error.message}`, "error"); button.disabled = false; button.textContent = "Validate & Save Official"; }
    }
    select.onchange = render; render(); return { render };
  }
  global.MedicalOfficialSync = Object.freeze({ API, DATASETS, READ_ONLY, rows, definition, recordId, mount });
})(typeof window === "undefined" ? globalThis : window);
