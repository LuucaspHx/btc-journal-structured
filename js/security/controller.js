import { normalizeSecurityInput } from './bbot-normalizer.js';
import { createEmptySecurityState } from './model.js';

export function createSecurityController() {
  let state = createEmptySecurityState();
  const listeners = new Set();

  function emit() {
    for (const listener of listeners) listener(state);
  }

  return Object.freeze({
    getSnapshot() {
      return state;
    },
    importText(input, options = {}) {
      state = normalizeSecurityInput(input, options);
      emit();
      return state;
    },
    reset() {
      state = createEmptySecurityState();
      emit();
      return state;
    },
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
