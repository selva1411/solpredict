import { db, isDbConnected } from "@/lib/db/client";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async () => {
  const checks: Record<string, unknown> = {
    db: { configured: isDbConnected(), url: process.env.DATABASE_URL ? "set" : "NOT SET" },
    rpc: { url: process.env.NEXT_PUBLIC_RPC_URL ?? "default" },
    program: { id: process.env.NEXT_PUBLIC_PROGRAM_ID ?? "default" },
    cluster: process.env.NEXT_PUBLIC_CLUSTER ?? "devnet",
    pyth: { hermesUrl: process.env.NEXT_PUBLIC_PYTH_HERMES_URL ?? "default" },
  };

  let dbQueryWorks = false;
  if (db) {
    try {
      await db.execute("SELECT 1");
      dbQueryWorks = true;
    } catch (e) {
      checks.db = { ...checks.db as object, error: (e as Error).message };
    }
  }
  (checks.db as Record<string, unknown>).queryWorks = dbQueryWorks;

  return ok({ ok: true, checks, timestamp: Date.now() });
});
