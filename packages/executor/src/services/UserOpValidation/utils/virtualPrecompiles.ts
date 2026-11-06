import { FrameCallTraceFrame } from "@skandha/types/lib/executor/validation/ethrexFrameTx.js";

/**
 * Virtual Precompile Rule (VPR): the canonical mempool rules, with
 * MAX_VERIFY_GAS raised by a credit for calls into listed signature
 * verifiers, so they cost what a precompile for the same scheme would.
 *
 * Listed by address, which pins the code (CREATE2 from fixed init code).
 * The trace has no call input, so any call into a listed contract counts,
 * not only its verify function; the other functions are cheaper than the
 * precompile price, so they earn nothing.
 */
export interface VirtualPrecompile {
  address: `0x${string}`;
  precompileGas: number;
  /**
   * HACK until ethrex's ERC-7562 frame tracer reports per-call gasUsed:
   * one full verification, measured on a devnet. Without a reported
   * gasUsed, a call is credited `gasUsed` if it executed at least
   * `minOpcodes` opcodes and did not run out of gas.
   */
  fallback: { gasUsed: number; minOpcodes: number };
}

export const VIRTUAL_PRECOMPILES: VirtualPrecompile[] = [
  {
    // Falcon-512, ZKNOX falcon8. EIP-8052: hash-to-point 1000 + core 2000.
    address: "0x082195fEDF8BB5254A1dB077b17f1aEd77697A59",
    precompileGas: 3_000,
    fallback: { gasUsed: 635_154, minOpcodes: 35_707 },
  },
  {
    // SPHINCS- C13, SphincsC13Asm. No precompile proposal; an estimate.
    address: "0xa0a705b558Be9bEEC5B8BD7D5A96C792232be6A7",
    precompileGas: 4_000,
    fallback: { gasUsed: 97_298, minOpcodes: 3_182 },
  },
];

/**
 * Extra verification gas the validation prefix earns: for every call into
 * a listed verifier in `prefixCalls` (the prefix frames' trace roots,
 * searched recursively), the gas it used minus the precompile price. Only
 * the outermost listed call counts; its subtree is not searched again.
 */
export function virtualPrecompileCredit(
  prefixCalls: FrameCallTraceFrame[],
  precompiles: VirtualPrecompile[]
): bigint {
  const zero = BigInt(0);
  const byAddress = new Map(precompiles.map((p) => [p.address.toLowerCase(), p]));
  const credit = (call: FrameCallTraceFrame): bigint => {
    const listed = call.to ? byAddress.get(call.to.toLowerCase()) : undefined;
    if (!listed) return (call.calls ?? []).reduce((sum, c) => sum + credit(c), zero);
    const reported = call.gasUsed ? BigInt(call.gasUsed) : zero;
    const used = reported > zero ? reported : fallbackGasUsed(call, listed);
    const saved = used - BigInt(listed.precompileGas);
    return saved > zero ? saved : zero;
  };
  return prefixCalls.reduce((sum, root) => sum + credit(root), zero);
}

/** HACK (see VirtualPrecompile.fallback): a listed call's gas when ethrex reports none. */
function fallbackGasUsed(call: FrameCallTraceFrame, listed: VirtualPrecompile): bigint {
  if (call.outOfGas || executedOpcodes(call) < listed.fallback.minOpcodes) return BigInt(0);
  return BigInt(listed.fallback.gasUsed);
}

function executedOpcodes(call: FrameCallTraceFrame): number {
  const own = Object.values(call.usedOpcodes).reduce((sum, n) => sum + n, 0);
  return (call.calls ?? []).reduce((sum, c) => sum + executedOpcodes(c), own);
}
