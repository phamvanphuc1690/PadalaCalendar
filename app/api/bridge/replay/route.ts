import { env } from '@/server/config/env';
import { bridgeService } from '@/server/service/bridge.service';
import { ok, fail } from '@/server/lib/http';
import { compose } from '@/server/middleware/compose';
import { withError } from '@/server/middleware/withError';
import type { NextRequest } from 'next/server';

// Dev-only endpoint: replay a specific EVM log into the bridge service.
const handler = async (req: NextRequest) => {
  if (env.NODE_ENV === 'production') {
    return fail('FORBIDDEN', 'Not available in production', 403);
  }
  const body = (await req.json()) as { log: unknown };
  if (!body?.log) return fail('INVALID_INPUT', 'Missing log', 400);

  await bridgeService.handleEvmTransfer(body.log as Parameters<typeof bridgeService.handleEvmTransfer>[0]);
  return ok({ replayed: true });
};

export const POST = compose(withError)(handler);
