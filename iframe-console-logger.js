const IframeConsoleLogger = (() => {
  const logToConsole = (panelId, direction, messageType, payload = {}) => {
    const consoleContent = document.getElementById(`console-content-${panelId}`);
    if (!consoleContent) return;

    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });

    const entry = document.createElement('div');
    entry.className = `console-entry ${direction}`;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'console-entry-time';
    timeSpan.textContent = timestamp;

    const labelSpan = document.createElement('span');
    labelSpan.className = `console-entry-label ${direction}`;
    labelSpan.textContent = direction === 'outgoing' ? '→ OUT:' : '← IN:';

    const contentSpan = document.createElement('span');
    contentSpan.className = 'console-entry-content';

    let payloadStr = '';
    try {
      const simplifiedPayload = { ...payload };
      if (simplifiedPayload.accessToken) {
        simplifiedPayload.accessToken = simplifiedPayload.accessToken.substring(0, 20) + '...';
      }
      if (simplifiedPayload.idToken) {
        simplifiedPayload.idToken = simplifiedPayload.idToken.substring(0, 20) + '...';
      }
      payloadStr = JSON.stringify(simplifiedPayload, null, 2);
    } catch (e) {
      payloadStr = String(payload);
    }

    contentSpan.textContent = `${messageType} ${payloadStr}`;

    entry.appendChild(timeSpan);
    entry.appendChild(labelSpan);
    entry.appendChild(contentSpan);

    consoleContent.appendChild(entry);
    consoleContent.scrollTop = consoleContent.scrollHeight;
  };

  const clearConsole = (panelId) => {
    const consoleContent = document.getElementById(`console-content-${panelId}`);
    if (consoleContent) {
      consoleContent.innerHTML = '';
    }
  };

  return {
    log: logToConsole,
    clear: clearConsole
  };
})();
