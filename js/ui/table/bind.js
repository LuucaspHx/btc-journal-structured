export function bindYearSelect({ onChange } = {}) {
  const select = document.getElementById('yearSelect');
  if (!select || select.dataset.bound === 'true') return;
  select.dataset.bound = 'true';
  select.addEventListener('change', () => {
    if (typeof onChange === 'function') onChange();
  });
}

export function bindFilters({
  onChange,
  onReset,
  onInit
} = {}) {
  const form = document.getElementById('filters-form');
  if (!form) return;
  const inputs = [
    { id: 'filter-from', evt: 'change' },
    { id: 'filter-to', evt: 'change' },
    { id: 'filter-min-sats', evt: 'change' },
    { id: 'filter-min-price', evt: 'change' },
    { id: 'filter-max-price', evt: 'change' },
    { id: 'filter-type', evt: 'change' },
    { id: 'filter-sort', evt: 'change' },
    { id: 'filter-search', evt: 'input' }
  ];
  const handleChange = () => {
    if (typeof onChange === 'function') onChange();
  };

  inputs.forEach(({ id, evt }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(evt, handleChange);
  });

  const resetBtn = document.getElementById('filters-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      form.reset();
      if (typeof onReset === 'function') onReset();
    });
  }

  if (typeof onInit === 'function') onInit();
}

export function bindTableActions({
  onEdit,
  onValidate,
  onDelete
} = {}) {
  const tbody = document.getElementById('tx-body');
  if (!tbody) return;
  tbody.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('button.edit');
    if (editBtn) {
      if (typeof onEdit === 'function') onEdit(editBtn.dataset.id);
      return;
    }

    const validateBtn = event.target.closest('button.validate');
    if (validateBtn) {
      if (typeof onValidate === 'function') await onValidate(validateBtn.dataset.id);
      return;
    }

    const delBtn = event.target.closest('button.del');
    if (delBtn && typeof onDelete === 'function') {
      await onDelete(delBtn.dataset.id);
    }
  });
}
