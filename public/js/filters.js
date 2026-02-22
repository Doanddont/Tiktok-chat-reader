/**
 * Filter System — toggles + text/username/diamond filters
 */
const Filters = (() => {
  // Toggle elements
  const toggles = {
    chat:   document.getElementById('toggleChat'),
    gift:   document.getElementById('toggleGift'),
    like:   document.getElementById('toggleLike'),
    follow: document.getElementById('toggleFollow'),
    share:  document.getElementById('toggleShare'),
    join:   document.getElementById('toggleJoin'),
  };

  // Filter input elements
  const textFilterInput     = document.getElementById('textFilter');
  const usernameFilterInput = document.getElementById('usernameFilter');
  const minDiamondInput     = document.getElementById('minDiamondFilter');
  const clearTextBtn        = document.getElementById('clearTextFilter');
  const clearUsernameBtn    = document.getElementById('clearUsernameFilter');

  // Current filter state
  const state = {
    enabledEvents: {
      chat: true,
      gift: true,
      like: true,
      follow: true,
      share: true,
      join: true,
      subscribe: true,
      question: true,
    },
    textFilter: '',
    usernameFilter: '',
    minGiftDiamonds: 0,
  };

  // Callbacks
  let onChangeCallback = null;

  // =============================================
  // Initialize
  // =============================================
  function init(onChange) {
    onChangeCallback = onChange;

    // Toggle listeners
    Object.entries(toggles).forEach(([key, el]) => {
      el.addEventListener('change', () => {
        state.enabledEvents[key] = el.checked;
        notifyChange();
        refilterExisting();
      });
    });

    // Text filter
    textFilterInput.addEventListener('input', debounce(() => {
      state.textFilter = textFilterInput.value.trim().toLowerCase();
      clearTextBtn.classList.toggle('hidden', !state.textFilter);
      refilterExisting();
    }, 200));

    clearTextBtn.addEventListener('click', () => {
      textFilterInput.value = '';
      state.textFilter = '';
      clearTextBtn.classList.add('hidden');
      refilterExisting();
    });

    // Username filter
    usernameFilterInput.addEventListener('input', debounce(() => {
      state.usernameFilter = usernameFilterInput.value.trim().toLowerCase();
      clearUsernameBtn.classList.toggle('hidden', !state.usernameFilter);
      refilterExisting();
    }, 200));

    clearUsernameBtn.addEventListener('click', () => {
      usernameFilterInput.value = '';
      state.usernameFilter = '';
      clearUsernameBtn.classList.add('hidden');
      refilterExisting();
    });

    // Min diamond filter
    minDiamondInput.addEventListener('input', debounce(() => {
      state.minGiftDiamonds = parseInt(minDiamondInput.value, 10) || 0;
      refilterExisting();
    }, 300));
  }

  // =============================================
  // Filter Logic
  // =============================================

  /**
   * Check if a message should be visible given current filters.
   * @param {string} eventType - chat|gift|like|follow|share|join|subscribe|question
   * @param {object} data - The event data
   * @returns {boolean} true = show, false = hide
   */
  function shouldShow(eventType, data) {
    // 1. Toggle check
    // Map subscribe and question to always show (no toggle for them yet)
    const toggleKey = eventType;
    if (state.enabledEvents[toggleKey] === false) {
      return false;
    }

    // 2. Username filter
    if (state.usernameFilter) {
      const username = (data.uniqueId || data.nickname || '').toLowerCase();
      const nickname = (data.nickname || '').toLowerCase();
      if (
        !username.includes(state.usernameFilter) &&
        !nickname.includes(state.usernameFilter)
      ) {
        return false;
      }
    }

    // 3. Text filter (only for chat and question)
    if (state.textFilter && (eventType === 'chat' || eventType === 'question')) {
      const text = (data.comment || data.questionText || '').toLowerCase();
      if (!text.includes(state.textFilter)) {
        return false;
      }
    }

    // 4. Min diamond filter (only for gifts)
    if (eventType === 'gift' && state.minGiftDiamonds > 0) {
      const totalDiamonds = (data.diamondCount || 0) * (data.repeatCount || 1);
      if (totalDiamonds < state.minGiftDiamonds) {
        return false;
      }
    }

    return true;
  }

  /**
   * Re-filter all existing messages in the DOM
   */
  function refilterExisting() {
    // Re-filter chat messages
    const chatMessages = document.querySelectorAll('.chat-message[data-event-type]');
    chatMessages.forEach((el) => {
      const type = el.dataset.eventType;
      const data = JSON.parse(el.dataset.eventData || '{}');
      el.classList.toggle('filtered-out', !shouldShow(type, data));
    });

    // Re-filter event items
    const eventItems = document.querySelectorAll('.event-item[data-event-type]');
    eventItems.forEach((el) => {
      const type = el.dataset.eventType;
      const data = JSON.parse(el.dataset.eventData || '{}');
      el.classList.toggle('filtered-out', !shouldShow(type, data));
    });
  }

  function notifyChange() {
    if (onChangeCallback) onChangeCallback(state);
  }

  function getState() {
    return { ...state };
  }

  // =============================================
  // Utility
  // =============================================
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  return { init, shouldShow, getState, refilterExisting };
})();
