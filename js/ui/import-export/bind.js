let activeCleanup = null;

function addListener(cleanups, target, eventName, handler) {
  if (!target) return;
  target.addEventListener(eventName, handler);
  cleanups.push(() => target.removeEventListener(eventName, handler));
}

export function unbindImportExport() {
  if (!activeCleanup) return;
  const cleanup = activeCleanup;
  activeCleanup = null;
  cleanup();
}

export function bindImportExport({
  onOpenExport,
  onDownloadJson,
  onDownloadCsv,
  onCopyExport,
  onImportFile,
  onApplyImport,
  onCloseImport,
  onCloseExport
} = {}) {
  unbindImportExport();

  const cleanups = [];
  const exportBtn = document.getElementById('btn-export');
  const footerCsvBtn = document.getElementById('btn-export-csv');
  const downloadBtn = document.getElementById('exportDownloadBtn');
  const copyBtn = document.getElementById('exportCopyBtn');
  const exportCloseBtn = document.getElementById('exportCloseBtn');
  const exportModal = document.getElementById('exportModal');
  const importInput = document.getElementById('file-import');
  const importModal = document.getElementById('importModal');
  const importCancelBtn = document.getElementById('importCancelBtn');
  const importCloseBtn = document.getElementById('importCloseBtn');
  const importApplyBtn = document.getElementById('importApplyBtn');

  addListener(cleanups, exportBtn, 'click', (event) => {
    event.preventDefault();
    if (typeof onOpenExport === 'function') onOpenExport();
  });

  addListener(cleanups, footerCsvBtn, 'click', (event) => {
    event.preventDefault();
    if (typeof onDownloadCsv === 'function') onDownloadCsv();
  });

  addListener(cleanups, downloadBtn, 'click', () => {
    if (typeof onDownloadJson === 'function') onDownloadJson();
    if (typeof onCloseExport === 'function') onCloseExport();
  });

  addListener(cleanups, copyBtn, 'click', () => {
    if (typeof onCopyExport === 'function') onCopyExport();
  });

  addListener(cleanups, exportCloseBtn, 'click', () => {
    if (typeof onCloseExport === 'function') onCloseExport();
  });

  addListener(cleanups, exportModal, 'click', (event) => {
    if (event.target === exportModal && typeof onCloseExport === 'function') onCloseExport();
  });

  addListener(cleanups, importInput, 'change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (typeof onImportFile === 'function') await onImportFile(file);
    } finally {
      importInput.value = '';
    }
  });

  addListener(cleanups, importModal, 'click', (event) => {
    if (event.target === importModal && typeof onCloseImport === 'function') onCloseImport();
  });

  addListener(cleanups, importCancelBtn, 'click', () => {
    if (typeof onCloseImport === 'function') onCloseImport();
  });

  addListener(cleanups, importCloseBtn, 'click', () => {
    if (typeof onCloseImport === 'function') onCloseImport();
  });

  addListener(cleanups, importApplyBtn, 'click', () => {
    if (typeof onApplyImport === 'function') onApplyImport();
  });

  addListener(cleanups, document, 'keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (typeof onCloseExport === 'function') onCloseExport();
    if (typeof onCloseImport === 'function') onCloseImport();
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
