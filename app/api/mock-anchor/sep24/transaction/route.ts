import { type NextRequest, NextResponse } from 'next/server';
import { MOCK_ANCHOR_ACCOUNT, mockWithdrawals } from '../../_state';
import { logger } from '@/server/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const id = req.nextUrl.searchParams.get('id') ?? '';
  const w = mockWithdrawals.get(id);
  if (!w) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  // Auto-advance: pending_user_transfer_start → pending_external after 2s.
  if (w.status === 'pending_user_transfer_start') {
    setTimeout(() => {
      if (w.status === 'pending_user_transfer_start') {
        w.status = 'pending_external';
        w.updatedAt = Date.now();
        logger.debug('mock-anchor.advance', { id, status: w.status });
      }
    }, 2_000).unref?.();
  }
  // Auto-advance: pending_external → completed after 3s.
  if (w.status === 'pending_external') {
    setTimeout(() => {
      if (w.status === 'pending_external') {
        w.status = 'completed';
        w.updatedAt = Date.now();
        logger.debug('mock-anchor.advance', { id, status: w.status });
      }
    }, 3_000).unref?.();
  }
  return NextResponse.json({
    transaction: {
      id: w.id,
      kind: 'withdrawal',
      status: w.status,
      withdraw_anchor_account: MOCK_ANCHOR_ACCOUNT,
      withdraw_memo: w.memo,
      withdraw_memo_type: 'text',
      amount_in: '5.00',
      amount_in_asset: 'stellar:USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    },
  });
}
