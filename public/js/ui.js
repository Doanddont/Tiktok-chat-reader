const UI = (() => {
  const $ = (id) => document.getElementById(id);

  const MAX_CHAT = 500;
  const MAX_EVENTS = 500;
  let chatCount = 0;
  let eventsCount = 0;
  let chatAutoScroll = true;
  let eventsAutoScroll = true;

  function sanitize(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function sanitizeUrl(url) {
    if (typeof url !== 'string') return '';
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.href;
      }
    } catch {}
    return '';
  }

  function formatNum(n) {
    if (typeof n !== 'number' || isNaN(n)) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  function timeStr() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
  }

  function initAutoScroll() {
    const chatContainer = $('chatContainer');
    const eventsContainer = $('eventsContainer');

    if (chatContainer) {
      chatContainer.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = chatContainer;
        chatAutoScroll = scrollHeight - scrollTop - clientHeight < 60;
      });
    }

    if (eventsContainer) {
      eventsContainer.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = eventsContainer;
        eventsAutoScroll = scrollHeight - scrollTop - clientHeight < 60;
      });
    }
  }

  function scrollChat() {
    if (!chatAutoScroll) return;
    const el = $('chatContainer');
    if (el) el.scrollTop = el.scrollHeight;
  }

  function scrollEvents() {
    if (!eventsAutoScroll) return;
    const el = $('eventsContainer');
    if (el) el.scrollTop = el.scrollHeight;
  }

  function trimChat() {
    const el = $('chatContainer');
    if (!el) return;
    while (el.children.length > MAX_CHAT + 1) {
      const first = el.querySelector('.chat-message');
      if (first) first.remove();
      else break;
    }
  }

  function trimEvents() {
    const el = $('eventsContainer');
    if (!el) return;
    while (el.children.length > MAX_EVENTS + 1) {
      const first = el.querySelector('.event-item');
      if (first) first.remove();
      else break;
    }
  }

  function addChat(data) {
    const container = $('chatContainer');
    const emptyState = $('chatEmptyState');
    if (!container) return;
    if (emptyState) emptyState.classList.add('hidden');

    const visible = Filters.shouldShow('chat', data);

    const div = document.createElement('div');
    div.className = `chat-message${visible ? '' : ' filtered-out'}`;
    div.dataset.type = 'chat';
    div.dataset.uniqueId = data.uniqueId || '';
    div.dataset.nickname = data.nickname || '';
    div.dataset.comment = data.comment || '';

    const avatarUrl = sanitizeUrl(data.profilePictureUrl);
    const usernameClass = data.isModerator ? 'mod' : data.isSubscriber ? 'sub' : '';

    let badgesHtml = '';
    if (data.userBadges && data.userBadges.length > 0) {
      badgesHtml = '<span class="chat-badges">' +
        data.userBadges.map(b => {
          const url = sanitizeUrl(b.url);
          return url ? `<img class="chat-badge" src="${url}" alt="${sanitize(b.name)}" title="${sanitize(b.name)}">` : '';
        }).join('') + '</span>';
    }

    let topGifterHtml = '';
    if (data.topGifterRank && data.topGifterRank <= 3) {
      const labels = { 1: '🥇 #1', 2: '🥈 #2', 3: '🥉 #3' };
      topGifterHtml = `<span class="chat-top-gifter">${labels[data.topGifterRank]}</span>`;
    }

    div.innerHTML = `
      ${avatarUrl ? `<img class="chat-avatar" src="${avatarUrl}" alt="" loading="lazy">` : '<div class="chat-avatar"></div>'}
      <div class="chat-body">
        <div class="chat-meta">
          ${badgesHtml}
          ${topGifterHtml}
          <span class="chat-username ${usernameClass}" title="@${sanitize(data.uniqueId)}">${sanitize(data.nickname || data.uniqueId)}</span>
        </div>
        <div class="chat-text">${sanitize(data.comment)}</div>
      </div>
    `;

    container.appendChild(div);
    chatCount++;
    updateCounter('chatCounter', chatCount, 'messages');
    trimChat();
    scrollChat();
  }

  function addEvent(eventType, emoji, iconClass, html, data = {}) {
    const container = $('eventsContainer');
    const emptyState = $('eventsEmptyState');
    if (!container) return;
    if (emptyState) emptyState.classList.add('hidden');

    const visible = Filters.shouldShow(eventType, data);

    const div = document.createElement('div');
    div.className = `event-item${visible ? '' : ' filtered-out'}`;
    div.dataset.type = eventType;
    div.dataset.uniqueId = data.uniqueId || '';
    div.dataset.nickname = data.nickname || '';

    if (eventType === 'gift') {
      div.dataset.diamonds = String(data.diamondCount || 0);
      div.dataset.repeat = String(data.repeatCount || 1);
    }
    if (eventType === 'question') {
      div.dataset.questionText = data.questionText || '';
    }

    div.innerHTML = `
      <div class="event-icon-wrap ${iconClass}">${emoji}</div>
      <div class="event-body">
        <div class="event-text">${html}</div>
        <div class="event-time">${timeStr()}</div>
      </div>
    `;

    container.appendChild(div);
    eventsCount++;
    updateCounter('eventsCounter', eventsCount, 'events');
    trimEvents();
    scrollEvents();
  }

  function updateCounter(id, count, label) {
    const el = $(id);
    if (el) el.textContent = `${formatNum(count)} ${label}`;
  }

  function setStatus(status, message) {
    const dot = $('statusDot');
    const text = $('statusText');
    if (dot) {
      dot.className = 'status-dot';
      if (status === 'connected') dot.classList.add('connected');
      else if (status === 'connecting') dot.classList.add('connecting');
      else if (status === 'failed') dot.classList.add('failed');
    }
    if (text) text.textContent = message || '';
  }

  function setConnectionMethod(method, fallback) {
    const badge = $('methodBadge');
    const icon = $('methodIcon');
    const methodText = $('methodText');
    const fallbackBadge = $('fallbackBadge');

    if (!badge) return;

    if (!method) {
      badge.classList.add('hidden');
      if (fallbackBadge) fallbackBadge.classList.add('hidden');
      return;
    }

    badge.classList.remove('hidden', 'connector', 'euler');
    badge.classList.add(method);

    if (icon) icon.textContent = method === 'connector' ? '📦' : '⚡';
    if (methodText) methodText.textContent = method === 'connector' ? 'Connector' : 'Euler WS';
    if (fallbackBadge) fallbackBadge.classList.toggle('hidden', !fallback);
  }

  function setConnectorVersion(version) {
    const el = $('connectorVersion');
    if (el) el.textContent = version ? `v${version}` : '';
  }

  function updateStat(id, value) {
    const el = $(id);
    if (el) el.textContent = formatNum(value);
  }

  function showStats(show) {
    const el = $('statsContainer');
    if (el) el.classList.toggle('hidden', !show);
  }

  function clearChat() {
    const container = $('chatContainer');
    const emptyState = $('chatEmptyState');
    if (container) {
      container.innerHTML = '';
      if (emptyState) {
        container.appendChild(emptyState);
        emptyState.classList.remove('hidden');
      }
    }
    chatCount = 0;
    updateCounter('chatCounter', 0, 'messages');
  }

  function clearEvents() {
    const container = $('eventsContainer');
    const emptyState = $('eventsEmptyState');
    if (container) {
      container.innerHTML = '';
      if (emptyState) {
        container.appendChild(emptyState);
        emptyState.classList.remove('hidden');
      }
    }
    eventsCount = 0;
    updateCounter('eventsCounter', 0, 'events');
  }

  function setConnectUI(connecting) {
    const connectBtn = $('connectBtn');
    const disconnectBtn = $('disconnectBtn');
    const input = $('usernameInput');
    const select = $('connectionType');

    if (connecting) {
      if (connectBtn) { connectBtn.classList.add('hidden'); connectBtn.disabled = true; }
      if (disconnectBtn) disconnectBtn.classList.remove('hidden');
      if (input) input.disabled = true;
      if (select) select.disabled = true;
    } else {
      if (connectBtn) { connectBtn.classList.remove('hidden'); connectBtn.disabled = false; }
      if (disconnectBtn) disconnectBtn.classList.add('hidden');
      if (input) input.disabled = false;
      if (select) select.disabled = false;
    }
  }

  function init() {
    initAutoScroll();

    const clearChatBtn = $('clearChatBtn');
    const clearEventsBtn = $('clearEventsBtn');
    if (clearChatBtn) clearChatBtn.addEventListener('click', clearChat);
    if (clearEventsBtn) clearEventsBtn.addEventListener('click', clearEvents);
  }

  return {
    init,
    sanitize,
    sanitizeUrl,
    formatNum,
    addChat,
    addEvent,
    setStatus,
    setConnectionMethod,
    setConnectorVersion,
    updateStat,
    showStats,
    clearChat,
    clearEvents,
    setConnectUI,
  };
})();