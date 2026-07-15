import { z } from 'zod';
import { httpJson } from './http';

/**
 * SEP-38 Anchor RFQ API — minimal client surface.
 *
 * Reference: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md
 */

const assetIdentifierSchema = z.string().min(1).max(120);

const feeSchema = z.object({
  total: z.string(),
  asset: z.string(),
  details: z
    .array(
      z.object({
        name: z.string(),
        amount: z.string(),
      }),
    )
    .optional(),
});

const quoteSchema = z.object({
  id: z.string(),
  expires_at: z.string(),
  total_price: z.string(),
  price: z.string(),
  sell_asset: z.string(),
  sell_amount: z.string(),
  buy_asset: z.string(),
  buy_amount: z.string(),
  fee: feeSchema,
  buy_delivery_method: z.string().optional(),
  sell_delivery_method: z.string().optional(),
});
export type Sep38Quote = z.infer<typeof quoteSchema>;

const infoAssetSchema = z.object({
  asset: z.string(),
  country_codes: z.array(z.string()).optional(),
  sell_delivery_methods: z
    .array(z.object({ name: z.string(), description: z.string().optional() }))
    .optional(),
  buy_delivery_methods: z
    .array(z.object({ name: z.string(), description: z.string().optional() }))
    .optional(),
});

const infoSchema = z.object({
  assets: z.array(infoAssetSchema),
});
export type Sep38Info = z.infer<typeof infoSchema>;

export type PostQuoteInput = {
  sell_asset: string;
  buy_asset: string;
  sell_amount?: string;
  buy_amount?: string;
  sell_delivery_method?: string;
  buy_delivery_method?: string;
  country_code?: string;
  context?: 'sep6' | 'sep24' | 'sep31';
  expire_after?: string;
};

export async function fetchSep38Info(quoteServer: string, _jwt?: string): Promise<Sep38Info> {
  const url = `${quoteServer.replace(/\/$/, '')}/info`;
  return infoSchema.parse(await httpJson<Sep38Info>(url, { method: 'GET', authToken: _jwt }));
}

export async function postQuote(
  quoteServer: string,
  jwt: string,
  input: PostQuoteInput,
): Promise<Sep38Quote> {
  if (Boolean(input.sell_amount) === Boolean(input.buy_amount)) {
    throw new Error('postQuote requires exactly one of sell_amount or buy_amount');
  }
  // Validate asset shapes (zod throws on mismatch).
  assetIdentifierSchema.parse(input.sell_asset);
  assetIdentifierSchema.parse(input.buy_asset);

  const url = `${quoteServer.replace(/\/$/, '')}/quote`;
  const resp = await httpJson<unknown>(url, {
    method: 'POST',
    body: input as Record<string, string>,
    authToken: jwt,
  });
  return quoteSchema.parse(resp);
}
