/**
 * Mock SEP-1 stellar.toml endpoint. When `OFFRAMP_ANCHOR_DOMAIN=mock` the
 * hub uses this internal route as the anchor's `/.well-known/stellar.toml`.
 *
 * The mock anchor is intentionally minimal: it declares SEP-24 + SEP-38
 * endpoints pointing at the same app's `/api/mock-anchor/*` routes.
 */

import { NextResponse } from 'next/server';
import { usdcCode, usdcIssuer } from '@/server/stellar/network';

export const dynamic = 'force-dynamic';

const HOST = 'mock://anchor.local';

export function GET(): Response {
  const toml =
    `# Mock anchor stellar.toml (Universal Merchant Payment Hub)\n` +
    `NETWORK_PASSPHRASE="Test SDF Network ; September 2015"\n` +
    `HORIZON_URL="https://horizon-testnet.stellar.org"\n` +
    `TRANSFER_SERVER_SEP0024="${HOST}/api/mock-anchor/sep24"\n` +
    `ANCHOR_QUOTE_SERVER="${HOST}/api/mock-anchor/sep38"\n` +
    `WEB_AUTH_ENDPOINT="${HOST}/api/mock-anchor/auth"\n` +
    `# SIGNING_KEY — left empty intentionally; mock anchor does not sign.\n` +
    `[[CURRENCIES]]\n` +
    `code="${usdcCode()}"\n` +
    `issuer="${usdcIssuer()}"\n` +
    `status="live"\n` +
    `is_asset_anchored=false\n` +
    `decimals=6\n`;
  return new NextResponse(toml, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
