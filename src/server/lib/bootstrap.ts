import { eq, inArray, lt } from 'drizzle-orm';
import type { Sep24Transaction } from '@/server/anchor/sep24';
import { env } from '@/server/config/env';
import { db } from '@/server/db/client';
import { authNonces } from '@/server/db/schema/authNonces';
import { withdrawals } from '@/server/db/schema/withdrawals';
import { logger } from '@/server/lib/logger';
import { invoiceService } from '@/server/service/invoice.service';
import { offrampService } from '@/server/service/offramp.service';
import { withdrawalService } from '@/server/service/withdrawal.service';
import { startEvmWatcher } from '@/server/evm/watcher';
import { bridgeService } from '@/server/service/bridge.service';

/**
 * Boots all background jobs. Idempotent — calling `ensureBootstrap` more than
 * once is a no-op (the `globalThis` flag survives HMR in dev).
 *
 * Jobs:
 *   - Expiry sweeper (every 60s): mark pending invoices and quoted/submitted
 *     withdrawals past their `expires_at` as expired.
 *   - Withdrawal poller (every `OFFRAMP_POLL_INTERVAL_MS`): for every
 *     non-terminal withdrawal, poll the anchor and apply the status.
 *   - EVM watcher (when BASE_ENABLED): polls Ethereum Sepolia for USDC transfers
 *     to the Hub and bridges them to Stellar.
 *
 * Horizon stream startup is deferred to per-invoice creation (`paymentDetectionService
 * .watchInvoice`) so we only spend resources on destinations that have
 * pending invoices.
 */

const globalForBootstrap = globalThis as unknown as { hubBootstrapStarted?: boolean };
const handles: { stop: () => void }[] = [];

function startExpirySweeper(): () => void {
  const timer = setInterval(() => {
    Promise.all([
      invoiceService.expireStale(),
      withdrawalService.expireStale(),
      db.delete(authNonces).where(lt(authNonces.expiresAt, new Date())).then((r) => r.rowCount ?? 0),
    ])
      .then(([inv, wd, nonces]) => {
        if (inv || wd || nonces)
          logger.info('bootstrap.swept', { invoices: inv, withdrawals: wd, nonces });
      })
      .catch((err) => logger.error('bootstrap.sweeper_error', { err: String(err) }));
  }, 60_000);
  timer.unref?.();
  return () => clearInterval(timer);
}

async function pollAllOpenWithdrawals(): Promise<void> {
  const open = await db
    .select()
    .from(withdrawals)
    .where(inArray(withdrawals.status, ['submitted', 'processing']));
  for (const w of open) {
    if (!w.anchorTxId) continue;
    try {
      const { pollStatus } = offrampService;
      // pollStatus requires the merchant's wallet; we look it up via quote.
      await import('@/server/db/schema/quotes').then(({ quotes }) =>
        import('drizzle-orm').then(({ eq }) =>
          db
            .select()
            .from(quotes)
            .where(eq(quotes.id, w.quoteId ?? ''))
            .limit(1),
        ),
      );
      const merchantWallet = (
        await import('@/server/db/schema/merchants').then(({ merchants }) =>
          import('drizzle-orm').then(({ eq }) =>
            db.select().from(merchants).where(eq(merchants.id, w.merchantId)).limit(1),
          ),
        )
      )[0]?.walletAddress;
      if (!merchantWallet) continue;
      // Cast through unknown to keep types clean; the helper accepts any string.
      const tx: Sep24Transaction = await pollStatus(merchantWallet, w.id);
      void tx;
    } catch (err) {
      logger.warn('bootstrap.withdraw_poll_error', { id: w.id, err: String(err) });
    }
  }
}

function startWithdrawalPoller(): () => void {
  const timer = setInterval(() => {
    void pollAllOpenWithdrawals().catch((err) =>
      logger.error('bootstrap.withdraw_poll_error', { err: String(err) }),
    );
  }, env.OFFRAMP_POLL_INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}

export function ensureBootstrap(): void {
  if (globalForBootstrap.hubBootstrapStarted) return;
  if (env.NODE_ENV === 'test') return;
  handles.push({ stop: startExpirySweeper() });
  handles.push({ stop: startWithdrawalPoller() });
  if (env.BASE_ENABLED && env.HUB_EVM_ADDRESS && env.HUB_STELLAR_SECRET) {
    handles.push({ stop: startEvmWatcher((log) => bridgeService.handleEvmTransfer(log)) });
    logger.info('bootstrap.evm_watcher_started', { hubEvm: env.HUB_EVM_ADDRESS });
  }
  globalForBootstrap.hubBootstrapStarted = true;
  logger.info('bootstrap.started');
}

export function stopBootstrap(): void {
  for (const h of handles) h.stop();
  handles.length = 0;
  globalForBootstrap.hubBootstrapStarted = false;
  logger.info('bootstrap.stopped');
}

/** Exported for unit-testing only. Returns the raw SQL from the where clause. */
export function buildOpenWithdrawalsQuery() {
  return db.select().from(withdrawals).where(inArray(withdrawals.status, ['submitted', 'processing'])).toSQL();
}
