import { describe, it, expect } from "vitest";
import { EthrexAccessedSlots } from "@skandha/types/lib/executor/validation/ethrexFrameTx.js";
import {
  BreakSignal,
  onlyReadsBreakSignal,
} from "../../../../src/services/UserOpValidation/utils/breakSignals.js";

const SIGNAL = "0x108c7aD6Dd81EA131A761B3Db9F817056D26941c" as const;
const OTHER = "0x4444444444444444444444444444444444444444" as const;
const SIGNALS: BreakSignal[] = [{ address: SIGNAL, slot: "0x0" }];

// Trace slot keys are 32-byte zero-padded hex.
const SLOT_0 = `0x${"0".repeat(64)}`;
const SLOT_1 = `0x${"0".repeat(63)}1`;

const access = (parts: Partial<EthrexAccessedSlots> = {}): EthrexAccessedSlots => ({
  reads: {},
  writes: {},
  transientReads: {},
  transientWrites: {},
  ...parts,
});

describe("onlyReadsBreakSignal", () => {
  it("allows reading a listed signal's slot, whatever the address's case", () => {
    const reads = { [SLOT_0]: ["0x" + "0".repeat(63) + "1"] };
    expect(onlyReadsBreakSignal(SIGNAL, access({ reads }), SIGNALS)).toBe(true);
    expect(onlyReadsBreakSignal(SIGNAL.toLowerCase(), access({ reads }), SIGNALS)).toBe(true);
  });

  it("refuses other slots of the signal", () => {
    const reads = { [SLOT_0]: ["0x0"], [SLOT_1]: ["0x0"] };
    expect(onlyReadsBreakSignal(SIGNAL, access({ reads }), SIGNALS)).toBe(false);
  });

  it("refuses writes and transient access", () => {
    const reads = { [SLOT_0]: ["0x0"] };
    expect(onlyReadsBreakSignal(SIGNAL, access({ reads, writes: { [SLOT_0]: 1 } }), SIGNALS)).toBe(false);
    expect(onlyReadsBreakSignal(SIGNAL, access({ transientReads: { [SLOT_0]: 1 } }), SIGNALS)).toBe(false);
    expect(onlyReadsBreakSignal(SIGNAL, access({ transientWrites: { [SLOT_0]: 1 } }), SIGNALS)).toBe(false);
  });

  it("refuses unlisted addresses", () => {
    const reads = { [SLOT_0]: ["0x0"] };
    expect(onlyReadsBreakSignal(OTHER, access({ reads }), SIGNALS)).toBe(false);
  });
});
