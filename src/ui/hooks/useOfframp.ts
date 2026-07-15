'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiPatch, apiPost } from '@/ui/lib/api';
import { cachedApiGet, invalidateCache, peekCache } from '@/ui/lib/query-cache';
import { useSession } from './useSession';

export type AssetRef = { code: string; issuer: string | null };

export type QuoteRequest = {
  sellAsset: AssetRef;
  buyAsset: AssetRef;
  sellAmount: string;
  buyDeliveryMethod: 'bank_deposit' | 'cash_pickup';
  countryCode?: string;
  context?: string;
  sellDeliveryMethod?: string;
};

export type Quote = {
  id: string;
  merchantId: string;
  anchorDomain: string;
  anchorQuoteId: string;
  sellAsset: AssetRef;
  buyAsset: AssetRef;
  sellAmount: string;
  buyAmount: string;
  totalPrice: string;
  price: string;
  feeTotal: string;
  feeAsset: AssetRef;
  buyDeliveryMethod: 'bank_deposit' | 'cash_pickup';
  sellDeliveryMethod: string | null;
  countryCode: string | null;
  context: string | null;
  rawResponse: unknown;
  expiresAt: string;
  createdAt: string;
};

export type PayoutMeta =
  | {
      v: 1;
      kind: 'bank_deposit';
      data: { bankName: string; accountNumber: string; accountName: string };
    }
  | {
      v: 1;
      kind: 'cash_pickup';
      data: { pickupLocation: string; recipientName: string; recipientId?: string };
    };

export type Withdrawal = {
  id: string;
  merchantId: string;
  quoteId: string;
  anchorDomain: string;
  sourceAmountMinor: string;
  destinationAsset: AssetRef;
  destinationAmount: string;
  payoutMethod: 'bank_deposit' | 'cash_pickup';
  payoutMeta: PayoutMeta;
  status: 'quoted' | 'submitted' | 'processing' | 'completed' | 'refunded' | 'expired' | 'failed';
  anchorTxId: string | null;
  withdrawAnchorAccount: string | null;
  withdrawMemo: string | null;
  withdrawMemoType: string | null;
  stellarTxHash: string | null;
  version: number;
  expiresAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

async function callWithIdempotency<T>(
  url: string,
  body: unknown,
  idempotencyKey: string,
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message ?? 'Request failed');
  return json.data as T;
}

export function useCreateQuote() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (input: QuoteRequest, idempotencyKey: string) => {
    setCreating(true);
    setError(null);
    try {
      return await callWithIdempotency<Quote>('/api/offramp/quotes', input, idempotencyKey);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setCreating(false);
    }
  }, []);

  return { create, creating, error };
}

export function useCreateWithdrawal() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (
      input: {
        quoteId: string;
        payoutMethod: 'bank_deposit' | 'cash_pickup';
        payoutMeta: PayoutMeta;
        ttlSeconds?: number;
      },
      idempotencyKey: string,
    ) => {
      setCreating(true);
      setError(null);
      try {
        const data = await callWithIdempotency<Withdrawal>(
          '/api/offramp/withdrawals',
          input,
          idempotencyKey,
        );
        // New withdrawal invalidates the list cache.
        invalidateCache('/api/offramp/withdrawals');
        return data;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setCreating(false);
      }
    },
    [],
  );

  return { create, creating, error };
}

export function useStartWithdrawal() {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (withdrawalId: string) => {
    setStarting(true);
    setError(null);
    try {
      const data = await apiPatch<{ start: { type: string; id: string; url?: string } }>(
        '/api/offramp/withdrawals',
        { withdrawalId },
      );
      // Server-side state changed; drop the affected cache entries.
      invalidateCache('/api/offramp/withdrawals');
      invalidateCache(`/api/offramp/withdrawals/${withdrawalId}`);
      return data.start;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setStarting(false);
    }
  }, []);

  return { start, starting, error };
}

export function useSubmitWithdrawal() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (withdrawalId: string, signedXdr: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiPost<Withdrawal>(`/api/offramp/withdrawals/${withdrawalId}`, {
        signedXdr,
      });
      invalidateCache('/api/offramp/withdrawals');
      invalidateCache(`/api/offramp/withdrawals/${withdrawalId}`);
      invalidateCache('/api/merchants/me/stats');
      return data;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submit, submitting, error };
}

export function useWithdrawals() {
  const { session, loading: sessionLoading } = useSession();
  const params = { limit: 20 };
  // Seed from the cache so re-mounts on client-side navigation skip the
  // loading flash and reuse the most recent payload.
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>(() => {
    const cached = peekCache<{ items: Withdrawal[] }>('/api/offramp/withdrawals', params);
    return cached?.items ?? [];
  });
  const [loading, setLoading] = useState(
    () => !peekCache<{ items: Withdrawal[] }>('/api/offramp/withdrawals', params),
  );

  useEffect(() => {
    if (sessionLoading) return;
    if (!session.publicKey) {
      setWithdrawals([]);
      setLoading(false);
      return;
    }
    cachedApiGet<{ items: Withdrawal[] }>('/api/offramp/withdrawals', params)
      .then((data) => setWithdrawals(data.items))
      .catch(() => setWithdrawals([]))
      .finally(() => setLoading(false));
  }, [sessionLoading, session.publicKey]);

  return { withdrawals, loading };
}

export function useWithdrawal(id: string | null) {
  const { session, loading: sessionLoading } = useSession();
  const url = id ? `/api/offramp/withdrawals/${id}` : null;
  const [withdrawal, setWithdrawal] = useState<Withdrawal | null>(() =>
    url ? peekCache<Withdrawal>(url) : null,
  );
  const [loading, setLoading] = useState(() => !url || !peekCache<Withdrawal>(url));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    if (!session.publicKey) {
      setWithdrawal(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await cachedApiGet<Withdrawal>(`/api/offramp/withdrawals/${id}`);
      setWithdrawal(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, session.publicKey]);

  useEffect(() => {
    if (sessionLoading) return;
    refresh();
  }, [refresh, sessionLoading]);

  return { withdrawal, loading, error, refresh };
}

export type WithdrawalStreamSnapshot = {
  type: 'withdrawal.updated';
  withdrawal: Withdrawal;
};

/**
 * Subscribes to /api/offramp/withdrawals/{id}/stream (SSE).
 */
export function useWithdrawalStream(
  id: string | null,
  onUpdate?: (snap: WithdrawalStreamSnapshot) => void,
) {
  const [snapshot, setSnapshot] = useState<WithdrawalStreamSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      if (cancelled) return;
      es = new EventSource(`/api/offramp/withdrawals/${encodeURIComponent(id)}/stream`, {
        withCredentials: true,
      });
      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data) as WithdrawalStreamSnapshot;
          setSnapshot(parsed);
          onUpdateRef.current?.(parsed);
        } catch {
          // ignore
        }
      };
      es.onerror = () => {
        es?.close();
        if (!cancelled) {
          setError('Stream disconnected');
          retry = setTimeout(open, 2000);
        }
      };
    };

    open();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, [id]);

  return { snapshot, error };
}
