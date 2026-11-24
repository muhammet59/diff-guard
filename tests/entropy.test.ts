import test from "node:test";
import assert from "node:assert/strict";
import { findHighEntropyTokens, isLikelyFalsePositive, redactSecret, shannonEntropy } from "../src/entropy.ts";

test("shannonEntropy returns 0 for repeated characters and high bits for random tokens", () => {
  assert.equal(shannonEntropy(""), 0);
  assert.equal(shannonEntropy("aaaaaaaaaaaa"), 0);
  const randomLike = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYz9k3Q1";
  assert.ok(shannonEntropy(randomLike) > 4.5);
});

test("isLikelyFalsePositive suppresses UUIDs, git SHAs, paths, and identifiers", () => {
  assert.equal(isLikelyFalsePositive("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isLikelyFalsePositive("2fd4e1c67a2d28fced849ee1bb76e7391b93eb12"), true);
  assert.equal(isLikelyFalsePositive("src/components/auth/LoginModal"), true);
  assert.equal(isLikelyFalsePositive("MAX_RETRY_ATTEMPTS_PER_MINUTE"), true);
  assert.equal(isLikelyFalsePositive("wJalrXUtnFEMI/K7MDENG/bPxRfiCYz9"), false);
});

test("findHighEntropyTokens flags realistic random secret values", () => {
  const hits = findHighEntropyTokens('const apiSecret = "9kP2mX7vQ4nR8tL5wB1cZ6yH3jF0dS";');
  assert.equal(hits.length, 1);
  assert.ok(hits[0]!.entropy >= 4.2);
});

test("redactSecret hides middle characters while keeping prefix/suffix", () => {
  assert.equal(redactSecret("abcd12345678wxyz"), "abcd...wxyz");
  assert.equal(redactSecret("short"), "***");
});
