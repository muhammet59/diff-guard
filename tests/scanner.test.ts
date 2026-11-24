import test from "node:test";
import assert from "node:assert/strict";
import { formatSarif, formatTerminal, scanDiff, shouldFail } from "../src/index.ts";

test("detects AWS keys, destructive SQL, sensitive .env files, and redacts secrets", () => {
  const fakeAws = "AKIA" + "IOSFODNN7EXAMPLE";
  const diff = [
    "diff --git a/.env.local b/.env.local",
    "new file mode 100644",
    "--- /dev/null",
    "+++ b/.env.local",
    "@@ -0,0 +1,2 @@",
    `+AWS_KEY=${fakeAws}`,
    "+DEBUG=true",
    "diff --git a/migrations/004_cleanup.sql b/migrations/004_cleanup.sql",
    "new file mode 100644",
    "--- /dev/null",
    "+++ b/migrations/004_cleanup.sql",
    "@@ -0,0 +1,1 @@",
    "+DROP TABLE users;",
  ].join("\n");

  const report = scanDiff(diff);
  const ids = report.findings.map((f) => f.ruleId);

  assert.ok(ids.includes("DG000"), "should flag .env.local");
  assert.ok(ids.includes("DG002"), "should flag AWS key");
  assert.ok(ids.includes("DG006"), "should flag DROP TABLE");
  assert.equal(shouldFail(report, "high"), true);

  const awsFinding = report.findings.find((f) => f.ruleId === "DG002")!;
  assert.ok(!awsFinding.snippet.includes(fakeAws), "secret must be redacted in snippet");
  assert.ok(awsFinding.snippet.includes("AKIA...MPLE"));
});

test("honors inline diff-guard:ignore directive and ignores lockfiles", () => {
  const fakeAws = "AKIA" + "IOSFODNN7EXAMPLE";
  const diff = [
    "diff --git a/package-lock.json b/package-lock.json",
    "@@ -1,0 +1,1 @@",
    `+"key": "${fakeAws}"`,
    "diff --git a/src/example.ts b/src/example.ts",
    "@@ -1,0 +1,1 @@",
    `+const docExample = "${fakeAws}"; // diff-guard:ignore`,
  ].join("\n");

  const report = scanDiff(diff);
  assert.equal(report.findings.length, 0);
  assert.equal(shouldFail(report, "low"), false);
});

test("produces valid SARIF 2.1.0 and clean terminal output", () => {
  const diff = [
    "diff --git a/src/db.ts b/src/db.ts",
    "@@ -5,0 +6,1 @@",
    "+debugger;",
  ].join("\n");

  const report = scanDiff(diff);
  const sarif = JSON.parse(formatSarif(report)) as { version: string; runs: Array<{ results: Array<{ ruleId: string }> }> };
  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.runs[0]!.results[0]!.ruleId, "DG007");

  const text = formatTerminal(report, false);
  assert.match(text, /DG007/);
  assert.match(text, /Summary: 1 finding/);
});
