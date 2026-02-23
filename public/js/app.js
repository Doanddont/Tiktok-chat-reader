/**
 * Main Application — wires everything together
 */
;(function () {
  'use strict';

  // =============================================
  // Initialize modules
  // =============================================
  UI.init();
  Filters.init((filterState) => {
    // Optional: log filter changes
  });

  // =============================================
  // Connection Actions
  // =============================================
  function connect() {
    const uniqueId = UI.dom.usernameInput.value.trim();
    if (!uniqueId) {
      Toast.error('Please enter a TikTok username');
      UI.dom.usernameInput.focus();
      return;
    }
    UI.setStatus('connecting');
    WS.sendConnect(uniqueId);
  }

  function disconnect() {
    WS.sendDisconnect();
    UI.setStatus('disconnected');
  }

  // =============================================
  // DOM Events
  // =============================================
  UI.dom.connectBtn.addEventListener('click', connect);
  UI.dom.disconnectBtn.addEventListener('click', disconnect);

  UI.dom.usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') connect();
  });

  UI.dom.clearChatBtn.addEventListener('click', () => {
    UI.clearChat();
    // Reset internal counters if needed
    totalStats.chatMsgCount = 0;
  });
  
  UI.dom.clearEventsBtn.addEventListener('click', () => UI.clearEvents());

  // =============================================
  // WebSocket Events
  // =============================================

  // Track total stats locally
  let totalStats = { 
    chatMsgCount: 0, // Added this
    chatCount: 0, 
    giftCount: 0, 
    diamondsCount: 0 
  };

  // Connection status
  WS.on('connected', (data) => {
    UI.setStatus('connected', `Connected to @${data.uniqueId}`);
    Toast.success(`Connected to @${data.uniqueId}`);
  });

  WS.on('disconnected', (data) => {
    UI.setStatus('disconnected', data?.message || 'Disconnected');
    Toast.info(data?.message || 'Disconnected');
  });

  WS.on('error', (data) => {
    UI.setStatus('disconnected', data?.message);
    Toast.error(data?.message || 'An error occurred');
  });

  // Chat
  WS.on('chat', (data) => {
    UI.addChat(data);
    totalStats.chatMsgCount++; // Increment local counter
    UI.updateStat('chatMsgCount', totalStats.chatMsgCount);
  });

  // Gift
  WS.on('gift', (data) => {
    // Only show streak-end or non-streak gifts
    if (data.giftType === 1 && !data.repeatEnd) return;

    const giftImg = data.giftPictureUrl
      ? `<img class="gift-img" src="${UI.sanitize(data.giftPictureUrl)}" alt="${UI.sanitize(data.giftName)}">`
      : '';

    const totalDiamonds = (data.diamondCount || 0) * (data.repeatCount || 1);
    totalStats.diamondsCount += totalDiamonds;
    totalStats.giftCount++;

    UI.addEvent('gift', '🎁', 'gift',
      `<strong>${UI.sanitize(data.nickname || data.uniqueId)}</strong> sent <span class="hl">${UI.sanitize(data.giftName)}</span> ${giftImg} x${data.repeatCount || 1} <span class="hl-cyan">(💎 ${UI.formatNum(totalDiamonds)})</span>`,
      data
    );

    UI.updateStat('diamondCount', totalStats.diamondsCount);
    UI.updateStat('giftCount', totalStats.giftCount);
  });

  // Like
  WS.on('like', (data) => {
    UI.updateStat('likeCount', data.totalLikeCount || 0);

    UI.addEvent('like', '❤️', 'like',
      `<strong>${UI.sanitize(data.nickname || data.uniqueId)}</strong> sent <span class="hl">${data.likeCount}</span> likes`,
      data
    );
  });

  // Follow
  WS.on('follow', (data) => {
    UI.addEvent('follow', '➕', 'follow',
      `<strong>${UI.sanitize(data.nickname || data.uniqueId)}</strong> followed!`,
      data
    );
  });

  // Share
  WS.on('share', (data) => {
    UI.addEvent('share', '🔗', 'share',
      `<strong>${UI.sanitize(data.nickname || data.uniqueId)}</strong> shared the stream`,
      data
    );
  });

  // Member join
  WS.on('member', (data) => {
    UI.addEvent('join', '👋', 'join',
      `<strong>${UI.sanitize(data.nickname || data.uniqueId)}</strong> joined`,
      data
    );
  });

  // Subscribe
  WS.on('subscribe', (data) => {
    UI.addEvent('subscribe', '⭐', 'subscribe',
      `<strong>${UI.sanitize(data.nickname || data.uniqueId)}</strong> subscribed!`,
      data
    );
  });

  // Question
  WS.on('question', (data) => {
    UI.addEvent('question', '❓', 'question',
      `<strong>${UI.sanitize(data.nickname || data.uniqueId)}</strong> asked: <em>"${UI.sanitize(data.questionText)}"</em>`,
      data
    );
  });

  // Room user / viewer count
  WS.on('roomUser', (data) => {
    UI.updateStat('viewerCount', data.viewerCount || 0);
  });

  // Stream end
  WS.on('streamEnd', () => {
    UI.setStatus('disconnected', 'Stream has ended');
    Toast.warning('The live stream has ended');
  });

  // =============================================
  // URL Parameter Support
  // =============================================
  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const uniqueId = params.get('uniqueId') || params.get('username') || params.get('u');

    if (uniqueId) {
      UI.dom.usernameInput.value = uniqueId.replace(/^@/, '');
      setTimeout(connect, 800);
    }
  }

  // =============================================
  // Keyboard Shortcuts
  // =============================================
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K = focus username input
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      UI.dom.usernameInput.focus();
      UI.dom.usernameInput.select();
    }
    // Escape = blur
    if (e.key === 'Escape') {
      document.activeElement?.blur();
    }
  });

  // =============================================
  // Start
  // =============================================
  checkUrlParams();
  UI.dom.usernameInput.focus();

})();
