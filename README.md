<div align="center">

 <img width="400" height="400" alt="logo-main" src="https://github.com/user-attachments/assets/1bdcb799-5722-4325-b3a1-ca65468b8393" />

 ### Programmable Payment Engine on Polkadot Hub
 </div>

## ABOUT
Esmond is a programmable on-chain payment engine built natively on Polkadot Hub. It unifies three essential payment primitives — **recurring payroll**, **milestone escrow**, and **subscription billing** — into a single coherent platform powered by native Asset Hub stablecoins, XCM cross-chain routing, and Rust/PVM compute offload.
 
Unlike existing crypto payroll tools such as Bitwage and Request Finance, which operate off-chain and cannot enforce payment logic at the smart contract level, Esmond brings all three primitives on-chain on Polkadot for the first time. Every transfer uses the Asset Hub ERC-20 precompile directly — no wrapped tokens, no synthetic contracts, no bridge risk.

---
 
## PROBLEM
 
Web3 teams, DAOs, and freelance-first companies face three payment problems that together create a fragmented, trust-dependent stack that defeats the promise of programmable money.
 
### 1. Cross-border payroll is slow and expensive
SWIFT-based payroll carries 2–5% FX fees and 3–5 day settlement windows. Existing crypto payroll tools cannot enforce payment logic on-chain and have no cross-parachain reach. A DAO in Singapore paying contributors across Vietnam, India, and Japan should not need three separate payment rails.
 
### 2. Milestone payments require trusted intermediaries
Deliverable-based contractor payments today depend on platforms like Upwork — centralised escrow taking a 20% cut with its own dispute rules. There is no trustless, on-chain mechanism on Polkadot that locks funds at project start, releases them on multi-party approval, and returns them automatically if the deadline passes.
 
### 3. Subscription retainers have no on-chain primitive
Ongoing service retainers — DAO contributor stipends, recurring SaaS fees, protocol grants — require manual payment execution each cycle. This creates reliability risk and operational overhead. Smart contracts should be doing this work.
 
---
 
## SOLUTION
 
Esmond addresses all three problems with a unified on-chain payment stack. The three primitives are not bolted together — they share a common token layer, a common compute layer, and a common cross-chain layer.
 
###  Payroll Vault
Employers deposit stablecoins into a vault and register employees with wallet addresses, salary amounts, pay intervals, approved caps, and a destination parachain ID. On `runPayroll()`, a Rust/PVM contract filters due employees and enforces caps, then the vault routes payments via XCM — same-block settlement for Hub employees, cross-parachain dispatch for contributors on Moonbeam, Astar, or Hydration — all in a single atomic transaction.

_Idea: https://build.openguild.wtf/hackathon-ideas/105_
 
###  Milestone Escrow
Funds are locked at project start and released to the payee only when a configured approval threshold is met (single-approver or multi-sig N-of-M). If the dispute deadline passes without sufficient approval, the payer automatically reclaims the full amount. No intermediary, no platform fee, no trusted third party.

_Idea: https://build.openguild.wtf/hackathon-ideas/122_
 
###  Subscription Manager
Service providers create billing plans with a charge amount and interval. Subscribers opt in with an **approved cap** — a hard ceiling on total charges they authorise. The provider calls `charge()` each cycle. The cap is enforced in the contract independently of the ERC-20 allowance, and subscribers can revoke at any time.

_Idea: https://build.openguild.wtf/hackathon-ideas/103_
 
---


## ARCHITECTURE

```
╔═══════════════════════════════════════════════════════════════════════╗
║                         ESMOND — SYSTEM LAYERS                        ║
╠═══════════════════════════════════════════════════════════════════════╣
║  BROWSER                                                              ║
║  Next.js 16 · wagmi/viem (EVM calls) · PAPI (substrate queries)       ║
╠═══════════════════════════════════════════════════════════════════════╣
║  EVM LAYER (REVM on Paseo)                                            ║
║  PayrollVault.sol ──► IPayrollScheduler (cross-VM) ──► Rust/PVM       ║
║  ConditionalEscrow.sol                                                ║
║  SubscriptionManager.sol                                              ║
╠═══════════════════════════════════════════════════════════════════════╣
║  PRECOMPILE LAYER                                                     ║
║  ERC-20 Precompile  0xFFFFFFFF...{assetId}  (Asset Hub assets)        ║
║  XCM Precompile     0x00...000A0000          execute() / send()       ║
╠═══════════════════════════════════════════════════════════════════════╣
║  PVM LAYER (pallet_revive)                                            ║
║  PayrollScheduler.rs — stateless, pure compute, zero token access     ║
╠═══════════════════════════════════════════════════════════════════════╣
║  SUBSTRATE LAYER                                                      ║
║  Assets Pallet · XCM Pallet · Revive Pallet                           ║
║  XCM routing: Hub → execute() same block | cross-chain → send()       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

## INFRASTRUCTURE

Every primitive (Payroll, Escrow, Subscriptions) shares the same three layers:

**Layer 1 — ERC-20 Precompile (Token Layer)**
All token operations call the Asset Hub ERC-20 precompile at deterministic addresses. No custom token contracts exist. Tokens remain native Assets pallet entries throughout — no bridge risk.

**Layer 2 — PVM Compute (PayrollScheduler)**
A stateless Rust contract compiled via `pallet_revive` to RISC-V PVM bytecode handles all payroll computation: timestamp filtering, cap enforcement, amount calculation. The Dual VM Stack routes the Solidity → Rust call transparently within the same transaction.

**Layer 3 — XCM Routing**
`PayrollVault` reads each employee's `parachainId` and routes via the XCM precompile: `parachainId == 0` dispatches `execute()` for same-block Hub settlement; `parachainId > 0` dispatches `send()` to the destination chain via HRMP.

---

## DEPLOYED CONTRACTS

| Contract | Address|
|---|---|
| PayrollScheduler | [0x4AF0E18ec88C5EE520378e1c2ad65862120E4bCB](https://blockscout-testnet.polkadot.io/address/0x4AF0E18ec88C5EE520378e1c2ad65862120E4bCB) |
| PayrollVault | [0x2bd64C1f0505fF20869EEcd06c05c3F1D138AF21](https://blockscout-testnet.polkadot.io/address/0x2bd64C1f0505fF20869EEcd06c05c3F1D138AF21) |
| ConditionalEscrow | [0x5a7c76a67E231DfE89b29c8Fd0f82d2A2697BAaA](https://blockscout-testnet.polkadot.io/address/0x5a7c76a67E231DfE89b29c8Fd0f82d2A2697BAaA) |
| SubscriptionManager | [0x29420F825ED2D26970BDfB8eCDB03F0ba1B94679](https://blockscout-testnet.polkadot.io/address/90x29420F825ED2D26970BDfB8eCDB03F0ba1B94679) |

Note: All contracts are deployed on paseo testnet, please use https://blockscout-testnet.polkadot.io/ to explore the contracts

## SECURITY

| Property | Mechanism |
|----------|-----------|
| Reentrancy | `ReentrancyGuard` on `runPayroll()`, `approveMilestone()`, `reclaimExpired()`, `charge()` |
| Access control | `Ownable` for admin functions; `onlyApprover` modifier; subscriber-only `revoke()` |
| Overflow protection | Solidity 0.8.x built-in; no SafeMath needed |
| No SafeERC20 needed | Precompile always reverts on failure; never returns false |
| Vault preflight | `balanceOf(vault) >= totalPayout` checked before any XCM dispatch |
| Cap enforcement | Enforced in Rust (before Solidity) **and** double-checked in Solidity |
| XCM atomicity | If any `execute()`/`send()` reverts, entire `runPayroll()` transaction rolls back |
| PVM attack surface | `PayrollScheduler.rs` is stateless, no storage, no token access — zero attack surface |
| Escrow reclaim path | `disputeDeadline` ensures payer always has a fund recovery path; funds never permanently locked |
| No synthetic tokens | All transfers go through Asset Hub ERC-20 precompile; Esmond deploys zero ERC-20 contracts |

## FUTURE SCOPE
- **Tax reporting module:** <br>
      Off-chain indexer (SubSquid) aggregates payment events into downloadable tax reports per employee.
- **Multi-token payroll:** <br>
      Per-employee token selection — one employee paid in USDC, another in USDT, within the same payroll run.
- **Fiat on/off ramp integration:** <br>
      Partner with a fiat gateway to allow employers to top up the vault directly from a bank account.
- **Native mobile app:** <br>
      React Native companion app for employees to track incoming payments and manage subscription authorisations.
<br><br><br>
<div align="center">

<h3>Built By

[Charles](https://github.com/charlesms1246) x [Immanuel](https://github.com/xavio2495)

</h3>
</div>

---
