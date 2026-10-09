(function (global) {
  "use strict";

  const APP_ID = "medical";
  const PLATFORM_ORIGIN = "https://ivancww.github.io";
  const OFFICIAL_API = "https://script.google.com/macros/s/AKfycbzOOtrQy-LfaMlTuLhJJD0ibfSuns4mkF4rWhn6BBTekb09O_UG9-aYH-JGMDZ1lekejw/exec";
  let adminSessionProof = "";

  function launchTicket(location = global.location) {
    return new URLSearchParams(location?.search || "").get("avaAdminLaunch") || "";
  }
  function launchNonce(location = global.location) {
    return new URLSearchParams(location?.search || "").get("avaAdminLaunchNonce") || "";
  }

  function clearLaunchFromUrl(location = global.location, history = global.history) {
    if (!location || !history?.replaceState) return;
    const url = new URL(location.href);
    url.searchParams.delete("avaAdminLaunch");
    url.searchParams.delete("avaAdminLaunchNonce");
    history.replaceState({}, global.document?.title || "AVA Medical", url.pathname + (url.search ? url.search : "") + url.hash);
  }

  async function exchangeAdminSession(fetchImpl = global.fetch, location = global.location) {
    const ticket = launchTicket(location);
    const nonce = launchNonce(location), opener = global.opener;
    if (!ticket || !nonce || !opener) throw new Error("此管理入口必須由 AVA Studio 的安全視窗開啟。");
    const browser = await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, value) => { if (settled) return; settled = true; global.removeEventListener?.("message", onMessage); global.clearTimeout?.(timer); if (error) reject(error); else resolve(value); };
      const timer = global.setTimeout(() => finish(new Error("AVA browser binding expired")), 15000);
      const onMessage = event => {
        const data = event?.data || {};
        if (event.source !== opener || event.origin !== PLATFORM_ORIGIN || data.type !== "ava-admin-session-response") return;
        if (data.appId !== APP_ID || data.launchTicket !== ticket || data.launchNonce !== nonce || !data.browserProof || data.contract !== "ava-admin-session-v1") return;
        finish(null, data);
      };
      global.addEventListener?.("message", onMessage);
      opener.postMessage({ type: "ava-admin-session-request", appId: APP_ID, launchTicket: ticket, launchNonce: nonce }, PLATFORM_ORIGIN);
    });
    const response = await fetchImpl(OFFICIAL_API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "exchangeAdminSession", launchTicket: ticket, launchNonce: nonce, browserProof: browser.browserProof, appId: APP_ID })
    });
    let payload;
    try { payload = await response.json(); } catch (_) { throw new Error("此管理入口需要由 AVA Studio 驗證後開啟。"); }
    if (!response.ok || payload.success !== true || payload.appId !== APP_ID || !payload.adminSessionProof || payload.contract !== "ava-admin-session-v1") {
      throw new Error("此管理入口需要由 AVA Studio 驗證後開啟。");
    }
    adminSessionProof = String(payload.adminSessionProof);
    clearLaunchFromUrl(location);
    return { expiresAt: payload.expiresAt };
  }

  function clear() { adminSessionProof = ""; }
  function getSessionProof() { return adminSessionProof; }
  function hasSession() { return Boolean(adminSessionProof); }

  global.MedicalAdminAuth = Object.freeze({ APP_ID, PLATFORM_ORIGIN, OFFICIAL_API, launchTicket, launchNonce, exchangeAdminSession, clear, hasSession, getSessionProof });
})(typeof window === "undefined" ? globalThis : window);
