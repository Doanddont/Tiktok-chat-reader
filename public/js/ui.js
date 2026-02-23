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

  // Whitelist of valid icon classes for event items
  const VALID_ICON_CLASSES = new Set([
    'gift', 'follow', 'share', 'join', 'like', 'subscribe', 'question'
  ]);

  let chatAutoScroll = true;
  let eventsAutoScroll = true;

  // =============================================
  // Helpers
  // =============================================

  // HTML entity escaping for use in innerHTML contexts
  function sanitize(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // URL validation — only allow http(s) URLs
  function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return url;
      }
    } catch (e) {
      // invalid URL
    }
    return '';
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
    while (dom.chatContainer.querySelectorAll('.chat-message').length > MAX_CHAT) {
      const first = dom.chatContainer.querySelector('.chat-message');
      if (first) first.remove();
      else break;
    }
    const count = dom.chatContainer.querySelectorAll('.chat-message').length;
    dom.chatCounter.textContent = `${count} messages`;
  }

  function trimEvents() {
    while (dom.eventsContainer.querySelectorAll('.event-item').length > MAX_EVENTS) {
      const first = dom.eventsContainer.querySelector('.event-item');
      if (first) first.remove();
      else break;
    }
    const count = dom.eventsContainer.querySelectorAll('.event-item').length;
    dom.eventsCounter.textContent = `${count} events`;
  }

  // =============================================
  // Render Chat Message
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
    const avatarUrl = sanitizeUrl(data.profilePictureUrl);
    img.src = avatarUrl || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><rect width='80' height='80' rx='40' fill='%231e1e1e'/><text x='40' y='48' text-anchor='middle' fill='%23555' font-size='30'>?</text></svg>";

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
        const badgeUrl = sanitizeUrl(b.url);
        if (badgeUrl) {
          const bImg = document.createElement('img');
          bImg.className = 'chat-badge';
          bImg.src = badgeUrl;
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
    userSpan.textContent = data.nickname || data.uniqueId;
    metaSpan.appendChild(userSpan);

    // 4. Comment Text
    const commentSpan = document.createElement('span');
    commentSpan.className = 'chat-text';
    commentSpan.textContent = data.comment;

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

    // Validate iconClass against whitelist
    const safeIconClass = VALID_ICON_CLASSES.has(iconClass) ? iconClass : '';

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

    // Build DOM safely
    const iconWrap = document.createElement('div');
    iconWrap.className = 'event-icon-wrap';
    if (safeIconClass) iconWrap.classList.add(safeIconClass);
    iconWrap.textContent = emoji;

    const eventBody = document.createElement('div');
    eventBody.className = 'event-body';

    const eventText = document.createElement('div');
    eventText.className = 'event-text';
    // html is pre-sanitized by the caller using UI.sanitize()
    eventText.innerHTML = html;

    eventBody.appendChild(eventText);

    const timeSpan = document.createElement('span');
    timeSpan.className = 'event-time';
    timeSpan.textContent = timeStr();

    el.appendChild(iconWrap);
    el.appendChild(eventBody);
    el.appendChild(timeSpan);

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
  // Clear — safely preserves empty state elements
  // =============================================
  function clearChat() {
    // Remove only chat-message elements, keep empty state intact
    const messages = dom.chatContainer.querySelectorAll('.chat-message');
    messages.forEach((msg) => msg.remove());

    if (dom.chatEmptyState) {
      dom.chatEmptyState.classList.remove('hidden');
    }
    dom.chatCounter.textContent = '0 messages';
  }

  function clearEvents() {
    // Remove only event-item elements, keep empty state intact
    const items = dom.eventsContainer.querySelectorAll('.event-item');
    items.forEach((item) => item.remove());

    if (dom.eventsEmptyState) {
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
    sanitizeUrl,
    formatNum,
  };
})();
