#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { runSemanticReview } from "./aiReview.ts";
import { getBranchDiff, getStagedDiff, installPreCommitHook } from "./git.ts";
import { formatJson, formatSarif, formatTerminal } from "./reporters.ts";
import { scanDiff, shouldFail } from "./scanner.ts";
import type { Severity } from "./types.ts";

function parseArgs(argv: string[]) {
  const args = {
    command: argv[0] ?? "scan",
    format: "text" as "text" | "json" | "sarif",
    failOn: "high" as Severity,
    base: "",
    diffFile: "",
    out: "",
    noColor: false,
    ai: false,
  };

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--format" && argv[i + 1]) args.format = argv[++i] as typeof args.format;
    else if (a === "--fail-on" && argv[i + 1]) args.failOn = argv[++i] as Severity;
    else if (a === "--base" && argv[i + 1]) args.base = argv[++i]!;
    else if (a === "--diff-file" && argv[i + 1]) args.diffFile = argv[++i]!;
    else if (a === "--out" && argv[i + 1]) args.out = argv[++i]!;
    else if (a === "--no-color") args.noColor = true;
    else if (a === "--ai") args.ai = true;
  }
  return args;
}

export async function runCli(argv: string[], cwd = process.cwd()): Promise<number> {
  const opts = parseArgs(argv);

  if (opts.command === "install-hook") {
    const hookPath = installPreCommitHook(cwd);
    process.stdout.write(`Installed pre-commit hook at ${hookPath}\n`);
    return 0;
  }

  if (opts.command !== "scan") {
    process.stderr.write(`Usage: diff-guard <scan|install-hook> [--format text|json|sarif] [--fail-on low|medium|high|critical] [--base <ref>] [--diff-file <path>] [--out <path>] [--ai]\n`);
    return 2;
  }

  const diffText = opts.diffFile
    ? readFileSync(opts.diffFile, "utf-8")
    : opts.base
      ? getBranchDiff(opts.base, cwd)
      : getStagedDiff(cwd);

  const report = scanDiff(diffText, { failOn: opts.failOn });

  let rendered: string;
  if (opts.format === "json") rendered = formatJson(report);
  else if (opts.format === "sarif") rendered = formatSarif(report);
  else rendered = formatTerminal(report, !opts.noColor && process.stdout.isTTY !== false);

  if (opts.out) {
    writeFileSync(opts.out, rendered, "utf-8");
  } else {
    process.stdout.write(rendered);
  }

  if (opts.ai && diffText.trim().length > 0) {
    const ai = await runSemanticReview(diffText);
    process.stdout.write(`\n[AI Review · ${ai.model}] ${ai.summary}\n`);
    for (const r of ai.risks) {
      process.stdout.write(`  - ${r}\n`);
    }
  }

  return shouldFail(report, opts.failOn) ? 1 : 0;
}

const isMain = process.argv[1]?.endsWith("cli.ts");
if (isMain) {
  runCli(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`diff-guard error: ${(err as Error).message}\n`);
      process.exit(2);
    });
}
