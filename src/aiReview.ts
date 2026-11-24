export interface SemanticReviewResult {
  summary: string;
  risks: string[];
  model: string;
}

/**
 * Optional semantic diff review using an OpenAI-compatible chat endpoint.
 * Activated only when the user passes `--ai` with `OPENAI_API_KEY` set.
 */
export async function runSemanticReview(
  diffText: string,
  opts: { apiKey?: string; baseUrl?: string; model?: string } = {}
): Promise<SemanticReviewResult> {
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY ?? "";
  const baseUrl = opts.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = opts.model ?? process.env.DIFF_GUARD_MODEL ?? "gpt-4.1-mini";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY must be set to use --ai semantic review");
  }

  const truncated = diffText.slice(0, 12_000);
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a terse security code reviewer. Return JSON only: {\"summary\": string, \"risks\": string[]}. Flag auth bypasses, injection vectors, race conditions, or secret leaks.",
        },
        { role: "user", content: truncated },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`AI review request failed (HTTP ${res.status})`);
  }

  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const raw = (data.choices[0]?.message?.content ?? "{}").replace(/^```json\s*|\s*```$/g, "").trim();
  const parsed = JSON.parse(raw) as { summary?: string; risks?: string[] };

  return {
    summary: parsed.summary ?? "No semantic risks identified.",
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    model,
  };
}
