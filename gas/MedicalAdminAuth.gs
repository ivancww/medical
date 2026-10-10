/**
 * Medical Official GAS integration for the temporary dual-contract bridge.
 *
 * Add the action branch from medicalAdminAuthAction_ to the existing Medical
 * doPost handler. The effective production handlers live in
 * MedicalProductionFinal.gs; this file remains a focused integration
 * reference and is not a second production bundle.
 *
 * Configure AVA_PLATFORM_ADMIN_AUTH_URL in Medical GAS Script Properties.
 */
const MEDICAL_ADMIN_APP_ID = "medical";
const MEDICAL_ADMIN_SESSION_CONTRACT = "ava-admin-session-v1";
const MEDICAL_APP_GRANT_CONTRACT = "ava-legacy-app-grant-v1";

function medicalAdminAuthAction_(body) {
  if (body.action === "exchangeAdminSession") {
    return medicalExchangeAdminSession_(body.launchTicket, body.appId, body.browserProof, body.launchNonce);
  }
  if (body.action === "exchangeAppLaunch") {
    return medicalExchangeAppLaunch_(body.launchTicket, body.appId);
  }
  throw new Error("Unsupported Medical Admin action");
}

function medicalExchangeAdminSession_(launchTicket, appId, browserProof, launchNonce) {
  if (String(appId || "") !== MEDICAL_ADMIN_APP_ID || !String(launchTicket || "")) {
    throw new Error("Invalid Medical Admin launch");
  }
  const endpoint = PropertiesService.getScriptProperties().getProperty("AVA_PLATFORM_ADMIN_AUTH_URL");
  if (!endpoint) throw new Error("Medical Admin authorization is not configured");
  const response = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "text/plain;charset=utf-8",
    payload: JSON.stringify({ action: "exchangeAdminSession", launchTicket: String(launchTicket), browserProof: String(browserProof || ""), launchNonce: String(launchNonce || ""), appId: MEDICAL_ADMIN_APP_ID }),
    muteHttpExceptions: true
  });
  let payload;
  try { payload = JSON.parse(response.getContentText() || "{}"); } catch (_) { throw new Error("Invalid AVA Admin response"); }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || payload.success !== true || payload.appId !== MEDICAL_ADMIN_APP_ID || !payload.adminSessionProof || payload.contract !== MEDICAL_ADMIN_SESSION_CONTRACT) {
    throw new Error("Invalid or expired AVA Admin launch");
  }
  return { success: true, appId: MEDICAL_ADMIN_APP_ID, adminSessionProof: String(payload.adminSessionProof), expiresAt: payload.expiresAt, contract: MEDICAL_ADMIN_SESSION_CONTRACT };
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
  const expiry = Date.parse(String(payload.expiresAt || ""));
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || payload.success !== true || payload.appId !== MEDICAL_ADMIN_APP_ID || !payload.appGrant || payload.contract !== MEDICAL_APP_GRANT_CONTRACT || !Number.isFinite(expiry) || expiry <= Date.now()) {
    throw new Error("Invalid or expired AVA Admin launch");
  }
  return { success: true, appId: MEDICAL_ADMIN_APP_ID, appGrant: String(payload.appGrant), expiresAt: String(payload.expiresAt), contract: MEDICAL_APP_GRANT_CONTRACT };
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
  const expectedOperation = String(operation || "official-write");
  const expiry = Date.parse(String(payload.expiresAt || ""));
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || payload.success !== true || payload.appId !== MEDICAL_ADMIN_APP_ID || payload.operation !== expectedOperation || payload.contract !== MEDICAL_APP_GRANT_CONTRACT || !Number.isFinite(expiry) || expiry <= Date.now()) {
    throw new Error("Invalid or expired Medical Admin authorization");
  }
  return payload;
}

function medicalVerifyAdminSession_(adminSessionProof, operation) {
  const endpoint = PropertiesService.getScriptProperties().getProperty("AVA_PLATFORM_ADMIN_AUTH_URL");
  if (!endpoint || !String(adminSessionProof || "")) throw new Error("Medical Admin authorization is required");
  const expectedOperation = String(operation || "official-write");
  const response = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "text/plain;charset=utf-8",
    payload: JSON.stringify({ action: "verifyAdminSession", adminSessionProof: String(adminSessionProof), appId: MEDICAL_ADMIN_APP_ID, operation: expectedOperation }),
    muteHttpExceptions: true
  });
  let payload;
  try { payload = JSON.parse(response.getContentText() || "{}"); } catch (_) { throw new Error("Invalid AVA Admin response"); }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || payload.success !== true || payload.appId !== MEDICAL_ADMIN_APP_ID || payload.operation !== expectedOperation || payload.contract !== MEDICAL_ADMIN_SESSION_CONTRACT) {
    throw new Error("Invalid or expired Medical Admin authorization");
  }
  return payload;
}
