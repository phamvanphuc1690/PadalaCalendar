// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  assertCallbackSignature,
  buildCallbackPayload,
  verifyCallbackSignature,
} from '@/server/anchor/callback';

describe('anchor callback signature', () => {
  // For these tests we don't need to actually sign — we only validate the
  // shape and timestamp logic in `verifyCallbackSignature`. Real signing
  // happens in the mock anchor server and is covered end-to-end by the
  // `npm run dev` smoke test in the README.

  it('returns false for missing signature', () => {
    expect(
      verifyCallbackSignature({
        signatureHeader: null,
        rawBody: '{}',
        host: 'x',
        signingKey: 'GB',
      }),
    ).toBe(false);
  });

  it('returns false for malformed signature header', () => {
    expect(
      verifyCallbackSignature({
        signatureHeader: 'not-a-header',
        rawBody: '{}',
        host: 'x',
        signingKey: 'GB',
      }),
    ).toBe(false);
  });

  it('returns false for missing t=', () => {
    expect(
      verifyCallbackSignature({
        signatureHeader: 's=abc',
        rawBody: '{}',
        host: 'x',
        signingKey: 'GB',
      }),
    ).toBe(false);
  });

  it('returns false for missing s=', () => {
    expect(
      verifyCallbackSignature({
        signatureHeader: 't=1700000000',
        rawBody: '{}',
        host: 'x',
        signingKey: 'GB',
      }),
    ).toBe(false);
  });

  it('returns false for stale timestamp (10 min old)', () => {
    const ts = Math.floor(Date.now() / 1000) - 600;
    const header = `t=${ts}, s=AAAA`;
    expect(
      verifyCallbackSignature({
        signatureHeader: header,
        rawBody: '{}',
        host: 'x',
        signingKey: 'GB',
      }),
    ).toBe(false);
  });

  it('returns false for future timestamp (>2 min ahead)', () => {
    const ts = Math.floor(Date.now() / 1000) + 600;
    const header = `t=${ts}, s=AAAA`;
    expect(
      verifyCallbackSignature({
        signatureHeader: header,
        rawBody: '{}',
        host: 'x',
        signingKey: 'GB',
      }),
    ).toBe(false);
  });

  it('does not throw on bad signature bytes', () => {
    const ts = Math.floor(Date.now() / 1000);
    const header = `t=${ts}, s=${Buffer.alloc(64, 0).toString('base64')}`;
    // Returns false (signature doesn't verify) but doesn't throw.
    expect(
      verifyCallbackSignature({
        signatureHeader: header,
        rawBody: '{}',
        host: 'x',
        signingKey: 'GB',
      }),
    ).toBe(false);
  });

  it('assertCallbackSignature throws AppError on failure', () => {
    expect(() =>
      assertCallbackSignature({
        signatureHeader: null,
        rawBody: '{}',
        host: 'x',
        signingKey: 'GB',
      }),
    ).toThrow();
  });

  it('buildCallbackPayload concatenates t.host.body', () => {
    expect(buildCallbackPayload(1700000000, 'anchor.example.com', '{"x":1}')).toBe(
      '1700000000.anchor.example.com.{"x":1}',
    );
  });
});
