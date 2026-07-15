import { createHash, createVerify } from 'node:crypto';
import { AppError } from '@/server/lib/http';

/**
 * SEP-10 / SEP-12 / SEP-24 callback signature verification.
 *
 * The anchor signs a payload of the form `<timestamp>.<host>.<body>` and
 * places it in the `Signature` header as `t=<ts>, s=<base64>`. The signing
 * key is published in the anchor's `stellar.toml` as `SIGNING_KEY`.
 *
 * Reference: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#callback
 */

export type CallbackVerifyOptions = {
  signatureHeader: string | null;
  rawBody: string;
  host: string;
  signingKey: string;
  /** Max age of the `t` value in seconds. Default 120s. */
  maxAgeSec?: number;
};

export function verifyCallbackSignature(opts: CallbackVerifyOptions): boolean {
  if (!opts.signatureHeader) return false;
  const parsed = parseSignatureHeader(opts.signatureHeader);
  if (!parsed) return false;

  // Reject stale callbacks.
  const maxAge = opts.maxAgeSec ?? 120;
  const tsSec = Math.floor(Date.now() / 1000);
  if (Math.abs(tsSec - parsed.t) > maxAge) return false;

  const payload = `${parsed.t}.${opts.host}.${opts.rawBody}`;
  const verifier = createVerify('sha256');
  verifier.update(payload);
  verifier.end();
  try {
    return verifier.verify(opts.signingKey, parsed.s.toString('base64'));
  } catch {
    return false;
  }
}

function parseSignatureHeader(header: string): { t: number; s: Buffer } | null {
  const parts = header.split(',').map((p) => p.trim());
  let t: number | null = null;
  let sB64: string | null = null;
  for (const part of parts) {
    if (part.startsWith('t=')) {
      t = Number(part.slice(2));
      if (!Number.isFinite(t)) return null;
    } else if (part.startsWith('s=')) {
      sB64 = part.slice(2);
    }
  }
  if (t === null || !sB64) return null;
  return { t, s: Buffer.from(sB64, 'base64') };
}

/**
 * Compute the payload to sign on the *outbound* side. Useful for tests and
 * for the mock anchor server. The exact format is `<timestamp>.<host>.<body>`.
 */
export function buildCallbackPayload(timestamp: number, host: string, rawBody: string): string {
  return `${timestamp}.${host}.${rawBody}`;
}

/** Hash helper used in the merchant callback notification URL. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * High-level: verifies a callback and throws `AppError('UNAUTHORIZED', …)` on failure.
 * Use this from route handlers.
 */
export function assertCallbackSignature(opts: CallbackVerifyOptions): void {
  if (!verifyCallbackSignature(opts)) {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired anchor callback signature', 401);
  }
}
