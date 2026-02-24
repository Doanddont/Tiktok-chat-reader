const Filters = (() => {
  let onChangeCallback = null;

  const state = {
    chat: true,
    gift: true,
    like: true,
    follow: true,
    share: true,
    join: true,
    subscribe: true,
    question: true,
    textFilter: '',
    usernameFilter: '',
    minDiamonds: 0,
  };

  function init(onChange) {
    onChangeCallback = onChange;

    const toggles = {
      toggleChat: 'chat',
      toggleGift: 'gift',
      toggleLike: 'like',
      toggleFollow: 'follow',
      toggleShare: 'share',
      toggleJoin: 'join',
      toggleSubscribe: 'subscribe',
      toggleQuestion: 'question',
    };

    for (const [id, key] of Object.entries(toggles)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('change', () => {
        state[key] = el.checked;
        refilterExisting();
        notifyChange();
      });
    }

    const textFilterEl = document.getElementById('textFilter');
    const clearTextBtn = document.getElementById('clearTextFilter');
    if (textFilterEl) {
      textFilterEl.addEventListener('input', debounce(() => {
        state.textFilter = textFilterEl.value.trim().toLowerCase();
        if (clearTextBtn) clearTextBtn.classList.toggle('hidden', !state.textFilter);
        refilterExisting();
        notifyChange();
      }, 200));
    }
    if (clearTextBtn) {
      clearTextBtn.addEventListener('click', () => {
        if (textFilterEl) textFilterEl.value = '';
        state.textFilter = '';
        clearTextBtn.classList.add('hidden');
        refilterExisting();
        notifyChange();
      });
    }

    const usernameFilterEl = document.getElementById('usernameFilter');
    const clearUsernameBtn = document.getElementById('clearUsernameFilter');
    if (usernameFilterEl) {
      usernameFilterEl.addEventListener('input', debounce(() => {
        state.usernameFilter = usernameFilterEl.value.trim().toLowerCase();
        if (clearUsernameBtn) clearUsernameBtn.classList.toggle('hidden', !state.usernameFilter);
        refilterExisting();
        notifyChange();
      }, 200));
    }
    if (clearUsernameBtn) {
      clearUsernameBtn.addEventListener('click', () => {
        if (usernameFilterEl) usernameFilterEl.value = '';
        state.usernameFilter = '';
        clearUsernameBtn.classList.add('hidden');
        refilterExisting();
        notifyChange();
      });
    }

    const minDiamondEl = document.getElementById('minDiamondFilter');
    if (minDiamondEl) {
      minDiamondEl.addEventListener('input', debounce(() => {
        state.minDiamonds = Math.max(0, parseInt(minDiamondEl.value, 10) || 0);
        refilterExisting();
        notifyChange();
      }, 200));
    }
  }

  function shouldShow(eventType, data) {
    // 1. Event type toggle
    if (eventType === 'member') {
      if (!state.join) return false;
    } else if (state[eventType] === false) {
      return false;
    }

    // 2. Username filter
    if (state.usernameFilter) {
      const username = (data?.uniqueId || '').toLowerCase();
      const nickname = (data?.nickname || '').toLowerCase();
      if (!username.includes(state.usernameFilter) && !nickname.includes(state.usernameFilter)) {
        return false;
      }
    }

    // 3. Text filter (for chat and question)
    if (state.textFilter && (eventType === 'chat' || eventType === 'question')) {
      const text = (data?.comment || data?.questionText || '').toLowerCase();
      if (!text.includes(state.textFilter)) return false;
    }

    // 4. Min diamond filter (for gifts)
    if (eventType === 'gift' && state.minDiamonds > 0) {
      const diamonds = (data?.diamondCount || 0) * (data?.repeatCount || 1);
      if (diamonds < state.minDiamonds) return false;
    }

    return true;
  }

  function refilterExisting() {
    document.querySelectorAll('.chat-message').forEach((el) => {
      const type = el.dataset.type || 'chat';
      const data = {
        uniqueId: el.dataset.uniqueId || '',
        nickname: el.dataset.nickname || '',
        comment: el.dataset.comment || '',
      };
      el.classList.toggle('filtered-out', !shouldShow(type, data));
    });

    document.querySelectorAll('.event-item').forEach((el) => {
      const type = el.dataset.type || '';
      const data = {
        uniqueId: el.dataset.uniqueId || '',
        nickname: el.dataset.nickname || '',
        diamondCount: parseInt(el.dataset.diamonds || '0', 10),
        repeatCount: parseInt(el.dataset.repeat || '1', 10),
        questionText: el.dataset.questionText || '',
      };
      el.classList.toggle('filtered-out', !shouldShow(type, data));
    });
  }

  function notifyChange() {
    if (onChangeCallback) onChangeCallback(state);
  }

  function getState() {
    return { ...state };
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  return { init, shouldShow, getState, refilterExisting };
})();