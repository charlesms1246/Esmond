// frontend/lib/contracts/abis.ts
/**
 * Typed ABIs for all Esmond contracts.
 * These match the deployed Solidity contracts exactly.
 * Used by wagmi useReadContract / useWriteContract hooks.
 */

export const PAYROLL_VAULT_ABI = [
  // ── View functions ───────────────────────────────────────────────────────
  {
    type: "function", name: "employeeCount",
    inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view",
  },
  {
    type: "function", name: "owner",
    inputs: [], outputs: [{ type: "address" }], stateMutability: "view",
  },
  {
    type: "function", name: "schedulerContract",
    inputs: [], outputs: [{ type: "address" }], stateMutability: "view",
  },
  {
    type: "function", name: "vaultBalance",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }], stateMutability: "view",
  },
  {
    type: "function", name: "getEmployee",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "wallet",         type: "address" },
        { name: "salaryAmount",   type: "uint256" },
        { name: "payToken",       type: "address" },
        { name: "payInterval",    type: "uint256" },
        { name: "nextPaymentDue", type: "uint256" },
        { name: "approvedCap",    type: "uint256" },
        { name: "parachainId",    type: "uint32"  },
        { name: "active",         type: "bool"    },
      ],
    }],
    stateMutability: "view",
  },
  // ── Write functions ──────────────────────────────────────────────────────
  {
    type: "function", name: "deposit",
    inputs: [
      { name: "token",  type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "registerEmployee",
    inputs: [
      { name: "wallet",      type: "address" },
      { name: "salary",      type: "uint256" },
      { name: "token",       type: "address" },
      { name: "interval",    type: "uint256" },
      { name: "cap",         type: "uint256" },
      { name: "parachainId", type: "uint32"  },
    ],
    outputs: [{ name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "runPayroll",
    inputs: [], outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "deactivateEmployee",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable",
  },
  // ── Events ───────────────────────────────────────────────────────────────
  {
    type: "event", name: "VaultDeposited",
    inputs: [
      { name: "token",  type: "address", indexed: true  },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "EmployeeRegistered",
    inputs: [
      { name: "id",          type: "uint256", indexed: true  },
      { name: "wallet",      type: "address", indexed: true  },
      { name: "salary",      type: "uint256", indexed: false },
      { name: "parachainId", type: "uint32",  indexed: false },
    ],
  },
  {
    type: "event", name: "PayrollExecuted",
    inputs: [
      { name: "employeeCount", type: "uint256", indexed: false },
      { name: "totalPayout",   type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "EmployeeDeactivated",
    inputs: [{ name: "id", type: "uint256", indexed: true }],
  },
] as const;

export const CONDITIONAL_ESCROW_ABI = [
  {
    type: "function", name: "milestoneCount",
    inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view",
  },
  {
    type: "function", name: "createMilestone",
    inputs: [
      { name: "payee",             type: "address"   },
      { name: "token",             type: "address"   },
      { name: "amount",            type: "uint256"   },
      { name: "approvers",         type: "address[]" },
      { name: "approvalsRequired", type: "uint256"   },
      { name: "disputeDeadline",   type: "uint256"   },
    ],
    outputs: [{ name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "approveMilestone",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "reclaimExpired",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "event", name: "MilestoneCreated",
    inputs: [
      { name: "id",     type: "uint256", indexed: true  },
      { name: "payer",  type: "address", indexed: true  },
      { name: "payee",  type: "address", indexed: true  },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "MilestoneReleased",
    inputs: [
      { name: "id",     type: "uint256", indexed: true  },
      { name: "payee",  type: "address", indexed: true  },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "MilestoneReclaimed",
    inputs: [
      { name: "id",     type: "uint256", indexed: true  },
      { name: "payer",  type: "address", indexed: true  },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const SUBSCRIPTION_MANAGER_ABI = [
  {
    type: "function", name: "planCount",
    inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view",
  },
  {
    type: "function", name: "subscriptionCount",
    inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view",
  },
  {
    type: "function", name: "createPlan",
    inputs: [
      { name: "token",        type: "address" },
      { name: "chargeAmount", type: "uint256" },
      { name: "interval",     type: "uint256" },
      { name: "maxCharges",   type: "uint256" },
      { name: "expiry",       type: "uint256" },
    ],
    outputs: [{ name: "planId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "subscribe",
    inputs: [
      { name: "planId",      type: "uint256" },
      { name: "approvedCap", type: "uint256" },
    ],
    outputs: [{ name: "subscriptionId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "charge",
    inputs: [{ name: "subscriptionId", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "revoke",
    inputs: [{ name: "subscriptionId", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "event", name: "PlanCreated",
    inputs: [
      { name: "planId",       type: "uint256", indexed: true  },
      { name: "provider",     type: "address", indexed: true  },
      { name: "token",        type: "address", indexed: false },
      { name: "chargeAmount", type: "uint256", indexed: false },
      { name: "interval",     type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "Subscribed",
    inputs: [
      { name: "subscriptionId", type: "uint256", indexed: true  },
      { name: "subscriber",     type: "address", indexed: true  },
      { name: "planId",         type: "uint256", indexed: true  },
      { name: "approvedCap",    type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "Charged",
    inputs: [
      { name: "subscriptionId", type: "uint256", indexed: true  },
      { name: "provider",       type: "address", indexed: true  },
      { name: "amount",         type: "uint256", indexed: false },
      { name: "nextChargeDue",  type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "Revoked",
    inputs: [
      { name: "subscriptionId", type: "uint256", indexed: true  },
      { name: "subscriber",     type: "address", indexed: true  },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function", name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }], stateMutability: "view",
  },
  {
    type: "function", name: "allowance",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ type: "uint256" }], stateMutability: "view",
  },
  {
    type: "function", name: "approve",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "decimals",
    inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view",
  },
  {
    type: "function", name: "symbol",
    inputs: [], outputs: [{ type: "string" }], stateMutability: "view",
  },
] as const;
