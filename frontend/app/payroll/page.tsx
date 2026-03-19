"use client";

import { useState }         from "react";
import { useAccount }       from "wagmi";
import { VaultBalance }     from "@/components/VaultBalance";
import { PayrollRoster }    from "@/components/PayrollRoster";
import { EmployeeForm }     from "@/components/EmployeeForm";
import { TxStatusBadge }    from "@/components/TxStatusBadge";
import { useDeposit, useRunPayroll, useEmployeeCount } from "@/hooks/usePayrollVault";
import { MOCK_ERC20_ADDRESS } from "@/lib/contracts/addresses";
import { parseUnits }       from "viem";

export default function PayrollPage() {
  const { isConnected }  = useAccount();
  const [showForm,   setShowForm]   = useState(false);
  const [depositAmt, setDepositAmt] = useState("");
  const { deposit,    txStatus: depositStatus }  = useDeposit();
  const { runPayroll, txStatus: payrollStatus }  = useRunPayroll();
  const { data: empCount } = useEmployeeCount();

  async function handleDeposit() {
    if (!depositAmt) return;
    await deposit(MOCK_ERC20_ADDRESS, parseUnits(depositAmt, 6)).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payroll Vault</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Recurring salary payments via Asset Hub + XCM routing
          </p>
        </div>
        {isConnected && (
          <button onClick={() => setShowForm(v => !v)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ background: "var(--dot-pink)" }}>
            + Add Employee
          </button>
        )}
      </div>

      {/* Vault stats — visible to all */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-6 sm:col-span-2"
             style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <VaultBalance />
        </div>
        <div className="rounded-2xl border p-6 flex flex-col justify-between"
             style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-2">Employees</p>
          <p className="text-3xl font-bold">{String(empCount ?? 0n)}</p>
          {isConnected ? (
            <>
              <button onClick={() => runPayroll().catch(() => {})}
                      disabled={payrollStatus.status === "pending"}
                      className="mt-4 w-full py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                      style={{ background: "var(--dot-pink)" }}>
                {payrollStatus.status === "pending" ? "Running…" : "Run Payroll"}
              </button>
              <div className="mt-2"><TxStatusBadge status={payrollStatus} /></div>
            </>
          ) : (
            <p className="mt-4 text-xs text-[var(--text-muted)]">Connect wallet to run payroll</p>
          )}
        </div>
      </div>

      {/* Deposit section — wallet required */}
      {isConnected ? (
        <div className="rounded-2xl border p-6"
             style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <h2 className="text-lg font-semibold mb-4">Fund Vault</h2>
          <div className="flex gap-3">
            <input type="number" min="0" step="1" placeholder="Amount in tUSDC"
                   value={depositAmt} onChange={e => setDepositAmt(e.target.value)}
                   className="flex-1 rounded-lg border px-3 py-2.5 text-sm"
                   style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
            <button onClick={handleDeposit} disabled={depositStatus.status === "pending"}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: "var(--dot-pink)" }}>
              Deposit
            </button>
          </div>
          <div className="mt-2"><TxStatusBadge status={depositStatus} /></div>
        </div>
      ) : (
        <div className="rounded-2xl border p-4 text-center text-sm text-[var(--text-muted)]"
             style={{ borderColor: "var(--border-subtle)" }}>
          Connect your wallet to deposit funds or register employees.
        </div>
      )}

      {/* Employee form modal */}
      {isConnected && showForm && (
        <div className="rounded-2xl border p-6"
             style={{ background: "var(--bg-card)", borderColor: "var(--dot-pink)" }}>
          <h2 className="text-lg font-semibold mb-4">Register Employee</h2>
          <EmployeeForm
            onSuccess={() => setShowForm(false)}
            onClose={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Roster — visible to all */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Employee Roster</h2>
        <PayrollRoster />
      </div>
    </div>
  );
}
