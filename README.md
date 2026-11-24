# diff-guard

Fast, zero-dependency Git diff security and hygiene scanner written in TypeScript.

`diff-guard` inspects staged changes (`git diff --cached`) or branch diffs before code leaves your machine—catching hardcoded credentials via pattern matching and Shannon entropy, destructive SQL migrations, committed `.env`/key files, and debug leftovers. Outputs clean terminal summaries, JSON, or SARIF 2.1.0 for GitHub Code Scanning.

## Why

Most secret scanners either require a compiled Go/Rust binary, pull in hundreds of transitive packages, or scan entire repository histories when you only want a sub-10ms gate on what you are about to commit. `diff-guard` runs directly on Node.js 22+ with zero runtime dependencies and integrates cleanly as a `pre-commit` hook or CI step.

## Example Output

```text
src/config.ts
  HIGH     DG009  L1  High Shannon entropy string (4.84 bits/char) near secret-related identifier.
           export const dbSecret = "9kP2...jF0d";
  HIGH     DG006  L2  Potentially destructive SQL statement (DROP/TRUNCATE or unqualified DELETE).
           export const reset = "TRUNCATE TABLE sessions;";

Summary: 2 finding(s) (critical: 0, high: 2, medium: 0, low: 0) in 1 file(s) [1.42ms]
```

## Usage

```bash
# Scan staged changes (default)
node src/cli.ts scan

# Scan a branch diff against main and fail on medium or higher severity
node src/cli.ts scan --base main --fail-on medium

# Export SARIF 2.1.0 for GitHub Security / Code Scanning
node src/cli.ts scan --base origin/main --format sarif --out diff-guard.sarif

# Install as a local Git pre-commit hook
node src/cli.ts install-hook

# Optional: run an additional semantic risk review via an OpenAI-compatible API
OPENAI_API_KEY=... node src/cli.ts scan --ai
```

## Detection Rules

| Rule | Severity | Target |
| :--- | :--- | :--- |
| `DG000` | `critical` | Sensitive files committed (`.env`, `id_rsa`, `*.pem`, `credentials.json`) |
| `DG001` | `critical` | Private key blocks (`BEGIN RSA/EC/OPENSSH PRIVATE KEY`) |
| `DG002` | `critical` | AWS Access Key IDs (`AKIA...`, `ASIA...`) |
| `DG003` | `critical` | GitHub personal access tokens (`ghp_...`, `github_pat_...`) |
| `DG004` | `critical` | Provider API keys (OpenAI, Anthropic, Google AI, Stripe, Slack) |
| `DG005` | `high` | Hardcoded JWT literals |
| `DG006` | `high` | Destructive SQL (`DROP TABLE`, `TRUNCATE TABLE`, unqualified `DELETE FROM`) |
| `DG007` | `medium` | Debugger breakpoints (`debugger;`, `breakpoint()`, `pdb.set_trace()`) |
| `DG008` | `low` | Console debug calls (`console.log`, `console.debug`) outside test files |
| `DG009` | `high` | High-entropy strings (Shannon entropy >= 4.2 bits/char) near secret identifiers |

To suppress an intentional fixture or documentation example on a specific line, append `diff-guard:ignore` as a comment.

## Running Tests

```bash
npm test
```

Includes unit tests for Shannon entropy calculation, false-positive filtering (UUIDs, Git SHAs, paths, constants), multi-hunk unified diff parsing, secret redaction, SARIF 2.1.0 output, and an end-to-end integration test against a real temporary Git repository.

## License

MIT
