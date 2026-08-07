/**
 * Run SQL migrations against Neon Postgres via drizzle-orm execute().
 * Usage: npx tsx app/drizzle/run-migrations.ts [--only=0002,0003]
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql as drizzleSql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const sqlFn = neon(DATABASE_URL);
const db = drizzle(sqlFn);

/**
 * Split SQL into executable statements, respecting $$ dollar-quoted blocks.
 */
function splitStatements(content: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarBlock = false;

  for (let i = 0; i < content.length; i++) {
    // Check for $$
    if (content[i] === '$' && i + 1 < content.length && content[i + 1] === '$') {
      inDollarBlock = !inDollarBlock;
      current += '$$';
      i++;
      continue;
    }

    if (content[i] === ';' && !inDollarBlock) {
      current += ';';
      const trimmed = current.trim();
      // Filter out comment-only blocks
      const withoutComments = trimmed.replace(/--[^\n]*/g, '').trim();
      if (withoutComments.length > 1) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += content[i];
  }

  return statements;
}

async function run() {
  const args = process.argv.slice(2);
  const onlyArg = args.find(a => a.startsWith('--only='));
  const onlySet = onlyArg ? new Set(onlyArg.replace('--only=', '').split(',')) : null;

  const migrationsDir = path.join(__dirname, 'migrations');
  let files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (onlySet) {
    files = files.filter(f => onlySet.has(f.split('_')[0]));
  }

  console.log(`Found ${files.length} migration files`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const statements = splitStatements(content);
    console.log(`\n=== ${file}: ${statements.length} statements ===`);

    let ok = 0, fail = 0;
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await db.execute(drizzleSql.raw(stmt));
        ok++;
        console.log(`  ✓ stmt ${i + 1}`);
      } catch (e: any) {
        const msg = e.message || '';
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          console.log(`  ⚠ stmt ${i + 1}: idempotent`);
          ok++;
        } else {
          console.error(`  ✗ stmt ${i + 1}: ${msg.slice(0, 150)}`);
          fail++;
        }
      }
    }
    console.log(`  Total: ${ok} applied, ${fail} failed`);
  }

  // ── Verification ──
  console.log('\n════════════════════ VERIFICATION ════════════════════');

  const funcCheck = await db.execute(drizzleSql.raw(
    `SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'recompute_user_stats') as fn_exists`
  ));
  console.log(`recompute_user_stats: ${(funcCheck.rows[0] as any)?.fn_exists}`);

  const allFuncCheck = await db.execute(drizzleSql.raw(
    `SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'recompute_all_user_stats') as fn_exists`
  ));
  console.log(`recompute_all_user_stats: ${(allFuncCheck.rows[0] as any)?.fn_exists}`);

  const statsCount = await db.execute(drizzleSql.raw(`SELECT COUNT(*)::int as count FROM user_stats`));
  console.log(`user_stats rows: ${(statsCount.rows[0] as any)?.count}`);

  const legacyCols = await db.execute(drizzleSql.raw(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'markets_cache' 
     AND column_name IN ('yes_pool_sol','no_pool_sol','yes_supply','no_supply')`
  ));
  if (legacyCols.rows.length === 0) {
    console.log('markets_cache: legacy pool columns DROPPED ✓');
  } else {
    console.log(`markets_cache: STILL HAS: ${legacyCols.rows.map((r: any) => r.column_name).join(', ')}`);
  }

  const legacyUserCols = await db.execute(drizzleSql.raw(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'users' 
     AND column_name IN ('total_wagered','total_won','total_profit','win_rate','pas_score','markets_traded')`
  ));
  if (legacyUserCols.rows.length === 0) {
    console.log('users: legacy stat columns DROPPED ✓');
  } else {
    console.log(`users: STILL HAS: ${legacyUserCols.rows.map((r: any) => r.column_name).join(', ')}`);
  }
}

run().catch(e => {
  console.error('Migration runner failed:', e);
  process.exit(1);
});
