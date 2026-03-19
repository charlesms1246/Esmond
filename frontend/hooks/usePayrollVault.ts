// frontend/hooks/usePayrollVault.ts
"use client";

import { useReadContract, useWriteContract, useAccount, usePublicClient } from "wagmi";
import { useState, useCallback }                         from "react";
import { PAYROLL_VAULT_ABI, ERC20_ABI }                  from "@/lib/contracts/abis";
import { getContractAddresses }                          from "@/lib/contracts/addresses";
import type { TxStatus }                                 from "@/lib/types";

let _addresses: ReturnType<typeof getContractAddresses> | null = null;
function addresses() {
  return (_addresses ??= getContractAddresses());
}

// ─── Read: employee count ─────────────────────────────────────────────────
export function useEmployeeCount() {
  return useReadContract({
    address:      addresses().PayrollVault,
    abi:          PAYROLL_VAULT_ABI,
    functionName: "employeeCount",
    query:        { refetchInterval: 6000 },
  });
}

// ─── Read: single employee by ID ─────────────────────────────────────────
export function useEmployee(id: bigint | undefined) {
  return useReadContract({
    address:      addresses().PayrollVault,
    abi:          PAYROLL_VAULT_ABI,
    functionName: "getEmployee",
    args:         id !== undefined ? [id] : undefined,
    query:        { enabled: id !== undefined },
  });
}

// ─── Read: vault balance for a token ─────────────────────────────────────
export function useVaultTokenBalance(tokenAddress?: `0x${string}`) {
  return useReadContract({
    address:      addresses().PayrollVault,
    abi:          PAYROLL_VAULT_ABI,
    functionName: "vaultBalance",
    args:         tokenAddress ? [tokenAddress] : undefined,
    query:        { enabled: !!tokenAddress, refetchInterval: 6000 },
  });
}

// ─── Read: user's token allowance for the vault ───────────────────────────
export function useVaultAllowance(tokenAddress?: `0x${string}`) {
  const { address } = useAccount();
  return useReadContract({
    address:      tokenAddress,
    abi:          ERC20_ABI,
    functionName: "allowance",
    args:         address ? [address, addresses().PayrollVault] : undefined,
    query:        { enabled: !!tokenAddress && !!address },
  });
}

// ─── Write: deposit ───────────────────────────────────────────────────────
/**
 * Composed hook: approve ERC-20 allowance, wait for confirmation, then deposit.
 * Step 1: approve(vault, amount) on the ERC-20 precompile
 * Step 2: wait for approve tx to be mined (required — deposit calls transferFrom)
 * Step 3: deposit(token, amount) on PayrollVault
 */
export function useDeposit() {
  const { writeContractAsync }  = useWriteContract();
  const publicClient            = usePublicClient();
  const [txStatus, setTxStatus] = useState<TxStatus>({ status: "idle" });

  const deposit = useCallback(async (
    tokenAddress: `0x${string}`,
    amount:       bigint,
  ) => {
    if (!publicClient) throw new Error("No public client");
    setTxStatus({ status: "pending" });
    try {
      // Step 1: approve
      const approveTxHash = await writeContractAsync({
        address:      tokenAddress,
        abi:          ERC20_ABI,
        functionName: "approve",
        args:         [addresses().PayrollVault, amount],
        gas:          200_000n,
      });
      setTxStatus({ status: "pending", hash: approveTxHash });

      // Step 2: wait for approval to be mined before transferFrom can succeed
      await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

      // Step 3: deposit
      const depositTxHash = await writeContractAsync({
        address:      addresses().PayrollVault,
        abi:          PAYROLL_VAULT_ABI,
        functionName: "deposit",
        args:         [tokenAddress, amount],
        gas:          300_000n,
      });
      setTxStatus({ status: "success", hash: depositTxHash });
      return depositTxHash;
    } catch (err: any) {
      setTxStatus({ status: "error", error: err.shortMessage ?? err.message });
      throw err;
    }
  }, [writeContractAsync, publicClient]);

  return { deposit, txStatus };
}

// ─── Write: register employee ─────────────────────────────────────────────
export function useRegisterEmployee() {
  const { writeContractAsync }  = useWriteContract();
  const [txStatus, setTxStatus] = useState<TxStatus>({ status: "idle" });

  const registerEmployee = useCallback(async (params: {
    wallet:      `0x${string}`;
    salary:      bigint;
    token:       `0x${string}`;
    interval:    bigint;
    cap:         bigint;
    parachainId: number;
  }) => {
    setTxStatus({ status: "pending" });
    try {
      const hash = await writeContractAsync({
        address:      addresses().PayrollVault,
        abi:          PAYROLL_VAULT_ABI,
        functionName: "registerEmployee",
        args: [
          params.wallet,
          params.salary,
          params.token,
          params.interval,
          params.cap,
          params.parachainId,
        ],
        gas: 300_000n,
      });
      setTxStatus({ status: "success", hash });
      return hash;
    } catch (err: any) {
      setTxStatus({ status: "error", error: err.shortMessage ?? err.message });
      throw err;
    }
  }, [writeContractAsync]);

  return { registerEmployee, txStatus };
}

// ─── Write: run payroll ───────────────────────────────────────────────────
export function useRunPayroll() {
  const { writeContractAsync }  = useWriteContract();
  const [txStatus, setTxStatus] = useState<TxStatus>({ status: "idle" });

  const runPayroll = useCallback(async () => {
    setTxStatus({ status: "pending" });
    try {
      const hash = await writeContractAsync({
        address:      addresses().PayrollVault,
        abi:          PAYROLL_VAULT_ABI,
        functionName: "runPayroll",
        gas:          2_000_000n,  // generous limit for XCM + cross-VM calls
      });
      setTxStatus({ status: "success", hash });
      return hash;
    } catch (err: any) {
      setTxStatus({ status: "error", error: err.shortMessage ?? err.message });
      throw err;
    }
  }, [writeContractAsync]);

  return { runPayroll, txStatus };
}

// ─── Write: deactivate employee ───────────────────────────────────────────
export function useDeactivateEmployee() {
  const { writeContractAsync } = useWriteContract();
  return useCallback(async (id: bigint) => {
    return writeContractAsync({
      address:      addresses().PayrollVault,
      abi:          PAYROLL_VAULT_ABI,
      functionName: "deactivateEmployee",
      args:         [id],
      gas:          150_000n,
    });
  }, [writeContractAsync]);
}
