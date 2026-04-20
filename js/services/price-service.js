/* global setInterval, clearInterval */

const DEFAULT_INTERVAL_MS = 30_000;

export function createPriceService({ fetcher, intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  const cache = {};
  const listeners = new Set();
  let pollingTimer = null;
  let currentVs = null;

  async function doFetch(vs) {
    try {
      const price = await fetcher(vs);
      if (typeof price === 'number' && Number.isFinite(price)) {
        cache[vs] = price;
        const payload = { vs, price, time: Date.now() };
        for (const fn of listeners) fn(payload);
      }
    } catch {
      // mantém cache anterior — não propaga erro
    }
  }

  return {
    async fetchNow(vs) {
      await doFetch(vs);
    },

    startPolling(vs) {
      if (pollingTimer !== null && currentVs === vs) return;
      if (pollingTimer !== null) clearInterval(pollingTimer);
      currentVs = vs;
      pollingTimer = setInterval(() => doFetch(vs), intervalMs);
      return doFetch(vs);
    },

    stopPolling() {
      if (pollingTimer !== null) {
        clearInterval(pollingTimer);
        pollingTimer = null;
        currentVs = null;
      }
    },

    getCurrentPrice(vs) {
      return cache[vs] ?? null;
    },

    onPriceUpdate(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
