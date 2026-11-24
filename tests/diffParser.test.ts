import test from "node:test";
import assert from "node:assert/strict";
import { parseUnifiedDiff } from "../src/diffParser.ts";

test("parseUnifiedDiff tracks exact added line numbers across multiple files and hunks", () => {
  const diff = [
    "diff --git a/src/app.ts b/src/app.ts",
    "index 1111111..2222222 100644",
    "--- a/src/app.ts",
    "+++ b/src/app.ts",
    "@@ -10,0 +11,2 @@",
    "+const a = 1;",
    "+const b = 2;",
    "@@ -40,2 +42,3 @@",
    " const keep = true;",
    "+const inserted = 43;",
    "diff --git a/.env.prod b/.env.prod",
    "new file mode 100644",
    "--- /dev/null",
    "+++ b/.env.prod",
    "@@ -0,0 +1,1 @@",
    "+PORT=8080",
  ].join("\n");

  const files = parseUnifiedDiff(diff);
  assert.equal(files.length, 2);
  assert.equal(files[0]!.path, "src/app.ts");
  assert.deepEqual(
    files[0]!.addedLines.map((l) => l.lineNumber),
    [11, 12, 43]
  );
  assert.equal(files[1]!.path, ".env.prod");
  assert.equal(files[1]!.isNewFile, true);
  assert.equal(files[1]!.addedLines[0]!.lineNumber, 1);
});
