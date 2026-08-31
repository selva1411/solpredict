"use client";

import React, { useState } from "react";
import { ArrowRight, Zap, BarChart3, Wallet } from "lucide-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";

const slides = [
  {
    icon: Zap,
    title: "Welcome to SOLPREDICT",
    desc: "On-chain prediction markets settled on Solana. Trade YES/NO on price outcomes with CPMM pricing and Pyth pull-oracle resolution.",
  },
  {
    icon: BarChart3,
    title: "How Trading Works",
    desc: "Buy shares in outcomes you believe will happen. Win real SOL when you're right. Constant-product pricing keeps every trade fair.",
  },
  {
    icon: Wallet,
    title: "Connect Your Wallet",
    desc: "Connect your Solana wallet to start trading. Phantom, Solflare, and all wallet-standard wallets supported.",
  },
];

export default function GatewayPage() {
  const [slide, setSlide] = useState(0);
  const current = slides[slide];
  const Icon = current.icon;

  return (
    <main className="mx-auto w-full max-w-[1240px] px-6 py-14 min-h-screen flex items-center justify-center">
      <div className="surface p-8 sm:p-12 max-w-lg w-full text-center">
        <div className="w-16 h-16 rounded-[2px] bg-gradient-to-br from-gold to-gold-deep flex items-center justify-center mx-auto mb-6">
          <Icon className="w-8 h-8 text-void" />
        </div>

        <h1 className="font-display text-3xl font-semibold uppercase mb-4 text-ivory">
          {current.title}
        </h1>
        <p className="text-ash mb-8 leading-relaxed">
          {current.desc}
        </p>

        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-[2px] transition-all ${
                i === slide ? "bg-gold w-6" : "bg-hairline-2"
              }`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {slide < slides.length - 1 ? (
            <button
              onClick={() => setSlide(slide + 1)}
              className="btn-royale flex-1 flex items-center justify-center gap-2 text-[13px]"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <ClientWalletButton />
          )}
        </div>
      </div>
    </main>
  );
}
