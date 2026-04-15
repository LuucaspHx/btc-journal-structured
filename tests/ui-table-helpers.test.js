import { formatPnL, formatCurrentValue } from '../js/ui/table/helpers.js';

describe('ui/table/helpers — formatadores de P&L', () => {
  test('formatPnL retorna string com ▲ e + quando lucro', () => {
    const result = formatPnL({ pnlValue: 20, pnlPct: 25, isProfit: true }, 'USD');
    expect(result.sign).toBe('▲');
    expect(result.pctText).toBe('+25.00%');
    expect(result.valueText).toContain('20');
  });

  test('formatPnL retorna string com ▼ e - quando perda', () => {
    const result = formatPnL({ pnlValue: -20, pnlPct: -25, isProfit: false }, 'USD');
    expect(result.sign).toBe('▼');
    expect(result.pctText).toBe('-25.00%');
  });

  test('formatCurrentValue formata número monetário', () => {
    const text = formatCurrentValue(124.5, 'USD');
    expect(text).toContain('124');
  });
});
