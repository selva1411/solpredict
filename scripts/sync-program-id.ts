import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

// Matches any base58 Solana address (32-44 chars, excluding 0/O/I/l)
const BASE58_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

function readAnchorToml(): { devnet: string; localnet: string } {
  const toml = fs.readFileSync(path.join(ROOT, "Anchor.toml"), "utf-8");
  const devnetMatch = toml.match(/\[programs\.devnet\]\s*\n\s*solpredict\s*=\s*"([^"]+)"/);
  const localnetMatch = toml.match(/\[programs\.localnet\]\s*\n\s*solpredict\s*=\s*"([^"]+)"/);
  if (!devnetMatch) throw new Error("Could not find [programs.devnet] solpredict in Anchor.toml");
  return {
    devnet: devnetMatch[1],
    localnet: localnetMatch?.[1] ?? devnetMatch[1],
  };
}

function replaceInFile(filePath: string, pattern: RegExp, replacement: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf-8");
  if (!pattern.test(content)) return false;
  const updated = content.replace(pattern, replacement);
  fs.writeFileSync(filePath, updated);
  console.log(`  OK    ${path.relative(ROOT, filePath)}`);
  return true;
}

function main() {
  const ids = readAnchorToml();
  const newId = ids.devnet;

  console.log(`\nSyncing program ID: ${newId}\n`);

  // 1. .env files — replace NEXT_PUBLIC_PROGRAM_ID=<any-address>
  const envPattern = /(NEXT_PUBLIC_PROGRAM_ID=)[^\s#]+/;
  for (const f of [
    path.join(ROOT, ".env.local.example"),
    path.join(ROOT, "app", ".env.local"),
    path.join(ROOT, "app", ".env.local.example"),
  ]) {
    replaceInFile(f, envPattern, `$1${newId}`);
  }

  // 2. app/src/lib/env.ts — replace the fallback in process.env.NEXT_PUBLIC_PROGRAM_ID || "..."
  replaceInFile(
    path.join(ROOT, "app", "src", "lib", "env.ts"),
    /(process\.env\.NEXT_PUBLIC_PROGRAM_ID\s*\|\|\s*")[^"]+(")/,
    `$1${newId}$2`
  );

  // 3. scripts/keeper.ts — already reads from Anchor.toml, but update hardcoded fallback if any
  replaceInFile(
    path.join(ROOT, "scripts", "keeper.ts"),
    /(const PROGRAM_ID = new PublicKey\()"[^"]+"(\))/,
    `$1"${newId}"$2`
  );

  // 4. Copy + patch IDL JSON
  const idlSrc = path.join(ROOT, "target", "idl", "solpredict.json");
  const idlDst = path.join(ROOT, "app", "src", "lib", "idl", "solpredict.json");
  if (fs.existsSync(idlSrc)) {
    let content = fs.readFileSync(idlSrc, "utf-8");
    content = content.replace(/"address":\s*"[^"]+"/, `"address": "${newId}"`);
    fs.writeFileSync(idlDst, content);
    console.log(`  OK    app/src/lib/idl/solpredict.json (copied from target/ + address patched)`);
  } else {
    console.log(`  SKIP  idl copy (target/idl/solpredict.json not found — run anchor build first)`);
  }

  // 5. Copy + patch types TS file
  const typesSrc = path.join(ROOT, "target", "types", "solpredict.ts");
  const typesDst = path.join(ROOT, "app", "src", "lib", "idl", "solpredict.ts");
  if (fs.existsSync(typesSrc)) {
    let content = fs.readFileSync(typesSrc, "utf-8");
    content = content.replace(/"address":\s*"[^"]+"/, `"address": "${newId}"`);
    fs.writeFileSync(typesDst, content);
    console.log(`  OK    app/src/lib/idl/solpredict.ts (copied from target/ + address patched)`);
  } else {
    console.log(`  SKIP  types copy (target/types/solpredict.ts not found — run anchor build first)`);
  }

  console.log(`\nDone. All files now use: ${newId}\n`);
}

main();
