import { Keypair } from '@stellar/stellar-sdk';

export type MockWithdrawalState = {
  id: string;
  status: string;
  memo: string;
  updatedAt: number;
};

// Derive mock anchor account from hub key if available — it's guaranteed to
// exist on testnet and hold a USDC trustline. Falls back to a hardcoded key.
function resolveMockAnchorAccount(): string {
  const secret = process.env.HUB_STELLAR_SECRET;
  if (secret) {
    try {
      return Keypair.fromSecret(secret).publicKey();
    } catch {
      // malformed secret — fall through
    }
  }
  return 'GBANAGOAXH5ONSBI2I6I5LHP2TCRHWMZIAMGUQH2TNKQNCOGJ7GC3ZOL';
}

export const MOCK_ANCHOR_ACCOUNT = resolveMockAnchorAccount();
export const MOCK_WITHDRAW_MEMO = 'MOCK001';

// Use globalThis so the map survives HMR in dev (same pattern as DB client).
const g = globalThis as typeof globalThis & {
  _mockWithdrawals?: Map<string, MockWithdrawalState>;
};
if (!g._mockWithdrawals) g._mockWithdrawals = new Map();
export const mockWithdrawals = g._mockWithdrawals;
