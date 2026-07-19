import {
  calculateRetryDelay,
  isRetryCoolingDown,
  recordRetryFailure,
} from '../js/services/retry-policy.js';

describe('retry-policy', () => {
  const request = { days: 90, vs: 'usd' };

  test('increases the delay exponentially and caps it', () => {
    expect(calculateRetryDelay(1, { baseDelayMs: 100, maxDelayMs: 500 })).toBe(100);
    expect(calculateRetryDelay(2, { baseDelayMs: 100, maxDelayMs: 500 })).toBe(200);
    expect(calculateRetryDelay(3, { baseDelayMs: 100, maxDelayMs: 500 })).toBe(400);
    expect(calculateRetryDelay(4, { baseDelayMs: 100, maxDelayMs: 500 })).toBe(500);
  });

  test('records consecutive failures for the same request', () => {
    const first = recordRetryFailure(null, request, {
      now: 1_000,
      baseDelayMs: 100,
      maxDelayMs: 500,
    });
    const second = recordRetryFailure(first, request, {
      now: 2_000,
      baseDelayMs: 100,
      maxDelayMs: 500,
    });

    expect(first).toMatchObject({ attempts: 1, delayMs: 100, retryAt: 1_100 });
    expect(second).toMatchObject({ attempts: 2, delayMs: 200, retryAt: 2_200 });
  });

  test('resets attempts when the requested range or currency changes', () => {
    const previous = recordRetryFailure(null, request, { now: 1_000, baseDelayMs: 100 });
    const changed = recordRetryFailure(previous, { days: 30, vs: 'eur' }, {
      now: 2_000,
      baseDelayMs: 100,
    });

    expect(changed.attempts).toBe(1);
    expect(changed.delayMs).toBe(100);
  });

  test('blocks only the matching request during its cooldown', () => {
    const failure = recordRetryFailure(null, request, { now: 1_000, baseDelayMs: 100 });

    expect(isRetryCoolingDown(failure, request, 1_099)).toBe(true);
    expect(isRetryCoolingDown(failure, request, 1_100)).toBe(false);
    expect(isRetryCoolingDown(failure, { days: 30, vs: 'usd' }, 1_050)).toBe(false);
  });
});
