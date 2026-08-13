"use client";

import React from "react";

interface Props {
  yesProbability: number;
}

export function ProbabilityGauge({ yesProbability }: Props) {
  const yes = Math.max(0, Math.min(100, Math.round(yesProbability)));
  const circumference = 2 * Math.PI * 72;
  const offset = circumference - (yes / 100) * circumference;

  const arcColor = yes > 66 ? "#a1d494" : yes > 33 ? "#ffd89c" : "#ffb4ab";

  return (
    <div className="relative w-full max-w-[230px] mx-auto select-none">
      <style>
        {`
          @keyframes swirl { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @keyframes pulse-bg { 0%,100% { opacity: 0.06; transform: scale(1); } 50% { opacity: 0.15; transform: scale(1.08); } }
          @keyframes twinkle { 0%,100% { opacity: 0; } 50% { opacity: 0.8; } }
          @keyframes comet { 0% { opacity: 0; transform: translate(0,0); } 20% { opacity: 0.7; } 80% { opacity: 0.7; } 100% { opacity: 0; transform: translate(20px,-20px); } }
          @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
          @keyframes ringPulse { 0%,100% { filter: drop-shadow(0 0 6px currentColor); } 50% { filter: drop-shadow(0 0 18px currentColor); } }
          .spin-slow { animation: swirl 20s linear infinite; }
          .pulse-cosmic { animation: pulse-bg 4s ease-in-out infinite; }
          .float-text { animation: float 3s ease-in-out infinite; }
          .twinkle-1 { animation: twinkle 3s ease-in-out infinite; }
          .twinkle-2 { animation: twinkle 4s ease-in-out 1.5s infinite; }
          .twinkle-3 { animation: twinkle 5s ease-in-out 3s infinite; }
          .twinkle-4 { animation: twinkle 3.5s ease-in-out 2s infinite; }
          .pulse-ring { animation: ringPulse 2.5s ease-in-out infinite; color: ${arcColor}; }
          .comet { animation: comet 6s ease-in-out infinite; }
          .comet2 { animation: comet 8s ease-in-out 3s infinite; }
        `}
      </style>

      <svg viewBox="0 0 190 210" className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="iridescent" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffb4ab" />
            <stop offset="30%" stopColor="#c8a9e8" />
            <stop offset="50%" stopColor="#ffd89c" />
            <stop offset="70%" stopColor="#89d4cf" />
            <stop offset="100%" stopColor="#a1d494" />
          </linearGradient>

          <radialGradient id="nebula" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#2a1a3a" stopOpacity="0.6" />
            <stop offset="40%" stopColor="#1a1a2e" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#050510" stopOpacity="0.95" />
          </radialGradient>

          <radialGradient id="nebulaWash" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={arcColor} stopOpacity="0.12" />
            <stop offset="50%" stopColor={arcColor} stopOpacity="0.04" />
            <stop offset="100%" stopColor={arcColor} stopOpacity="0" />
          </radialGradient>

          <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffb4ab" />
            <stop offset="50%" stopColor="#ffd89c" />
            <stop offset="100%" stopColor="#a1d494" />
          </linearGradient>

          <filter id="soft">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="softStrong">
            <feGaussianBlur stdDeviation="8" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Nebula background */}
        <circle cx="95" cy="95" r="110" fill="url(#nebulaWash)" />

        {/* Pulsing cosmic ring */}
        <circle cx="95" cy="95" r="80" fill="none" stroke={arcColor} strokeWidth="2" className="pulse-cosmic" opacity="0.12" />

        {/* Outer iridescent ring track */}
        <circle cx="95" cy="95" r="72" fill="none" stroke="#1c1c1c" strokeWidth="14" opacity="0.9" />
        <circle cx="95" cy="95" r="72" fill="none" stroke="#252535" strokeWidth="14" opacity="0.4"
          strokeDasharray={`${circumference * 0.1} ${circumference * 0.9}`}
          strokeDashoffset={circumference * 0.05}
        />

        {/* Active arc thick */}
        <circle
          cx="95" cy="95" r="72" fill="none" stroke={arcColor} strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90, 95, 95)"
          opacity="0.15" filter="url(#softStrong)"
          className="transition-all duration-700 ease-out"
        />

        {/* Active arc */}
        <circle
          cx="95" cy="95" r="72" fill="none" stroke="url(#arcGrad)" strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90, 95, 95)"
          filter="url(#soft)"
          className="transition-all duration-700 ease-out pulse-ring"
        />

        {/* Stardust particles along arc */}
        {[0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map((pct, i) => {
          const isLit = pct * 100 <= yes;
          const ang = pct * 2 * Math.PI - Math.PI / 2;
          return (
            <circle key={i}
              cx={95 + 72 * Math.cos(ang)} cy={95 + 72 * Math.sin(ang)}
              r="1.8" fill={isLit ? arcColor : "#1c1c1c"}
              opacity={isLit ? 0.9 : 0.4}
              className="transition-all duration-500"
            />
          );
        })}

        {/* Arc endpoint */}
        <circle
          cx={95 + 72 * Math.cos((yes / 100) * 2 * Math.PI - Math.PI / 2)}
          cy={95 + 72 * Math.sin((yes / 100) * 2 * Math.PI - Math.PI / 2)}
          r="6" fill="#131313" stroke={arcColor} strokeWidth="3"
          filter="url(#soft)" className="transition-all duration-700 ease-out"
        />

        {/* Inner nebula center */}
        <circle cx="95" cy="95" r="55" fill="url(#nebula)" />
        <circle cx="95" cy="95" r="55" fill="none" stroke={arcColor} strokeWidth="0.5" opacity="0.25" />

        {/* Floating stars in nebula */}
        <circle cx="75" cy="78" r="0.8" fill="white" opacity="0.6" className="twinkle-1" />
        <circle cx="110" cy="72" r="1" fill="white" opacity="0.5" className="twinkle-2" />
        <circle cx="85" cy="108" r="0.6" fill="white" opacity="0.4" className="twinkle-3" />
        <circle cx="118" cy="100" r="0.7" fill="white" opacity="0.5" className="twinkle-4" />
        <circle cx="68" cy="95" r="0.5" fill="white" opacity="0.3" className="twinkle-2" />
        <circle cx="105" cy="85" r="0.9" fill="white" opacity="0.4" className="twinkle-3" />
        <circle cx="95" cy="110" r="0.6" fill="white" opacity="0.5" className="twinkle-1" />

        {/* Glass highlight */}
        <ellipse cx="78" cy="72" rx="18" ry="10" fill="white" opacity="0.06" transform="rotate(-20, 78, 72)" />

        {/* Comets */}
        <line x1="60" y1="60" x2="40" y2="40" stroke="white" strokeWidth="0.5" opacity="0" className="comet" />
        <line x1="130" y1="65" x2="110" y2="45" stroke="white" strokeWidth="0.4" opacity="0" className="comet2" />

        {/* NO / YES */}
        <text x="28" y="97" textAnchor="middle" dominantBaseline="central" fill="#ffb4ab" fontSize="8" fontFamily="monospace" fontWeight="bold" opacity="0.45" letterSpacing="1">NO</text>
        <text x="162" y="97" textAnchor="middle" dominantBaseline="central" fill="#a1d494" fontSize="8" fontFamily="monospace" fontWeight="bold" opacity="0.45" letterSpacing="1">YES</text>

        {/* Percentage */}
        <text x="95" y="80" textAnchor="middle" dominantBaseline="central"
          fill="white" fontSize="34" fontFamily="monospace" fontWeight="bold"
          className="float-text transition-all duration-300"
          style={{ filter: `drop-shadow(0 0 8px ${arcColor}40)` }}
        >{yes}%</text>

        <text x="95" y="107" textAnchor="middle" dominantBaseline="central"
          fill="#d6c4ac" fontSize="7" fontFamily="monospace" opacity="0.3" letterSpacing="2"
        >PROBABILITY</text>

        {/* Bottom wash bar */}
        <rect x="60" y="162" width="70" height="3" rx="1.5" fill="#1c1c1c" />
        <rect x="60" y="162" width={`${(yes / 100) * 70}`} height="3" rx="1.5" fill={arcColor} filter="url(#soft)" className="transition-all duration-700 ease-out" />

        {/* Tick marks */}
        {Array.from({ length: 16 }).map((_, i) => {
          const ang = (i / 16) * 2 * Math.PI - Math.PI / 2;
          const inn = 77;
          const out = 80;
          const lit = (i / 16) * 100 <= yes;
          return (
            <line key={i}
              x1={95 + inn * Math.cos(ang)} y1={95 + inn * Math.sin(ang)}
              x2={95 + out * Math.cos(ang)} y2={95 + out * Math.sin(ang)}
              stroke={lit ? arcColor : "#2a2a2a"} strokeWidth="1.2" strokeLinecap="round"
              opacity={lit ? 0.7 : 0.3}
              className="transition-all duration-500"
            />
          );
        })}

        {/* Orbiting micro moons */}
        <g style={{ transformOrigin: "95px 95px", animation: "swirl 12s linear infinite" }}>
          <circle cx="95" cy="14" r="1.5" fill={arcColor} opacity="0.4" />
        </g>
        <g style={{ transformOrigin: "95px 95px", animation: "swirl 16s linear infinite", animationDelay: "-4s" }}>
          <circle cx="95" cy="14" r="2.5" fill="white" opacity="0.15" />
        </g>
        <g style={{ transformOrigin: "95px 95px", animation: "swirl 20s linear infinite reverse", animationDelay: "-8s" }}>
          <circle cx="95" cy="14" r="1" fill={arcColor} opacity="0.5" />
        </g>
      </svg>
    </div>
  );
}
