window.N9_CONFIG = {
  auth: {
    issuer: 'https://n9-domain/oauth2/',
    clientId: 'client-id',
    redirectUri: window.location.origin + '/sample/dashboard.html',
    scopes: ['openid', 'profile', 'email'],
    pkce: true,
    tokenManager: {
      storage: 'localStorage',
      key: 'n9Auth'
    }
  },
  iframes: {
    'panel-1': 'https://example.com/reports/details/report-1?embedMode=minimal&waitExternalAuth=true',
    // 'panel-2': 'null',
  },
  targetOrigin: 'https://n9-domain',
  authMode: 'redirect',
};
