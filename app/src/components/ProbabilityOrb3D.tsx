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
        className="relative overflow-hidden rounded-[2px] border-t border-l border-r border-gold-deep/40 bg-void"
      >
        {/* Split Outcome Color Semicircle */}
        <div className="absolute inset-0 flex">
          {/* YES segment (Verdant Green) */}
          <div 
            style={{ transform: `rotate(${yesProb - 100}deg)`, transformOrigin: "bottom right" }} 
            className="w-1/2 h-full bg-verdigris transition-transform duration-500 ease-out"
          />
          {/* NO segment (Rust Red) */}
          <div 
            style={{ transform: `rotate(${yesProb}deg)`, transformOrigin: "bottom left" }} 
            className="w-1/2 h-full bg-bordeaux transition-transform duration-500 ease-out ml-auto"
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
          className="absolute rounded-[2px] bg-[#131313] border-t border-l border-r border-gold-deep/40 flex items-end justify-center pb-1"
        >
          {/* Numeric Readout */}
          <span className="text-xs font-mono font-bold text-gold-lite tracking-wider">
            {yesProb}% YES
          </span>
        </div>
      </div>

      {/* Mechanical Needle Hub */}
      <div className="absolute bottom-0 w-4 h-4 rounded-[2px] bg-gold-lite border-2 border-void z-10 flex items-center justify-center">
        {/* Pointer Needle */}
        <div 
          style={{ 
            transform: `rotate(${rotationAngle}deg)`, 
            transformOrigin: "bottom center",
            height: size / 2 - 10,
            bottom: 6
          }} 
          className="absolute w-1 bg-gold-lite transition-transform duration-500 ease-out rounded-t shadow-lg"
        />
      </div>

      {/* Under Label */}
      <span className="text-[10px] uppercase font-display tracking-widest text-[#d6c4ac] mt-1.5 font-bold">
        PROBABILITY
      </span>
    </div>
  );
}
