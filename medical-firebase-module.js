/* Thin Storage-only Firebase provider for Medical Official brochures. */
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getDownloadURL, getMetadata, getStorage, ref, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyDBA5Iitb8X0qmbVfjVdYWw-M2D_9ZhFIg",
  authDomain: "medical-and-ci.firebaseapp.com",
  projectId: "medical-and-ci",
  storageBucket: "medical-and-ci.firebasestorage.app",
  messagingSenderId: "857984223277",
  appId: "1:857984223277:web:bd64aa72fc7e374c3450a4",
  measurementId: "G-VC775G3QRW"
});

let clientPromise;

export function createFirebaseStorageClient() {
  if (!clientPromise) {
    clientPromise = Promise.resolve().then(() => {
      try {
        const app = getApps().find(candidate => candidate.name === "ava-medical")
          || initializeApp(FIREBASE_CONFIG, "ava-medical");
        const storage = getStorage(app);
        return Object.freeze({
          app,
          storage,
          appSdk: Object.freeze({ getApps, initializeApp }),
          storageSdk: Object.freeze({ getDownloadURL, getMetadata, getStorage, ref, uploadBytesResumable })
        });
      } catch (error) {
        error.stage = error.stage || "initialization";
        throw error;
      }
    });
  }
  return clientPromise;
}
