import { migrateV1ToV3 } from '../../storage/migrations.js';

export const csvEscape = (value) => {
  const text = value == null ? '' : String(value);
  // Força quoting se começar com caracteres de fórmula (proteção CSV injection)
  if (/^[=+\-@\t\r]/.test(text) || /[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export function normalizeImportShape(parsed) {
  if (!parsed) return null;
  const meta = {};
  if (typeof parsed.vs === 'string') meta.vs = parsed.vs.toLowerCase();
  if (parsed.meta && typeof parsed.meta.vs === 'string') meta.vs = parsed.meta.vs.toLowerCase();
  if (Number.isInteger(parsed.year)) meta.year = parsed.year;
  if (parsed.meta && Number.isInteger(parsed.meta.year)) meta.year = parsed.meta.year;

  let goals;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if (parsed.goals) goals = parsed.goals;
    else if (parsed.payload && typeof parsed.payload === 'object' && parsed.payload.goals) {
      goals = parsed.payload.goals;
    }
  }

  const candidates = [
    parsed.entries,
    parsed.txs,
    parsed.data,
    parsed.records,
    parsed.payload?.entries
  ].filter((value) => Array.isArray(value));

  if (Array.isArray(parsed)) return { entries: parsed, meta, goals: undefined };
  if (candidates.length > 0) return { entries: candidates[0], meta, goals };
  if (parsed.payload && Array.isArray(parsed.payload)) return { entries: parsed.payload, meta, goals };
  return null;
}

export function migrateLegacyImport(text) {
  try {
    const migrated = migrateV1ToV3(text);
    if (Array.isArray(migrated?.txs)) return { entries: migrated.txs, meta: { legacy: true } };
  } catch (err) {
    console.warn('Legacy migration failed', err);
  }
  return null;
}

export function prepareImportPayloadFromText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return migrateLegacyImport(text);
  }

  let normalized = normalizeImportShape(parsed);
  if (!normalized && parsed?.btcJournalV1) {
    normalized = migrateLegacyImport(JSON.stringify(parsed.btcJournalV1));
  }
  if (!normalized) normalized = migrateLegacyImport(text);
  return normalized;
}
