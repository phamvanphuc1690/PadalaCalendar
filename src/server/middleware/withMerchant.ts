import type { NextRequest } from 'next/server';
import { AppError } from '@/server/lib/http';
import { verifyCustomerToken } from '@/server/service/checkout.service';
import type { Middleware } from './compose';

/**
 * Asserts that the request carries a `Bearer <jwt>` header issued by
 * `/api/checkout/verify`. The JWT is HS256-signed with
 * `CUSTOMER_JWT_SECRET` and carries the customer's Stellar public key in
 * `sub`. On success, sets `ctx.customerAccount` for downstream handlers.
 *
 * This is the customer-side equivalent of `withAuth` (which authenticates
 * the merchant via the session cookie).
 */
export const withCustomerAuth: Middleware = (handler) => async (req, ctx) => {
  const token = readCustomerJwt(req);
  if (!token) {
    throw new AppError('UNAUTHORIZED', 'Missing customer session', 401);
  }
  const claims = await verifyCustomerToken(token);
  ctx.customerToken = token;
  ctx.customerAccount = claims.sub;
  return handler(req, ctx);
};

/** Helper used by /api/checkout/* to read the customer JWT from a request. */
export function readCustomerJwt(req: NextRequest): string | null {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}
