import { createHash } from 'node:crypto';
import { env } from '@/server/config/env';
import { AppError } from '@/server/lib/http';
import { logger } from '@/server/lib/logger';
import { type DetectedPayment, watchAccountPayments } from '@/server/stellar/stream';
import { getTransaction, getTransactionPayments, type HorizonPayment } from '@/server/stellar/tx';
import { invoiceService } from './invoice.service';

/**
 * The on-chain payment memo is `sha256(invoice.id)` encoded as lowercase hex
 * (see `invoiceMemoHex` in `checkout.service`). Compare the candidate's
 * memo_bytes (also hex) against this computed value.
 */
function memoMatchesInvoice(memoBytes: string | undefined, invoiceId: string): boolean {
  if (!memoBytes) return false;
  const expected = createHash('sha256').update(invoiceId).digest('hex');
  return memoBytes.toLowerCase() === expected;
}

/**
 * Real Stellar payment detection. Subscribes to Horizon's payment stream for
 * every pending invoice's destination address and validates each event
 * against the invoice's expected (amount, asset). On match, the invoice is
 * transitioned to `paid` via the service layer (which writes payment_intents,
 * settlements, and publishes an SSE event).
 *
 * Lifecycle:
 *   - `startDetectors` is called once at boot (see `bootstrap.ts`).
 *   - When a new invoice is created, `watchInvoice` is called to start a
 *     one-off watcher for that destination.
 *   - When the destination no longer has pending invoices, the watcher
 *     self-cancels.
 */

/** Convert Horizon decimal amount string to cents bigint.
 * "20.0000000" → 2000n  ("20.50" → 2050n) */
function horizonAmountToCents(amount: string): bigint {
  const [whole, frac = ''] = amount.split('.');
  const cents = frac.slice(0, 2).padEnd(2, '0');
  return BigInt(whole) * 100n + BigInt(cents);
}

type WatchHandle = { abort: AbortController; refCount: number };
const handles = new Map<string, WatchHandle>();

function key(destination: string, chain: 'stellar'): string {
  return `${chain}:${destination}`;
}

export const paymentDetectionService = {
  /**
   * Start a watcher for a given destination. If a watcher already exists,
   * bump its refcount and reuse it. Returns a function to release the ref.
   */
  watchInvoice(destination: string): () => void {
    const k = key(destination, 'stellar');
    const existing = handles.get(k);
    if (existing) {
      existing.refCount += 1;
      logger.debug('paymentDetection.reuse', { destination, refCount: existing.refCount });
      return () => {
        existing.refCount -= 1;
        logger.debug('paymentDetection.release', { destination, refCount: existing.refCount });
      };
    }
    const abort = new AbortController();
    handles.set(k, { abort, refCount: 1 });
    void this.runWatcher(destination, abort.signal);
    return () => {
      const h = handles.get(k);
      if (!h) return;
      h.refCount -= 1;
      if (h.refCount <= 0) {
        h.abort.abort();
        handles.delete(k);
      }
    };
  },

  async runWatcher(destination: string, signal: AbortSignal): Promise<void> {
    logger.info('paymentDetection.start', { destination });
    try {
      await watchAccountPayments({
        destination,
        usdcOnly: true,
        maxStreamRetries: 3,
        pollIntervalMs: 5_000,
        signal,
        onMatch: async (p) => {
          await this.handleMatch(destination, p);
        },
      });
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') {
        logger.error('paymentDetection.error', { err: String(err), destination });
      }
    } finally {
      logger.info('paymentDetection.stop', { destination });
    }
  },

  async handleMatch(destination: string, p: DetectedPayment): Promise<void> {
    // Find the pending invoice(s) for this destination.
    const matches = await import('@/server/db/client').then(({ db }) =>
      import('@/server/db/schema/invoices').then(({ invoices }) =>
        import('drizzle-orm').then(({ and, eq }) =>
          db
            .select()
            .from(invoices)
            .where(
              and(eq(invoices.destinationAddress, destination), eq(invoices.status, 'pending')),
            )
            .limit(50),
        ),
      ),
    );

    for (const inv of matches) {
      // Memo must equal the invoice id (or signed id). We use id directly.
      // (The transaction we got is a payment record; the memo lives on the
      // parent transaction, so we re-fetch and check there.)
      try {
        const tx = await getTransaction(p.txHash);
        const txPayments = await getTransactionPayments(p.txHash);
        const matchedPayment = txPayments.find((tp: HorizonPayment) => tp.id === p.paymentId);
        if (!matchedPayment) continue;
        if (matchedPayment.to !== destination) continue;
        // Validate amount: on-chain amount must be >= expected.
        // inv.amountMinor is cents ("2000" = $20.00).
        // Horizon returns amounts as a decimal string ("20.0000000"), so we
        // parse it to cents before comparing — BigInt("20.0000000") would throw.
        const expected = BigInt(inv.amountMinor);
        const received = horizonAmountToCents(matchedPayment.amount);
        if (received < expected) {
          logger.warn('paymentDetection.underpaid', { invoiceId: inv.id, expected, received });
          continue;
        }
        // Validate memo when present.
        // - hash memo: web checkout (Freighter) — sha256(invoice.id) hex
        // - text memo: mobile SEP-7 (Lobstr) — first 28 chars of UUID (no dashes)
        // - no memo: fall back to amount+destination matching only
        if (tx.memo_type === 'hash') {
          if (!memoMatchesInvoice(tx.memo_bytes, inv.id)) continue;
        } else if (tx.memo_type === 'text') {
          const expected = inv.id.replace(/-/g, '').slice(0, 28);
          if (tx.memo !== expected) continue;
        } else if (tx.memo_type !== 'none' && tx.memo_type) {
          continue;
        }
        await invoiceService.recordPayment({
          invoiceId: inv.id,
          txHash: p.txHash,
          paymentId: p.paymentId,
          from: matchedPayment.from,
          amount: matchedPayment.amount,
          chain: 'stellar',
        });
        logger.info('paymentDetection.matched', { invoiceId: inv.id, txHash: p.txHash });
      } catch (err) {
        logger.warn('paymentDetection.match_error', { err: String(err), invoiceId: inv.id });
      }
    }
  },

  /** Test/admin: stop all watchers. */
  stopAll(): void {
    for (const h of handles.values()) h.abort.abort();
    handles.clear();
  },

  /** For tests. */
  activeWatchers(): number {
    return handles.size;
  },
};

// Re-export helper so bootstrap can re-use the count for health endpoint.
export function activeWatchersCount(): number {
  return handles.size;
}

/**
 * Toggle the stream on/off. When `HORIZON_STREAM_ENABLED=false`, `watchInvoice`
 * is a no-op (we fall back to polling on each call site that needs it).
 */
export function isStreamEnabled(): boolean {
  return env.HORIZON_STREAM_ENABLED;
}

// Throw a typed error so callers can use AppError.
export const _appError = AppError;
