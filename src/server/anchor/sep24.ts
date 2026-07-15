import { z } from 'zod';
import { httpJson } from './http';

/**
 * SEP-24 Hosted Deposit and Withdrawal — minimal client surface.
 *
 * Reference: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md
 *
 * All calls are JSON. Authentication is via the SEP-10 JWT in the
 * `Authorization: Bearer <token>` header.
 *
 * For the MVP we only model the *withdrawal* flow. Deposit is symmetric
 * and out of scope.
 */

const statusEnum = z.enum([
  'incomplete',
  'pending_user_transfer_start',
  'pending_user_transfer_complete',
  'pending_external',
  'pending_anchor',
  'pending_stellar',
  'pending_trust',
  'pending_user',
  'on_hold',
  'completed',
  'refunded',
  'expired',
  'no_market',
  'too_small',
  'too_large',
  'error',
]);
export type Sep24Status = z.infer<typeof statusEnum>;

const transactionSchema = z.object({
  id: z.string(),
  kind: z.enum(['deposit', 'withdrawal']).optional(),
  status: statusEnum,
  status_eta: z.number().optional(),
  more_info_url: z.string().optional(),
  amount_in: z.string().optional(),
  amount_in_asset: z.string().optional(),
  amount_out: z.string().optional(),
  amount_out_asset: z.string().optional(),
  amount_fee: z.string().optional(),
  amount_fee_asset: z.string().optional(),
  withdraw_anchor_account: z.string().optional(),
  withdraw_memo: z.string().optional(),
  withdraw_memo_type: z.string().optional(),
  deposit_memo: z.string().optional(),
  deposit_memo_type: z.string().optional(),
  stellar_transaction_id: z.string().optional(),
  external_transaction_id: z.string().optional(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  refunded: z.boolean().optional(),
  refund_memo: z.string().optional(),
});
export type Sep24Transaction = z.infer<typeof transactionSchema>;

const transactionsEnvelopeSchema = z.object({
  transactions: z.array(transactionSchema).optional(),
  transaction: transactionSchema.optional(),
});

const startResponseSchema = z.union([
  z.object({
    type: z.literal('interactive_customer_info_needed'),
    id: z.string(),
    url: z.string(),
  }),
  z.object({ type: z.literal('authentication_required') }),
  z.object({ type: z.literal('expired'), id: z.string().optional() }),
]);

export type Sep24StartResponse = z.infer<typeof startResponseSchema>;

export type Sep24Info = {
  deposit?: Record<string, unknown>;
  withdraw?: Record<string, unknown>;
  fee?: Record<string, unknown>;
  features?: Record<string, unknown>;
};

export type StartWithdrawalInput = {
  account: string;
  asset_code: string;
  amount?: string;
  dest?: string;
  dest_extra?: Record<string, string>;
  memo?: string;
  memo_type?: 'text' | 'id' | 'hash';
  quote_id?: string;
  lang?: string;
  country_code?: string;
  customer_id?: string;
};

export async function fetchSep24Info(transferServer: string, _jwt?: string): Promise<Sep24Info> {
  const url = `${transferServer.replace(/\/$/, '')}/info`;
  // /info is unauthenticated. We still pass the JWT opportunistically.
  return await httpJson<Sep24Info>(url, { method: 'GET', authToken: _jwt });
}

export async function startInteractiveWithdrawal(
  transferServer: string,
  jwt: string,
  input: StartWithdrawalInput,
): Promise<Sep24StartResponse> {
  const url = `${transferServer.replace(/\/$/, '')}/transactions/withdraw/interactive`;
  const body: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'object') body[k] = JSON.stringify(v);
    else body[k] = String(v);
  }
  const resp = await httpJson<unknown>(url, { method: 'POST', body, authToken: jwt });
  return startResponseSchema.parse(resp);
}

export async function getTransaction(
  transferServer: string,
  jwt: string,
  id: string,
): Promise<Sep24Transaction> {
  const url = `${transferServer.replace(/\/$/, '')}/transaction?id=${encodeURIComponent(id)}`;
  const resp = await httpJson<unknown>(url, { method: 'GET', authToken: jwt });
  const env = transactionsEnvelopeSchema.parse(resp);
  if (!env.transaction) {
    throw new Error('Anchor returned no transaction for id');
  }
  return env.transaction;
}

export type Sep24Kind = 'deposit' | 'withdrawal';
