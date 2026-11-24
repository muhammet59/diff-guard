import type { DiffFile } from "./types.ts";

const DIFF_HEADER_RE = /^diff --git a\/(.+?) b\/(.+)$/;
const HUNK_HEADER_RE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * Parses standard unified git diff output (`git diff --cached -U0` or full context diffs)
 * into structured file entries with exact added line numbers.
 */
export function parseUnifiedDiff(diffText: string): DiffFile[] {
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let currentLine = 0;

  for (const rawLine of diffText.split(/\r?\n/)) {
    const headerMatch = rawLine.match(DIFF_HEADER_RE);
    if (headerMatch) {
      current = {
        path: headerMatch[2]!,
        isNewFile: false,
        isDeleted: false,
        addedLines: [],
      };
      files.push(current);
      currentLine = 0;
      continue;
    }

    if (!current) continue;

    if (rawLine.startsWith("new file mode ")) {
      current.isNewFile = true;
      continue;
    }

    if (rawLine.startsWith("deleted file mode ")) {
      current.isDeleted = true;
      continue;
    }

    const hunkMatch = rawLine.match(HUNK_HEADER_RE);
    if (hunkMatch) {
      currentLine = Number.parseInt(hunkMatch[1]!, 10);
      continue;
    }

    if (rawLine.startsWith("+++ ") || rawLine.startsWith("--- ")) {
      continue;
    }

    if (rawLine.startsWith("+")) {
      current.addedLines.push({
        lineNumber: currentLine,
        content: rawLine.slice(1),
      });
      currentLine += 1;
    } else if (rawLine.startsWith(" ")) {
      currentLine += 1;
    }
  }

  return files;
}
