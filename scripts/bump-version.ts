import { readFileSync, writeFileSync } from "node:fs";

const next = process.argv[2];
if (!next || !/^\d+\.\d+\.\d+$/.test(next)) {
  console.error('Usage: bun run scripts/bump-version.ts X.Y.Z');
  process.exit(1);
}

function updateJsonVersion(path: string, version: string) {
  const raw = readFileSync(path, "utf8");
  const data = JSON.parse(raw);
  data.version = version;
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function updateCargoTomlVersion(path: string, version: string) {
  const raw = readFileSync(path, "utf8");
  const nextRaw = raw.replace(
    /(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/,
    `$1${version}$3`
  );
  if (raw === nextRaw) {
    throw new Error(`Failed to update version in ${path}`);
  }
  writeFileSync(path, nextRaw);
}

updateJsonVersion("package.json", next);
updateJsonVersion("src-tauri/tauri.conf.json", next);
updateCargoTomlVersion("src-tauri/Cargo.toml", next);

console.log(`Updated versions to ${next} in package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml`);
