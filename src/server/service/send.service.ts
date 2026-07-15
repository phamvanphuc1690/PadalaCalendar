import { Keypair } from '@stellar/stellar-sdk';
import { env } from '@/server/config/env';
import { isMinorString } from '@/server/lib/bigint';
import { AppError } from '@/server/lib/http';
import { logger } from '@/server/lib/logger';
import { resolveFederation } from '@/server/stellar/federation';
import { usdcAsset, usdcCode, usdcIssuer } from '@/server/stellar/network';
import { buildPaymentXdr, parseTransaction, submitTransaction } from '@/server/stellar/xdr';

/**
 * Send USDC (or any asset) from the merchant's wallet to an address.
 *
 * Flow:
 *   1. `build({ destination, amount, memo? })` resolves the destination
 *      (SEP-2 federation name or raw `G…` public key), then builds an
 *      unsigned payment XDR. The merchant signs it with Freighter.
 *   2. `submit({ signedXdr })` verifies the merchant's signature is present
 *      on the transaction, submits to Horizon, and returns the tx hash.
 *
 * For MVP we do not support `path_payment` (cross-asset) — the merchant can
 * only send USDC. Use the `convert` flow for token swaps.
 */

const DEFAULT_TIMEOUT_SEC = 180;

export type BuildPaymentInput = {
  destination: string;
  amount: string;
  memo?: { type: 'text' | 'id' | 'hash'; value: string };
  timeoutSec?: number;
};

export type BuildPaymentResult = {
  xdr: string;
  sourceAccount: string;
  destinationAccount: string;
  memo: { type: string; value: string } | null;
  amount: string;
  asset: { code: string; issuer: string };
  expiresAt: string;
};

export const sendService = {
  /**
   * Build an unsigned USDC payment XDR. The merchant's pubkey is the source;
   * the destination is resolved through SEP-2 if it looks like a federation
   * name.
   */
  async build(publicKey: string, input: BuildPaymentInput): Promise<BuildPaymentResult> {
    if (!isMinorString(input.amount)) {
      throw new AppError(
        'INVALID_INPUT',
        'amount must be a non-negative integer string (minor units)',
        400,
      );
    }
    const resolved = await resolveFederation(input.destination);
    const dest = resolved.account;
    if (dest === publicKey) {
      throw new AppError('INVALID_INPUT', 'Cannot send to yourself', 400);
    }
    const asset = usdcAsset();
    const memo =
      input.memo ??
      (resolved.memoType && resolved.memo
        ? { type: resolved.memoType, value: resolved.memo }
        : undefined);
    const xdr = await buildPaymentXdr({
      sourcePublicKey: publicKey,
      destinationPublicKey: dest,
      asset,
      amount: input.amount,
      memo,
      timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
    });
    return {
      xdr,
      sourceAccount: publicKey,
      destinationAccount: dest,
      memo: memo ? { type: memo.type, value: memo.value } : null,
      amount: input.amount,
      asset: { code: usdcCode(), issuer: usdcIssuer() },
      expiresAt: new Date(
        Date.now() + (input.timeoutSec ?? DEFAULT_TIMEOUT_SEC) * 1000,
      ).toISOString(),
    };
  },

  /**
   * Submit a signed payment XDR. The transaction must be signed by the
   * merchant (`ctx.publicKey`). We verify by inspecting the first signature
   * hint and the signature's recoverability via the Stellar SDK.
   */
  async submit(publicKey: string, signedXdr: string): Promise<{ txHash: string; ledger: number }> {
    const tx = parseTransaction(signedXdr);
    const txHash = tx.hash();
    // Verify the merchant's signature is on this transaction.
    const kp = Keypair.fromPublicKey(publicKey);
    const expectedHint = Buffer.from(publicKey.slice(-2), 'base64');
    const hasValidSig = tx.signatures.some((sig) => {
      try {
        const hint = sig.hint();
        if (Buffer.compare(hint, expectedHint) !== 0) return false;
        return kp.verify(txHash, sig.signature());
      } catch {
        return false;
      }
    });
    if (!hasValidSig) {
      throw new AppError('UNAUTHORIZED', 'Transaction is not signed by the merchant', 401);
    }
    const result = await submitTransaction(signedXdr);
    logger.info('send.submitted', { txHash: result.hash, ledger: result.ledger });
    return { txHash: result.hash, ledger: result.ledger };
  },
};
