import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { isMinorString } from '@/server/lib/bigint';
import { AppError } from '@/server/lib/http';
import { logger } from '@/server/lib/logger';
import { usdcAsset, usdcCode, usdcIssuer } from '@/server/stellar/network';
import { getSwapQuote, type SwapQuote } from '@/server/stellar/swap';
import { buildPaymentXdr, parseTransaction, submitTransaction } from '@/server/stellar/xdr';

/**
 * Stellar DEX swap. The merchant signs and submits a
 * `path_payment_strict_send` XDR that trades USDC for a chosen asset
 * (XLM, or any other on-chain asset the merchant's account has a
 * trustline for).
 *
 * Flow:
 *   1. `quote({ destinationAsset, amount, slippageBps })` calls Horizon's
 *      `/paths/strict-send` and returns the best path + a
 *      `suggestedMinDestination` (already with slippage applied).
 *   2. `build(publicKey, quote)` returns an unsigned `path_payment_strict_send`
 *      XDR for the merchant to sign.
 *   3. `submit(publicKey, signedXdr)` verifies the signature, submits to
 *      Horizon, returns the hash.
 */

export type QuoteConvertInput = {
  destinationAssetCode: string;
  destinationAssetIssuer: string | null | undefined; // null for native (XLM)
  amount: string; // source amount in minor units
  slippageBps?: number;
};

export type ConvertQuote = SwapQuote & {
  sourceAsset: { code: string; issuer: string };
  slippageBps: number;
};

export const convertService = {
  async quote(publicKey: string, input: QuoteConvertInput): Promise<ConvertQuote> {
    if (!isMinorString(input.amount)) {
      throw new AppError('INVALID_INPUT', 'amount must be a non-negative integer string', 400);
    }
    if (BigInt(input.amount) <= 0n) {
      throw new AppError('INVALID_INPUT', 'amount must be > 0', 400);
    }
    const sourceAsset = usdcAsset();
    const { Asset } = await import('@stellar/stellar-sdk');
    const destinationAsset =
      input.destinationAssetIssuer && input.destinationAssetIssuer.length > 0
        ? new Asset(input.destinationAssetCode, input.destinationAssetIssuer)
        : Asset.native();
    const slippageBps = input.slippageBps ?? 50;
    const quote = await getSwapQuote(
      {
        sourceAsset,
        sourceAmount: input.amount,
        destinationAsset,
        destinationAccount: publicKey,
      },
      { slippageBps },
    );
    return {
      ...quote,
      sourceAsset: { code: usdcCode(), issuer: usdcIssuer() },
      slippageBps,
    };
  },

  async build(publicKey: string, quote: ConvertQuote): Promise<{ xdr: string; expiresAt: string }> {
    // Re-build the asset objects from the quote shape. The path is sent
    // through the SDK's path_payment_strict_send helper below.
    const sourceAsset = usdcAsset();
    const { Asset, Operation, TransactionBuilder } = await import('@stellar/stellar-sdk');
    const destinationAsset = quote.destinationAsset.isNative()
      ? Asset.native()
      : new Asset(quote.destinationAsset.getCode(), quote.destinationAsset.getIssuer());
    const { getHorizonUrl, getNetworkPassphrase } = await import('@/server/stellar/network');
    // Fetch the source sequence for the merchant.
    const horizonUrl = getHorizonUrl();
    const acctRes = await fetch(`${horizonUrl.replace(/\/$/, '')}/accounts/${publicKey}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (acctRes.status === 404) {
      throw new AppError('NOT_FOUND', 'Source account not funded on network', 404);
    }
    if (!acctRes.ok) {
      throw new AppError('INTERNAL', `Horizon loadAccount returned ${acctRes.status}`, 502);
    }
    const acct = (await acctRes.json()) as { sequence: string };
    const { BASE_FEE, Account } = await import('@stellar/stellar-sdk');
    const account = new Account(publicKey, acct.sequence);
    const path = quote.path.map((hop) =>
      hop.asset_type === 'native'
        ? Asset.native()
        : new Asset(hop.asset_code ?? '', hop.asset_issuer ?? ''),
    );
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: getNetworkPassphrase(),
    })
      .addOperation(
        Operation.pathPaymentStrictSend({
          sendAsset: sourceAsset,
          sendAmount: quote.sourceAmount,
          destination: publicKey,
          destAsset: destinationAsset,
          destMin: quote.suggestedMinDestination,
          path,
        }),
      )
      .setTimeout(180)
      .build();
    return {
      xdr: tx.toXDR(),
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    };
  },

  async submit(publicKey: string, signedXdr: string): Promise<{ txHash: string; ledger: number }> {
    const tx = parseTransaction(signedXdr);
    const txHash = tx.hash();
    const kp = Keypair.fromPublicKey(publicKey);
    // The signature hint is the last 4 bytes of the decoded 32-byte public
    // key, not the trailing base64 characters of the encoded form.
    const pkBytes = StrKey.decodeEd25519PublicKey(publicKey);
    const expectedHint = pkBytes.slice(-4);
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
    logger.info('convert.submitted', { txHash: result.hash, ledger: result.ledger });
    return { txHash: result.hash, ledger: result.ledger };
  },
};
