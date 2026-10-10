/*
 * AVA Medical Admin Connector.
 * Connector version: 0.2.0
 * Compatibility contract: ava-legacy-app-grant-v1
 *
 * The launch ticket is exchanged once by Medical GAS. The resulting App Grant
 * is closure state only; it is never written to URL, browser storage, QR or
 * User Override data.
 */
export const ADMIN_CONTRACT = 'ava-legacy-app-grant-v1';
export const CONNECTOR_VERSION = '0.2.0';
export const DEFAULT_PLATFORM_ORIGIN = 'https://ivancww.github.io';

const SAFE_STATES = new Set(['idle', 'initializing', 'authorized', 'expired', 'failed', 'cleared']);
const SAFE_DETAIL_KEYS = new Set(['code', 'transport', 'status']);
const MESSAGES = Object.freeze({
  ADMIN_LAUNCH_REQUIRED: 'Admin launch must originate from AVA Studio.',
  ADMIN_EXCHANGE_TIMEOUT: 'Admin authorization service timed out.',
  ADMIN_EXCHANGE_NETWORK: 'Admin authorization service is unavailable.',
  ADMIN_EXCHANGE_HTTP: 'Admin authorization service returned an HTTP error.',
  ADMIN_EXCHANGE_RESPONSE: 'Admin authorization response is invalid.',
  ADMIN_UNAUTHORIZED: 'Admin authorization was rejected.',
  ADMIN_LAUNCH_REPLAY: 'This Admin launch has already been consumed.',
  ADMIN_SESSION_CLEARED: 'Admin authorization was cleared before completion.',
  ADMIN_PROOF_REQUIRED: 'Admin authorization is required.',
  ADMIN_SESSION_EXPIRED: 'Admin authorization expired.',
  AUTHORIZED_REQUEST_TIMEOUT: 'Authorized App request timed out.',
  AUTHORIZED_REQUEST_NETWORK: 'Authorized App request is unavailable.',
  AUTHORIZED_REQUEST_HTTP: 'Authorized App request returned an HTTP error.',
  AUTHORIZED_RESPONSE_INVALID: 'Authorized App response is invalid.',
  AUTHORIZED_REQUEST_REJECTED: 'Authorized App request was rejected.',
  OFFICIAL_WRITE_UNSUPPORTED: 'This App does not provide an Official Write operation.'
});

export class AdminConnectorError extends Error {
  constructor(code, stage, message = MESSAGES[code] || 'AVA Admin authorization failed.') {
    super(message);
    this.name = 'AdminConnectorError';
    this.code = code;
    this.stage = stage;
  }
}

function fail(code, stage) { throw new AdminConnectorError(code, stage); }
function stringValue(value) { return typeof value === 'string' ? value : ''; }
function finiteExpiry(value) { const expiry = Date.parse(stringValue(value)); return Number.isFinite(expiry) ? expiry : 0; }
function queryValue(locationObject, name) {
  const href = stringValue(locationObject?.href);
  if (!href) return '';
  try { return new URL(href).searchParams.get(name) || ''; } catch { return ''; }
}
function clearLaunch(locationObject, historyObject) {
  const href = stringValue(locationObject?.href);
  if (!href || typeof historyObject?.replaceState !== 'function') return;
  try {
    const url = new URL(href);
    url.searchParams.delete('avaAdminLaunch');
    historyObject.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch { /* URL cleanup is defensive and never changes authorization outcome. */ }
}
function jsonHeaders() { return { 'Content-Type': 'text/plain;charset=utf-8' }; }

function safeStateSnapshot({ status, appId, lastError, expiresAt }) {
  return Object.freeze({
    status: SAFE_STATES.has(status) ? status : 'failed',
    appId,
    compatibility: ADMIN_CONTRACT,
    connectorVersion: CONNECTOR_VERSION,
    expiresAt: expiresAt || null,
    error: lastError ? Object.freeze({ code: lastError.code, stage: lastError.stage }) : null
  });
}

export function createAdminConnector({
  appId,
  gasEndpoint,
  compatibility = ADMIN_CONTRACT,
  returnToAvaUrl = `${DEFAULT_PLATFORM_ORIGIN}/avaplatform/?avaSurface=admin`,
  locationObject = globalThis.location,
  historyObject = globalThis.history,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000,
  now = () => Date.now(),
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  AbortControllerImpl = globalThis.AbortController,
  onStage = () => {},
  onStateChange = () => {}
} = {}) {
  if (!stringValue(appId) || !stringValue(gasEndpoint)) throw new TypeError('appId and gasEndpoint are required');
  if (compatibility !== ADMIN_CONTRACT) throw new TypeError('Unsupported Admin compatibility contract');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
  if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new TypeError('timer functions are required');

  let status = 'idle';
  let lastError = null;
  let appGrant = '';
  let grantExpiry = 0;
  let launchConsumed = false;
  let initializationPromise = null;
  let sessionGeneration = 0;
  let activeCancel = null;
  const subscribers = new Set();
  const notify = () => {
    const snapshot = safeStateSnapshot({ status, appId, lastError, expiresAt: grantExpiry ? new Date(grantExpiry).toISOString() : null });
    try { onStateChange(snapshot); } catch { /* observers are non-authoritative */ }
    for (const subscriber of [...subscribers]) { try { subscriber(snapshot); } catch { /* isolate observers */ } }
  };
  const stage = (name, details = {}) => {
    const safeDetails = Object.fromEntries(Object.entries(details).filter(([key]) => SAFE_DETAIL_KEYS.has(key)));
    try { onStage(Object.freeze({ name, ...safeDetails })); } catch { /* diagnostics are non-authoritative */ }
  };
  const setState = (nextStatus, error = null) => { status = nextStatus; lastError = error; notify(); };
  const currentError = (error, fallbackCode, fallbackStage) => error instanceof AdminConnectorError ? error : new AdminConnectorError(fallbackCode, fallbackStage);
  const assertGeneration = generation => { if (generation !== sessionGeneration) fail('ADMIN_SESSION_CLEARED', 'session-clear'); };
  const readLaunch = () => {
    const launchTicket = queryValue(locationObject, 'avaAdminLaunch');
    if (!launchTicket) fail('ADMIN_LAUNCH_REQUIRED', 'launch-context');
    return { launchTicket };
  };

  const requestWithTimeout = async (kind, request) => {
    const timeoutCode = kind === 'exchange' ? 'ADMIN_EXCHANGE_TIMEOUT' : 'AUTHORIZED_REQUEST_TIMEOUT';
    const networkCode = kind === 'exchange' ? 'ADMIN_EXCHANGE_NETWORK' : 'AUTHORIZED_REQUEST_NETWORK';
    const responseCode = kind === 'exchange' ? 'ADMIN_EXCHANGE_RESPONSE' : 'AUTHORIZED_RESPONSE_INVALID';
    const stageName = kind === 'exchange' ? 'platform-exchange' : 'authorized-request';
    const controller = typeof AbortControllerImpl === 'function' ? new AbortControllerImpl() : null;
    let timer;
    let settled = false;
    let cancelReject;
    const cancelPromise = new Promise((_, reject) => { cancelReject = reject; });
    const cancel = error => {
      if (settled) return;
      if (controller) { try { controller.abort(); } catch { /* cancellation remains authoritative */ } }
      cancelReject(error || new AdminConnectorError('ADMIN_SESSION_CLEARED', 'session-clear'));
    };
    activeCancel = cancel;
    try {
      const fetchPromise = (async () => {
        let response;
        try { response = await fetchImpl(request.url, { ...request.init, ...(controller ? { signal: controller.signal } : {}) }); }
        catch { throw new AdminConnectorError(networkCode, `${stageName}-network`); }
        let payload;
        try { payload = await response.json(); } catch { throw new AdminConnectorError(responseCode, `${stageName}-response`); }
        return { response, payload };
      })();
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeoutImpl(() => {
          if (controller) { try { controller.abort(); } catch { /* timer remains authoritative */ } }
          reject(new AdminConnectorError(timeoutCode, `${stageName}-timeout`));
        }, timeoutMs);
      });
      const result = await Promise.race([fetchPromise, timeoutPromise, cancelPromise]);
      settled = true;
      return result;
    } catch (error) {
      if (error instanceof AdminConnectorError) throw error;
      throw new AdminConnectorError(networkCode, `${stageName}-network`);
    } finally {
      settled = true;
      if (timer !== undefined) clearTimeoutImpl(timer);
      if (activeCancel === cancel) activeCancel = null;
    }
  };

  const exchangeAppLaunch = async () => {
    if (launchConsumed) fail('ADMIN_LAUNCH_REPLAY', 'launch-replay');
    const generation = sessionGeneration;
    const { launchTicket } = readLaunch();
    launchConsumed = true;
    clearLaunch(locationObject, historyObject);
    stage('launch-context-valid');
    stage('platform-exchange-requested');
    let exchangeResult;
    try {
      exchangeResult = await requestWithTimeout('exchange', { url: gasEndpoint, init: {
        method: 'POST', headers: jsonHeaders(),
        body: JSON.stringify({ action: 'exchangeAppLaunch', appId, launchTicket })
      }});
    } catch (error) { throw currentError(error, 'ADMIN_EXCHANGE_NETWORK', 'platform-exchange-network'); }
    assertGeneration(generation);
    const { response, payload } = exchangeResult;
    if (!response.ok) fail('ADMIN_EXCHANGE_HTTP', 'platform-exchange-http');
    const expiry = finiteExpiry(payload?.expiresAt);
    if (payload?.success !== true || payload.appId !== appId || payload.contract !== ADMIN_CONTRACT || !stringValue(payload.appGrant) || !expiry || expiry <= now()) fail('ADMIN_UNAUTHORIZED', 'platform-exchange-rejected');
    appGrant = String(payload.appGrant);
    grantExpiry = expiry;
    setState('authorized');
    stage('app-grant-established');
    return { appId, compatibility: ADMIN_CONTRACT, connectorVersion: CONNECTOR_VERSION, expiresAt: String(payload.expiresAt) };
  };

  const initialize = () => {
    if (initializationPromise) return initializationPromise;
    if (status === 'authorized' && grantExpiry > now()) return Promise.resolve({ appId, compatibility: ADMIN_CONTRACT, connectorVersion: CONNECTOR_VERSION, expiresAt: new Date(grantExpiry).toISOString() });
    setState('initializing');
    initializationPromise = exchangeAppLaunch().catch(error => {
      const safeError = currentError(error, 'ADMIN_UNAUTHORIZED', 'initialization');
      appGrant = '';
      grantExpiry = 0;
      if (safeError.code !== 'ADMIN_SESSION_CLEARED') setState('failed', safeError);
      throw safeError;
    });
    return initializationPromise;
  };

  const ensureAuthorized = () => {
    if (!appGrant) fail('ADMIN_PROOF_REQUIRED', 'authorized-request');
    if (grantExpiry <= now()) {
      appGrant = '';
      grantExpiry = 0;
      setState('expired', new AdminConnectorError('ADMIN_SESSION_EXPIRED', 'session-expiry'));
      fail('ADMIN_SESSION_EXPIRED', 'session-expiry');
    }
  };
  const authorizedRequest = async ({ action, operation, body = {}, validateResponse } = {}) => {
    ensureAuthorized();
    if (!stringValue(action) || !stringValue(operation)) throw new TypeError('authorizedRequest requires action and operation');
    const generation = sessionGeneration;
    let result;
    try { result = await requestWithTimeout('authorized', { url: gasEndpoint, init: { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ ...body, action, appId, operation, appGrant }) } }); }
    catch (error) { throw currentError(error, 'AUTHORIZED_REQUEST_NETWORK', 'authorized-request-network'); }
    assertGeneration(generation);
    const { response, payload } = result;
    if (!response.ok) fail('AUTHORIZED_REQUEST_HTTP', 'authorized-request-http');
    if (payload?.success !== true) fail('AUTHORIZED_REQUEST_REJECTED', 'authorized-request-rejected');
    if (typeof validateResponse === 'function') { try { await validateResponse(payload); } catch { fail('AUTHORIZED_RESPONSE_INVALID', 'authorized-response-validation'); } }
    return payload;
  };
  const getAuthorizationState = () => {
    if (appGrant && grantExpiry <= now()) { appGrant = ''; grantExpiry = 0; setState('expired', new AdminConnectorError('ADMIN_SESSION_EXPIRED', 'session-expiry')); }
    return safeStateSnapshot({ status, appId, lastError, expiresAt: grantExpiry ? new Date(grantExpiry).toISOString() : null });
  };
  const clearSession = () => {
    sessionGeneration += 1;
    if (activeCancel) activeCancel(new AdminConnectorError('ADMIN_SESSION_CLEARED', 'session-clear'));
    appGrant = '';
    grantExpiry = 0;
    setState('cleared');
  };
  const subscribeToStateChanges = listener => { if (typeof listener !== 'function') throw new TypeError('listener is required'); subscribers.add(listener); return () => subscribers.delete(listener); };

  return Object.freeze({
    initialize,
    exchangeAppLaunch,
    authorizedRequest,
    getAuthorizationState,
    isAuthorized: () => Boolean(appGrant && grantExpiry > now()),
    clearSession,
    subscribeToStateChanges,
    buildReturnUrl: () => returnToAvaUrl,
    getSessionProof: () => undefined
  });
}

export function createOfficialDataAdapter({ connector, readOfficial, buildWrite } = {}) {
  if (!connector || typeof readOfficial !== 'function') throw new TypeError('connector and readOfficial are required');
  return Object.freeze({
    read: () => readOfficial(),
    save: async input => {
      if (typeof buildWrite !== 'function') fail('OFFICIAL_WRITE_UNSUPPORTED', 'official-adapter');
      const request = buildWrite(input);
      if (!request || !stringValue(request.action) || !stringValue(request.operation)) throw new TypeError('buildWrite must return action and operation');
      return connector.authorizedRequest(request);
    }
  });
}
