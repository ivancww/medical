/*
 * AVA Unified Admin Connector — vendored same-origin Medical artifact.
 * Canonical source commit: 408099060a579c883a6a97f2731c5e4d93e74766
 * Connector version: 0.1.1
 * Compatibility contract: ava-admin-session-v1
 * This file is generated/pinned for the Medical pilot; do not edit independently.
 */
export const ADMIN_CONTRACT = 'ava-admin-session-v1';
export const CONNECTOR_VERSION = '0.1.1';
export const BROWSER_CONTEXT_PREFIX = `${ADMIN_CONTRACT}:`;
export const DEFAULT_PLATFORM_ORIGIN = 'https://ivancww.github.io';

const SAFE_DETAIL_KEYS = new Set(['code', 'transport', 'status']);
const SAFE_STATES = new Set(['idle', 'initializing', 'authorized', 'expired', 'failed', 'cleared']);

const MESSAGES = Object.freeze({
  ADMIN_LAUNCH_REQUIRED: 'Admin launch must originate from AVA Studio.',
  ADMIN_BROWSER_BINDING_REQUIRED: 'Admin launch must originate from AVA Studio.',
  ADMIN_BROWSER_BINDING_EXPIRED: 'AVA browser binding expired.',
  ADMIN_PARENT_CLOSED: 'AVA Studio was closed before Admin authorization completed.',
  BROWSER_PROOF_INVALID: 'AVA browser proof is invalid.',
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

function fail(code, stage) {
  throw new AdminConnectorError(code, stage);
}

function stringValue(value) {
  return typeof value === 'string' ? value : '';
}

function finiteExpiry(value) {
  const expiry = Date.parse(stringValue(value));
  return Number.isFinite(expiry) ? expiry : 0;
}

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

function queryValue(locationObject, name) {
  const href = stringValue(locationObject?.href);
  if (!href) return '';
  try {
    return new URL(href).searchParams.get(name) || '';
  } catch {
    return '';
  }
}

function clearLaunch(locationObject, historyObject) {
  const href = stringValue(locationObject?.href);
  if (!href || typeof historyObject?.replaceState !== 'function') return;
  try {
    const url = new URL(href);
    url.searchParams.delete('avaAdminLaunch');
    url.searchParams.delete('avaAdminLaunchNonce');
    historyObject.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // URL cleanup is defensive only and must never alter authorization outcome.
  }
}

function parseBrowserEnvelope({ raw, appId, ticket, nonce, now }) {
  if (!raw.startsWith(BROWSER_CONTEXT_PREFIX)) return null;
  let data;
  try {
    data = JSON.parse(raw.slice(BROWSER_CONTEXT_PREFIX.length));
  } catch {
    fail('BROWSER_PROOF_INVALID', 'browser-context-parse');
  }
  const expiry = finiteExpiry(data?.expiresAt);
  if (
    data?.type !== 'ava-admin-session-context' ||
    data.appId !== appId ||
    data.launchTicket !== ticket ||
    data.launchNonce !== nonce ||
    !stringValue(data.browserProof) ||
    data.contract !== ADMIN_CONTRACT ||
    !expiry ||
    expiry <= now()
  ) {
    fail('BROWSER_PROOF_INVALID', 'browser-context-validate');
  }
  return { browserProof: String(data.browserProof), expiresAt: String(data.expiresAt) };
}

function validateBrowserResponse(data, { appId, ticket, nonce, now }) {
  const expiry = finiteExpiry(data?.expiresAt);
  if (
    data?.type !== 'ava-admin-session-response' ||
    data.appId !== appId ||
    data.launchTicket !== ticket ||
    data.launchNonce !== nonce ||
    !stringValue(data.browserProof) ||
    data.contract !== ADMIN_CONTRACT ||
    !expiry ||
    expiry <= now()
  ) {
    fail('BROWSER_PROOF_INVALID', 'browser-proof-validate');
  }
  return { browserProof: String(data.browserProof), expiresAt: String(data.expiresAt) };
}

function jsonHeaders() {
  return { 'Content-Type': 'text/plain;charset=utf-8' };
}

export function createAdminConnector({
  appId,
  gasEndpoint,
  platformOrigin = DEFAULT_PLATFORM_ORIGIN,
  compatibility = ADMIN_CONTRACT,
  returnToAvaUrl = `${DEFAULT_PLATFORM_ORIGIN}/avaplatform/?avaSurface=admin`,
  locationObject = globalThis.location,
  historyObject = globalThis.history,
  windowObject = globalThis.window,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000,
  parentPollMs = 250,
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
  let sessionProof = '';
  let sessionExpiry = 0;
  let launchConsumed = false;
  let initializationPromise = null;
  let sessionGeneration = 0;
  let activeCancel = null;
  const subscribers = new Set();

  const notify = () => {
    const snapshot = safeStateSnapshot({ status, appId, lastError, expiresAt: sessionExpiry ? new Date(sessionExpiry).toISOString() : null });
    try { onStateChange(snapshot); } catch { /* UI hooks cannot affect security state. */ }
    for (const subscriber of [...subscribers]) {
      try { subscriber(snapshot); } catch { /* One observer cannot affect other observers. */ }
    }
  };

  const stage = (name, details = {}) => {
    const safeDetails = Object.fromEntries(Object.entries(details).filter(([key]) => SAFE_DETAIL_KEYS.has(key)));
    try { onStage(Object.freeze({ name, ...safeDetails })); } catch { /* Diagnostics are non-authoritative. */ }
  };

  const setState = (nextStatus, error = null) => {
    status = nextStatus;
    lastError = error;
    notify();
  };

  const currentError = (error, fallbackCode, fallbackStage) => {
    if (error instanceof AdminConnectorError) return error;
    return new AdminConnectorError(fallbackCode, fallbackStage);
  };

  const assertGeneration = generation => {
    if (generation !== sessionGeneration) fail('ADMIN_SESSION_CLEARED', 'session-clear');
  };

  const readLaunch = () => {
    const launchTicket = queryValue(locationObject, 'avaAdminLaunch');
    const launchNonce = queryValue(locationObject, 'avaAdminLaunchNonce');
    if (!launchTicket || !launchNonce) fail('ADMIN_LAUNCH_REQUIRED', 'launch-context');
    return { launchTicket, launchNonce };
  };

  const readWindowContext = (launchTicket, launchNonce) => {
    let raw = '';
    try {
      raw = stringValue(windowObject?.name);
      if (raw.startsWith(BROWSER_CONTEXT_PREFIX)) windowObject.name = '';
    } catch {
      return null;
    }
    return parseBrowserEnvelope({ raw, appId, ticket: launchTicket, nonce: launchNonce, now });
  };

  const browserProofFromOpener = (launchTicket, launchNonce) => {
    const context = readWindowContext(launchTicket, launchNonce);
    if (context) {
      stage('browser-proof-received', { transport: 'window.name' });
      return Promise.resolve(context);
    }

    const opener = windowObject?.opener;
    if (!opener) fail('ADMIN_BROWSER_BINDING_REQUIRED', 'browser-binding');
    if (opener.closed === true) fail('ADMIN_PARENT_CLOSED', 'browser-binding');

    return new Promise((resolve, reject) => {
      let settled = false;
      let timer;
      let parentTimer;
      const cleanup = () => {
        windowObject?.removeEventListener?.('message', onMessage);
        if (timer !== undefined) clearTimeoutImpl(timer);
        if (parentTimer !== undefined) clearTimeoutImpl(parentTimer);
        if (activeCancel === cancel) activeCancel = null;
      };
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        error ? reject(error) : resolve(value);
      };
      const pollParent = () => {
        if (settled) return;
        if (opener.closed === true) return finish(new AdminConnectorError('ADMIN_PARENT_CLOSED', 'browser-binding'));
        parentTimer = setTimeoutImpl(pollParent, Math.max(25, parentPollMs));
      };
      const onMessage = event => {
        if (event?.source !== opener || event?.origin !== platformOrigin) return;
        const data = event?.data || {};
        if (data.type !== 'ava-admin-session-response' || data.appId !== appId || data.launchTicket !== launchTicket || data.launchNonce !== launchNonce) return;
        try { finish(null, validateBrowserResponse(data, { appId, ticket: launchTicket, nonce: launchNonce, now })); }
        catch (error) { finish(currentError(error, 'BROWSER_PROOF_INVALID', 'browser-proof-validate')); }
      };
      const cancel = error => finish(error || new AdminConnectorError('ADMIN_SESSION_CLEARED', 'session-clear'));
      activeCancel = cancel;
      timer = setTimeoutImpl(() => finish(new AdminConnectorError('ADMIN_BROWSER_BINDING_EXPIRED', 'browser-proof-timeout')), timeoutMs);
      windowObject?.addEventListener?.('message', onMessage);
      stage('browser-proof-requested', { transport: 'postMessage' });
      try {
        opener.postMessage({ type: 'ava-admin-session-request', appId, launchTicket, launchNonce, contract: ADMIN_CONTRACT }, platformOrigin);
        parentTimer = setTimeoutImpl(pollParent, Math.max(25, parentPollMs));
      } catch {
        finish(new AdminConnectorError('ADMIN_BROWSER_BINDING_REQUIRED', 'browser-binding'));
      }
    });
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
      if (controller) {
        try { controller.abort(); } catch { /* Cancellation remains authoritative. */ }
      }
      cancelReject(error || new AdminConnectorError('ADMIN_SESSION_CLEARED', 'session-clear'));
    };
    activeCancel = cancel;
    try {
      const fetchPromise = (async () => {
        let response;
        try { response = await fetchImpl(request.url, { ...request.init, ...(controller ? { signal: controller.signal } : {}) }); }
        catch { throw new AdminConnectorError(networkCode, `${stageName}-network`); }
        let payload;
        try { payload = await response.json(); }
        catch { throw new AdminConnectorError(responseCode, `${stageName}-response`); }
        return { response, payload };
      })();
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeoutImpl(() => {
          if (controller) {
            try { controller.abort(); } catch { /* Timer remains authoritative. */ }
          }
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

  const exchangeAdminSession = async () => {
    if (launchConsumed) fail('ADMIN_LAUNCH_REPLAY', 'launch-replay');
    const generation = sessionGeneration;
    const { launchTicket, launchNonce } = readLaunch();
    stage('launch-context-valid');
    const browser = await browserProofFromOpener(launchTicket, launchNonce);
    assertGeneration(generation);
    launchConsumed = true;
    clearLaunch(locationObject, historyObject);
    stage('platform-exchange-requested');
    let exchangeResult;
    try {
      exchangeResult = await requestWithTimeout('exchange', {
        url: gasEndpoint,
        init: {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({ action: 'exchangeAdminSession', appId, launchTicket, launchNonce, browserProof: browser.browserProof })
        }
      });
    } catch (error) {
      throw currentError(error, 'ADMIN_EXCHANGE_NETWORK', 'platform-exchange-network');
    }
    assertGeneration(generation);
    const { response, payload } = exchangeResult;
    if (!response.ok) fail('ADMIN_EXCHANGE_HTTP', 'platform-exchange-http');
    const expiry = finiteExpiry(payload?.expiresAt);
    if (payload?.success !== true || payload.appId !== appId || payload.contract !== ADMIN_CONTRACT || !stringValue(payload.adminSessionProof) || !expiry || expiry <= now()) {
      fail('ADMIN_UNAUTHORIZED', 'platform-exchange-rejected');
    }
    sessionProof = String(payload.adminSessionProof);
    sessionExpiry = expiry;
    setState('authorized');
    stage('admin-session-established');
    return { appId, compatibility: ADMIN_CONTRACT, connectorVersion: CONNECTOR_VERSION, expiresAt: String(payload.expiresAt) };
  };

  const initialize = () => {
    if (initializationPromise) return initializationPromise;
    if (status === 'authorized' && sessionExpiry > now()) return Promise.resolve({ appId, compatibility: ADMIN_CONTRACT, connectorVersion: CONNECTOR_VERSION, expiresAt: new Date(sessionExpiry).toISOString() });
    setState('initializing');
    initializationPromise = exchangeAdminSession().catch(error => {
      const safeError = currentError(error, 'ADMIN_UNAUTHORIZED', 'initialization');
      sessionProof = '';
      sessionExpiry = 0;
      if (safeError.code !== 'ADMIN_SESSION_CLEARED') setState('failed', safeError);
      throw safeError;
    });
    return initializationPromise;
  };

  const ensureAuthorized = () => {
    if (!sessionProof) fail('ADMIN_PROOF_REQUIRED', 'authorized-request');
    if (sessionExpiry <= now()) {
      sessionProof = '';
      sessionExpiry = 0;
      setState('expired', new AdminConnectorError('ADMIN_SESSION_EXPIRED', 'session-expiry'));
      fail('ADMIN_SESSION_EXPIRED', 'session-expiry');
    }
  };

  const authorizedRequest = async ({ action, operation, body = {}, validateResponse } = {}) => {
    ensureAuthorized();
    if (!stringValue(action) || !stringValue(operation)) throw new TypeError('authorizedRequest requires action and operation');
    const generation = sessionGeneration;
    let response;
    try {
      response = await requestWithTimeout('authorized', {
        url: gasEndpoint,
        init: {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({ ...body, action, appId, operation, adminSessionProof: sessionProof })
        }
      });
    } catch (error) {
      throw currentError(error, 'AUTHORIZED_REQUEST_NETWORK', 'authorized-request-network');
    }
    assertGeneration(generation);
    const { response: authorizedResponse, payload } = response;
    if (!authorizedResponse.ok) fail('AUTHORIZED_REQUEST_HTTP', 'authorized-request-http');
    if (payload?.success !== true) fail('AUTHORIZED_REQUEST_REJECTED', 'authorized-request-rejected');
    if (typeof validateResponse === 'function') {
      try { await validateResponse(payload); }
      catch { fail('AUTHORIZED_RESPONSE_INVALID', 'authorized-response-validation'); }
    }
    return payload;
  };

  const getAuthorizationState = () => {
    if (sessionProof && sessionExpiry <= now()) {
      sessionProof = '';
      sessionExpiry = 0;
      setState('expired', new AdminConnectorError('ADMIN_SESSION_EXPIRED', 'session-expiry'));
    }
    return safeStateSnapshot({ status, appId, lastError, expiresAt: sessionExpiry ? new Date(sessionExpiry).toISOString() : null });
  };

  const subscribeToStateChanges = listener => {
    if (typeof listener !== 'function') throw new TypeError('listener is required');
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  };

  const clearSession = () => {
    sessionGeneration += 1;
    if (activeCancel) activeCancel(new AdminConnectorError('ADMIN_SESSION_CLEARED', 'session-clear'));
    sessionProof = '';
    sessionExpiry = 0;
    setState('cleared');
  };

  return Object.freeze({
    initialize,
    exchangeAdminSession,
    authorizedRequest,
    getAuthorizationState,
    isAuthorized: () => Boolean(sessionProof && sessionExpiry > now()),
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
