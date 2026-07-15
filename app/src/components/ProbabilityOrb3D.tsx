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
        className="relative overflow-hidden rounded-t-full border-t border-l border-r border-[#9e8e78]/40 bg-[#0d0d0d]"
      >
        {/* Split Outcome Color Semicircle */}
        <div className="absolute inset-0 flex">
          {/* YES segment (Verdant Green) */}
          <div 
            style={{ transform: `rotate(${yesProb - 100}deg)`, transformOrigin: "bottom right" }} 
            className="w-1/2 h-full bg-[#a1d494] transition-transform duration-500 ease-out"
          />
          {/* NO segment (Rust Red) */}
          <div 
            style={{ transform: `rotate(${yesProb}deg)`, transformOrigin: "bottom left" }} 
            className="w-1/2 h-full bg-[#ffb4ab] transition-transform duration-500 ease-out ml-auto"
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
          className="absolute rounded-t-full bg-[#131313] border-t border-l border-r border-[#9e8e78]/40 flex items-end justify-center pb-1"
        >
          {/* Numeric Readout */}
          <span className="text-xs font-mono font-bold text-[#ffd89c] tracking-wider">
            {yesProb}% YES
          </span>
        </div>
      </div>

      {/* Mechanical Needle Hub */}
      <div className="absolute bottom-0 w-4 h-4 rounded-full bg-[#ffd89c] border-2 border-[#0d0d0d] z-10 flex items-center justify-center">
        {/* Pointer Needle */}
        <div 
          style={{ 
            transform: `rotate(${rotationAngle}deg)`, 
            transformOrigin: "bottom center",
            height: size / 2 - 10,
            bottom: 6
          }} 
          className="absolute w-1 bg-[#ffd89c] transition-transform duration-500 ease-out rounded-t shadow-lg"
        />
      </div>

      {/* Under Label */}
      <span className="text-[10px] uppercase font-display tracking-widest text-[#d6c4ac] mt-1.5 font-bold">
        PROBABILITY
      </span>
    </div>
  );
}
