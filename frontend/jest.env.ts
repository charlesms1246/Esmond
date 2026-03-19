// jest.env.ts — sets NEXT_PUBLIC_* env vars for test environment
// Runs before all test modules load (listed in setupFiles in jest.config.ts)
// Uses .env.local values so tests use the same addresses as the dev server

process.env.NEXT_PUBLIC_PAYROLL_VAULT_ADDRESS        ||= "0xFebcB30Ff5c4894Ad2615237A1211771db865e5E";
process.env.NEXT_PUBLIC_CONDITIONAL_ESCROW_ADDRESS   ||= "0x5a7c76a67E231DfE89b29c8Fd0f82d2A2697BAaA";
process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS ||= "0x29420F825ED2D26970BDfB8eCDB03F0ba1B94679";
process.env.NEXT_PUBLIC_ACTIVE_SCHEDULER_ADDRESS     ||= "0x4AF0E18ec88C5EE520378e1c2ad65862120E4bCB";
process.env.NEXT_PUBLIC_PASEO_RPC_URL                ||= "https://eth-rpc-testnet.polkadot.io/";
process.env.NEXT_PUBLIC_PASEO_WS_URL                 ||= "wss://asset-hub-paseo-rpc.n.dwellir.com";
