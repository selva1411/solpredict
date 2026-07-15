"use client";

import React, { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter, usePathname } from "next/navigation";

// Dynamically import the wallet multi button with SSR disabled so it only renders on client
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

export function ClientWalletButton() {
  const { connected, publicKey } = useWallet();
  const router = useRouter();
  const pathname = usePathname();
  const prevConnectedRef = useRef(false);

  useEffect(() => {
    const isNowConnected = connected && publicKey !== null;
    if (isNowConnected && !prevConnectedRef.current) {
      if (pathname === "/") {
        router.push("/gateway");
      }
    }
    prevConnectedRef.current = !!connected;
  }, [connected, publicKey, pathname, router]);

  return (
    <div className="wallet-button-wrapper">
      <WalletMultiButton />
    </div>
  );
}
