export type MockWithdrawalState = {
  id: string;
  status: string;
  memo: string;
  updatedAt: number;
};

// Use a public mock account only. Never derive a public key from a secret in
// the application process, even for the demo anchor.
function resolveMockAnchorAccount(): string {
  return process.env.HUB_STELLAR_PUBLIC_KEY ?? 'GBANAGOAXH5ONSBI2I6I5LHP2TCRHWMZIAMGUQH2TNKQNCOGJ7GC3ZOL';
}

export const MOCK_ANCHOR_ACCOUNT = resolveMockAnchorAccount();
export const MOCK_WITHDRAW_MEMO = 'MOCK001';

// Use globalThis so the map survives HMR in dev (same pattern as DB client).
const g = globalThis as typeof globalThis & {
  _mockWithdrawals?: Map<string, MockWithdrawalState>;
};
if (!g._mockWithdrawals) g._mockWithdrawals = new Map();
export const mockWithdrawals = g._mockWithdrawals;
