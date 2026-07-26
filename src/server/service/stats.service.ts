import { and, count, desc, eq, sql } from 'drizzle-orm';
import { env } from '@/server/config/env';
import { db } from '@/server/db/client';
import { INVOICE_STATUSES, type Invoice, invoices } from '@/server/db/schema/invoices';
import { type Settlement, settlements } from '@/server/db/schema/settlements';
import { AppError } from '@/server/lib/http';
import { logger } from '@/server/lib/logger';
import { usdcCode, usdcIssuer } from '@/server/stellar/network';
import { accountExists, getAccountBalances } from '@/server/stellar/tx';
import { merchantService } from './merchant.service';

export type MerchantStats = {
  merchant: {
    id: string;
    name: string;
    network: string;
    createdAt: Date;
  };
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
    completedAt: Date | null;
    createdAt: Date;
  }>;
};

/**
 * Aggregates everything the merchant dashboard needs to render:
 *   - USDC + XLM balance from Horizon (live)
 *   - USDC trustline check (so the UI can show a "set up" CTA)
 *   - Invoice counts grouped by status
 *   - Most recent 5 settlements with their Stellar tx hashes
 *
 * The Horizon call is best-effort: if the merchant's account is not
 * funded (typical for a fresh Freighter pubkey), the route still returns
 * a `wallet.accountExists: false` instead of throwing.
 */
export const statsService = {
  async forMerchant(publicKey: string): Promise<MerchantStats> {
    const merchant = await merchantService.ensureFromPublicKey(publicKey);

    // 1. Live balances from Horizon.
    const exists = await accountExists(publicKey);
    let usdcBalance = '0';
    let usdcTrustline = false;
    let xlmBalance = '0';
    if (exists) {
      try {
        const balances = await getAccountBalances(publicKey);
        for (const b of balances) {
          if (b.asset_code === usdcCode() && b.asset_issuer === usdcIssuer()) {
            usdcBalance = String(Math.round(parseFloat(b.balance) * 100));
            usdcTrustline = true;
          }
        }
        // XLM is a native balance — fetch account directly.
        const acct = await fetchAccountNative(publicKey);
        xlmBalance = String(Math.round(parseFloat(acct) * 100));
      } catch (err) {
        logger.warn('stats.balance_error', { err: String(err) });
      }
    }

    // 2. Invoice counts grouped by status.
    const counts: Record<string, number> = {};
    const rows = await db
      .select({ status: invoices.status, n: count() })
      .from(invoices)
      .where(eq(invoices.merchantId, merchant.id))
      .groupBy(invoices.status);
    for (const r of rows) counts[r.status] = Number(r.n);
    const invoicesSummary = {
      pending: counts['pending'] ?? 0,
      paid: counts['paid'] ?? 0,
      settled: counts['settled'] ?? 0,
      failed: counts['failed'] ?? 0,
      expired: counts['expired'] ?? 0,
      total: INVOICE_STATUSES.reduce((acc, s) => acc + (counts[s] ?? 0), 0),
    };

    // 3. Total transactions = count of settlements (i.e. on-chain payments
    //    that the hub recorded). For MVP this is a reasonable proxy for
    //    "how many times USDC landed in the wallet".
    const txCountRow = await db
      .select({ n: count() })
      .from(settlements)
      .innerJoin(invoices, eq(settlements.invoiceId, invoices.id))
      .where(eq(invoices.merchantId, merchant.id));

    // 4. Recent 5 settlements.
    const recent = await db
      .select({
        id: settlements.id,
        invoiceId: settlements.invoiceId,
        amountMinor: settlements.amountMinor,
        stellarTxHash: settlements.stellarTxHash,
        completedAt: settlements.completedAt,
        createdAt: settlements.createdAt,
      })
      .from(settlements)
      .innerJoin(invoices, eq(settlements.invoiceId, invoices.id))
      .where(eq(invoices.merchantId, merchant.id))
      .orderBy(desc(settlements.createdAt))
      .limit(5);

    return {
      merchant: {
        id: merchant.id,
        name: merchant.name,
        network: merchant.network,
        createdAt: merchant.createdAt,
      },
      wallet: {
        usdcBalance,
        usdcTrustline,
        xlmBalance,
        accountExists: exists,
      },
      invoices: invoicesSummary,
      transactions: Number(txCountRow[0]?.n ?? 0),
      recentSettlements: recent,
    };
  },
};

async function fetchAccountNative(publicKey: string): Promise<string> {
  const url = `${env.STELLAR_HORIZON_URL.replace(/\/$/, '')}/accounts/${publicKey}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    throw new AppError('INTERNAL', `Horizon account returned ${res.status}`, 502);
  }
  const data = (await res.json()) as {
    balances: Array<{ asset_type: string; balance: string }>;
  };
  for (const b of data.balances) {
    if (b.asset_type === 'native') return b.balance;
  }
  return '0';
}

// Re-export so callers can `import { statsService }` from a single path.
export type { Invoice, Settlement };
