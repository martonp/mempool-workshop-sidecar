import { FrameCallTraceFrame } from "@skandha/types/lib/executor/validation/ethrexFrameTx.js";

/**
 * Virtual precompiles, the Crypto-Agility Mempool's first relaxation: the
 * canonical mempool rules, with
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
   * a verification's gas, credited to every call that reports no gasUsed.
   * It checks nothing, so a call that does no work earns it too: for a
   * trusted devnet only.
   */
  fallbackGasUsed: number;
}

export const VIRTUAL_PRECOMPILES: VirtualPrecompile[] = [
  {
    // Falcon-512, ZKNOX falcon8. EIP-8052: hash-to-point 1000 + core 2000.
    address: "0x082195fEDF8BB5254A1dB077b17f1aEd77697A59",
    precompileGas: 3_000,
    // Measured up to 635_154; raised so the credit covers the generous fixed
    // gas limits the Agile Wallet extension declares.
    fallbackGasUsed: 950_000,
  },
  {
    // SPHINCS- C13, SphincsC13Asm. No precompile proposal; an estimate.
    address: "0xa0a705b558Be9bEEC5B8BD7D5A96C792232be6A7",
    precompileGas: 4_000,
    // Measured at 97_298; raised for the same generous limits.
    fallbackGasUsed: 200_000,
  },
];

/**
 * Extra verification gas the validation prefix earns: for the first call into
 * each listed verifier in `prefixCalls` (the prefix frames' trace roots,
 * searched recursively, in execution order), the gas it used minus the
 * precompile price. Later calls into the same verifier earn nothing, so the
 * credit is bounded by one verification per listed verifier. Only the
 * outermost listed call counts; its subtree is not searched again.
 */
export function virtualPrecompileCredit(
  prefixCalls: FrameCallTraceFrame[],
  precompiles: VirtualPrecompile[]
): bigint {
  const zero = BigInt(0);
  const byAddress = new Map(precompiles.map((p) => [p.address.toLowerCase(), p]));
  const credited = new Set<string>();
  const credit = (call: FrameCallTraceFrame): bigint => {
    const listed = call.to ? byAddress.get(call.to.toLowerCase()) : undefined;
    if (!listed) return (call.calls ?? []).reduce((sum, c) => sum + credit(c), zero);
    const key = listed.address.toLowerCase();
    if (credited.has(key)) return zero;
    credited.add(key);
    const reported = call.gasUsed ? BigInt(call.gasUsed) : zero;
    const used = reported > zero ? reported : BigInt(listed.fallbackGasUsed);
    const saved = used - BigInt(listed.precompileGas);
    return saved > zero ? saved : zero;
  };
  return prefixCalls.reduce((sum, root) => sum + credit(root), zero);
}
