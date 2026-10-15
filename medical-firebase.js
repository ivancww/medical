/* Approved Medical / CI Firebase Storage boundary for Official brochures. */
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyDBA5Iitb8X0qmbVfjVdYWw-M2D_9ZhFIg",
  authDomain: "medical-and-ci.firebaseapp.com",
  projectId: "medical-and-ci",
  storageBucket: "medical-and-ci.firebasestorage.app",
  messagingSenderId: "857984223277",
  appId: "1:857984223277:web:bd64aa72fc7e374c3450a4"
});

const ALLOWED_TYPES = Object.freeze(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 20 * 1024 * 1024;
const PLAN_IDS = Object.freeze(["ELITE", "WISE", "FLEXI"]);
const FIREBASE_UPLOAD_TIMEOUT_MS = 120000;
let storage = null;
let initializationError = null;

try {
  const app = getApps().find(candidate => candidate.name === "ava-medical") || initializeApp(firebaseConfig, "ava-medical");
  storage = getStorage(app);
} catch (error) {
  initializationError = error;
}

function stageError(stage, error, fallback) {
  if (error?.stage) return error;
  const wrapped = new Error(String(error?.message || fallback));
  wrapped.stage = stage;
  wrapped.code = String(error?.code || "firebase/unknown");
  wrapped.cause = error;
  return wrapped;
}

function notify(callback, payload) {
  try { callback?.(payload); } catch (_) { /* UI progress callbacks must not break the upload task. */ }
}

function sanitizeFilename(name) {
  return String(name || "brochure").normalize("NFKC").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "brochure";
}

function validateFile(file) {
  if (!file || typeof file !== "object") throw new Error("請先選擇產品資料檔案。");
  if (!ALLOWED_TYPES.includes(String(file.type || "").toLowerCase())) throw new Error("只接受 PDF、JPEG、PNG 或 WEBP。");
  if (!Number.isFinite(Number(file.size)) || Number(file.size) <= 0 || Number(file.size) > MAX_BYTES) throw new Error("檔案大小必須介乎 1 byte 至 20 MB。");
}

export async function uploadOfficialBrochure({ planId, file, onProgress, onStage, timeoutMs = FIREBASE_UPLOAD_TIMEOUT_MS }) {
  if (initializationError || !storage) throw stageError("initialization", initializationError, "Medical Firebase 模組未能初始化。");
  const id = String(planId || "").toUpperCase();
  if (!PLAN_IDS.includes(id)) throw new Error("只有 ELITE、WISE、FLEXI 計劃可以上載產品資料。");
  validateFile(file);
  const boundedTimeout = Number.isFinite(Number(timeoutMs)) ? Math.max(1000, Number(timeoutMs)) : FIREBASE_UPLOAD_TIMEOUT_MS;
  const filename = `${Date.now()}-${sanitizeFilename(file.name)}`;
  const objectPath = `medical/official/brochures/${id}/${filename}`;
  const objectRef = ref(storage, objectPath);
  const metadata = { contentType: file.type, customMetadata: { app: "medical", assetType: "official-brochure", planId: id } };
  let uploadTask;
  try {
    uploadTask = uploadBytesResumable(objectRef, file, metadata);
  } catch (error) {
    throw stageError("upload", error, "Firebase 上載未能開始。");
  }
  notify(onStage, { stage: "upload", state: "started", objectPath });
  const snapshot = await new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe = () => {};
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (typeof unsubscribe === "function") unsubscribe();
      callback(value);
    };
    const timer = setTimeout(() => {
      const timeoutError = stageError("timeout", null, "Firebase 上載逾時，請檢查網絡後再試。");
      finish(reject, timeoutError);
      try { uploadTask.cancel(); } catch (_) { /* Firebase may already be complete. */ }
    }, boundedTimeout);
    try {
      unsubscribe = uploadTask.on("state_changed", snapshotState => {
        const totalBytes = Number(snapshotState.totalBytes || file.size || 0);
        const bytesTransferred = Number(snapshotState.bytesTransferred || 0);
        const percentage = totalBytes > 0 ? Math.min(100, Math.round(bytesTransferred / totalBytes * 100)) : 0;
        notify(onProgress, { stage: "upload", state: snapshotState.state, bytesTransferred, totalBytes, percentage });
      }, error => finish(reject, stageError("upload", error, "Firebase 上載失敗。")), () => {
        notify(onStage, { stage: "upload", state: "completed", objectPath });
        finish(resolve, uploadTask.snapshot);
      });
    } catch (error) {
      finish(reject, stageError("upload", error, "Firebase 上載失敗。"));
    }
  });
  notify(onStage, { stage: "download-url", state: "started", objectPath });
  let url;
  try {
    url = await Promise.race([
      getDownloadURL(snapshot.ref),
      new Promise((_, reject) => setTimeout(() => reject(stageError("download-url", null, "取得 Firebase 產品資料連結逾時。")), boundedTimeout))
    ];
  } catch (error) {
    throw stageError("download-url", error, "未能取得 Firebase 產品資料連結。");
  }
  notify(onStage, { stage: "download-url", state: "completed", objectPath });
  if (!/^https:\/\//i.test(url)) throw stageError("download-url", null, "Firebase 未返回有效的 HTTPS 產品資料連結。");
  return { url, objectPath, filename, contentType: file.type, size: Number(file.size) };
}

window.MedicalFirebaseReady = Promise.resolve({ uploadOfficialBrochure, FIREBASE_UPLOAD_TIMEOUT_MS });
