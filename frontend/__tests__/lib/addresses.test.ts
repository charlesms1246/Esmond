// frontend/__tests__/lib/addresses.test.ts

import {
  CHAIN_ID, PRECOMPILES, ASSET_IDS, TOKEN_CONFIG,
  PARACHAIN_IDS, PARACHAIN_NAMES,
} from "@/lib/contracts/addresses";

describe("addresses.ts — constants", () => {
  it("CHAIN_ID is Paseo value", () => {
    expect(CHAIN_ID).toBe(420420417);
  });

  it("XCM precompile address is correct", () => {
    expect(PRECOMPILES.XCM.toLowerCase()).toBe(
      "0x00000000000000000000000000000000000a0000"
    );
  });

  it("Mock USDC precompile encodes asset ID 1984 (0x7C0)", () => {
    // 1984 = 0x7C0 → address ends in 07c0
    expect(PRECOMPILES.MOCK_USDC.toLowerCase()).toContain("07c0");
  });

  it("Mock USDT precompile encodes asset ID 1337 (0x539)", () => {
    // 1337 = 0x539 → address ends in 0539
    expect(PRECOMPILES.MOCK_USDT.toLowerCase()).toContain("0539");
  });

  it("ASSET_IDS match expected values", () => {
    expect(ASSET_IDS.MOCK_USDC).toBe(1984);
    expect(ASSET_IDS.MOCK_USDT).toBe(1337);
  });

  it("TOKEN_CONFIG has correct decimals for mUSDC", () => {
    expect(TOKEN_CONFIG.mUSDC.decimals).toBe(6);
    expect(TOKEN_CONFIG.mUSDC.assetId).toBe(1984);
  });

  it("PARACHAIN_NAMES has entry for Hub (0)", () => {
    expect(PARACHAIN_NAMES[0]).toBe("Polkadot Hub");
  });

  it("PARACHAIN_NAMES has entry for Moonbeam (2004)", () => {
    expect(PARACHAIN_NAMES[2004]).toBe("Moonbeam");
  });

  it("getContractAddresses() throws if env var missing", () => {
    const saved = process.env.NEXT_PUBLIC_PAYROLL_VAULT_ADDRESS;
    delete process.env.NEXT_PUBLIC_PAYROLL_VAULT_ADDRESS;
    // Bust require cache so the module re-evaluates
    jest.resetModules();
    const { getContractAddresses } = require("@/lib/contracts/addresses");
    expect(() => getContractAddresses()).toThrow(/NEXT_PUBLIC_PAYROLL_VAULT_ADDRESS/);
    process.env.NEXT_PUBLIC_PAYROLL_VAULT_ADDRESS = saved;
    jest.resetModules();
  });
});
