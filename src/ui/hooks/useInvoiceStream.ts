'use client';

import { useEffect, useRef, useState } from 'react';
import { apiGet } from '@/ui/lib/api';

export type InvoiceStreamSnapshot = {
  type: 'invoice.updated' | 'invoice.settled' | 'invoice.expired';
  invoice: {
    id: string;
    status: 'pending' | 'paid' | 'settling' | 'settled' | 'failed' | 'expired';
    version: number;
    amountMinor: string;
    paidAt: string | null;
    settledAt: string | null;
  };
  settlement?: { stellarTxHash: string; status: string } | null;
};

/**
 * Subscribes to /api/invoices/by-signed/{signedId}/stream (SSE).
 * The server sends the initial snapshot then live updates.
 */
export function useInvoiceStream(
  signedId: string | null,
  onUpdate?: (snap: InvoiceStreamSnapshot) => void,
) {
  const [snapshot, setSnapshot] = useState<InvoiceStreamSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!signedId) return;
    let cancelled = false;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      if (cancelled) return;
      es = new EventSource(`/api/invoices/by-signed/${encodeURIComponent(signedId)}/stream`, {
        withCredentials: true,
      });
      // Server emits named events ("event: invoice.updated") — onmessage only
      // fires for unnamed events, so we must use addEventListener here.
      es.addEventListener('invoice.updated', (ev: MessageEvent) => {
        try {
          const raw = JSON.parse(ev.data as string) as {
            invoiceId: string;
            version: number;
            status: string;
            paidAt: string | null;
            settledAt: string | null;
          };
          const parsed: InvoiceStreamSnapshot = {
            type: 'invoice.updated',
            invoice: {
              id: raw.invoiceId,
              status: raw.status as InvoiceStreamSnapshot['invoice']['status'],
              version: raw.version,
              amountMinor: '',
              paidAt: raw.paidAt,
              settledAt: raw.settledAt,
            },
          };
          setSnapshot(parsed);
          onUpdateRef.current?.(parsed);
        } catch {
          // ignore malformed
        }
      });
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
  }, [signedId]);

  return { snapshot, error };
}

/**
 * Polls /api/invoices/by-signed/{signedId}/status (JSON) at an interval.
 * Used as a SSE-fallback when EventSource isn't available.
 */
export function useInvoiceStatusPoll(signedId: string | null, intervalMs = 2000) {
  const [data, setData] = useState<{
    status: string;
    version: number;
    settlement: { stellarTxHash: string; status: string } | null;
  } | null>(null);

  useEffect(() => {
    if (!signedId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await apiGet<typeof data>(
          `/api/invoices/by-signed/${encodeURIComponent(signedId)}/status`,
        );
        if (!cancelled) {
          setData(res);
          if (res?.status === 'settled' || res?.status === 'failed' || res?.status === 'expired') {
            return; // stop polling on terminal state
          }
        }
      } catch {
        // ignore
      }
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [signedId, intervalMs]);

  return data;
}
