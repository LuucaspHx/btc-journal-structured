import { buildPinModalData } from './helpers.js';
import { formatCurrentValue, formatPnL } from '../table/helpers.js';
import { PIN_DATASET_LABEL } from './render.js';

function openPinModal(tx, currentPrice, currency = 'USD') {
  const data = buildPinModalData(tx, currentPrice);
  const fmt = formatPnL(data, currency);

  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set('pinModalTitle', `Aporte — ${data.date}`);
  set('pinModalDate', data.date);
  set('pinModalSats', data.sats.toLocaleString('pt-BR') + ' sats');
  set('pinModalCost', formatCurrentValue(data.costFiat, currency));
  set('pinModalCurrent', fmt.valueText);
  const pnlEl = document.getElementById('pinModalPnl');
  if (pnlEl) {
    pnlEl.textContent = `${fmt.sign} ${fmt.pctText}`;
    pnlEl.classList.toggle('profit', data.pnlValue > 0);
    pnlEl.classList.toggle('loss', data.pnlValue < 0);
  }

  const modal = document.getElementById('pinModal');
  if (modal) modal.classList.add('open');
}

function closePinModal() {
  const modal = document.getElementById('pinModal');
  if (modal) modal.classList.remove('open');
}

export function bindChartPins({ chart, getTxById, getCurrentPrice, getCurrency }) {
  if (!chart) return;

  chart.options.onClick = (evt, elements) => {
    if (!elements || elements.length === 0) return;
    const el = elements[0];
    const dataset = chart.data.datasets[el.datasetIndex];
    if (!dataset || dataset.label !== PIN_DATASET_LABEL) return;
    const point = dataset.data[el.index];
    if (!point?.txId) return;
    const tx = getTxById(point.txId);
    if (!tx) return;
    const price = getCurrentPrice();
    const currency = getCurrency();
    openPinModal(tx, price, currency);
  };

  chart.update('none');

  const closeBtn = document.getElementById('pinModalClose');
  if (closeBtn && !closeBtn.dataset.pinListenerBound) {
    closeBtn.addEventListener('click', closePinModal);
    closeBtn.dataset.pinListenerBound = 'true';
  }

  const modal = document.getElementById('pinModal');
  if (modal && !modal.dataset.pinListenerBound) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePinModal();
    });
    modal.dataset.pinListenerBound = 'true';
  }
}
