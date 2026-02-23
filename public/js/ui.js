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

  let chatAutoScroll = true;
  let eventsAutoScroll = true;

  // =============================================
  // Helpers
  // =============================================
  
  // Only used for complex event messages (gifts/etc) where HTML structure is needed
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
      dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight;
    }
  }

  function scrollEvents() {
    if (eventsAutoScroll) {
      dom.eventsContainer.scrollTop = dom.eventsContainer.scrollHeight;
    }
  }

  // =============================================
  // Trim old messages
  // =============================================
  function trimChat() {
    // SECURITY FIX: Check actual DOM length, not a variable that might desync
    while (dom.chatContainer.childElementCount > MAX_CHAT) {
      dom.chatContainer.firstChild.remove();
    }
    // Update counter based on actual messages, excluding the empty state div if it exists
    const count = dom.chatContainer.querySelectorAll('.chat-message').length;
    dom.chatCounter.textContent = `${count} messages`;
  }

  function trimEvents() {
    while (dom.eventsContainer.childElementCount > MAX_EVENTS) {
      dom.eventsContainer.firstChild.remove();
    }
    const count = dom.eventsContainer.querySelectorAll('.event-item').length;
    dom.eventsCounter.textContent = `${count} events`;
  }

  // =============================================
  // Render Chat Message (Optimized)
  // =============================================
  function addChat(data) {
    dom.chatEmptyState?.classList.add('hidden');

    const visible = Filters.shouldShow('chat', data);
    
    // Create Main Container
    const el = document.createElement('div');
    el.className = 'chat-message';
    if (!visible) el.classList.add('filtered-out');
    
    el.dataset.eventType = 'chat';
    el.dataset.eventData = JSON.stringify({
      uniqueId: data.uniqueId,
      nickname: data.nickname,
      comment: data.comment,
    });

    // 1. Avatar
    const img = document.createElement('img');
    img.className = 'chat-avatar';
    img.loading = 'lazy';
    img.src = data.profilePictureUrl || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><rect width='80' height='80' rx='40' fill='%231e1e1e'/><text x='40' y='48' text-anchor='middle' fill='%23555' font-size='30'>?</text></svg>";
    
    // 2. Body Container
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'chat-body';

    // 3. Meta (Username + Badges)
    const metaSpan = document.createElement('span');
    metaSpan.className = 'chat-meta';

    // Badges logic
    if (data.userBadges?.length) {
      const badgeSpan = document.createElement('span');
      badgeSpan.className = 'chat-badges';
      data.userBadges.forEach(b => {
        if (b.url) {
          const bImg = document.createElement('img');
          bImg.className = 'chat-badge';
          bImg.src = b.url;
          badgeSpan.appendChild(bImg);
        }
      });
      metaSpan.appendChild(badgeSpan);
    }

    // Username logic
    const userSpan = document.createElement('span');
    userSpan.className = 'chat-username';
    if (data.isModerator) userSpan.classList.add('mod');
    else if (data.isSubscriber) userSpan.classList.add('sub');
    userSpan.textContent = data.nickname || data.uniqueId; // SECURITY: textContent prevents XSS
    metaSpan.appendChild(userSpan);

    // 4. Comment Text
    const commentSpan = document.createElement('span');
    commentSpan.className = 'chat-text';
    commentSpan.textContent = data.comment; // SECURITY: textContent prevents XSS

    // Assemble
    bodyDiv.appendChild(metaSpan);
    bodyDiv.appendChild(commentSpan);
    el.appendChild(img);
    el.appendChild(bodyDiv);

    dom.chatContainer.appendChild(el);
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

    // Note: We use innerHTML here for complex event formatting (colors/bolding)
    // The inputs should be sanitized by the caller using UI.sanitize()
    el.innerHTML = `
      <div class="event-icon-wrap ${iconClass}">${emoji}</div>
      <div class="event-body">
        <div class="event-text">${html}</div>
      </div>
      <span class="event-time">${timeStr()}</span>
    `;

    dom.eventsContainer.appendChild(el);
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
    dom.chatContainer.innerHTML = '';
    if (dom.chatEmptyState) {
      dom.chatContainer.appendChild(dom.chatEmptyState);
      dom.chatEmptyState.classList.remove('hidden');
    }
    dom.chatCounter.textContent = '0 messages';
  }

  function clearEvents() {
    dom.eventsContainer.innerHTML = '';
    if (dom.eventsEmptyState) {
      dom.eventsContainer.appendChild(dom.eventsEmptyState);
      dom.eventsEmptyState.classList.remove('hidden');
    }
    dom.eventsCounter.textContent = '0 events';
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
