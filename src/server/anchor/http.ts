import { AppError } from '@/server/lib/http';

/**
 * Minimal HTTP client for Stellar anchor servers. Anchors live on regular
 * HTTPS endpoints (e.g. `https://anchor.example.com/sep24`, `…/sep38`).
 *
 * Features:
 *   - `AbortSignal.timeout` per request (default 10s).
 *   - 1 retry with exponential backoff for 5xx and network errors.
 *   - `parseError` maps non-2xx bodies to `AppError` (preserves any structured
 *     `extras` the anchor attached).
 */

export type HttpJsonOptions = {
  method?: 'GET' | 'POST';
  body?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  authToken?: string;
  signal?: AbortSignal;
};

const RETRY_STATUSES = new Set([502, 503, 504]);

export async function httpJson<T = unknown>(url: string, opts: HttpJsonOptions = {}): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxAttempts = 2;

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await doFetch(url, opts, timeoutMs);
      if (res.ok) {
        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      }
      if (!RETRY_STATUSES.has(res.status) || attempt === maxAttempts) {
        await throwForStatus(res);
      }
      await sleep(200 * 2 ** (attempt - 1));
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) {
        if (err instanceof AppError) throw err;
        throw new AppError('INTERNAL', `Anchor request failed: ${String(err)}`, 502);
      }
    }
  }
  // Unreachable, but TypeScript needs a fallthrough.
  if (lastErr instanceof AppError) throw lastErr;
  throw new AppError('INTERNAL', 'Anchor request failed', 502);
}

async function doFetch(url: string, opts: HttpJsonOptions, timeoutMs: number): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(opts.headers ?? {}) };
  if (opts.authToken) headers.Authorization = `Bearer ${opts.authToken}`;
  let body: string | undefined;
  if (opts.body) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    body = JSON.stringify(opts.body);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  try {
    return await fetch(url, {
      method: opts.method ?? (body ? 'POST' : 'GET'),
      headers,
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function throwForStatus(res: Response): Promise<never> {
  const text = await res.text().catch(() => '');
  let detail: unknown = text;
  try {
    detail = JSON.parse(text);
  } catch {
    /* keep as text */
  }
  // 4xx → user-input-like, 5xx → server.
  const code = res.status >= 500 ? 'INTERNAL' : 'INVALID_INPUT';
  throw new AppError(
    code,
    `Anchor returned ${res.status}: ${text.slice(0, 200)}`,
    res.status >= 500 ? 502 : 400,
    {
      anchorStatus: res.status,
      body: detail,
    },
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
