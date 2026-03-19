// scripts/testnet/utils.ts
import { ethers }    from "ethers";
import * as fs       from "fs";
import * as path     from "path";
import * as dotenv   from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const RPC      = process.env.PASEO_RPC_URL || "https://eth-rpc-testnet.polkadot.io/";
export const CHAIN_ID = 420420417;
export const BLOCKSCOUT = "https://blockscout-passet-hub.parity-testnet.parity.io";

export function loadAddresses() {
  const p = path.join(__dirname, "../../deployments/paseo/addresses.json");
  if (!fs.existsSync(p)) throw new Error("addresses.json not found — run deploy scripts first");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function getProvider() {
  return new ethers.JsonRpcProvider(
    RPC,
    { chainId: CHAIN_ID, name: "paseo" },
    { staticNetwork: true }
  );
}

export function getSigner(provider: ethers.JsonRpcProvider) {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set");
  return new ethers.Wallet(pk, provider);
}

export function logTx(label: string, hash: string) {
  console.log(`\n[TX] ${label}`);
  console.log(`     Hash:       ${hash}`);
  console.log(`     Explorer:   ${BLOCKSCOUT}/tx/${hash}`);
}

export async function waitConfirmed(
  provider: ethers.JsonRpcProvider,
  hash: string,
  label: string
): Promise<ethers.TransactionReceipt> {
  process.stdout.write(`Waiting for ${label}...`);
  for (let i = 0; i < 30; i++) {
    const r = await provider.getTransactionReceipt(hash);
    if (r) {
      if (r.status === 0) throw new Error(`REVERTED: ${label} (${hash})`);
      console.log(` confirmed (block ${r.blockNumber})`);
      return r;
    }
    process.stdout.write(".");
    await new Promise(r => setTimeout(r, 4000));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

// ── Minimal ABIs ────────────────────────────────────────────────────────────

export const VAULT_ABI = [
  "function deposit(address token, uint256 amount)",
  "function registerEmployee(address wallet, uint256 salary, address token, uint256 interval, uint256 cap, uint32 parachainId) returns (uint256)",
  "function runPayroll()",
  "function deactivateEmployee(uint256 id)",
  "function getEmployee(uint256 id) view returns (tuple(address wallet, uint256 salaryAmount, address payToken, uint256 payInterval, uint256 nextPaymentDue, uint256 approvedCap, uint32 parachainId, bool active))",
  "function vaultBalance(address token) view returns (uint256)",
  "function employeeCount() view returns (uint256)",
  "event PayrollExecuted(uint256 employeeCount, uint256 totalPayout)",
  "event EmployeeRegistered(uint256 indexed id, address indexed wallet, uint256 salary, uint32 parachainId)",
];

export const ESCROW_ABI = [
  "function createMilestone(address payee, address token, uint256 amount, address[] calldata approvers, uint256 approvalsRequired, uint256 disputeDeadline) returns (uint256)",
  "function approveMilestone(uint256 id)",
  "function reclaimExpired(uint256 id)",
  "function milestoneCount() view returns (uint256)",
  "event MilestoneCreated(uint256 indexed id, address indexed payer, address indexed payee, uint256 amount)",
  "event MilestoneReleased(uint256 indexed id, address indexed payee, uint256 amount)",
  "event MilestoneReclaimed(uint256 indexed id, address indexed payer, uint256 amount)",
];

export const SUBSCRIPTION_ABI = [
  "function createPlan(address token, uint256 chargeAmount, uint256 interval, uint256 maxCharges, uint256 expiry) returns (uint256)",
  "function subscribe(uint256 planId, uint256 approvedCap) returns (uint256)",
  "function charge(uint256 subscriptionId)",
  "function revoke(uint256 subscriptionId)",
  "function planCount() view returns (uint256)",
  "event PlanCreated(uint256 indexed planId, address indexed provider, address token, uint256 chargeAmount, uint256 interval)",
  "event Subscribed(uint256 indexed subscriptionId, uint256 indexed planId, address indexed subscriber, uint256 approvedCap)",
  "event Charged(uint256 indexed subscriptionId, address indexed provider, uint256 amount, uint256 nextChargeDue)",
  "event Revoked(uint256 indexed subscriptionId, address indexed subscriber)",
];

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function totalSupply() view returns (uint256)",
];

// ── Results accumulator ───────────────────────────────────────────────────────

export class TestResults {
  private results: any[] = [];
  private filename: string;

  constructor(filename: string) {
    this.filename = path.join(__dirname, "../../test/results", filename);
    const dir = path.dirname(this.filename);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  record(step: string, txHash: string, status: "PASS" | "FAIL" | "SKIP", notes?: string) {
    const entry = {
      step,
      txHash,
      explorerUrl: txHash && txHash !== "N/A" ? `${BLOCKSCOUT}/tx/${txHash}` : "",
      status,
      notes: notes || "",
      timestamp: new Date().toISOString(),
    };
    this.results.push(entry);
    console.log(`\n[${status}] ${step}`);
    if (txHash && txHash !== "N/A") console.log(`       ${BLOCKSCOUT}/tx/${txHash}`);
    if (notes)  console.log(`       Note: ${notes}`);
  }

  save() {
    const md = this.toMarkdown();
    fs.writeFileSync(this.filename, md);
    console.log(`\n📄 Results saved to: ${this.filename}`);
  }

  private toMarkdown(): string {
    const lines = [
      "# On-Chain Test Results",
      `Generated: ${new Date().toISOString()}`,
      `Network: Paseo (chainId: ${CHAIN_ID})`,
      "",
      "| Step | Status | TX Hash | Notes |",
      "|------|--------|---------|-------|",
    ];
    for (const r of this.results) {
      const hashCell = r.txHash && r.txHash !== "N/A"
        ? `[${r.txHash.slice(0,10)}...](${r.explorerUrl})`
        : r.txHash || "—";
      lines.push(`| ${r.step} | ${r.status} | ${hashCell} | ${r.notes} |`);
    }
    const passed = this.results.filter(r => r.status === "PASS").length;
    const failed = this.results.filter(r => r.status === "FAIL").length;
    const skipped = this.results.filter(r => r.status === "SKIP").length;
    lines.push("", `**Total: ${passed} PASS, ${failed} FAIL, ${skipped} SKIP**`);
    return lines.join("\n");
  }
}
