"use client";

import React from "react";
import dynamic from "next/dynamic";

// Dynamically import the wallet multi button with SSR disabled so it only renders on client
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

export function ClientWalletButton() {
  return (
    <div className="wallet-button-wrapper">
      <WalletMultiButton />
    </div>
  );
}