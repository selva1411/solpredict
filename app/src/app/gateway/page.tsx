"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";

export default function SecureGateway() {
  const router = useRouter();
  const { role, isLoading } = useUserRole();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (isLoading || role === "disconnected") return;

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          if (role === "admin") router.push("/admin");
          else router.push("/dashboard");
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [role, isLoading, router]);

  return (
    <div className="min-h-screen bg-[#131313] flex items-center justify-center flex-col gap-8 px-4">
      <div className="font-display text-5xl text-[#ffd89c] tracking-widest uppercase animate-pulse">
        SOLPREDICT
      </div>

      <div className="font-mono text-[#9e8e78] text-sm tracking-widest">
        {role === "admin" ? "ADMIN ACCESS DETECTED" : "IDENTITY VERIFIED"}
      </div>

      <div className="flex gap-3 items-center">
        <span className="font-mono text-xs text-[#9e8e78]">ROUTING IN</span>
        <span className="font-mono text-2xl text-[#ffd89c] border border-[#ffd89c] w-10 h-10 flex items-center justify-center">
          {countdown}
        </span>
      </div>

      <div className="font-mono text-xs text-[#9e8e78] tracking-widest border border-[#353534] px-4 py-2">
        DESTINATION: {role === "admin" ? "/ADMIN" : "/DASHBOARD"}
      </div>
    </div>
  );
}
