// js/storage/local-db.js
// Camada simples para ler/escrever dados versionados via localStorage

const DEFAULT_LS_KEY = 'btc_journal_state_v3';
const DEFAULT_BACKUP_PREFIX = 'btcJournalV1.bak.';

export function loadState(lsKey = DEFAULT_LS_KEY, fallback = null) {
  try {
    const raw = localStorage.getItem(lsKey);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('loadState error', err);
    return fallback;
  }
}

export function saveState(state, lsKey = DEFAULT_LS_KEY) {
  try {
    localStorage.setItem(lsKey, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('saveState error', err);
    return false;
  }
}

export function backupLocalData(sourceKey = 'btcJournalV1') {
  try {
    const snapshot = localStorage.getItem(sourceKey) ?? '[]';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    localStorage.setItem(`${sourceKey}.bak.${stamp}`, snapshot);
    return true;
  } catch (err) {
    console.error('Falha ao criar backup local:', err);
    return false;
  }
}

export function listBackups(prefix = DEFAULT_BACKUP_PREFIX) {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
  } catch (err) {
    console.error('listBackups error', err);
  }
  return keys.sort().reverse();
}

export function restoreBackupByKey(key) {
  if (!key) return null;
  try {
    const val = localStorage.getItem(key);
    if (!val) return null;
    return JSON.parse(val);
  } catch (err) {
    console.error('restoreBackup error', err);
    return null;
  }
}
