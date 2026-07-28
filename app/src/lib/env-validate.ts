const REQUIRED_VARS: string[] = [];

const PROD_REQUIRED_VARS: string[] = [
  "NEXT_PUBLIC_RPC_URL",
  "NEXT_PUBLIC_CLUSTER",
  "NEXT_PUBLIC_PROGRAM_ID",
];

export function validateEnv(): void {
  if (typeof window !== "undefined") return;

  const missing: string[] = [];

  for (const name of REQUIRED_VARS) {
    if (!process.env[name]) missing.push(name);
  }

  if (process.env.NODE_ENV === "production") {
    for (const name of PROD_REQUIRED_VARS) {
      if (!process.env[name]) missing.push(name);
    }
  }

  if (missing.length > 0) {
    console.warn(`[ENV] Missing environment variables: ${missing.join(", ")}`);
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Missing required production environment variables: ${missing.join(", ")}`
      );
    }
  }
}
