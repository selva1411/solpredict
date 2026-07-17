"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { useProgram } from "@/hooks/useProgram";
import { GlassPanel } from "@/components/GlassPanel";
import { ShieldCheck, UserCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function SecureGateway() {
  const router = useRouter();
  const { role, isLoading } = useUserRole();
  const { wallet } = useProgram();
  const [dots, setDots] = useState("");

  // Loading indicator dots animation
  useEffect(() => {
    const t = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(t);
  }, []);

  // Auto routing redirect hook
  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      if (role === "admin") {
        toast.success("Access authorized: Platform Admin Console");
        router.push("/admin");
      } else if (role === "user") {
        toast.success("Access authorized: User Dashboard");
        router.push("/dashboard");
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [role, isLoading, router]);

  const handleAdminGateClick = () => {
    if (role === "admin") {
      router.push("/admin");
    } else {
      toast.error("Access Denied: Wallet does not hold administrator privileges");
    }
  };

  const walletAddr = wallet?.publicKey?.toBase58() ?? "";
  const truncatedWallet = walletAddr ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-6)}` : "DISCONNECTED";

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 select-none">
      <div className="glass-panel max-w-2xl w-full p-8 space-y-8 text-center relative shadow-2xl">
        <div className="absolute top-4 left-4 flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffd89c] animate-pulse" />
          <span className="text-[9px] font-mono tracking-widest text-[#ffd89c]">SYSTEM SECURE GATEWAY</span>
        </div>

        {/* Flap-tile styled status indicator */}
        <div className="pt-6 space-y-4">
          <div className="flex justify-center gap-1 font-mono">
            {"SYSTEM ACCESS".split("").map((c, i) => (
              <div
                key={i}
                className="flap-tile w-6 h-9 flex items-center justify-center text-sm font-bold border-[#ffd89c]/40"
                style={{
                  animation: "flip-tile 0.3s ease-out forwards",
                  animationDelay: `${i * 0.03}s`,
                }}
              >
                {c}
              </div>
            ))}
          </div>
          <p className="text-[10px] font-mono text-[#d6c4ac] uppercase tracking-wider">
            AUTHORIZING KEYPAIR{dots}
          </p>
        </div>

        {/* Connected key identifier */}
        <div className="bg-[#0d0d0d] border border-[#9e8e78]/20 p-4 rounded max-w-sm mx-auto font-mono text-xs space-y-1.5">
          <div className="text-[#d6c4ac] text-[10px] uppercase font-bold">CONNECTED KEY</div>
          <div className="text-[#ffd89c] font-bold tracking-widest">{truncatedWallet}</div>
          <div className="text-[9px] text-[#9e8e78] uppercase">
            ROLE: <span className="font-bold text-[#e5e2e1]">{isLoading ? "SYNCING..." : role.toUpperCase()}</span>
          </div>
        </div>

        {/* Grid options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-md mx-auto pt-4">
          {/* User Option */}
          <div 
            onClick={() => router.push("/markets")}
            className="glass-panel p-5 glass-panel-interactive cursor-pointer group text-left space-y-2 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-[#d6c4ac] group-hover:text-[#a1d494] transition-colors">
              <UserCheck className="w-5 h-5" />
              <span className="text-[9px] font-mono font-bold tracking-widest uppercase">PORTAL 01</span>
            </div>
            <div className="space-y-1 pt-2">
              <h4 className="text-xs font-bold font-display text-[#e5e2e1] uppercase">User Terminal</h4>
              <p className="text-[10px] text-[#d6c4ac] leading-normal">
                Inspect contracts, place prediction shares, and retrieve outcomes.
              </p>
            </div>
          </div>

          {/* Admin Control */}
          <div 
            onClick={handleAdminGateClick}
            className={`glass-panel p-5 glass-panel-interactive cursor-pointer group text-left space-y-2 flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between text-[#d6c4ac] group-hover:text-[#ffd89c] transition-colors">
              {role === "admin" ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
              <span className="text-[9px] font-mono font-bold tracking-widest uppercase">CONTROL 02</span>
            </div>
            <div className="space-y-1 pt-2">
              <h4 className="text-xs font-bold font-display text-[#e5e2e1] uppercase">Mechanical Control</h4>
              <p className="text-[10px] text-[#d6c4ac] leading-normal">
                Initialize singleton configuration parameters and settle contracts.
              </p>
            </div>
          </div>
        </div>

        <p className="text-[9px] text-[#9e8e78] font-mono pt-4 border-t border-[#9e8e78]/10 max-w-sm mx-auto">
          IF SYSTEM IS IDLE FOR &gt; 2S, ROTATE SWITCHES MANUALLY.
        </p>
      </div>
    </div>
  );
}
