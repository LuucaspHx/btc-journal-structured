import { createGoalsController, createEmptyGoalsState } from '../js/features/goals-controller.js';

const sampleEntries = [
  { id: 'tx1', sats: 100_000, strategy: 'dca', tags: ['long-term'] },
  { id: 'tx2', sats: 50_000, strategy: 'dip-buy', tags: ['opportunity'] },
  { id: 'tx3', sats: 25_000, strategy: 'dca', tags: ['long-term', 'cold'] }
];

describe('features/goals-controller', () => {
  test('computes progress when entries e goals mudam', () => {
    const controller = createGoalsController();
    const goalsState = createEmptyGoalsState();
    controller.setGoalsState(goalsState);
    controller.setEntries(sampleEntries);
    controller.addGoal({ label: 'Primeiro alvo', targetSats: 120_000, strategy: 'dca', tags: [] });
    const snapshot = controller.getSnapshot();
    expect(snapshot.computedGoals).toHaveLength(1);
    expect(snapshot.computedGoals[0].progress.accumulatedSats).toBe(125_000);
    expect(snapshot.catalogs.strategies).toEqual(expect.arrayContaining(['dca', 'dip-buy']));
  });

  test('removeGoal atualiza meta ativa', () => {
    const controller = createGoalsController();
    const goalsState = createEmptyGoalsState();
    controller.setGoalsState(goalsState);
    controller.addGoal({ id: 'goal-a', label: 'A', targetSats: 10_000 });
    controller.addGoal({ id: 'goal-b', label: 'B', targetSats: 20_000 });
    expect(controller.getSnapshot().goalsState.activeGoalId).toBe('goal-b');
    controller.removeGoal('goal-b');
    expect(controller.getSnapshot().goalsState.activeGoalId).toBe('goal-a');
  });

  test('subscribe notifica listeners quando metas mudam', () => {
    const controller = createGoalsController();
    const goalsState = createEmptyGoalsState();
    controller.setGoalsState(goalsState);
    const calls = [];
    controller.subscribe((snapshot) => calls.push(snapshot.computedGoals.length));
    controller.addGoal({ label: 'Meta inscrita', targetSats: 5_000 });
    expect(calls[calls.length - 1]).toBeGreaterThanOrEqual(1);
  });
});
