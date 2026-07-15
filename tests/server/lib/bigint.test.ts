import { describe, expect, it } from 'vitest';
import {
  addMinor,
  compareMinor,
  formatMinor,
  isMinorString,
  minorFromString,
  minorToString,
  subtractMinor,
} from '@/server/lib/bigint';
import { AppError } from '@/server/lib/http';

describe('bigint', () => {
  it('parses valid minor strings', () => {
    expect(minorFromString('0').toString()).toBe('0');
    expect(minorFromString('1000000').toString()).toBe('1000000');
    expect(minorFromString('99999999999999999999').toString()).toBe('99999999999999999999');
  });

  it('rejects invalid input', () => {
    expect(() => minorFromString('-1')).toThrowError(AppError);
    expect(() => minorFromString('1.5')).toThrowError(AppError);
    expect(() => minorFromString('abc')).toThrowError(AppError);
    expect(() => minorFromString('')).toThrowError(AppError);
    expect(isMinorString('123')).toBe(true);
    expect(isMinorString('abc')).toBe(false);
    expect(isMinorString(123)).toBe(false);
  });

  it('adds and subtracts', () => {
    expect(addMinor('1', '2')).toBe('3');
    expect(subtractMinor('10', '3')).toBe('7');
    expect(() => subtractMinor('1', '2')).toThrowError(AppError);
  });

  it('compares', () => {
    expect(compareMinor('1', '2')).toBe(-1);
    expect(compareMinor('2', '1')).toBe(1);
    expect(compareMinor('5', '5')).toBe(0);
  });

  it('round-trips bigint->string', () => {
    const big = BigInt('123456789012345678901234567890');
    expect(minorToString(big)).toBe('123456789012345678901234567890');
  });

  it('formats as decimal using decimals', () => {
    expect(formatMinor('1000000', { decimals: 6, locale: 'en-US' })).toBe('1.000000');
    expect(formatMinor('20000000', { decimals: 6, locale: 'en-US' })).toBe('20.000000');
    expect(formatMinor('0', { decimals: 6, locale: 'en-US' })).toBe('0.000000');
  });

  it('formats with symbol', () => {
    expect(formatMinor('1000000', { decimals: 6, symbol: '$', locale: 'en-US' })).toBe('$1.000000');
  });
});
