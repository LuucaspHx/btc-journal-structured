/**
 * Runtime bridge: lê tokens CSS semânticos para uso em Chart.js.
 * Chart.js renderiza em <canvas> — bypassa CSS. Este módulo garante
 * que as cores do gráfico derivam sempre de tokens.css (fonte de verdade).
 *
 * REGRA: nunca definir valores primitivos neste ficheiro.
 * Se uma cor não existe como token semântico, criar o token primeiro.
 */

const _root = document.documentElement;

/**
 * Lê o valor de um CSS custom property do :root.
 * @param {string} name — nome do token, ex: '--color-interactive-accent'
 * @returns {string} valor do token, trimmed
 */
export function readToken(name) {
  return getComputedStyle(_root).getPropertyValue(name).trim();
}

/**
 * Tokens semânticos consumidos por Chart.js.
 * Cada propriedade é uma função para garantir leitura em runtime
 * (não em import time, quando o DOM pode não estar pronto).
 */
export const chartTokens = {
  accent: () => readToken('--color-interactive-accent'),
  accentHover: () => readToken('--color-interactive-accent-hover'),
  textMuted: () => readToken('--color-text-muted'),
  textPrimary: () => readToken('--color-text-primary'),
  border: () => readToken('--color-border'),
  borderSubtle: () => readToken('--color-border-subtle'),
  ok: () => readToken('--color-status-ok'),
  warn: () => readToken('--color-status-warn'),
  danger: () => readToken('--color-status-danger'),
  statusMuted: () => readToken('--color-status-muted'),
  bgSurface: () => readToken('--color-bg-surface'),
  bgPage: () => readToken('--color-bg-page'),
  chartGrid: () => readToken('--color-chart-grid'),
  chartCrosshair: () => readToken('--color-chart-crosshair'),
};
