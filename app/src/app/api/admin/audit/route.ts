export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuditLog } from "@/lib/data/admin";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/admin-guard";

/**
 * GET /api/admin/audit
 *
 * Returns full audit log, newest first, paginated. Admin only per spec §3.6.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));

  try {
    const { logs, pagination } = await getAuditLog(page, limit);
    return ok({ ok: true, logs, pagination });
  } catch (err) {
    return serverError(err);
  }
});
