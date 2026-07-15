// @vitest-environment node

import { Keypair } from '@stellar/stellar-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveFederation } from '@/server/stellar/federation';

const originalFetch = globalThis.fetch;
const VALID_KEY = Keypair.random().publicKey();
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('resolveFederation', () => {
  it('returns the pubkey when given a valid Stellar address', async () => {
    const result = await resolveFederation(VALID_KEY);
    expect(result.account).toBe(VALID_KEY);
    expect(result.memo).toBeUndefined();
  });

  it('rejects invalid pubkey / unknown name format', async () => {
    await expect(resolveFederation('not-a-key')).rejects.toThrowError();
  });

  it('looks up a name*domain federation entry and returns the account', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ account: VALID_KEY, memo_type: 'text', memo: 'hello' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ) as unknown as typeof fetch;
    const result = await resolveFederation('alice*example.com');
    expect(result.account).toBe(VALID_KEY);
    expect(result.memoType).toBe('text');
    expect(result.memo).toBe('hello');
  });

  it('handles a 404 from the federation server', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('not found', { status: 404 }),
    ) as unknown as typeof fetch;
    let caught: unknown = null;
    try {
      await resolveFederation('ghost*example.com');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect((caught as { code?: string }).code).toBe('NOT_FOUND');
  });
});
