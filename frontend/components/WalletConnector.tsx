"use client";

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { useState } from "react";
import { CHAIN_ID }  from "@/lib/contracts/addresses";

export function WalletConnector() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect }   = useDisconnect();
  const chainId          = useChainId();
  const { switchChain }  = useSwitchChain();
  const [showMenu, setShowMenu] = useState(false);

  const isWrongChain = isConnected && chainId !== CHAIN_ID;
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  if (isWrongChain) {
    return (
      <button
        onClick={() => switchChain({ chainId: CHAIN_ID })}
        className="px-4 py-2 rounded-lg text-sm font-medium"
        style={{ background: "var(--warning)", color: "#000" }}
      >
        Switch to Paseo
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(v => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: "var(--border)", background: "var(--bg-card)", color: "var(--text-primary)" }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: "var(--success)" }}
            aria-label="Connected"
          />
          <span className="font-mono">{short}</span>
        </button>
        {showMenu && (
          <div
            className="absolute right-0 top-full mt-2 w-48 rounded-xl border p-2 shadow-xl z-50"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <p className="text-xs text-[var(--text-muted)] px-2 py-1">
              Polkadot Hub (Paseo)
            </p>
            <button
              onClick={() => { disconnect(); setShowMenu(false); }}
              className="w-full text-left px-2 py-2 rounded-lg text-sm hover:bg-[var(--bg-card-hover)] text-[var(--error)]"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(v => !v)}
        disabled={isConnecting}
        className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
        style={{ background: "var(--dot-pink)" }}
      >
        {isConnecting ? "Connecting…" : "Connect Wallet"}
      </button>
      {showMenu && (
        <div
          className="absolute right-0 top-full mt-2 w-52 rounded-xl border p-2 shadow-xl z-50"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <p className="text-xs text-[var(--text-muted)] px-2 py-2">Select wallet</p>
          {connectors.map(connector => (
            <button
              key={connector.id}
              onClick={() => { connect({ connector }); setShowMenu(false); }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)]"
            >
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
