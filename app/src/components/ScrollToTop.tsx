"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-20 right-4 z-50 w-10 h-10 rounded-[2px] bg-gold/80  border border-gold/30 flex items-center justify-center shadow-lg hover:bg-gold transition-all cursor-pointer"
      aria-label="Scroll to top"
    >
      <ChevronUp className="w-4 h-4 text-ivory" />
    </button>
  );
}
