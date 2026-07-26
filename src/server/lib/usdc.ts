export const USDC_DECIMALS = 7n;
export const USDC_SCALE = 10n ** USDC_DECIMALS; // 10_000_000n
export const PHP_PER_USDC = 58; // demo rate: 1 USDC = ₱58

export function usdcToString(amount: bigint): string {
  const whole = amount / USDC_SCALE;
  const frac = amount % USDC_SCALE;
  const fracStr = frac.toString().padStart(Number(USDC_DECIMALS), '0');
  const trimmed = fracStr.replace(/0+$/, '') || '00';
  return `${whole}.${trimmed.length < 2 ? trimmed.padEnd(2, '0') : trimmed}`;
}

export function phpToUsdc(phpAmount: number): bigint {
  const usdc = phpAmount / PHP_PER_USDC;
  return BigInt(Math.round(usdc * 10_000_000));
}

export function usdcToPhp(amount: bigint): string {
  const usdc = Number(amount) / 10_000_000;
  return `₱${(usdc * PHP_PER_USDC).toFixed(2)}`;
}

export function stringToUsdc(str: string): bigint {
  const [whole, frac = ''] = str.split('.');
  const fracPadded = frac.padEnd(Number(USDC_DECIMALS), '0').slice(0, Number(USDC_DECIMALS));
  return BigInt(whole) * USDC_SCALE + BigInt(fracPadded);
}
