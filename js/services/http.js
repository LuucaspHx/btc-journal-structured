export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

function createTimeoutError(timeoutMs) {
  const error = new Error(`Request timed out after ${timeoutMs}ms`);
  error.name = 'TimeoutError';
  error.kind = 'timeout';
  return error;
}

export async function fetchWithTimeout(
  url,
  { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, fetcher = globalThis.fetch, requestInit = {} } = {}
) {
  if (typeof fetcher !== 'function') throw new TypeError('A fetch implementation is required');

  const duration =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_FETCH_TIMEOUT_MS;
  const controller = new globalThis.AbortController();
  const timeoutError = createTimeoutError(duration);
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort(timeoutError);
      reject(timeoutError);
    }, duration);
  });

  try {
    const request = Promise.resolve(
      fetcher(url, {
        ...requestInit,
        signal: controller.signal,
      })
    );
    return await Promise.race([request, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}
