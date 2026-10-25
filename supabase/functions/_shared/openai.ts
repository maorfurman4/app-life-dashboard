// OpenAI model choice for every edge function, in one place.
// gpt-4o / gpt-4o-mini shut down on 2027-01-14. gpt-5-mini costs $0.25/$2 per 1M tokens
// (gpt-4o: $2.50/$10) and matched or beat gpt-4o on the app's own prompts (A/B, 2026-10-25).
// gpt-5-nano wrote broken Hebrew prose in the same test — use it only for JSON/extraction.
export const MODEL = { smart: "gpt-5-mini", fast: "gpt-5-nano" } as const;

export type Effort = "minimal" | "low" | "medium";

/**
 * Chat Completions params for a GPT-5 model. These are reasoning models: they reject
 * `temperature`/`max_tokens`, and `max_completion_tokens` must leave room for reasoning tokens.
 * "minimal" skips reasoning (cheapest, fast); "low" for multi-step work (plans, payslips).
 */
export function modelParams(tier: keyof typeof MODEL, maxCompletionTokens: number, effort: Effort = "minimal") {
  return { model: MODEL[tier], max_completion_tokens: maxCompletionTokens, reasoning_effort: effort };
}
