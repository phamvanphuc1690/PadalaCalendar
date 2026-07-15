// @vitest-environment node

import { Keypair } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { receiveService } from '@/server/service/receive.service';

const VALID_KEY = Keypair.random().publicKey();

describe('receiveService.build', () => {
  it('builds a SEP-7 web+stellar:pay URI with amount and memo', () => {
    const result = receiveService.build(VALID_KEY, {
      amount: '5000000',
      memo: { type: 'text', value: 'Table 4' },
    });
    expect(result.destination).toBe(VALID_KEY);
    expect(result.amount).toBe('5000000');
    expect(result.uri.startsWith('web+stellar:pay?')).toBe(true);
    expect(result.uri).toContain('destination=');
    expect(result.uri).toContain('amount=5000000');
    expect(result.uri).toContain('asset_code=USDC');
    expect(result.uri).toContain('memo=Table+4');
    expect(result.uri).toContain('memo_type=text');
  });

  it('omits issuer for native asset code (defensive)', () => {
    const result = receiveService.build(VALID_KEY, { amount: '1000000' });
    expect(result.uri).toContain('asset_code=');
  });

  it('rejects non-minor amount strings', () => {
    expect(() => receiveService.build(VALID_KEY, { amount: 'abc' })).toThrowError();
    expect(() => receiveService.build(VALID_KEY, { amount: '-1' })).toThrowError();
  });
});
