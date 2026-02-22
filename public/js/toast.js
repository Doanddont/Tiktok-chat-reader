/**
 * Toast Notification System
 */
const Toast = (() => {
  const container = document.getElementById('toastContainer');
  const DURATION = 4000;

  function show(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.remove();
    }, DURATION);
  }

  return {
    show,
    success: (msg) => show(msg, 'success'),
    error: (msg) => show(msg, 'error'),
    info: (msg) => show(msg, 'info'),
    warning: (msg) => show(msg, 'warning'),
  };
})();
