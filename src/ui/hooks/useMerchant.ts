'use client';

import { useCallback, useEffect, useState } from 'react';
import { cachedApiGet, invalidateCache, peekCache } from '@/ui/lib/query-cache';
import { useSession } from './useSession';

export type MerchantStats = {
  merchant: { id: string; name: string; network: string; createdAt: string };
  wallet: {
    usdcBalance: string;
    usdcTrustline: boolean;
    xlmBalance: string;
    accountExists: boolean;
  };
  invoices: {
    pending: number;
    paid: number;
    settled: number;
    failed: number;
    expired: number;
    total: number;
  };
  transactions: number;
  recentSettlements: Array<{
    id: string;
    invoiceId: string;
    amountMinor: string;
    stellarTxHash: string | null;
    completedAt: string | null;
    createdAt: string;
  }>;
};

export type Merchant = {
  id: string;
  name: string;
  walletAddress: string;
  network: string;
  createdAt: string;
};

export function useMerchant() {
  const { session, loading: sessionLoading } = useSession();
  // Seed from the cache so a re-mount on client-side navigation does not
  // flash a loading skeleton when fresh data is already in memory.
  const [merchant, setMerchant] = useState<Merchant | null>(() => peekCache<Merchant>('/api/merchants'));
  const [loading, setLoading] = useState(() => !peekCache<Merchant>('/api/merchants'));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session.publicKey) {
      setMerchant(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await cachedApiGet<Merchant>('/api/merchants');
      setMerchant(data);
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

  return { merchant, loading, error, refresh, setMerchant };
}

export function useMerchantStats() {
  const { session, loading: sessionLoading } = useSession();
  // Seed from the cache so re-mounts on client-side navigation skip the
  // loading flash and reuse the most recent payload.
  const [stats, setStats] = useState<MerchantStats | null>(() =>
    peekCache<MerchantStats>('/api/merchants/me/stats'),
  );
  const [loading, setLoading] = useState(() => !peekCache<MerchantStats>('/api/merchants/me/stats'));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session.publicKey) {
      setStats(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await cachedApiGet<MerchantStats>('/api/merchants/me/stats');
      setStats(data);
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

  return { stats, loading, error, refresh };
}
