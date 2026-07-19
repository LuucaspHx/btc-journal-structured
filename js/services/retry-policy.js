export const DEFAULT_RETRY_BASE_DELAY_MS = 30_000;
export const DEFAULT_RETRY_MAX_DELAY_MS = 5 * 60_000;

function sameRequest(failure, request) {
  return failure && request && failure.days === request.days && failure.vs === request.vs;
}

export function calculateRetryDelay(
  attempts,
  { baseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS, maxDelayMs = DEFAULT_RETRY_MAX_DELAY_MS } = {}
) {
  const normalizedAttempts = Math.max(1, Math.floor(Number(attempts) || 1));
  const base = Math.max(1, Number(baseDelayMs) || DEFAULT_RETRY_BASE_DELAY_MS);
  const cap = Math.max(base, Number(maxDelayMs) || DEFAULT_RETRY_MAX_DELAY_MS);
  return Math.min(cap, base * 2 ** (normalizedAttempts - 1));
}

export function recordRetryFailure(
  previousFailure,
  request,
  { now = Date.now(), baseDelayMs, maxDelayMs } = {}
) {
  const attempts = sameRequest(previousFailure, request) ? previousFailure.attempts + 1 : 1;
  const delayMs = calculateRetryDelay(attempts, { baseDelayMs, maxDelayMs });
  return {
    ...request,
    attempts,
    retryAt: now + delayMs,
    delayMs,
  };
}

export function isRetryCoolingDown(failure, request, now = Date.now()) {
  return sameRequest(failure, request) && Number(failure.retryAt) > now;
}
