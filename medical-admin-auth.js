(function (global) {
  "use strict";

  const APP_ID = "medical";
  const PLATFORM_ORIGIN = "https://ivancww.github.io";
  const OFFICIAL_API = "https://script.google.com/macros/s/AKfycbzOOtrQy-LfaMlTuLhJJD0ibfSuns4mkF4rWhn6BBTekb09O_UG9-aYH-JGMDZ1lekejw/exec";
  const EXCHANGE_TIMEOUT_MS = 15000;
  const CONNECTOR_VERSION = "0.1.1";
  const CONNECTOR_COMPATIBILITY = "ava-admin-session-v1";
  const CONNECTOR_MODULE = "./ava-admin-connector.mjs?v=1.1.5";
  let connectorPromise;
  let connector;

  function launchTicket(location = global.location) {
    return new URLSearchParams(location?.search || "").get("avaAdminLaunch") || "";
  }

  function launchNonce(location = global.location) {
    return new URLSearchParams(location?.search || "").get("avaAdminLaunchNonce") || "";
  }

  function userError(error) {
    const messages = {
      ADMIN_LAUNCH_REQUIRED: "此管理入口必須由 AVA Studio 的安全視窗開啟。",
      ADMIN_BROWSER_BINDING_REQUIRED: "此管理入口必須由 AVA Studio 的安全視窗開啟。",
      ADMIN_PARENT_CLOSED: "AVA Studio 視窗已關閉，請返回 AVA Studio 再開啟 Medical。",
      ADMIN_BROWSER_BINDING_EXPIRED: "AVA Admin 瀏覽器驗證逾時，請返回 AVA Studio 再開啟 Medical。",
      BROWSER_PROOF_INVALID: "AVA Admin 瀏覽器驗證無效，請返回 AVA Studio 再開啟 Medical。",
      ADMIN_EXCHANGE_TIMEOUT: "AVA Admin 授權服務回應逾時，請返回 AVA Studio 再開啟 Medical。",
      ADMIN_EXCHANGE_NETWORK: "暫時未能連接 AVA Admin 授權服務，請稍後再試。",
      ADMIN_EXCHANGE_HTTP: "AVA Admin 授權服務拒絕此管理入口。",
      ADMIN_EXCHANGE_RESPONSE: "AVA Admin 授權回應無效，請返回 AVA Studio 再開啟 Medical。",
      ADMIN_UNAUTHORIZED: "此管理入口未能由 AVA Studio 授權。",
      ADMIN_LAUNCH_REPLAY: "此管理入口已使用，請返回 AVA Studio 重新開啟 Medical。",
      ADMIN_SESSION_CLEARED: "AVA Admin 授權已清除，請返回 AVA Studio 重新開啟 Medical。"
    };
    const safe = new Error(messages[error?.code] || "此管理入口需要由 AVA Studio 驗證後開啟。");
    safe.code = error?.code || "ADMIN_UNAUTHORIZED";
    safe.stage = error?.stage || "medical-admin";
    return safe;
  }

  function loadConnector() {
    if (!connectorPromise) {
      connectorPromise = import(CONNECTOR_MODULE).then(module => {
        connector = module.createAdminConnector({
          appId: APP_ID,
          gasEndpoint: OFFICIAL_API,
          platformOrigin: PLATFORM_ORIGIN,
          compatibility: CONNECTOR_COMPATIBILITY,
          returnToAvaUrl: `${PLATFORM_ORIGIN}/avaplatform/?avaSurface=admin`,
          windowObject: global,
          locationObject: global.location,
          historyObject: global.history,
          fetchImpl: global.fetch,
          timeoutMs: EXCHANGE_TIMEOUT_MS,
          setTimeoutImpl: global.setTimeout,
          clearTimeoutImpl: global.clearTimeout,
          AbortControllerImpl: global.AbortController
        });
        return connector;
      }).catch(error => { throw userError(error); });
    }
    return connectorPromise;
  }

  async function exchangeAdminSession() {
    try { return await (await loadConnector()).initialize(); }
    catch (error) { throw userError(error); }
  }

  async function authorizedRequest(request) {
    try { return await (await loadConnector()).authorizedRequest(request); }
    catch (error) { throw userError(error); }
  }

  function clear() { connector?.clearSession(); }
  function hasSession() { return Boolean(connector?.isAuthorized()); }
  function getAuthorizationState() { return connector?.getAuthorizationState() || { status: "idle", appId: APP_ID, compatibility: CONNECTOR_COMPATIBILITY, connectorVersion: CONNECTOR_VERSION, expiresAt: null, error: null }; }
  function getSessionProof() { return undefined; }

  global.MedicalAdminAuth = Object.freeze({
    APP_ID,
    PLATFORM_ORIGIN,
    OFFICIAL_API,
    EXCHANGE_TIMEOUT_MS,
    CONNECTOR_VERSION,
    CONNECTOR_COMPATIBILITY,
    CONNECTOR_MODULE,
    launchTicket,
    launchNonce,
    exchangeAdminSession,
    authorizedRequest,
    clear,
    hasSession,
    getAuthorizationState,
    getSessionProof,
    loadConnector
  });
})(typeof window === "undefined" ? globalThis : window);
