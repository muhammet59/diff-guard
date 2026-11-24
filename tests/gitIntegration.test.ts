import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/cli.ts";

test("CLI scans a real staged git repo, catches leaks, writes SARIF, and installs pre-commit hook", async () => {
  const dir = mkdtempSync(join(tmpdir(), "diff-guard-e2e-"));
  try {
    execFileSync("git", ["init", "-b", "main"], { cwd: dir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });

    // Clean initial commit
    writeFileSync(join(dir, "index.ts"), "export const ok = true;\n");
    execFileSync("git", ["add", "index.ts"], { cwd: dir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: dir });

    // Stage a leaky file with high-entropy secret + destructive SQL
    writeFileSync(
      join(dir, "config.ts"),
      'export const dbSecret = "9kP2mX7vQ4nR8tL5wB1cZ6yH3jF0dS";\nexport const reset = "TRUNCATE TABLE sessions;";\n'
    );
    execFileSync("git", ["add", "config.ts"], { cwd: dir });

    const sarifOut = join(dir, "results.sarif");
    const exitCode = await runCli(["scan", "--format", "sarif", "--fail-on", "high", "--out", sarifOut], dir);
    assert.equal(exitCode, 1);
    assert.equal(existsSync(sarifOut), true);

    const sarif = JSON.parse(readFileSync(sarifOut, "utf-8")) as { runs: Array<{ results: Array<{ ruleId: string }> }> };
    const ruleIds = sarif.runs[0]!.results.map((r) => r.ruleId);
    assert.ok(ruleIds.includes("DG006"));
    assert.ok(ruleIds.includes("DG009"));

    // Verify pre-commit hook installer
    const hookExit = await runCli(["install-hook"], dir);
    assert.equal(hookExit, 0);
    const hookContent = readFileSync(join(dir, ".git", "hooks", "pre-commit"), "utf-8");
    assert.match(hookContent, /diff-guard scan/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
