/* Classic bootstrap: expose one deterministic Storage provider readiness gate. */
(function (global) {
  "use strict";
  const RELEASE = "v1.2.8";
  const MODULE_URL = "./medical-firebase-module.js?v=" + RELEASE;
  const MODULE_LOAD_TIMEOUT_MS = 18000;

  function bootstrapError(stage, message, cause) {
    const error = new Error(message);
    error.stage = stage;
    error.code = cause?.code || "MEDICAL_FIREBASE_MODULE_LOAD_FAILED";
    error.cause = cause;
    return error;
  }

  /* Synchronous assignment prevents upload code from racing module startup. */
  const ready = new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    timer = setTimeout(() => finish(reject, bootstrapError(
      "module-bootstrap",
      "Firebase 模組載入逾時，請重新開啟 Medical 後再試。"
    )), MODULE_LOAD_TIMEOUT_MS);

    import(MODULE_URL).then(module => {
      if (typeof module?.createFirebaseStorageClient !== "function") {
        finish(reject, bootstrapError(
          "module-import",
          "Firebase 模組載入失敗，請重新開啟 Medical 後再試。"
        ));
        return;
      }
      return module.createFirebaseStorageClient();
    }).then(client => {
      if (client) finish(resolve, client);
    }).catch(error => finish(reject, bootstrapError(
      error?.stage || "sdk-import",
      "Firebase SDK 載入失敗，請檢查網絡後再試。",
      error
    )));
  });

  global.MedicalFirebaseReady = ready;
  ready.catch(error => { global.MedicalFirebaseModuleError = error; });
})(window);
