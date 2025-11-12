# Nobl9 Embedded Iframe Authentication Demo

This directory demonstrates how to embed authenticated Nobl9 console content via iframes while acquiring and injecting tokens from the parent page.

## Overview

This demo provides a production-ready example of:
- **Token Acquisition**: Obtaining authentication tokens via OAuth redirect or popup flows
- **Token Injection**: Securely passing tokens to embedded Nobl9 iframes using postMessage protocol
- **Iframe Authentication**: Automatically authenticating embedded Nobl9 content without requiring users to log in separately

## Dependencies

This script requires the [okta-auth-js](https://github.com/okta/okta-auth-js) library to be loaded before use.

## Prerequisite: Existing IdP Session
The sample assumes you already have an active authenticated session with the Identity Provider (IdP) configured for your Nobl9 tenant. If the session does not exist when the page loads:
- The script will initiate an authentication flow
- You will be prompted to log in to Nobl9 before tokens can be injected into the iframes

## Configuration

Before using the script, you must configure the following:

- `n9AuthConfig`: Set N9 auth server issuer, clientId, and other authentication parameters.
- `targetOrigin`: Set this to match the domain of your embedded iframes for secure postMessage communication.

Example:
```javascript
const n9AuthConfig = {
    issuer: 'https://your-n9-auth-domain/oauth2/default',
    clientId: 'your-client-id',
    redirectUri: window.location.origin + '/sample/dashboard.html',
    scopes: ['openid', 'profile', 'email'],
    pkce: true,
    tokenManager: {
        storage: 'localStorage',
        key: 'n9Auth'
    }
};

const targetOrigin = 'https://app.nobl9.com';
```

## Two Authentication Methods
The JavaScript (`n9-iframe-auth.js`) supports two acquisition modes controlled by `iframeAuthMode`:

### 1. Redirect Mode (default)
- If tokens are not already present in the URL, the page triggers an OAuth redirect.
- The browser navigates to the IdP, the user session is validated, then returns with tokens in the URL.
- On reload, `parseRedirectTokens()` extracts tokens, cleans the URL, and proceeds to create iframes.
- Recommendation: Start the Nobl9 authentication early (before heavy app bootstrapping) to minimize perceived load time. Avoid delaying the redirect until after large bundles load.

### 2. Popup Mode
- Opens an OAuth popup and resolves when tokens are received.
- Requires that the browser allows popups; the script tests this via `checkPopupAllowed()`.
- Provides a smoother experience if you want to keep the main app context intact (no full-page navigation), but demands explicit user consent (browser UI permitting the popup).
- Fails fast with a clear alert if popups are blocked.

### Choosing a Mode
Set `const iframeAuthMode = 'redirect'` (default) or `'popup'` inside `n9-iframe-auth.js`.
Use redirect when you want maximal reliability and simplicity; use popup when uninterrupted SPA flow is preferred and you can guarantee popups are allowed.

## Running a Local Static Server on Port 8080
Port `8080` has been configured as an allowed authentication issuer / redirect origin in this example setup. To serve these files locally:

```bash
# From repository root (adjust path if already inside the directory)
python3 -m http.server 8080
```

Then open:
```
http://localhost:8080/sample/dashboard.html
```


## File Overview
| File                    | Purpose |
|-------------------------|---------|
| `sample/dashboard.html` | Sample page containing panel containers where iframes will be injected. |
| `sample/style.css`      | Minimal styling for layout (optional). |
| `n9-iframe-auth.js`     | Handles token acquisition (redirect/popup) and posts tokens to iframes. |
| `README.md`             | This documentation. |

## Future Enhancements (Suggested)
- Integrate token refresh / expiration handling for long-lived sessions
