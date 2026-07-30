import { useState, useEffect } from "react";
import { useProgram } from "@/hooks/useProgram";
import { getConfigPda } from "@/lib/pda";

export type UserRole = "admin" | "user" | "disconnected";

export function useUserRole() {
  const { program, wallet } = useProgram();
  const [role, setRole] = useState<UserRole>("disconnected");
  const [isLoading, setIsLoading] = useState(true);
  const [configExists, setConfigExists] = useState<boolean | null>(null);

  const walletKey = wallet?.publicKey?.toBase58() ?? null;

  useEffect(() => {
    let cancelled = false;

    async function determineRole() {
      const adminEnvWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET || "2zPRxYVxFDUZn6QEYU2m6bzyZcN7pCCJ4E25gc2EQcCS";

      if (!walletKey) {
        if (process.env.NODE_ENV === "development") {
          setRole("admin");
          setConfigExists(false);
          setIsLoading(false);
          return;
        }
        setRole("disconnected");
        setConfigExists(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const configPda = getConfigPda(program.programId);
        const configAcc = await program.account.config.fetch(configPda);
        if (cancelled) return;

        setConfigExists(true);
        const onChainAdmin = configAcc.admin.toBase58();
        const isMatch = onChainAdmin === walletKey || walletKey === adminEnvWallet;

        setRole(isMatch ? "admin" : "user");
      } catch {
        if (cancelled) return;
        // Bootstrap: config PDA not initialized yet, check if wallet matches adminEnvWallet or allow in dev
        setConfigExists(false);
        const isMatch = walletKey === adminEnvWallet || process.env.NODE_ENV === "development";
        setRole(isMatch ? "admin" : "user");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    determineRole();
    return () => {
      cancelled = true;
    };
  }, [walletKey, program]);

  return { role, isLoading, configExists };
}
