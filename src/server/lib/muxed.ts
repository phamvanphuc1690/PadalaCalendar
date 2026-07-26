/**
 * SEP-23 Muxed Account encoding — encodes a schedule_id into the muxed account address.
 * Muxed accounts allow attaching a 64-bit integer ID to a base G address.
 * Used to track remittance schedule_id in the muxed payer address.
 */
import { MuxedAccount } from '@stellar/stellar-sdk';

/**
 * Deterministic hash of a schedule string ID into a safe 64-bit-range bigint.
 */
export function encodeScheduleIdToMuxedId(scheduleId: string): bigint {
  let hash = 0n;
  for (let i = 0; i < scheduleId.length; i++) {
    hash = (hash * 31n + BigInt(scheduleId.charCodeAt(i))) % 2n ** 53n;
  }
  return hash;
}

/**
 * Creates a muxed address from a base G... address and a string schedule ID.
 */
export function createMuxedAddressFromSchedule(
  baseAddress: string,
  scheduleId: string,
): string {
  const id = encodeScheduleIdToMuxedId(scheduleId);
  return createMuxedAddress(baseAddress, id);
}

/**
 * Creates a muxed account address by encoding a numeric ID into a G... address.
 * @param baseAddress - The base Stellar public key (G...)
 * @param id - A 64-bit unsigned integer schedule ID (passed as bigint or number)
 */
export function createMuxedAddress(baseAddress: string, id: bigint | number): string {
  const muxed = new MuxedAccount({ type: 0, value: baseAddress } as never, id.toString());
  return muxed.accountId();
}

/**
 * Decodes a muxed account address (M...) back to base address and ID.
 */
export function decodeMuxedAddress(muxedAddress: string): { baseAddress: string; id: bigint } {
  try {
    const muxed = MuxedAccount.fromAddress(muxedAddress, '0');
    return {
      baseAddress: muxed.baseAccount().accountId(),
      id: BigInt(muxed.id()),
    };
  } catch {
    // If not muxed, return as-is with id 0
    return { baseAddress: muxedAddress, id: 0n };
  }
}
