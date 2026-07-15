"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const SplitFlapBoard3D = dynamic(() => import("./SplitFlapBoard3D"), { ssr: false });

interface SplitFlapBoardProps {
  marketsList?: string[];
}

export default function SplitFlapBoard({ marketsList = [] }: SplitFlapBoardProps) {
  const defaultRows = [
    "PREDICT THE FUTURE ",
    "SETTLE THE BOARD   ",
    "SOLPREDICT ACTIVE  "
  ];

  const [activeRows, setActiveRows] = useState<string[]>(defaultRows);
  const [, setCycleIndex] = useState(0);

  // 2D mobile cycling
  useEffect(() => {
    const validQuestions = marketsList.filter(q => q.trim().length > 0);
    if (validQuestions.length === 0) return;

    const timer = setInterval(() => {
      setCycleIndex((prev) => {
        const nextIdx = (prev + 1) % Math.ceil(validQuestions.length / 3);
        const start = nextIdx * 3;
        
        const q1 = (validQuestions[start] || "PREDICT THE FUTURE ").toUpperCase();
        const q2 = (validQuestions[start + 1] || "SETTLE THE BOARD   ").toUpperCase();
        const q3 = (validQuestions[start + 2] || "SOLPREDICT ACTIVE  ").toUpperCase();

        setActiveRows([q1, q2, q3]);
        return nextIdx;
      });
    }, 5500);

    return () => clearInterval(timer);
  }, [marketsList]);

  return (
    <div className="w-full">
      {/* 1. Desktop 3D Mode */}
      <div className="hidden sm:block">
        <SplitFlapBoard3D marketsList={marketsList} />
      </div>

      {/* 2. Mobile 2D CSS Fallback Mode */}
      <div className="sm:hidden w-full bg-[#050608] border-b-2 border-t border-[#2D3142] p-4 flex flex-col items-center justify-center space-y-2 select-none">
        {activeRows.map((rowText, rowIndex) => {
          // Truncate to 18 characters on narrow screens
          const padded = rowText.slice(0, 18).padEnd(18, " ");
          const chars = padded.split("");
          
          return (
            <div key={rowIndex} className="flex flex-row justify-center">
              {chars.map((char, colIndex) => (
                <span
                  key={colIndex}
                  className="split-flap-char w-[17px] h-[26px] text-[10px] mx-[0.5px] rounded-sm flex items-center justify-center font-mono font-bold text-[#FFA500] border-t border-[#333] shadow"
                >
                  {char}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
