"use client";

import React, { useState } from "react";
import { Sparkles, Brain, ChevronDown, ShieldCheck, Zap } from "lucide-react";

interface AiMarketWhispererProps {
  question: string;
  description: string;
  yesProb: number;
  noProb: number;
  yesPool: number;
  noPool: number;
  category: string;
  marketPubkey?: string;
}

export function AiMarketWhisperer({
  question,
  description,
  yesProb,
  noProb,
  yesPool,
  noPool,
  category,
  marketPubkey,
}: AiMarketWhispererProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const handleFetchAiAnalysis = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/ai/analyze-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, description, yesProb, noProb, yesPool, noPool, category, marketPubkey }),
      });
      const data = await res.json();
      if (data.ok) {
        setSummary(data.summary);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-gold-lite/30 rounded-[2px] bg-gradient-to-br from-panel to-void overflow-hidden shadow-[0_4px_20px_color-mix(in_oklab,var(--color-gold)_6%25,transparent)]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-ivory/5 transition-colors"
      >
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-[2px] bg-gold-lite/15 border border-gold-lite/40 flex items-center justify-center text-gold-lite">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gold-lite flex items-center gap-1.5">
              <span>Market Whisperer</span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-gold-lite/20 border border-gold-lite/40 text-gold-lite">
                RULE-BASED
              </span>
            </h3>
            <p className="text-[10px] text-ash">Deterministic read of pool depth, volume & oracle distance</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gold-lite transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-gold-lite/15 text-xs font-mono">
          {!summary && !loading && (
            <div className="flex flex-col items-center justify-center py-4 space-y-3">
              <p className="text-ash text-center text-[11px]">
                Generate a transparent, rule-based breakdown of this market’s pricing signals.
              </p>
              <button
                onClick={handleFetchAiAnalysis}
                className="px-4 py-2 rounded-[2px] bg-gold-lite/15 hover:bg-gold-lite/25 border border-gold-lite/40 text-gold-lite font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Run Market Analysis
              </button>
            </div>
          )}

          {loading && (
            <div className="py-6 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-gold-lite border-t-transparent rounded-[2px] animate-spin mx-auto" />
              <p className="text-[10px] text-gold-lite animate-pulse">Reading liquidity pools & Pyth oracle base rates...</p>
            </div>
          )}

          {summary && (
            <div className="space-y-3 animate-fade-in">
              <div className="p-3 rounded-[2px] bg-panel border border-gold-lite/20 space-y-1">
                <div className="text-[9px] uppercase tracking-wider font-bold text-ash flex items-center justify-between">
                  <span>Verdict</span>
                  <span className="text-verdigris">{summary.confidenceLevel}</span>
                </div>
                <p className="text-xs text-ivory leading-relaxed font-sans">{summary.verdict}</p>
              </div>

              {summary.tradingActivity && (
                <div className="p-3 rounded-[2px] bg-panel border border-verdigris/25 space-y-1">
                  <div className="text-[9px] uppercase tracking-wider font-bold text-ash flex items-center justify-between">
                    <span>On-Chain Trading Activity</span>
                    <span className="text-verdigris">{summary.tradingActivity.direction}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-graphite">
                    <span>{summary.tradingActivity.trades24h} trades</span>
                    <span className="text-verdigris">{summary.tradingActivity.yesVolume24h.toFixed(2)} SOL YES</span>
                    <span className="text-bordeaux">{summary.tradingActivity.noVolume24h.toFixed(2)} SOL NO</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2.5 rounded-[2px] bg-panel border border-hairline/20 space-y-1">
                  <div className="text-[9px] text-ash uppercase font-bold">Historical Base Rate</div>
                  <div className="text-[11px] text-gold-lite">{summary.historicalBaseRate}</div>
                </div>
                <div className="p-2.5 rounded-[2px] bg-panel border border-hairline/20 space-y-1">
                  <div className="text-[9px] text-ash uppercase font-bold">Strategy Hint</div>
                  <div className="text-[11px] text-verdigris">{summary.recommendation}</div>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <div className="text-[9px] uppercase tracking-wider font-bold text-ash">Key Swinging Factors</div>
                <ul className="space-y-1 text-[11px] text-graphite">
                  {summary.swingingFactors.map((factor: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Zap className="w-3 h-3 text-gold-lite shrink-0 mt-0.5" />
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
