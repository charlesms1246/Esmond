// frontend/app/api/payroll/route.ts
/**
 * GET /api/payroll
 * Returns the full employee roster from PayrollVault on-chain state.
 * Reads directly from chain via viem — no database.
 */

import { NextResponse }                           from "next/server";
import { createPublicClient, http }               from "viem";
import { paseo }                                  from "@/lib/wagmi/config";
import { PAYROLL_VAULT_ABI }                      from "@/lib/contracts/abis";
import { getContractAddresses, PARACHAIN_NAMES }  from "@/lib/contracts/addresses";
import type { EmployeeDTO }                       from "@/lib/types";

export async function GET() {
  try {
    const client    = createPublicClient({ chain: paseo, transport: http() });
    const addresses = getContractAddresses();
    const vaultAddr = addresses.PayrollVault;

    // Get total employee count
    const count = await client.readContract({
      address:      vaultAddr,
      abi:          PAYROLL_VAULT_ABI,
      functionName: "employeeCount",
    }) as bigint;

    // Fetch each employee in parallel (cap at 50)
    const limit = Number(count) > 50 ? 50 : Number(count);
    const employeePromises = Array.from({ length: limit }, (_, i) =>
      client.readContract({
        address:      vaultAddr,
        abi:          PAYROLL_VAULT_ABI,
        functionName: "getEmployee",
        args:         [BigInt(i)],
      })
    );
    const employees = await Promise.all(employeePromises) as any[];

    const dtos: EmployeeDTO[] = employees.map((emp, i) => ({
      id:             String(i),
      wallet:         emp.wallet,
      salaryAmount:   String(emp.salaryAmount),
      payToken:       emp.payToken,
      payInterval:    String(emp.payInterval),
      nextPaymentDue: String(emp.nextPaymentDue),
      approvedCap:    String(emp.approvedCap),
      parachainId:    emp.parachainId,
      parachainName:  PARACHAIN_NAMES[emp.parachainId as keyof typeof PARACHAIN_NAMES] ?? `Chain ${emp.parachainId}`,
      active:         emp.active,
    }));

    return NextResponse.json(
      { employees: dtos, total: Number(count) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
