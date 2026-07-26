function createNavigationCommand(activateSection, section) {
  return () => {
    if (typeof activateSection !== 'function') return false;
    return activateSection(section);
  };
}

export function createAppCommands({ activateSection, openExport } = {}) {
  return Object.freeze({
    openNewEntry: createNavigationCommand(activateSection, 'entry'),
    openGoals: createNavigationCommand(activateSection, 'goals'),
    openTransactions: createNavigationCommand(activateSection, 'transactions'),
    openTxidAudit: createNavigationCommand(activateSection, 'audit'),
    openExport: () => {
      if (typeof openExport !== 'function') return false;
      openExport();
      return true;
    },
  });
}
