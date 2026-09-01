import { useState, useEffect } from "react";
import { useProgram } from "@/hooks/useProgram";
import { getConfigPda } from "@/lib/pda";
import { isDevAuthEnabled } from "@/lib/dev-auth";

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
      const adminEnvWallets = (process.env.NEXT_PUBLIC_ADMIN_WALLET || "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf")
        .split(",").map((w) => w.trim()).filter(Boolean);

      // Development (localnet): mirror the server-side `requireAdmin` dev
      // bypass so the admin panel is reachable without importing a specific
      // wallet. Production (or a dev build without `DEV_AUTH_ENABLED=1`)
      // still resolves the role from on-chain ownership.
      if (isDevAuthEnabled()) {
        setRole("admin");
        setConfigExists(false);
        setIsLoading(false);
        return;
      }

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
        const isMatch = onChainAdmin === walletKey || adminEnvWallets.includes(walletKey);

        setRole(isMatch ? "admin" : "user");
      } catch {
        if (cancelled) return;
        // Bootstrap: config PDA not initialized yet, allow the documented admin wallet.
        setConfigExists(false);
        const isMatch = adminEnvWallets.includes(walletKey);
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
