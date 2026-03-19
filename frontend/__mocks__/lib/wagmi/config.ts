// Stub for lib/wagmi/config — used in API route tests (node env)
// The real module imports wagmi/connectors (ESM) which Jest can't process in CJS mode.
// API tests mock viem entirely, so only the paseo chain object is needed here.
export const paseo = {
  id:   420420417,
  name: "Polkadot Hub Testnet",
};

export const wagmiConfig = {};
