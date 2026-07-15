import type { Asset } from '@stellar/stellar-sdk';
import { AppError } from '@/server/lib/http';
import { getHorizonUrl } from './network';

/**
 * Stellar DEX path quoting. Calls Horizon's `/paths/strict-send` endpoint to
 * find the best path for a `path_payment_strict_send` operation.
 *
 * Reference: https://developers.stellar.org/docs/data/horizon/api-reference/retrieve-payment-paths
 */

export type PathHop = {
  asset_code?: string;
  asset_issuer?: string;
  asset_type: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
};

export type StrictSendPath = {
  destination_asset_code?: string;
  destination_asset_issuer?: string;
  destination_asset_type: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
  destination_amount: string;
  path: PathHop[];
  source_amount: string;
};

type HorizonPathsResponse = {
  _embedded: { records: StrictSendPath[] };
};

export type SwapQuoteInput = {
  sourceAsset: Asset;
  sourceAmount: string;
  destinationAsset: Asset;
  destinationAccount: string;
};

export type SwapQuote = {
  sourceAmount: string;
  destinationAmount: string;
  destinationAsset: Asset;
  path: PathHop[];
  /** Suggested slippage tolerance (0.5% default) for the caller to apply. */
  suggestedMinDestination: string;
};

function assetToQueryParam(asset: Asset): string {
  if (asset.isNative()) return 'native';
  return `${asset.getCode()}:${asset.getIssuer()}`;
}

export async function getStrictSendPaths(input: SwapQuoteInput): Promise<StrictSendPath[]> {
  const url = new URL(`${getHorizonUrl().replace(/\/$/, '')}/paths/strict-send`);
  url.searchParams.set(
    'source_asset_type',
    assetToQueryParam(input.sourceAsset).split(':')[0] ?? 'native',
  );
  if (!input.sourceAsset.isNative()) {
    url.searchParams.set('source_asset_code', input.sourceAsset.getCode());
    url.searchParams.set('source_asset_issuer', input.sourceAsset.getIssuer());
  }
  url.searchParams.set('source_amount', input.sourceAmount);
  url.searchParams.set('destination', input.destinationAccount);
  url.searchParams.set(
    'destination_asset_type',
    input.destinationAsset.isNative() ? 'native' : 'credit_alphanum4',
  );
  if (!input.destinationAsset.isNative()) {
    url.searchParams.set('destination_asset_code', input.destinationAsset.getCode());
    url.searchParams.set('destination_asset_issuer', input.destinationAsset.getIssuer());
  }
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new AppError('INTERNAL', `Horizon paths request failed: ${String(err)}`, 502);
  }
  if (!res.ok) {
    throw new AppError('INTERNAL', `Horizon paths returned ${res.status}`, 502);
  }
  const data = (await res.json()) as HorizonPathsResponse;
  return data._embedded.records;
}

function applySlippage(destinationAmount: string, slippageBps: number): string {
  // slippageBps is basis points (e.g. 50 = 0.5%).
  const big = BigInt(destinationAmount);
  const min = (big * BigInt(10_000 - slippageBps)) / 10_000n;
  return min.toString();
}

export async function getSwapQuote(
  input: SwapQuoteInput,
  opts: { slippageBps?: number } = {},
): Promise<SwapQuote> {
  const paths = await getStrictSendPaths(input);
  if (paths.length === 0) {
    throw new AppError('INVALID_INPUT', 'No payment path found between the two assets', 400);
  }
  // Pick the path with the highest destination amount.
  paths.sort((a, b) => (BigInt(b.destination_amount) > BigInt(a.destination_amount) ? 1 : -1));
  const best = paths[0];
  const slippageBps = opts.slippageBps ?? 50;
  return {
    sourceAmount: best.source_amount,
    destinationAmount: best.destination_amount,
    destinationAsset: input.destinationAsset,
    path: best.path,
    suggestedMinDestination: applySlippage(best.destination_amount, slippageBps),
  };
}
