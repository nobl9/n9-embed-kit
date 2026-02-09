/**
 * N9 Iframe Authentication Module
 * Handles iframe loading and token injection to embedded iframes
 */

/**
 * N9 Auth configuration for iframe authentication
 * @type {Object}
 */
const n9AuthConfig = {
  issuer: 'https://n9-domain/oauth2/',
  clientId: 'client-id',
  redirectUri: window.location.origin + '/sample/dashboard.html',
  scopes: ['openid', 'profile', 'email'],
  pkce: true,
  tokenManager: {
    storage: 'localStorage',
    key: 'n9Auth'
  }
};

/**
 * Iframe configuration map: panel container ID -> iframe URL
 * All iframes configured here will receive token injection
 * @type {Object.<string, string>}
 */
const iframeConfig = {
  'panel-1': 'https://example.com/reports/details/report-1?embedMode=minimal&waitExternalAuth=true',
  'panel-2': 'https://example.com/reports/details/report-2?embedMode=minimal&waitExternalAuth=true',
  // 'panel-3': null,
  // 'panel-4': null,
};

/**
 * Target origin for postMessage (must match the iframe domain for security)
 * @type {string}
 */
const targetOrigin = 'https://n9-domain';

/**
 * Auth acquisition mode: 'redirect' or 'popup'
 * @type {string}
 */
const iframeAuthMode = "redirect";

const iframeData = new Map();

const setupIframeNavigation = (iframe, targetOrigin, panelId) => {
  const iframeId = iframe.id;
  const navigationHistory = [];

  const navigateToHistoryItem = (index) => {
    const historyItem = navigationHistory[index];
    if (!historyItem) {
      console.warn(`[${iframeId}] No history item at index ${index}`);
      return;
    }

    console.log(`[${iframeId}] Navigating to: ${historyItem.routeName}`);
    iframe.src = historyItem.url;
  };

  const updateBreadcrumb = () => {
    const breadcrumbElement = document.getElementById(`${panelId}-breadcrumb`);
    if (!breadcrumbElement) return;

    if (navigationHistory.length <= 1) {
      breadcrumbElement.innerHTML = '';
      return;
    }

    const currentRoute = navigationHistory[navigationHistory.length - 1];
    const previousRoute = navigationHistory[navigationHistory.length - 2];

    if (previousRoute.routeName === currentRoute.routeName) {
      breadcrumbElement.innerHTML = '';
      return;
    }

    const historyIndex = navigationHistory.length - 2;
    breadcrumbElement.innerHTML = `<span class="breadcrumb-item" onclick="navigateToHistoryItem('${iframeId}', ${historyIndex})">${previousRoute.routeName}</span> <span class="breadcrumb-separator">></span>`;
  };

  if (!iframeData.has(iframeId)) {
    iframeData.set(iframeId, {});
  }
  const data = iframeData.get(iframeId);
  data.navigateToHistoryItem = navigateToHistoryItem;

  const handleNavigationChange = (event) => {
    if (event.origin !== targetOrigin) {
      return;
    }

    if (
      event.data?.type === "NAVIGATION_CHANGE" &&
      event.source === iframe.contentWindow
    ) {
      const payload = event.data.payload;

      if (payload.routeName) {
        navigationHistory.push({
          routeName: payload.routeName,
          url: payload.url,
          path: payload.path,
          fullPath: payload.fullPath
        });

        if (navigationHistory.length > 10) {
          navigationHistory.shift();
        }

        const routeNameElement = document.getElementById(`${panelId}-route`);
        if (routeNameElement) {
          routeNameElement.textContent = payload.routeName;
        }

        updateBreadcrumb();
      }
    }
  };

  window.addEventListener("message", handleNavigationChange);
};

window.navigateIframeHome = (iframeId) => {
  const data = iframeData.get(iframeId);
  if (!data) {
    console.warn(`No data found for ${iframeId}`);
    return false;
  }

  data.iframe.src = data.originalUrl;
  return true;
};

window.navigateToHistoryItem = (iframeId, historyIndex) => {
  const data = iframeData.get(iframeId);
  if (!data || !data.navigateToHistoryItem) {
    console.warn(`No navigation function found for ${iframeId}`);
    return false;
  }

  data.navigateToHistoryItem(historyIndex);
  return true;
};

/**
 * Check if popups are allowed by attempting to open a test popup
 * @returns {boolean} true if popups are allowed, false otherwise
 */
function checkPopupAllowed() {
  const testPopup = window.open("", "_blank", "width=1,height=1");
  if (testPopup) {
    testPopup.close();
    return true;
  }
  return false;
}

/**
 * Attempt to parse tokens from URL after redirect flow
 * @returns {Promise<Object|null>} Token payload with accessToken, idToken, and scopes, or null if not present
 */
async function parseRedirectTokens() {
  if (typeof OktaAuth !== "function") {
    console.error("OktaAuth library is not loaded. Please include okta-auth-js before using this script.");
    throw new Error("Missing OktaAuth dependency");
  }

  const n9Auth = new OktaAuth(n9AuthConfig);
  try {
    const { tokens } = await n9Auth.token.parseFromUrl();
    if (tokens?.accessToken && tokens?.idToken) {
      await n9Auth.tokenManager.setTokens(tokens);
      const accessToken = tokens.accessToken.accessToken;
      const idToken = tokens.idToken.idToken;
      const idTokenClaims = tokens.idToken.claims || {};

      // Clean URL (remove hash/query containing tokens)
      try {
        const cleanURL = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanURL);
      } catch (e) {
        console.warn("Failed to clean URL after token parsing:", e);
      }
      // Return tokens; UI update handled separately by showAuthenticatedUI()
      return { accessToken, idToken, idTokenClaims, scopes: n9AuthConfig.scopes };
    }
  } catch (e) {
    return null;
  }
  return null;
}

/**
 * Obtain tokens using redirect mode: parse existing tokens or initiate redirect
 * @returns {Promise<Object|null>} Token payload or null if redirect is initiated
 */
async function obtainTokensRedirectMode() {
  const existing = await parseRedirectTokens();
  if (existing) {
    return existing;
  }

  const n9Auth = new OktaAuth(n9AuthConfig);
  // Trigger redirect; control returns after Okta redirects back
  await n9Auth.token.getWithRedirect({
    scopes: n9AuthConfig.scopes,
    responseType: ["token", "id_token"],
  });

  // After redirect: browser navigation occurs, so we return null
  return null;
}

/**
 * Obtain tokens using popup mode: open popup and resolve with tokens
 * @returns {Promise<Object|null>} Token payload or null if acquisition fails
 */
async function obtainTokensPopupMode() {
  try {
    const n9Auth = new OktaAuth(n9AuthConfig);
    const res = await n9Auth.token.getWithPopup({
      scopes: n9AuthConfig.scopes,
      responseType: ["token", "id_token"],
    });

    if (res.tokens?.accessToken && res.tokens?.idToken) {
      await n9Auth.tokenManager.setTokens(res.tokens);
      const accessToken = res.tokens.accessToken.accessToken;
      const idToken = res.tokens.idToken.idToken;
      const idTokenClaims = res.tokens.idToken.claims || {};
      return { accessToken, idToken, idTokenClaims, scopes: n9AuthConfig.scopes };
    }

    console.warn("Popup token acquisition returned without both tokens");
    return null;
  } catch (e) {
    console.error("Popup token acquisition failed:", e);
    return null;
  }
}

/**
 * Wait for iframe to signal it's ready to receive tokens
 * @param {HTMLIFrameElement} iframe - The iframe element
 * @param {string} targetOrigin - The target origin for postMessage
 * @param {number} timeoutMs - Maximum time to wait for ready signal (default: 5000ms)
 * @returns {Promise<boolean>} Resolves true when ready signal received, false on timeout
 */
function waitForIframeReady(iframe, targetOrigin, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const iframeId = iframe.id;
    let timeoutId = null;
    let readyReceived = false;

    const handleReadyMessage = (event) => {
      if (event.origin !== targetOrigin) {
        return;
      }

      // Check that the message comes from THIS specific iframe
      if (
        event.data?.type === "IFRAME_READY" &&
        event.source === iframe.contentWindow
      ) {
        readyReceived = true;
        clearTimeout(timeoutId);
        window.removeEventListener("message", handleReadyMessage);
        resolve(true);
      }
    };

    timeoutId = setTimeout(() => {
      if (!readyReceived) {
        window.removeEventListener("message", handleReadyMessage);
        console.warn(
          `Ready signal timeout for iframe ${iframeId} after ${timeoutMs}ms. Proceeding anyway.`
        );
        resolve(false);
      }
    }, timeoutMs);

    window.addEventListener("message", handleReadyMessage);
  });
}

/**
 * Post authentication tokens to an iframe and wait for acknowledgment
 * @param {HTMLIFrameElement} iframe - The iframe element
 * @param {Object} tokens - The tokens object with accessToken, idToken, and scopes
 * @param {string} targetOrigin - The target origin for postMessage
 * @returns {Promise<void>} Resolves when acknowledgment is received or timeout occurs
 */
function postTokensToIframe(iframe, tokens, targetOrigin) {
  return new Promise((resolve, reject) => {
    const ACK_TIMEOUT_MS = 10000;
    const iframeId = iframe.id;
    let timeoutId = null;
    let ackReceived = false;

    const message = {
      type: "INJECT_TOKENS",
      payload: {
        version: "2",
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        scopes: tokens.scopes,
        source: "dashboard-sample",
      },
    };

    const handleAcknowledgment = (event) => {
      if (event.origin !== targetOrigin) {
        return;
      }

      // Check that the ACK comes from THIS specific iframe
      if (
        event.data?.type === "INJECT_TOKENS_ACK" &&
        event.source === iframe.contentWindow
      ) {
        ackReceived = true;
        clearTimeout(timeoutId);
        window.removeEventListener("message", handleAcknowledgment);

        const ackPayload = event.data.payload;
        if (ackPayload.success) {
          resolve();
        } else {
          console.error(
            `Token injection failed for iframe ${iframeId}:`,
            ackPayload
          );
          reject(new Error(ackPayload.error || "Token injection failed"));
        }
      }
    };

    timeoutId = setTimeout(() => {
      if (!ackReceived) {
        window.removeEventListener("message", handleAcknowledgment);
        console.warn(
          `Acknowledgment timeout for iframe ${iframeId} after ${ACK_TIMEOUT_MS}ms. Proceeding anyway.`
        );
        resolve();
      }
    }, ACK_TIMEOUT_MS);

    window.addEventListener("message", handleAcknowledgment);
    iframe.contentWindow.postMessage(message, targetOrigin);
  });
}

/**
 * Helper: Show authenticated UI and populate user email from idToken claims
 */
function showAuthenticatedUI(tokens) {
  const loadingEl = document.getElementById('loading');
  const appEl = document.getElementById('app');
  if (loadingEl) loadingEl.style.display = 'none';
  if (appEl) appEl.style.display = 'flex';
  const userEmailEl = document.getElementById('userEmail');
  if (!userEmailEl) return;

  let claims = tokens?.idTokenClaims;
  // Fallback: decode idToken locally if claims missing
  if (!claims && tokens?.idToken) {
    try {
      const parts = tokens.idToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        claims = payload;
      }
    } catch (e) {
      console.warn('Unable to decode idToken for claims:', e);
    }
  }
  if (claims) {
    const email = claims.email || claims.preferred_username || claims.sub || 'Authenticated';
    userEmailEl.textContent = email;
  }
}

/**
 * Load iframes and setup token injection for authenticated iframes
 * This is the main entry point called after dashboard authentication
 * @returns {Promise<void>}
 */
window.loadIframes = async function () {
  let tokens = null;

  // Auth mode: popup or redirect
  if (iframeAuthMode === "popup") { // Popup mode
    if (!checkPopupAllowed()) {
      console.error("Popups are blocked by the browser");
      alert(
        "Popup Blocker Detected\n\n" +
          "To load authenticated iframes in popup mode, popups must be enabled.\n\n" +
          "Enable popups and reload."
      );
      return;
    }

    tokens = await obtainTokensPopupMode();
    if (!tokens) {
      console.error(
        "Failed to obtain tokens in popup mode. Aborting iframe creation."
      );
      return;
    }
  } else { // Redirect mode
    tokens = await obtainTokensRedirectMode();
    if (!tokens) {
      // Redirect initiated; page will reload with tokens
      return;
    }
  }

  showAuthenticatedUI(tokens);

  // Iterate over configured iframes and create them
  Object.entries(iframeConfig).forEach(([panelId, iframeUrl]) => {
    if (!iframeUrl) {
      return;
    }

    const panelContainer = document.getElementById(panelId);
    if (!panelContainer) {
      console.warn(`Panel container "${panelId}" not found in DOM`);
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.title = `Iframe for ${panelId}`;
    iframe.id = `${panelId}-iframe`;

    // Setup onload handler BEFORE setting src to ensure we catch the load event
    iframe.onload = async function () {
      try {
        await waitForIframeReady(iframe, targetOrigin);

        await postTokensToIframe(iframe, tokens, targetOrigin);

        setupIframeNavigation(iframe, targetOrigin, panelId);
      } catch (error) {
        console.error(`Token injection error for ${iframe.id}:`, error);
      }
    };

    panelContainer.innerHTML = "";
    panelContainer.appendChild(iframe);

    const existingData = iframeData.get(iframe.id) || {};
    iframeData.set(iframe.id, {
      ...existingData,
      iframe: iframe,
      originalUrl: iframeUrl,
      panelId: panelId
    });

    iframe.src = iframeUrl;
  });
};

window.loadIframes();
