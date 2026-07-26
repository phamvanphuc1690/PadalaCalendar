import { StrKey } from '@stellar/stellar-sdk';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError, created, ok } from '@/server/lib/http';
import type { HandlerContext } from '@/server/middleware/compose';
import { checkoutService } from '@/server/service/checkout.service';

const publicKeySchema = z
  .string()
  .refine((v) => v.length === 56 && StrKey.isValidEd25519PublicKey(v), {
    message: 'INVALID_PUBLIC_KEY',
  });

const challengeSchema = z.object({
  publicKey: publicKeySchema,
});

const verifySchema = z.object({
  publicKey: publicKeySchema,
  signedChallengeXdr: z.string().min(1),
});

const buildSchema = z.object({
  signedId: z.string().min(1),
});

const submitSchema = z.object({
  signedId: z.string().min(1),
  signedXdr: z.string().min(1),
});

export async function createChallenge(req: NextRequest, _ctx: HandlerContext) {
  const body = challengeSchema.parse(await req.json());
  const result = await checkoutService.createChallenge(body.publicKey);
  return ok(result);
}

export async function verifyChallenge(req: NextRequest, _ctx: HandlerContext) {
  const body = verifySchema.parse(await req.json());
  const result = await checkoutService.verifyChallenge(body);
  return ok(result);
}

export async function buildPayment(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.customerAccount) throw new AppError('UNAUTHORIZED', 'Missing customer session', 401);
  const body = buildSchema.parse(await req.json().catch(() => ({})));
  const result = await checkoutService.buildPayment({
    account: ctx.customerAccount,
    signedId: body.signedId,
  });
  return ok(result);
}

export async function submitPayment(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.customerAccount) throw new AppError('UNAUTHORIZED', 'Missing customer session', 401);
  const body = submitSchema.parse(await req.json());
  const result = await checkoutService.submitPayment({
    account: ctx.customerAccount,
    signedId: body.signedId,
    signedXdr: body.signedXdr,
  });
  return created(result);
}
