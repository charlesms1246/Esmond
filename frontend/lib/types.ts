// frontend/lib/types.ts

import type { ParachainId } from "./contracts/addresses";

// ─── Employee ─────────────────────────────────────────────────────────────
export interface Employee {
  id:             bigint;
  wallet:         `0x${string}`;
  salaryAmount:   bigint;
  payToken:       `0x${string}`;
  payInterval:    bigint;          // seconds
  nextPaymentDue: bigint;          // unix timestamp
  approvedCap:    bigint;
  parachainId:    number;
  active:         boolean;
}

// ─── Milestone ────────────────────────────────────────────────────────────
export interface Milestone {
  id:                bigint;
  payer:             `0x${string}`;
  payee:             `0x${string}`;
  token:             `0x${string}`;
  amount:            bigint;
  approvers:         `0x${string}`[];
  approvalsRequired: bigint;
  approvalCount:     bigint;
  disputeDeadline:   bigint;       // unix timestamp
  released:          boolean;
  reclaimed:         boolean;
}

// ─── Plan ─────────────────────────────────────────────────────────────────
export interface Plan {
  id:           bigint;
  provider:     `0x${string}`;
  token:        `0x${string}`;
  chargeAmount: bigint;
  interval:     bigint;            // seconds
  maxCharges:   bigint;            // 0 = unlimited
  chargeCount:  bigint;
  expiry:       bigint;            // 0 = no expiry
  active:       boolean;
}

// ─── Subscription ─────────────────────────────────────────────────────────
export interface Subscription {
  id:            bigint;
  subscriber:    `0x${string}`;
  planId:        bigint;
  approvedCap:   bigint;
  totalCharged:  bigint;
  nextChargeDue: bigint;           // unix timestamp
  active:        boolean;
}

// ─── API Response shapes ──────────────────────────────────────────────────
// Serialisable versions (bigint → string) for JSON API routes
export interface EmployeeDTO {
  id:             string;
  wallet:         string;
  salaryAmount:   string;
  payToken:       string;
  payInterval:    string;
  nextPaymentDue: string;
  approvedCap:    string;
  parachainId:    number;
  parachainName:  string;
  active:         boolean;
}

export interface MilestoneDTO {
  id:                string;
  payer:             string;
  payee:             string;
  token:             string;
  amount:            string;
  approvers:         string[];
  approvalsRequired: string;
  approvalCount:     string;
  disputeDeadline:   string;
  status:            "active" | "released" | "reclaimed" | "expired";
}

export interface SubscriptionDTO {
  id:            string;
  subscriber:    string;
  planId:        string;
  approvedCap:   string;
  totalCharged:  string;
  nextChargeDue: string;
  active:        boolean;
}

// ─── Tx status ────────────────────────────────────────────────────────────
export type TxStatus =
  | { status: "idle"    }
  | { status: "pending"; hash?: string }
  | { status: "success"; hash: string  }
  | { status: "error";   error: string };
