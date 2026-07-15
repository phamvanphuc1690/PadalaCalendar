import { Keypair } from '@stellar/stellar-sdk';
import { and, eq } from 'drizzle-orm';
import { env } from '@/server/config/env';
import { db } from '@/server/db/client';
import { invoices } from '@/server/db/schema/invoices';
import { paymentIntents } from '@/server/db/schema/paymentIntents';
import { type EvmLog, baseUnitsToMinor, parseFromAddress, parseTransferAmount } from '@/server/evm/rpc';
import { logger } from '@/server/lib/logger';
import { usdcAsset } from '@/server/stellar/network';
import { buildPaymentXdr, parseTransaction, submitTransaction } from '@/server/stellar/xdr';
import { invoiceService } from './invoice.service';

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

    if (!env.HUB_STELLAR_SECRET) {
      logger.error('bridge.no_hub_stellar_secret');
      return;
    }

    const hubKeypair = Keypair.fromSecret(env.HUB_STELLAR_SECRET);
    const stellarAmount = centsToStellarAmount(invoice.amountMinor);

    logger.info('bridge.sending_stellar', {
      invoiceId: invoice.id,
      to: invoice.destinationAddress,
      amount: stellarAmount,
    });

    // Build, sign, and submit the Stellar payment from Hub → Merchant.
    let stellarTxHash: string;
    try {
      const unsignedXdr = await buildPaymentXdr({
        sourcePublicKey: hubKeypair.publicKey(),
        destinationPublicKey: invoice.destinationAddress,
        asset: usdcAsset(),
        amount: stellarAmount,
        memo: {
          type: 'text',
          value: invoice.id.replace(/-/g, '').slice(0, 28),
        },
      });
      const tx = parseTransaction(unsignedXdr);
      tx.sign(hubKeypair);
      const result = await submitTransaction(tx.toXDR());
      stellarTxHash = result.hash;
    } catch (err) {
      logger.error('bridge.stellar_submit_failed', { invoiceId: invoice.id, err: String(err) });
      return;
    }

    logger.info('bridge.stellar_submitted', { invoiceId: invoice.id, stellarTxHash });

    // Record the bridged payment and mark the invoice as paid.
    await invoiceService.recordPayment({
      invoiceId: invoice.id,
      txHash: stellarTxHash,
      paymentId: txHash, // Base tx hash as the "payment ID" reference
      from: fromAddress,
      amount: invoice.amountMinor,
      chain: 'base',
      evmTxHash: txHash,
      evmFromAddress: fromAddress,
    });
  },
};
