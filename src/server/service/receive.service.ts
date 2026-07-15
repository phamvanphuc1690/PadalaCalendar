import { isMinorString } from '@/server/lib/bigint';
import { AppError } from '@/server/lib/http';
import { usdcCode, usdcIssuer } from '@/server/stellar/network';

/**
 * Receive v2 — generate a fixed-amount payment request (SEP-7).
 *
 * A SEP-7 `web+stellar:pay` URI is a standardised deep link wallets
 * (Freighter, Lobstr, Albedo, ...) recognise. The customer scans the
 * QR or taps the link and their wallet pre-fills the payment screen
 * with the destination, amount, asset, and memo.
 *
 * Reference: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md
 */

export type BuildReceiveRequestInput = {
  amount: string;
  memo?: { type: 'text' | 'id' | 'hash'; value: string };
  /** Domain the wallet resolves to (e.g. `payhub.app`). */
  origin?: string;
  /** Optional message shown in the wallet confirmation UI. */
  msg?: string;
};

export type BuildReceiveRequestResult = {
  uri: string;
  qrPayload: string;
  destination: string;
  amount: string;
  asset: { code: string; issuer: string };
  memo: { type: string; value: string } | null;
};

export const receiveService = {
  build(publicKey: string, input: BuildReceiveRequestInput): BuildReceiveRequestResult {
    if (!isMinorString(input.amount)) {
      throw new AppError('INVALID_INPUT', 'amount must be a non-negative integer string', 400);
    }
    const params = new URLSearchParams();
    params.set('destination', publicKey);
    params.set('amount', input.amount);
    params.set('asset_code', usdcCode());
    if (usdcCode() !== 'XLM') {
      params.set('asset_issuer', usdcIssuer());
    }
    if (input.memo) {
      params.set('memo', input.memo.value);
      params.set('memo_type', input.memo.type);
    }
    if (input.msg) params.set('msg', input.msg);
    if (input.origin) params.set('origin', input.origin);
    const uri = `web+stellar:pay?${params.toString()}`;
    return {
      uri,
      qrPayload: uri,
      destination: publicKey,
      amount: input.amount,
      asset: { code: usdcCode(), issuer: usdcIssuer() },
      memo: input.memo ? { type: input.memo.type, value: input.memo.value } : null,
    };
  },
};
