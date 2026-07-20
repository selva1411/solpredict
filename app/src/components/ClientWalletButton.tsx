"use client";

import React, { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";

// Dynamically import the wallet multi button with SSR disabled so it only renders on client
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

export function ClientWalletButton() {
  const { connected, publicKey } = useWallet();
  const router = useRouter();
  const hasRoutedRef = useRef(false);

  useEffect(() => {
    if (connected && publicKey && !hasRoutedRef.current) {
      hasRoutedRef.current = true;
      router.push('/gateway');
    }
    if (!connected) {
      hasRoutedRef.current = false;
    }
  }, [connected, publicKey, router]);

  return (
    <div className="wallet-button-wrapper">
      <WalletMultiButton />
    </div>
  );
}
