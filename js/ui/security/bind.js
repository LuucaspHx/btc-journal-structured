export function bindSecurityControls({
  root = document,
  onImportText,
  onLoadExample,
  onError,
} = {}) {
  const input = root?.getElementById?.('securityImportInput');
  const exampleButton = root?.getElementById?.('securityExampleBtn');

  if (!input || input.dataset.securityBound === 'true') return () => {};

  async function handleImport(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    try {
      if (Number(file.size) > 10 * 1024 * 1024) {
        throw new Error('O arquivo de scan excede o limite de 10 MB desta versão.');
      }
      const text = await file.text();
      await onImportText?.({ text, name: file.name });
    } catch (error) {
      onError?.(error);
    } finally {
      event.target.value = '';
    }
  }

  async function handleExample() {
    try {
      await onLoadExample?.();
    } catch (error) {
      onError?.(error);
    }
  }

  input.dataset.securityBound = 'true';
  input.addEventListener('change', handleImport);
  exampleButton?.addEventListener('click', handleExample);

  return () => {
    input.removeEventListener('change', handleImport);
    exampleButton?.removeEventListener('click', handleExample);
    delete input.dataset.securityBound;
  };
}
