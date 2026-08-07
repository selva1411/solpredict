"use client";

import React from "react";
import { motion } from "framer-motion";
import { Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

function GateScene() {
  return (
    <svg viewBox="0 0 120 100" className="w-full h-full" aria-hidden="true">
      <circle cx="60" cy="50" r="34" fill="none" stroke="#2D3142" strokeWidth="2" strokeDasharray="2 3" />
      <circle cx="60" cy="50" r="26" fill="none" stroke="#9E6600" strokeWidth="2" />
      <path
        d="M 60 50 L 60 26 A 24 24 0 0 1 83 41"
        fill="none"
        stroke="#FFA500"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="60" cy="50" r="3.5" fill="#FFA500" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 60 + Math.cos(rad) * 30;
        const y1 = 50 + Math.sin(rad) * 30;
        const x2 = 60 + Math.cos(rad) * 38;
        const y2 = 50 + Math.sin(rad) * 38;
        return (
          <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFA500" strokeWidth="1.5" />
        );
      })}
    </svg>
  );
}

interface ConnectWalletGateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export function ConnectWalletGate({
  title,
  description,
  icon: Icon = Wallet,
}: ConnectWalletGateProps) {
  return (
    <div className="flex-1 flex items-center justify-center py-12 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 24, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        style={{ perspective: 1200 }}
        className="holo-card py-10 text-center space-y-6 max-w-xl mx-auto w-full px-6 bg-[#1A1C22] holo-card-3d border-white/10"
      >
        <div className="relative h-44 w-full overflow-hidden rounded border border-white/10/40 bg-[#1A1C22]">
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <GateScene />
          </div>
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-[#808495]">
            <span>GENESIS BOARD</span>
            <span className="text-[#4CAF50]">● CALIBRATED</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#0C0D12]/70 to-transparent pointer-events-none" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-auto w-14 h-14 bg-[#1A1C22] border border-white/10/40 rounded flex items-center justify-center text-[#FFA500] shadow-[0_0_20px_rgba(255,165,0,0.15)]"
        >
          <Icon className="w-7 h-7" />
        </motion.div>

        <div className="space-y-3">
          <h2 className="text-2xl font-bold font-display text-[#F4F4F9] uppercase tracking-wide">{title}</h2>
          <p className="text-[#d6c4ac] text-sm max-w-sm mx-auto leading-relaxed">{description}</p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#FFA500]/70 pt-2 font-bold">
            Connect wallet above — routing is automatic by authority role
          </p>
        </div>
      </motion.div>
    </div>
  );
}
