/* Medical Official-media orchestration layer. No Firebase SDK imports here. */
(function (global) {
  "use strict";

  const ALLOWED_TYPES = Object.freeze(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  const MAX_BYTES = 20 * 1024 * 1024;
  const PLAN_IDS = Object.freeze(["ELITE", "WISE", "FLEXI"]);
  const CONTENT_TYPES = Object.freeze(["brochure", "product_feature", "product_document", "claim_case", "claim_example", "other"]);
  const FIREBASE_UPLOAD_TIMEOUT_MS = 120000;

  function stageError(stage, error, fallback) {
    if (error?.stage) return error;
    const wrapped = new Error(String(error?.message || fallback || "Firebase operation failed."));
    wrapped.stage = stage;
    wrapped.code = String(error?.code || "firebase/unknown");
    wrapped.cause = error;
    return wrapped;
  }

  function notify(callback, payload) { try { callback?.(payload); } catch (_) {} }
  function sanitizeSegment(value, fallback = "resource") {
    const safe = String(value ?? "").normalize("NFKC").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^\.+/, "").replace(/^-+|-+$/g, "").slice(0, 120);
    return safe || fallback;
  }
  function sanitizeFilename(name) { return sanitizeSegment(name, "resource"); }
  function validateFile(file) {
    if (!file || typeof file !== "object") throw stageError("file-validation", null, "請先選擇產品資料檔案。");
    const type = String(file.type || "").toLowerCase(), size = Number(file.size);
    if (!ALLOWED_TYPES.includes(type)) throw stageError("file-validation", null, "只接受 PDF、JPEG、PNG 或 WEBP。");
    if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) throw stageError("file-validation", null, "檔案大小必須介乎 1 byte 至 20 MB。");
    return { type, size, name: sanitizeFilename(file.name) };
  }
  function canonicalPlanId(planId) {
    const id = String(planId || "").trim().toUpperCase();
    if (!PLAN_IDS.includes(id)) throw stageError("file-validation", null, "只有 ELITE、WISE、FLEXI 計劃可以上載官方資料。");
    return id;
  }
  function canonicalContentType(contentType) {
    const value = String(contentType || "other").trim().toLowerCase();
    if (!CONTENT_TYPES.includes(value)) throw stageError("file-validation", null, "不支援的官方資料類型。");
    return value;
  }
  function officialResourcePath({ planId, category, contentId, contentType, filename, timestamp = Date.now() } = {}) {
    const plan = canonicalPlanId(planId), safeCategory = sanitizeSegment(category, "other").toLowerCase(), safeContentId = sanitizeSegment(contentId, "resource"), type = canonicalContentType(contentType);
    const location = type === "claim_case" || type === "claim_example" || safeCategory === "claims" ? "claims/" + safeContentId : "product/" + safeCategory;
    const time = Number(timestamp);
    return "medical/official/" + plan + "/" + location + "/" + (Number.isFinite(time) && time > 0 ? time : Date.now()) + "_" + sanitizeFilename(filename);
  }
  function officialBrochurePath({ planId, filename, timestamp = Date.now() } = {}) { return officialResourcePath({ planId, category: "brochure", contentId: "brochure", contentType: "brochure", filename, timestamp }); }
  async function storageClient() {
    if (!global.MedicalFirebaseReady) throw stageError("module-bootstrap", null, "Firebase 模組載入失敗，請重新開啟 Medical 後再試。");
    try { return await global.MedicalFirebaseReady; } catch (error) { throw stageError(error?.stage || "module-import", error, "Firebase 模組載入失敗，請重新開啟 Medical 後再試。"); }
  }

  async function uploadOfficialMedia({ planId, category, contentId, contentType, file, adminSessionProof, onProgress, onStage, timestamp, timeoutMs = FIREBASE_UPLOAD_TIMEOUT_MS } = {}) {
    if (!adminSessionProof) throw stageError("admin-proof", null, "有效的 AVA Admin session proof 是必要的。");
    const validated = validateFile(file), plan = canonicalPlanId(planId), type = canonicalContentType(contentType);
    const path = officialResourcePath({ planId: plan, category, contentId, contentType: type, filename: validated.name, timestamp });
    const client = await storageClient(), { storageSdk, storage } = client, objectRef = storageSdk.ref(storage, path);
    const metadata = { contentType: validated.type, customMetadata: { app: "medical", assetType: "official-resource", planId: plan, contentId: sanitizeSegment(contentId, "resource"), category: sanitizeSegment(category, "other").toLowerCase(), contentType: type } };
    const boundedTimeout = Number.isFinite(Number(timeoutMs)) ? Math.max(1000, Number(timeoutMs)) : FIREBASE_UPLOAD_TIMEOUT_MS;
    let uploadTask;
    try { uploadTask = storageSdk.uploadBytesResumable(objectRef, file, metadata); } catch (error) { throw stageError("upload", error, "Firebase 上載未能開始。"); }
    notify(onStage, { stage: "upload", state: "started", objectPath: path });
    const snapshot = await new Promise((resolve, reject) => {
      let settled = false, unsubscribe = () => {}, timer;
      const finish = (callback, value) => { if (settled) return; settled = true; clearTimeout(timer); if (typeof unsubscribe === "function") unsubscribe(); callback(value); };
      timer = setTimeout(() => { const error = stageError("timeout", null, "Firebase 上載逾時，請檢查網絡後再試。"); finish(reject, error); try { uploadTask.cancel(); } catch (_) {} }, boundedTimeout);
      try {
        unsubscribe = uploadTask.on("state_changed", state => {
          const totalBytes = Number(state.totalBytes || validated.size || 0), bytesTransferred = Number(state.bytesTransferred || 0), percentage = totalBytes > 0 ? Math.min(100, Math.round(bytesTransferred / totalBytes * 100)) : 0;
          notify(onProgress, { stage: "upload", state: state.state, bytesTransferred, totalBytes, percentage });
        }, error => finish(reject, stageError("upload", error, "Firebase 上載失敗。")), () => { notify(onStage, { stage: "upload", state: "completed", objectPath: path }); finish(resolve, uploadTask.snapshot); });
      } catch (error) { finish(reject, stageError("upload", error, "Firebase 上載失敗。")); }
    });
    notify(onStage, { stage: "object-verification", state: "started", objectPath: path });
    try { await storageSdk.getMetadata(snapshot.ref); notify(onStage, { stage: "object-verification", state: "completed", objectPath: path }); } catch (error) { throw stageError("object-verification", error, "Firebase 物件確認失敗。"); }
    notify(onStage, { stage: "download-url", state: "started", objectPath: path });
    let url;
    try { url = await storageSdk.getDownloadURL(snapshot.ref); } catch (error) { throw stageError("download-url", error, "取得 Firebase 產品資料連結失敗。"); }
    if (!/^https:\/\//i.test(String(url || ""))) throw stageError("download-url", null, "Firebase 未返回有效的 HTTPS 產品資料連結。");
    notify(onStage, { stage: "download-url", state: "completed", objectPath: path });
    return { url, objectPath: path, filename: validated.name, contentType: validated.type, size: validated.size, resourceType: "firebase", contentTypeKey: type, planId: plan, category: sanitizeSegment(category, "other").toLowerCase(), contentId: sanitizeSegment(contentId, "resource"), verified: true };
  }
  async function uploadOfficialBrochure(options = {}) { return uploadOfficialMedia({ ...options, category: "brochure", contentId: "brochure", contentType: "brochure" }); }
  global.MedicalFirebaseMedia = Object.freeze({ ALLOWED_TYPES, MAX_BYTES, PLAN_IDS, CONTENT_TYPES, FIREBASE_UPLOAD_TIMEOUT_MS, sanitizeFilename, sanitizeSegment, validateFile, validateBrochureFile: validateFile, officialResourcePath, officialBrochurePath, uploadOfficialMedia, uploadOfficialBrochure });
})(window);
