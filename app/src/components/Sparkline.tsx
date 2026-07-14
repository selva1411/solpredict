"use client";

import React from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  className?: string;
}

export function Sparkline({
  data,
  width = 200,
  height = 50,
  color = "#8B5CF6",
  fillColor,
  strokeWidth = 2,
  className = "",
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data
    .map((val, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((val - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const fillPoints = fillColor
    ? `${padding},${height - padding} ${points} ${width - padding},${height - padding}`
    : undefined;

  const lastVal = data[data.length - 1];
  const lastX = width - padding;
  const lastY = height - padding - ((lastVal - min) / range) * (height - padding * 2);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ overflow: "visible" }}
    >
      {/* Fill area under the line */}
      {fillColor && fillPoints && (
        <polygon
          points={fillPoints}
          fill={fillColor}
          opacity={0.15}
        />
      )}

      {/* Main line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Endpoint dot */}
      <circle
        cx={lastX}
        cy={lastY}
        r={3}
        fill={color}
      />

      {/* Glowing pulse on endpoint */}
      <circle
        cx={lastX}
        cy={lastY}
        r={6}
        fill={color}
        opacity={0.3}
      >
        <animate
          attributeName="r"
          values="4;8;4"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.3;0.1;0.3"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}
