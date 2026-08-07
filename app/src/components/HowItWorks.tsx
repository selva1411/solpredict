"use client";

import React from "react";
import { motion } from "framer-motion";
import { Target, Coins, Gift } from "lucide-react";

const steps = [
  {
    icon: Target,
    title: "Choose a Market",
    description: "Browse prediction markets on crypto, sports, politics, and more. Each market has a yes/no question powered by real-time Pyth oracles.",
    color: "#8B5CF6",
  },
  {
    icon: Coins,
    title: "Buy YES or NO Shares",
    description: "Pick your side and buy fractional shares with SOL. Your cost determines your potential payout based on pool dynamics.",
    color: "#06B6D4",
  },
  {
    icon: Gift,
    title: "Settle & Claim Rewards",
    description: "When the market resolves, winners claim proportional payouts from the total pool. Refunds available on cancelled markets.",
    color: "#10E58C",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export function HowItWorks() {
  return (
    <section className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold font-display bg-gradient-to-r from-amber-400 to-amber-400 bg-clip-text text-transparent">
          How It Works
        </h2>
        <p className="text-sm text-text-muted max-w-lg mx-auto">
          Three simple steps to start trading on-chain prediction contracts on Solana.
        </p>
      </div>

      <motion.div
        className="grid sm:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
      >
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={index}
              variants={itemVariants}
              className="glass-panel glass-panel-hover p-8 text-center space-y-4"
            >
              <div className="relative mx-auto">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: `${step.color}15`, border: `1px solid ${step.color}30` }}
                >
                  <Icon className="w-6 h-6" style={{ color: step.color }} />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-mono font-bold text-text-muted">
                  {index + 1}
                </div>
              </div>
              <h3 className="text-base font-bold font-display text-text-primary">
                {step.title}
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
