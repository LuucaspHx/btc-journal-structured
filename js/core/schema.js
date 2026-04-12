import { satsToBtc } from './calculations.js';

export const SCHEMA_VERSION = 3;

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toUpperString(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim().toUpperCase();
}

function ensureId(id) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return id || crypto.randomUUID();
  if (id) return id;
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeTags(tags) {
  if (!tags) return [];
  const arr = Array.isArray(tags) ? tags : String(tags).split(/[,;]/);
  const seen = new Set();
  const list = [];
  for (const raw of arr) {
    const tag = String(raw).trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(tag);
    if (list.length >= 10) break;
  }
  return list;
}

export function createDefaultEntry(fields = {}) {
  const now = new Date().toISOString();
  const sats = toNumber(fields.sats, NaN);
  const btcAmount = Number.isFinite(fields.btcAmount)
    ? Number(fields.btcAmount)
    : (Number.isFinite(sats) ? satsToBtc(sats) : 0);
  const resolvedSats = Number.isFinite(sats) ? sats : Math.floor(btcAmount * 1e8);
  const fiatAmount = toNumber(fields.fiatAmount ?? fields.fiat ?? 0, 0);
  const fee = toNumber(fields.fee ?? 0, 0);

  return {
    id: ensureId(fields.id),
    schemaVersion: SCHEMA_VERSION,
    date: fields.date || now.slice(0, 10),
    fiatAmount,
    fiatCurrency: toUpperString(fields.fiatCurrency ?? 'USD', 'USD'),
    btcPrice: toNumber(fields.btcPrice ?? fields.price ?? 0, 0),
    fee,
    btcAmount,
    sats: Math.max(0, resolvedSats),
    txid: fields.txid || '',
    wallet: fields.wallet || '',
    status: fields.status || 'manual',
    strategy: typeof fields.strategy === 'string' ? fields.strategy.trim() : '',
    note: fields.note || '',
    exchange: fields.exchange || '',
    tags: normalizeTags(fields.tags),
    type: (fields.type || 'buy').toLowerCase(),
    metadata: { ...(fields.metadata || {}) },
    createdAt: fields.createdAt || now,
    updatedAt: fields.updatedAt || fields.createdAt || now
  };
}
