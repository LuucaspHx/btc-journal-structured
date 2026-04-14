const SATS_PER_BTC = 1e8;

export const PRESET_GOALS = [
  { id: 'goal-100k', label: '100k sats', targetSats: 100_000 },
  { id: 'goal-500k', label: '500k sats', targetSats: 500_000 },
  { id: 'goal-1m', label: '1M sats', targetSats: 1_000_000 },
  { id: 'goal-5m', label: '5M sats', targetSats: 5_000_000 },
  { id: 'goal-10m', label: '10M sats', targetSats: 10_000_000 },
  { id: 'goal-0_1btc', label: '0.1 BTC', targetSats: 0.1 * SATS_PER_BTC },
  { id: 'goal-1btc', label: '1 BTC', targetSats: 1 * SATS_PER_BTC }
];

const uid = (prefix = 'goal') =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function btcToSats(value = 0) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.floor(num * SATS_PER_BTC);
}

export function normalizeTags(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[,;]/);
  const seen = new Set();
  const normalized = [];
  list
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 10)
    .forEach((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      normalized.push(tag);
    });
  return normalized;
}

export function normalizeGoal(input = {}) {
  const targetFromSats = Number(input.targetSats);
  const targetFromBtc = btcToSats(input.targetBtc);
  const target = targetFromSats > 0 ? targetFromSats : targetFromBtc;
  if (!Number.isFinite(target) || target <= 0) return null;
  return {
    id: input.id || uid(),
    label: String(input.label || 'Meta personalizada').trim(),
    targetSats: target,
    strategy: typeof input.strategy === 'string' ? input.strategy.trim() : '',
    tags: normalizeTags(input.tags),
    createdAt: input.createdAt || new Date().toISOString(),
    completedAt: input.completedAt || null
  };
}

function matchesGoalFilters(entry = {}, goal = {}) {
  const strategyMatches = goal.strategy
    ? (entry.strategy || '').toLowerCase() === goal.strategy.toLowerCase()
    : true;
  if (!strategyMatches) return false;
  if (!goal.tags || goal.tags.length === 0) return true;
  const entryTags = Array.isArray(entry.tags)
    ? entry.tags.map((tag) => String(tag).trim().toLowerCase())
    : [];
  const goalTags = goal.tags.map((tag) => String(tag).trim().toLowerCase());
  return goalTags.every((tag) => entryTags.includes(tag));
}

export function computeGoalProgress(goal, entries = []) {
  if (!goal || !Array.isArray(entries)) {
    return {
      filteredCount: 0,
      accumulatedSats: 0,
      remainingSats: goal?.targetSats || 0,
      percent: 0,
      totalFiat: 0
    };
  }
  const filtered = entries.filter((entry) => matchesGoalFilters(entry, goal));
  const accumulatedSats = filtered.reduce(
    (acc, entry) => acc + (Number(entry.sats) || 0),
    0
  );
  const totalFiat = filtered.reduce(
    (acc, entry) => acc + (Number(entry.fiatAmount ?? entry.fiat) || 0),
    0
  );
  const remaining = Math.max(0, (goal.targetSats || 0) - accumulatedSats);
  const percent = goal.targetSats
    ? Math.min(100, Math.round((accumulatedSats / goal.targetSats) * 100))
    : 0;
  return {
    filteredCount: filtered.length,
    accumulatedSats,
    remainingSats: remaining,
    percent,
    totalFiat,
    isComplete: remaining === 0
  };
}

export function filterEntriesForGoal(goal, entries = []) {
  if (!goal || !Array.isArray(entries)) return [];
  return entries.filter((entry) => matchesGoalFilters(entry, goal));
}

export function collectGoalCatalogs(entries = []) {
  const strategies = new Set();
  const tags = new Set();
  for (const entry of entries || []) {
    if (entry && typeof entry.strategy === 'string') {
      const strategy = entry.strategy.trim();
      if (strategy) strategies.add(strategy);
    }
    if (entry && Array.isArray(entry.tags)) {
      entry.tags
        .map((tag) => String(tag).trim())
        .filter(Boolean)
        .forEach((tag) => tags.add(tag));
    }
  }
  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
  return {
    strategies: Array.from(strategies).sort(collator.compare),
    tags: Array.from(tags).sort(collator.compare)
  };
}

export function getPresetGoals() {
  return PRESET_GOALS.map((goal) => ({
    ...goal,
    label: goal.label,
    strategy: '',
    tags: []
  }));
}

export const __test__ = {
  matchesGoalFilters
};
