import type { AgentConfig, ScoredDraft, ReviewInput } from '../core/types.js';
import { generate } from '../shared/llm.js';

export async function refine(
  scored: ScoredDraft,
  agent: AgentConfig,
  input: ReviewInput,
): Promise<string> {
  const system = `You are refining a code/design review.
Your judgment axes: ${agent.judgmentAxes.join(', ')}
Your draft review scored high on relevance (α=${scored.alpha.toFixed(2)}).
Tighten your review: be more specific, more actionable, cite exact locations.
Remove any hedging or filler.`;

  const prompt = `Original input:\n${input.content}\n\nYour draft review:\n${scored.content}\n\nRefine this review to be more precise and actionable.`;

  return generate({ system, prompt, maxTokens: 1024 });
}
