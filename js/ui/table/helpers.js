import { TXID_STATUS } from '../../services/txid-service.js';

const TXID_STATUS_LABELS = {
  manual: 'Manual',
  pending: 'Pendente',
  confirmed: 'Confirmado',
  invalid: 'Inválido',
  mismatch: 'Incompatível',
  inconclusive: 'Inconclusivo'
};

export const shortTxid = (txid = '') => {
  if (!txid) return '';
  return txid.length > 12 ? `${txid.slice(0, 6)}…${txid.slice(-4)}` : txid;
};

export function getEffectiveTxStatus(tx = {}) {
  if (!tx) return TXID_STATUS.MANUAL;
  if (tx.validation?.status) return tx.validation.status;
  if (tx.status) return tx.status;
  if (tx.txid) return TXID_STATUS.PENDING;
  return TXID_STATUS.MANUAL;
}

export function describeTxStatus(status = TXID_STATUS.MANUAL) {
  return TXID_STATUS_LABELS[status] || status;
}

export function describeSortLabel(sortValue = 'date-desc') {
  const labels = {
    'date-desc': 'Ordem: data ↓ (recentes)',
    'date-asc': 'Ordem: data ↑ (antigas)',
    'sats-desc': 'Ordem: sats ↓',
    'sats-asc': 'Ordem: sats ↑',
    'price-desc': 'Ordem: preço ↓',
    'price-asc': 'Ordem: preço ↑',
    'fiat-desc': 'Ordem: valor (€) ↓',
    'fiat-asc': 'Ordem: valor (€) ↑'
  };
  return labels[sortValue] || 'Ordem: personalizada';
}

export const getTxPrice = (tx = {}) => Number(tx.btcPrice ?? tx.price ?? 0);

export const getTxSats = (tx = {}) => {
  if (Number.isFinite(tx.sats)) return Number(tx.sats);
  if (Number.isFinite(tx.btcAmount)) return Math.floor(Number(tx.btcAmount) * 1e8);
  return 0;
};

export const getTxFiat = (tx = {}) => {
  if (Number.isFinite(tx.fiatAmount)) return Number(tx.fiatAmount);
  if (Number.isFinite(tx.fiat)) return Number(tx.fiat);
  const price = getTxPrice(tx);
  const sats = getTxSats(tx);
  if (price > 0 && sats > 0) return (sats / 1e8) * price;
  return price;
};

export const getTxDate = (tx = {}) => tx.date ?? (tx.createdAt ? tx.createdAt.slice(0, 10) : '');

export const getTxNote = (tx = {}) => tx.note ?? '';
