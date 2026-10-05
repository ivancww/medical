(function (global) {
  "use strict";

  const APP_ID = "medical";
  const OFFICIAL_API = "https://script.google.com/macros/s/AKfycbzOOtrQy-LfaMlTuLhJJD0ibfSuns4mkF4rWhn6BBTekb09O_UG9-aYH-JGMDZ1lekejw/exec";
  let appGrant = "";

  function launchTicket(location = global.location) {
    return new URLSearchParams(location?.search || "").get("avaAdminLaunch") || "";
  }

  function clearLaunchFromUrl(location = global.location, history = global.history) {
    if (!location || !history?.replaceState) return;
    const url = new URL(location.href);
    url.searchParams.delete("avaAdminLaunch");
    history.replaceState({}, global.document?.title || "AVA Medical", url.pathname + (url.search ? url.search : "") + url.hash);
  }

  async function exchangeAppLaunch(fetchImpl = global.fetch, location = global.location) {
    const ticket = launchTicket(location);
    if (!ticket) throw new Error("此管理入口需要由 AVA Studio 驗證後開啟。");
    const response = await fetchImpl(OFFICIAL_API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "exchangeAppLaunch", launchTicket: ticket, appId: APP_ID })
    });
    let payload;
    try { payload = await response.json(); } catch (_) { throw new Error("此管理入口需要由 AVA Studio 驗證後開啟。"); }
    if (!response.ok || payload.success !== true || payload.appId !== APP_ID || !payload.appGrant) {
      throw new Error("此管理入口需要由 AVA Studio 驗證後開啟。");
    }
    appGrant = String(payload.appGrant);
    clearLaunchFromUrl(location);
    return { expiresAt: payload.expiresAt };
  }

  function clear() { appGrant = ""; }
  function getGrant() { return appGrant; }
  function hasGrant() { return Boolean(appGrant); }

  global.MedicalAdminAuth = Object.freeze({ APP_ID, OFFICIAL_API, launchTicket, exchangeAppLaunch, clear, hasGrant, getGrant });
})(typeof window === "undefined" ? globalThis : window);
