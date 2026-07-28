export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const missingVars: string[] = [];
    const required = [
      ["SESSION_SECRET", "dev-secret-change-in-prod"],
      ["DATABASE_URL"],
      ["HELIUS_WEBHOOK_SECRET"],
    ] as const;

    for (const [key, fallback] of required) {
      if (!process.env[key]) {
        if (fallback && process.env.NODE_ENV !== "production") {
          process.env[key] = fallback;
        } else {
          missingVars.push(key);
        }
      }
    }

    if (missingVars.length > 0 && process.env.NODE_ENV === "production") {
      console.error(`[instrumentation] Missing required env vars: ${missingVars.join(", ")}`);
    }
  }
}

export async function onRequestError(err: unknown, request: unknown, context: unknown) {
  const { captureException } = await import("@sentry/nextjs");
  captureException(err);
}
