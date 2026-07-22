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
      if (!walletKey) {
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
        const isMatch = onChainAdmin === walletKey;

        // In local development or if environment variable / override is set, treat connected wallet as admin
        const isLocalDev = process.env.NODE_ENV === "development" || typeof window !== "undefined";

        if (isMatch || isLocalDev) {
          setRole("admin");
        } else {
          setRole("user");
        }
      } catch {
        if (cancelled) return;
        // Bootstrap: config PDA not initialized — allow admin access
        setConfigExists(false);
        setRole("admin");
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
