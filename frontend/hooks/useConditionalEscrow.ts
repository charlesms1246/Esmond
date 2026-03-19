// frontend/hooks/useConditionalEscrow.ts
"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { useState, useCallback }             from "react";
import { CONDITIONAL_ESCROW_ABI, ERC20_ABI } from "@/lib/contracts/abis";
import { getContractAddresses }              from "@/lib/contracts/addresses";
import type { TxStatus }                     from "@/lib/types";

const ESCROW_ADDRESS = getContractAddresses().ConditionalEscrow;

export function useMilestoneCount() {
  return useReadContract({
    address:      ESCROW_ADDRESS,
    abi:          CONDITIONAL_ESCROW_ABI,
    functionName: "milestoneCount",
    query:        { refetchInterval: 6000 },
  });
}

export function useCreateMilestone() {
  const { writeContractAsync }  = useWriteContract();
  const [txStatus, setTxStatus] = useState<TxStatus>({ status: "idle" });

  const createMilestone = useCallback(async (params: {
    payee:             `0x${string}`;
    token:             `0x${string}`;
    amount:            bigint;
    approvers:         `0x${string}`[];
    approvalsRequired: bigint;
    disputeDeadline:   bigint;
  }) => {
    setTxStatus({ status: "pending" });
    try {
      // Step 1: approve escrow contract on ERC-20 precompile
      const approveTxHash = await writeContractAsync({
        address:      params.token,
        abi:          ERC20_ABI,
        functionName: "approve",
        args:         [ESCROW_ADDRESS, params.amount],
        gas:          200_000n,
      });
      setTxStatus({ status: "pending", hash: approveTxHash });

      // Step 2: create milestone
      const hash = await writeContractAsync({
        address:      ESCROW_ADDRESS,
        abi:          CONDITIONAL_ESCROW_ABI,
        functionName: "createMilestone",
        args: [
          params.payee,
          params.token,
          params.amount,
          params.approvers,
          params.approvalsRequired,
          params.disputeDeadline,
        ],
        gas: 500_000n,
      });
      setTxStatus({ status: "success", hash });
      return hash;
    } catch (err: any) {
      setTxStatus({ status: "error", error: err.shortMessage ?? err.message });
      throw err;
    }
  }, [writeContractAsync]);

  return { createMilestone, txStatus };
}

export function useApproveMilestone() {
  const { writeContractAsync } = useWriteContract();
  return useCallback(async (id: bigint) => {
    return writeContractAsync({
      address:      ESCROW_ADDRESS,
      abi:          CONDITIONAL_ESCROW_ABI,
      functionName: "approveMilestone",
      args:         [id],
      gas:          300_000n,
    });
  }, [writeContractAsync]);
}

export function useReclaimExpired() {
  const { writeContractAsync } = useWriteContract();
  return useCallback(async (id: bigint) => {
    return writeContractAsync({
      address:      ESCROW_ADDRESS,
      abi:          CONDITIONAL_ESCROW_ABI,
      functionName: "reclaimExpired",
      args:         [id],
      gas:          300_000n,
    });
  }, [writeContractAsync]);
}
