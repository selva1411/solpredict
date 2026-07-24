// TODO Phase 5 — gRPC subscriber bootstrap on server start
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[instrumentation] server initialized");
  }
}