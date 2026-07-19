import { createCrosshairPlugin, getActiveChartPoint } from '../js/ui/chart/crosshair.js';

describe('ui/chart/crosshair', () => {
  test('reads the active tooltip point first', () => {
    expect(
      getActiveChartPoint({
        tooltip: {
          dataPoints: [{ element: { x: 10, y: 20 }, parsed: { y: 75_000 } }],
        },
      })
    ).toEqual({ x: 10, y: 20, value: 75_000 });
  });

  test('falls back to the active dataset element', () => {
    const chart = {
      getActiveElements: () => [{ datasetIndex: 0, index: 0 }],
      getDatasetMeta: () => ({ data: [{ x: 30, y: 40 }] }),
      data: { datasets: [{ data: [{ x: 1, y: 82_000 }] }] },
    };

    expect(getActiveChartPoint(chart)).toEqual({ x: 30, y: 40, value: 82_000 });
  });

  test('draws both crosshair axes with configured options', () => {
    const calls = [];
    const ctx = {
      save: () => calls.push('save'),
      beginPath: () => calls.push('beginPath'),
      setLineDash: (dash) => calls.push(['dash', dash]),
      moveTo: (x, y) => calls.push(['moveTo', x, y]),
      lineTo: (x, y) => calls.push(['lineTo', x, y]),
      stroke: () => calls.push('stroke'),
      restore: () => calls.push('restore'),
    };
    const chart = {
      tooltip: { dataPoints: [{ element: { x: 10, y: 20 }, parsed: { y: 75_000 } }] },
      chartArea: { top: 1, bottom: 100, left: 2, right: 200 },
      ctx,
    };
    const plugin = createCrosshairPlugin({ chartCrosshair: () => 'token-color' });

    plugin.afterDraw(chart, null, { dash: [2, 3], lineWidth: 2, color: 'custom-color' });

    expect(plugin.id).toBe('btcJournalCrosshair');
    expect(ctx.lineWidth).toBe(2);
    expect(ctx.strokeStyle).toBe('custom-color');
    expect(calls).toEqual([
      'save',
      'beginPath',
      ['dash', [2, 3]],
      ['moveTo', 10, 1],
      ['lineTo', 10, 100],
      ['moveTo', 2, 20],
      ['lineTo', 200, 20],
      'stroke',
      'restore',
    ]);
  });
});
