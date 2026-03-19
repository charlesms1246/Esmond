// frontend/hooks/usePayrollVault.ts
"use client";

import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { useState, useCallback }                         from "react";
import { PAYROLL_VAULT_ABI, ERC20_ABI }                  from "@/lib/contracts/abis";
import { getContractAddresses }                          from "@/lib/contracts/addresses";
import type { TxStatus }                                 from "@/lib/types";

const ADDRESSES = getContractAddresses();

// ─── Read: employee count ─────────────────────────────────────────────────
export function useEmployeeCount() {
  return useReadContract({
    address:      ADDRESSES.PayrollVault,
    abi:          PAYROLL_VAULT_ABI,
    functionName: "employeeCount",
  });
}

// ─── Read: single employee by ID ─────────────────────────────────────────
export function useEmployee(id: bigint | undefined) {
  return useReadContract({
    address:      ADDRESSES.PayrollVault,
    abi:          PAYROLL_VAULT_ABI,
    functionName: "getEmployee",
    args:         id !== undefined ? [id] : undefined,
    query:        { enabled: id !== undefined },
  });
}

// ─── Read: vault balance for a token ─────────────────────────────────────
export function useVaultTokenBalance(tokenAddress?: `0x${string}`) {
  return useReadContract({
    address:      ADDRESSES.PayrollVault,
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
    args:         address ? [address, ADDRESSES.PayrollVault] : undefined,
    query:        { enabled: !!tokenAddress && !!address },
  });
}

// ─── Write: deposit ───────────────────────────────────────────────────────
/**
 * Composed hook: approve ERC-20 allowance, then deposit.
 * Step 1: approve(vault, amount) on the ERC-20 precompile
 * Step 2: deposit(token, amount) on PayrollVault
 */
export function useDeposit() {
  const { writeContractAsync }  = useWriteContract();
  const [txStatus, setTxStatus] = useState<TxStatus>({ status: "idle" });

  const deposit = useCallback(async (
    tokenAddress: `0x${string}`,
    amount:       bigint,
  ) => {
    setTxStatus({ status: "pending" });
    try {
      // Step 1: approve
      const approveTxHash = await writeContractAsync({
        address:      tokenAddress,
        abi:          ERC20_ABI,
        functionName: "approve",
        args:         [ADDRESSES.PayrollVault, amount],
        gas:          200_000n,
      });
      setTxStatus({ status: "pending", hash: approveTxHash });

      // Step 2: deposit
      const depositTxHash = await writeContractAsync({
        address:      ADDRESSES.PayrollVault,
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
  }, [writeContractAsync]);

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
        address:      ADDRESSES.PayrollVault,
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
        address:      ADDRESSES.PayrollVault,
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
      address:      ADDRESSES.PayrollVault,
      abi:          PAYROLL_VAULT_ABI,
      functionName: "deactivateEmployee",
      args:         [id],
      gas:          150_000n,
    });
  }, [writeContractAsync]);
}
