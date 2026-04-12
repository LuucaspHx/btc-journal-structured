// js/storage/migrations.js
// Utilitários para detectar e migrar dados antigos

const LEGACY_KEY = 'btcJournalV1';

export function detectOldKey(key = LEGACY_KEY) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn('detectOldKey error', err);
    return null;
  }
}

// Migra dados simples (array de entradas ou { entries: [] }) para { txs: [...] }
export function migrateV1ToV3(oldRaw) {
  if (!oldRaw) return null;
  try {
    const parsed = JSON.parse(oldRaw);
    const entries = Array.isArray(parsed) ? parsed : (parsed && parsed.entries ? parsed.entries : []);
    if (!Array.isArray(entries)) return null;
    return {
      txs: entries.map((entry = {}) => ({
        id: entry.id || '',
        date: entry.date || '',
        sats: Number(entry.sats || 0),
        price: Number(entry.price ?? entry.fiat ?? 0),
        fiat: Number(entry.fiat ?? entry.price ?? 0),
        note: entry.note ?? entry.txid ?? ''
      }))
    };
  } catch (err) {
    console.error('migrateV1ToV3 error', err);
    return null;
  }
}
