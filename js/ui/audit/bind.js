let activeCleanup = null;

function addListener(cleanups, target, eventName, handler) {
  if (!target) return;
  target.addEventListener(eventName, handler);
  cleanups.push(() => target.removeEventListener(eventName, handler));
}

export function unbindAuditControls() {
  if (!activeCleanup) return;
  const cleanup = activeCleanup;
  activeCleanup = null;
  cleanup();
}

export function bindAuditControls({
  onValidatePending,
  onFilterChange,
  onShowMore
} = {}) {
  unbindAuditControls();

  const cleanups = [];
  const validateBtn = document.getElementById('auditValidateBtn');
  const filters = document.getElementById('auditFilters');
  const showMoreBtn = document.getElementById('auditShowMoreBtn');

  addListener(cleanups, validateBtn, 'click', () => {
    if (typeof onValidatePending === 'function') onValidatePending();
  });

  addListener(cleanups, filters, 'click', (event) => {
    const target = event.target.closest('button[data-filter]');
    if (!target) return;
    if (typeof onFilterChange === 'function') onFilterChange(target.dataset.filter);
  });

  addListener(cleanups, showMoreBtn, 'click', () => {
    if (typeof onShowMore === 'function') onShowMore();
  });

  const cleanup = () => {
    while (cleanups.length) {
      const remove = cleanups.pop();
      remove();
    }
    if (activeCleanup === cleanup) activeCleanup = null;
  };

  activeCleanup = cleanup;
  return cleanup;
}
