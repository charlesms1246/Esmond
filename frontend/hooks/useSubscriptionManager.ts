// frontend/hooks/useSubscriptionManager.ts
"use client";

import { useReadContract, useWriteContract }          from "wagmi";
import { useState, useCallback }                      from "react";
import { SUBSCRIPTION_MANAGER_ABI, ERC20_ABI }        from "@/lib/contracts/abis";
import { getContractAddresses }                       from "@/lib/contracts/addresses";
import type { TxStatus }                              from "@/lib/types";

let _subAddress: `0x${string}` | null = null;
function subAddress() {
  return (_subAddress ??= getContractAddresses().SubscriptionManager);
}

export function usePlanCount() {
  return useReadContract({
    address:      subAddress(),
    abi:          SUBSCRIPTION_MANAGER_ABI,
    functionName: "planCount",
    query:        { refetchInterval: 6000 },
  });
}

export function useCreatePlan() {
  const { writeContractAsync }  = useWriteContract();
  const [txStatus, setTxStatus] = useState<TxStatus>({ status: "idle" });

  const createPlan = useCallback(async (params: {
    token:        `0x${string}`;
    chargeAmount: bigint;
    interval:     bigint;
    maxCharges:   bigint;
    expiry:       bigint;
  }) => {
    setTxStatus({ status: "pending" });
    try {
      const hash = await writeContractAsync({
        address:      subAddress(),
        abi:          SUBSCRIPTION_MANAGER_ABI,
        functionName: "createPlan",
        args:         [params.token, params.chargeAmount, params.interval, params.maxCharges, params.expiry],
        gas:          300_000n,
      });
      setTxStatus({ status: "success", hash });
      return hash;
    } catch (err: any) {
      setTxStatus({ status: "error", error: err.shortMessage ?? err.message });
      throw err;
    }
  }, [writeContractAsync]);

  return { createPlan, txStatus };
}

export function useSubscribe() {
  const { writeContractAsync }  = useWriteContract();
  const [txStatus, setTxStatus] = useState<TxStatus>({ status: "idle" });

  const subscribe = useCallback(async (params: {
    planId:      bigint;
    approvedCap: bigint;
    token:       `0x${string}`;  // needed for ERC-20 approve step
  }) => {
    setTxStatus({ status: "pending" });
    try {
      // Step 1: approve SubscriptionManager on ERC-20 precompile
      await writeContractAsync({
        address:      params.token,
        abi:          ERC20_ABI,
        functionName: "approve",
        args:         [subAddress(), params.approvedCap],
        gas:          200_000n,
      });

      // Step 2: subscribe
      const hash = await writeContractAsync({
        address:      subAddress(),
        abi:          SUBSCRIPTION_MANAGER_ABI,
        functionName: "subscribe",
        args:         [params.planId, params.approvedCap],
        gas:          300_000n,
      });
      setTxStatus({ status: "success", hash });
      return hash;
    } catch (err: any) {
      setTxStatus({ status: "error", error: err.shortMessage ?? err.message });
      throw err;
    }
  }, [writeContractAsync]);

  return { subscribe, txStatus };
}

export function useCharge() {
  const { writeContractAsync } = useWriteContract();
  return useCallback(async (subscriptionId: bigint) => {
    return writeContractAsync({
      address:      subAddress(),
      abi:          SUBSCRIPTION_MANAGER_ABI,
      functionName: "charge",
      args:         [subscriptionId],
      gas:          300_000n,
    });
  }, [writeContractAsync]);
}

export function useRevoke() {
  const { writeContractAsync } = useWriteContract();
  return useCallback(async (subscriptionId: bigint) => {
    return writeContractAsync({
      address:      subAddress(),
      abi:          SUBSCRIPTION_MANAGER_ABI,
      functionName: "revoke",
      args:         [subscriptionId],
      gas:          200_000n,
    });
  }, [writeContractAsync]);
}
