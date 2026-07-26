'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiDelete, apiPost } from '@/ui/lib/api';
import { cachedApiGet, invalidateCache, peekCache } from '@/ui/lib/query-cache';
import { useSession } from './useSession';

export type Wallet = {
  id: string;
  publicKey: string;
  label: string;
  network: string;
  createdAt: string;
};

const WALLETS_PARAMS = { limit: 100, offset: 0 };

export function useWallets() {
  const { session, loading: sessionLoading } = useSession();
  // Seed from the cache so re-mounts on client-side navigation skip the
  // loading flash and reuse the most recent payload.
  const [wallets, setWallets] = useState<Wallet[]>(() => {
    const cached = peekCache<{ items: Wallet[] }>('/api/wallets', WALLETS_PARAMS);
    return cached?.items ?? [];
  });
  const [loading, setLoading] = useState(
    () => !peekCache<{ items: Wallet[] }>('/api/wallets', WALLETS_PARAMS),
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session.publicKey) {
      setWallets([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await cachedApiGet<{ items: Wallet[] }>('/api/wallets', WALLETS_PARAMS);
      setWallets(data.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [session.publicKey]);

  useEffect(() => {
    if (sessionLoading) return;
    refresh();
  }, [refresh, sessionLoading]);

  const create = useCallback(
    async (input: { publicKey: string; label: string; network?: string }) => {
      const row = await apiPost<Wallet>('/api/wallets', {
        ...input,
        network: input.network ?? 'testnet',
      });
      // New wallet invalidates the list cache so the next read is fresh.
      invalidateCache('/api/wallets');
      setWallets((prev) => [row, ...prev]);
      return row;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await apiDelete<{ ok: true }>(`/api/wallets/${id}`);
    invalidateCache('/api/wallets');
    setWallets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  return { wallets, loading, error, refresh, create, remove };
}
