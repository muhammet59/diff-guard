import type { Finding, ScanReport, Severity } from "./types.ts";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
};

function colorSeverity(sev: Severity, useColor: boolean): string {
  const tag = sev.toUpperCase().padEnd(8);
  if (!useColor) return tag;
  if (sev === "critical" || sev === "high") return `${ANSI.red}${ANSI.bold}${tag}${ANSI.reset}`;
  if (sev === "medium") return `${ANSI.yellow}${tag}${ANSI.reset}`;
  return `${ANSI.cyan}${tag}${ANSI.reset}`;
}

export function formatTerminal(report: ScanReport, useColor = true): string {
  const lines: string[] = [];

  if (report.findings.length === 0) {
    const ok = useColor ? `${ANSI.green}PASS${ANSI.reset}` : "PASS";
    return `${ok} diff-guard: 0 findings across ${report.scannedFiles} file(s), ${report.scannedLines} added line(s) (${report.durationMs}ms)\n`;
  }

  const byFile = new Map<string, Finding[]>();
  for (const f of report.findings) {
    const list = byFile.get(f.file) ?? [];
    list.push(f);
    byFile.set(f.file, list);
  }

  for (const [file, items] of byFile.entries()) {
    lines.push(useColor ? `\n${ANSI.bold}${file}${ANSI.reset}` : `\n${file}`);
    for (const item of items) {
      lines.push(
        `  ${colorSeverity(item.severity, useColor)} ${item.ruleId}  L${item.line}  ${item.message}`
      );
      lines.push(useColor ? `           ${ANSI.dim}${item.snippet}${ANSI.reset}` : `           ${item.snippet}`);
    }
  }

  lines.push(
    `\nSummary: ${report.findings.length} finding(s) ` +
      `(critical: ${report.summary.critical}, high: ${report.summary.high}, ` +
      `medium: ${report.summary.medium}, low: ${report.summary.low}) ` +
      `in ${report.scannedFiles} file(s) [${report.durationMs}ms]\n`
  );
  return lines.join("\n");
}

export function formatJson(report: ScanReport): string {
  return JSON.stringify(report, null, 2) + "\n";
}

function toSarifLevel(sev: Severity): "error" | "warning" | "note" {
  if (sev === "critical" || sev === "high") return "error";
  if (sev === "medium") return "warning";
  return "note";
}

/**
 * Formats scan results as SARIF 2.1.0 for GitHub Code Scanning / Security tab.
 */
export function formatSarif(report: ScanReport): string {
  const ruleMap = new Map<string, { id: string; name: string; shortDescription: { text: string } }>();
  for (const f of report.findings) {
    if (!ruleMap.has(f.ruleId)) {
      ruleMap.set(f.ruleId, {
        id: f.ruleId,
        name: f.title,
        shortDescription: { text: f.title },
      });
    }
  }

  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "diff-guard",
            version: "1.0.0",
            informationUri: "https://github.com/muhammet59/diff-guard",
            rules: Array.from(ruleMap.values()),
          },
        },
        results: report.findings.map((f) => ({
          ruleId: f.ruleId,
          level: toSarifLevel(f.severity),
          message: { text: f.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: f.file },
                region: { startLine: Math.max(1, f.line) },
              },
            },
          ],
        })),
      },
    ],
  };

  return JSON.stringify(sarif, null, 2) + "\n";
}
