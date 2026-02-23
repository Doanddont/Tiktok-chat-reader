/**
 * WebSocket Client — Bun native WebSocket (no socket.io)
 */
const WS = (() => {
  let ws = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 10;
  const RECONNECT_DELAY = 3000;
  const handlers = {};

  function getUrl() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws`;
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    ws = new WebSocket(getUrl());

    ws.onopen = () => {
      reconnectAttempts = 0;
      emit('_open');
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed && parsed.event) {
          emit(parsed.event, parsed.data);
        }
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    ws.onclose = () => {
      emit('_close');
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT) return;
    reconnectAttempts++;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
  }

  function send(action, payload = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action, ...payload }));
    }
  }

  function on(event, callback) {
    if (!handlers[event]) handlers[event] = [];
    handlers[event].push(callback);
  }

  function off(event, callback) {
    if (!handlers[event]) return;
    handlers[event] = handlers[event].filter((cb) => cb !== callback);
  }

  function emit(event, data) {
    if (handlers[event]) {
      handlers[event].forEach((cb) => cb(data));
    }
  }

  function sendConnect(uniqueId) {
    send('connect', { uniqueId });
  }

  function sendDisconnect() {
    send('disconnect');
  }

  // Auto-connect WebSocket on load
  connect();

  return { on, off, sendConnect, sendDisconnect, connect: connect };
})();
