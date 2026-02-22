/**
 * UI Rendering Module
 */
const UI = (() => {
  // DOM Cache
  const $ = (id) => document.getElementById(id);

  const dom = {
    chatContainer:    $('chatContainer'),
    eventsContainer:  $('eventsContainer'),
    chatEmptyState:   $('chatEmptyState'),
    eventsEmptyState: $('eventsEmptyState'),
    chatCounter:      $('chatCounter'),
    eventsCounter:    $('eventsCounter'),
    viewerCount:      $('viewerCount'),
    likeCount:        $('likeCount'),
    diamondCount:     $('diamondCount'),
    giftCount:        $('giftCount'),
    chatMsgCount:     $('chatMsgCount'),
    statusDot:        $('statusDot'),
    statusText:       $('statusText'),
    statsContainer:   $('statsContainer'),
    connectBtn:       $('connectBtn'),
    disconnectBtn:    $('disconnectBtn'),
    usernameInput:    $('usernameInput'),
    clearChatBtn:     $('clearChatBtn'),
    clearEventsBtn:   $('clearEventsBtn'),
  };

  const MAX_CHAT = 300;
  const MAX_EVENTS = 200;

  let chatCount = 0;
  let eventCount = 0;
  let chatAutoScroll = true;
  let eventsAutoScroll = true;

  // =============================================
  // Helpers
  // =============================================
  function sanitize(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function formatNum(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }

  function timeStr() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function avatarUrl(url) {
    return url || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><rect width='80' height='80' rx='40' fill='%231e1e1e'/><text x='40' y='48' text-anchor='middle' fill='%23555' font-size='30'>?</text></svg>";
  }

  // =============================================
  // Auto Scroll
  // =============================================
  function initAutoScroll() {
    dom.chatContainer.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = dom.chatContainer;
      chatAutoScroll = scrollHeight - scrollTop - clientHeight < 60;
    });
    dom.eventsContainer.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = dom.eventsContainer;
      eventsAutoScroll = scrollHeight - scrollTop - clientHeight < 60;
    });
  }

  function scrollChat() {
    if (chatAutoScroll) {
      requestAnimationFrame(() => {
        dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight;
      });
    }
  }

  function scrollEvents() {
    if (eventsAutoScroll) {
      requestAnimationFrame(() => {
        dom.eventsContainer.scrollTop = dom.eventsContainer.scrollHeight;
      });
    }
  }

  // =============================================
  // Trim old messages
  // =============================================
  function trimChat() {
    while (chatCount > MAX_CHAT) {
      const first = dom.chatContainer.querySelector('.chat-message');
      if (first) { first.remove(); chatCount--; }
      else break;
    }
  }

  function trimEvents() {
    while (eventCount > MAX_EVENTS) {
      const first = dom.eventsContainer.querySelector('.event-item');
      if (first) { first.remove(); eventCount--; }
      else break;
    }
  }

  // =============================================
  // Render Chat Message
  // =============================================
  function addChat(data) {
    dom.chatEmptyState?.classList.add('hidden');

    // Badges
    let badges = '';
    if (data.userBadges?.length) {
      badges = '<span class="chat-badges">';
      data.userBadges.forEach(b => {
        if (b.url) badges += `<img class="chat-badge" src="${sanitize(b.url)}" alt="${sanitize(b.type || '')}" loading="lazy">`;
      });
      badges += '</span>';
    }

    // Top gifter
    let topGifter = '';
    if (data.topGifterRank && data.topGifterRank <= 3) {
      const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
      topGifter = `<span class="chat-top-gifter">${medals[data.topGifterRank]} #${data.topGifterRank}</span>`;
    }

    // Username class
    let uClass = 'chat-username';
    if (data.isModerator) uClass += ' mod';
    else if (data.isSubscriber) uClass += ' sub';

    const visible = Filters.shouldShow('chat', data);

    const el = document.createElement('div');
    el.className = `chat-message${visible ? '' : ' filtered-out'}`;
    el.dataset.eventType = 'chat';
    el.dataset.eventData = JSON.stringify({
      uniqueId: data.uniqueId,
      nickname: data.nickname,
      comment: data.comment,
    });

    el.innerHTML = `
      <img class="chat-avatar" src="${avatarUrl(data.profilePictureUrl)}" alt="" loading="lazy">
      <div class="chat-body">
        <span class="chat-meta">
          ${topGifter}${badges}<span class="${uClass}" title="@${sanitize(data.uniqueId)}">${sanitize(data.nickname || data.uniqueId)}</span>
        </span>
        <span class="chat-text">${sanitize(data.comment)}</span>
      </div>
    `;

    dom.chatContainer.appendChild(el);
    chatCount++;
    dom.chatCounter.textContent = `${chatCount} messages`;
    trimChat();
    scrollChat();
  }

  // =============================================
  // Render Event
  // =============================================
  function addEvent(eventType, emoji, iconClass, html, data = {}) {
    dom.eventsEmptyState?.classList.add('hidden');

    const visible = Filters.shouldShow(eventType, data);

    const el = document.createElement('div');
    el.className = `event-item${visible ? '' : ' filtered-out'}`;
    el.dataset.eventType = eventType;
    el.dataset.eventData = JSON.stringify({
      uniqueId: data.uniqueId,
      nickname: data.nickname,
      comment: data.comment || data.questionText || '',
      diamondCount: data.diamondCount || 0,
      repeatCount: data.repeatCount || 1,
    });

    el.innerHTML = `
      <div class="event-icon-wrap ${iconClass}">${emoji}</div>
      <div class="event-body">
        <div class="event-text">${html}</div>
      </div>
      <span class="event-time">${timeStr()}</span>
    `;

    dom.eventsContainer.appendChild(el);
    eventCount++;
    dom.eventsCounter.textContent = `${eventCount} events`;
    trimEvents();
    scrollEvents();
  }

  // =============================================
  // Status
  // =============================================
  function setStatus(status, message) {
    dom.statusDot.className = 'status-dot';
    dom.connectBtn.disabled = false;

    switch (status) {
      case 'connected':
        dom.statusDot.classList.add('connected');
        dom.statusText.textContent = message || 'Connected';
        dom.connectBtn.classList.add('hidden');
        dom.disconnectBtn.classList.remove('hidden');
        dom.statsContainer.classList.remove('hidden');
        break;
      case 'connecting':
        dom.statusDot.classList.add('connecting');
        dom.statusText.textContent = 'Connecting...';
        dom.connectBtn.disabled = true;
        break;
      case 'disconnected':
      default:
        dom.statusText.textContent = message || 'Not connected';
        dom.connectBtn.classList.remove('hidden');
        dom.disconnectBtn.classList.add('hidden');
        dom.statsContainer.classList.add('hidden');
        break;
    }
  }

  // =============================================
  // Update Stats
  // =============================================
  function updateStat(id, value) {
    const el = dom[id];
    if (el) el.textContent = formatNum(value);
  }

  // =============================================
  // Clear
  // =============================================
  function clearChat() {
    // Remove all chat messages but keep empty state
    dom.chatContainer.querySelectorAll('.chat-message').forEach(el => el.remove());
    chatCount = 0;
    dom.chatCounter.textContent = '0 messages';
    if (dom.chatEmptyState) {
      dom.chatEmptyState.classList.remove('hidden');
    }
  }

  function clearEvents() {
    dom.eventsContainer.querySelectorAll('.event-item').forEach(el => el.remove());
    eventCount = 0;
    dom.eventsCounter.textContent = '0 events';
    if (dom.eventsEmptyState) {
      dom.eventsEmptyState.classList.remove('hidden');
    }
  }

  // =============================================
  // Init
  // =============================================
  function init() {
    initAutoScroll();
  }

  return {
    dom,
    init,
    addChat,
    addEvent,
    setStatus,
    updateStat,
    clearChat,
    clearEvents,
    sanitize,
    formatNum,
  };
})();
