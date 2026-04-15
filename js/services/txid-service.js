const DEFAULT_BASE_URL = 'https://mempool.space/api';
const NETWORK_PREFIX = {
  mainnet: '',
  bitcoin: '',
  testnet: '/testnet',
  signet: '/signet',
};
const SATS_EPSILON = 100; // tolerância ao comparar valores

const TXID_STATUS = {
  MANUAL: 'manual',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  INVALID: 'invalid',
  MISMATCH: 'mismatch',
  INCONCLUSIVE: 'inconclusive',
};

function ensureFetcher(fetcher) {
  if (typeof fetcher === 'function') return fetcher;
  if (typeof fetch === 'function') return fetch.bind(globalThis);
  throw new Error('Nenhum fetch disponível');
}

function normalizeTxid(txid = '') {
  const trimmed = String(txid || '')
    .trim()
    .toLowerCase();
  if (!trimmed || !/^[0-9a-f]{8,100}$/i.test(trimmed)) return null;
  return trimmed;
}

export function resolveNetwork(network) {
  const normalized = String(network || 'mainnet').toLowerCase();
  if (normalized === 'bitcoin') return 'mainnet';
  if (NETWORK_PREFIX[normalized] != null) return normalized;
  if (normalized.includes('test')) return 'testnet';
  if (normalized.includes('signet')) return 'signet';
  return 'mainnet';
}

export function buildExplorerUrl(txid, options = {}) {
  const tx = normalizeTxid(txid) || txid;
  const network = resolveNetwork(options.network);
  const base = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  return `${base}${NETWORK_PREFIX[network] || ''}/tx/${tx}`;
}

async function fetchTxFromExplorer(txid, options = {}) {
  const fetcher = ensureFetcher(options.fetcher);
  const normalized = normalizeTxid(txid);
  if (!normalized) {
    const err = new Error('TXID inválido');
    err.code = 'ERR_INVALID_TXID';
    throw err;
  }
  const network = resolveNetwork(options.network);
  const base = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  const url = `${base}${NETWORK_PREFIX[network] || ''}/tx/${normalized}`;
  const res = await fetcher(url, { method: 'GET' });
  if (res.status === 404) {
    return { ok: false, notFound: true, status: 404 };
  }
  if (!res.ok) {
    const error = new Error(`Explorer falhou (${res.status})`);
    error.status = res.status;
    throw error;
  }
  const data = await res.json();
  return { ok: true, data };
}

function deriveExpectedSats(entry = {}) {
  if (Number.isFinite(entry.sats)) return Number(entry.sats);
  if (Number.isFinite(entry.btcAmount)) return Math.floor(Number(entry.btcAmount) * 1e8);
  if (Number.isFinite(entry.fiat) && Number.isFinite(entry.price) && entry.price > 0) {
    return Math.floor((Number(entry.fiat) / Number(entry.price)) * 1e8);
  }
  return null;
}

function sumOutputs(txData) {
  if (!txData || !Array.isArray(txData.vout)) return 0;
  return txData.vout.reduce((acc, output) => acc + Number(output?.value || 0), 0);
}

function sumOutputsToAddress(txData, address) {
  if (!address || !txData || !Array.isArray(txData.vout)) return 0;
  return txData.vout.reduce((acc, output) => {
    const outAddr = output?.scriptpubkey_address;
    if (outAddr && outAddr === address) {
      return acc + Number(output.value || 0);
    }
    return acc;
  }, 0);
}

function computeConfirmations(txData, options = {}) {
  const status = txData?.status;
  if (!status) return 0;
  if (!status.confirmed) return 0;
  const tip = Number(options.latestBlockHeight);
  if (Number.isFinite(tip) && Number.isFinite(status.block_height)) {
    return Math.max(1, tip - status.block_height + 1);
  }
  return 1;
}

function inferNetworkFromEntry(entry = {}) {
  const wallet = String(entry.wallet || '').trim();
  if (!wallet) return 'mainnet';
  if (/^(tb1|m|n)/i.test(wallet)) return 'testnet';
  return 'mainnet';
}

function buildValidationSummary(entry, txData, options = {}) {
  const expectedSats = deriveExpectedSats(entry);
  const wallet = String(entry.wallet || '').trim();
  const totalOutputs = sumOutputs(txData);
  const toWallet = wallet ? sumOutputsToAddress(txData, wallet) : null;
  const referenceValue = wallet ? toWallet : totalOutputs;
  const matchesAmount =
    Number.isFinite(expectedSats) && Number.isFinite(referenceValue)
      ? Math.abs(expectedSats - referenceValue) <= (options.amountTolerance ?? SATS_EPSILON)
      : false;
  const hasWalletMatch = wallet ? Number(toWallet) > 0 : false;
  const confirmations = computeConfirmations(txData, options);
  return {
    expectedSats,
    wallet,
    totalOutputs,
    toWallet,
    matchesAmount,
    hasWalletMatch,
    confirmations,
  };
}

function decideStatus(entry, txData, summary) {
  if (!entry?.txid) {
    return { status: TXID_STATUS.MANUAL, reason: 'TXID não informado' };
  }
  if (!txData) {
    return { status: TXID_STATUS.INVALID, reason: 'Transação não encontrada' };
  }
  if (!txData.status || summary.confirmations === 0) {
    return { status: TXID_STATUS.PENDING, reason: 'Transação ainda sem confirmações' };
  }
  if (summary.wallet && !summary.hasWalletMatch) {
    return {
      status: TXID_STATUS.MISMATCH,
      reason: 'Nenhuma saída corresponde ao endereço informado',
    };
  }
  if (summary.matchesAmount) {
    return { status: TXID_STATUS.CONFIRMED, reason: 'Valor compatível e transação confirmada' };
  }
  if (Number.isFinite(summary.expectedSats)) {
    return { status: TXID_STATUS.MISMATCH, reason: 'Valor encontrado diverge do aportado' };
  }
  return {
    status: TXID_STATUS.INCONCLUSIVE,
    reason: 'Dados insuficientes para confirmar compatibilidade',
  };
}

export async function validateTxidEntry(entry = {}, options = {}) {
  if (!entry || !entry.txid) {
    return {
      status: TXID_STATUS.MANUAL,
      reason: 'TXID não informado',
      txid: entry?.txid || null,
    };
  }
  const networkHint = entry.network || inferNetworkFromEntry(entry);
  try {
    const result = await fetchTxFromExplorer(entry.txid, { ...options, network: networkHint });
    if (!result.ok && result.notFound) {
      return {
        status: TXID_STATUS.INVALID,
        reason: 'TXID não encontrado no explorer',
        txid: entry.txid,
        explorerUrl: buildExplorerUrl(entry.txid, { ...options, network: networkHint }),
      };
    }
    const txData = result.data;
    const summary = buildValidationSummary(entry, txData, options);
    const decision = decideStatus(entry, txData, summary);
    return {
      ...decision,
      txid: entry.txid,
      explorerUrl: buildExplorerUrl(entry.txid, { ...options, network: networkHint }),
      confirmations: summary.confirmations,
      expectedSats: summary.expectedSats,
      matchedSats: summary.wallet ? summary.toWallet : summary.totalOutputs,
      wallet: summary.wallet,
      network: resolveNetwork(networkHint),
      fetchedAt: new Date().toISOString(),
      confirmedAt:
        txData?.status?.confirmed && txData?.status?.block_time
          ? new Date(txData.status.block_time * 1000).toISOString().slice(0, 10)
          : null,
      raw: options.includeRaw ? txData : undefined,
    };
  } catch (err) {
    return {
      status: TXID_STATUS.INCONCLUSIVE,
      reason: err?.message || 'Falha ao consultar explorer',
      txid: entry.txid,
      explorerUrl: buildExplorerUrl(entry.txid, { ...options, network: networkHint }),
    };
  }
}

export { TXID_STATUS };
