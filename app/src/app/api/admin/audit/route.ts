export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { assertDb } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
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
  const offset = (page - 1) * limit;

  try {
    const db = assertDb();
    const [rows, countRows] = await Promise.all([
      db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(auditLog),
    ]);

    const total = countRows[0]?.count ?? 0;

    return ok({
      ok: true,
      logs: rows.map((r) => ({
        id: r.id,
        action: r.action,
        actor: r.actor,
        resource: r.resource,
        details: r.details,
        ip: r.ip,
        createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return serverError(err);
  }
});
