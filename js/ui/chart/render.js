import { buildPinDataset } from './helpers.js';

export const PIN_DATASET_LABEL = '__btc_pins__';

export function buildPinsChartDataset(txs = []) {
  const points = buildPinDataset(txs);
  return {
    label: PIN_DATASET_LABEL,
    data: points,
    type: 'scatter',
    pointStyle: 'circle',
    pointRadius: 7,
    pointHoverRadius: 10,
    pointBackgroundColor: '#f7931a',
    pointBorderColor: '#ffffff',
    pointBorderWidth: 2,
    showLine: false,
    order: 0,
  };
}

export function updatePinsDataset(chart, txs = []) {
  if (!chart) return;
  const existing = chart.data.datasets.findIndex((d) => d.label === PIN_DATASET_LABEL);
  const dataset = buildPinsChartDataset(txs);
  if (existing >= 0) {
    chart.data.datasets[existing] = dataset;
  } else {
    chart.data.datasets.push(dataset);
  }
  chart.update('none');
}

export function removePinsDataset(chart) {
  if (!chart) return;
  const idx = chart.data.datasets.findIndex((d) => d.label === PIN_DATASET_LABEL);
  if (idx >= 0) {
    chart.data.datasets.splice(idx, 1);
    chart.update('none');
  }
}
