// import-sanitizer.js
// ES module com funções portáveis para validação/sanitização de import JSON do BTC Journal

function uid() { return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }

export function asNumber(v, def = null) {
  if (v == null) return def;
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : def;
}

export function asDateString(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0,10);
}

export function satsFrom(fiat, price) {
  if (!price || !fiat || price <= 0) return 0;
  const btc = fiat / price;
  return Math.floor(btc * 1e8);
}

function sanitizeText(value, max = 120) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.slice(0, max);
}

function sanitizeType(value) {
  const allowed = new Set(['buy', 'sell']);
  const type = typeof value === 'string' ? value.toLowerCase().trim() : '';
  return allowed.has(type) ? type : 'buy';
}

function sanitizeTxid(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  // TXID Bitcoin válido: exatamente 64 hex chars; descarta qualquer outro formato
  return /^[0-9a-fA-F]{64}$/.test(trimmed) ? trimmed.toLowerCase() : '';
}

function sanitizeTags(value) {
  const arr = Array.isArray(value) ? value : [];
  const result = [];
  for (const tag of arr) {
    const safe = sanitizeText(String(tag ?? ''), 40);
    if (safe) result.push(safe);
    if (result.length >= 10) break;
  }
  return result;
}

export function normalizeEntry(raw) {
  const date = asDateString(raw.date);
  const price = asNumber(raw.price);
  const fiat = asNumber(raw.fiat);
  const fee = asNumber(raw.fee, 0) ?? 0;
  const sats = asNumber(raw.sats);

  if (!date || !Number.isFinite(price) || price <= 0 || !Number.isFinite(fiat) || fiat < 0) {
    return null;
  }

  let satsFinal = sats;
  if (!Number.isFinite(satsFinal) || satsFinal < 0) {
    const btc = (fiat - (Number.isFinite(fee) ? fee : 0)) / price;
    satsFinal = Math.max(0, Math.floor((Number.isFinite(btc) ? btc : 0) * 1e8));
  }

  return {
    id: raw.id || uid(),
    date,
    price: Number(price),
    fiat: Number(fiat),
    fee: Number(fee || 0),
    sats: satsFinal,
    closed: Boolean(raw.closed),
    weight: asNumber(raw.weight, null),
    exchange: sanitizeText(raw.exchange, 60),
    type: sanitizeType(raw.type),
    txid: sanitizeTxid(raw.txid),
    wallet: sanitizeText(raw.wallet, 100),
    strategy: sanitizeText(raw.strategy, 80),
    note: sanitizeText(raw.note, 500),
    tags: sanitizeTags(raw.tags)
  };
}

export function sanitizeImportPayload(payload) {
  const allowedVs = ['eur','usd','brl'];
  let entriesRaw = null;
  let vs = undefined;
  let year = undefined;

  const extractMeta = (source = {}) => {
    if (typeof source.vs === 'string' && allowedVs.includes(source.vs.toLowerCase())) vs = source.vs.toLowerCase();
    if (Number.isInteger(source.year)) year = source.year;
  };

  if (Array.isArray(payload)) entriesRaw = payload;
  else if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.entries)) {
      entriesRaw = payload.entries;
      extractMeta(payload);
    } else if (Array.isArray(payload.txs)) {
      entriesRaw = payload.txs;
      extractMeta(payload);
    } else {
      return { ok: false, reason: 'Formato inválido. Esperado { entries: [...] } ou um array de entradas.' };
    }
  } else {
    return { ok: false, reason: 'Formato inválido. Esperado { entries: [...] } ou um array de entradas.' };
  }

  const valid = [];
  const invalid = [];
  const sources = [];
  for (const e of entriesRaw) {
    const n = normalizeEntry(e || {});
    if (n) {
      valid.push(n);
      sources.push(e || {});
    } else {
      invalid.push(e);
    }
  }

  if (valid.length === 0) return { ok: false, reason: 'Nenhuma entrada válida encontrada no arquivo.' };

  return { ok: true, entries: valid, invalid, vs, year, sources };
}
