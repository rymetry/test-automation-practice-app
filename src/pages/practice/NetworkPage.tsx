import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { api } from '../../api';
import { PRACTICE_DEFAULT_DELAY_MS, PRACTICE_MAX_DELAY_MS } from '../../types';
import { PageLayout } from '../../ui/PageLayout';

function extractErrorMessage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const candidate = data as Record<string, unknown>;
  return typeof candidate.error === 'string' && candidate.error.length > 0 ? candidate.error : null;
}

function parseMockFetchResponse(data: unknown): { message: string; items: string[] } | null {
  if (typeof data !== 'object' || data === null) return null;
  const candidate = data as Record<string, unknown>;
  if (typeof candidate.message !== 'string') return null;
  if (candidate.items === undefined) {
    return { message: candidate.message, items: [] };
  }
  if (!Array.isArray(candidate.items) || !candidate.items.every((item): item is string => typeof item === 'string')) {
    return null;
  }
  return { message: candidate.message, items: candidate.items };
}

function parseFlakySuccessResponse(data: unknown): { message: string; attempt: number } | null {
  if (typeof data !== 'object' || data === null) return null;
  const candidate = data as Record<string, unknown>;
  if (typeof candidate.message !== 'string') return null;
  if (typeof candidate.attempt !== 'number' || !Number.isFinite(candidate.attempt)) return null;
  return { message: candidate.message, attempt: candidate.attempt };
}

function isFlakyResetResponse(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return typeof candidate.attempts === 'number' && Number.isFinite(candidate.attempts);
}

function parseDelayResponse(data: unknown): { message: string } | null {
  if (typeof data !== 'object' || data === null) return null;
  const candidate = data as Record<string, unknown>;
  if (typeof candidate.message !== 'string') return null;
  if (
    candidate.delayMs !== undefined &&
    (typeof candidate.delayMs !== 'number' || !Number.isFinite(candidate.delayMs))
  ) {
    return null;
  }
  return { message: candidate.message };
}

/** モック差し替え・初回失敗リトライ・遅延 API の待機を練習するページ。 */
export function NetworkPage(): JSX.Element {
  const mountedRef = useRef(true);

  const [fetchStatus, setFetchStatus] = useState('');
  const [fetchedItems, setFetchedItems] = useState<string[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const fetchGenRef = useRef(0);
  const fetchAbortRef = useRef<AbortController | null>(null);

  const [flakyStatus, setFlakyStatus] = useState('');
  const [flakyError, setFlakyError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [flakyRequesting, setFlakyRequesting] = useState(false);
  const [flakyResetting, setFlakyResetting] = useState(false);
  const flakyGenRef = useRef(0);
  const flakyAbortRef = useRef<AbortController | null>(null);
  const flakyRequestingRef = useRef(false);
  const flakyResettingRef = useRef(false);

  const [delayMsInput, setDelayMsInput] = useState(String(PRACTICE_DEFAULT_DELAY_MS));
  const [delayStatus, setDelayStatus] = useState('');
  const [delayError, setDelayError] = useState<string | null>(null);
  const delayGenRef = useRef(0);
  const delayAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      fetchGenRef.current += 1;
      flakyGenRef.current += 1;
      delayGenRef.current += 1;
      flakyRequestingRef.current = false;
      flakyResettingRef.current = false;
      fetchAbortRef.current?.abort();
      flakyAbortRef.current?.abort();
      delayAbortRef.current?.abort();
      fetchAbortRef.current = null;
      flakyAbortRef.current = null;
      delayAbortRef.current = null;
    };
  }, []);

  async function handleFetchData(): Promise<void> {
    fetchAbortRef.current?.abort();
    const gen = ++fetchGenRef.current;
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setFetchError(null);
    setFetchedItems([]);
    setFetchStatus('Loading data…');

    try {
      const result = await api.practice.data(controller.signal);
      if (gen !== fetchGenRef.current || !mountedRef.current) return;

      if (result.status === 200) {
        const parsed = result.invalidJson ? null : parseMockFetchResponse(result.data);
        if (!parsed) {
          setFetchStatus('');
          setFetchedItems([]);
          setFetchError('Unexpected response');
          return;
        }
        setFetchStatus(parsed.message);
        setFetchedItems(parsed.items);
        setFetchError(null);
        return;
      }

      setFetchStatus('');
      setFetchedItems([]);
      setFetchError(extractErrorMessage(result.data) ?? `Request failed (${result.status})`);
    } catch {
      if (gen !== fetchGenRef.current || !mountedRef.current) return;
      setFetchStatus('');
      setFetchedItems([]);
      setFetchError('Network request failed');
    } finally {
      if (fetchAbortRef.current === controller) {
        fetchAbortRef.current = null;
      }
    }
  }

  async function handleFlakyRequest(): Promise<void> {
    // Flaky API はサーバー側の試行回数を進めるため、進行中の二重送信を同期的に防ぐ。
    if (flakyRequestingRef.current || flakyResettingRef.current) return;
    flakyAbortRef.current?.abort();
    const gen = ++flakyGenRef.current;
    const controller = new AbortController();
    flakyAbortRef.current = controller;
    flakyRequestingRef.current = true;
    setFlakyRequesting(true);
    setFlakyError(null);
    setFlakyStatus('');

    try {
      const result = await api.practice.flaky(controller.signal);
      if (gen !== flakyGenRef.current || !mountedRef.current) return;

      if (result.status === 200) {
        const parsed = result.invalidJson ? null : parseFlakySuccessResponse(result.data);
        if (!parsed) {
          setFlakyStatus('');
          setFlakyError('Unexpected response');
          setCanRetry(true);
          return;
        }
        setFlakyStatus(`${parsed.message} (attempt ${parsed.attempt})`);
        setFlakyError(null);
        setCanRetry(false);
        return;
      }

      setFlakyStatus('');
      setFlakyError(extractErrorMessage(result.data) ?? `Request failed (${result.status})`);
      setCanRetry(true);
    } catch {
      if (gen !== flakyGenRef.current || !mountedRef.current) return;
      setFlakyStatus('');
      setFlakyError('Network request failed');
      setCanRetry(true);
    } finally {
      if (gen === flakyGenRef.current) {
        flakyRequestingRef.current = false;
        if (mountedRef.current) {
          setFlakyRequesting(false);
        }
      }
      if (flakyAbortRef.current === controller) {
        flakyAbortRef.current = null;
      }
    }
  }

  async function handleResetFlaky(): Promise<void> {
    // 送信中に reset すると、中断した GET が reset 後にサーバーで処理されて試行回数が残り得るため、応答を待ってから受け付ける。
    if (flakyRequestingRef.current || flakyResettingRef.current) return;
    const gen = ++flakyGenRef.current;
    const controller = new AbortController();
    flakyAbortRef.current = controller;

    flakyResettingRef.current = true;
    setFlakyResetting(true);
    setFlakyError(null);
    setFlakyStatus('');
    setCanRetry(false);

    try {
      const result = await api.practice.resetFlaky(controller.signal);
      if (gen !== flakyGenRef.current || !mountedRef.current) return;

      if (result.status === 200) {
        if (result.invalidJson || !isFlakyResetResponse(result.data)) {
          setFlakyStatus('');
          setFlakyError('Unexpected response');
          setCanRetry(false);
          return;
        }
        setFlakyStatus('Flaky state reset');
        setFlakyError(null);
        setCanRetry(false);
        return;
      }

      setFlakyStatus('');
      setFlakyError('Could not reset flaky state');
      setCanRetry(false);
    } catch {
      if (gen !== flakyGenRef.current || !mountedRef.current) return;
      setFlakyStatus('');
      setFlakyError('Could not reset flaky state');
      setCanRetry(false);
    } finally {
      if (gen === flakyGenRef.current) {
        flakyResettingRef.current = false;
        if (mountedRef.current) {
          setFlakyResetting(false);
        }
      }
      if (flakyAbortRef.current === controller) {
        flakyAbortRef.current = null;
      }
    }
  }

  async function handleDelayedRequest(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    delayAbortRef.current?.abort();
    const gen = ++delayGenRef.current;
    const controller = new AbortController();
    delayAbortRef.current = controller;

    setDelayError(null);
    setDelayStatus('Waiting for response…');

    try {
      const result = await api.practice.delay(delayMsInput, controller.signal);
      if (gen !== delayGenRef.current || !mountedRef.current) return;

      if (result.status === 200) {
        const parsed = result.invalidJson ? null : parseDelayResponse(result.data);
        if (!parsed) {
          setDelayStatus('');
          setDelayError('Unexpected response');
          return;
        }
        setDelayStatus(parsed.message);
        setDelayError(null);
        return;
      }

      setDelayStatus('');
      setDelayError(extractErrorMessage(result.data) ?? `Request failed (${result.status})`);
    } catch {
      if (gen !== delayGenRef.current || !mountedRef.current) return;
      setDelayStatus('');
      setDelayError('Network request failed');
    } finally {
      if (delayAbortRef.current === controller) {
        delayAbortRef.current = null;
      }
    }
  }

  return (
    <PageLayout
      title="Network & retries"
      intro="API レスポンスのモック差し替え、初回失敗からのリトライ、遅延レスポンスの待機を練習するページです。各領域は名前付き region と個別の status で分かれています。"
      size="medium"
    >
      <div className="grid-2 grid-2-stretch">
        <section aria-labelledby="mock-fetch-title" className="card" data-testid="mock-fetch-region">
          <h2 id="mock-fetch-title">Mockable fetch</h2>
          <p className="muted">
            GET /api/practice/data を呼び出します。ルートをモックしてレスポンスやエラーを差し替えられます。
          </p>
          <div className="row">
            <button type="button" className="btn-primary" data-testid="fetch-data" onClick={() => void handleFetchData()}>
              Fetch data
            </button>
          </div>
          <div data-testid="fetch-error">
            {fetchError ? (
              <p role="alert" className="error">
                {fetchError}
              </p>
            ) : null}
          </div>
          <p role="status" aria-label="Fetch status" className="result" data-testid="fetch-status">
            {fetchStatus || null}
          </p>
          {fetchedItems.length > 0 ? (
            <ul aria-label="Fetched items" className="todo-list" data-testid="fetched-items">
              {fetchedItems.map((item, index) => (
                <li key={`${index}-${item}`} data-testid="fetched-item">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section aria-labelledby="flaky-request-title" className="card" data-testid="flaky-request-region">
          <h2 id="flaky-request-title">Flaky request</h2>
          <p className="muted">
            初回は 500 エラーを返し、2 回目以降のリトライで成功します。リセットすると再び初回失敗から練習できます。
          </p>
          <div className="row">
            <button
              type="button"
              className="btn-primary"
              disabled={flakyRequesting || flakyResetting}
              data-testid="flaky-request"
              onClick={() => void handleFlakyRequest()}
            >
              Send flaky request
            </button>
            {canRetry ? (
              <button
                type="button"
                disabled={flakyRequesting || flakyResetting}
                data-testid="flaky-retry"
                onClick={() => void handleFlakyRequest()}
              >
                Retry
              </button>
            ) : null}
            <button
              type="button"
              disabled={flakyRequesting || flakyResetting}
              data-testid="flaky-reset"
              onClick={() => void handleResetFlaky()}
            >
              Reset flaky state
            </button>
          </div>
          <div data-testid="flaky-error">
            {flakyError ? (
              <p role="alert" className="error">
                {flakyError}
              </p>
            ) : null}
          </div>
          <p role="status" aria-label="Flaky status" className="result" data-testid="flaky-status">
            {flakyStatus || null}
          </p>
        </section>
      </div>

      <section aria-labelledby="delayed-response-title" className="card" data-testid="delayed-response-region">
        <h2 id="delayed-response-title">Delayed response</h2>
        <p className="muted">
          指定したミリ秒（0〜5000）だけ待ってから応答する GET /api/practice/delay を呼び出します。
        </p>
        <form
          className="form-inline"
          data-testid="delay-form"
          noValidate
          onSubmit={(event) => void handleDelayedRequest(event)}
        >
          <div className="field">
            <label htmlFor="delay-ms">Delay (ms)</label>
            <input
              id="delay-ms"
              name="ms"
              type="number"
              min={0}
              max={PRACTICE_MAX_DELAY_MS}
              step={1}
              data-testid="delay-ms"
              value={delayMsInput}
              onChange={(event) => setDelayMsInput(event.target.value)}
            />
          </div>
          <button type="submit" data-testid="send-delayed">
            Send delayed request
          </button>
        </form>
        <div data-testid="delay-error">
          {delayError ? (
            <p role="alert" className="error">
              {delayError}
            </p>
          ) : null}
        </div>
        <p role="status" aria-label="Delay status" className="result" data-testid="delay-status">
          {delayStatus || null}
        </p>
      </section>
    </PageLayout>
  );
}
