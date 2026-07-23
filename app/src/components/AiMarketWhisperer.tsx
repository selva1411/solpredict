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
}

export function AiMarketWhisperer({
  question,
  description,
  yesProb,
  noProb,
  yesPool,
  noPool,
  category,
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
        body: JSON.stringify({ question, description, yesProb, noProb, yesPool, noPool, category }),
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
    <div className="border border-[#ffd89c]/30 rounded-xl bg-gradient-to-br from-[#181512] to-[#0d0d0d] overflow-hidden shadow-[0_4px_20px_rgba(255,216,156,0.06)]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#ffd89c]/15 border border-[#ffd89c]/40 flex items-center justify-center text-[#ffd89c]">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold font-display uppercase tracking-wider text-[#ffd89c] flex items-center gap-1.5">
              <span>AI Market Whisperer</span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-[#ffd89c]/20 border border-[#ffd89c]/40 text-[#ffd89c]">
                POWERED BY CLAUDE
              </span>
            </h3>
            <p className="text-[10px] text-[#9e8e78]">Instant ML conviction synthesis, swinging factors & base rates</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#ffd89c] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-[#ffd89c]/15 text-xs font-mono">
          {!summary && !loading && (
            <div className="flex flex-col items-center justify-center py-4 space-y-3">
              <p className="text-[#9e8e78] text-center text-[11px]">
                Click below to generate real-time AI probability breakdown and swinging factor analysis.
              </p>
              <button
                onClick={handleFetchAiAnalysis}
                className="px-4 py-2 rounded-lg bg-[#ffd89c]/15 hover:bg-[#ffd89c]/25 border border-[#ffd89c]/40 text-[#ffd89c] font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Generate AI Intelligence Report
              </button>
            </div>
          )}

          {loading && (
            <div className="py-6 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-[#ffd89c] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[10px] text-[#ffd89c] animate-pulse">Analyzing liquidity pools & Pyth oracle base rates...</p>
            </div>
          )}

          {summary && (
            <div className="space-y-3 animate-fade-in">
              <div className="p-3 rounded-lg bg-[#0d0d0d] border border-[#ffd89c]/20 space-y-1">
                <div className="text-[9px] uppercase tracking-wider font-bold text-[#9e8e78] flex items-center justify-between">
                  <span>AI Verdict</span>
                  <span className="text-[#22c55e]">{summary.confidenceLevel}</span>
                </div>
                <p className="text-xs text-[#e5e2e1] leading-relaxed font-sans">{summary.verdict}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-[#0d0d0d] border border-[#9e8e78]/20 space-y-1">
                  <div className="text-[9px] text-[#9e8e78] uppercase font-bold">Historical Base Rate</div>
                  <div className="text-[11px] text-[#ffd89c]">{summary.historicalBaseRate}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0d0d0d] border border-[#9e8e78]/20 space-y-1">
                  <div className="text-[9px] text-[#9e8e78] uppercase font-bold">Strategy Hint</div>
                  <div className="text-[11px] text-[#22c55e]">{summary.recommendation}</div>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <div className="text-[9px] uppercase tracking-wider font-bold text-[#9e8e78]">Key Swinging Factors</div>
                <ul className="space-y-1 text-[11px] text-[#d6c4ac]">
                  {summary.swingingFactors.map((factor: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Zap className="w-3 h-3 text-[#ffd89c] shrink-0 mt-0.5" />
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
