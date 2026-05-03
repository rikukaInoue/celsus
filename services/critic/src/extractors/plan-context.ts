import { registerExtractor } from './interface.js';
import type { ReviewInput, ExtractedContext } from '../core/types.js';

registerExtractor('plan_context', (weight) => ({
  id: 'plan_context',
  type: 'prose',
  weight,
  async extract(input: ReviewInput): Promise<ExtractedContext | null> {
    if (!input.priorMessages || input.priorMessages.length === 0) return null;

    const recent = input.priorMessages.slice(-5);
    const content = recent
      .map(m => `[${m.author}] ${m.content}`)
      .join('\n\n');

    return {
      extractorId: 'plan_context',
      type: 'prose',
      content,
      metadata: { relevanceHint: 0.7 },
      tokenEstimate: Math.ceil(content.length / 4),
    };
  },
}));

registerExtractor('interface_boundary', (weight) => ({
  id: 'interface_boundary',
  type: 'prose',
  weight,
  async extract(input: ReviewInput): Promise<ExtractedContext | null> {
    if (!input.content.trim()) return null;

    const boundaryPatterns = [
      /(?:interface|type|export)\s+\w+/g,
      /(?:endpoint|route|api|contract|boundary|port|adapter)/gi,
      /(?:input|output|request|response)\s*[:{]/gi,
    ];

    const matches: string[] = [];
    for (const pattern of boundaryPatterns) {
      const found = input.content.match(pattern);
      if (found) matches.push(...found);
    }

    if (matches.length === 0) return null;

    const content = `Interface boundaries detected:\n${matches.join('\n')}`;
    return {
      extractorId: 'interface_boundary',
      type: 'prose',
      content,
      metadata: { relevanceHint: 0.6, symbols: matches },
      tokenEstimate: Math.ceil(content.length / 4),
    };
  },
}));

registerExtractor('prior_decisions', (weight) => ({
  id: 'prior_decisions',
  type: 'prose',
  weight,
  async extract(input: ReviewInput): Promise<ExtractedContext | null> {
    // Phase 1: uses design context if provided, otherwise no-op
    if (!input.designContext) return null;

    return {
      extractorId: 'prior_decisions',
      type: 'prose',
      content: input.designContext,
      metadata: { relevanceHint: 0.8 },
      tokenEstimate: Math.ceil(input.designContext.length / 4),
    };
  },
}));
