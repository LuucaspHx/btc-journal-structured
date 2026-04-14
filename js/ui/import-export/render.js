function clearChildren(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function setModalVisibility(id, visible) {
  const modal = document.getElementById(id);
  if (!modal) return false;
  modal.style.display = visible ? 'flex' : 'none';
  modal.setAttribute('aria-hidden', visible ? 'false' : 'true');
  return true;
}

export function renderExportPreview({ json = '', entryCount = 0 } = {}) {
  const preview = document.getElementById('exportPreview');
  if (preview) {
    preview.value = json;
    preview.scrollTop = 0;
  }

  const meta = document.getElementById('exportMeta');
  if (meta) {
    let bytes = json.length;
    try {
      if (typeof TextEncoder !== 'undefined') bytes = new TextEncoder().encode(json).length;
    } catch (err) {
      // noop
    }
    const size = bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
    meta.textContent = `${entryCount} aporte${entryCount === 1 ? '' : 's'} • ${size}`;
  }

  return json;
}

export function openExportModal() {
  return setModalVisibility('exportModal', true);
}

export function closeExportModal() {
  return setModalVisibility('exportModal', false);
}

export function openImportModal() {
  return setModalVisibility('importModal', true);
}

export function closeImportModal() {
  return setModalVisibility('importModal', false);
}

export function renderImportPreview(
  payload,
  {
    currentFiatCurrency,
    fmtCurrency,
    getTxDate,
    getTxFiat,
    getTxPrice
  } = {}
) {
  const summary = document.getElementById('importSummary');
  const preview = document.getElementById('importPreviewList');
  const hint = document.getElementById('importInvalidHint');
  const applyBtn = document.getElementById('importApplyBtn');
  const hasPayload = payload && Array.isArray(payload.entries) && payload.entries.length > 0;

  if (applyBtn) applyBtn.disabled = !hasPayload;
  if (!summary || !preview || !hint) return hasPayload;

  if (!hasPayload) {
    summary.textContent = 'Nenhuma importação pendente.';
    clearChildren(preview);
    hint.textContent = '';
    return false;
  }

  const entries = payload.entries;
  const fallbackCurrency = typeof currentFiatCurrency === 'function' ? currentFiatCurrency() : 'USD';
  const vsLabel = payload.vs ? payload.vs.toUpperCase() : fallbackCurrency;
  const parts = [
    `${entries.length} entrada${entries.length === 1 ? '' : 's'} prontas para importar`,
    payload.sourceCount && payload.sourceCount !== entries.length ? `de ${payload.sourceCount} detectadas` : null,
    payload.fileName || null,
    payload.vs ? `Moeda: ${vsLabel}` : null
  ].filter(Boolean);

  summary.textContent = parts.join(' • ');
  clearChildren(preview);

  const table = document.createElement('table');
  table.className = 'preview-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Data', 'Valor', 'Preço', 'Exchange', 'Tipo'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const sample = entries.slice(0, 5);
  sample.forEach((entry) => {
    const tr = document.createElement('tr');
    const cells = [
      typeof getTxDate === 'function' ? (getTxDate(entry) || '—') : '—',
      typeof fmtCurrency === 'function' && typeof getTxFiat === 'function'
        ? (fmtCurrency(getTxFiat(entry), vsLabel) || '—')
        : '—',
      typeof fmtCurrency === 'function' && typeof getTxPrice === 'function'
        ? (fmtCurrency(getTxPrice(entry), vsLabel) || '—')
        : '—',
      entry.exchange || '—',
      entry.type === 'sell' ? 'Venda' : 'Compra'
    ];

    cells.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  preview.appendChild(table);

  if (entries.length > sample.length) {
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = `Mostrando ${sample.length} de ${entries.length} entradas.`;
    preview.appendChild(note);
  }

  hint.textContent = payload.invalidCount
    ? `${payload.invalidCount} linha${payload.invalidCount === 1 ? '' : 's'} inválida${payload.invalidCount === 1 ? '' : 's'} serão ignoradas.`
    : '';

  return true;
}
