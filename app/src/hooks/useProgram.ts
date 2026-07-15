import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { ENV } from "@/lib/env";
import idl from "@/lib/idl/solpredict.json";

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const program = useMemo(() => {
    // If no wallet is connected, construct a read-only provider
    const provider = new AnchorProvider(
      connection,
      wallet as any,
      AnchorProvider.defaultOptions()
    );

    const idlCopy = { ...idl, address: ENV.programId.toBase58() };
    return new Program(idlCopy as any, provider) as any;
  }, [connection, wallet]);

  return { program, connection, wallet };
}
