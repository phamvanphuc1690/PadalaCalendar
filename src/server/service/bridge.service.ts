import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { invoices } from '@/server/db/schema/invoices';
import { paymentIntents } from '@/server/db/schema/paymentIntents';
import { type EvmLog, baseUnitsToMinor, parseFromAddress, parseTransferAmount } from '@/server/evm/rpc';
import { logger } from '@/server/lib/logger';

/**
 * Convert cents minor-unit string to Stellar display amount string.
 * "100" → "1.00"
 */
function centsToStellarAmount(minorCents: string): string {
  const n = BigInt(minorCents);
  const whole = n / 100n;
  const frac = n % 100n;
  return `${whole}.${frac.toString().padStart(2, '0')}`;
}

export const bridgeService = {
  /**
   * Called for every ERC-20 USDC Transfer to the Hub's Base address.
   * Finds the matching pending invoice by amount, then sends USDC on Stellar
   * from the Hub's Stellar wallet to the merchant's destination address.
   */
  async handleEvmTransfer(log: EvmLog): Promise<void> {
    const txHash = log.transactionHash;

    // Idempotency: skip if already processed this EVM tx.
    const existing = await db
      .select()
      .from(paymentIntents)
      .where(and(eq(paymentIntents.evmTxHash, txHash), eq(paymentIntents.chain, 'base')))
      .limit(1);
    if (existing.length) {
      logger.debug('bridge.already_processed', { txHash });
      return;
    }

    const baseUnits = parseTransferAmount(log);
    const amountMinor = baseUnitsToMinor(baseUnits);
    const fromAddress = parseFromAddress(log);

    logger.info('bridge.evm_transfer', { txHash, amountMinor: amountMinor.toString(), from: fromAddress });

    // Find a pending invoice matching this exact amount.
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.status, 'pending'), eq(invoices.amountMinor, amountMinor.toString())))
      .limit(1);

    if (!invoice) {
      logger.warn('bridge.no_matching_invoice', { amountMinor: amountMinor.toString(), txHash });
      return;
    }

    // A bridge watcher must never hold or use a Stellar secret key. Leave the
    // invoice pending for an external signer and reviewed intent worker.
    logger.warn('bridge.external_signer_required', {
      invoiceId: invoice.id,
      to: invoice.destinationAddress,
      amount: centsToStellarAmount(invoice.amountMinor),
      evmTxHash: txHash,
      evmFrom: fromAddress,
    });
  },
};
