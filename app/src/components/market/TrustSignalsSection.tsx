import React from "react";
import { Award } from "lucide-react";
import { lamportsToSol } from "@/lib/format";
import { isOracleCategory } from "@/lib/pyth-feeds";

export function TrustSignalsSection({
  treasuryBalance,
  feeBps,
  marketCategory,
}: {
  treasuryBalance: number;
  feeBps: number | null;
  marketCategory: number;
}) {
  return (
    <div className="surface p-6 sm:p-8 space-y-6">
      <h3 className="text-xs font-bold uppercase tracking-wider font-display text-gold flex items-center space-x-2">
        <Award className="w-4 h-4" />
        <span>Trader Safety &amp; Trust Signals</span>
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
        <div className="p-4 bg-panel rounded border border-hairline/30">
          <div className="text-ash text-[9px] uppercase tracking-wider font-display font-bold">Treasury Balance</div>
          <div className="font-bold text-ivory text-[13px] pt-1">
            {lamportsToSol(treasuryBalance).toFixed(3)} SOL
          </div>
          <div className="text-[8px] text-ash/60 pt-0.5">Secure Escrow PDA</div>
        </div>

        <div className="p-4 bg-panel rounded border border-hairline/30">
          <div className="text-ash text-[9px] uppercase tracking-wider font-display font-bold">Protocol Fee BPS</div>
          <div className="font-bold text-ivory text-[13px] pt-1">
            {feeBps !== null ? `${(feeBps / 100).toFixed(1)}%` : "— BPS"}
          </div>
          <div className="text-[8px] text-ash/60 pt-0.5">Max capped at 10%</div>
        </div>

        <div className="p-4 bg-panel rounded border border-board-border/30">
          <div className="text-ash text-[9px] uppercase tracking-wider font-display font-bold">Resolution Oracle</div>
          <div className="font-bold text-verdigris text-[13px] pt-1">
            {isOracleCategory(marketCategory) ? "Pyth Pull Oracle" : "Manual Settle"}
          </div>
          <div className="text-[8px] text-ash/60 pt-0.5">Automated on-chain feed</div>
        </div>
      </div>

      <div className="p-4 bg-panel rounded border border-board-border/30 space-y-2 text-xs font-sans text-text-muted leading-relaxed">
        <h4 className="font-display font-bold text-text-primary text-[10px] uppercase tracking-wider">How Settlement Works</h4>
        <p>
          This prediction board is secured by a decentralized smart contract treasury.{" "}
          {isOracleCategory(marketCategory) ? (
            <span>
              {" "}For price-backed boards (Crypto, Tech, or Other assets), anyone can trigger settlement once the resolution timestamp has passed. The contract retrieves the target price directly from the Pyth Network pull oracle, validates the feed signature to verify it is not stale, and settles the board based on the comparison rule.
            </span>
          ) : (
            <span>
              {" "}For non-price-backed boards (such as Sports and Politics), the administrator posts the official winning outcome (YES or NO) under a multi-signature verified authority once the event completes.
            </span>
          )}{" "}
          If the settled side has zero winning shares (meaning nobody bet on the winner), the market auto-cancels and permits all participants to withdraw their full stakes without protocol fees.
        </p>
      </div>
    </div>
  );
}
