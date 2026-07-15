import { env } from '@/server/config/env';
import { logger } from '@/server/lib/logger';
import { type EvmLog, getLatestBlockNumber, getUsdcTransfersTo } from './rpc';

export type EvmWatchOptions = {
  signal: AbortSignal;
  onTransfer: (log: EvmLog) => Promise<void>;
};

const globalForEvm = globalThis as unknown as { evmWatcherStarted?: boolean };

/**
 * Poll Base Sepolia for USDC Transfer events to the Hub's EVM address.
 * Tracks the last processed block so no event is replayed across polls.
 * Runs until `signal` is aborted.
 */
export async function watchEvmPayments(opts: EvmWatchOptions): Promise<void> {
  const rpcUrl = env.BASE_RPC_URL;
  const contract = env.BASE_USDC_CONTRACT;
  const hubAddress = env.HUB_EVM_ADDRESS!;

  // Start from LOOKBACK blocks before current tip to catch payments
  // that arrived during a server restart (idempotency prevents double-processing).
  const LOOKBACK_BLOCKS = 200n;
  let lastBlock: bigint | null = null;

  logger.info('evmWatcher.start', { hubAddress, contract });

  while (!opts.signal.aborted) {
    try {
      const latestBlock = await getLatestBlockNumber(rpcUrl);

      // First run: anchor to (tip - LOOKBACK) so recent payments aren't missed on restart.
      if (lastBlock === null) {
        lastBlock = latestBlock > LOOKBACK_BLOCKS ? latestBlock - LOOKBACK_BLOCKS : 0n;
        logger.debug('evmWatcher.anchored', { block: lastBlock.toString(), tip: latestBlock.toString() });
      } else if (latestBlock > lastBlock) {
        const fromBlock = lastBlock + 1n;
        const logs = await getUsdcTransfersTo(rpcUrl, contract, hubAddress, fromBlock, latestBlock);

        for (const log of logs) {
          try {
            await opts.onTransfer(log);
          } catch (err) {
            logger.warn('evmWatcher.transfer_error', { txHash: log.transactionHash, err: String(err) });
          }
        }

        if (logs.length) {
          logger.info('evmWatcher.transfers', { count: logs.length, fromBlock: fromBlock.toString(), toBlock: latestBlock.toString() });
        }

        lastBlock = latestBlock;
      }
    } catch (err) {
      if (!opts.signal.aborted) {
        logger.warn('evmWatcher.poll_error', { err: String(err) });
      }
    }

    await sleepWithAbort(env.BASE_POLL_INTERVAL_MS, opts.signal);
  }

  logger.info('evmWatcher.stop');
}

function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return; }
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

/** Start the EVM watcher as a background job (idempotent via globalThis flag). */
export function startEvmWatcher(onTransfer: (log: EvmLog) => Promise<void>): () => void {
  if (globalForEvm.evmWatcherStarted) {
    logger.debug('evmWatcher.already_running');
    return () => {};
  }
  const abort = new AbortController();
  globalForEvm.evmWatcherStarted = true;
  void watchEvmPayments({ signal: abort.signal, onTransfer }).finally(() => {
    globalForEvm.evmWatcherStarted = false;
  });
  return () => {
    abort.abort();
    globalForEvm.evmWatcherStarted = false;
  };
}
