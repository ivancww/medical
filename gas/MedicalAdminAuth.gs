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
  if (body.action === "exchangeAdminSession") {
    return medicalExchangeAdminSession_(body.launchTicket, body.appId, body.launchNonce);
  }
  throw new Error("Unsupported Medical Admin action");
}

function medicalExchangeAdminSession_(launchTicket, appId, launchNonce) {
  if (String(appId || "") !== MEDICAL_ADMIN_APP_ID || !String(launchTicket || "")) {
    throw new Error("Invalid Medical Admin launch");
  }
  const endpoint = PropertiesService.getScriptProperties().getProperty("AVA_PLATFORM_ADMIN_AUTH_URL");
  if (!endpoint) throw new Error("Medical Admin authorization is not configured");
  const response = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "text/plain;charset=utf-8",
    payload: JSON.stringify({ action: "exchangeAdminSession", launchTicket: String(launchTicket), launchNonce: String(launchNonce || ""), appId: MEDICAL_ADMIN_APP_ID }),
    muteHttpExceptions: true
  });
  let payload;
  try { payload = JSON.parse(response.getContentText() || "{}"); } catch (_) { throw new Error("Invalid AVA Admin response"); }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || payload.success !== true || payload.appId !== MEDICAL_ADMIN_APP_ID || !payload.adminSessionProof || payload.contract !== "ava-admin-session-v1") {
    throw new Error("Invalid or expired AVA Admin launch");
  }
  return { success: true, appId: MEDICAL_ADMIN_APP_ID, adminSessionProof: String(payload.adminSessionProof), expiresAt: payload.expiresAt, contract: "ava-admin-session-v1" };
}

/** Use immediately before any future Medical Official write. */
function medicalVerifyAdminSession_(adminSessionProof, operation) {
  const endpoint = PropertiesService.getScriptProperties().getProperty("AVA_PLATFORM_ADMIN_AUTH_URL");
  if (!endpoint || !String(adminSessionProof || "")) throw new Error("Medical Admin authorization is required");
  const response = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "text/plain;charset=utf-8",
    payload: JSON.stringify({ action: "verifyAdminSession", adminSessionProof: String(adminSessionProof), appId: MEDICAL_ADMIN_APP_ID, operation: String(operation || "official-write") }),
    muteHttpExceptions: true
  });
  let payload;
  try { payload = JSON.parse(response.getContentText() || "{}"); } catch (_) { throw new Error("Invalid AVA Admin response"); }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || payload.success !== true || payload.appId !== MEDICAL_ADMIN_APP_ID || payload.contract !== "ava-admin-session-v1") {
    throw new Error("Invalid or expired Medical Admin authorization");
  }
  return payload;
}
