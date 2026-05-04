import Anthropic from '@anthropic-ai/sdk';
import type { Tool, MessageParam, ContentBlock } from '@anthropic-ai/sdk/resources/messages';

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

export interface ToolHandler {
  (name: string, input: Record<string, unknown>): Promise<string>;
}

export async function generate(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
  tools?: Tool[];
  onToolCall?: ToolHandler;
}): Promise<string> {
  const anthropic = getClient();
  const messages: MessageParam[] = [{ role: 'user', content: opts.prompt }];
  const maxLoops = 5;

  for (let i = 0; i < maxLoops; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: opts.maxTokens ?? 2048,
      system: opts.system,
      messages,
      ...(opts.tools && opts.tools.length > 0 ? { tools: opts.tools } : {}),
    });

    if (response.stop_reason === 'tool_use' && opts.onToolCall) {
      const toolBlocks = response.content.filter((b): b is Extract<ContentBlock, { type: 'tool_use' }> => b.type === 'tool_use');
      const textBlocks = response.content.filter(b => b.type === 'text');

      messages.push({ role: 'assistant', content: response.content });

      const toolResults: MessageParam['content'] = [];
      for (const tool of toolBlocks) {
        const result = await opts.onToolCall(tool.name, tool.input as Record<string, unknown>);
        toolResults.push({
          type: 'tool_result' as const,
          tool_use_id: tool.id,
          content: result,
        });
      }

      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : '';
  }

  return '';
}
