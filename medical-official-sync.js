(function (global) {
  "use strict";
  const API = global.MedicalAdminAuth?.OFFICIAL_API || "";
  const LABELS = Object.freeze({
    tabs: "官方資料設定",
    officialEyebrow: "AVA 管理中心 · 醫療",
    officialTitle: "官方資料設定",
    officialHelp: "只顯示 Medical 官方資料；使用者自訂內容不會出現在這裡。",
    emptyTitle: "此項資料目前為空",
    emptyHelp: "不會以假資料填充。請先確認 Google Sheet 是否有已發布資料。",
    readOnly: "此筆資料沒有可安全編輯的欄位，維持唯讀。",
    record: "記錄",
    official: "官方資料",
    save: "驗證並儲存官方資料",
    saving: "儲存中…",
    noChanges: "沒有未儲存變更。",
    permission: "權限錯誤：AVA 管理驗證憑證不存在。",
    savingHelp: "正在由 Medical GAS 驗證並寫入 Google 試算表…",
    success: "已儲存並同步：Google 試算表已回讀確認（版本 {version}）。",
    conflict: "資料版本已過期，請先重新讀取官方資料。",
    failure: "儲存失敗：{message}",
    confirmation: "官方資料回應未能確認相同記錄、欄位及版本；未更新本機快取。",
    invalidNumber: "數值格式不正確",
    unsaved: "目前分頁有未儲存的變更。切換分頁會放棄這些變更，是否繼續？",
    unknownField: "資料欄位"
  });
  const FIELD_LABELS = Object.freeze({
    page_id: "頁面識別碼", page_name: "頁面名稱", title: "標題", subtitle: "副標題", enabled: "啟用狀態", sort_order: "排序", highlight_text: "重點文字",
    option_id: "選項識別碼", display_name: "顯示名稱", reflection_text: "反思文字", record_id: "記錄識別碼", plan_name: "計劃名稱", category: "分類", description: "說明", brochure_url: "產品資料連結",
    plan_id: "計劃識別碼", default_rate: "預設賠償比例", deductible_enabled: "啟用自付額", note: "備註", case_id: "個案識別碼", case_title: "個案標題", condition_name: "病症名稱", treatment_name: "治療名稱",
    medical_cost: "醫療費用", actual_reimbursement: "實際賠償", case_date: "個案日期", source_type: "資料來源類型", source_url: "資料來源連結", verified: "已核實", setting_id: "設定識別碼",
    value: "設定值", start_date: "開始日期", end_date: "結束日期", config_key: "設定鍵值", config_value: "設定內容"
  });
  const DATASETS = Object.freeze([
    { key: "pages", label: "頁面設定", id: ["page_id"], fields: ["page_name", "title", "subtitle", "enabled", "sort_order", "highlight_text"] },
    { key: "options", label: "選項設定", id: ["option_id"], fields: ["display_name", "subtitle", "reflection_text", "enabled", "sort_order"] },
    { key: "plans", label: "產品及保障", id: ["record_id"], fields: ["plan_name", "category", "title", "description", "brochure_url", "enabled", "sort_order"] },
    { key: "claimRules", label: "理賠規則", id: ["plan_id"], fields: ["plan_name", "default_rate", "deductible_enabled", "note"] },
    { key: "claimCases", label: "理賠案例", id: ["case_id"], fields: ["case_title", "condition_name", "treatment_name", "medical_cost", "actual_reimbursement", "case_date", "source_type", "source_url", "verified", "enabled", "sort_order"] },
    { key: "premiumSettings", label: "保費設定", id: ["setting_id"], fields: ["title", "description", "value", "start_date", "end_date", "enabled", "sort_order"] },
    { key: "config", label: "系統設定", id: ["config_key"], fields: ["config_value", "description"] }
  ]);
  const READ_ONLY = Object.freeze(["premiumTables", "premium_tables"]);
  function definition(key) { return DATASETS.find(x => x.key === key) || null; }
  function rows(official, key) { const value = official?.adminDatasets?.[key] ?? official?.[key]; if (Array.isArray(value)) return value; if (value && typeof value === "object") return Object.entries(value).map(([id, record]) => ({ id, ...(record || {}) })); return []; }
  function sameValue(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
  function validateMutationResult(result, { dataset, recordId: expectedRecordId, changes }) {
    if (!result || result.success !== true) throw new Error(LABELS.confirmation);
    if (String(result.dataset || "") !== String(dataset)) throw new Error("官方回應的資料分頁不一致。");
    if (String(result.recordId || "") !== String(expectedRecordId)) throw new Error("官方回應的記錄識別碼不一致。");
    const snapshot = result.data;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error(LABELS.confirmation);
    const revision = String(snapshot.revision || "");
    if (!/^[a-f0-9]{64}$/i.test(revision) || String(result.revision || "") !== revision) throw new Error("官方回應缺少有效資料版本。");
    const def = definition(dataset);
    const persisted = rows(snapshot, dataset).find(record => String(recordId(record, def)) === String(expectedRecordId));
    if (!persisted) throw new Error("官方回應未包含相同的已儲存記錄。");
    for (const [field, value] of Object.entries(changes || {})) {
      if (!sameValue(persisted[field], value)) throw new Error("官方回讀欄位與提交內容不一致：" + field);
    }
    return snapshot;
  }
  function recordId(record, def) { return def.id.map(key => record?.[key]).find(value => value !== undefined && value !== null && String(value) !== "") ?? ""; }
  function editableFields(record, def) { return def.fields.filter(field => Object.prototype.hasOwnProperty.call(record || {}, field)); }
  function fieldLabel(field) { return FIELD_LABELS[field] || LABELS.unknownField; }
  function esc(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  async function jsonFetch(url, options) { const response = await fetch(url, options); const payload = await response.json().catch(() => ({})); if (!response.ok || payload.success === false || payload.status === "error") throw new Error(payload.message || `HTTP ${response.status}`); return payload; }
  function valueForEdit(value) { return typeof value === "object" ? JSON.stringify(value) : String(value ?? ""); }
  function parseValue(original, value) { if (typeof original === "boolean") return /^(true|1|yes)$/i.test(value.trim()); if (typeof original === "number") { const number = Number(value); if (!Number.isFinite(number)) throw new Error(LABELS.invalidNumber); return number; } return value; }
  function setMessage(panel, message, cls = "helper") { const node = panel.querySelector("[data-sync-message]"); if (node) { node.textContent = message; node.className = cls; } }
  function hasUnsavedChanges(records, selected, official) {
    const def = definition(selected), sourceRows = rows(official, selected);
    return [...records.querySelectorAll("[data-record-index]")].some(article => {
      const source = sourceRows[Number(article.dataset.recordIndex)] || {};
      return [...article.querySelectorAll("[data-field]")].some(input => {
        const field = input.dataset.field;
        try { return JSON.stringify(parseValue(source[field], input.value)) !== JSON.stringify(source[field]); } catch (_) { return true; }
      });
    });
  }
  function mount({ state, panel, onOfficialChanged }) {
    if (!panel) return;
    let selected = DATASETS[0].key;
    panel.innerHTML = `<div class="official-sync-head"><div><p class="eyebrow">${LABELS.officialEyebrow}</p><h3>${LABELS.officialTitle}</h3><p data-sync-message class="helper" role="status">${LABELS.officialHelp}</p></div></div><div class="admin-tabs" data-sync-tabs role="tablist" aria-label="${LABELS.tabs}"></div><div class="admin-tab-panel" data-sync-records role="tabpanel" tabindex="0"></div>`;
    const tabs = panel.querySelector("[data-sync-tabs]"), records = panel.querySelector("[data-sync-records]");
    function renderTabs() {
      tabs.innerHTML = DATASETS.map(dataset => {
        const active = dataset.key === selected, count = rows(state.official, dataset.key).length, panelId = `medical-dataset-panel-${dataset.key}`;
        return `<button id="medical-dataset-tab-${dataset.key}" type="button" class="admin-tab${active ? " is-active" : ""}" role="tab" aria-selected="${active}" aria-controls="${panelId}" tabindex="${active ? "0" : "-1"}" data-dataset-tab="${dataset.key}">${dataset.label}<span class="admin-tab-count" aria-label="${count} 筆">${count}</span></button>`;
      }).join("");
      function selectDataset(next) {
        if (next === selected) return;
        if (hasUnsavedChanges(records, selected, state.official)) {
          const canDiscard = typeof global.confirm === "function" && global.confirm(LABELS.unsaved);
          if (!canDiscard) return;
        }
        selected = next;
        render();
        tabs.querySelector(`[data-dataset-tab="${selected}"]`)?.focus();
      }
      tabs.querySelectorAll("[data-dataset-tab]").forEach((tab, index) => {
        tab.onclick = () => selectDataset(tab.dataset.datasetTab);
        tab.onkeydown = event => {
          const last = DATASETS.length - 1;
          let nextIndex = index;
          if (event.key === "ArrowRight") nextIndex = index === last ? 0 : index + 1;
          if (event.key === "ArrowLeft") nextIndex = index === 0 ? last : index - 1;
          if (event.key === "Home") nextIndex = 0;
          if (event.key === "End") nextIndex = last;
          if (nextIndex !== index) { event.preventDefault(); selectDataset(DATASETS[nextIndex].key); }
        };
      });
    }
    function renderRecords() {
      const def = definition(selected), data = rows(state.official, selected), panelId = `medical-dataset-panel-${selected}`;
      records.id = panelId;
      records.setAttribute("aria-labelledby", `medical-dataset-tab-${selected}`);
      if (!data.length) { records.innerHTML = `<div class="empty-official"><strong>${LABELS.emptyTitle}</strong><p>${LABELS.emptyHelp}</p></div>`; return; }
      records.innerHTML = data.map((record, index) => {
        const id = recordId(record, def), fields = editableFields(record, def);
        if (!id || !fields.length) return `<article class="sync-record"><strong>${esc(id || `${LABELS.record} ${index + 1}`)}</strong><p class="helper">${LABELS.readOnly}</p></article>`;
        return `<article class="sync-record" data-record-index="${index}"><div class="sync-record-head"><strong>${esc(id)}</strong><span class="helper">${LABELS.official} · ${def.label}</span></div><div class="form-grid">${fields.map(field => `<label>${fieldLabel(field)}<input data-field="${field}" aria-label="${fieldLabel(field)}" value="${esc(valueForEdit(record[field]))}"></label>`).join("")}</div><div class="nav-actions"><button type="button" class="ava-button" data-save-record>${LABELS.save}</button></div></article>`;
      }).join("");
      records.querySelectorAll("[data-save-record]").forEach(button => button.onclick = () => saveRecord(button));
    }
    function render() { renderTabs(); renderRecords(); }
    async function saveRecord(button) {
      if (!global.MedicalAdminAuth?.hasSession()) { setMessage(panel, LABELS.permission, "error"); return; }
      const article = button.closest("[data-record-index]"), index = Number(article.dataset.recordIndex), def = definition(selected), source = rows(state.official, selected)[index], changes = {};
      try {
        article.querySelectorAll("[data-field]").forEach(input => { const field = input.dataset.field, next = parseValue(source[field], input.value); if (JSON.stringify(next) !== JSON.stringify(source[field])) changes[field] = next; });
        if (!Object.keys(changes).length) { setMessage(panel, LABELS.noChanges); return; }
        button.disabled = true; button.textContent = LABELS.saving; setMessage(panel, LABELS.savingHelp);
        const expectedRecordId = String(recordId(source, def));
        const result = await global.MedicalAdminAuth.authorizedRequest({ action: "updateOfficialRecord", operation: "medical:official-write", body: { dataset: selected, recordId: expectedRecordId, changes, expectedVersion: state.official?.revision || state.official?.version } });
        const next = validateMutationResult(result, { dataset: selected, recordId: expectedRecordId, changes });
        state.official = next;
        onOfficialChanged?.(next);
        render(); setMessage(panel, LABELS.success.replace("{version}", result.version || next.version || "—"), "success");
      } catch (error) { const message = error.message.includes("version") || error.message.includes("stale") ? LABELS.conflict : LABELS.failure.replace("{message}", error.message); setMessage(panel, message, "error"); button.disabled = false; button.textContent = LABELS.save; }
    }
    render();
    return { render, select: key => { if (definition(key)) { selected = key; render(); } } };
  }
  global.MedicalOfficialSync = Object.freeze({ API, LABELS, FIELD_LABELS, DATASETS, READ_ONLY, rows, definition, recordId, validateMutationResult, mount });
})(typeof window === "undefined" ? globalThis : window);
