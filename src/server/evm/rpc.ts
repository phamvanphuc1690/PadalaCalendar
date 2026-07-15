/**
 * Minimal JSON-RPC helpers for Base (EVM) — no external dependencies.
 * Uses raw fetch so we don't pull in ethers/viem into the server bundle.
 */

/** ERC-20 Transfer(address,address,uint256) event topic */
export const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export type EvmLog = {
  transactionHash: string;
  blockNumber: string;
  logIndex: string;
  topics: string[];
  /** ABI-encoded uint256 amount (32-byte hex, no 0x prefix issues) */
  data: string;
  address: string;
};

async function jsonRpc<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`EVM RPC HTTP ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(`EVM RPC error: ${body.error.message}`);
  return body.result as T;
}

export async function getLatestBlockNumber(rpcUrl: string): Promise<bigint> {
  const hex = await jsonRpc<string>(rpcUrl, 'eth_blockNumber', []);
  return BigInt(hex);
}

/**
 * Fetch ERC-20 Transfer logs where `to` is the hub address.
 * Pads the address to a 32-byte topic (left-zero-padded).
 */
export async function getUsdcTransfersTo(
  rpcUrl: string,
  usdcContract: string,
  toAddress: string,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<EvmLog[]> {
  const paddedTo = `0x000000000000000000000000${toAddress.replace(/^0x/i, '').toLowerCase()}`;
  return jsonRpc<EvmLog[]>(rpcUrl, 'eth_getLogs', [
    {
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`,
      address: usdcContract,
      topics: [ERC20_TRANSFER_TOPIC, null, paddedTo],
    },
  ]);
}

/**
 * Parse the `from` address from a Transfer log's topics[1].
 * topics[1] is a 32-byte padded address.
 */
export function parseFromAddress(log: EvmLog): string {
  return `0x${log.topics[1].slice(-40)}`;
}

/**
 * Parse the transfer amount from log.data (ABI-encoded uint256).
 * USDC on Base has 6 decimals.
 */
export function parseTransferAmount(log: EvmLog): bigint {
  return BigInt(log.data);
}

/**
 * Convert a 6-decimal USDC Base amount to our 2-decimal cents minor unit.
 * 1 USDC (6 dec) = 1_000_000 units = 100 cents
 * amountMinor = baseUnits / 10_000
 */
export function baseUnitsToMinor(baseUnits: bigint): bigint {
  return baseUnits / 10_000n;
}

/**
 * Convert cents minor unit to 6-decimal USDC Base units.
 * amountMinor = 100 cents = 1 USDC = 1_000_000 base units
 */
export function minorToBaseUnits(amountMinor: bigint): bigint {
  return amountMinor * 10_000n;
}
