'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiDelete, apiPost } from '@/ui/lib/api';
import { cachedApiGet, invalidateCache, peekCache } from '@/ui/lib/query-cache';
import { useSession } from './useSession';

export type Invoice = {
  id: string;
  merchantId: string;
  amountMinor: string;
  currency: string;
  description: string | null;
  status: 'pending' | 'paid' | 'settling' | 'settled' | 'failed' | 'expired';
  signedId: string;
  expiresAt: string;
  paidAt: string | null;
  settledAt: string | null;
  destinationAddress: string;
  destinationMemo: string | null;
  network: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  stellarTxHash?: string | null;
  evmSourceTxHash?: string | null;
};

export type InvoiceDetail = Invoice & {
  paymentIntents?: unknown[];
  settlement?: { stellarTxHash: string | null; status: string } | null;
  sep7Uri?: string;
  hubEvmAddress?: string | null;
  evmSourceTxHash?: string | null;
};

export type PublicInvoiceView = {
  id: string;
  amountMinor: string;
  currency: string;
  description: string | null;
  status: Invoice['status'];
  destinationAddress: string;
  destinationMemo: string | null;
  network: string;
  expiresAt: string;
  paidAt: string | null;
  settledAt: string | null;
  createdAt: string;
};

export type CreateInvoiceInput = {
  amountMinor: string;
  currency?: string;
  description?: string;
  ttlSeconds?: number;
};

export type CreateInvoiceResult = {
  invoice: Invoice;
  signedId: string;
  checkoutUrl: string;
  qrPayload: string;
};

export function useInvoices(params: { limit?: number; offset?: number } = {}) {
  const { session, loading: sessionLoading } = useSession();
  const { limit = 50, offset = 0 } = params;
  const queryParams = { limit, offset };
  // Seed from cache so re-mounts on client-side navigation skip the
  // loading flash and reuse the most recent payload.
  const [items, setItems] = useState<Invoice[]>(() => {
    const cached = peekCache<{ items: Invoice[] }>('/api/invoices', queryParams);
    return cached?.items ?? [];
  });
  const [loading, setLoading] = useState(() => !peekCache<{ items: Invoice[] }>('/api/invoices', queryParams));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session.publicKey) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await cachedApiGet<{ items: Invoice[] }>('/api/invoices', queryParams);
      setItems(data.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, session.publicKey]);

  useEffect(() => {
    if (sessionLoading) return;
    refresh();
  }, [refresh, sessionLoading]);

  return { items, loading, error, refresh };
}

export function useInvoice(id: string | null) {
  const { session, loading: sessionLoading } = useSession();
  const url = id ? `/api/invoices/${id}` : null;
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(() =>
    url ? peekCache<InvoiceDetail>(url) : null,
  );
  const [loading, setLoading] = useState(() => !url || !peekCache<InvoiceDetail>(url));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    if (!session.publicKey) {
      setInvoice(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await cachedApiGet<InvoiceDetail>(`/api/invoices/${id}`);
      setInvoice(data);
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

  return { invoice, loading, error, refresh };
}

export function usePublicInvoice(signedId: string | null) {
  const url = signedId ? `/api/invoices/by-signed/${encodeURIComponent(signedId)}` : null;
  const [invoice, setInvoice] = useState<PublicInvoiceView | null>(() =>
    url ? peekCache<PublicInvoiceView>(url) : null,
  );
  const [loading, setLoading] = useState(() => !url || !peekCache<PublicInvoiceView>(url));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!signedId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await cachedApiGet<PublicInvoiceView>(
        `/api/invoices/by-signed/${encodeURIComponent(signedId)}`,
      );
      setInvoice(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [signedId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { invoice, loading, error, refresh };
}

export function useCreateInvoice() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (input: CreateInvoiceInput, idempotencyKey: string) => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(input),
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to create invoice');
      // New invoice invalidates any cached list response so the next
      // mount of useInvoices refetches.
      invalidateCache('/api/invoices');
      invalidateCache('/api/merchants/me/stats');
      return json.data as CreateInvoiceResult;
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      throw err;
    } finally {
      setCreating(false);
    }
  }, []);

  return { create, creating, error };
}

export function useCancelInvoice() {
  const [cancelling, setCancelling] = useState(false);

  const cancel = useCallback(async (id: string) => {
    setCancelling(true);
    try {
      const data = await apiDelete<Invoice>(`/api/invoices/${id}`);
      // Cancellation mutates the list and the detail row; drop the
      // affected cache entries so the next read goes to the server.
      invalidateCache('/api/invoices');
      invalidateCache(`/api/invoices/${id}`);
      invalidateCache('/api/merchants/me/stats');
      return data;
    } finally {
      setCancelling(false);
    }
  }, []);

  return { cancel, cancelling };
}
