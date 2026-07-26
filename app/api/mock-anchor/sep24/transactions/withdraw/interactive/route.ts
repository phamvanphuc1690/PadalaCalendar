import { randomUUID } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MOCK_WITHDRAW_MEMO, mockWithdrawals } from '../../../../_state';
import { logger } from '@/server/lib/logger';

export const dynamic = 'force-dynamic';

const withdrawRequestSchema = z.object({
  account: z.string().min(56).max(56),
  asset_code: z.string().min(1).max(12),
  amount: z.string().optional(),
  dest: z.string().optional(),
  quote_id: z.string().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const raw = await req.json().catch(() => ({}));
  withdrawRequestSchema.parse(raw);
  const id = randomUUID();
  mockWithdrawals.set(id, {
    id,
    status: 'incomplete',
    memo: MOCK_WITHDRAW_MEMO,
    updatedAt: Date.now(),
  });
  // Auto-advance: incomplete → pending_user_transfer_start after 1s.
  setTimeout(() => {
    const w = mockWithdrawals.get(id);
    if (w && w.status === 'incomplete') {
      w.status = 'pending_user_transfer_start';
      w.updatedAt = Date.now();
      logger.debug('mock-anchor.advance', { id, status: w.status });
    }
  }, 1_000).unref?.();
  return NextResponse.json({
    type: 'interactive_customer_info_needed',
    id,
    url: `${req.nextUrl.origin}/mock-anchor/webapp/${id}`,
  });
}
