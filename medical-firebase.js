/* Approved Medical / CI Firebase Storage boundary for Official brochures. */
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getDownloadURL, getStorage, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

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
const app = getApps().find(candidate => candidate.name === "ava-medical") || initializeApp(firebaseConfig, "ava-medical");
const storage = getStorage(app);

function sanitizeFilename(name) {
  return String(name || "brochure").normalize("NFKC").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "brochure";
}

function validateFile(file) {
  if (!file || typeof file !== "object") throw new Error("請先選擇產品資料檔案。");
  if (!ALLOWED_TYPES.includes(String(file.type || "").toLowerCase())) throw new Error("只接受 PDF、JPEG、PNG 或 WEBP。");
  if (!Number.isFinite(Number(file.size)) || Number(file.size) <= 0 || Number(file.size) > MAX_BYTES) throw new Error("檔案大小必須介乎 1 byte 至 20 MB。");
}

export async function uploadOfficialBrochure({ planId, file }) {
  const id = String(planId || "").toUpperCase();
  if (!PLAN_IDS.includes(id)) throw new Error("只有 ELITE、WISE、FLEXI 計劃可以上載產品資料。");
  validateFile(file);
  const filename = `${Date.now()}-${sanitizeFilename(file.name)}`;
  const objectPath = `medical/official/brochures/${id}/${filename}`;
  const objectRef = ref(storage, objectPath);
  const snapshot = await uploadBytes(objectRef, file, { contentType: file.type, customMetadata: { app: "medical", assetType: "official-brochure", planId: id } });
  const url = await getDownloadURL(snapshot.ref);
  if (!/^https:\/\//i.test(url)) throw new Error("Firebase 未返回有效的 HTTPS 產品資料連結。");
  return { url, objectPath, filename, contentType: file.type, size: Number(file.size) };
}

window.MedicalFirebaseReady = Promise.resolve({ uploadOfficialBrochure });
