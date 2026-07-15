import {
  Account,
  BASE_FEE,
  Keypair,
  Operation,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { z } from 'zod';
import { env, SIGNED_ID_SECRET_VALUE } from '@/server/config/env';
import { AppError } from '@/server/lib/http';
import { fetchStellarToml } from '@/server/lib/stellarToml';
import { httpJson } from './http';

/**
 * SEP-10 Stellar Web Authentication.
 *
 * SEP-10 lets a wallet prove control of a Stellar account to an anchor in
 * exchange for a short-lived JWT. The JWT is then used as a bearer token for
 * authenticated SEP-24 / SEP-38 / SEP-12 calls.
 *
 * In this MVP the merchant signs the SEP-10 challenge **on the server** using
 * a server-held keypair. The keypair is derived deterministically from
 * `SIGNED_ID_SECRET` + the merchant's id, so we do not need a separate
 * `merchants.signing_key` column. (Production deployments would persist a
 * real `Keypair.random()` per merchant and store the secret encrypted.)
 *
 * Reference: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md
 */

const challengeResponseSchema = z.object({
  transaction: z.string(),
  network_passphrase: z.string().optional(),
});

const tokenResponseSchema = z.object({
  token: z.string(),
});

type CachedToken = { token: string; exp: number };
const tokenCache = new Map<string, CachedToken>();

function cacheKey(anchorDomain: string, account: string): string {
  return `${anchorDomain}::${account}`;
}

function getNetworkPassphraseFor(anchorDomain: string, fallback: string): string {
  // The TOML holds the anchor's network passphrase. For our MVP we use
  // whatever the current env says; the real anchor is authoritative.
  return fallback;
}

function deriveSigningKeypair(seed: string): Keypair {
  // Deterministic from secret + tag so we don't need a per-merchant column.
  // Real production: store actual Keypair.random() secret encrypted at rest.
  const { createHash } = require('node:crypto') as typeof import('node:crypto');
  const hash = createHash('sha256').update(seed).digest();
  return Keypair.fromRawEd25519Seed(hash);
}

/**
 * Build and sign a SEP-10 challenge transaction locally. The anchor will
 * accept this on `POST /auth` and return a JWT. We use the SEP-10
 * `ManageData` "auth" operation shape.
 */
export async function buildSep10ChallengeXdr(
  anchorDomain: string,
  account: string,
): Promise<string> {
  if (!StrKey.isValidEd25519PublicKey(account)) {
    throw new AppError('INVALID_INPUT', 'Invalid account public key', 400);
  }
  // Pull the home domain from the anchor's stellar.toml. If absent, we use
  // the anchor domain itself.
  const toml = await fetchStellarToml(anchorDomain).catch(() => null);
  const homeDomain = toml ? new URL(`https://${anchorDomain}`).host : anchorDomain;

  // Pull the account's CURRENT sequence number from Horizon. We previously
  // hard-coded "0", which only worked for fresh accounts. For any account
  // that has already transacted (e.g. our test customers who got funded
  // + set up a USDC trustline), Freighter re-binds the sequence to the
  // live account value at sign time, producing a signed XDR whose hash
  // differs from what the server computed at build time → 401. Reading
  // the current sequence keeps server and wallet in sync.
  const { Horizon } = await import('@stellar/stellar-sdk');
  const horizon = new Horizon.Server(
    env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
  );
  const acct = await horizon.loadAccount(account).catch(() => null);
  const sequence = acct ? acct.sequenceNumber() : '0';
  const sourceAccount = new Account(account, sequence);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphraseFor(anchorDomain, env.STELLAR_NETWORK_PASSPHRASE),
  })
    .addOperation(
      Operation.manageData({
        name: `${homeDomain} auth`,
        value: Buffer.from('"anchor.hub"', 'utf8'),
        source: account,
      }),
    )
    .setTimeout(300)
    .build();

  return tx.toXDR();
}

/**
 * Sign a SEP-10 challenge XDR with the merchant's server-side key.
 *
 * For the MVP we treat the merchant's public key as the `account` and use a
 * deterministic signing key derived from `SIGNED_ID_SECRET` for the testnet
 * flow. A real deployment would have the merchant sign via Freighter and
 * return the signed XDR to the server, which would then POST it to the anchor.
 */
export async function signSep10ChallengeLocally(
  anchorDomain: string,
  account: string,
): Promise<string> {
  const challengeXdr = await buildSep10ChallengeXdr(anchorDomain, account);
  const signer = deriveSigningKeypair(`${SIGNED_ID_SECRET_VALUE}::${account}`);
  // Parse the unsigned XDR, add our signature, return the signed XDR.
  const { TransactionBuilder } = await import('@stellar/stellar-sdk');
  const tx = TransactionBuilder.fromXDR(challengeXdr, env.STELLAR_NETWORK_PASSPHRASE);
  tx.sign(signer);
  return tx.toXDR();
}

/**
 * Submit the signed challenge to the anchor and cache the returned JWT.
 */
export async function getSep10Jwt(
  anchorDomain: string,
  account: string,
  webAuthEndpoint?: string,
): Promise<string> {
  if (anchorDomain === 'mock') return 'mock-jwt-dummy';
  const cached = tokenCache.get(cacheKey(anchorDomain, account));
  if (cached && cached.exp - 60_000 > Date.now()) {
    return cached.token;
  }
  const endpoint = webAuthEndpoint ?? `https://${anchorDomain}/auth`;
  const signedXdr = await signSep10ChallengeLocally(anchorDomain, account);
  const resp = await httpJson<{ token: string }>(endpoint, {
    method: 'POST',
    body: { transaction: signedXdr },
  });
  const { token } = tokenResponseSchema.parse(resp);
  // Token format is JWT. We do not parse the exp claim for MVP — the cache TTL
  // is short (5 min) and any 401 from a subsequent call forces a refresh.
  tokenCache.set(cacheKey(anchorDomain, account), {
    token,
    exp: Date.now() + 5 * 60 * 1000,
  });
  return token;
}

export function clearSep10Cache(): void {
  tokenCache.clear();
}

/** Used in tests. */
export { challengeResponseSchema };
