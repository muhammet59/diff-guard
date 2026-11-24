import { findHighEntropyTokens, redactSecret } from "./entropy.ts";
import type { DiffFile, Finding, ScanConfig, Severity } from "./types.ts";

interface PatternRule {
  id: string;
  title: string;
  severity: Severity;
  pattern: RegExp;
  message: string;
  redactMatch?: boolean;
  skipInTests?: boolean;
}

const SENSITIVE_FILE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /(^|\/)\.env(\.(?!example$|sample$|template$)[^/]+)?$/i, label: "Environment file (.env)" },
  { re: /(^|\/)id_(rsa|ed25519|ecdsa)$/i, label: "SSH private key" },
  { re: /\.(pem|p12|pfx|key|jks|keystore)$/i, label: "Certificate or private key file" },
  { re: /(^|\/)(service-account|credentials|secrets)\.json$/i, label: "Credentials JSON file" },
];

const PATTERN_RULES: PatternRule[] = [
  {
    id: "DG001",
    title: "Private Key Block",
    severity: "critical",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/,
    message: "Hardcoded private key header detected in staged diff.",
  },
  {
    id: "DG002",
    title: "AWS Access Key ID",
    severity: "critical",
    pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/,
    message: "AWS Access Key ID detected.",
    redactMatch: true,
  },
  {
    id: "DG003",
    title: "GitHub Personal Access Token",
    severity: "critical",
    pattern: /\b(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,82}|gho_[A-Za-z0-9]{36})\b/,
    message: "GitHub access token detected.",
    redactMatch: true,
  },
  {
    id: "DG004",
    title: "Provider API Key (OpenAI / Anthropic / Google / Stripe)",
    severity: "critical",
    pattern: /\b(sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}|AIza[0-9A-Za-z_-]{35}|sk_live_[0-9A-Za-z]{24,}|xox[baprs]-[0-9A-Za-z-]{10,})\b/,
    message: "Third-party provider API key detected.",
    redactMatch: true,
  },
  {
    id: "DG005",
    title: "Hardcoded JWT Token",
    severity: "high",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    message: "JSON Web Token literal detected in source.",
    redactMatch: true,
  },
  {
    id: "DG006",
    title: "Destructive SQL Statement",
    severity: "high",
    pattern: /\b(DROP\s+(?:TABLE|DATABASE|SCHEMA)\b|TRUNCATE\s+TABLE\b|DELETE\s+FROM\s+[`"\w.]+\s*;)/i,
    message: "Potentially destructive SQL statement (DROP/TRUNCATE or unqualified DELETE).",
  },
  {
    id: "DG007",
    title: "Debug Breakpoint Leftover",
    severity: "medium",
    pattern: /\b(debugger\s*;|breakpoint\s*\(\s*\)|pdb\.set_trace\s*\(\s*\))/,
    message: "Debugger breakpoint left in code.",
    skipInTests: true,
  },
  {
    id: "DG008",
    title: "Console Debug Output",
    severity: "low",
    pattern: /\bconsole\.(log|debug|trace)\s*\(/,
    message: "Console logging call added; verify it is intentional.",
    skipInTests: true,
  },
];

const SECRET_ASSIGNMENT_CONTEXT_RE = /(api[_-]?key|secret|token|passwd|password|auth|bearer|credential|private)/i;
const TEST_PATH_RE = /(^|\/)(tests?|__tests__|spec|fixtures|mocks)(\/|$)|\.(test|spec)\.[a-z]+$/i;

export function inspectDiffFile(file: DiffFile, config: ScanConfig = {}): Finding[] {
  if (file.isDeleted) return [];
  const findings: Finding[] = [];
  const isTestFile = TEST_PATH_RE.test(file.path);

  if (file.isNewFile || file.addedLines.length > 0) {
    for (const sf of SENSITIVE_FILE_PATTERNS) {
      if (sf.re.test(file.path)) {
        findings.push({
          ruleId: "DG000",
          title: "Sensitive File Committed",
          severity: "critical",
          file: file.path,
          line: 1,
          snippet: file.path,
          message: `${sf.label} should not be committed to version control.`,
        });
        break;
      }
    }
  }

  const entropyThreshold = config.entropyThreshold ?? 4.2;
  const minTokenLength = config.minTokenLength ?? 20;

  for (const added of file.addedLines) {
    const line = added.content;
    if (line.includes("diff-guard:ignore")) continue;

    let matchedExplicitSecret = false;

    for (const rule of PATTERN_RULES) {
      if (rule.skipInTests && isTestFile) continue;
      const match = line.match(rule.pattern);
      if (match) {
        if (rule.severity === "critical" || rule.id === "DG005") {
          matchedExplicitSecret = true;
        }
        const snippet = rule.redactMatch
          ? line.replace(match[0], redactSecret(match[0])).trim().slice(0, 120)
          : line.trim().slice(0, 120);

        findings.push({
          ruleId: rule.id,
          title: rule.title,
          severity: rule.severity,
          file: file.path,
          line: added.lineNumber,
          snippet,
          message: rule.message,
        });
      }
    }

    // Entropy check runs when line has secret-like assignment context and was not already flagged
    if (!matchedExplicitSecret && !isTestFile && SECRET_ASSIGNMENT_CONTEXT_RE.test(line)) {
      const hits = findHighEntropyTokens(line, entropyThreshold, minTokenLength);
      if (hits.length > 0) {
        const top = hits[0]!;
        findings.push({
          ruleId: "DG009",
          title: "High-Entropy Secret Candidate",
          severity: "high",
          file: file.path,
          line: added.lineNumber,
          snippet: line.replace(top.token, redactSecret(top.token)).trim().slice(0, 120),
          message: `High Shannon entropy string (${top.entropy} bits/char) near secret-related identifier.`,
        });
      }
    }
  }

  return findings;
}
