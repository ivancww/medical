(function (global) {
  "use strict";
  const API = global.MedicalAdminAuth?.OFFICIAL_API || "";
  const LABELS = Object.freeze({
    tabs: "Medical 官方資料設定", officialEyebrow: "Medical Official Data", officialTitle: "官方資料設定",
    officialHelp: "只顯示 Medical 官方資料；使用者自訂內容不會出現在這裡。", emptyTitle: "此項資料目前為空",
    emptyHelp: "不會以假資料填充。請先確認 Google Sheet 是否有已發布資料。", readOnly: "此筆資料沒有可安全編輯的欄位，維持唯讀。",
    record: "記錄", official: "官方資料", selectRecord: "選擇記錄", selectedRecord: "目前記錄",
    save: "驗證並儲存官方資料", saving: "儲存中…", noChanges: "沒有未儲存變更。", permission: "權限錯誤：AVA 管理驗證憑證不存在。",
    savingHelp: "正在由 Medical GAS 驗證並寫入 Google 試算表…", success: "已儲存並同步：Google 試算表已回讀確認（版本 {version}）。",
    conflict: "資料版本已過期，請先重新讀取官方資料。", failure: "儲存失敗：{message}",
    confirmation: "官方資料回應未能確認相同記錄、欄位及版本；未更新本機快取。", invalidNumber: "數值格式不正確",
    invalidObject: "資料格式不正確，請保留原有資料格式。", unsaved: "目前記錄有未儲存的變更。切換分頁或記錄會放棄這些變更，是否繼續？",
    unknownField: "資料欄位"
  });
  const FIELD_LABELS = Object.freeze({
    page_id: "頁面識別碼", page_name: "頁面名稱", title: "標題", subtitle: "副標題", enabled: "啟用狀態", sort_order: "排序", highlight_text: "重點文字",
    option_id: "選項識別碼", display_name: "顯示名稱", reflection_text: "反思文字", record_id: "記錄識別碼", plan_name: "計劃名稱", category: "分類", description: "說明", brochure_url: "產品資料連結",
    plan_id: "計劃識別碼", default_rate: "預設賠償比例", deductible_enabled: "啟用自付額", note: "備註", case_id: "個案識別碼", case_title: "個案標題", condition_name: "病症名稱", treatment_name: "治療名稱",
    medical_cost: "醫療費用", actual_reimbursement: "實際賠償", case_date: "個案日期", source_type: "資料來源類型", source_name: "資料來源名稱", source_url: "資料來源連結", verified: "已核實", setting_id: "設定識別碼",
    value: "設定值", start_date: "開始日期", end_date: "結束日期", config_key: "設定鍵值", config_value: "設定內容",
    comparison_id: "比較記錄識別碼", item_key: "保障項目鍵值", item_name: "保障項目名稱", condition_state: "條件狀態", main_value: "主要保障值", sub_value: "補充說明", sort_order: "排序", notes: "內部備註"
  });
  const DATASETS = Object.freeze([
    { key: "pages", label: "頁面設定", description: "管理 Ready 及 Not Ready 流程頁面的內容與啟用狀態。", id: ["page_id"], fields: ["page_name", "title", "subtitle", "enabled", "sort_order", "highlight_text"] },
    { key: "options", label: "選項設定", description: "管理各個 Medical 流程所使用的選項及反思文字。", id: ["option_id"], fields: ["display_name", "subtitle", "reflection_text", "enabled", "sort_order"] },
    { key: "plans", label: "產品及保障", description: "管理前台展示的醫療計劃、保障說明及產品連結。", id: ["record_id"], fields: ["plan_name", "category", "title", "description", "brochure_url", "enabled", "sort_order"] },
    { key: "claimRules", label: "理賠規則", description: "管理客戶展示用的理賠說明規則；詳細計算邏輯仍由 Medical 引擎負責。", id: ["plan_id"], fields: ["plan_name", "default_rate", "deductible_enabled", "note"] },
    { key: "claimCases", label: "理賠案例", description: "管理已核實的醫療費用、實際賠償及案例展示資料。", id: ["case_id"], fields: ["case_title", "condition_name", "treatment_name", "medical_cost", "actual_reimbursement", "case_date", "source_type", "source_url", "verified", "enabled", "sort_order"] },
    { key: "premiumSettings", label: "保費設定", description: "管理官方保費設定及其生效期間；保費表仍維持唯讀。", id: ["setting_id"], fields: ["title", "description", "value", "start_date", "end_date", "enabled", "sort_order"] },
    { key: "planComparison", label: "P7 保障比較", description: "管理 P7 保障比較資料；Official Sheet 以啟用狀態及可顯示內容控制發布，已核實狀態只作治理資料。", id: ["comparison_id"], fields: ["item_key", "item_name", "plan_id", "condition_state", "main_value", "sub_value", "enabled", "sort_order", "source_name", "source_url", "verified", "notes"] },
    { key: "config", label: "系統設定", description: "管理 Medical 官方設定鍵值；授權與技術資訊只在底部系統資料顯示。", id: ["config_key"], fields: ["config_value", "description"] }
  ]);
  const READ_ONLY = Object.freeze(["premiumTables", "premium_tables"]);
  const TEXTAREA_FIELDS = new Set(["subtitle", "reflection_text", "description", "highlight_text", "note", "config_value", "main_value", "sub_value", "source_name", "notes"]);
  const SELECT_FIELDS = new Set(["source_type"]);
  function definition(key) { return DATASETS.find(item => item.key === key) || null; }
  function rows(official, key) { const value = official?.adminDatasets?.[key] ?? official?.[key]; if (Array.isArray(value)) return value; if (value && typeof value === "object") return Object.entries(value).map(([id, record]) => ({ id, ...(record || {}) })); return []; }
  function sameValue(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
  function recordId(record, def) { return def.id.map(key => record?.[key]).find(value => value !== undefined && value !== null && String(value) !== "") ?? ""; }
  function editableFields(record, def) { return def.fields.filter(field => Object.prototype.hasOwnProperty.call(record || {}, field)); }
  function fieldLabel(field) { return FIELD_LABELS[field] || LABELS.unknownField; }
  function esc(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); }
  function valueForEdit(value) { return value !== null && typeof value === "object" ? JSON.stringify(value) : String(value ?? ""); }
  function parseValue(original, value) {
    if (typeof original === "boolean") return Boolean(value);
    if (typeof original === "number") { const number = Number(value); if (!Number.isFinite(number)) throw new Error(LABELS.invalidNumber); return number; }
    if (original !== null && typeof original === "object") { try { return JSON.parse(value); } catch (_) { throw new Error(LABELS.invalidObject); } }
    return value;
  }
  function readControl(control, original) { return control.dataset.fieldType === "checkbox" ? control.checked : parseValue(original, control.value); }
  function humanRecordLabel(record, def) { const keys = ["page_name", "display_name", "plan_name", "title", "case_title", "setting_id", "config_key"]; return keys.map(key => record?.[key]).find(value => value !== undefined && value !== null && String(value) !== "") || recordId(record, def) || LABELS.record; }
  function observedOptions(field, data, value) { return [...new Set(data.map(record => record?.[field]).filter(item => item !== undefined && item !== null && item !== "").map(String).concat(String(value ?? "")))].filter(Boolean); }
  function controlType(field, original) { if (typeof original === "boolean") return "checkbox"; if (typeof original === "number") return "number"; if (SELECT_FIELDS.has(field)) return "select"; if (TEXTAREA_FIELDS.has(field)) return "textarea"; return "text"; }
  function renderField(field, record, data) {
    const original = record[field], type = controlType(field, original), label = fieldLabel(field), value = valueForEdit(original);
    if (type === "checkbox") return '<label class="admin-field admin-field--checkbox"><span>' + label + '</span><input type="checkbox" data-field="' + esc(field) + '" data-field-type="checkbox" aria-label="' + esc(label) + '" ' + (original === true ? "checked" : "") + '></label>';
    if (type === "select") return '<label class="admin-field"><span>' + label + '</span><select class="ava-input" data-field="' + esc(field) + '" data-field-type="select" aria-label="' + esc(label) + '" >' + observedOptions(field, data, original).map(option => '<option value="' + esc(option) + '" ' + (String(option) === String(value) ? "selected" : "") + '>' + esc(option) + '</option>').join("") + '</select></label>';
    if (type === "textarea") return '<label class="admin-field"><span>' + label + '</span><textarea class="ava-input" data-field="' + esc(field) + '" data-field-type="textarea" aria-label="' + esc(label) + '">' + esc(value) + '</textarea></label>';
    return '<label class="admin-field"><span>' + label + '</span><input class="ava-input" type="' + (type === "number" ? "number" : "text") + '" data-field="' + esc(field) + '" data-field-type="' + type + '" aria-label="' + esc(label) + '" value="' + esc(value) + '"></label>';
  }
  function isPlanRecord(record) { return String(record?.record_type || "").toUpperCase() === "PLAN"; }
  const BROCHURE_PLAN_ALIASES = Object.freeze({ ELITE: "ELITE", ELITE_PLAN: "ELITE", WISE: "WISE", WISE_PLAN: "WISE", FLEXI: "FLEXI", FLEXI_PLAN: "FLEXI" });
  const BROCHURE_ALLOWED_TYPES = Object.freeze(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  const BROCHURE_MAX_BYTES = 20 * 1024 * 1024;
  const pendingBrochureUploads = new Map();
  function canonicalPlanId(record, def = definition("plans")) { if (!isPlanRecord(record)) return null; const stableId = String(recordId(record, def) || "").trim().toUpperCase(); return BROCHURE_PLAN_ALIASES[stableId] || null; }
  function brochureFileTypeLabel(type) { return ({ "application/pdf": "PDF", "image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP" })[String(type || "").toLowerCase()] || String(type || "檔案"); }
  function brochureFileSizeLabel(bytes) { const size = Number(bytes); if (!Number.isFinite(size) || size < 0) return "—"; if (size < 1024 * 1024) return Math.max(1, Math.round(size / 1024)) + " KB"; return (size / (1024 * 1024)).toFixed(1).replace(/\.0$/, "") + " MB"; }
  function validateBrochureFile(file) {
    if (!file || typeof file !== "object") throw new Error("請先選擇產品資料檔案。");
    const type = String(file.type || "").toLowerCase(), size = Number(file.size);
    if (!BROCHURE_ALLOWED_TYPES.includes(type)) throw new Error("不支援此檔案格式；只接受 PDF、JPEG、PNG 或 WEBP。");
    if (!Number.isFinite(size) || size <= 0 || size > BROCHURE_MAX_BYTES) throw new Error("檔案超過 20MB 上限或大小無效。");
    return { name: String(file.name || "brochure"), type, size };
  }
  function makePendingBrochureUpload(record, file, def = definition("plans")) {
    const metadata = validateBrochureFile(file), planId = canonicalPlanId(record, def), id = String(recordId(record, def));
    if (!planId || !id) throw new Error("只有 ELITE、WISE、FLEXI 計劃可以上載產品資料。");
    return { recordId: id, canonicalPlanId: planId, file, metadata };
  }
  function brochureUploadMarkup(dataset, record, pending) {
    if (dataset !== "plans" || !isPlanRecord(record)) return "";
    const id = String(recordId(record, definition("plans"))), current = String(record?.brochure_url || "").trim(), file = pending?.file, metadata = file ? validateBrochureFile(file) : null;
    const selected = metadata ? '<div class="admin-brochure-selection" data-brochure-selection><strong>已選擇：</strong> ' + esc(metadata.name) + '<small>' + brochureFileTypeLabel(metadata.type) + ' · ' + brochureFileSizeLabel(metadata.size) + '</small></div>' : '<div class="admin-brochure-selection" data-brochure-selection hidden></div>';
    return '<section class="admin-brochure-media" data-brochure-media data-brochure-record-id="' + esc(id) + '"><h3>產品資料</h3><p class="helper">只會先上載至 Medical / CI Firebase，再以 authenticated Official write 發布連結；Google Sheet 只保存 URL。</p><label class="ava-button upload">選擇 PDF / 圖片<input type="file" data-brochure-file accept="application/pdf,image/jpeg,image/png,image/webp" hidden></label>' + selected + '<span class="admin-brochure-current">目前檔案：' + (current ? '<a href="' + esc(current) + '" target="_blank" rel="noopener noreferrer">已發布產品資料</a>' : '未有') + '</span><button type="button" class="ava-button ava-button--secondary" data-brochure-upload ' + (metadata ? '' : 'disabled') + '>上載／取代產品資料</button><button type="button" class="ava-button ava-button--secondary" data-brochure-cancel ' + (metadata ? '' : 'hidden') + '>取消</button><p class="helper" data-brochure-status role="status" aria-live="polite"></p></section>';
  }
  function renderRecord(dataset, record, index, selectedIndex, data) {
    const def = definition(dataset), id = recordId(record, def), editable = editableFields(record, def), fields = dataset === "plans" ? editable.filter(field => field !== "brochure_url") : editable, known = new Set([...def.id, ...def.fields]), unknown = Object.keys(record || {}).filter(key => !known.has(key)), label = humanRecordLabel(record, def);
    if (!id || !fields.length) return '<article class="sync-record" data-record-index="' + index + '" ' + (index === selectedIndex ? "" : "hidden") + '><div class="sync-record-head"><div><span class="eyebrow">' + esc(id || (LABELS.record + " " + (index + 1))) + '</span><strong>' + esc(label) + '</strong></div><span class="helper">' + LABELS.official + ' · 唯讀</span></div><p class="helper">' + LABELS.readOnly + '</p></article>';
    const extra = unknown.length ? '<details class="admin-extra"><summary>其他欄位已保留（' + unknown.length + ' 項）</summary><p class="helper">' + esc(unknown.join("、")) + ' 不在此編輯器修改；儲存時會原樣保留。</p></details>' : "";
    const isVerified = record?.verified === true || String(record?.verified).toUpperCase() === "TRUE";
    const isEnabled = record?.enabled === true || String(record?.enabled).toUpperCase() === "TRUE";
    const verification = dataset === "planComparison" ? '<span class="comparison-verification ' + (isVerified && isEnabled ? 'comparison-verification--verified' : 'comparison-verification--unverified') + '">' + (isVerified ? (isEnabled ? '已核實 · 已啟用' : '已核實 · 未啟用') : '未核實') + '</span>' : '';
    return '<article class="sync-record" data-record-index="' + index + '" ' + (index === selectedIndex ? "" : "hidden") + '><div class="sync-record-head"><div><span class="eyebrow">' + esc(id) + '</span><strong>' + esc(label) + '</strong></div><span class="helper">' + esc(def.label) + ' ' + verification + '</span></div><div class="form-grid admin-field-grid">' + fields.map(field => renderField(field, record, data)).join("") + '</div>' + brochureUploadMarkup(dataset, record, pendingBrochureUploads.get(String(id))) + extra + '<div class="nav-actions admin-record-actions"><button type="button" class="ava-button ava-button--primary" data-save-record>' + LABELS.save + '</button></div></article>';
  }
  function validateMutationResult(result, context) {
    const dataset = context.dataset, expectedRecordId = context.recordId, changes = context.changes;
    if (!result || result.success !== true) throw new Error(LABELS.confirmation);
    if (String(result.dataset || "") !== String(dataset)) throw new Error("官方回應的資料分頁不一致。");
    if (String(result.recordId || "") !== String(expectedRecordId)) throw new Error("官方回應的記錄識別碼不一致。");
    const snapshot = result.data;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error(LABELS.confirmation);
    const revision = String(snapshot.revision || "");
    if (!/^[a-f0-9]{64}$/i.test(revision) || String(result.revision || "") !== revision) throw new Error("官方回應缺少有效資料版本。");
    const def = definition(dataset), persisted = rows(snapshot, dataset).find(record => String(recordId(record, def)) === String(expectedRecordId));
    if (!persisted) throw new Error("官方回應未包含相同的已儲存記錄。");
    for (const [field, value] of Object.entries(changes || {})) if (!sameValue(persisted[field], value)) throw new Error("官方回讀欄位與提交內容不一致：" + field);
    return snapshot;
  }
  function setMessage(panel, message, cls) { const node = panel.querySelector("[data-sync-message]"); if (node) { node.textContent = message; node.className = cls || "helper"; } }
  function hasUnsavedChanges(panel, dataset, selectedIndex, official) {
    const source = rows(official, dataset)[selectedIndex] || {}, article = panel.querySelector('[data-sync-domain="' + dataset + '"] [data-record-index="' + selectedIndex + '"]');
    return [...(article?.querySelectorAll("[data-field]") || [])].some(control => { try { return !sameValue(readControl(control, source[control.dataset.field]), source[control.dataset.field]); } catch (_) { return true; } });
  }
  function mount({ state, panel, onOfficialChanged }) {
    if (!panel) return;
    let selected = DATASETS[0].key;
    const selectedRecords = Object.fromEntries(DATASETS.map(dataset => [dataset.key, 0]));
    panel.innerHTML = '<div class="official-sync-head"><div><p class="eyebrow">' + LABELS.officialEyebrow + '</p><h2>' + LABELS.officialTitle + '</h2><p data-sync-message class="helper" role="status" aria-live="polite">' + LABELS.officialHelp + '</p></div></div><div class="admin-tabs" data-sync-tabs role="tablist" aria-label="' + LABELS.tabs + '"></div><div class="admin-panels" data-sync-panels></div>';
    const tabs = panel.querySelector("[data-sync-tabs]"), panels = panel.querySelector("[data-sync-panels]");
    function planArticle(recordIdValue) {
      const index = rows(state.official, "plans").findIndex(record => String(recordId(record, definition("plans"))) === String(recordIdValue));
      return index < 0 ? null : panels.querySelector('[data-sync-domain="plans"] [data-record-index="' + index + '"]');
    }
    function setBrochureStatus(recordIdValue, message, className = "helper") {
      const article = planArticle(recordIdValue), status = article?.querySelector("[data-brochure-status]");
      if (status) { status.textContent = message; status.className = className; }
    }
    function resetUploadButton(button) {
      if (!button) return;
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = "上載／取代產品資料";
    }
    function selectBrochureFile(input) {
      const article = input.closest("[data-record-index]"), index = Number(article?.dataset.recordIndex), source = rows(state.official, "plans")[index], def = definition("plans"), recordIdValue = source ? String(recordId(source, def)) : "", file = input.files?.[0];
      if (!source || !recordIdValue || !file) return;
      try {
        const pending = makePendingBrochureUpload(source, file, def);
        pendingBrochureUploads.set(recordIdValue, pending);
        const metadata = pending.metadata;
        render();
        setBrochureStatus(recordIdValue, "已選擇：" + metadata.name, "success");
      } catch (error) {
        pendingBrochureUploads.delete(recordIdValue);
        render();
        setBrochureStatus(recordIdValue, error.message, "error");
      }
    }
    function cancelBrochureFile(recordIdValue) {
      pendingBrochureUploads.delete(String(recordIdValue));
      render();
      setBrochureStatus(recordIdValue, "已取消選取的產品資料。", "helper");
    }
    function switchDataset(next) {
      if (!definition(next) || next === selected) return;
      if (hasUnsavedChanges(panel, selected, selectedRecords[selected], state.official) && !(typeof global.confirm === "function" && global.confirm(LABELS.unsaved))) return;
      selected = next; render(); tabs.querySelector('[data-dataset-tab="' + selected + '"]')?.focus(); panels.querySelector('[data-sync-domain="' + selected + '"]')?.scrollIntoView?.({ block: "start", behavior: "auto" });
    }
    function switchRecord(dataset, next) {
      if (dataset !== selected) return;
      const index = Number(next), data = rows(state.official, dataset);
      if (!Number.isInteger(index) || index < 0 || index >= data.length || index === selectedRecords[dataset]) return;
      if (hasUnsavedChanges(panel, dataset, selectedRecords[dataset], state.official) && !(typeof global.confirm === "function" && global.confirm(LABELS.unsaved))) return;
      if (dataset === "plans") pendingBrochureUploads.clear();
      selectedRecords[dataset] = index; render(); panels.querySelector('[data-sync-domain="' + dataset + '"] [data-record-index="' + index + '"]')?.scrollIntoView?.({ block: "start", behavior: "auto" });
    }
    function renderTabs() {
      tabs.innerHTML = DATASETS.map(dataset => { const active = dataset.key === selected, count = rows(state.official, dataset.key).length, panelId = "medical-dataset-panel-" + dataset.key; return '<button id="medical-dataset-tab-' + dataset.key + '" type="button" class="admin-tab' + (active ? " is-active" : "") + '" role="tab" aria-selected="' + active + '" aria-controls="' + panelId + '" tabindex="' + (active ? "0" : "-1") + '" data-dataset-tab="' + dataset.key + '"><span>' + esc(dataset.label) + '</span><small aria-label="' + count + ' 筆">' + count + ' 筆</small></button>'; }).join("");
      tabs.querySelectorAll("[data-dataset-tab]").forEach((tab, index) => { tab.onclick = () => switchDataset(tab.dataset.datasetTab); tab.onkeydown = event => { const last = DATASETS.length - 1; let next = index; if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1; if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1; if (event.key === "Home") next = 0; if (event.key === "End") next = last; if (next !== index) { event.preventDefault(); switchDataset(DATASETS[next].key); } }; });
    }
    const comparisonFilters = { item_key: "", plan_id: "", condition_state: "" };
    function comparisonFilterOptions(field, data) {
      return [...new Set(data.map(record => record?.[field]).filter(value => value !== undefined && value !== null && String(value) !== "").map(String))].sort();
    }
    function comparisonFilterMatches(record) {
      return Object.entries(comparisonFilters).every(([field, value]) => !value || String(record?.[field] ?? "") === value);
    }
    function comparisonFiltersMarkup(data) {
      return '<div class="comparison-filter-tools" aria-label="P7 保障比較篩選"><span class="helper">篩選：</span>' + ["item_key", "plan_id", "condition_state"].map(field => '<label><span>' + esc(fieldLabel(field)) + '</span><select class="ava-input" data-comparison-filter="' + field + '"><option value="">全部</option>' + comparisonFilterOptions(field, data).map(value => '<option value="' + esc(value) + '" ' + (comparisonFilters[field] === value ? "selected" : "") + '>' + esc(value) + '</option>').join("") + '</select></label>').join("") + '</div>';
    }
    function comparisonCreateMarkup() {
      const fields = [['comparison_id','比較記錄識別碼','text'],['item_key','保障項目鍵值','text'],['item_name','保障項目名稱','text'],['plan_id','計劃識別碼','text'],['condition_state','條件狀態','text'],['main_value','主要保障值','textarea'],['sub_value','補充說明','textarea'],['enabled','啟用狀態','checkbox'],['sort_order','排序','number'],['source_name','資料來源名稱','textarea'],['source_url','資料來源連結','text'],['verified','已核實（治理資料）','checkbox'],['notes','內部備註','textarea']];
      return '<details class="comparison-create" data-comparison-create><summary>新增 P7 Official 比較記錄</summary><p class="helper">新增會使用 authenticated Official write，並在成功 read-after-write 後才更新本機資料。</p><div class="form-grid admin-field-grid">'+fields.map(([field,label,type])=>type==='checkbox'?'<label class="admin-field admin-field--checkbox"><span>'+label+'</span><input type="checkbox" data-create-field="'+field+'" '+(['enabled','verified'].includes(field)?'checked':'')+'></label>':'<label class="admin-field"><span>'+label+'</span>'+(type==='textarea'?'<textarea class="ava-input" data-create-field="'+field+'"></textarea>':'<input class="ava-input" type="'+type+'" data-create-field="'+field+'">')+'</label>').join('')+'</div><div class="nav-actions"><button type="button" class="ava-button ava-button--primary" data-create-comparison>建立並發布</button></div></details>';
    }
    function renderPanels() {
      panels.innerHTML = DATASETS.map(dataset => {
        const data = rows(state.official, dataset.key), active = dataset.key === selected;
        const entries = data.map((record, index) => ({ record, index })).filter(entry => dataset.key !== "planComparison" || comparisonFilterMatches(entry.record));
        const availableIndexes = entries.map(entry => entry.index);
        const selectedIndex = availableIndexes.includes(selectedRecords[dataset.key]) ? selectedRecords[dataset.key] : (availableIndexes[0] ?? -1);
        selectedRecords[dataset.key] = selectedIndex < 0 ? 0 : selectedIndex;
        const selector = entries.length ? '<div class="admin-record-tools"><label for="medical-record-select-' + dataset.key + '"><span>' + LABELS.selectRecord + '</span><select class="ava-input" id="medical-record-select-' + dataset.key + '" data-record-select="' + dataset.key + '">' + entries.map(entry => '<option value="' + entry.index + '" ' + (entry.index === selectedIndex ? "selected" : "") + '>' + esc(recordId(entry.record, dataset) || (LABELS.record + " " + (entry.index + 1))) + ' · ' + esc(humanRecordLabel(entry.record, dataset)) + '</option>').join("") + '</select></label><span class="helper">' + LABELS.selectedRecord + '：' + esc(recordId(data[selectedIndex] || {}, dataset) || (LABELS.record + " " + (selectedIndex + 1))) + '</span></div>' : "";
        const body = (dataset.key === "planComparison" ? comparisonCreateMarkup() + comparisonFiltersMarkup(data) : "") + (entries.length ? selector + entries.map(entry => renderRecord(dataset.key, entry.record, entry.index, selectedIndex, entries.map(item => item.record))).join("") : '<div class="empty-official"><strong>' + LABELS.emptyTitle + '</strong><p>' + LABELS.emptyHelp + '</p></div>');
        return '<section id="' + ("medical-dataset-panel-" + dataset.key) + '" class="ava-card admin-domain" data-sync-domain="' + dataset.key + '" role="tabpanel" aria-labelledby="medical-dataset-tab-' + dataset.key + '" tabindex="-1" aria-hidden="' + (!active) + '" ' + (active ? "" : "hidden") + '><div class="admin-domain-heading"><div><span class="eyebrow">' + dataset.key + '</span><h2>' + esc(dataset.label) + '</h2><p class="helper">' + esc(dataset.description) + '</p></div><span class="admin-count">' + entries.length + ' / ' + data.length + ' 筆</span></div>' + body + '</section>';
      }).join("");
      panels.querySelectorAll("[data-record-select]").forEach(select => { select.onchange = () => switchRecord(select.dataset.recordSelect, select.value); });
      panels.querySelectorAll("[data-comparison-filter]").forEach(select => { select.onchange = () => { const field = select.dataset.comparisonFilter; if (hasUnsavedChanges(panel, "planComparison", selectedRecords.planComparison, state.official) && !(typeof global.confirm === "function" && global.confirm(LABELS.unsaved))) { select.value = comparisonFilters[field]; return; } comparisonFilters[field] = select.value; render(); }; });
      panels.querySelectorAll("[data-save-record]").forEach(button => { button.onclick = () => saveRecord(button); });
      panels.querySelectorAll("[data-brochure-file]").forEach(input => { input.onchange = () => selectBrochureFile(input); });
      panels.querySelectorAll("[data-brochure-upload]").forEach(button => { button.onclick = () => uploadBrochure(button); });
      panels.querySelectorAll("[data-brochure-cancel]").forEach(button => { button.onclick = () => cancelBrochureFile(button.closest("[data-brochure-media]")?.dataset.brochureRecordId); });
      panels.querySelectorAll("[data-create-comparison]").forEach(button => { button.onclick = () => createComparison(button); });
    }
    function render() { renderTabs(); renderPanels(); }
    async function saveRecord(button) {
      if (!global.MedicalAdminAuth?.hasSession()) { setMessage(panel, LABELS.permission, "error"); return; }
      const article = button.closest("[data-record-index]"), index = Number(article.dataset.recordIndex), dataset = selected, def = definition(dataset), source = rows(state.official, dataset)[index], changes = {};
      try {
        article.querySelectorAll("[data-field]").forEach(control => { const field = control.dataset.field, next = readControl(control, source[field]); if (!sameValue(next, source[field])) changes[field] = next; });
        if (!Object.keys(changes).length) { setMessage(panel, LABELS.noChanges); return; }
        button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = LABELS.saving; setMessage(panel, LABELS.savingHelp);
        const expectedRecordId = String(recordId(source, def));
        const result = await global.MedicalAdminAuth.authorizedRequest({ action: "updateOfficialRecord", operation: "medical:official-write", body: { dataset, recordId: expectedRecordId, changes, expectedVersion: state.official?.revision || state.official?.version } });
        const next = validateMutationResult(result, { dataset, recordId: expectedRecordId, changes }); state.official = next; onOfficialChanged?.(next); render(); setMessage(panel, LABELS.success.replace("{version}", result.version || next.version || "—"), "success");
      } catch (error) { const message = error.message.includes("version") || error.message.includes("stale") ? LABELS.conflict : LABELS.failure.replace("{message}", error.message); setMessage(panel, message, "error"); button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = LABELS.save; }
    }
    async function uploadBrochure(button) {
      if (!global.MedicalAdminAuth?.hasSession()) { setMessage(panel, LABELS.permission, "error"); return; }
      const article = button.closest("[data-record-index]"), index = Number(article.dataset.recordIndex), source = rows(state.official, "plans")[index], def = definition("plans"), recordIdValue = source ? String(recordId(source, def)) : "", pending = pendingBrochureUploads.get(recordIdValue), file = pending?.file;
      if (!source || !pending || !file) { setBrochureStatus(recordIdValue, "請先選擇產品資料檔案。", "error"); return; }
      let metadata, stage = "selection";
      try {
        metadata = validateBrochureFile(file);
        const planId = canonicalPlanId(source, def);
        if (!planId || pending.canonicalPlanId !== planId) throw new Error("產品記錄與待上載檔案不一致，請重新選擇檔案。");
        button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "上載中…"; setBrochureStatus(recordIdValue, "正在上載至 Firebase…");
        stage = "firebase";
        const firebase = await global.MedicalFirebaseReady;
        if (!firebase?.uploadOfficialBrochure) throw new Error("Medical Firebase 模組未能載入。");
        const uploaded = await firebase.uploadOfficialBrochure({ planId, file });
        stage = "official";
        setBrochureStatus(recordIdValue, "Firebase 上載成功，正在發布 Official URL…");
        const expectedRecordId = recordIdValue;
        const result = await global.MedicalAdminAuth.authorizedRequest({ action: "updateOfficialRecord", operation: "medical:official-write", body: { dataset: "plans", recordId: expectedRecordId, changes: { brochure_url: uploaded.url }, expectedVersion: state.official?.revision || state.official?.version } });
        const next = validateMutationResult(result, { dataset: "plans", recordId: expectedRecordId, changes: { brochure_url: uploaded.url } });
        state.official = next; pendingBrochureUploads.delete(recordIdValue); onOfficialChanged?.(next); render(); setBrochureStatus(recordIdValue, "產品資料已成功上載及發布：" + String(uploaded.filename || metadata.name), "success"); setMessage(panel, LABELS.success.replace("{version}", result.version || next.version || "—"), "success");
      } catch (error) {
        const message = error.message.includes("版本") || error.message.includes("version") || error.message.includes("stale") ? LABELS.conflict : error.message;
        const stageMessage = stage === "firebase" ? "Firebase 上載失敗：" + message : stage === "official" ? "官方資料發布失敗：" + message : message;
        setBrochureStatus(recordIdValue, stageMessage, "error");
        resetUploadButton(button);
      }
    }
    async function createComparison(button) {
      if (!global.MedicalAdminAuth?.hasSession()) { setMessage(panel, LABELS.permission, "error"); return; }
      const form = button.closest("[data-comparison-create]"), values = {};
      try {
        form.querySelectorAll("[data-create-field]").forEach(control => { const field = control.dataset.createField; values[field] = control.type === "checkbox" ? control.checked : control.value; });
        const recordIdValue = String(values.comparison_id || "").trim();
        if (!recordIdValue) throw new Error("比較記錄識別碼不可留空");
        values.sort_order = Number(values.sort_order || 0);
        if (!Number.isFinite(values.sort_order)) throw new Error(LABELS.invalidNumber);
        const changes = {...values}; delete changes.comparison_id;
        button.disabled = true; button.textContent = LABELS.saving; setMessage(panel, LABELS.savingHelp);
        const result = await global.MedicalAdminAuth.authorizedRequest({ action: "createOfficialRecord", operation: "medical:official-write", body: { dataset: "planComparison", recordId: recordIdValue, changes, expectedVersion: state.official?.revision || state.official?.version } });
        const next = validateMutationResult(result, { dataset: "planComparison", recordId: recordIdValue, changes }); state.official = next; onOfficialChanged?.(next); render(); setMessage(panel, LABELS.success.replace("{version}", result.version || next.version || "—"), "success");
      } catch (error) { const message = error.message.includes("version") || error.message.includes("stale") ? LABELS.conflict : LABELS.failure.replace("{message}", error.message); setMessage(panel, message, "error"); button.disabled = false; button.textContent = "建立並發布"; }
    }
    render(); return { render, select: key => { if (definition(key)) { selected = key; render(); } } };
  }
  global.MedicalOfficialSync = Object.freeze({ API, LABELS, FIELD_LABELS, DATASETS, READ_ONLY, rows, definition, recordId, canonicalPlanId, validateBrochureFile, makePendingBrochureUpload, validateMutationResult, mount });
})(typeof window === "undefined" ? globalThis : window);

