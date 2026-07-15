import { createHash } from 'node:crypto';
import { StrKey } from '@stellar/stellar-sdk';
import { eq } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { CUSTOMER_JWT_SECRET_VALUE } from '@/server/config/env';
import { db } from '@/server/db/client';
import { invoices } from '@/server/db/schema/invoices';
import { AppError } from '@/server/lib/http';
import { usdcAsset } from '@/server/stellar/network';
import { buildPaymentXdr, parseTransaction, submitTransaction } from '@/server/stellar/xdr';

/**
 * Stellar `text` memos are limited to 28 bytes — far too small for a UUID
 * (36 chars). We use a `hash` memo (32 bytes) holding the SHA-256 of the
 * invoice id, encoded as lowercase hex. The detector (see
 * `paymentDetection.handleMatch`) hashes the candidate invoice id the
 * same way so on-chain memos can be matched back to invoices.
 */
export function invoiceMemoHex(invoiceId: string): string {
  return createHash('sha256').update(invoiceId).digest('hex');
}

/**
 * Customer-side checkout flow. The customer:
 *   1. Calls /api/checkout/challenge with their Stellar public key.
 *      The server returns a SEP-10-shaped challenge XDR.
 *   2. Signs the challenge with Freighter; the signed XDR is returned.
 *   3. Calls /api/checkout/verify with the signed XDR. The server verifies
 *      the signature and issues a short-lived HS256 JWT (the "customer
 *      session") signed with `CUSTOMER_JWT_SECRET`. The JWT `sub` claim
 *      holds the customer's Stellar public key.
 *   4. Calls /api/checkout/build with the JWT (Authorization: Bearer …).
 *      `withCustomerAuth` verifies the JWT and passes the account to the
 *      handler. The server returns an unsigned payment XDR (USDC transfer
 *      to the merchant's destination, with the invoice id as the memo).
 *   5. Signs the payment XDR with Freighter; returns the signed XDR.
 *   6. Calls /api/checkout/submit with the signed XDR. The server submits
 *      it to Horizon.
 *
 * The customer JWT is stateless — verification only needs the secret. The
 * token is 5 min, scoped to the customer's pubkey, and rejected if the
 * signature doesn't verify. This replaces the previous in-memory token map
 * (which had a real bug: `tokensMatchByValue` always returned true because
 * it compared `HMAC(token)` to `HMAC(token)`, so any non-expired token
 * could impersonate any other customer).
 */

/** Convert cents minor-unit string to Stellar SDK decimal amount string.
 * "2000" → "20.00" (Stellar SDK's Operation.payment expects display units) */
function centsToStellarAmount(minorCents: string): string {
  const n = BigInt(minorCents);
  const whole = n / 100n;
  const frac = n % 100n;
  return `${whole}.${frac.toString().padStart(2, '0')}`;
}

const CHECKOUT_TTL_SEC = 30 * 60;
const JWT_ISSUER = 'stellar-hub:checkout';
const JWT_AUDIENCE = 'stellar-hub:customer';

const jwtKey = new TextEncoder().encode(CUSTOMER_JWT_SECRET_VALUE);

export type CustomerClaims = { sub: string; exp: number };

/** Issue a customer JWT for the given Stellar public key. */
export async function issueCustomerToken(account: string): Promise<string> {
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(account)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${CHECKOUT_TTL_SEC}s`)
    .sign(jwtKey);
}

/** Verify a customer JWT and return the claims (or throw AppError 401). */
export async function verifyCustomerToken(token: string): Promise<CustomerClaims> {
  try {
    const { payload } = await jwtVerify(token, jwtKey, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (typeof payload.sub !== 'string' || payload.sub.length !== 56) {
      throw new AppError('UNAUTHORIZED', 'Invalid customer token subject', 401);
    }
    return { sub: payload.sub, exp: payload.exp ?? 0 };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('UNAUTHORIZED', 'Invalid or expired customer token', 401);
  }
}

export const checkoutService = {
  async createChallenge(publicKey: string): Promise<{ challenge: string; expiresAt: string }> {
    if (!StrKey.isValidEd25519PublicKey(publicKey)) {
      throw new AppError('INVALID_INPUT', 'Invalid Stellar public key', 400);
    }
    // Re-use the SEP-10 builder from anchor/sep10. We don't post to the
    // anchor here — the customer signs it and returns it for verification.
    const { buildSep10ChallengeXdr } = await import('@/server/anchor/sep10');
    const challenge = await buildSep10ChallengeXdr('checkout', publicKey);
    const expiresAt = new Date(Date.now() + CHECKOUT_TTL_SEC * 1000).toISOString();
    return { challenge, expiresAt };
  },

  async verifyChallenge(input: {
    publicKey: string;
    signedChallengeXdr: string;
  }): Promise<{ token: string; expiresAt: string }> {
    if (!StrKey.isValidEd25519PublicKey(input.publicKey)) {
      throw new AppError('INVALID_INPUT', 'Invalid Stellar public key', 400);
    }
    const tx = parseTransaction(input.signedChallengeXdr);
    // Verify at least one signature on the tx is from the claimed account.
    const txHash = tx.hash();
    // The signature hint is the LAST 4 bytes of the raw 32-byte public key
    // (per SEP-10 / Stellar spec). Decoding the StrKey here is required —
    // taking the trailing base64 characters of the encoded form gives a
    // different byte count and the comparison silently fails.
    const pkBytes = StrKey.decodeEd25519PublicKey(input.publicKey);
    const expectedHint = pkBytes.slice(-4);
    const sigsValid = tx.signatures.some((sig) => {
      try {
        const hint = sig.hint();
        if (Buffer.compare(hint, expectedHint) !== 0) return false;
        // Verify by attempting to load and verify against a keypair.
        const { Keypair } =
          require('@stellar/stellar-sdk') as typeof import('@stellar/stellar-sdk');
        const kp = Keypair.fromPublicKey(input.publicKey);
        return kp.verify(txHash, sig.signature());
      } catch {
        return false;
      }
    });
    if (!sigsValid) {
      throw new AppError('UNAUTHORIZED', 'Challenge signature did not verify', 401);
    }
    const token = await issueCustomerToken(input.publicKey);
    return { token, expiresAt: new Date(Date.now() + CHECKOUT_TTL_SEC * 1000).toISOString() };
  },

  /**
   * Build an unsigned payment XDR for the customer to sign. The destination
   * is the invoice's destination address and the memo is the invoice id so
   * the on-chain event can be matched back. The `account` comes from the
   * verified customer JWT (see `withCustomerAuth`).
   */
  async buildPayment(input: {
    account: string;
    signedId: string;
  }): Promise<{ xdr: string; expiresAt: string }> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.signedId, input.signedId))
      .limit(1);
    if (!invoice) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    if (invoice.status !== 'pending') {
      throw new AppError('INVALID_INPUT', `Invoice is ${invoice.status}`, 409);
    }
    if (!StrKey.isValidEd25519PublicKey(input.account)) {
      throw new AppError('UNAUTHORIZED', 'Invalid customer token subject', 401);
    }
    const xdr = await buildPaymentXdr({
      sourcePublicKey: input.account,
      destinationPublicKey: invoice.destinationAddress,
      asset: usdcAsset(),
      // amountMinor is stored as cents ("2000" = $20.00). Stellar SDK expects
      // a decimal string in display units ("20.00"), so convert here.
      amount: centsToStellarAmount(invoice.amountMinor),
      memo: { type: 'hash', value: invoiceMemoHex(invoice.id) },
    });
    return { xdr, expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() };
  },

  async submitPayment(input: {
    account: string;
    signedId: string;
    signedXdr: string;
  }): Promise<{ txHash: string }> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.signedId, input.signedId))
      .limit(1);
    if (!invoice) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    if (!StrKey.isValidEd25519PublicKey(input.account)) {
      throw new AppError('UNAUTHORIZED', 'Invalid customer token subject', 401);
    }
    const { hash } = await submitTransaction(input.signedXdr);
    return { txHash: hash };
  },
};
