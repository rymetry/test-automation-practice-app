import {
  PRACTICE_DEFAULT_DELAY_MS,
  PRACTICE_MAX_DELAY_MS,
  type PracticeData,
  type PracticeDelayResponse,
  type PracticeFlakyError,
  type PracticeFlakySuccess,
} from '../types';
import { type ApiHandler, badRequest, json, methodNotAllowed } from './http';

const DELAY_MS_ERROR = `ms must be an integer between 0 and ${PRACTICE_MAX_DELAY_MS}`;

function parseDelayMs(url: URL): number | null {
  const values = url.searchParams.getAll('ms');
  if (values.length === 0) return PRACTICE_DEFAULT_DELAY_MS;
  if (values.length > 1) return null;
  const raw = values[0];
  if (raw === undefined || !/^\d+$/.test(raw)) return null;
  const ms = Number(raw);
  return ms >= 0 && ms <= PRACTICE_MAX_DELAY_MS ? ms : null;
}

/** 切断時は例外にせず resolve して Worker のエラーログを抑止し、タイマーとリスナーを確実に解放する。 */
function waitForDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (ms === 0 || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export const handlePractice: ApiHandler = async ({ path, method, request, url, session }) => {
  if (path === '/api/practice/data') {
    if (method !== 'GET') return methodNotAllowed('GET');
    return json({
      message: 'Server response loaded',
      items: ['Alpha', 'Beta', 'Gamma'],
    } satisfies PracticeData);
  }

  if (path === '/api/practice/flaky') {
    if (method !== 'GET') return methodNotAllowed('GET');
    const attempt = await session.nextFlakyAttempt();
    if (attempt === 1) {
      return json(
        {
          error: 'Temporary server error. Please retry.',
          attempt: 1,
        } satisfies PracticeFlakyError,
        500,
      );
    }
    return json({
      message: 'Recovered on retry',
      attempt,
    } satisfies PracticeFlakySuccess);
  }

  if (path === '/api/practice/flaky/reset') {
    if (method !== 'POST') return methodNotAllowed('POST');
    await session.resetFlakyAttempts();
    return json({ attempts: 0 });
  }

  if (path === '/api/practice/delay') {
    if (method !== 'GET') return methodNotAllowed('GET');
    const ms = parseDelayMs(url);
    if (ms === null) return badRequest(DELAY_MS_ERROR);
    await waitForDelay(ms, request.signal);
    return json({
      delayMs: ms,
      message: `Responded after ${ms}ms`,
    } satisfies PracticeDelayResponse);
  }

  return null;
};
