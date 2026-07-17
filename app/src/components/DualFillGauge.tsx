"use client";

import { useEffect, useRef } from "react";

interface DualFillGaugeProps {
  yesPct: number;
  noPct: number;
  animated?: boolean;
}

export default function DualFillGauge({
  yesPct, noPct, animated = true,
}: DualFillGaugeProps) {
  const yesRef = useRef<HTMLDivElement>(null);
  const noRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (yesRef.current) yesRef.current.style.height = `${yesPct}%`;
      if (noRef.current) noRef.current.style.height = `${noPct}%`;
    }, 100);
    return () => clearTimeout(timer);
  }, [yesPct, noPct]);

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <div className="text-xs font-mono text-[#9e8e78] tracking-widest uppercase">
        Market Probability
      </div>

      <div className="flex items-end gap-6">
        {/* YES Tank */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-lg font-bold font-mono text-[#a1d494]">
            {yesPct.toFixed(1)}%
          </span>
          <div
            className="relative w-16 h-40 rounded-sm overflow-hidden"
            style={{
              background: '#0d0d0d',
              border: '2px solid #a1d494',
              boxShadow: '0 0 12px rgba(161,212,148,0.15), inset 0 0 8px rgba(0,0,0,0.5)',
            }}
          >
            {[0, 25, 50, 75, 100].map((tick) => (
              <div
                key={tick}
                className="absolute left-0 right-0 flex items-center"
                style={{ bottom: `${tick}%`, transform: 'translateY(50%)' }}
              >
                <div className="w-2 h-px bg-[#a1d494] opacity-40" />
                <span className="ml-1 text-[8px] font-mono text-[#a1d494] opacity-40">
                  {tick}
                </span>
              </div>
            ))}
            <div
              ref={yesRef}
              className="absolute bottom-0 left-0 right-0"
              style={{
                height: '0%',
                background: 'linear-gradient(180deg, #a1d494 0%, #5a9e50 100%)',
                transition: animated ? 'height 1.2s cubic-bezier(0.4,0,0.2,1)' : 'none',
                boxShadow: '0 -2px 8px rgba(161,212,148,0.4)',
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-white opacity-30" />
              <div className="absolute inset-0 overflow-hidden">
                {[20, 50, 75].map((left, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-1 rounded-full bg-white opacity-20"
                    style={{
                      left: `${left}%`,
                      bottom: `${10 + i * 20}%`,
                      animation: `float-gauge ${2 + i * 0.7}s ease-in-out infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="text-xs font-mono font-bold tracking-widest text-[#a1d494] uppercase">
            YES
          </div>
        </div>

        {/* Center divider with VS */}
        <div className="flex flex-col items-center gap-1 pb-10">
          <div className="text-xs font-mono text-[#9e8e78] opacity-60">vs</div>
          <div className="w-px h-20 bg-[#353534]" />
        </div>

        {/* NO Tank */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-lg font-bold font-mono text-[#ffb4ab]">
            {noPct.toFixed(1)}%
          </span>
          <div
            className="relative w-16 h-40 rounded-sm overflow-hidden"
            style={{
              background: '#0d0d0d',
              border: '2px solid #ffb4ab',
              boxShadow: '0 0 12px rgba(255,180,171,0.15), inset 0 0 8px rgba(0,0,0,0.5)',
            }}
          >
            {[0, 25, 50, 75, 100].map((tick) => (
              <div
                key={tick}
                className="absolute left-0 right-0 flex items-center justify-end"
                style={{ bottom: `${tick}%`, transform: 'translateY(50%)' }}
              >
                <span className="mr-1 text-[8px] font-mono text-[#ffb4ab] opacity-40">
                  {tick}
                </span>
                <div className="w-2 h-px bg-[#ffb4ab] opacity-40" />
              </div>
            ))}
            <div
              ref={noRef}
              className="absolute bottom-0 left-0 right-0"
              style={{
                height: '0%',
                background: 'linear-gradient(180deg, #ffb4ab 0%, #c94f42 100%)',
                transition: animated ? 'height 1.2s cubic-bezier(0.4,0,0.2,1)' : 'none',
                boxShadow: '0 -2px 8px rgba(255,180,171,0.4)',
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-white opacity-30" />
              <div className="absolute inset-0 overflow-hidden">
                {[25, 55, 80].map((left, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-1 rounded-full bg-white opacity-20"
                    style={{
                      left: `${left}%`,
                      bottom: `${15 + i * 20}%`,
                      animation: `float-gauge ${2.3 + i * 0.6}s ease-in-out infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="text-xs font-mono font-bold tracking-widest text-[#ffb4ab] uppercase">
            NO
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float-gauge {
          0%, 100% { transform: translateY(0); opacity: 0.2; }
          50% { transform: translateY(-6px); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
