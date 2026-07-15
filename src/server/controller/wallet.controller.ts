import { StrKey } from '@stellar/stellar-sdk';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { created, ok } from '@/server/lib/http';
import type { HandlerContext } from '@/server/middleware/compose';
import { walletService } from '@/server/service/wallet.service';

const publicKeySchema = z
  .string()
  .refine((v) => v.length === 56 && StrKey.isValidEd25519PublicKey(v), {
    message: 'INVALID_PUBLIC_KEY',
  });

const createSchema = z.object({
  publicKey: publicKeySchema,
  label: z.string().min(1).max(80),
  network: z.enum(['testnet', 'public', 'futurenet']).default('testnet'),
});

const updateSchema = z.object({
  label: z.string().min(1).max(80).optional(),
});

export async function listWallets(req: NextRequest, ctx: HandlerContext) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);
  const ownerPublicKey = ctx.publicKey as string;
  const items = await walletService.list({ ownerPublicKey, limit, offset });
  return ok({ items, limit, offset });
}

export async function createWallet(req: NextRequest, ctx: HandlerContext) {
  const body = createSchema.parse(await req.json());
  const item = await walletService.create({ ...body, ownerPublicKey: ctx.publicKey as string });
  return created(item);
}

export async function getWallet(_req: NextRequest, ctx: HandlerContext) {
  const { id } = await (ctx.params as Promise<{ id: string }>);
  const item = await walletService.getById(id, ctx.publicKey as string);
  return ok(item);
}

export async function updateWallet(req: NextRequest, ctx: HandlerContext) {
  const { id } = await (ctx.params as Promise<{ id: string }>);
  const body = updateSchema.parse(await req.json());
  const item = await walletService.update(id, ctx.publicKey as string, body);
  return ok(item);
}

export async function deleteWallet(_req: NextRequest, ctx: HandlerContext) {
  const { id } = await (ctx.params as Promise<{ id: string }>);
  await walletService.remove(id, ctx.publicKey as string);
  return ok({ ok: true });
}
