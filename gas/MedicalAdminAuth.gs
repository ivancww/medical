/**
 * Medical Official GAS integration for the AVA Unified Admin Auth contract.
 *
 * Add the action branch from medicalAdminAuthAction_ to the existing Medical
 * doPost handler. This file deliberately contains no Medical Official write:
 * the current Medical backend exposes reads only and Admin intake remains a
 * confirmed local draft.
 *
 * Configure AVA_PLATFORM_ADMIN_AUTH_URL in Medical GAS Script Properties.
 */
const MEDICAL_ADMIN_APP_ID = "medical";

function medicalAdminAuthAction_(body) {
  if (body.action === "exchangeAppLaunch") {
    return medicalExchangeAppLaunch_(body.launchTicket, body.appId);
  }
  throw new Error("Unsupported Medical Admin action");
}

function medicalExchangeAppLaunch_(launchTicket, appId) {
  if (String(appId || "") !== MEDICAL_ADMIN_APP_ID || !String(launchTicket || "")) {
    throw new Error("Invalid Medical Admin launch");
  }
  const endpoint = PropertiesService.getScriptProperties().getProperty("AVA_PLATFORM_ADMIN_AUTH_URL");
  if (!endpoint) throw new Error("Medical Admin authorization is not configured");
  const response = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "text/plain;charset=utf-8",
    payload: JSON.stringify({ action: "exchangeAppLaunch", launchTicket: String(launchTicket), appId: MEDICAL_ADMIN_APP_ID }),
    muteHttpExceptions: true
  });
  let payload;
  try { payload = JSON.parse(response.getContentText() || "{}"); } catch (_) { throw new Error("Invalid AVA Admin response"); }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || payload.success !== true || payload.appId !== MEDICAL_ADMIN_APP_ID || !payload.appGrant) {
    throw new Error("Invalid or expired AVA Admin launch");
  }
  return { success: true, appId: MEDICAL_ADMIN_APP_ID, appGrant: String(payload.appGrant), expiresAt: payload.expiresAt };
}

/** Use immediately before any future Medical Official write. */
function medicalVerifyAppGrant_(appGrant, operation) {
  const endpoint = PropertiesService.getScriptProperties().getProperty("AVA_PLATFORM_ADMIN_AUTH_URL");
  if (!endpoint || !String(appGrant || "")) throw new Error("Medical Admin authorization is required");
  const response = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "text/plain;charset=utf-8",
    payload: JSON.stringify({ action: "verifyAppGrant", appGrant: String(appGrant), appId: MEDICAL_ADMIN_APP_ID, operation: String(operation || "official-write") }),
    muteHttpExceptions: true
  });
  let payload;
  try { payload = JSON.parse(response.getContentText() || "{}"); } catch (_) { throw new Error("Invalid AVA Admin response"); }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || payload.success !== true || payload.appId !== MEDICAL_ADMIN_APP_ID) {
    throw new Error("Invalid or expired Medical Admin authorization");
  }
  return payload;
}
