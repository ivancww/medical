/*
 * AVA Medical Admin Connector.
 * Connector version: 0.3.0
 * Compatibility contract: ava-admin-session-v1
 *
 * The Platform launch ticket and browser proof are exchanged once. The
 * resulting Admin Session proof is held in memory only and is used for all
 * subsequent Medical Official requests in the live Admin session.
 */
export const ADMIN_CONTRACT = 'ava-admin-session-v1';
export const CONNECTOR_VERSION = '0.3.0';
export const DEFAULT_PLATFORM_ORIGIN = 'https://ivancww.github.io';
export const BROWSER_CONTEXT_PREFIX = 'ava-admin-session-v1:';

const SAFE_STATES = new Set(['idle', 'initializing', 'authorized', 'expired', 'failed', 'cleared']);
const SAFE_DETAIL_KEYS = new Set(['code', 'transport', 'status']);
const MESSAGES = Object.freeze({
  ADMIN_LAUNCH_REQUIRED: 'Admin launch must originate from AVA Studio.',
  ADMIN_BROWSER_BINDING_REQUIRED: 'Admin launch must include an AVA Studio browser binding.',
  ADMIN_BROWSER_BINDING_INVALID: 'The AVA Studio browser binding is invalid.',
  ADMIN_BROWSER_BINDING_EXPIRED: 'The AVA Studio browser binding expired.',
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
    url.searchParams.delete('avaAdminLaunchNonce');
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

export function browserProofFromContext(launchTicket, launchNonce, browserWindow = globalThis.window, now = () => Date.now(), appId = '') {
  let raw = '';
  try {
    raw = String(browserWindow?.name || '');
    if (browserWindow) browserWindow.name = '';
  } catch (_) { return null; }
  if (!raw.startsWith(BROWSER_CONTEXT_PREFIX)) return null;
  let data;
  try { data = JSON.parse(raw.slice(BROWSER_CONTEXT_PREFIX.length)); }
  catch (_) { fail('ADMIN_BROWSER_BINDING_INVALID', 'browser-context'); }
  const expiry = finiteExpiry(data?.expiresAt);
  if (data?.type !== 'ava-admin-session-context' || data.appId !== appId || data.launchTicket !== launchTicket || data.launchNonce !== launchNonce || !stringValue(data.browserProof) || data.contract !== ADMIN_CONTRACT || !expiry || expiry <= now()) {
    fail('ADMIN_BROWSER_BINDING_INVALID', 'browser-context');
  }
  return data;
}

export function createAdminConnector({
  appId,
  gasEndpoint,
  compatibility = ADMIN_CONTRACT,
  returnToAvaUrl = `${DEFAULT_PLATFORM_ORIGIN}/avaplatform/?avaSurface=admin`,
  locationObject = globalThis.location,
  historyObject = globalThis.history,
  windowObject = globalThis.window,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000,
  browserProofTimeoutMs = 15000,
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
  let adminSessionProof = '';
  let sessionExpiry = 0;
  let launchConsumed = false;
  let initializationPromise = null;
  let sessionGeneration = 0;
  let activeCancel = null;
  const subscribers = new Set();
  const notify = () => {
    const snapshot = safeStateSnapshot({ status, appId, lastError, expiresAt: sessionExpiry ? new Date(sessionExpiry).toISOString() : null });
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
    const launchNonce = queryValue(locationObject, 'avaAdminLaunchNonce');
    if (!launchTicket || !launchNonce) fail('ADMIN_LAUNCH_REQUIRED', 'launch-context');
    return { launchTicket, launchNonce };
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

  const requestBrowserProof = async (launch) => {
    let contextProof;
    try { contextProof = browserProofFromContext(launch.launchTicket, launch.launchNonce, windowObject, now, appId); }
    catch (error) { throw currentError(error, 'ADMIN_BROWSER_BINDING_INVALID', 'browser-context'); }
    if (contextProof) return contextProof;
    const opener = windowObject?.opener;
    if (!opener || typeof windowObject?.addEventListener !== 'function' || typeof windowObject?.removeEventListener !== 'function' || typeof opener.postMessage !== 'function') {
      fail('ADMIN_BROWSER_BINDING_REQUIRED', 'browser-binding');
    }
    return new Promise((resolve, reject) => {
      let timer;
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeoutImpl(timer);
        windowObject.removeEventListener('message', onMessage);
        error ? reject(error) : resolve(value);
      };
      const onMessage = event => {
        if (event.source !== opener || event.origin !== DEFAULT_PLATFORM_ORIGIN) return;
        const data = event.data || {};
        if (data.type !== 'ava-admin-session-response' || data.appId !== appId || data.launchTicket !== launch.launchTicket || data.launchNonce !== launch.launchNonce) return;
        if (!stringValue(data.browserProof) || data.contract !== ADMIN_CONTRACT) return finish(new AdminConnectorError('ADMIN_BROWSER_BINDING_INVALID', 'browser-binding-response'));
        const expiry = finiteExpiry(data.expiresAt);
        if (!expiry || expiry <= now()) return finish(new AdminConnectorError('ADMIN_BROWSER_BINDING_EXPIRED', 'browser-binding-expired'));
        finish(null, data);
      };
      timer = setTimeoutImpl(() => finish(new AdminConnectorError('ADMIN_BROWSER_BINDING_EXPIRED', 'browser-binding-timeout')), browserProofTimeoutMs);
      windowObject.addEventListener('message', onMessage);
      try {
        opener.postMessage({ type: 'ava-admin-session-request', appId, launchTicket: launch.launchTicket, launchNonce: launch.launchNonce }, DEFAULT_PLATFORM_ORIGIN);
      } catch (_) { finish(new AdminConnectorError('ADMIN_BROWSER_BINDING_REQUIRED', 'browser-binding-postmessage')); }
    });
  };

  const exchangeAdminLaunch = async () => {
    if (launchConsumed) fail('ADMIN_LAUNCH_REPLAY', 'launch-replay');
    const generation = sessionGeneration;
    const launch = readLaunch();
    launchConsumed = true;
    clearLaunch(locationObject, historyObject);
    stage('launch-context-valid');
    const browser = await requestBrowserProof(launch);
    assertGeneration(generation);
    stage('browser-proof-established');
    stage('platform-exchange-requested');
    let exchangeResult;
    try {
      exchangeResult = await requestWithTimeout('exchange', { url: gasEndpoint, init: {
        method: 'POST', headers: jsonHeaders(),
        body: JSON.stringify({ action: 'exchangeAdminSession', appId, launchTicket: launch.launchTicket, launchNonce: launch.launchNonce, browserProof: browser.browserProof })
      }});
    } catch (error) { throw currentError(error, 'ADMIN_EXCHANGE_NETWORK', 'platform-exchange-network'); }
    assertGeneration(generation);
    const { response, payload } = exchangeResult;
    if (!response.ok) fail('ADMIN_EXCHANGE_HTTP', 'platform-exchange-http');
    const expiry = finiteExpiry(payload?.expiresAt);
    if (payload?.success !== true || payload.appId !== appId || payload.contract !== ADMIN_CONTRACT || !stringValue(payload.adminSessionProof) || !expiry || expiry <= now()) fail('ADMIN_UNAUTHORIZED', 'platform-exchange-rejected');
    adminSessionProof = String(payload.adminSessionProof);
    sessionExpiry = expiry;
    setState('authorized');
    stage('admin-session-established');
    return { appId, compatibility: ADMIN_CONTRACT, connectorVersion: CONNECTOR_VERSION, expiresAt: String(payload.expiresAt) };
  };

  const initialize = () => {
    if (initializationPromise) return initializationPromise;
    if (status === 'authorized' && sessionExpiry > now()) return Promise.resolve({ appId, compatibility: ADMIN_CONTRACT, connectorVersion: CONNECTOR_VERSION, expiresAt: new Date(sessionExpiry).toISOString() });
    setState('initializing');
    initializationPromise = exchangeAdminLaunch().catch(error => {
      const safeError = currentError(error, 'ADMIN_UNAUTHORIZED', 'initialization');
      adminSessionProof = '';
      sessionExpiry = 0;
      if (safeError.code !== 'ADMIN_SESSION_CLEARED') setState('failed', safeError);
      throw safeError;
    });
    return initializationPromise;
  };

  const ensureAuthorized = () => {
    if (!adminSessionProof) fail('ADMIN_PROOF_REQUIRED', 'authorized-request');
    if (sessionExpiry <= now()) {
      adminSessionProof = '';
      sessionExpiry = 0;
      setState('expired', new AdminConnectorError('ADMIN_SESSION_EXPIRED', 'session-expiry'));
      fail('ADMIN_SESSION_EXPIRED', 'session-expiry');
    }
  };
  const authorizedRequest = async ({ action, operation, body = {}, validateResponse } = {}) => {
    ensureAuthorized();
    if (!stringValue(action) || !stringValue(operation)) throw new TypeError('authorizedRequest requires action and operation');
    const generation = sessionGeneration;
    let result;
    try { result = await requestWithTimeout('authorized', { url: gasEndpoint, init: { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ ...body, action, appId, operation, adminSessionProof }) } }); }
    catch (error) { throw currentError(error, 'AUTHORIZED_REQUEST_NETWORK', 'authorized-request-network'); }
    assertGeneration(generation);
    const { response, payload } = result;
    if (!response.ok) fail('AUTHORIZED_REQUEST_HTTP', 'authorized-request-http');
    if (payload?.success !== true) {
      const code = stringValue(payload?.error?.code) || 'AUTHORIZED_REQUEST_REJECTED';
      const message = stringValue(payload?.error?.message) || MESSAGES[code] || MESSAGES.AUTHORIZED_REQUEST_REJECTED;
      throw new AdminConnectorError(code, 'authorized-request-rejected', message);
    }
    if (typeof validateResponse === 'function') { try { await validateResponse(payload); } catch { fail('AUTHORIZED_RESPONSE_INVALID', 'authorized-response-validation'); } }
    return payload;
  };
  const getAuthorizationState = () => {
    if (adminSessionProof && sessionExpiry <= now()) {
      adminSessionProof = '';
      sessionExpiry = 0;
      setState('expired', new AdminConnectorError('ADMIN_SESSION_EXPIRED', 'session-expiry'));
    }
    return safeStateSnapshot({ status, appId, lastError, expiresAt: sessionExpiry ? new Date(sessionExpiry).toISOString() : null });
  };
  const clearSession = () => {
    sessionGeneration += 1;
    if (activeCancel) activeCancel(new AdminConnectorError('ADMIN_SESSION_CLEARED', 'session-clear'));
    adminSessionProof = '';
    sessionExpiry = 0;
    setState('cleared');
  };
  const subscribeToStateChanges = listener => { if (typeof listener !== 'function') throw new TypeError('listener is required'); subscribers.add(listener); return () => subscribers.delete(listener); };

  return Object.freeze({
    initialize,
    exchangeAppLaunch: exchangeAdminLaunch,
    authorizedRequest,
    getAuthorizationState,
    isAuthorized: () => Boolean(adminSessionProof && sessionExpiry > now()),
    clearSession,
    subscribeToStateChanges,
    buildReturnUrl: () => returnToAvaUrl,
    // The current Admin Session proof is held in closure memory only. Firebase
    // Storage never receives it; it is used only for Official Sheet requests.
    getSessionProof: () => adminSessionProof
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
