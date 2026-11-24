import { parseUnifiedDiff } from "./diffParser.ts";
import { inspectDiffFile } from "./rules.ts";
import { SEVERITY_RANK, type Finding, type ScanConfig, type ScanReport, type Severity } from "./types.ts";

const DEFAULT_IGNORE = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /\.min\.(js|css)$/,
];

export function scanDiff(diffText: string, config: ScanConfig = {}): ScanReport {
  const start = performance.now();
  const files = parseUnifiedDiff(diffText);
  const ignorePatterns = [...DEFAULT_IGNORE, ...(config.ignorePathPatterns ?? [])];

  const findings: Finding[] = [];
  let scannedFiles = 0;
  let scannedLines = 0;

  for (const file of files) {
    if (ignorePatterns.some((re) => re.test(file.path))) continue;
    scannedFiles += 1;
    scannedLines += file.addedLines.length;
    findings.push(...inspectDiffFile(file, config));
  }

  findings.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.file.localeCompare(b.file) || a.line - b.line);

  const summary: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    summary[f.severity] += 1;
  }

  return {
    scannedFiles,
    scannedLines,
    durationMs: Number((performance.now() - start).toFixed(2)),
    findings,
    summary,
  };
}

export function shouldFail(report: ScanReport, failOn: Severity = "high"): boolean {
  const threshold = SEVERITY_RANK[failOn];
  return report.findings.some((f) => SEVERITY_RANK[f.severity] >= threshold);
}
