import { normalizeEntry as sanitizerNormalize, sanitizeImportPayload as sanitizerSanitize } from '../import-sanitizer.js';

function isValidDate(value) {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

export function validateTransaction(payload = {}) {
  const errors = [];
  if (!isValidDate(payload.date)) {
    errors.push('Data inválida.');
  }
  if (!Number.isFinite(payload.sats) || payload.sats <= 0) {
    errors.push('Quantidade de sats deve ser maior que zero.');
  }
  if (!Number.isFinite(payload.price) || payload.price <= 0) {
    errors.push('Preço do BTC deve ser maior que zero.');
  }
  if (!Number.isFinite(payload.fiat) || payload.fiat <= 0) {
    errors.push('Valor em moeda deve ser maior que zero.');
  }
  if (payload.fee != null && payload.fee !== '' && !Number.isFinite(payload.fee)) {
    errors.push('Fee inválida.');
  }
  return { ok: errors.length === 0, errors, reason: errors[0] };
}

export const normalizeEntry = sanitizerNormalize;
export const sanitizeImportPayload = sanitizerSanitize;
