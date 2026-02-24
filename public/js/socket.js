const Socket = (() => {
  let ws = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000;
  const listeners = {};
  let intentionalClose = false;

  function getUrl() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws`;
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return;
    }

    intentionalClose = false;
    clearTimeout(reconnectTimer);

    try {
      ws = new WebSocket(getUrl());
    } catch (err) {
      emit('error', { message: 'Failed to create WebSocket' });
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectAttempts = 0;
      emit('open');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg && msg.event) {
          if (msg.event === 'ping') return; // ignore heartbeats
          emit(msg.event, msg.data);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      emit('close');
      if (!intentionalClose) {
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      emit('error', { message: 'WebSocket connection error' });
    };
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= maxReconnectAttempts) {
      emit('reconnectFailed');
      return;
    }

    const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts), 30000);
    reconnectAttempts++;

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      emit('reconnecting', { attempt: reconnectAttempts });
      connect();
    }, delay);
  }

  function send(action, payload = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action, ...payload }));
    }
  }

  function on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
  }

  function off(event, callback) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter((cb) => cb !== callback);
  }

  function emit(event, data) {
    if (listeners[event]) {
      listeners[event].forEach((cb) => {
        try { cb(data); } catch {}
      });
    }
  }

  function sendConnect(uniqueId, connectionType) {
    send('connect', { uniqueId, connectionType: connectionType || 'auto' });
  }

  function sendDisconnect() {
    send('disconnect');
  }

  function close() {
    intentionalClose = true;
    clearTimeout(reconnectTimer);
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  return { connect, send, on, off, sendConnect, sendDisconnect, close };
})();