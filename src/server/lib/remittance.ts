/**
 * Core business logic for PadalaCalendar.
 * All functions are pure (no DB, no network) — easy to unit test.
 */

// Exchange rate: 1 USDC = ₱162.50 PHP
export const USDC_TO_PHP_RATE = 162.5;

// Stellar classic USDC has 7 decimal places. 1 USDC = 10_000_000 stroops.
export const USDC_DECIMALS = 7;
export const USDC_MINOR_UNIT = 10_000_000n;

/**
 * Convert PHP amount to USDC minor units.
 * e.g. ₱8000 → "49230769" (49.230769 USDC at ₱162.50/USDC)
 */
export function phpToUsdcMinor(phpAmount: number): string {
  const usdc = phpAmount / USDC_TO_PHP_RATE;
  const minor = Math.round(usdc * 10_000_000);
  return minor.toString();
}

/**
 * Convert USDC minor units to PHP amount.
 * e.g. "49230000" → 8000 (₱8,000)
 */
export function usdcMinorToPhp(usdcMinor: string): number {
  const usdc = Number(BigInt(usdcMinor)) / 10_000_000;
  return Math.round(usdc * USDC_TO_PHP_RATE);
}

/**
 * Convert USDC minor units to display string (e.g. "49.23").
 */
export function usdcMinorToDisplay(usdcMinor: string): string {
  const usdc = Number(BigInt(usdcMinor)) / 10_000_000;
  return usdc.toFixed(2);
}

/**
 * Calculate next send date given the day-of-month and a reference date.
 * If the day hasn't passed this month, next send is this month.
 * Otherwise, it's next month.
 */
export function nextSendDate(sendDayOfMonth: number, from: Date = new Date()): Date {
  const year = from.getFullYear();
  const month = from.getMonth();
  const day = Math.min(sendDayOfMonth, 28); // clamp to 28 to handle all months

  const thisMonth = new Date(year, month, day);
  if (thisMonth >= from) {
    return thisMonth;
  }
  // Next month
  return new Date(year, month + 1, day);
}

/**
 * Calculate days until next send date.
 * Returns 0 if due today, negative if overdue.
 */
export function daysUntilDue(sendDayOfMonth: number, from: Date = new Date()): number {
  const next = nextSendDate(sendDayOfMonth, from);
  const msPerDay = 1000 * 60 * 60 * 24;
  const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const nextMidnight = new Date(next.getFullYear(), next.getMonth(), next.getDate());
  return Math.round((nextMidnight.getTime() - fromMidnight.getTime()) / msPerDay);
}

/**
 * Check if a recipient's remittance is due (within threshold days).
 */
export function isDue(sendDayOfMonth: number, thresholdDays = 0, from: Date = new Date()): boolean {
  return daysUntilDue(sendDayOfMonth, from) <= thresholdDays;
}

/**
 * Check if due today.
 */
export function isDueToday(sendDayOfMonth: number, from: Date = new Date()): boolean {
  return daysUntilDue(sendDayOfMonth, from) === 0;
}

/**
 * Generate a SEP-7 pay URI for a recipient payment.
 * Format: web+stellar:pay?destination=...&amount=...&asset_code=...&asset_issuer=...&memo=...
 */
export function buildSep7PayUri(params: {
  destinationAddress: string;
  amountUsdc: string; // minor units
  assetCode: string;
  assetIssuer: string;
  recipientName: string;
  memo?: string;
}): string {
  const amount = (Number(BigInt(params.amountUsdc)) / 10_000_000).toFixed(7);
  const memo = params.memo ?? `Padala:${params.recipientName.replace(/\s+/g, '-')}`;
  const query = new URLSearchParams({
    destination: params.destinationAddress,
    amount,
    asset_code: params.assetCode,
    asset_issuer: params.assetIssuer,
    memo,
    memo_type: 'text',
  });
  return `web+stellar:pay?${query.toString()}`;
}

/**
 * Generate a MoneyGram/Hana anchor pickup reference.
 * Format: MGR-XXXXXXX (7 digits)
 */
export function generatePickupRef(prefix = 'MGR'): string {
  const num = Math.floor(Math.random() * 9_000_000) + 1_000_000;
  return `${prefix}-${num}`;
}

/**
 * Generate a Hana anchor pickup code.
 */
export function generatePickupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Generate an anchor transaction ID.
 */
export function generateAnchorTxId(): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(
    '',
  );
  return hex;
}

/**
 * Determine notification status label for a recipient.
 */
export type DueStatus = 'overdue' | 'due-today' | 'due-soon' | 'upcoming' | 'sent';

export function getDueStatus(sendDayOfMonth: number, from: Date = new Date()): DueStatus {
  const days = daysUntilDue(sendDayOfMonth, from);
  if (days < 0) return 'overdue';
  if (days === 0) return 'due-today';
  if (days <= 3) return 'due-soon';
  return 'upcoming';
}

/**
 * Format a due date label for display.
 */
export function formatDueLabel(sendDayOfMonth: number, from: Date = new Date()): string {
  const days = daysUntilDue(sendDayOfMonth, from);
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

/**
 * Parse SSE event data from Horizon streaming.
 * Horizon SSE sends lines like: "data: {...json...}"
 */
export function parseSseEvent(chunk: string): Record<string, unknown> | null {
  const lines = chunk.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const json = line.slice(6).trim();
      if (json === 'hello' || json === '') continue;
      try {
        return JSON.parse(json) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Encode a remittance schedule_id into a muxed account ID (SEP-23).
 * The schedule_id is a UUID — we take the first 8 hex chars as a 32-bit int.
 */
export function scheduleIdToMuxedId(scheduleId: string): bigint {
  // Take first 8 hex chars of UUID (without dashes)
  const hex = scheduleId.replace(/-/g, '').slice(0, 16);
  return BigInt(`0x${hex}`);
}

/**
 * Count recipients that have remittances due within N days.
 */
export function countDueWithin(
  recipients: Array<{ sendDayOfMonth: number }>,
  days: number,
  from: Date = new Date(),
): number {
  return recipients.filter((r) => {
    const d = daysUntilDue(r.sendDayOfMonth, from);
    return d >= 0 && d <= days;
  }).length;
}
