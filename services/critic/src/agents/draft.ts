import type { AgentConfig, AgentContext, ReviewInput } from '../core/types.js';
import { generate } from '../shared/llm.js';

function detectInputType(input: ReviewInput, context: AgentContext): 'code' | 'consultation' | 'mixed' {
  const hasCodeExtractions = context.extractions.some(e => e.type === 'code' && e.content.length > 0);
  const hasCode = input.language || /^\s*(import|export|const|let|var|function|class|interface|type)\s/m.test(input.content);

  if (hasCodeExtractions || hasCode) {
    const proseRatio = input.content.split('\n').filter(l => !l.trim().startsWith('//') && !/[{};]/.test(l)).length / Math.max(input.content.split('\n').length, 1);
    return proseRatio > 0.5 ? 'mixed' : 'code';
  }
  return 'consultation';
}

function buildSystemPrompt(agent: AgentConfig, context: AgentContext, inputType: 'code' | 'consultation' | 'mixed'): string {
  const axesStr = agent.judgmentAxes.join(', ');
  const extractedContent = context.extractions
    .map(e => `## [${e.extractorId}]\n${e.content}`)
    .join('\n\n');

  if (inputType === 'code') {
    return `You are a code reviewer with a specific focus.

Your judgment axes: ${axesStr}

You evaluate code strictly along these axes. Do not comment on aspects outside your focus.
Be specific, cite exact lines or symbols when possible.
If you have nothing meaningful to say along your axes, say so briefly.

## Extracted context for your review:
${extractedContent}`;
  }

  if (inputType === 'consultation') {
    return `You are a technical advisor who thinks through the lens of specific concerns.

Your perspective axes: ${axesStr}

When someone asks a question or raises a topic, respond from your specific perspective.
- Give concrete, opinionated advice grounded in your axes
- Use examples or analogies when helpful
- Be direct — don't hedge or list every option equally
- It's fine to say "from my perspective, X" and commit to a stance

You are NOT a generic assistant. You have a specific viewpoint. Lean into it.

${extractedContent ? `## Relevant context:\n${extractedContent}` : ''}`;
  }

  // mixed
  return `You are a technical reviewer and advisor with a specific focus.

Your judgment axes: ${axesStr}

The input contains both code/design artifacts and questions. Do both:
1. Review the concrete artifacts along your axes
2. Address the question from your perspective

Be specific and opinionated. Cite exact symbols when reviewing code.

## Extracted context:
${extractedContent}`;
}

export async function draft(
  agent: AgentConfig,
  context: AgentContext,
  input: ReviewInput,
): Promise<{ agentId: string; content: string }> {
  const inputType = detectInputType(input, context);
  const system = buildSystemPrompt(agent, context, inputType);
  const prompt = inputType === 'code'
    ? `Review the following:\n\n${input.content}`
    : input.content;

  const content = await generate({ system, prompt, maxTokens: 1024 });
  return { agentId: agent.id, content };
}
