import { DEFAULT_FETCH_TIMEOUT_MS, fetchWithTimeout } from '../js/services/http.js';

describe('fetchWithTimeout', () => {
  test('returns the fetch response and passes an AbortSignal', async () => {
    const response = { ok: true };
    const calls = [];
    const fetcher = async (url, options) => {
      calls.push([url, options]);
      expect(options.signal).toBeInstanceOf(AbortSignal);
      return response;
    };

    await expect(fetchWithTimeout('/prices', { fetcher })).resolves.toBe(response);
    expect(calls).toEqual([['/prices', expect.objectContaining({ signal: expect.any(AbortSignal) })]]);
  });

  test('aborts and rejects requests that exceed the timeout', async () => {
    let signal;
    const fetcher = (_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    };

    await expect(fetchWithTimeout('/slow', { fetcher, timeoutMs: 5 })).rejects.toMatchObject({
      name: 'TimeoutError',
      kind: 'timeout',
    });
    expect(signal.aborted).toBe(true);
  });

  test('preserves fetch failures', async () => {
    const failure = new TypeError('Network failure');
    const fetcher = async () => {
      throw failure;
    };

    await expect(fetchWithTimeout('/offline', { fetcher })).rejects.toBe(failure);
  });

  test('uses the default timeout for invalid values', async () => {
    const response = { ok: true };
    let callCount = 0;
    const fetcher = async () => {
      callCount += 1;
      return response;
    };

    await expect(fetchWithTimeout('/prices', { fetcher, timeoutMs: 0 })).resolves.toBe(response);
    expect(callCount).toBe(1);
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBe(15_000);
  });
});
