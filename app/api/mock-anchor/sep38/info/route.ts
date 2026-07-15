import { NextResponse } from 'next/server';
import { usdcCode, usdcIssuer } from '@/server/stellar/network';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return NextResponse.json({
    assets: [
      {
        asset: `stellar:${usdcCode()}:${usdcIssuer()}`,
        country_codes: ['PH', 'ID', 'VN'],
        sell_delivery_methods: [],
        buy_delivery_methods: [
          { name: 'bank_deposit', description: 'Bank deposit' },
          { name: 'cash_pickup', description: 'Cash pickup' },
        ],
      },
      {
        asset: 'iso4217:PHP',
        country_codes: ['PH'],
        sell_delivery_methods: [
          { name: 'bank_deposit', description: 'Bank deposit' },
          { name: 'cash_pickup', description: 'Cash pickup' },
        ],
        buy_delivery_methods: [],
      },
      {
        asset: 'iso4217:IDR',
        country_codes: ['ID'],
        sell_delivery_methods: [{ name: 'cash_pickup', description: 'Cash pickup' }],
        buy_delivery_methods: [],
      },
      {
        asset: 'iso4217:VND',
        country_codes: ['VN'],
        sell_delivery_methods: [{ name: 'cash_pickup', description: 'Cash pickup' }],
        buy_delivery_methods: [],
      },
    ],
  });
}
