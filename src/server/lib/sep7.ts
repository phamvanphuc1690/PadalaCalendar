export function buildSep7PayUri(params: {
  destination: string;
  amount: string;
  assetCode: string;
  assetIssuer: string;
  memo?: string;
  memoType?: string;
}): string {
  const base = 'web+stellar:pay';
  const qs = new URLSearchParams({
    destination: params.destination,
    amount: params.amount,
    asset_code: params.assetCode,
    asset_issuer: params.assetIssuer,
  });
  if (params.memo) qs.set('memo', params.memo);
  if (params.memoType) qs.set('memo_type', params.memoType);
  return `${base}?${qs.toString()}`;
}
