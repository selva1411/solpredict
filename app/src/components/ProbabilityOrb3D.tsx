"use client";

import React from "react";

interface ProbabilityOrb3DProps {
  yesProb: number;
  size?: number; // px
}

export default function ProbabilityOrb3D({ yesProb, size = 120 }: ProbabilityOrb3DProps) {
  // Translate 0-100 probability to rotation angle (-90 to +90 degrees)
  const rotationAngle = (yesProb / 100) * 180 - 90;

  return (
    <div 
      style={{ width: size, height: size / 2 + 20 }} 
      className="flex flex-col items-center justify-end relative select-none"
    >
      {/* Semicircle Gauge Frame */}
      <div 
        style={{ width: size, height: size / 2 }} 
        className="relative overflow-hidden rounded-t-full border-t-2 border-l-2 border-r-2 border-[#2D3142] bg-[#050608]"
      >
        {/* Split Outcome Color Semicircle */}
        <div className="absolute inset-0 flex">
          {/* YES segment (Verdant Green) */}
          <div 
            style={{ transform: `rotate(${yesProb - 100}deg)`, transformOrigin: "bottom right" }} 
            className="w-1/2 h-full bg-[#235A34] transition-transform duration-500 ease-out"
          />
          {/* NO segment (Rust Red) */}
          <div 
            style={{ transform: `rotate(${yesProb}deg)`, transformOrigin: "bottom left" }} 
            className="w-1/2 h-full bg-[#8E2424] transition-transform duration-500 ease-out ml-auto"
          />
        </div>

        {/* Inner Hub Mask */}
        <div 
          style={{ 
            width: size - 32, 
            height: (size - 32) / 2, 
            bottom: 0, 
            left: 16 
          }} 
          className="absolute rounded-t-full bg-[#0C0D12] border-t-2 border-l-2 border-r-2 border-[#2D3142] flex items-end justify-center pb-1"
        >
          {/* Numeric Readout */}
          <span className="text-xs font-mono font-bold text-[#FFA500] tracking-wider">
            {yesProb}% YES
          </span>
        </div>
      </div>

      {/* Mechanical Needle Hub */}
      <div className="absolute bottom-0 w-4 h-4 rounded-full bg-[#FFA500] border-2 border-[#050608] z-10 flex items-center justify-center">
        {/* Pointer Needle */}
        <div 
          style={{ 
            transform: `rotate(${rotationAngle}deg)`, 
            transformOrigin: "bottom center",
            height: size / 2 - 10,
            bottom: 6
          }} 
          className="absolute w-1 bg-[#FFA500] transition-transform duration-500 ease-out rounded-t shadow-lg"
        />
      </div>

      {/* Under Label */}
      <span className="text-[10px] uppercase font-display tracking-widest text-[#808495] mt-1.5">
        PROBABILITY
      </span>
    </div>
  );
}
