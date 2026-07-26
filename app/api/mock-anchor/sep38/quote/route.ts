import { randomUUID } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { usdcCode } from '@/server/stellar/network';

export const dynamic = 'force-dynamic';

const quoteRequestSchema = z
  .object({
    sell_asset: z.string(),
    buy_asset: z.string(),
    sell_amount: z.string().optional(),
    buy_amount: z.string().optional(),
    buy_delivery_method: z.string().optional(),
    sell_delivery_method: z.string().optional(),
    country_code: z.string().optional(),
    context: z.string().optional(),
  })
  .refine((v) => Boolean(v.sell_amount) !== Boolean(v.buy_amount), {
    message: 'Exactly one of sell_amount or buy_amount required',
  });

// Mock FX rates. In production these come from the anchor.
const RATES: Record<string, number> = {
  'USDC->PHP': 56.7,
  'USDC->IDR': 16_300,
  'USDC->VND': 25_400,
};

const FEE: Record<string, { pct: number; fixed: number; asset: 'PHP' | 'IDR' | 'VND' }> = {
  'USDC->PHP': { pct: 0.005, fixed: 50, asset: 'PHP' },
  'USDC->IDR': { pct: 0.01, fixed: 15_000, asset: 'IDR' },
  'USDC->VND': { pct: 0.01, fixed: 30_000, asset: 'VND' },
};

export async function POST(req: NextRequest): Promise<Response> {
  const body = quoteRequestSchema.parse(await req.json());
  const key = `${usdcCode()}->${body.buy_asset.replace('iso4217:', '')}`;
  const rate = RATES[key];
  if (!rate) {
    return NextResponse.json({ error: `no market for ${key}` }, { status: 400 });
  }

  // sell_amount is in USDC minor (cents): 1000 = 10 USDC
  const sellMinorCents = Number(body.sell_amount ?? '0');
  const sellUsdcMajor = sellMinorCents / 100;

  // buy_amount in fiat major, then store as fiat "minor" (×100) so formatAmount() displays correctly
  const buyFiatMajor = sellUsdcMajor * rate;
  const buyAmountMinor = Math.round(buyFiatMajor * 100);

  const feeCfg = FEE[key];
  // fee: pct of buy + fixed (fixed is in fiat major → ×100 for minor)
  const feePctMinor = feeCfg ? Math.round(buyAmountMinor * feeCfg.pct) : 0;
  const feeFixedMinor = feeCfg ? feeCfg.fixed * 100 : 0;
  const feeTotal = feePctMinor + feeFixedMinor;
  const buyAfterFee = Math.max(0, buyAmountMinor - feeTotal);

  const sellAmount = body.sell_amount ?? '0';
  const id = randomUUID();
  return NextResponse.json({
    id,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    total_price: rate.toFixed(2),
    price: rate.toFixed(2),
    sell_asset: body.sell_asset,
    sell_amount: sellAmount,
    buy_asset: body.buy_asset,
    buy_amount: buyAfterFee.toString(),
    buy_delivery_method: body.buy_delivery_method,
    fee: {
      total: feeTotal.toString(),
      asset: `iso4217:${feeCfg?.asset ?? 'PHP'}`,
      details: [{ name: 'Service fee', amount: feeTotal.toString() }],
    },
  });
}
