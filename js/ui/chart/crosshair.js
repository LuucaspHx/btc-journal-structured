export function getActiveChartPoint(chart) {
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

export function createCrosshairPlugin(tokens) {
  return {
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
      ctx.strokeStyle = pluginOptions?.color || tokens.chartCrosshair();
      ctx.moveTo(x, area.top);
      ctx.lineTo(x, area.bottom);
      ctx.moveTo(area.left, y);
      ctx.lineTo(area.right, y);
      ctx.stroke();
      ctx.restore();
    },
  };
}
