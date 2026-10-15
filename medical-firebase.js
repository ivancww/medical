/* Deterministic, classic bootstrap for the Medical Firebase module. */
(function (global) {
  "use strict";
  const RELEASE = "v1.2.4";
  const MODULE_URL = "./medical-firebase-module.js?v=" + RELEASE;
  const MODULE_LOAD_TIMEOUT_MS = 18000;

  function bootstrapError(stage, message, cause) {
    const error = new Error(message);
    error.stage = stage;
    error.code = cause?.code || "MEDICAL_FIREBASE_MODULE_LOAD_FAILED";
    error.cause = cause;
    return error;
  }

  /* This assignment is deliberately synchronous, before the dynamic import. */
  global.MedicalFirebaseReady = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(() => finish(reject, bootstrapError(
      "module-load-timeout",
      "Firebase 模組載入逾時，請重新開啟 Medical 後再試。"
    )), MODULE_LOAD_TIMEOUT_MS);

    import(MODULE_URL).then(module => {
      if (typeof module?.uploadOfficialBrochure !== "function") {
        finish(reject, bootstrapError(
          "module-contract",
          "Firebase 模組載入失敗，請重新開啟 Medical 後再試。"
        ));
        return;
      }
      finish(resolve, {
        uploadOfficialBrochure: module.uploadOfficialBrochure,
        FIREBASE_UPLOAD_TIMEOUT_MS: module.FIREBASE_UPLOAD_TIMEOUT_MS
      });
    }).catch(error => finish(reject, bootstrapError(
      "sdk-import",
      "Firebase SDK 載入失敗，請檢查網絡後再試。",
      error
    )));
  });
})(window);
