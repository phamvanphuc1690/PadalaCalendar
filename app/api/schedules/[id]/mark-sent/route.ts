import type { NextRequest } from 'next/server';
import { fail, ok } from '@/server/lib/http';
import { withIdempotency } from '@/server/lib/idempotency';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { withRateLimit } from '@/server/middleware/withRateLimit';
import type { HandlerContext } from '@/server/middleware/compose';
import { markScheduleSent } from '@/server/service/remittance.service';

async function handler(
  req: NextRequest,
  ctx: HandlerContext,
) {
  const { id } = await (ctx.params as Promise<{ id: string }>);
  const body = await req.json();
  if (typeof body?.txHash !== 'string' || body.txHash.length === 0) {
    return fail('INVALID_INPUT', 'txHash is required');
  }
  const data = await markScheduleSent(id, body.txHash);
  return ok(data);
}

export const POST = compose(
  withError,
  withAuth,
  withRateLimit,
  withIdempotency(),
)(handler);
