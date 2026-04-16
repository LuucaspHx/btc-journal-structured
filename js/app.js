// Minimal app module: load/save transactions, render table/stats, import/export com sanitizer
import { SCHEMA_VERSION, createDefaultEntry } from './core/schema.js';
import { normalizeEntry, sanitizeImportPayload, validateTransaction } from './core/validators.js';
import { satsFrom, pmMedio, satsToBtc } from './core/calculations.js';
import {
  loadState as storageLoadState,
  saveState as storageSaveState,
  backupLocalData,
} from './storage/local-db.js';
import { detectOldKey, migrateV1ToV3 } from './storage/migrations.js';
import {
  getPresetGoals,
  normalizeGoal as normalizeGoalConfig,
  computeGoalProgress,
} from './core/goals.js';
import {
  createGoalsController,
  createEmptyGoalsState,
  hydrateGoalsState,
} from './features/goals-controller.js';
import { validateTxidEntry, buildExplorerUrl, TXID_STATUS } from './services/txid-service.js';
import {
  shortTxid,
  getEffectiveTxStatus,
  describeTxStatus,
  describeSortLabel,
  getTxPrice,
  getTxSats,
  getTxFiat,
  getTxDate,
  getTxNote,
} from './ui/table/helpers.js';
import { updateFiltersMeta, renderTable, renderStats } from './ui/table/render.js';
import { bindFilters, bindTableActions, bindYearSelect } from './ui/table/bind.js';
import {
  AUDIT_FILTERS,
  AUDIT_TABLE_DEFAULT_LIMIT,
  AUDIT_TABLE_MAX,
  AUDIT_TABLE_STEP,
} from './ui/audit/helpers.js';
import { renderAuditPanel } from './ui/audit/render.js';
import { bindAuditControls } from './ui/audit/bind.js';
import { csvEscape, prepareImportPayloadFromText } from './ui/import-export/helpers.js';
import { bindImportExport } from './ui/import-export/bind.js';
import {
  closeExportModal as hideExportModal,
  closeImportModal as hideImportModal,
  openExportModal as showExportModal,
  openImportModal as showImportModal,
  renderExportPreview,
  renderImportPreview,
} from './ui/import-export/render.js';
import { createPriceService } from './services/price-service.js';
import { bindChartPins } from './ui/chart/bind.js';

const LS_KEY = 'btc_journal_state_v3';
const CHART_MODE_STORAGE_KEY = 'btc_journal_chart_mode';

let state = { txs: [], goals: createEmptyGoalsState() };
let chartModeValue = 'line';
let loadingOverlayCounter = 0;
let editingTxId = null;
let pendingImportPayload = null;
let editingGoalId = null;
const goalsController = createGoalsController();
goalsController.setGoalsState(state.goals);
goalsController.subscribe((snapshot) => renderGoalsPanel(snapshot));
const SORT_PRESETS = new Set([
  'date-desc',
  'date-asc',
  'sats-desc',
  'sats-asc',
  'price-desc',
  'price-asc',
  'fiat-desc',
  'fiat-asc',
]);

const filterState = {
  from: null,
  to: null,
  minSats: null,
  minPrice: null,
  maxPrice: null,
  type: 'all',
  search: '',
  sort: 'date-desc',
};
const auditFilterState = { status: 'all' };
const auditViewState = { limit: AUDIT_TABLE_DEFAULT_LIMIT };

const DAY_MS = 24 * 60 * 60 * 1000;
const PRICE_RANGE_PADDING_DAYS = 5;
let priceSeriesMeta = null;
let ohlcSeriesMeta = null;
let lastFailedPriceMeta = null;
let lastFailedOhlcMeta = null;
const TXID_STATUS_TONES = {
  manual: 'muted',
  pending: 'info',
  confirmed: 'success',
  invalid: 'error',
  mismatch: 'warn',
  inconclusive: 'warn',
};
const AUTO_VALIDATE_STATUSES = new Set([
  TXID_STATUS.MANUAL,
  TXID_STATUS.PENDING,
  TXID_STATUS.INCONCLUSIVE,
]);

function createCoinGeckoFetcher() {
  return async function (vs) {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${vs}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.bitcoin?.[vs] ?? null;
  };
}

function inferNetworkFromTx(tx = {}) {
  if (tx.network) return tx.network;
  const wallet = String(tx.wallet || '').trim();
  if (wallet && /^(tb1|m|n)/i.test(wallet)) return 'testnet';
  return 'mainnet';
}

function resetFilterState() {
  filterState.from = null;
  filterState.to = null;
  filterState.minSats = null;
  filterState.minPrice = null;
  filterState.maxPrice = null;
  filterState.type = 'all';
  filterState.search = '';
  filterState.sort = 'date-desc';
}

function getChartMode() {
  return chartModeValue === 'candles' ? 'candles' : 'line';
}

function setChartMode(mode = 'line') {
  chartModeValue = mode === 'candles' ? 'candles' : 'line';
  try {
    localStorage.setItem(CHART_MODE_STORAGE_KEY, chartModeValue);
  } catch (e) {
    /* ignore */
  }
  const select = document.getElementById('chartMode');
  if (select && select.value !== chartModeValue) select.value = chartModeValue;
}

function hydrateChartMode() {
  try {
    const stored = localStorage.getItem(CHART_MODE_STORAGE_KEY);
    if (stored) {
      chartModeValue = stored === 'candles' ? 'candles' : 'line';
      const select = document.getElementById('chartMode');
      if (select) select.value = chartModeValue;
      return;
    }
  } catch (e) {
    /* ignore */
  }
  setChartMode(chartModeValue);
}

function parseDateFilter(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date.getTime();
}

function getActiveFiltersCount() {
  let count = 0;
  if (filterState.from) count++;
  if (filterState.to) count++;
  if (filterState.minSats != null) count++;
  if (filterState.minPrice != null) count++;
  if (filterState.maxPrice != null) count++;
  if (filterState.type && filterState.type !== 'all') count++;
  if (filterState.search) count++;
  return count;
}

function syncFiltersFromInputs() {
  const fromEl = document.getElementById('filter-from');
  const toEl = document.getElementById('filter-to');
  const minEl = document.getElementById('filter-min-sats');
  const minPriceEl = document.getElementById('filter-min-price');
  const maxPriceEl = document.getElementById('filter-max-price');
  const typeEl = document.getElementById('filter-type');
  const sortEl = document.getElementById('filter-sort');
  const searchEl = document.getElementById('filter-search');
  filterState.from = parseDateFilter(fromEl?.value, false);
  filterState.to = parseDateFilter(toEl?.value, true);
  const minVal = Number(minEl?.value);
  filterState.minSats = Number.isFinite(minVal) && minVal >= 0 ? minVal : null;
  const minPriceVal = Number(minPriceEl?.value);
  filterState.minPrice = Number.isFinite(minPriceVal) && minPriceVal >= 0 ? minPriceVal : null;
  const maxPriceVal = Number(maxPriceEl?.value);
  filterState.maxPrice = Number.isFinite(maxPriceVal) && maxPriceVal >= 0 ? maxPriceVal : null;
  if (
    filterState.minPrice != null &&
    filterState.maxPrice != null &&
    filterState.maxPrice < filterState.minPrice
  ) {
    const temp = filterState.minPrice;
    filterState.minPrice = filterState.maxPrice;
    filterState.maxPrice = temp;
  }
  const typeValue = typeEl?.value?.toLowerCase();
  filterState.type = typeValue && ['buy', 'sell'].includes(typeValue) ? typeValue : 'all';
  const sortValue = sortEl?.value || 'date-desc';
  filterState.sort = SORT_PRESETS.has(sortValue) ? sortValue : 'date-desc';
  const search = (searchEl?.value || '').trim().toLowerCase();
  filterState.search = search.length ? search : '';
  return getActiveFiltersCount();
}

function applyFiltersToList(list = []) {
  if (!Array.isArray(list) || list.length === 0) return [];
  return list.filter((tx) => {
    const dateStr = getTxDate(tx);
    const time = dateStr ? new Date(dateStr).getTime() : NaN;
    if (filterState.from && (Number.isNaN(time) || time < filterState.from)) return false;
    if (filterState.to && (Number.isNaN(time) || time > filterState.to)) return false;
    const sats = getTxSats(tx);
    if (filterState.minSats != null && sats < filterState.minSats) return false;
    const price = getTxPrice(tx);
    if (filterState.minPrice != null && (!Number.isFinite(price) || price < filterState.minPrice))
      return false;
    if (filterState.maxPrice != null && (!Number.isFinite(price) || price > filterState.maxPrice))
      return false;
    if (filterState.type && filterState.type !== 'all') {
      const txType = typeof tx.type === 'string' ? tx.type.toLowerCase() : 'buy';
      if (txType !== filterState.type) return false;
    }
    if (filterState.search) {
      const haystackParts = [
        getTxNote(tx),
        tx.wallet,
        tx.txid,
        tx.strategy,
        tx.status,
        tx.exchange,
        tx.type,
        getTxDate(tx),
        sats ? String(sats) : '',
        getTxPrice(tx) ? String(getTxPrice(tx)) : '',
      ]
        .filter(Boolean)
        .map((str) => String(str).toLowerCase());
      const haystack = haystackParts.join(' ');
      if (!haystack.includes(filterState.search)) return false;
    }
    return true;
  });
}

function getVisibleTxs() {
  const source = Array.isArray(state.txs) ? state.txs : [];
  const filtered = getActiveFiltersCount() ? applyFiltersToList(source) : source;
  return sortTxs(filtered);
}

function sortTxs(list = []) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const [keyRaw, dirRaw] = (filterState.sort || 'date-desc').split(':');
  const key = keyRaw || 'date';
  const dir = dirRaw === 'asc' ? 'asc' : 'desc';
  const factor = dir === 'asc' ? 1 : -1;
  const getters = {
    date: (tx) => {
      const time = new Date(getTxDate(tx)).getTime();
      return Number.isNaN(time) ? null : time;
    },
    sats: (tx) => {
      const value = getTxSats(tx);
      return Number.isFinite(value) ? value : null;
    },
    price: (tx) => {
      const value = getTxPrice(tx);
      return Number.isFinite(value) ? value : null;
    },
    fiat: (tx) => {
      const value = getTxFiat(tx);
      return Number.isFinite(value) ? value : null;
    },
  };
  const getter = getters[key] || getters.date;
  return [...list].sort((a, b) => {
    const aVal = getter(a);
    const bVal = getter(b);
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (aVal === bVal) {
      const fallbackA = getters.date(a) ?? 0;
      const fallbackB = getters.date(b) ?? 0;
      if (fallbackA === fallbackB) return 0;
      return fallbackA > fallbackB ? -1 : 1;
    }
    return aVal > bVal ? factor : -factor;
  });
}

function shouldChartUseFilters() {
  const checkbox = document.getElementById('chartOnlyFiltered');
  return !checkbox || checkbox.checked;
}

function getTxsForChart(visibleTxs = getVisibleTxs()) {
  return shouldChartUseFilters() ? visibleTxs : state.txs || [];
}

function resolvedVsCurrencyLower() {
  const select = document.getElementById('vsCurrency');
  const raw = select?.value || state.vs || 'usd';
  return String(raw).toLowerCase();
}

function getChartYearRange() {
  const yearSel = document.getElementById('yearSelect');
  const now = new Date();
  const year = yearSel && yearSel.value ? parseInt(yearSel.value, 10) : now.getFullYear();
  const min = new Date(year, 0, 1).getTime();
  const max = new Date(year, 11, 31, 23, 59, 59, 999).getTime();
  return { min, max };
}

function ensureChartRange(range = getChartYearRange()) {
  const hasNumbers = range && Number.isFinite(range.min) && Number.isFinite(range.max);
  if (hasNumbers && range.max > range.min) return range;
  const now = Date.now();
  return { min: now - 90 * DAY_MS, max: now };
}

function expandRange(range, paddingDays = PRICE_RANGE_PADDING_DAYS) {
  const padding = Math.max(0, paddingDays) * DAY_MS;
  const min = Math.max(0, (range?.min ?? Date.now()) - padding);
  const max = Math.max(min + DAY_MS, (range?.max ?? Date.now()) + padding);
  return { min, max };
}

function cloneRange(range) {
  return { min: range.min, max: range.max };
}

function rangesRoughlyMatch(a, b, tolerance = DAY_MS) {
  if (!a || !b) return false;
  return Math.abs(a.min - b.min) <= tolerance && Math.abs(a.max - b.max) <= tolerance;
}

function shouldRefreshPriceSeries(range, vs) {
  if (!Array.isArray(state.prices) || state.prices.length === 0) return true;
  if (!priceSeriesMeta) return true;
  if (priceSeriesMeta.vs !== vs) return true;
  if (!priceSeriesMeta.range) return true;
  return !rangesRoughlyMatch(priceSeriesMeta.range, range);
}

function determineOhlcDays(range) {
  if (!range) return 90;
  const span = Math.ceil((range.max - range.min) / DAY_MS);
  if (span <= 1) return 1;
  if (span <= 7) return 7;
  if (span <= 14) return 14;
  if (span <= 30) return 30;
  if (span <= 90) return 90;
  if (span <= 180) return 180;
  if (span <= 400) return 365;
  return 'max';
}

function shouldRefreshOhlc(range, vs) {
  if (!Array.isArray(state.ohlc) || state.ohlc.length === 0) return true;
  if (!ohlcSeriesMeta) return true;
  if (ohlcSeriesMeta.vs !== vs) return true;
  const desiredDays = determineOhlcDays(range);
  return ohlcSeriesMeta.days !== desiredDays;
}

function schedulePriceSeriesFetch(range, vs, callback) {
  if (_fetchingPrices) return;
  if (
    _pricesFetchFailed &&
    lastFailedPriceMeta &&
    lastFailedPriceMeta.vs === vs &&
    rangesRoughlyMatch(lastFailedPriceMeta.range, range)
  ) {
    return;
  }
  _fetchingPrices = true;
  fetchPrices(range, vs)
    .then(() => {
      _fetchingPrices = false;
      _pricesFetchFailed = false;
      lastFailedPriceMeta = null;
      if (typeof callback === 'function') callback();
    })
    .catch(() => {
      _fetchingPrices = false;
      _pricesFetchFailed = true;
      lastFailedPriceMeta = { range: cloneRange(range), vs };
    });
}

function scheduleOhlcFetch(range, vs, callback) {
  if (_fetchingOHLC) return;
  const days = determineOhlcDays(range);
  if (_ohlcFetchMatchesFailure(days, vs)) return;
  _fetchingOHLC = true;
  fetchOHLC(days, vs)
    .then(() => {
      _fetchingOHLC = false;
      lastFailedOhlcMeta = null;
      if (typeof callback === 'function') callback();
    })
    .catch(() => {
      _fetchingOHLC = false;
      lastFailedOhlcMeta = { days, vs };
    });
}

function _ohlcFetchMatchesFailure(days, vs) {
  if (!lastFailedOhlcMeta) return false;
  return lastFailedOhlcMeta.days === days && lastFailedOhlcMeta.vs === vs;
}

function hydrateYearOptions() {
  const select = document.getElementById('yearSelect');
  if (!select) return;
  const years = new Set();
  const now = new Date();
  years.add(now.getFullYear());
  for (const tx of state.txs || []) {
    const dateStr = getTxDate(tx);
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) years.add(d.getFullYear());
  }
  const sorted = Array.from(years).sort((a, b) => b - a);
  const previous = select.value;
  select.innerHTML = '';
  sorted.forEach((year) => {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = year;
    select.appendChild(opt);
  });
  if (previous && sorted.includes(Number(previous))) {
    select.value = previous;
  } else if (sorted.length) {
    select.value = sorted[0];
  }
}

function bindChartFilterToggle() {
  const checkbox = document.getElementById('chartOnlyFiltered');
  if (!checkbox || checkbox.dataset.bound === 'true') return;
  checkbox.dataset.bound = 'true';
  checkbox.addEventListener('change', () => {
    renderChart();
  });
}

function setFormError(message = '') {
  const el = document.getElementById('tx-error');
  if (el) el.textContent = message;
}

function updateFormModeUI(isEditing) {
  const submitBtn = document.getElementById('tx-add');
  if (submitBtn) submitBtn.textContent = isEditing ? 'Guardar alterações' : 'Adicionar';
  const cancelBtn = document.getElementById('tx-cancel-edit');
  if (cancelBtn) cancelBtn.style.display = isEditing ? 'inline-flex' : 'none';
  const deleteBtn = document.getElementById('tx-delete-edit');
  if (deleteBtn) deleteBtn.style.display = isEditing ? 'inline-flex' : 'none';
}

function populateFormWithEntry(entry = null) {
  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
  };
  if (!entry) {
    const form = document.getElementById('tx-form');
    if (form) form.reset();
    return;
  }
  setValue('tx-date', getTxDate(entry));
  const sats = getTxSats(entry);
  setValue('tx-sats', Number.isFinite(sats) ? String(sats) : '');
  const price = getTxPrice(entry);
  setValue('tx-price', Number.isFinite(price) ? String(price) : '');
  const fiat = getTxFiat(entry);
  setValue('tx-fiat', Number.isFinite(fiat) ? String(fiat) : '');
  setValue('tx-fee', Number.isFinite(entry.fee) ? String(entry.fee) : '');
  setValue('tx-exchange', typeof entry.exchange === 'string' ? entry.exchange : '');
  setValue('tx-note', getTxNote(entry));
  setValue('tx-txid', typeof entry.txid === 'string' ? entry.txid : '');
  setValue('tx-wallet', typeof entry.wallet === 'string' ? entry.wallet : '');
  setValue('tx-strategy', typeof entry.strategy === 'string' ? entry.strategy : '');
  setValue('tx-tags', Array.isArray(entry.tags) && entry.tags.length ? entry.tags.join(', ') : '');
  const typeEl = document.getElementById('tx-type');
  if (typeEl) {
    const type =
      typeof entry.type === 'string' && entry.type.toLowerCase() === 'sell' ? 'sell' : 'buy';
    typeEl.value = type;
  }
}

function cancelEditTransaction() {
  editingTxId = null;
  const form = document.getElementById('tx-form');
  if (form) form.reset();
  updateFormModeUI(false);
  setFormError('');
}

function startEditTransaction(id) {
  const entry = (state.txs || []).find((tx) => tx.id === id);
  if (!entry) {
    showMessage('Transação não encontrada para edição.', 'warn');
    return;
  }
  editingTxId = id;
  populateFormWithEntry(entry);
  updateFormModeUI(true);
  setFormError('');
  const form = document.getElementById('tx-form');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  try {
    document.getElementById('tx-date')?.focus();
  } catch (e) {
    /* noop */
  }
}

async function deleteTransactionById(id) {
  const idx = state.txs.findIndex((t) => t.id === id);
  if (idx < 0) return;
  const proceed = await confirmModalAsync('Apagar esta transação?');
  if (!proceed) return;
  const removed = state.txs.splice(idx, 1)[0];
  if (editingTxId === id) cancelEditTransaction();
  saveState();
  renderAll();
  showMessage('Transação apagada.', 'info', 6000, 'Desfazer', () => {
    const insertIndex = Math.min(Math.max(idx, 0), state.txs.length);
    state.txs.splice(insertIndex, 0, removed);
    saveState();
    renderAll();
    showMessage('Transação restaurada.', 'success');
  });
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function loadState() {
  try {
    const parsed = storageLoadState(LS_KEY);
    if (Array.isArray(parsed?.txs)) {
      state.txs = parsed.txs.map(ensureCanonicalEntry).filter(Boolean);
    }
    if (typeof parsed?.vs === 'string') state.vs = parsed.vs.toLowerCase();
    state.goals = hydrateGoalsState(parsed?.goals || state.goals);
  } catch (e) {
    console.warn('loadState error', e);
  }
  try {
    goalsController.setGoalsState(state.goals);
    goalsController.setEntries(state.txs || []);
  } catch (err) {
    console.warn('goals controller sync failed', err);
  }
}

function saveState() {
  try {
    storageSaveState(state, LS_KEY);
  } catch (e) {
    console.error('saveState error', e);
  }
  try {
    goalsController.setEntries(state.txs || []);
  } catch (err) {
    console.warn('goals state sync error', err);
  }
}

const fmtBRL = (v) =>
  Number.isFinite(Number(v))
    ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
const fmtInt = (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString('pt-BR') : '0');

const currentFiatCurrency = () => {
  const vs = document.getElementById('vsCurrency')?.value || state.vs || 'USD';
  return String(vs).toUpperCase();
};

const fmtCurrency = (v, currency = currentFiatCurrency()) => {
  const num = Number(v);
  if (!Number.isFinite(num)) return null;
  try {
    return num.toLocaleString('pt-BR', { style: 'currency', currency });
  } catch (err) {
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
  }
};

const fmtSignedCurrency = (v, currency = currentFiatCurrency()) => {
  const num = Number(v);
  if (!Number.isFinite(num)) return null;
  const abs = fmtCurrency(Math.abs(num), currency);
  if (!abs) return null;
  if (num > 0) return `+${abs}`;
  if (num < 0) return `-${abs}`;
  return abs;
};

const fmtPercent = (v, digits = 2) => {
  const num = Number(v);
  if (!Number.isFinite(num)) return null;
  return `${num > 0 ? '+' : ''}${num.toFixed(digits)}%`;
};

function getThemeColor(variableName, fallback) {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(variableName);
    return value ? value.trim() : fallback;
  } catch (err) {
    return fallback;
  }
}

function getChartPalette() {
  return {
    brand: getThemeColor('--brand', '#f7931a'),
    green: getThemeColor('--green', '#22c55e'),
    red: getThemeColor('--red', '#ef4444'),
    amber: getThemeColor('--amber', '#f59e0b'),
    muted: getThemeColor('--muted', '#94a3b8'),
    panel: getThemeColor('--panel', 'rgba(17,21,31,0.8)'),
  };
}

function showLoadingOverlay(message = 'A carregar dados...') {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return () => {};
  loadingOverlayCounter += 1;
  overlay.textContent = message;
  overlay.classList.add('visible');
  overlay.setAttribute('aria-hidden', 'false');
  return () => {
    if (loadingOverlayCounter > 0) loadingOverlayCounter -= 1;
    if (loadingOverlayCounter <= 0) {
      overlay.classList.remove('visible');
      overlay.setAttribute('aria-hidden', 'true');
      loadingOverlayCounter = 0;
    }
  };
}

function getLatestMarketPrice() {
  const livePrice = priceService?.getCurrentPrice?.(state.vs || 'usd');
  if (Number.isFinite(livePrice)) return Number(livePrice);
  if (Array.isArray(state.prices) && state.prices.length > 0) {
    const last = state.prices[state.prices.length - 1];
    if (last && Number.isFinite(last.p)) return Number(last.p);
  }
  return null;
}

function createTxStatusBadge(tx) {
  const status = getEffectiveTxStatus(tx);
  const chip = document.createElement('span');
  chip.className = `tx-status tx-status-${status}`;
  chip.textContent = describeTxStatus(status);
  const confirmations = tx.validation?.confirmations;
  if (Number.isFinite(confirmations) && confirmations > 0) {
    const small = document.createElement('span');
    small.className = 'tx-status-meta';
    small.textContent = ` • ${confirmations} conf`;
    chip.appendChild(small);
  }
  if (tx.validation?.reason) {
    chip.title = tx.validation.reason;
  }
  return chip;
}

function findTxById(id) {
  return (state.txs || []).find((tx) => tx.id === id);
}

function applyTxidValidation(tx, result) {
  if (!tx) return;
  tx.validation = result;
  tx.status = result?.status || tx.status || TXID_STATUS.MANUAL;
  tx.txidLastCheckedAt = result?.fetchedAt || new Date().toISOString();
  if (result.confirmedAt && tx.date !== result.confirmedAt) {
    tx.date = result.confirmedAt;
  }
}

function inferValidationTone(status) {
  if (status === TXID_STATUS.CONFIRMED) return 'success';
  if (status === TXID_STATUS.INVALID || status === TXID_STATUS.MISMATCH) return 'warn';
  return 'info';
}

async function runTxidValidation(tx, options = {}) {
  const {
    quiet = false,
    skipRender = false,
    overlayMessage = 'Validando TXID…',
    showOverlay = !quiet,
  } = options;
  const hideOverlay = showOverlay ? showLoadingOverlay(overlayMessage) : () => {};
  try {
    const result = await validateTxidEntry(tx, { network: inferNetworkFromTx(tx) });
    applyTxidValidation(tx, result);
    saveState();
    if (!skipRender) renderAll();
    if (!quiet) {
      showMessage(
        `TXID ${shortTxid(tx.txid)}: ${describeTxStatus(result.status)}`,
        inferValidationTone(result.status)
      );
    }
    return result;
  } catch (err) {
    if (!quiet) {
      console.error('Erro ao validar TXID', err);
      showMessage('Não foi possível validar este TXID no momento.', 'error');
    }
    throw err;
  } finally {
    hideOverlay();
  }
}

function getTxsPendingValidation() {
  return (state.txs || []).filter(
    (tx) => tx.txid && AUTO_VALIDATE_STATUSES.has(getEffectiveTxStatus(tx))
  );
}

function queueTxidValidation(id, options = {}) {
  const { force = false, delay = 200 } = options;
  setTimeout(() => {
    const tx = findTxById(id);
    if (!tx || !tx.txid) return;
    if (!force && !AUTO_VALIDATE_STATUSES.has(getEffectiveTxStatus(tx))) return;
    runTxidValidation(tx, { quiet: true, skipRender: false }).catch((err) =>
      console.warn('Auto validação de TXID falhou', err)
    );
  }, delay);
}

async function validatePendingTxids() {
  const pending = getTxsPendingValidation();
  if (!pending.length) {
    showMessage('Nenhum TXID pendente para validar.', 'info');
    return;
  }
  const hide = showLoadingOverlay(`Validando ${pending.length} TXID(s)…`);
  let success = 0;
  let failure = 0;
  for (const tx of pending) {
    try {
      await runTxidValidation(tx, { quiet: true, skipRender: true, showOverlay: false });
      success += 1;
    } catch (err) {
      failure += 1;
    }
  }
  hide();
  renderAll();
  const tone = failure ? 'warn' : 'success';
  const msg = failure
    ? `Validação concluída: ${success} sucesso(s), ${failure} falha(s).`
    : `Validação concluída para ${success} TXID(s).`;
  showMessage(msg, tone);
}

function renderAudit() {
  renderAuditPanel({
    txs: state.txs || [],
    filterId: auditFilterState.status,
    limit: auditViewState.limit,
    createTxStatusBadge,
    getExplorerUrl: (tx) =>
      tx?.txid
        ? tx.validation?.explorerUrl ||
          buildExplorerUrl(tx.txid, { network: inferNetworkFromTx(tx) })
        : null,
    fmtInt,
    fmtCurrency,
    currentFiatCurrency,
  });
}

function setAuditFilter(nextFilter = 'all') {
  const isValid = AUDIT_FILTERS.some((f) => f.id === nextFilter);
  const resolved = isValid ? nextFilter : 'all';
  if (auditFilterState.status === resolved) return;
  auditFilterState.status = resolved;
  auditViewState.limit = AUDIT_TABLE_DEFAULT_LIMIT;
  renderAudit();
}

const GOAL_DETAIL_MAX_ROWS = 50;

function parseTagsInput(value = '') {
  if (!value) return [];
  return Array.from(
    new Set(
      String(value)
        .split(/[,;]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  ).slice(0, 10);
}

function findGoalById(goalId) {
  if (!goalId || !Array.isArray(state.goals?.list)) return null;
  return state.goals.list.find((goal) => goal.id === goalId) || null;
}

function describeGoalFilters(goal = {}) {
  const parts = [];
  if (goal.strategy) parts.push(`Estratégia: ${goal.strategy}`);
  if (Array.isArray(goal.tags) && goal.tags.length) parts.push(`Tags: ${goal.tags.join(', ')}`);
  return parts.length ? parts.join(' • ') : 'Todos os aportes contam.';
}

function renderGoalsPanel(snapshot = goalsController.getSnapshot()) {
  const safeSnapshot = snapshot || {};
  const catalogs = safeSnapshot.catalogs || {};
  updateGoalFormCatalogs(catalogs);
  updateTxFormCatalogs(catalogs);
  const card = document.getElementById('goalsCard');
  if (!card) return;
  const listEl = document.getElementById('goalsList');
  const emptyEl = document.getElementById('goalsEmptyState');
  const detailEl = document.getElementById('goalsDetail');
  const editBtn = document.getElementById('goalsEditActiveBtn');
  const deleteBtn = document.getElementById('goalsDeleteActiveBtn');
  const { computedGoals = [], activeGoal, activeGoalEntries = [] } = safeSnapshot;
  if (!computedGoals.length) {
    if (listEl) listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    if (detailEl) detailEl.style.display = 'none';
    if (editBtn) {
      editBtn.disabled = true;
      editBtn.dataset.goalId = '';
    }
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.dataset.goalId = '';
    }
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  if (detailEl) detailEl.style.display = 'grid';
  if (listEl) {
    listEl.innerHTML = '';
    computedGoals.forEach(({ goal, progress }) => {
      const cardBtn = document.createElement('button');
      cardBtn.type = 'button';
      cardBtn.className = 'goal-card';
      if (activeGoal && activeGoal.id === goal.id) cardBtn.classList.add('active');
      cardBtn.dataset.goalId = goal.id;

      const title = document.createElement('h4');
      title.textContent = goal.label || 'Meta';
      const target = document.createElement('div');
      target.className = 'goal-target';
      target.textContent = `${fmtInt(goal.targetSats)} sats`;
      const progressWrap = document.createElement('div');
      progressWrap.className = 'goal-progress';
      const bar = document.createElement('div');
      bar.className = 'goal-progress-bar';
      bar.style.width = `${Math.min(100, progress.percent || 0)}%`;
      progressWrap.appendChild(bar);
      const meta = document.createElement('div');
      meta.className = 'goal-card-meta';
      const percentSpan = document.createElement('span');
      percentSpan.textContent = `${progress.percent || 0}%`;
      const satsSpan = document.createElement('span');
      satsSpan.textContent = `${fmtInt(progress.accumulatedSats || 0)} sats`;
      meta.appendChild(percentSpan);
      meta.appendChild(satsSpan);
      const tagsWrap = document.createElement('div');
      tagsWrap.className = 'goal-card-tags';
      if (goal.strategy) {
        const chip = document.createElement('span');
        chip.textContent = `Estratégia: ${goal.strategy}`;
        tagsWrap.appendChild(chip);
      }
      if (Array.isArray(goal.tags) && goal.tags.length) {
        goal.tags.slice(0, 3).forEach((tag) => {
          const chip = document.createElement('span');
          chip.textContent = `#${tag}`;
          tagsWrap.appendChild(chip);
        });
        if (goal.tags.length > 3) {
          const extra = document.createElement('span');
          extra.textContent = `+${goal.tags.length - 3}`;
          tagsWrap.appendChild(extra);
        }
      }

      cardBtn.appendChild(title);
      cardBtn.appendChild(target);
      cardBtn.appendChild(progressWrap);
      cardBtn.appendChild(meta);
      if (tagsWrap.childNodes.length) cardBtn.appendChild(tagsWrap);
      listEl.appendChild(cardBtn);
    });
  }
  const detailProgress = computedGoals.find(
    (item) => activeGoal && item.goal.id === activeGoal.id
  )?.progress;
  renderGoalDetail(activeGoal, detailProgress, activeGoalEntries);
  if (editBtn) {
    editBtn.disabled = !activeGoal;
    editBtn.dataset.goalId = activeGoal?.id || '';
  }
  if (deleteBtn) {
    deleteBtn.disabled = !activeGoal;
    deleteBtn.dataset.goalId = activeGoal?.id || '';
  }
}

function renderGoalDetail(goal, progress, entries = []) {
  const titleEl = document.getElementById('goalDetailTitle');
  const metaEl = document.getElementById('goalDetailMeta');
  const statsEl = document.getElementById('goalDetailStats');
  const tableBody = document.getElementById('goalDetailTableBody');
  const wrapper = document.getElementById('goalDetailEntriesWrapper');
  if (!titleEl || !metaEl || !statsEl || !tableBody) return;
  if (!goal || !progress) {
    titleEl.textContent = 'Selecione uma meta';
    metaEl.textContent = '—';
    statsEl.innerHTML = '';
    while (tableBody.firstChild) tableBody.removeChild(tableBody.firstChild);
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.className = 'muted';
    cell.textContent = 'Selecione uma meta para ver os aportes correspondentes.';
    row.appendChild(cell);
    tableBody.appendChild(row);
    if (wrapper) {
      const note = wrapper.querySelector('.goal-detail-note');
      if (note) note.remove();
    }
    return;
  }
  titleEl.textContent = goal.label || 'Meta';
  metaEl.textContent = `${fmtInt(goal.targetSats)} sats • ${describeGoalFilters(goal)}`;
  const statsData = [
    { label: 'Aportes que contam', value: progress.filteredCount || 0 },
    { label: 'Sats acumulados', value: fmtInt(progress.accumulatedSats || 0) },
    { label: 'Restante', value: fmtInt(progress.remainingSats || 0) },
    { label: 'Progresso', value: `${progress.percent || 0}%` },
  ];
  statsEl.innerHTML = '';
  statsData.forEach((statData) => {
    const stat = document.createElement('div');
    stat.className = 'goal-detail-stat';
    const label = document.createElement('span');
    label.textContent = statData.label;
    const value = document.createElement('strong');
    value.textContent = statData.value;
    stat.appendChild(label);
    stat.appendChild(value);
    statsEl.appendChild(stat);
  });

  while (tableBody.firstChild) tableBody.removeChild(tableBody.firstChild);
  if (!entries.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'muted';
    td.textContent = 'Nenhum aporte corresponde aos filtros desta meta.';
    tr.appendChild(td);
    tableBody.appendChild(tr);
    if (wrapper) {
      const note = wrapper.querySelector('.goal-detail-note');
      if (note) note.remove();
    }
  } else {
    const limit = Math.min(entries.length, GOAL_DETAIL_MAX_ROWS);
    for (let i = 0; i < limit; i++) {
      const entry = entries[i];
      const tr = document.createElement('tr');
      const tdDate = document.createElement('td');
      tdDate.textContent = getTxDate(entry) || '—';
      const tdSats = document.createElement('td');
      tdSats.textContent = fmtInt(getTxSats(entry));
      tdSats.className = 'num';
      const tdFiat = document.createElement('td');
      tdFiat.textContent = fmtCurrency(getTxFiat(entry), currentFiatCurrency()) || '—';
      const tdStrategy = document.createElement('td');
      tdStrategy.textContent = entry.strategy || '—';
      const tdTags = document.createElement('td');
      tdTags.textContent =
        Array.isArray(entry.tags) && entry.tags.length ? entry.tags.join(', ') : '—';
      tr.appendChild(tdDate);
      tr.appendChild(tdSats);
      tr.appendChild(tdFiat);
      tr.appendChild(tdStrategy);
      tr.appendChild(tdTags);
      tableBody.appendChild(tr);
    }
    if (wrapper) {
      let note = wrapper.querySelector('.goal-detail-note');
      if (note) note.remove();
      if (entries.length > limit) {
        note = document.createElement('div');
        note.className = 'muted goal-detail-note';
        note.style.padding = '8px';
        note.textContent = `Mostrando ${limit} de ${entries.length} aportes. Refine os filtros para ver todos.`;
        wrapper.appendChild(note);
      }
    }
  }
}

function updateGoalFormCatalogs(catalogs = {}) {
  const strategies = Array.isArray(catalogs.strategies) ? catalogs.strategies : [];
  const tags = Array.isArray(catalogs.tags) ? catalogs.tags : [];
  const datalist = document.getElementById('goalStrategyOptions');
  if (datalist) {
    datalist.innerHTML = '';
    strategies.slice(0, 20).forEach((strategy) => {
      const option = document.createElement('option');
      option.value = strategy;
      datalist.appendChild(option);
    });
  }
  const suggestions = document.getElementById('goalTagSuggestions');
  if (suggestions) {
    suggestions.innerHTML = '';
    tags.slice(0, 6).forEach((tag) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'goal-chip';
      btn.dataset.tag = tag;
      btn.textContent = `#${tag}`;
      suggestions.appendChild(btn);
    });
    suggestions.style.display = suggestions.childNodes.length ? 'flex' : 'none';
  }
}

function updateTxFormCatalogs(catalogs = {}) {
  const strategies = Array.isArray(catalogs.strategies) ? catalogs.strategies : [];
  const tags = Array.isArray(catalogs.tags) ? catalogs.tags : [];
  const datalist = document.getElementById('txStrategyOptions');
  if (datalist) {
    datalist.innerHTML = '';
    strategies.slice(0, 20).forEach((strategy) => {
      const option = document.createElement('option');
      option.value = strategy;
      datalist.appendChild(option);
    });
  }
  const suggestions = document.getElementById('txTagSuggestions');
  if (suggestions) {
    suggestions.innerHTML = '';
    tags.slice(0, 6).forEach((tag) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'goal-chip';
      btn.dataset.tag = tag;
      btn.textContent = `#${tag}`;
      suggestions.appendChild(btn);
    });
    suggestions.style.display = suggestions.childNodes.length ? 'flex' : 'none';
  }
}

function bindTagSuggestionClicks(containerId, inputId, onSelect = null) {
  const container = document.getElementById(containerId);
  if (!container || container.dataset.bound === 'true') return;
  container.dataset.bound = 'true';
  container.addEventListener('click', (event) => {
    const chip = event.target.closest('button[data-tag]');
    if (!chip) return;
    const tag = chip.dataset.tag;
    const input = document.getElementById(inputId);
    if (!input || !tag) return;
    const list = parseTagsInput(input.value);
    if (!list.includes(tag)) list.push(tag);
    input.value = list.join(', ');
    if (typeof onSelect === 'function') onSelect(list);
  });
}

function updateGoalScopeVisibility(scopeValue = 'all') {
  const strategyInput = document.getElementById('goalStrategy');
  const tagsInput = document.getElementById('goalTags');
  const requiresStrategy = scopeValue === 'strategy' || scopeValue === 'strategy-tags';
  const requiresTags = scopeValue === 'tags' || scopeValue === 'strategy-tags';
  if (strategyInput) strategyInput.disabled = !requiresStrategy;
  if (tagsInput) tagsInput.disabled = !requiresTags;
}

function getGoalScopeValue(goal = {}) {
  const hasStrategy = Boolean(goal.strategy);
  const hasTags = Array.isArray(goal.tags) && goal.tags.length > 0;
  if (hasStrategy && hasTags) return 'strategy-tags';
  if (hasStrategy) return 'strategy';
  if (hasTags) return 'tags';
  return 'all';
}

function applyPresetHighlight(targetSats) {
  const grid = document.getElementById('goalPresetGrid');
  if (!grid) return;
  grid.querySelectorAll('button[data-target]').forEach((btn) => {
    const matches = targetSats && Number(btn.dataset.target) === Number(targetSats);
    btn.classList.toggle('active', Boolean(matches));
  });
}

function openGoalModal(goalId = null) {
  editingGoalId = goalId;
  const modal = document.getElementById('goalModal');
  if (!modal) return;
  const goal = goalId ? findGoalById(goalId) : null;
  const title = document.getElementById('goalModalTitle');
  if (title) title.textContent = goal ? 'Editar meta' : 'Nova meta';
  const labelInput = document.getElementById('goalLabel');
  if (labelInput) labelInput.value = goal?.label || '';
  const satsInput = document.getElementById('goalTargetSats');
  if (satsInput) satsInput.value = goal?.targetSats || '';
  const btcInput = document.getElementById('goalTargetBtc');
  if (btcInput)
    btcInput.value = goal ? (satsToBtc(goal.targetSats) || 0).toFixed(8).replace(/\.?0+$/, '') : '';
  const strategyInput = document.getElementById('goalStrategy');
  if (strategyInput) strategyInput.value = goal?.strategy || '';
  const tagsInput = document.getElementById('goalTags');
  if (tagsInput) tagsInput.value = Array.isArray(goal?.tags) ? goal.tags.join(', ') : '';
  const scopeSelect = document.getElementById('goalScope');
  const scopeValue = goal ? getGoalScopeValue(goal) : 'all';
  if (scopeSelect) scopeSelect.value = scopeValue;
  updateGoalScopeVisibility(scopeValue);
  const deleteBtn = document.getElementById('goalDeleteBtn');
  if (deleteBtn) deleteBtn.style.display = goal ? 'inline-flex' : 'none';
  applyPresetHighlight(goal?.targetSats || null);
  updateGoalPreview();
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  try {
    labelInput?.focus();
  } catch (e) {
    /* noop */
  }
}

function closeGoalModal() {
  editingGoalId = null;
  const modal = document.getElementById('goalModal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  const form = document.getElementById('goalForm');
  if (form) form.reset();
  applyPresetHighlight(null);
}

function collectGoalFormPayload() {
  const label = document.getElementById('goalLabel')?.value?.trim() || '';
  const targetSatsValue = Number(document.getElementById('goalTargetSats')?.value);
  const targetBtcValue = Number(document.getElementById('goalTargetBtc')?.value);
  const scope = document.getElementById('goalScope')?.value || 'all';
  const strategyValue = document.getElementById('goalStrategy')?.value?.trim() || '';
  const tagsValue = document.getElementById('goalTags')?.value || '';
  const existing = editingGoalId ? findGoalById(editingGoalId) : null;
  const payload = {
    id: editingGoalId || undefined,
    label,
    targetSats:
      Number.isFinite(targetSatsValue) && targetSatsValue > 0 ? targetSatsValue : undefined,
    targetBtc: Number.isFinite(targetBtcValue) && targetBtcValue > 0 ? targetBtcValue : undefined,
    createdAt: existing?.createdAt,
    completedAt: existing?.completedAt,
  };
  if (scope === 'strategy' || scope === 'strategy-tags') {
    payload.strategy = strategyValue;
  } else {
    payload.strategy = '';
  }
  if (scope === 'tags' || scope === 'strategy-tags') {
    payload.tags = parseTagsInput(tagsValue);
  } else {
    payload.tags = [];
  }
  if (!payload.label && (payload.targetSats || payload.targetBtc)) {
    payload.label = `Meta ${fmtInt(payload.targetSats || Math.floor(payload.targetBtc * 1e8))}`;
  }
  return payload;
}

function updateGoalPreview() {
  const preview = document.getElementById('goalPreview');
  if (!preview) return;
  const payload = collectGoalFormPayload();
  const goal = normalizeGoalConfig(payload);
  if (!goal) {
    preview.textContent = 'Defina um alvo em sats ou BTC para ver o preview.';
    return;
  }
  goal.strategy = payload.strategy || '';
  goal.tags = payload.tags || [];
  const progress = computeGoalProgress(goal, state.txs || []);
  preview.textContent = `${fmtInt(progress.accumulatedSats)} de ${fmtInt(goal.targetSats)} sats (${progress.percent || 0}%). ${describeGoalFilters(goal)}`;
}

async function handleGoalFormSubmit(event) {
  if (event) event.preventDefault();
  const payload = collectGoalFormPayload();
  const normalized = normalizeGoalConfig(payload);
  if (!normalized) {
    showMessage('Defina um alvo em sats ou BTC para salvar a meta.', 'warn');
    return;
  }
  normalized.strategy = payload.strategy || '';
  normalized.tags = payload.tags || [];
  normalized.createdAt = payload.createdAt || normalized.createdAt;
  normalized.completedAt = payload.completedAt || null;
  const result = editingGoalId
    ? goalsController.updateGoal(editingGoalId, normalized)
    : goalsController.addGoal(normalized);
  if (!result) {
    showMessage('Não foi possível salvar esta meta.', 'error');
    return;
  }
  saveState();
  showMessage(editingGoalId ? 'Meta atualizada.' : 'Meta criada.', 'success');
  closeGoalModal();
}

async function handleGoalDelete(goalId) {
  const goal = findGoalById(goalId);
  if (!goal) return;
  const confirmed = await confirmModalAsync(`Remover a meta “${goal.label}”?`);
  if (!confirmed) return;
  goalsController.removeGoal(goalId);
  saveState();
  closeGoalModal();
  showMessage('Meta removida.', 'info');
}

function renderGoalPresets() {
  const grid = document.getElementById('goalPresetGrid');
  if (!grid) return;
  grid.innerHTML = '';
  getPresetGoals().forEach((preset) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = preset.label;
    btn.dataset.target = preset.targetSats;
    btn.addEventListener('click', () => {
      const satsInput = document.getElementById('goalTargetSats');
      const btcInput = document.getElementById('goalTargetBtc');
      if (satsInput) satsInput.value = preset.targetSats;
      if (btcInput)
        btcInput.value = satsToBtc(preset.targetSats)
          .toFixed(8)
          .replace(/\.?0+$/, '');
      applyPresetHighlight(preset.targetSats);
      updateGoalPreview();
    });
    grid.appendChild(btn);
  });
}

function bindGoalControls() {
  const newBtn = document.getElementById('goalsNewBtn');
  if (newBtn && !newBtn.dataset.bound) {
    newBtn.dataset.bound = 'true';
    newBtn.addEventListener('click', () => openGoalModal());
  }
  const listEl = document.getElementById('goalsList');
  if (listEl && !listEl.dataset.bound) {
    listEl.dataset.bound = 'true';
    listEl.addEventListener('click', (event) => {
      const cardBtn = event.target.closest('.goal-card');
      if (!cardBtn) return;
      const goalId = cardBtn.dataset.goalId;
      if (goalId) goalsController.setActiveGoal(goalId);
    });
  }
  const editBtn = document.getElementById('goalsEditActiveBtn');
  if (editBtn && !editBtn.dataset.bound) {
    editBtn.dataset.bound = 'true';
    editBtn.addEventListener('click', () => {
      const goalId = editBtn.dataset.goalId;
      if (goalId) openGoalModal(goalId);
    });
  }
  const deleteBtn = document.getElementById('goalsDeleteActiveBtn');
  if (deleteBtn && !deleteBtn.dataset.bound) {
    deleteBtn.dataset.bound = 'true';
    deleteBtn.addEventListener('click', async () => {
      const goalId = deleteBtn.dataset.goalId;
      if (goalId) await handleGoalDelete(goalId);
    });
  }
  const form = document.getElementById('goalForm');
  if (form && !form.dataset.bound) {
    form.dataset.bound = 'true';
    form.addEventListener('submit', handleGoalFormSubmit);
  }
  ['goalTargetSats', 'goalTargetBtc', 'goalStrategy', 'goalTags', 'goalLabel'].forEach((id) => {
    const input = document.getElementById(id);
    if (input && !input.dataset.goalBound) {
      input.dataset.goalBound = 'true';
      input.addEventListener('input', () => updateGoalPreview());
    }
  });
  const scopeSelect = document.getElementById('goalScope');
  if (scopeSelect && !scopeSelect.dataset.bound) {
    scopeSelect.dataset.bound = 'true';
    scopeSelect.addEventListener('change', () => {
      updateGoalScopeVisibility(scopeSelect.value);
      updateGoalPreview();
    });
  }
  const cancelBtn = document.getElementById('goalCancelBtn');
  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.dataset.bound = 'true';
    cancelBtn.addEventListener('click', () => closeGoalModal());
  }
  const modalClose = document.getElementById('goalModalClose');
  if (modalClose && !modalClose.dataset.bound) {
    modalClose.dataset.bound = 'true';
    modalClose.addEventListener('click', () => closeGoalModal());
  }
  const modal = document.getElementById('goalModal');
  if (modal && !modal.dataset.bound) {
    modal.dataset.bound = 'true';
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeGoalModal();
    });
  }
  const deleteModalBtn = document.getElementById('goalDeleteBtn');
  if (deleteModalBtn && !deleteModalBtn.dataset.bound) {
    deleteModalBtn.dataset.bound = 'true';
    deleteModalBtn.addEventListener('click', async () => {
      if (editingGoalId) await handleGoalDelete(editingGoalId);
    });
  }
  bindTagSuggestionClicks('goalTagSuggestions', 'goalTags', () => updateGoalPreview());
  bindTagSuggestionClicks('txTagSuggestions', 'tx-tags');
  const presetGrid = document.getElementById('goalPresetGrid');
  if (presetGrid && !presetGrid.dataset.bound) {
    presetGrid.dataset.bound = 'true';
    renderGoalPresets();
  }
  renderGoalsPanel();
}

function createEntryFromNormalized(normalized, meta = {}) {
  if (!normalized) return null;
  const now = new Date().toISOString();
  const entry = createDefaultEntry({
    id: normalized.id || uid(),
    date: normalized.date,
    fiatAmount: normalized.fiat ?? normalized.price ?? 0,
    fiatCurrency: meta.fiatCurrency || currentFiatCurrency(),
    btcPrice: normalized.price ?? 0,
    fee: normalized.fee ?? 0,
    btcAmount: satsToBtc(normalized.sats ?? 0),
    sats: normalized.sats ?? 0,
    txid: meta.txid || '',
    wallet: meta.wallet || '',
    status: meta.status || 'manual',
    strategy: meta.strategy || '',
    note: normalized.note ?? meta.note ?? '',
    createdAt: meta.createdAt || now,
    updatedAt: meta.updatedAt || now,
  });
  const merged = {
    ...entry,
    ...meta,
    btcPrice: entry.btcPrice,
    fiatAmount: entry.fiatAmount,
    schemaVersion: SCHEMA_VERSION,
  };
  merged.price = merged.btcPrice;
  merged.fiat = merged.fiatAmount;
  merged.closed = Boolean(normalized.closed ?? meta.closed ?? merged.closed);
  merged.weight = normalized.weight ?? meta.weight ?? null;
  if (typeof merged.exchange !== 'string') merged.exchange = '';
  const normalizedExchange =
    typeof normalized.exchange === 'string' ? normalized.exchange : undefined;
  merged.exchange = normalizedExchange ?? meta.exchange ?? merged.exchange ?? '';
  const normalizedType = typeof normalized.type === 'string' ? normalized.type : undefined;
  const allowedTypes = ['buy', 'sell'];
  const resolvedType = (normalizedType ?? meta.type ?? merged.type ?? 'buy').toLowerCase();
  merged.type = allowedTypes.includes(resolvedType) ? resolvedType : 'buy';
  if (Array.isArray(normalized.tags) && normalized.tags.length) {
    merged.tags = normalized.tags.slice(0, 10);
  } else if (Array.isArray(meta.tags) && meta.tags.length) {
    merged.tags = meta.tags.slice(0, 10);
  } else if (!Array.isArray(merged.tags)) {
    merged.tags = [];
  }
  return merged;
}

function ensureCanonicalEntry(entry = {}) {
  if (!entry) return null;
  if (entry.schemaVersion === SCHEMA_VERSION && entry.fiatAmount != null && entry.btcPrice != null)
    return entry;
  const price = getTxPrice(entry);
  const sats = getTxSats(entry);
  const fiat = getTxFiat(entry);
  if (!price || price <= 0) return entry;
  const normalized = normalizeEntry({
    id: entry.id,
    date: getTxDate(entry),
    price,
    fiat,
    sats,
    fee: entry.fee ?? 0,
    note: entry.note,
    closed: entry.closed,
    weight: entry.weight,
  });
  if (!normalized) return entry;
  const canonical = createEntryFromNormalized(normalized, {
    txid: entry.txid,
    wallet: entry.wallet,
    status: entry.status,
    strategy: entry.strategy,
    tags: entry.tags,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    fiatCurrency: entry.fiatCurrency,
    id: entry.id,
  });
  return {
    ...canonical,
    ...entry,
    ...{
      btcPrice: canonical.btcPrice,
      fiatAmount: canonical.fiatAmount,
      price: canonical.price,
      fiat: canonical.fiat,
      schemaVersion: SCHEMA_VERSION,
    },
  };
}

// Render last 12 months boxes and place transactions into respective month boxes
function renderMonths(list = getVisibleTxs()) {
  const grid = document.getElementById('monthsGrid');
  if (!grid) return;
  while (grid.firstChild) grid.removeChild(grid.firstChild);
  // For now: render months January..December of the selected year (or current year)
  const yearSel = document.getElementById('yearSelect');
  const now = new Date();
  const year = yearSel && yearSel.value ? parseInt(yearSel.value, 10) : now.getFullYear();
  const months = [];
  for (let m = 0; m < 12; m++) months.push(new Date(year, m, 1));

  // group transactions by month key YYYY-MM
  const txByMonth = {};
  for (const tx of list || []) {
    const t = new Date(getTxDate(tx));
    if (isNaN(t)) continue;
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
    txByMonth[key] = txByMonth[key] || [];
    txByMonth[key].push(tx);
  }

  // render boxes
  for (const d of months) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const box = document.createElement('div');
    box.className = 'monthBox';
    const monthLabel = d.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });

    const head = document.createElement('div');
    head.className = 'monthHead';
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.alignItems = 'center';

    const headLeft = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = monthLabel;
    const sub = document.createElement('div');
    sub.className = 'muted';
    sub.style.fontSize = '12px';
    sub.textContent = key;
    headLeft.appendChild(strong);
    headLeft.appendChild(sub);
    head.appendChild(headLeft);
    box.appendChild(head);

    const entries = txByMonth[key] || [];
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '6px';
    controls.style.marginTop = '8px';
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn ghost';
    toggleBtn.textContent = entries.length ? `Mostrar (${entries.length})` : 'Mostrar (0)';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn';
    addBtn.textContent = 'Adicionar';
    controls.appendChild(toggleBtn);
    controls.appendChild(addBtn);
    box.appendChild(controls);

    const entriesList = document.createElement('div');
    entriesList.style.display = 'none';
    entriesList.style.gap = '6px';
    entriesList.style.marginTop = '8px';
    if (entries.length === 0) {
      const p = document.createElement('div');
      p.className = 'muted';
      p.textContent = '—';
      entriesList.appendChild(p);
    } else {
      for (const e of entries) {
        const row = document.createElement('div');
        row.className = 'entry';
        const info = document.createElement('div');
        info.style.display = 'grid';
        info.style.gap = '2px';
        const dateLabel = document.createElement('strong');
        dateLabel.textContent = getTxDate(e);
        info.appendChild(dateLabel);
        const details = [];
        const sats = getTxSats(e);
        if (sats) details.push(`${fmtInt(sats)} sats`);
        const price = getTxPrice(e);
        if (price) details.push(fmtBRL(price));
        const note = getTxNote(e);
        if (note) details.push(note);
        if (e.strategy) details.push(`Estratégia: ${e.strategy}`);
        if (Array.isArray(e.tags) && e.tags.length) details.push(`#${e.tags.join(', #')}`);
        if (details.length) {
          const meta = document.createElement('span');
          meta.className = 'muted';
          meta.textContent = details.join(' • ');
          info.appendChild(meta);
        }
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '6px';
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn ghost';
        editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', (event) => {
          event.preventDefault();
          startEditTransaction(e.id);
        });
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn ghost';
        deleteBtn.textContent = 'Apagar';
        deleteBtn.addEventListener('click', async (event) => {
          event.preventDefault();
          await deleteTransactionById(e.id);
        });
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        row.appendChild(info);
        row.appendChild(actions);
        entriesList.appendChild(row);
      }
    }
    box.appendChild(entriesList);
    grid.appendChild(box);

    // wire toggle
    toggleBtn.addEventListener('click', () => {
      if (entriesList.style.display === 'none') {
        entriesList.style.display = 'grid';
        toggleBtn.textContent = `Ocultar (${entries.length})`;
      } else {
        entriesList.style.display = 'none';
        toggleBtn.textContent = `Mostrar (${entries.length})`;
      }
    });
    // wire add: prefill form date and focus price
    addBtn.addEventListener('click', () => {
      try {
        const txDate = document.getElementById('tx-date');
        const txPrice = document.getElementById('tx-price');
        const txSats = document.getElementById('tx-sats');
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        if (txDate) {
          txDate.value = `${y}-${m}-01`;
          txDate.focus();
        }
        if (txPrice) txPrice.focus();
        // scroll form into view
        const form = document.getElementById('tx-form');
        if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {
        console.warn('addBtn handler error', e);
      }
    });
  }
}

function bindForm() {
  const form = document.getElementById('tx-form');
  if (!form) return;
  const cancelBtn = document.getElementById('tx-cancel-edit');
  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.dataset.bound = 'true';
    cancelBtn.addEventListener('click', () => cancelEditTransaction());
  }
  const deleteEditBtn = document.getElementById('tx-delete-edit');
  if (deleteEditBtn && !deleteEditBtn.dataset.bound) {
    deleteEditBtn.dataset.bound = 'true';
    deleteEditBtn.addEventListener('click', () => {
      if (editingTxId) deleteTransactionById(editingTxId);
    });
  }
  updateFormModeUI(Boolean(editingTxId));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let txidToAutoValidate = null;
    const date = document.getElementById('tx-date').value;
    const satsValue = Number(document.getElementById('tx-sats').value);
    const priceValue = Number(document.getElementById('tx-price').value);
    const fiatValue = Number(document.getElementById('tx-fiat').value);
    const feeValueRaw = document.getElementById('tx-fee').value;
    const feeValue = feeValueRaw === '' ? 0 : Number(feeValueRaw);
    const exchange = document.getElementById('tx-exchange').value?.trim();
    const typeEl = document.getElementById('tx-type');
    const typeRaw = typeEl?.value?.toLowerCase() || 'buy';
    const allowedTypes = new Set(['buy', 'sell']);
    const type = allowedTypes.has(typeRaw) ? typeRaw : 'buy';
    const note = document.getElementById('tx-note').value?.trim();
    const txidValue = document.getElementById('tx-txid')?.value?.trim();
    const walletValue = document.getElementById('tx-wallet')?.value?.trim();
    const strategyValue = document.getElementById('tx-strategy')?.value?.trim() || '';
    const tagsRawValue = document.getElementById('tx-tags')?.value || '';
    const tagList = parseTagsInput(tagsRawValue);
    setFormError('');
    if (!date || !Number.isFinite(satsValue) || satsValue <= 0) {
      setFormError('Informe data e sats (> 0).');
      return;
    }
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      setFormError('Preço do BTC deve ser maior que zero.');
      return;
    }
    if (!Number.isFinite(fiatValue) || fiatValue <= 0) {
      setFormError('Valor em moeda deve ser maior que zero.');
      return;
    }
    if (feeValueRaw !== '' && !Number.isFinite(feeValue)) {
      setFormError('Fee precisa ser um número válido.');
      return;
    }
    const sats = Math.floor(satsValue);
    const price = Number(priceValue);
    const fiat = Number(fiatValue);
    const fee = Number.isFinite(feeValue) ? feeValue : 0;
    const validation = validateTransaction({ date, sats, price, fiat, fee });
    if (!validation.ok) {
      setFormError(validation.reason || 'Entrada inválida.');
      return;
    }
    const baseId = editingTxId || uid();
    const normalized = normalizeEntry({ id: baseId, date, sats, price, fiat, fee, note });
    if (!normalized) {
      setFormError('Falha ao normalizar a entrada. Verifique os valores.');
      return;
    }
    const metaBase = {
      note,
      exchange: exchange || '',
      type,
      txid: txidValue || '',
      wallet: walletValue || '',
      status: txidValue ? TXID_STATUS.PENDING : TXID_STATUS.MANUAL,
      strategy: strategyValue,
      tags: tagList,
    };
    if (editingTxId) {
      const idx = state.txs.findIndex((t) => t.id === editingTxId);
      if (idx < 0) {
        setFormError('Entrada a editar não encontrada.');
        return;
      }
      const current = state.txs[idx];
      if (normalized) {
        normalized.closed = current.closed;
        if (current.weight !== undefined) normalized.weight = current.weight;
      }
      const updated = createEntryFromNormalized(normalized, {
        id: editingTxId,
        note,
        exchange: exchange || '',
        type,
        txid: txidValue || '',
        wallet: walletValue || '',
        status: txidValue ? TXID_STATUS.PENDING : TXID_STATUS.MANUAL,
        strategy: strategyValue,
        tags: tagList,
        fiatCurrency: current.fiatCurrency,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      });
      if (!updated) {
        setFormError('Erro ao criar a entrada canônica.');
        return;
      }
      const sameTxid = (current.txid || '') === (txidValue || '');
      if (sameTxid && current.validation) {
        updated.validation = current.validation;
        updated.status = current.validation.status || updated.status;
      }
      state.txs.splice(idx, 1, updated);
      if (updated.txid && (!sameTxid || !updated.validation)) {
        txidToAutoValidate = updated.id;
      }
      editingTxId = null;
      updateFormModeUI(false);
      form.reset();
      showMessage('Transação atualizada.', 'success');
    } else {
      const entry = createEntryFromNormalized(normalized, metaBase);
      if (!entry) {
        setFormError('Erro ao criar a entrada canônica.');
        return;
      }
      entry.validation = null;
      state.txs.push(entry);
      if (entry.txid) {
        txidToAutoValidate = entry.id;
      }
      form.reset();
      showMessage('Aporte registado.', 'success');
    }
    saveState();
    renderAll();
    setFormError('');
    if (txidToAutoValidate) {
      queueTxidValidation(txidToAutoValidate);
    }
  });
}

async function handleValidateTxid(id) {
  const tx = findTxById(id);
  if (!tx) {
    showMessage('Transação não encontrada.', 'warn');
    return;
  }
  if (!tx.txid) {
    showMessage('Este aporte não possui TXID cadastrado.', 'warn');
    return;
  }
  await runTxidValidation(tx);
}

function buildExportPayload() {
  const entries = Array.isArray(state.txs) ? state.txs : [];
  const vsCurrency = (
    document.getElementById('vsCurrency')?.value ||
    state.vs ||
    'usd'
  ).toLowerCase();
  return {
    version: 1,
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    vs: vsCurrency,
    entries,
    txs: entries,
    goals: state.goals,
  };
}

function getExportJson(pretty = true) {
  return JSON.stringify(buildExportPayload(), null, pretty ? 2 : 0);
}

const CSV_HEADERS = [
  'id',
  'date',
  'type',
  'sats',
  'btc_amount',
  'btc_price',
  'fiat_amount',
  'fee',
  'exchange',
  'wallet',
  'txid',
  'txid_status',
  'txid_reason',
  'txid_confirmations',
  'txid_last_checked',
  'note',
];

function getExportCsv() {
  const entries = Array.isArray(state.txs) ? state.txs : [];
  const lines = [CSV_HEADERS.join(',')];
  entries.forEach((entry) => {
    const btcAmount = satsToBtc(getTxSats(entry));
    const validation = entry.validation || {};
    const row = [
      entry.id || '',
      getTxDate(entry) || '',
      entry.type || 'buy',
      getTxSats(entry) || 0,
      btcAmount ? btcAmount.toFixed(8) : '0',
      Number.isFinite(getTxPrice(entry)) ? Number(getTxPrice(entry)).toFixed(2) : '',
      Number.isFinite(getTxFiat(entry)) ? Number(getTxFiat(entry)).toFixed(2) : '',
      Number.isFinite(entry.fee) ? Number(entry.fee).toFixed(2) : '',
      entry.exchange || '',
      entry.wallet || '',
      entry.txid || '',
      validation.status || entry.status || '',
      validation.reason || '',
      Number.isFinite(validation.confirmations) ? validation.confirmations : '',
      entry.txidLastCheckedAt || validation.fetchedAt || '',
      getTxNote(entry) || '',
    ];
    lines.push(row.map(csvEscape).join(','));
  });
  return lines.join('\n');
}

function downloadExportFile(jsonText = getExportJson(true)) {
  try {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `btc_journal_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showMessage('Backup exportado com sucesso.', 'success');
  } catch (err) {
    console.error('downloadExportFile error', err);
    showMessage('Não foi possível gerar o ficheiro de exportação.', 'error');
  }
}

function downloadExportCsv(csvText = getExportCsv()) {
  try {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `btc_journal_backup_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showMessage('CSV exportado com sucesso.', 'success');
  } catch (err) {
    console.error('downloadExportCsv error', err);
    showMessage('Não foi possível gerar o CSV.', 'error');
  }
}

function populateExportPreview() {
  const json = getExportJson(true);
  return renderExportPreview({
    json,
    entryCount: Array.isArray(state.txs) ? state.txs.length : 0,
  });
}

function openExportModal() {
  if (!document.getElementById('exportModal')) {
    downloadExportFile();
    return;
  }
  populateExportPreview();
  showExportModal();
}

function closeExportModal() {
  hideExportModal();
}

async function copyExportJson() {
  const json = getExportJson(true);
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(json);
    } else {
      const preview = document.getElementById('exportPreview');
      if (!preview) throw new Error('Clipboard indisponível');
      preview.focus();
      preview.select();
      document.execCommand('copy');
      preview.setSelectionRange(0, 0);
      preview.blur();
    }
    showMessage('JSON copiado para a área de transferência.', 'success');
  } catch (err) {
    console.error('copyExportJson error', err);
    showMessage('Não foi possível copiar automaticamente. Copie manualmente.', 'warn');
  }
}

function openImportModal() {
  showImportModal();
}

function closeImportModal(clearPayload = true) {
  hideImportModal();
  if (clearPayload) pendingImportPayload = null;
  populateImportPreview(clearPayload ? null : pendingImportPayload);
}

function populateImportPreview(payload) {
  renderImportPreview(payload, {
    currentFiatCurrency,
    fmtCurrency,
    getTxDate,
    getTxFiat,
    getTxPrice,
  });
}

function applyPendingImport() {
  if (
    !pendingImportPayload ||
    !Array.isArray(pendingImportPayload.entries) ||
    pendingImportPayload.entries.length === 0
  ) {
    showMessage('Nenhum arquivo pronto para importação.', 'warn');
    return;
  }
  try {
    backupLocalData(LS_KEY);
  } catch (err) {
    console.warn('backupLocalData import failed', err);
  }
  state.txs = pendingImportPayload.entries;
  if (pendingImportPayload.vs) {
    state.vs = pendingImportPayload.vs;
    const select = document.getElementById('vsCurrency');
    if (select) select.value = pendingImportPayload.vs;
  }
  if (pendingImportPayload.goals) {
    state.goals = hydrateGoalsState(pendingImportPayload.goals);
  } else {
    state.goals = createEmptyGoalsState();
  }
  goalsController.setGoalsState(state.goals);
  saveState();
  renderAll();
  const invalidMsg = pendingImportPayload.invalidCount
    ? ` (${pendingImportPayload.invalidCount} inválida${pendingImportPayload.invalidCount === 1 ? '' : 's'} ignorada${pendingImportPayload.invalidCount === 1 ? '' : 's'})`
    : '';
  showMessage(
    `Importação concluída: ${pendingImportPayload.entries.length} entradas aplicadas${invalidMsg}.`,
    'success'
  );
  closeImportModal();
}

async function handleImportFile(file) {
  const hideLoading = showLoadingOverlay('A importar dados...');
  try {
    const text = await file.text();
    const prepared = prepareImportPayloadFromText(text);
    if (!prepared) {
      showMessage('Formato de arquivo não suportado.', 'error');
      return;
    }
    const container = {
      entries: prepared.entries,
      vs: prepared.meta?.vs,
      year: prepared.meta?.year,
    };
    const importedGoals = prepared.goals ? hydrateGoalsState(prepared.goals) : null;
    const sanitized = sanitizeImportPayload(container);
    if (!sanitized.ok) {
      showMessage(sanitized.reason || 'Arquivo inválido.', 'error');
      return;
    }
    const canonicalEntries = sanitized.entries
      .map((entry, index) => {
        const source = sanitized.sources?.[index] || {};
        const canonical = createEntryFromNormalized(entry, source);
        if (!canonical) return null;
        if (source.validation && typeof source.validation === 'object') {
          canonical.validation = { ...source.validation };
        }
        if (source.status) canonical.status = source.status;
        if (source.txidLastCheckedAt) canonical.txidLastCheckedAt = source.txidLastCheckedAt;
        return canonical;
      })
      .filter(Boolean);
    if (!canonicalEntries.length) {
      showMessage('Nenhuma entrada válida após normalização.', 'warn');
      return;
    }
    pendingImportPayload = {
      entries: canonicalEntries,
      invalidCount: Array.isArray(sanitized.invalid) ? sanitized.invalid.length : 0,
      vs: sanitized.vs,
      sourceCount: sanitized.entries.length,
      fileName: file?.name || 'import.json',
      goals: importedGoals,
    };
    populateImportPreview(pendingImportPayload);
    openImportModal();
  } catch (err) {
    console.error('Import error', err);
    showMessage('Erro ao importar arquivo. Verifique o formato.', 'error');
  } finally {
    hideLoading();
  }
}

// Mensagens/banners UI
function showMessage(
  text,
  type = 'info',
  timeout = 4500,
  actionLabel = null,
  actionCallback = null
) {
  const container = document.getElementById('messageContainer');
  if (!container) {
    if (typeof window !== 'undefined' && window.alert) window.alert(text);
    return;
  }
  const el = document.createElement('div');
  el.className = `msg ${type}`;
  const span = document.createElement('span');
  span.textContent = text;
  el.appendChild(span);

  if (actionLabel) {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'action';
    actionBtn.textContent = actionLabel;
    actionBtn.addEventListener('click', () => {
      try {
        if (typeof actionCallback === 'function') actionCallback();
      } catch (e) {
        console.error(e);
      }
      el.remove();
    });
    el.appendChild(actionBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close';
  closeBtn.setAttribute('aria-label', 'fechar');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => el.remove());
  el.appendChild(closeBtn);

  container.appendChild(el);
  if (timeout > 0) setTimeout(() => el.remove(), timeout);
}

// Confirm modal async
function confirmModalAsync(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const msg = document.getElementById('confirmModalMessage');
    const ok = document.getElementById('confirmOkBtn');
    const cancel = document.getElementById('confirmCancelBtn');
    if (!modal || !msg || !ok || !cancel) {
      resolve(window.confirm(message));
      return;
    }
    msg.textContent = message;
    modal.style.display = 'flex';
    function cleanup() {
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      modal.style.display = 'none';
    }
    function onOk() {
      cleanup();
      resolve(true);
    }
    function onCancel() {
      cleanup();
      resolve(false);
    }
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
  });
}
// Expor para handlers herdados (se necessário)
window.confirmModalAsync = confirmModalAsync;

// Migration: detect old key 'btcJournalV1' and offer migration com backup
function detectAndOfferMigration() {
  try {
    const old = detectOldKey('btcJournalV1');
    if (!old) return;
    const existingState = storageLoadState(LS_KEY) || {};
    const hasNew = Array.isArray(existingState?.txs) && existingState.txs.length > 0;
    const proceed = confirm(
      'Dados antigos detectados (btcJournalV1). Deseja migrar para o novo formato? Será criado um backup antes.'
    );
    if (!proceed) return;
    if (hasNew) {
      const overwrite = confirm(
        'Já existem dados no formato novo. Migrar vai sobrescrever os aportes atuais. Tem certeza que deseja continuar?'
      );
      if (!overwrite) {
        showMessage('Migração cancelada. Seus dados atuais foram preservados.', 'info');
        return;
      }
    }
    // criar backup via helper para não perder dados legados
    try {
      backupLocalData('btcJournalV1');
    } catch (e) {
      console.warn('Backup antigo falhou', e);
    }
    const migrated = migrateV1ToV3(old);
    // Suportar array de entradas ou object { entries: [...] }
    const payload = Array.isArray(migrated?.txs) ? { entries: migrated.txs } : null;
    if (!payload) {
      showMessage('Formato de backup antigo não reconhecido.', 'error');
      return;
    }
    const res = sanitizeImportPayload(payload);
    if (!res.ok) {
      showMessage('Migração detectou entradas inválidas. Nenhuma alteração aplicada.', 'error');
      return;
    }
    // Aplicar migracao: mapear para txs minimal
    state.txs = res.entries
      .map((entry, index) => createEntryFromNormalized(entry, res.sources?.[index]))
      .filter(Boolean);
    state.goals = createEmptyGoalsState();
    goalsController.setGoalsState(state.goals);
    saveState();
    renderAll();
    showMessage('Migração concluída com sucesso. Backup criado.', 'success');
  } catch (err) {
    console.error('Migration error', err);
    showMessage('Erro durante a migração. Veja a consola.', 'error');
  }
}

// =====================
// Glass overlay / botão "Ir para gráfico"
// =====================
let glassChartInstance = null;
function ensureUsdDefault() {
  if (!state.vs) state.vs = 'usd';
}

function openChartGlass() {
  const overlay = document.getElementById('chartGlassOverlay');
  if (!overlay) return;
  overlay.setAttribute('aria-hidden', 'false');
  overlay.style.display = 'flex';
  // render glass chart (non-destructive)
  try {
    renderChartToCanvas('glassBtcChart');
  } catch (e) {
    console.warn('glass render error', e);
  }
}

function closeChartGlass() {
  const overlay = document.getElementById('chartGlassOverlay');
  if (!overlay) return;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.display = 'none';
  try {
    if (glassChartInstance) {
      glassChartInstance.destroy();
      glassChartInstance = null;
    }
  } catch (e) {}
}

const MIN_POINT_RADIUS = 3;
const MAX_POINT_RADIUS = 10;

const computePointRadius = (sats = 0) => {
  if (!Number.isFinite(sats) || sats <= 0) return MIN_POINT_RADIUS;
  const magnitude = Math.log10(Math.max(1, sats));
  return Math.min(MAX_POINT_RADIUS, Math.max(MIN_POINT_RADIUS, 3 + magnitude * 0.6));
};

function buildChartSeries(visibleTxs = getVisibleTxs()) {
  const priceSeries = Array.isArray(state.prices) ? state.prices : [];
  const labels = priceSeries.map((p) => p.t);
  const priceData = priceSeries.map((p) => p.p);
  const currentPrice = priceSeries.length ? Number(priceSeries[priceSeries.length - 1].p) : null;
  const chartTxs = getTxsForChart(visibleTxs) || [];
  const points = chartTxs.map((tx) => createChartPoint(tx, currentPrice)).filter(Boolean);
  const avgPrice = chartTxs.length ? pmMedio(chartTxs) : 0;
  return { labels, priceData, points, avgPrice, chartTxs, currentPrice };
}

function createChartPoint(tx, currentPrice) {
  const dateStr = getTxDate(tx);
  const time = dateStr ? new Date(dateStr).getTime() : NaN;
  if (Number.isNaN(time)) return null;
  const price = getTxPrice(tx);
  if (!Number.isFinite(price) || price <= 0) return null;
  const sats = getTxSats(tx);
  const plPct = currentPrice && price ? ((currentPrice - price) / price) * 100 : 0;
  const type = typeof tx.type === 'string' ? tx.type.toLowerCase() : 'buy';
  return {
    x: time,
    y: price,
    sats,
    note: getTxNote(tx),
    exchange: tx.exchange || '',
    type,
    closed: Boolean(tx.closed),
    fiat: getTxFiat(tx),
    plPct,
    id: tx.id,
  };
}

function buildEntryDataset(points = [], palette = {}) {
  return {
    type: 'scatter',
    label: 'Entradas',
    data: points,
    parsing: false,
    pointRadius(context) {
      return computePointRadius(context.raw?.sats || 0);
    },
    pointHoverRadius(context) {
      return Math.min(MAX_POINT_RADIUS + 2, computePointRadius(context.raw?.sats || 0) + 2);
    },
    pointBackgroundColor(context) {
      const raw = context.raw || {};
      if (raw.closed) return palette.muted || '#94a3b8';
      if (raw.type === 'sell') return palette.amber || '#f59e0b';
      if (raw.plPct > 0) return palette.green || '#22c55e';
      if (raw.plPct < 0) return palette.red || '#ef4444';
      return palette.amber || '#f59e0b';
    },
    pointBorderColor(context) {
      const raw = context.raw || {};
      if (raw.closed) return palette.muted || '#94a3b8';
      return '#0b1220';
    },
    pointBorderWidth: 1,
    pointStyle(context) {
      const raw = context.raw || {};
      if (raw.closed) return 'rectRounded';
      if (raw.type === 'sell') return 'triangle';
      return 'circle';
    },
    order: 10,
  };
}

function buildAverageDataset(length = 0, avgPrice = 0, palette = {}) {
  return {
    label: 'Preço médio',
    type: 'line',
    data: Array.from({ length }, () => avgPrice),
    borderColor: palette.amber || '#f59e0b',
    borderDash: [6, 6],
    borderWidth: 1,
    pointRadius: 0,
    tension: 0,
    order: 2,
  };
}

function isAnnotationAvailable() {
  return (
    typeof Chart !== 'undefined' &&
    Chart.registry &&
    Chart.registry.getPlugin &&
    Chart.registry.getPlugin('annotation')
  );
}

function getActiveChartPoint(chart) {
  const tooltipPoints = chart?.tooltip?.dataPoints;
  if (Array.isArray(tooltipPoints) && tooltipPoints.length > 0) {
    const point = tooltipPoints[0];
    const x = point?.element?.x;
    const y = point?.element?.y;
    const value = point?.parsed?.y;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y, value: Number.isFinite(value) ? value : null };
    }
  }

  const active = typeof chart?.getActiveElements === 'function' ? chart.getActiveElements() : [];
  if (!Array.isArray(active) || active.length === 0) return null;

  const { datasetIndex, index } = active[0];
  const meta =
    typeof chart?.getDatasetMeta === 'function' ? chart.getDatasetMeta(datasetIndex) : null;
  const element = meta?.data?.[index];
  const raw = chart?.data?.datasets?.[datasetIndex]?.data?.[index];
  const rawValue = Number.isFinite(raw?.y) ? raw.y : Number.isFinite(raw) ? raw : null;

  if (Number.isFinite(element?.x) && Number.isFinite(element?.y)) {
    return { x: element.x, y: element.y, value: rawValue };
  }

  return null;
}

const chartCrosshairPlugin = {
  id: 'btcJournalCrosshair',
  afterDraw(chart, _args, pluginOptions) {
    const point = getActiveChartPoint(chart);
    const area = chart?.chartArea;
    if (!point || !area) return;

    const { x, y } = point;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash(Array.isArray(pluginOptions?.dash) ? pluginOptions.dash : [4, 4]);
    ctx.lineWidth = Number.isFinite(pluginOptions?.lineWidth) ? pluginOptions.lineWidth : 1;
    ctx.strokeStyle = pluginOptions?.color || 'rgba(142, 142, 147, 0.55)';
    ctx.moveTo(x, area.top);
    ctx.lineTo(x, area.bottom);
    ctx.moveTo(area.left, y);
    ctx.lineTo(area.right, y);
    ctx.stroke();
    ctx.restore();
  },
};

function buildChartOptions(series, palette, options = {}) {
  const { avgPrice } = series;
  const { min, max } = ensureChartRange();
  const vsCurrency = options.vsLabel || currentFiatCurrency();
  const formatCurrencyValue = (value) => fmtCurrency(value, vsCurrency);
  const tooltipTitle = (items) => {
    if (!items || !items.length) return '';
    const raw = items[0];
    const value = raw.parsed?.x ?? raw.label ?? raw.parsed;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest',
      intersect: false,
      axis: 'x',
    },
    scales: {
      x: {
        type: 'time',
        time: { unit: 'month', displayFormats: { month: 'short' } },
        min,
        max,
        ticks: {
          color: palette.muted || '#94a3b8',
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: options.compact ? 6 : 12,
        },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
      y: {
        ticks: { color: palette.muted || '#94a3b8' },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
    },
    plugins: {
      legend: { labels: { color: palette.muted || '#94a3b8' } },
      btcJournalCrosshair: {
        color: palette.muted || 'rgba(142, 142, 147, 0.55)',
        dash: [4, 4],
        lineWidth: 1,
      },
      tooltip: {
        callbacks: {
          title: tooltipTitle,
          label(context) {
            const ds = context.dataset || {};
            if (ds.type === 'scatter') {
              const raw = context.raw || {};
              const lines = [];
              lines.push(`Preço: ${formatCurrencyValue(raw.y)}`);
              lines.push(`Sats: ${fmtInt(raw.sats || 0)}`);
              if (raw.exchange) lines.push(`Exchange: ${raw.exchange}`);
              if (raw.type) lines.push(`Tipo: ${raw.type === 'sell' ? 'Venda' : 'Compra'}`);
              if (Number.isFinite(raw.plPct)) lines.push(`P/L atual: ${fmtPercent(raw.plPct)}`);
              if (raw.note) lines.push(`Nota: ${raw.note}`);
              return lines;
            }
            const value = context.parsed?.y ?? context.formattedValue;
            return `${context.dataset.label}: ${formatCurrencyValue(value)}`;
          },
        },
      },
    },
  };
}

function buildChartConfig(series, palette, options = {}) {
  const mode = getChartMode();
  const includeCandles = options.includeCandles ?? mode === 'candles';
  const datasets = [];
  if (includeCandles && Array.isArray(state.ohlc) && state.ohlc.length > 0) {
    const candData = state.ohlc.map((d) => ({ x: d.t, o: d.o, h: d.h, l: d.l, c: d.c }));
    datasets.push({
      label: 'OHLC',
      type: 'candlestick',
      data: candData,
      color: { up: palette.green || '#22c55e', down: palette.red || '#ef4444' },
      order: 0,
    });
  }
  const vsLabel = (document.getElementById('vsCurrency')?.value || state.vs || 'USD').toUpperCase();
  const pricePoints = series.labels
    .map((t, i) => ({ x: t, y: series.priceData[i] }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  datasets.push({
    label: `BTC/${vsLabel}`,
    data: pricePoints,
    parsing: false,
    borderWidth: 1.5,
    borderColor: palette.brand || '#f7931a',
    backgroundColor: 'transparent',
    pointRadius: 0,
    tension: 0.2,
    order: 1,
  });
  datasets.push(buildEntryDataset(series.points, palette));

  const useAnnotation = options.allowAnnotation && isAnnotationAvailable();
  if (!useAnnotation && options.addAverageDataset && series.avgPrice > 0) {
    datasets.push(buildAverageDataset(series.labels.length, series.avgPrice, palette));
  }

  const cfg = {
    type: 'line',
    data: { labels: series.labels, datasets },
    options: buildChartOptions(series, palette, { ...options, vsLabel }),
    plugins: [chartCrosshairPlugin],
  };

  if (useAnnotation && series.avgPrice > 0) {
    cfg.options.plugins = cfg.options.plugins || {};
    cfg.options.plugins.annotation = {
      annotations: {
        avgLine: {
          type: 'line',
          yMin: series.avgPrice,
          yMax: series.avgPrice,
          borderColor: palette.amber || '#f59e0b',
          borderWidth: 1,
          borderDash: [6, 6],
          label: {
            enabled: true,
            content: `PM ${fmtCurrency(series.avgPrice, vsLabel)}`,
            position: 'end',
            backgroundColor: palette.panel || 'rgba(0,0,0,0.6)',
            color: palette.amber || '#f59e0b',
            padding: 4,
          },
        },
      },
    };
  }

  return cfg;
}

function renderChartToCanvas(canvasId = 'btcChart', visibleTxs = getVisibleTxs()) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const chartRange = ensureChartRange();
  const fetchRange = expandRange(chartRange);
  const vs = resolvedVsCurrencyLower();
  if (shouldRefreshPriceSeries(fetchRange, vs)) {
    schedulePriceSeriesFetch(fetchRange, vs, () => renderChartToCanvas(canvasId, visibleTxs));
    return;
  }
  if (getChartMode() === 'candles' && shouldRefreshOhlc(fetchRange, vs)) {
    scheduleOhlcFetch(fetchRange, vs, () => renderChartToCanvas(canvasId, visibleTxs));
    return;
  }
  const palette = getChartPalette();
  const series = buildChartSeries(visibleTxs);
  const cfg = buildChartConfig(series, palette, {
    includeCandles: getChartMode() === 'candles',
    allowAnnotation: true,
    addAverageDataset: true,
    compact: canvasId === 'glassBtcChart',
  });

  // destroy previous glass chart if exists
  if (canvasId === 'glassBtcChart') {
    if (glassChartInstance) {
      try {
        glassChartInstance.destroy();
      } catch (e) {}
    }
    glassChartInstance = new Chart(canvas.getContext('2d'), cfg);
    // Forçar resize no próximo frame para garantir que o canvas use o tamanho do container
    try {
      requestAnimationFrame(() => {
        if (glassChartInstance && typeof glassChartInstance.resize === 'function')
          glassChartInstance.resize();
      });
    } catch (e) {
      /* noop */
    }
    return glassChartInstance;
  } else {
    // fallback: use global chart creation (existing function)
    if (window.btcChart && typeof window.btcChart.destroy === 'function')
      try {
        window.btcChart.destroy();
      } catch (e) {}
    window.btcChart = new Chart(canvas.getContext('2d'), cfg);
    try {
      requestAnimationFrame(() => {
        if (window.btcChart && typeof window.btcChart.resize === 'function')
          window.btcChart.resize();
      });
    } catch (e) {
      /* noop */
    }
    return window.btcChart;
  }
}

// Attach overlay buttons
document.addEventListener('DOMContentLoaded', () => {
  ensureUsdDefault();
  const openBtn = document.getElementById('openChartGlassBtn');
  const closeBtn = document.getElementById('closeChartGlassBtn');
  if (openBtn) openBtn.addEventListener('click', openChartGlass);
  if (closeBtn) closeBtn.addEventListener('click', closeChartGlass);
  // habilitar e ligar o botão de 'Marcadores de Aportes' para rolar até o card 'Aportes'
  try {
    const planBtn = document.getElementById('openPlanilhaBtn');
    const monthsCard = document.getElementById('monthsContainer');
    if (planBtn) {
      planBtn.disabled = false;
      planBtn.removeAttribute('aria-disabled');
      planBtn.title = planBtn.title?.replace(/\(desativado\)/i, '') || 'Ir para Aportes';
      planBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        if (!monthsCard) return;
        monthsCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // pequena animação de destaque
        monthsCard.classList.add('highlight');
        monthsCard.setAttribute('aria-live', 'polite');
        setTimeout(() => monthsCard.classList.remove('highlight'), 1400);
        try {
          planBtn.setAttribute('aria-pressed', 'true');
          setTimeout(() => planBtn.setAttribute('aria-pressed', 'false'), 1400);
        } catch (e) {}
      });
    }
  } catch (e) {
    /* noop */
  }
});

function boot() {
  loadState();
  priceService = createPriceService({ fetcher: createCoinGeckoFetcher() });
  priceService.onPriceUpdate(() => renderTableAndStats());
  priceService.startPolling(state.vs || 'usd');
  hydrateChartMode();
  // tentar detectar e migrar dados antigos (btcJournalV1)
  detectAndOfferMigration();
  // Nota: não aplicar tema 'plainilha' automaticamente para evitar fundo escuro/gradiente
  bindForm();
  bindTableActions({
    onEdit: startEditTransaction,
    onValidate: handleValidateTxid,
    onDelete: deleteTransactionById,
  });
  bindImportExport({
    onOpenExport: openExportModal,
    onDownloadJson: downloadExportFile,
    onDownloadCsv: downloadExportCsv,
    onCopyExport: copyExportJson,
    onImportFile: handleImportFile,
    onApplyImport: applyPendingImport,
    onCloseImport: () => closeImportModal(),
    onCloseExport: closeExportModal,
  });
  bindFilters({
    onChange: () => {
      syncFiltersFromInputs();
      renderAll();
    },
    onReset: () => {
      resetFilterState();
      syncFiltersFromInputs();
      renderAll();
    },
    onInit: () => {
      syncFiltersFromInputs();
      updateFiltersMeta({
        visibleCount: getVisibleTxs().length,
        totalCount: (state.txs || []).length,
        activeCount: getActiveFiltersCount(),
        sort: filterState.sort,
        describeSortLabel,
      });
    },
  });
  bindYearSelect({
    onChange: () => {
      renderMonths();
      renderChart();
    },
  });
  bindChartFilterToggle();
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn && !resetBtn.dataset.bound) {
    resetBtn.dataset.bound = 'true';
    resetBtn.addEventListener('click', async () => {
      const ok = await confirmModalAsync(
        'Apagar todos os dados locais? Esta ação não pode ser desfeita.'
      );
      if (!ok) return;
      try {
        localStorage.removeItem('btc_journal_state_v3');
      } catch (e) {
        /* noop */
      }
      window.location.reload();
    });
  }
  bindAuditControls({
    onValidatePending: () => validatePendingTxids(),
    onFilterChange: (filterId) => setAuditFilter(filterId),
    onShowMore: () => {
      auditViewState.limit = Math.min(AUDIT_TABLE_MAX, auditViewState.limit + AUDIT_TABLE_STEP);
      renderAudit();
    },
  });
  bindGoalControls();
  hydrateYearOptions();
  renderAll();

  // Compat: listener mínimo para alternar dock do gráfico conforme prompt
  (function attachChartDockToggle() {
    const dock = document.getElementById('chartDock');
    const toggle = document.getElementById('chartToggleBtn');
    if (dock && toggle) {
      toggle.addEventListener('click', () => {
        const expanded = dock.classList.toggle('is-expanded');
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        toggle.textContent = expanded ? '↓ Recolher gráfico' : '↑ Expandir gráfico';
        // apenas trocar classes/aria/text — não alterar state nem recriar gráficos
        try {
          if (window.btcChart && typeof window.btcChart.resize === 'function')
            requestAnimationFrame(() => window.btcChart.resize());
          if (window.liveBtcChart && typeof window.liveBtcChart.resize === 'function')
            requestAnimationFrame(() => window.liveBtcChart.resize());
        } catch (e) {
          /* noop */
        }
      });
      // inicializar com is-expanded presente no HTML
    } else {
      // fallback para ids históricos (não remover para compat)
      const chartSection = document.getElementById('chartSection');
      const chartExpandBtn = document.getElementById('chartExpandBtn');
      if (chartSection && chartExpandBtn) {
        chartExpandBtn.addEventListener('click', () => {
          const expanded = chartSection.classList.toggle('expanded');
          chartExpandBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          chartExpandBtn.textContent = expanded ? 'Recolher' : 'Expandir';
          try {
            if (window.btcChart && typeof window.btcChart.resize === 'function')
              requestAnimationFrame(() => window.btcChart.resize());
          } catch (e) {}
        });
      }
    }
  })();

  // Carregar preço atual silenciosamente ao iniciar e preencher #tx-price se vazio
  (async function prefillCurrentPriceAtBoot() {
    try {
      const priceEl = document.getElementById('tx-price');
      if (!priceEl) return;
      // Se já existe valor no campo, não sobrescrever
      if (priceEl.value && priceEl.value.trim() !== '') return;
      const vs = (document.getElementById('vsCurrency')?.value || 'usd').toLowerCase();
      const p = await fetchLivePrice(vs);
      if (p && Number.isFinite(p.price)) {
        priceEl.value = Number(p.price).toFixed(2);
      }
    } catch (e) {
      console.warn('prefillCurrentPriceAtBoot failed', e);
    }
  })();

  // Bind 'Buscar preço do dia' button (preencher #tx-price usando CoinGecko)
  (function bindFetchPriceBtn() {
    const btn = document.getElementById('fetchPriceBtn');
    const dateInput = document.getElementById('tx-date');
    const priceInput = document.getElementById('tx-price');
    if (!btn || !dateInput || !priceInput) return;
    btn.addEventListener('click', async () => {
      // Mesmo comportamento funcional, mas silencioso: não exibir mensagens.
      let dateStr = dateInput.value;
      if (!dateStr) {
        const d = new Date();
        dateStr = d.toISOString().slice(0, 10); // yyyy-mm-dd
        try {
          dateInput.value = dateStr;
        } catch (e) {
          /* ignore */
        }
      }
      try {
        btn.disabled = true;
        const p = await fetchHistoricalPriceForDate(dateStr);
        if (p && Number.isFinite(p)) {
          priceInput.value = Number(p).toFixed(2);
        } else {
          console.warn('Não foi possível obter o preço para essa data.');
        }
      } catch (e) {
        console.error('Erro ao buscar preço histórico', e);
      } finally {
        btn.disabled = false;
      }
    });
  })();
}

document.addEventListener('DOMContentLoaded', boot);

// ------------------ Chart / Fetch helpers ------------------
// Pegue preços históricos (CoinGecko) para BTC vs currency em dias
async function fetchPrices(rangeOrDays = 90, vsOverride) {
  const vs = (vsOverride || resolvedVsCurrencyLower() || 'usd').toLowerCase();
  const usingRange =
    rangeOrDays &&
    typeof rangeOrDays === 'object' &&
    Number.isFinite(rangeOrDays.min) &&
    Number.isFinite(rangeOrDays.max);
  const hideLoading = showLoadingOverlay(
    usingRange
      ? 'A carregar preços históricos do período selecionado…'
      : 'A carregar preços históricos…'
  );
  try {
    let endpoint = '';
    if (usingRange) {
      const fromSec = Math.floor(rangeOrDays.min / 1000);
      const toSec = Math.floor(rangeOrDays.max / 1000);
      endpoint = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=${vs}&from=${fromSec}&to=${toSec}`;
    } else {
      const days = typeof rangeOrDays === 'number' && rangeOrDays > 0 ? rangeOrDays : 90;
      endpoint = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=${vs}&days=${days}`;
    }
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('Erro ao buscar preços');
    const json = await res.json();
    // json.prices => [ [timestamp, price], ... ]
    const arr = (json.prices || []).map((p) => ({ t: p[0], p: p[1] }));
    // guardar temporariamente no state
    state.prices = arr;
    priceSeriesMeta = usingRange
      ? { range: cloneRange(rangeOrDays), vs }
      : { range: null, vs, days: typeof rangeOrDays === 'number' ? rangeOrDays : null };
    _pricesFetchFailed = false;
    return arr;
  } catch (err) {
    console.error('fetchPrices error', err);
    showMessage('Erro ao obter preços históricos.', 'warn');
    _pricesFetchFailed = true;
    return [];
  } finally {
    hideLoading();
  }
}

// Fetch OHLC (candles) via CoinGecko
async function fetchOHLC(days = 90, vsOverride) {
  const vs = (vsOverride || resolvedVsCurrencyLower() || 'usd').toLowerCase();
  const normalizedDays =
    typeof days === 'string' ? days : Math.max(1, Math.min(365, Math.floor(days)));
  const label = normalizedDays === 'max' ? 'histórico completo' : `${normalizedDays} dias`;
  const hideLoading = showLoadingOverlay(`A carregar velas (OHLC) — ${label}…`);
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=${vs}&days=${normalizedDays}`
    );
    if (!res.ok) throw new Error('Erro ao buscar OHLC');
    const json = await res.json();
    // json: array of [timestamp, open, high, low, close]
    state.ohlc = (json || []).map((d) => ({ t: d[0], o: d[1], h: d[2], l: d[3], c: d[4] }));
    ohlcSeriesMeta = { days: normalizedDays, vs };
    return state.ohlc;
  } catch (err) {
    console.error('fetchOHLC error', err);
    showMessage('Erro ao obter dados OHLC.', 'warn');
    state.ohlc = [];
    return [];
  } finally {
    hideLoading();
  }
}

// Buscar preço histórico para uma data (dateStr aceita 'YYYY-MM-DD' ou value de input)
async function fetchHistoricalPriceForDate(dateStr, vs) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const cgDate = `${day}-${month}-${year}`; // dd-mm-yyyy (CoinGecko format)
  vs = (vs || document.getElementById('vsCurrency')?.value || 'usd').toLowerCase();
  try {
    const url = `https://api.coingecko.com/api/v3/coins/bitcoin/history?date=${cgDate}&localization=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Erro ao buscar histórico');
    const json = await res.json();
    const price = json?.market_data?.current_price?.[vs];
    if (!price) return null;
    return Number(price);
  } catch (e) {
    console.warn('fetchHistoricalPriceForDate error', e);
    return null;
  }
}

let _chart = null;
let priceService = null;
// Flags para evitar loops de fetch/redraw
let _fetchingPrices = false;
let _pricesFetchFailed = false;
let _fetchingOHLC = false;

function renderChart(visibleTxs = getVisibleTxs()) {
  const canvas = document.getElementById('btcChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const chartRange = ensureChartRange();
  const fetchRange = expandRange(chartRange);
  const vs = resolvedVsCurrencyLower();
  if (shouldRefreshPriceSeries(fetchRange, vs)) {
    schedulePriceSeriesFetch(fetchRange, vs, () => renderChart());
    return;
  }
  if (getChartMode() === 'candles' && shouldRefreshOhlc(fetchRange, vs)) {
    scheduleOhlcFetch(fetchRange, vs, () => renderChart());
    return;
  }
  const palette = getChartPalette();
  const series = buildChartSeries(visibleTxs);
  const cfg = buildChartConfig(series, palette, {
    includeCandles: getChartMode() === 'candles',
    allowAnnotation: true,
    addAverageDataset: true,
  });

  if (_chart)
    try {
      _chart.destroy();
    } catch (e) {}
  _chart = new Chart(canvas.getContext('2d'), cfg);
  try {
    window.btcChart = _chart;
  } catch (e) {
    /* ignore in strict CSP env */
  }
  // Clique nos pontos do dataset "Entradas" (já filtrado por series.chartTxs)
  bindChartPins({
    chart: _chart,
    getTxById: (id) => state.txs.find((tx) => tx.id === id),
    getCurrentPrice: () => priceService?.getCurrentPrice(state.vs || 'usd') ?? null,
    getCurrency: () => (state.vs || 'usd').toUpperCase(),
  });
  try {
    requestAnimationFrame(() => {
      if (_chart && typeof _chart.resize === 'function') _chart.resize();
    });
  } catch (e) {
    /* noop */
  }

  const filtersActive = getActiveFiltersCount() > 0;
  const vsLabel = (document.getElementById('vsCurrency')?.value || state.vs || 'USD').toUpperCase();
  const chartCounts = {
    totalAll: Array.isArray(state.txs) ? state.txs.length : 0,
    chartShown: series.chartTxs.length,
    filteredVisible: visibleTxs.length,
    filtersApplied: shouldChartUseFilters() && filtersActive,
    filtersActive,
    avgPrice: series.avgPrice,
    currentPrice: series.currentPrice,
    vsCurrency: vsLabel,
  };
  updateLegend(series.points, chartCounts);
}

// Atualiza tabela + stats sem recriar o gráfico
// currentPriceOverride: preço direto do refreshLivePrice (sem chamada extra à API)
function renderTableAndStats(visibleTxs = getVisibleTxs(), currentPriceOverride) {
  const currentPrice =
    currentPriceOverride != null
      ? currentPriceOverride
      : (priceService?.getCurrentPrice(state.vs || 'usd') ?? null);
  renderTable({
    list: visibleTxs,
    totalCount: Array.isArray(state.txs) ? state.txs.length : 0,
    activeFiltersCount: getActiveFiltersCount(),
    currentPrice,
    currency: (state.vs || 'usd').toUpperCase(),
    createTxStatusBadge,
    fmtInt,
    fmtPrice: fmtBRL,
  });
  renderStats({
    list: visibleTxs,
    totalCount: Array.isArray(state.txs) ? state.txs.length : 0,
    getLatestMarketPrice,
    currentFiatCurrency,
    fmtCurrency,
    fmtSignedCurrency,
    fmtPercent,
    fmtInt,
  });
}

// Ensure months are rendered when data changes
function renderAll() {
  hydrateYearOptions();
  const visible = getVisibleTxs();
  renderTableAndStats(visible);
  renderMonths(visible);
  renderChart(visible);
  renderAudit();
  updateFiltersMeta({
    visibleCount: visible.length,
    totalCount: (state.txs || []).length,
    activeCount: getActiveFiltersCount(),
    sort: filterState.sort,
    describeSortLabel,
  });
}

function updateLegend(points = [], stats = {}) {
  const container = document.getElementById('chartLegend');
  if (!container) return;
  const pos = points.filter((p) => p.plPct > 0).length;
  const neg = points.filter((p) => p.plPct < 0).length;
  const neu = points.filter((p) => p.plPct === 0).length;
  while (container.firstChild) container.removeChild(container.firstChild);

  const addItem = (label, count, colorVar) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = colorVar;
    const text = document.createElement('span');
    text.className = 'legend-label';
    text.textContent = `${label}: ${count}`;
    item.appendChild(swatch);
    item.appendChild(text);
    container.appendChild(item);
  };

  addItem('Positivos', pos, 'var(--green)');
  addItem('Negativos', neg, 'var(--red)');
  addItem('Neutros', neu, 'var(--amber)');

  const totalAll = Number.isFinite(stats.totalAll) ? stats.totalAll : null;
  const chartShown = Number.isFinite(stats.chartShown) ? stats.chartShown : null;
  if (totalAll != null && chartShown != null) {
    const meta = document.createElement('div');
    meta.className = 'legend-meta';
    if (stats.filtersApplied) {
      meta.textContent = `Gráfico filtrado: ${chartShown} de ${totalAll} aportes exibidos.`;
    } else if (stats.filtersActive) {
      meta.textContent = `Filtros ativos, mas o gráfico está a mostrar ${chartShown} de ${totalAll} aportes (filtro desligado).`;
    } else {
      meta.textContent = `Gráfico mostra ${chartShown} de ${totalAll} aportes.`;
    }
    container.appendChild(meta);
  }
  if (Number.isFinite(stats.avgPrice) && stats.avgPrice > 0) {
    const avgLine = document.createElement('div');
    avgLine.className = 'legend-meta';
    avgLine.textContent = `Preço médio: ${fmtCurrency(stats.avgPrice, stats.vsCurrency || currentFiatCurrency())}`;
    container.appendChild(avgLine);
  }
  if (Number.isFinite(stats.currentPrice)) {
    const currLine = document.createElement('div');
    currLine.className = 'legend-meta';
    currLine.textContent = `Preço atual: ${fmtCurrency(stats.currentPrice, stats.vsCurrency || currentFiatCurrency())}`;
    container.appendChild(currLine);
  }
}

// ResizeObserver: observa mudanças no container do gráfico e força resize nos charts
try {
  const chartContainer = () =>
    document.getElementById('chartContainer') || document.querySelector('.chart-body');
  const setupRO = () => {
    const el = chartContainer();
    if (!el || typeof ResizeObserver === 'undefined') return;
    // Debounce to avoid rapid continuous resize calls
    let _roTimer = null;
    const scheduleResize = () => {
      if (_roTimer) clearTimeout(_roTimer);
      _roTimer = setTimeout(() => {
        try {
          if (window.btcChart && typeof window.btcChart.resize === 'function')
            window.btcChart.resize();
          if (window.liveBtcChart && typeof window.liveBtcChart.resize === 'function')
            window.liveBtcChart.resize();
          if (glassChartInstance && typeof glassChartInstance.resize === 'function')
            glassChartInstance.resize();
        } catch (e) {
          /* noop */
        }
      }, 100);
    };
    const ro = new ResizeObserver(scheduleResize);
    ro.observe(el);
  };
  // aguardar DOM ready se necessário
  if (document.readyState === 'complete' || document.readyState === 'interactive') setupRO();
  else document.addEventListener('DOMContentLoaded', setupRO);
} catch (e) {
  /* Ignore if environment lacks ResizeObserver */
}

// atualizar gráfico quando controles mudarem
document.addEventListener('change', async (e) => {
  if (e.target && e.target.id === 'vsCurrency') {
    state.vs = e.target.value;
    await fetchPrices(90);
    if (document.getElementById('chartMode')?.value === 'candles') await fetchOHLC(90);
    renderChart();
    const overlay = document.getElementById('chartGlassOverlay');
    if (overlay && overlay.style.display === 'flex') renderChartToCanvas('glassBtcChart');
  }
  if (e.target && e.target.id === 'chartMode') {
    setChartMode(e.target.value);
    if (getChartMode() === 'candles') await fetchOHLC(90);
    renderChart();
    const overlay = document.getElementById('chartGlassOverlay');
    if (overlay && overlay.style.display === 'flex') renderChartToCanvas('glassBtcChart');
  }
});

// ------------------ Live BTC Chart feature ------------------
// Constants / keys
const LIVE_LS_KEY = 'btcPriceHistory';
const LIVE_MAX_POINTS = 10;
const LIVE_POLL_INTERVAL = 60 * 1000; // 60s
let liveIntervalId = null;
let _liveChart = null;

// Fetch current price from CoinGecko (fallback to CoinDesk if needed)
async function fetchLivePrice(vs = 'usd') {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${vs}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Coingecko fetch failed');
    const json = await res.json();
    const p = json?.bitcoin?.[vs];
    if (!p) throw new Error('Invalid response');
    return { price: Number(p), time: Date.now() };
  } catch (err) {
    console.warn('fetchLivePrice coingecko failed, trying coindesk', err);
    try {
      const r2 = await fetch('https://api.coindesk.com/v1/bpi/currentprice.json');
      if (!r2.ok) throw new Error('CoinDesk failed');
      const j2 = await r2.json();
      const usd = j2?.bpi?.USD?.rate_float;
      if (!usd) throw new Error('CoinDesk invalid');
      return { price: Number(usd), time: Date.now() };
    } catch (err2) {
      console.error('Both live price fetches failed', err2);
      throw err2;
    }
  }
}

function loadLiveCache() {
  try {
    const parsed = storageLoadState(LIVE_LS_KEY, []);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-LIVE_MAX_POINTS);
  } catch (e) {
    return [];
  }
}

function saveLiveCache(arr) {
  try {
    const toSave = (arr || []).slice(-LIVE_MAX_POINTS);
    storageSaveState(toSave, LIVE_LS_KEY);
  } catch (e) {
    console.warn('saveLiveCache error', e);
  }
}

function pushLivePrice(point) {
  const arr = loadLiveCache();
  arr.push(point);
  saveLiveCache(arr);
  return arr;
}

function showLiveStatus(text, type = 'info') {
  const el = document.getElementById('liveChartStatus');
  if (!el) return;
  el.textContent = text;
  if (type === 'warn') el.style.color = 'var(--warn)';
  else if (type === 'danger') el.style.color = 'var(--danger)';
  else el.style.color = 'var(--muted)';
}

function initLiveChart() {
  const canvas = document.getElementById('liveBtcChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');
  const cached = loadLiveCache();
  const labels = cached.map((p) => new Date(p.time));
  const data = cached.map((p) => p.price);
  const cfg = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'BTC (live)',
          data,
          borderColor: 'var(--accent)',
          backgroundColor: 'rgba(0,122,255,0.08)',
          tension: 0.2,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { type: 'time', time: { unit: 'minute' } },
        y: {
          ticks: {
            callback: (v) =>
              new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: (document.getElementById('vsCurrency')?.value || 'usd').toUpperCase(),
              }).format(v),
          },
        },
      },
      plugins: { legend: { display: false } },
    },
  };
  try {
    if (_liveChart) _liveChart.destroy();
  } catch (e) {}
  _liveChart = new Chart(ctx, cfg);
  try {
    window.liveBtcChart = _liveChart;
  } catch (e) {}
  // Garantir resize no próximo frame (mesma defesa usada para o gráfico principal)
  try {
    requestAnimationFrame(() => {
      if (_liveChart && typeof _liveChart.resize === 'function') _liveChart.resize();
    });
  } catch (e) {
    /* noop */
  }
}

async function refreshLivePrice() {
  const vs = (document.getElementById('vsCurrency')?.value || 'usd').toLowerCase();
  try {
    const p = await fetchLivePrice(vs);
    const arr = pushLivePrice(p);
    // atualizar P&L da tabela com o preço recém-obtido (sem chamada extra à API)
    renderTableAndStats(undefined, p.price);
    // atualizar chart
    if (!_liveChart) initLiveChart();
    const labels = arr.map((x) => new Date(x.time));
    const data = arr.map((x) => x.price);
    _liveChart.data.labels = labels;
    _liveChart.data.datasets[0].data = data;
    _liveChart.update('none');
    showLiveStatus(
      `Última: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: (vs || 'usd').toUpperCase() }).format(p.price)} • ${new Date(p.time).toLocaleTimeString()}`
    );
  } catch (err) {
    const cached = loadLiveCache();
    if (cached.length) {
      if (!_liveChart) initLiveChart();
      _liveChart.update('none');
      showLiveStatus('⚠ Última atualização offline — mostrando cache', 'warn');
    } else {
      showLiveStatus('Erro ao obter preço e nenhum cache disponível', 'danger');
    }
  }
}

function startLivePolling() {
  if (liveIntervalId) clearInterval(liveIntervalId);
  refreshLivePrice();
  liveIntervalId = setInterval(() => refreshLivePrice(), LIVE_POLL_INTERVAL);
}

function stopLivePolling() {
  if (liveIntervalId) {
    clearInterval(liveIntervalId);
    liveIntervalId = null;
  }
}

function bindLiveToggle() {
  const section = document.getElementById('liveChartSection');
  const btn = document.getElementById('liveChartToggleBtn');
  if (!section || !btn) return;
  btn.addEventListener('click', () => {
    const isCentered = section.classList.toggle('centered');
    if (isCentered) {
      section.classList.remove('expanded');
      section.classList.add('collapsed');
      btn.textContent = '⬆ Expandir';
      btn.setAttribute('aria-expanded', 'false');
    } else {
      section.classList.remove('collapsed');
      section.classList.add('expanded');
      btn.textContent = '⬇ Recolher gráfico';
      btn.setAttribute('aria-expanded', 'true');
    }
    // permitir transição antes de forçar resize
    requestAnimationFrame(() => {
      try {
        if (window.liveBtcChart && typeof window.liveBtcChart.resize === 'function')
          window.liveBtcChart.resize();
      } catch (e) {}
    });
  });
}

// Inicializar live chart no boot
document.addEventListener('DOMContentLoaded', () => {
  try {
    const liveSection = document.getElementById('liveChartSection');
    if (liveSection && liveSection.getAttribute('data-live-disabled') === 'true') {
      // Live chart intentionally disabled in markup — não inicializar
      console.info('Live chart está desativado via data-live-disabled');
      return;
    }
    initLiveChart();
    startLivePolling();
    bindLiveToggle();
  } catch (e) {
    console.warn('live chart init failed', e);
  }
});
