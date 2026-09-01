import { getDb } from "../src/lib/db/client";
import { sql } from "drizzle-orm";

async function main() {
  const db = getDb();
  if (!db) throw new Error("no db");
  const rows = await db.execute(sql`
    SELECT market_id, status, creator,
           CASE WHEN creator IS NULL THEN 'NULL' ELSE substr(creator,1,6) END AS c6,
           yes_pool_lamports, no_pool_lamports, total_volume::float AS vol,
           winning_outcome, settled_at
    FROM markets_cache ORDER BY market_id`);
  for (const r of rows.rows as Record<string, unknown>[]) {
    console.log(
      `#${r.market_id} ${r.status} creator=${r.c6} pools=${r.yes_pool_lamports}/${r.no_pool_lamports} vol=${Number(r.vol).toFixed(2)} outcome=${r.winning_outcome ?? "-"} settledAt=${r.settled_at ? "yes" : "-"}`,
    );
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
