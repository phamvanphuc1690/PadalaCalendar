import { describe, expect, it } from 'vitest';
import { signInvoiceId, verifyInvoiceId } from '@/server/lib/signedId';

describe('signedId', () => {
  it('round-trips', () => {
    const id = '0192a0b4-7c9e-7000-8000-000000000000';
    const signed = signInvoiceId(id);
    expect(signed.startsWith('v1.')).toBe(true);
    const verified = verifyInvoiceId(signed);
    expect(verified?.id).toBe(id);
  });

  it('rejects tampered id', () => {
    const signed = signInvoiceId('0192a0b4-7c9e-7000-8000-000000000000');
    // Replace the id portion but keep the sig.
    const tampered = `v1.aGVsbG8=${signed.slice(signed.lastIndexOf('.'))}`;
    expect(verifyInvoiceId(tampered)).toBeNull();
  });

  it('rejects tampered sig', () => {
    const signed = signInvoiceId('0192a0b4-7c9e-7000-8000-000000000000');
    const idx = signed.lastIndexOf('.');
    const tampered = `${signed.slice(0, idx)}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    expect(verifyInvoiceId(tampered)).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(verifyInvoiceId('not-a-signed-id')).toBeNull();
    expect(verifyInvoiceId('')).toBeNull();
    expect(verifyInvoiceId('v0.something.sig')).toBeNull();
  });
});
