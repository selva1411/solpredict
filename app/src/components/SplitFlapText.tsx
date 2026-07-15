"use client";

import React, { useEffect, useState } from "react";

interface SplitFlapTextProps {
  text: string;
  className?: string;
  charClassName?: string;
}

export function SplitFlapText({ text, className = "", charClassName = "" }: SplitFlapTextProps) {
  const [prevText, setPrevText] = useState(text);
  const [displayedText, setDisplayedText] = useState(text);
  const [animatingIndices, setAnimatingIndices] = useState<Set<number>>(new Set());

  // Derive state change synchronously during render when prop updates
  if (text !== prevText) {
    setPrevText(text);
    const targetLength = Math.max(text.length, displayedText.length);
    const newAnimating = new Set<number>();
    
    for (let i = 0; i < targetLength; i++) {
      if (displayedText[i] !== text[i]) {
        newAnimating.add(i);
      }
    }
    setAnimatingIndices(newAnimating);
  }

  // Use effect asynchronously to settle the displayed characters after flip duration
  useEffect(() => {
    if (animatingIndices.size === 0) return;

    const timer = setTimeout(() => {
      setDisplayedText(text);
      setAnimatingIndices(new Set());
    }, 200);

    return () => clearTimeout(timer);
  }, [text, animatingIndices]);

  const chars = displayedText.split("");

  return (
    <div className={`inline-flex flex-row items-center font-mono ${className}`}>
      {chars.map((char, i) => {
        const isAnimating = animatingIndices.has(i);
        return (
          <span
            key={i}
            className={`split-flap-char ${isAnimating ? "animate-success-flip" : ""} ${charClassName}`}
          >
            {char}
          </span>
        );
      })}
    </div>
  );
}
