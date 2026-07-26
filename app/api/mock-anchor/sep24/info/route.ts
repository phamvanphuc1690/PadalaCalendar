import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return NextResponse.json({
    deposit: { USDC: { enabled: false } },
    withdraw: {
      USDC: {
        enabled: true,
        fee_fixed: '0.50',
        fee_percent: 0,
        min_amount: '1.00',
        max_amount: '10000.00',
      },
    },
    fee: { enabled: false },
    features: { account_creation: false, claimable_balances: false },
  });
}
