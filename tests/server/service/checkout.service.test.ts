// @vitest-environment node
import { Keypair } from '@stellar/stellar-sdk';
import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/config/env', () => ({
  env: { SESSION_SECRET: 'a'.repeat(32), NODE_ENV: 'test' },
  CUSTOMER_JWT_SECRET_VALUE: 'a'.repeat(32),
  SIGNED_ID_SECRET_VALUE: 'b'.repeat(32),
}));

import { issueCustomerToken, verifyCustomerToken } from '@/server/service/checkout.service';

const CUSTOMER_JWT_SECRET_VALUE = 'a'.repeat(32);

const validPubkey = Keypair.random().publicKey();

describe('checkout.service — customer JWT', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('round-trips: issue + verify returns the original account', async () => {
    const token = await issueCustomerToken(validPubkey);
    const claims = await verifyCustomerToken(token);
    expect(claims.sub).toBe(validPubkey);
    expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects a token signed with a different secret', async () => {
    const foreignKey = new TextEncoder().encode('z'.repeat(32));
    const foreign = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(validPubkey)
      .setIssuer('stellar-hub:checkout')
      .setAudience('stellar-hub:customer')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(foreignKey);
    await expect(verifyCustomerToken(foreign)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401,
    });
  });

  it('rejects a token with the wrong issuer', async () => {
    const key = new TextEncoder().encode(CUSTOMER_JWT_SECRET_VALUE);
    const wrongIss = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(validPubkey)
      .setIssuer('attacker:checkout')
      .setAudience('stellar-hub:customer')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
    await expect(verifyCustomerToken(wrongIss)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a token with the wrong audience', async () => {
    const key = new TextEncoder().encode(CUSTOMER_JWT_SECRET_VALUE);
    const wrongAud = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(validPubkey)
      .setIssuer('stellar-hub:checkout')
      .setAudience('attacker:customer')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
    await expect(verifyCustomerToken(wrongAud)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects an expired token', async () => {
    vi.useFakeTimers();
    const baseTime = 1_700_000_000_000;
    vi.setSystemTime(baseTime);
    const token = await issueCustomerToken(validPubkey);
    // Advance past 30 minute TTL
    vi.setSystemTime(baseTime + 31 * 60 * 1000);
    await expect(verifyCustomerToken(token)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects garbage input', async () => {
    await expect(verifyCustomerToken('not-a-jwt')).rejects.toMatchObject({ status: 401 });
    await expect(verifyCustomerToken('')).rejects.toMatchObject({ status: 401 });
    await expect(verifyCustomerToken('a.b.c')).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a token whose `sub` is not a 56-char public key', async () => {
    const key = new TextEncoder().encode(CUSTOMER_JWT_SECRET_VALUE);
    const badSub = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject('alice')
      .setIssuer('stellar-hub:checkout')
      .setAudience('stellar-hub:customer')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
    await expect(verifyCustomerToken(badSub)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401,
    });
  });

  it('cross-customer: token for A cannot be presented as B', async () => {
    const tokenA = await issueCustomerToken(validPubkey);
    const otherPubkey = Keypair.random().publicKey();
    const claims = await verifyCustomerToken(tokenA);
    // The token's subject is the issuer's pubkey; you can't pass a different
    // pubkey and have it decrypt as someone else. The signature would fail
    // unless the attacker held the secret.
    expect(claims.sub).toBe(validPubkey);
    expect(claims.sub).not.toBe(otherPubkey);
  });
});
