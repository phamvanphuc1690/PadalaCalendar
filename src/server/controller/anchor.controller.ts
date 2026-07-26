import type { NextRequest } from 'next/server';
import { ok } from '@/server/lib/http';
import type { HandlerContext } from '@/server/middleware/compose';
import { anchorService } from '@/server/service/anchor.service';

export async function listAnchors(_req: NextRequest, _ctx: HandlerContext) {
  try {
    const items = await anchorService.listKnown();
    return ok({ items });
  } catch (err) {
    // The anchor_endpoints table may be empty (fresh DB) or not yet
    // populated by `scripts/fetch-anchors.ts`. Return an empty list
    // rather than 500 so the UI can render the (empty) state.
    console.warn('[anchors] listKnown failed, returning empty list:', (err as Error).message);
    return ok({ items: [] });
  }
}

export async function getAnchorInfo(_req: NextRequest, ctx: HandlerContext) {
  const { domain } = await (ctx.params as Promise<{ domain: string }>);
  const row = await anchorService.getOrFetch(domain);
  return ok(row);
}
