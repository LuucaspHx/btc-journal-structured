import { normalizeGoal, computeGoalProgress, getPresetGoals, filterEntriesForGoal, collectGoalCatalogs, __test__ } from '../js/core/goals.js';

const sampleEntries = [
  { id: 'a', sats: 100_000, fiatAmount: 200, strategy: 'dca', tags: ['long-term'] },
  { id: 'b', sats: 50_000, fiatAmount: 120, strategy: 'dip-buy', tags: ['opportunity'] },
  { id: 'c', sats: 25_000, fiatAmount: 70, strategy: 'dca', tags: ['long-term', 'cold'] }
];

describe('core/goals', () => {
  test('normalizeGoal valida alvo e tags', () => {
    const goal = normalizeGoal({
      label: 'Primeiro 100k',
      targetSats: 100_000,
      tags: ['Stack', ' stack ', '']
    });
    expect(goal).not.toBeNull();
    expect(goal.label).toBe('Primeiro 100k');
    expect(goal.targetSats).toBe(100_000);
    expect(goal.tags).toEqual(['Stack']);
  });

  test('computeGoalProgress considera filtros de estratégia/tags', () => {
    const goal = normalizeGoal({ targetSats: 150_000, strategy: 'dca', tags: ['long-term'] });
    const progress = computeGoalProgress(goal, sampleEntries);
    expect(progress.filteredCount).toBe(2);
    expect(progress.accumulatedSats).toBe(125_000);
    expect(progress.remainingSats).toBe(25_000);
    expect(progress.percent).toBe(Math.round((125_000 / 150_000) * 100));
  });

  test('presets retornam metas padrão', () => {
    const presets = getPresetGoals();
    expect(presets.length).toBeGreaterThan(0);
    expect(presets[0]).toHaveProperty('targetSats');
  });

  test('matchesGoalFilters diferencia tags', () => {
    const matches = __test__.matchesGoalFilters(sampleEntries[0], {
      tags: ['long-term'],
      strategy: 'dca'
    });
    const misses = __test__.matchesGoalFilters(sampleEntries[1], {
      tags: ['long-term']
    });
    expect(matches).toBe(true);
    expect(misses).toBe(false);
  });

  test('filterEntriesForGoal respeita strategy e tags', () => {
    const goal = normalizeGoal({ targetSats: 100_000, strategy: 'dca', tags: ['long-term'] });
    const filtered = filterEntriesForGoal(goal, sampleEntries);
    expect(filtered.map((entry) => entry.id)).toEqual(['a', 'c']);
  });

  test('collectGoalCatalogs gera catálogos ordenados', () => {
    const catalogs = collectGoalCatalogs(sampleEntries);
    expect(catalogs.strategies).toEqual(['dca', 'dip-buy']);
    expect(catalogs.tags).toEqual(expect.arrayContaining(['long-term', 'opportunity', 'cold']));
  });
});
