import { describe, expect, it } from 'vitest';
import { AppError, fail, fromError, ok } from '@/server/lib/http';
import { calcOnTimeRate, formatCycleLabel, getDaysUntilDue, getScheduleStatus } from '@/server/lib/schedule';
import { buildSep7PayUri } from '@/server/lib/sep7';
import { phpToUsdc, stringToUsdc, usdcToPhp, usdcToString } from '@/server/lib/usdc';
import { encodeScheduleIdToMuxedId } from '@/server/lib/muxed';

// ─── getDaysUntilDue ───────────────────────────────────────────────────────────
describe('getDaysUntilDue', () => {
  it('returns positive days for future date', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(getDaysUntilDue(future)).toBe(5);
  });

  it('returns negative days for past date', () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    expect(getDaysUntilDue(past)).toBe(-3);
  });

  it('returns 0 for today', () => {
    expect(getDaysUntilDue(new Date())).toBe(0);
  });
});

// ─── formatCycleLabel ─────────────────────────────────────────────────────────
describe('formatCycleLabel', () => {
  it('formats year+month with zero padding', () => {
    expect(formatCycleLabel(2026, 6)).toBe('2026-06');
  });

  it('formats double-digit month correctly', () => {
    expect(formatCycleLabel(2026, 12)).toBe('2026-12');
  });

  it('formats January correctly', () => {
    expect(formatCycleLabel(2026, 1)).toBe('2026-01');
  });
});

// ─── getScheduleStatus ────────────────────────────────────────────────────────
describe('getScheduleStatus', () => {
  it('returns sent when sentAt is not null', () => {
    const past = new Date('2026-01-01');
    expect(getScheduleStatus(past, new Date())).toBe('sent');
  });

  it('returns overdue when due date is past and not sent', () => {
    const past = new Date('2020-01-01');
    expect(getScheduleStatus(past, null)).toBe('overdue');
  });

  it('returns upcoming when due date is future and not sent', () => {
    const future = new Date('2030-01-01');
    expect(getScheduleStatus(future, null)).toBe('upcoming');
  });
});

// ─── calcOnTimeRate ───────────────────────────────────────────────────────────
describe('calcOnTimeRate', () => {
  it('returns 100 when all sent', () => {
    expect(calcOnTimeRate([{ status: 'sent' }, { status: 'sent' }])).toBe(100);
  });

  it('returns 0 when none sent', () => {
    expect(calcOnTimeRate([{ status: 'upcoming' }, { status: 'overdue' }])).toBe(0);
  });

  it('returns correct percentage for mixed', () => {
    expect(
      calcOnTimeRate([
        { status: 'sent' },
        { status: 'overdue' },
        { status: 'sent' },
        { status: 'upcoming' },
      ]),
    ).toBe(50);
  });

  it('returns 0 for empty array', () => {
    expect(calcOnTimeRate([])).toBe(0);
  });
});

// ─── usdcToString ────────────────────────────────────────────────────────────
describe('usdcToString', () => {
  it('converts 1 USDC correctly', () => {
    expect(usdcToString(10_000_000n)).toBe('1.00');
  });

  it('converts 86.21 USDC correctly', () => {
    expect(usdcToString(862_100_000n)).toBe('86.21');
  });

  it('converts 0 USDC', () => {
    expect(usdcToString(0n)).toBe('0.00');
  });
});

// ─── phpToUsdc ────────────────────────────────────────────────────────────────
describe('phpToUsdc', () => {
  it('converts ₱5800 to 100 USDC', () => {
    expect(phpToUsdc(5800)).toBe(1_000_000_000n);
  });

  it('converts ₱58 to 1 USDC', () => {
    expect(phpToUsdc(58)).toBe(10_000_000n);
  });
});

// ─── usdcToPhp ───────────────────────────────────────────────────────────────
describe('usdcToPhp', () => {
  it('converts 1 USDC to ₱58', () => {
    expect(usdcToPhp(10_000_000n)).toBe('₱58.00');
  });

  it('result contains peso symbol', () => {
    expect(usdcToPhp(86_210_000n)).toContain('₱');
  });
});

// ─── stringToUsdc ────────────────────────────────────────────────────────────
describe('stringToUsdc', () => {
  it('converts decimal string to bigint', () => {
    expect(stringToUsdc('86.21')).toBe(862_100_000n);
  });

  it('converts whole number string', () => {
    expect(stringToUsdc('100')).toBe(1_000_000_000n);
  });

  it('converts 1.00 correctly', () => {
    expect(stringToUsdc('1.00')).toBe(10_000_000n);
  });
});

// ─── buildSep7PayUri ─────────────────────────────────────────────────────────
describe('buildSep7PayUri', () => {
  it('builds basic SEP-7 URI', () => {
    const uri = buildSep7PayUri({
      destination: 'GABCD',
      amount: '86.21',
      assetCode: 'USDC',
      assetIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    });
    expect(uri).toContain('web+stellar:pay?');
    expect(uri).toContain('destination=GABCD');
    expect(uri).toContain('amount=86.21');
    expect(uri).toContain('asset_code=USDC');
  });

  it('includes memo when provided', () => {
    const uri = buildSep7PayUri({
      destination: 'GABCD',
      amount: '10.00',
      assetCode: 'USDC',
      assetIssuer: 'GBBD',
      memo: 'RC-test-123',
      memoType: 'text',
    });
    expect(uri).toContain('memo=RC-test-123');
    expect(uri).toContain('memo_type=text');
  });

  it('omits memo when not provided', () => {
    const uri = buildSep7PayUri({
      destination: 'GABCD',
      amount: '10.00',
      assetCode: 'USDC',
      assetIssuer: 'GBBD',
    });
    expect(uri).not.toContain('memo=');
  });
});

// ─── encodeScheduleIdToMuxedId ───────────────────────────────────────────────
describe('encodeScheduleIdToMuxedId', () => {
  it('returns a bigint', () => {
    expect(typeof encodeScheduleIdToMuxedId('sched-nanay-jun')).toBe('bigint');
  });

  it('is deterministic', () => {
    const id = 'sched-test-123';
    expect(encodeScheduleIdToMuxedId(id)).toBe(encodeScheduleIdToMuxedId(id));
  });

  it('produces different IDs for different inputs', () => {
    expect(encodeScheduleIdToMuxedId('sched-nanay-jun')).not.toBe(
      encodeScheduleIdToMuxedId('sched-bunso-jun'),
    );
  });
});

// ─── AppError ────────────────────────────────────────────────────────────────
describe('AppError', () => {
  it('has status property not statusCode', () => {
    const err = new AppError('NOT_FOUND', 'Not found', 404);
    expect(err.status).toBe(404);
    expect((err as unknown as Record<string, unknown>).statusCode).toBeUndefined();
  });

  it('has code property', () => {
    const err = new AppError('INVALID_INPUT', 'Bad input');
    expect(err.code).toBe('INVALID_INPUT');
  });

  it('defaults status to 400', () => {
    const err = new AppError('INVALID_INPUT', 'Bad input');
    expect(err.status).toBe(400);
  });
});

// ─── ok / fail / fromError ───────────────────────────────────────────────────
describe('ok / fail / fromError helpers', () => {
  it('ok wraps data correctly', () => {
    const res = ok({ id: '1' });
    expect(res.status).toBe(200);
  });

  it('fail returns error envelope with correct status', () => {
    const res = fail('NOT_FOUND', 'Not found', 404);
    expect(res.status).toBe(404);
  });

  it('fromError handles AppError', () => {
    const err = new AppError('FORBIDDEN', 'Forbidden', 403);
    const res = fromError(err);
    expect(res.status).toBe(403);
  });

  it('fromError handles unknown error as 500', () => {
    const res = fromError(new Error('unexpected'));
    expect(res.status).toBe(500);
  });
});
