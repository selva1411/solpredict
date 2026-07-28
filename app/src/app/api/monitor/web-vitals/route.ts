import { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json();
  if (process.env.NODE_ENV !== "development") {
    console.log(JSON.stringify({ level: "METRIC", ...body }));
  }
  return ok({ ok: true });
});
