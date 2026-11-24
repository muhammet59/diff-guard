import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function getStagedDiff(cwd = process.cwd()): string {
  return execFileSync("git", ["diff", "--cached", "-U0", "--no-color"], {
    cwd,
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

export function getBranchDiff(baseRef: string, cwd = process.cwd()): string {
  return execFileSync("git", ["diff", `${baseRef}...HEAD`, "-U0", "--no-color"], {
    cwd,
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

export function installPreCommitHook(cwd = process.cwd(), cliCommand = "npx diff-guard scan --fail-on high"): string {
  const gitDir = execFileSync("git", ["rev-parse", "--git-dir"], { cwd, encoding: "utf-8" }).trim();
  const hooksDir = join(cwd, gitDir, "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const hookPath = join(hooksDir, "pre-commit");

  const marker = "# diff-guard pre-commit hook";
  const snippet = `\n${marker}\n${cliCommand}\n`;

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, "utf-8");
    if (!existing.includes(marker)) {
      writeFileSync(hookPath, existing.trimEnd() + "\n" + snippet, "utf-8");
    }
  } else {
    writeFileSync(hookPath, `#!/usr/bin/env sh\nset -e\n${snippet}`, "utf-8");
  }
  chmodSync(hookPath, 0o755);
  return hookPath;
}
