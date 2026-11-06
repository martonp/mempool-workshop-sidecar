import { describe, it, expect } from "vitest";
import { FrameCallTraceFrame } from "@skandha/types/lib/executor/validation/ethrexFrameTx.js";
import {
  VirtualPrecompile,
  virtualPrecompileCredit,
} from "../../../../src/services/UserOpValidation/utils/virtualPrecompiles.js";

const WALLET = "0x1111111111111111111111111111111111111111" as const;
const FALCON = "0x2222222222222222222222222222222222222222" as const;
const SPHINCS = "0x3333333333333333333333333333333333333333" as const;
const OTHER = "0x4444444444444444444444444444444444444444" as const;

const PRECOMPILES: VirtualPrecompile[] = [
  { address: FALCON, precompileGas: 3_000, fallbackGasUsed: 700_000 },
  { address: SPHINCS, precompileGas: 4_000, fallbackGasUsed: 110_000 },
];

const call = (
  to: `0x${string}`,
  opts: { calls?: FrameCallTraceFrame[]; gasUsed?: `0x${string}` } = {}
): FrameCallTraceFrame => ({
  from: WALLET,
  to,
  type: "STATICCALL",
  value: "0x0",
  calls: opts.calls ?? [],
  accessedSlots: { reads: {}, writes: {}, transientReads: {}, transientWrites: {} },
  extCodeAccessInfo: [],
  usedOpcodes: { "86": 10_000 },
  contractSize: {},
  outOfGas: false,
  gasUsed: opts.gasUsed,
});
const credit = (...roots: FrameCallTraceFrame[]) => virtualPrecompileCredit(roots, PRECOMPILES);

describe("virtualPrecompileCredit", () => {
  it("is zero without listed calls", () => {
    expect(credit(call(WALLET, { calls: [call(OTHER)] }))).toBe(0n);
  });

  it("credits the reported gasUsed minus the precompile price", () => {
    // 0x7a120 = 500_000
    expect(credit(call(WALLET, { calls: [call(FALCON, { gasUsed: "0x7a120" })] }))).toBe(497_000n);
  });

  it("never goes negative", () => {
    expect(credit(call(WALLET, { calls: [call(FALCON, { gasUsed: "0x64" })] }))).toBe(0n);
  });

  it("credits only the outermost listed call", () => {
    const nested = call(SPHINCS, { gasUsed: "0x1adb0", calls: [call(SPHINCS, { gasUsed: "0x186a0" })] });
    expect(credit(call(WALLET, { calls: [nested] }))).toBe(110_000n - 4_000n);
  });

  it("finds listed calls at any depth and across prefix frames", () => {
    const deep = call(WALLET, { calls: [call(OTHER, { calls: [call(FALCON, { gasUsed: "0x7a120" })] })] });
    expect(credit(deep, call(WALLET, { calls: [call(SPHINCS, { gasUsed: "0x1adb0" })] }))).toBe(497_000n + 106_000n);
  });

  it("matches addresses case-insensitively", () => {
    const upper = `0x${FALCON.slice(2).toUpperCase()}` as `0x${string}`;
    expect(credit(call(WALLET, { calls: [call(upper, { gasUsed: "0x7a120" })] }))).toBe(497_000n);
  });

  describe("fallback while ethrex reports no gasUsed", () => {
    it("credits the configured gasUsed", () => {
      expect(credit(call(WALLET, { calls: [call(FALCON), call(SPHINCS)] }))).toBe(697_000n + 106_000n);
    });

    it("treats a gasUsed of 0 as not reported", () => {
      expect(credit(call(WALLET, { calls: [call(FALCON, { gasUsed: "0x0" })] }))).toBe(697_000n);
    });
  });
});
