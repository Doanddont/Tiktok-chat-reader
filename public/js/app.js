(function () {
  'use strict';

  let isConnected = false;

  function connect() {
    const input = document.getElementById('usernameInput');
    const select = document.getElementById('connectionType');
    if (!input) return;

    const username = input.value.trim().replace(/^@/, '');
    if (!username) {
      Toast.warning('Please enter a TikTok username');
      input.focus();
      return;
    }

    if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
      Toast.error('Invalid username format');
      input.focus();
      return;
    }

    const connectionType = select ? select.value : 'auto';

    UI.setStatus('connecting', `Connecting to @${username}...`);
    UI.setConnectUI(true);

    Socket.sendConnect(username, connectionType);
  }

  function disconnect() {
    Socket.sendDisconnect();
  }

  function handleConnectionState(state) {
    if (!state) return;

    switch (state.status) {
      case 'connected':
        isConnected = true;
        UI.setStatus('connected', `Connected to @${state.uniqueId || ''}`);
        UI.setConnectUI(true);
        UI.setConnectionMethod(state.activeMethod, state.fallbackUsed);
        UI.showStats(true);
        Toast.success(`Connected to @${state.uniqueId}${state.fallbackUsed ? ' (fallback)' : ''}`);
        break;

      case 'connecting':
        UI.setStatus('connecting', `Connecting to @${state.uniqueId || ''}...`);
        UI.setConnectUI(true);
        break;

      case 'failed':
        isConnected = false;
        UI.setStatus('failed', `Failed: ${state.failureReason || 'Unknown error'}`);
        UI.setConnectUI(false);
        UI.setConnectionMethod(null, false);
        UI.showStats(false);
        Toast.error(state.failureReason || 'Connection failed');
        break;

      case 'disconnected':
        isConnected = false;
        UI.setStatus('disconnected', 'Not connected');
        UI.setConnectUI(false);
        UI.setConnectionMethod(null, false);
        UI.showStats(false);
        break;
    }
  }

  // Socket event handlers
  Socket.on('open', () => {
    console.log('[WS] Connected to server');
  });

  Socket.on('close', () => {
    console.log('[WS] Disconnected from server');
  });

  Socket.on('init', (data) => {
    if (data.connectorVersion) {
      UI.setConnectorVersion(data.connectorVersion);
    }
    if (data.connection) {
      handleConnectionState(data.connection);
    }
    if (data.connected && data.stats) {
      UI.updateStat('viewerCount', data.stats.viewerCount);
      UI.updateStat('likeCount', data.stats.likeCount);
      UI.updateStat('diamondCount', data.stats.diamondsCount);
      UI.updateStat('giftCount', data.stats.giftCount);
      UI.updateStat('chatMsgCount', data.stats.chatCount);
    }
  });

  Socket.on('connectionState', handleConnectionState);

  Socket.on('connected', (data) => {
    // Also handled by connectionState, but keep for compatibility
  });

  Socket.on('disconnected', (data) => {
    isConnected = false;
    UI.setStatus('disconnected', 'Not connected');
    UI.setConnectUI(false);
    UI.setConnectionMethod(null, false);
    UI.showStats(false);
    if (data && data.reason) {
      Toast.info(`Disconnected: ${data.reason}`);
    }
  });

  Socket.on('error', (data) => {
    const msg = data?.message || 'Unknown error';
    Toast.error(msg);
    console.error('[TikTok Error]', msg);
  });

  Socket.on('toast', (data) => {
    if (data && data.message) {
      Toast.show(data.message, data.type || 'info');
    }
  });

  // TikTok events
  Socket.on('chat', (data) => {
    UI.addChat(data);
  });

  Socket.on('gift', (data) => {
    const giftImg = data.giftPictureUrl
      ? `<img class="gift-img" src="${UI.sanitizeUrl(data.giftPictureUrl)}" alt="${UI.sanitize(data.giftName)}" loading="lazy">`
      : '';
    const diamonds = (data.diamondCount || 0) * (data.repeatCount || 1);
    UI.addEvent(
      'gift', '🎁', 'gift',
      `<strong>${UI.sanitize(data.nickname || data.uniqueId)}</strong> sent ${giftImg}<span class="hl">${UI.sanitize(data.giftName)}</span> x${data.repeatCount || 1} (<span class="hl-cyan">${diamonds} 💎</span>)`,
      data
    );
  });

  Socket.on('like', (data) => {
    UI.addEvent(
      'like', '❤️', 'like',
      `<strong>${UI.sanitize(data.nickname || data.uniqueId)}</strong> liked <span class="hl">x${data.likeCount || 1}</span>`,
      data
    );
  });

  Socket.on('member', (data) => {
    UI.addEvent(
      'member', '👋', 'join',
      `<strong>${UI.sanitize(data.nickname || data.uniqueId)}</strong> joined the stream`,
      data
    );
  });

  Socket.on('follow', (data) => {
    UI.addEvent(
      'follow', '➕', 'follow',
      `<strong>${UI.sanitize(data.nickname || data.uniqueId)}</strong> followed`,
      data
    );
  });

  Socket.on('share', (data) => {
    UI.addEvent(
      'share', '🔗', 'share',
      `<strong>${UI.sanitize(data.nickname || data.uniqueId)}</strong> shared the stream`,
      data
    );
  });

  Socket.on('subscribe', (data) => {
    UI.addEvent(
      'subscribe', '⭐', 'subscribe',
      `<strong>${UI.sanitize(data.nickname || data.uniqueId)}</strong> subscribed${data.subMonth ? ` (${data.subMonth} months)` : ''}`,
      data
    );
  });

  Socket.on('question', (data) => {
    UI.addEvent(
      'question', '❓', 'question',
      `<strong>${UI.sanitize(data.nickname || data.uniqueId)}</strong> asked: <span class="hl-cyan">${UI.sanitize(data.questionText)}</span>`,
      data
    );
  });

  Socket.on('roomUser', (data) => {
    UI.updateStat('viewerCount', data.viewerCount || 0);
  });

  Socket.on('streamEnd', () => {
    isConnected = false;
    UI.setStatus('disconnected', 'Stream ended');
    UI.setConnectUI(false);
    UI.setConnectionMethod(null, false);
    Toast.warning('Stream has ended');
  });

  // Update stats periodically (from broadcast data)
  Socket.on('chat', () => {
    const el = document.getElementById('chatMsgCount');
    if (el) {
      const current = parseInt(el.textContent.replace(/[^0-9]/g, ''), 10) || 0;
      UI.updateStat('chatMsgCount', current + 1);
    }
  });

  // Check URL params
  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const username = params.get('username') || params.get('user') || params.get('u');
    const type = params.get('type') || params.get('method');

    if (username) {
      const input = document.getElementById('usernameInput');
      if (input) input.value = username;

      if (type && ['auto', 'connector', 'euler'].includes(type)) {
        const select = document.getElementById('connectionType');
        if (select) select.value = type;
      }

      setTimeout(() => connect(), 500);
    }
  }

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    Filters.init();
    Socket.connect();

    // Button handlers
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const usernameInput = document.getElementById('usernameInput');

    if (connectBtn) connectBtn.addEventListener('click', connect);
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnect);
    if (usernameInput) {
      usernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (isConnected) disconnect();
          else connect();
        }
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+K = focus username input
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (usernameInput) usernameInput.focus();
      }
      // Escape = disconnect
      if (e.key === 'Escape' && isConnected) {
        disconnect();
      }
    });

    checkUrlParams();
  });
})();