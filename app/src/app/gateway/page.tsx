"use client";

import React, { useState } from "react";
import { ArrowRight, Zap, BarChart3, Wallet } from "lucide-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";

const slides = [
  {
    icon: Zap,
    title: "Welcome to PREDICT-X",
    desc: "The future of prediction markets on Solana. Trade YES/NO on any outcome with sub-second settlement.",
  },
  {
    icon: BarChart3,
    title: "How Trading Works",
    desc: "Buy shares in outcomes you believe will happen. Win real SOL when you're right. Use CPMM pricing for fair trades.",
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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 min-h-screen flex items-center justify-center">
      <div className="holo-card p-8 sm:p-12 max-w-lg w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFA500] to-[#D48800] flex items-center justify-center mx-auto mb-6">
          <Icon className="w-8 h-8 text-white" />
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-bold mb-4 text-[#F4F4F9]">
          {current.title}
        </h1>
        <p className="text-[#808495] mb-8 leading-relaxed">
          {current.desc}
        </p>

        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === slide ? "bg-[#FFA500] w-6" : "bg-white/20"
              }`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {slide < slides.length - 1 ? (
            <button
              onClick={() => setSlide(slide + 1)}
              className="btn-glow flex-1 flex items-center justify-center gap-2 text-sm"
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
