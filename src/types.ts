export type Severity = "critical" | "high" | "medium" | "low";

export const SEVERITY_RANK: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export interface AddedLine {
  lineNumber: number;
  content: string;
}

export interface DiffFile {
  path: string;
  isNewFile: boolean;
  isDeleted: boolean;
  addedLines: AddedLine[];
}

export interface Finding {
  ruleId: string;
  title: string;
  severity: Severity;
  file: string;
  line: number;
  snippet: string;
  message: string;
}

export interface ScanConfig {
  entropyThreshold?: number;
  minTokenLength?: number;
  ignorePathPatterns?: RegExp[];
  failOn?: Severity;
}

export interface ScanReport {
  scannedFiles: number;
  scannedLines: number;
  durationMs: number;
  findings: Finding[];
  summary: Record<Severity, number>;
}
