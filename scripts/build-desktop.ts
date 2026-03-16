import { chmodSync, copyFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const run = async (cmd: string[]) => {
  const proc = Bun.spawn(cmd, { stdio: ["inherit", "inherit", "inherit"] });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`${cmd.join(" ")} failed with ${code}`);
};

const isWindows = process.platform === "win32";
const resourceDir = join(process.cwd(), "src-tauri", "resources");
const output = join(resourceDir, `bracketeer-server${isWindows ? ".exe" : ""}`);
const legacyOutput = join(resourceDir, "bracketeer-server");

mkdirSync(resourceDir, { recursive: true });
for (const stale of [join(resourceDir, "bracketeer-server"), join(resourceDir, "bracketeer-server.exe")]) {
  if (stale !== output) {
    try {
      rmSync(stale);
    } catch {}
  }
}

await run(["bun", "run", "ui:build"]);
await run(["bun", "build", "src/server.ts", "--compile", "--outfile", output]);

if (!isWindows) {
  chmodSync(output, 0o755);
} else {
  // Some older Tauri configs reference the resource without .exe suffix.
  copyFileSync(output, legacyOutput);
}
