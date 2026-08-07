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
      className="fixed bottom-20 right-4 z-50 w-10 h-10 rounded-full bg-[#FFA500]/80 backdrop-blur-md border border-[#FFA500]/30 flex items-center justify-center shadow-lg hover:bg-[#FFA500] transition-all cursor-pointer"
      aria-label="Scroll to top"
    >
      <ChevronUp className="w-4 h-4 text-white" />
    </button>
  );
}
