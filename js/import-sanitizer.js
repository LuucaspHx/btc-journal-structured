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
    weight: asNumber(raw.weight, null)
  };
}

export function sanitizeImportPayload(payload) {
  const allowedVs = ['eur','usd','brl'];
  let entriesRaw = null;
  let vs = undefined;
  let year = undefined;

  if (Array.isArray(payload)) entriesRaw = payload;
  else if (payload && typeof payload === 'object' && Array.isArray(payload.entries)) {
    entriesRaw = payload.entries;
    if (typeof payload.vs === 'string' && allowedVs.includes(payload.vs.toLowerCase())) vs = payload.vs.toLowerCase();
    if (Number.isInteger(payload.year)) year = payload.year;
  } else {
    return { ok: false, reason: 'Formato inválido. Esperado { entries: [...] } ou um array de entradas.' };
  }

  const valid = [];
  const invalid = [];
  for (const e of entriesRaw) {
    const n = normalizeEntry(e || {});
    if (n) valid.push(n); else invalid.push(e);
  }

  if (valid.length === 0) return { ok: false, reason: 'Nenhuma entrada válida encontrada no arquivo.' };

  return { ok: true, entries: valid, invalid, vs, year };
}

