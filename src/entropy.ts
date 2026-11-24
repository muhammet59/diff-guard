const CANDIDATE_TOKEN_RE = /[A-Za-z0-9+/=_-]{16,}/g;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_SHA_RE = /^[0-9a-f]{40}$/i;
const PATH_LIKE_RE = /^(?:\.{0,2}\/)?(?:[a-z][a-z0-9_-]*\/)+[a-zA-Z0-9_-]+(?:\.[a-z0-9]{1,8})?$/;

/**
 * Computes Shannon entropy (bits per character) for a string.
 * H(X) = -sum(p(x) * log2(p(x)))
 */
export function shannonEntropy(input: string): number {
  if (!input.length) return 0;
  const counts = new Map<string, number>();
  for (const ch of input) {
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }

  let entropy = 0;
  const len = input.length;
  for (const count of counts.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return Number(entropy.toFixed(4));
}

export function isLikelyFalsePositive(token: string): boolean {
  if (UUID_RE.test(token)) return true;
  if (HEX_SHA_RE.test(token)) return true;
  if (PATH_LIKE_RE.test(token)) return true;
  if (/^[a-z]+(?:_[a-z]+)+$/i.test(token)) return true; // snake_case identifiers
  if (/^[a-z]+(?:-[a-z]+)+$/i.test(token)) return true; // kebab-case identifiers
  if (/^[A-Z]+(?:_[A-Z]+)+$/.test(token)) return true;  // SCREAMING_SNAKE_CASE constants
  if (/^https?:\/\//i.test(token)) return true;
  // Require at least two character classes (e.g. letters + digits) to avoid plain prose words
  const classes =
    Number(/[a-z]/.test(token)) +
    Number(/[A-Z]/.test(token)) +
    Number(/[0-9]/.test(token)) +
    Number(/[+/=_-]/.test(token));
  return classes < 2;
}

export interface EntropyHit {
  token: string;
  entropy: number;
}

export function findHighEntropyTokens(
  line: string,
  threshold = 4.2,
  minLength = 20
): EntropyHit[] {
  const hits: EntropyHit[] = [];
  const matches = line.match(CANDIDATE_TOKEN_RE);
  if (!matches) return hits;

  for (const token of matches) {
    if (token.length < minLength) continue;
    if (isLikelyFalsePositive(token)) continue;
    const entropy = shannonEntropy(token);
    if (entropy >= threshold) {
      hits.push({ token, entropy });
    }
  }
  return hits;
}

export function redactSecret(secret: string): string {
  if (secret.length <= 8) return "***";
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}
