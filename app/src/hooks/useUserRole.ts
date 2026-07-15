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
        setRole(configAcc.admin.toBase58() === walletKey ? "admin" : "user");
      } catch {
        if (cancelled) return;
        // Bootstrap: config PDA not initialized — allow first-time initialize_config
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
