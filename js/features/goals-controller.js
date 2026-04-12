import { normalizeGoal, computeGoalProgress, filterEntriesForGoal, collectGoalCatalogs } from '../core/goals.js';

export function createEmptyGoalsState() {
  return {
    list: [],
    activeGoalId: null,
    lastComputedAt: null
  };
}

export function hydrateGoalsState(raw) {
  if (!raw || typeof raw !== 'object') return createEmptyGoalsState();
  const normalized = createEmptyGoalsState();
  if (Array.isArray(raw.list)) {
    normalized.list = raw.list
      .map((goal) => normalizeGoal({
        id: goal?.id,
        label: goal?.label,
        targetSats: goal?.targetSats ?? goal?.target ?? 0,
        targetBtc: goal?.targetBtc,
        strategy: goal?.strategy,
        tags: goal?.tags,
        createdAt: goal?.createdAt,
        completedAt: goal?.completedAt
      }))
      .filter(Boolean);
  }
  if (typeof raw.activeGoalId === 'string') normalized.activeGoalId = raw.activeGoalId;
  if (typeof raw.lastComputedAt === 'string') normalized.lastComputedAt = raw.lastComputedAt;
  if (!normalized.activeGoalId && normalized.list.length) {
    normalized.activeGoalId = normalized.list[0].id;
  }
  return normalized;
}

export function createGoalsController() {
  let entries = [];
  let goalsState = createEmptyGoalsState();
  let computedGoals = [];
  let catalogs = collectGoalCatalogs([]);
  const listeners = new Set();

  const ensureGoalsState = (nextState) => {
    if (!nextState || typeof nextState !== 'object') return createEmptyGoalsState();
    if (!Array.isArray(nextState.list)) nextState.list = [];
    return nextState;
  };

  function setGoalsState(nextState) {
    goalsState = ensureGoalsState(nextState);
    if (goalsState.list.length && !goalsState.activeGoalId) {
      goalsState.activeGoalId = goalsState.list[0].id;
    }
    computeAndNotify();
  }

  function setEntries(list = []) {
    entries = Array.isArray(list) ? list : [];
    computeAndNotify();
  }

  function computeAndNotify() {
    computedGoals = (goalsState.list || []).map((goal) => ({
      goal,
      progress: computeGoalProgress(goal, entries)
    }));
    catalogs = collectGoalCatalogs(entries);
    goalsState.lastComputedAt = new Date().toISOString();
    notify();
  }

  function notify() {
    if (!listeners.size) return;
    const snapshot = getSnapshot();
    listeners.forEach((listener) => {
      try { listener(snapshot); }
      catch (err) { console.warn('goals listener error', err); }
    });
  }

  function getActiveGoal() {
    if (!goalsState.list.length) return null;
    return goalsState.list.find((goal) => goal.id === goalsState.activeGoalId) || goalsState.list[0];
  }

  function getSnapshot() {
    const activeGoal = getActiveGoal();
    return {
      goalsState,
      computedGoals,
      catalogs,
      activeGoal,
      activeGoalEntries: activeGoal ? filterEntriesForGoal(activeGoal, entries) : []
    };
  }

  function addGoal(payload = {}) {
    const goal = normalizeGoal(payload);
    if (!goal) return null;
    if (!Array.isArray(goalsState.list)) goalsState.list = [];
    const idx = goalsState.list.findIndex((item) => item.id === goal.id);
    if (idx >= 0) goalsState.list.splice(idx, 1, goal);
    else goalsState.list.push(goal);
    goalsState.activeGoalId = goal.id;
    computeAndNotify();
    return goal;
  }

  function updateGoal(goalId, patch = {}) {
    if (!goalId || !Array.isArray(goalsState.list)) return null;
    const idx = goalsState.list.findIndex((goal) => goal.id === goalId);
    if (idx === -1) return null;
    const current = goalsState.list[idx];
    const updated = normalizeGoal({
      ...current,
      ...patch,
      id: goalId,
      targetSats: patch.targetSats ?? current.targetSats,
      targetBtc: patch.targetBtc ?? null
    });
    if (!updated) return null;
    updated.createdAt = current.createdAt || updated.createdAt;
    updated.completedAt = patch.completedAt ?? current.completedAt ?? null;
    goalsState.list.splice(idx, 1, updated);
    computeAndNotify();
    return updated;
  }

  function removeGoal(goalId) {
    if (!goalId || !Array.isArray(goalsState.list)) return false;
    const idx = goalsState.list.findIndex((goal) => goal.id === goalId);
    if (idx === -1) return false;
    goalsState.list.splice(idx, 1);
    if (goalsState.activeGoalId === goalId) {
      goalsState.activeGoalId = goalsState.list.length ? goalsState.list[0].id : null;
    }
    computeAndNotify();
    return true;
  }

  function setActiveGoal(goalId) {
    if (!goalId || goalsState.activeGoalId === goalId) return goalsState.activeGoalId;
    const exists = Array.isArray(goalsState.list) && goalsState.list.some((goal) => goal.id === goalId);
    if (!exists) return goalsState.activeGoalId;
    goalsState.activeGoalId = goalId;
    notify();
    return goalId;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    listener(getSnapshot());
    return () => listeners.delete(listener);
  }

  return {
    setEntries,
    setGoalsState,
    addGoal,
    updateGoal,
    removeGoal,
    setActiveGoal,
    getSnapshot,
    getActiveGoal,
    subscribe
  };
}
