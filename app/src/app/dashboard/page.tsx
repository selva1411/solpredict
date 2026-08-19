import { redirect } from "next/navigation";

/**
 * Dashboard was a duplicate view of /portfolio (both rendered the same
 * /api/user/positions data — positions, LP positions, and net-worth/P&L
 * stats). Consolidated: /dashboard now redirects to /portfolio so there is
 * one canonical holdings page.
 */
export default function DashboardPage() {
  redirect("/portfolio");
}
