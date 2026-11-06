import { EthrexAccessedSlots } from "@skandha/types/lib/executor/validation/ethrexFrameTx.js";

/**
 * Break signals, the VPR's second relaxation: validation may read the one
 * state slot of a listed BreakSignal contract without a stake. A wallet
 * reads it to know whether a scheme has been signalled broken, and then
 * requires its backup scheme too.
 *
 * Safe because the slot changes at most once, from zero to nonzero, so a
 * listed signal can invalidate pending transactions at most once, ever.
 * Listed by address, never by code hash: anyone could deploy a copy and
 * raise it, again and again. Reads only; a write, transient access or
 * any other slot is still treated as the canonical rules say.
 */
export interface BreakSignal {
  address: `0x${string}`;
  slot: `0x${string}`;
}

export const BREAK_SIGNALS: BreakSignal[] = [
  {
    // "Quantum computers break ECDSA", raised by the devnet cryptographer
    // (contracts/src/BreakSignal.sol; brokenAt is slot 0). A CREATE2
    // address: recompute it if BreakSignal.sol or the compiler settings
    // change (contracts/deployments/1337.json).
    address: "0x108c7aD6Dd81EA131A761B3Db9F817056D26941c",
    slot: "0x0",
  },
];

/** Whether `access` to `address` is only reads of a listed signal's slot. */
export function onlyReadsBreakSignal(
  address: string,
  access: EthrexAccessedSlots,
  signals: BreakSignal[]
): boolean {
  const signal = signals.find(
    (s) => s.address.toLowerCase() === address.toLowerCase()
  );
  if (!signal) return false;
  const empty = (slots: object) => Object.keys(slots).length === 0;
  if (
    !empty(access.writes) ||
    !empty(access.transientReads) ||
    !empty(access.transientWrites)
  ) {
    return false;
  }
  return Object.keys(access.reads).every(
    (slot) => BigInt(slot) === BigInt(signal.slot)
  );
}
