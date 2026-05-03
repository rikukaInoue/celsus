import { randomUUID } from 'node:crypto';
import type { Message } from '../core/types.js';

export function detectModality(content: string): 'code' | 'prose' | 'mixed' {
  const codeIndicators = [
    /^\s*(import|export|const|let|var|function|class|interface|type)\s/m,
    /[{};]\s*$/m,
    /=>/,
    /\(\s*\w+\s*:\s*\w+/,
  ];

  const codeScore = codeIndicators.filter(p => p.test(content)).length;
  if (codeScore >= 2) return 'code';
  if (codeScore === 1) return 'mixed';
  return 'prose';
}

export function normalizeCliInput(content: string, author: string): Message {
  return {
    id: randomUUID(),
    source: 'cli',
    author,
    content,
    timestamp: new Date(),
    modality: detectModality(content),
  };
}

export function normalizeSlackInput(
  content: string,
  author: string,
  threadTs?: string,
): Message {
  return {
    id: randomUUID(),
    source: 'slack',
    author,
    content,
    refs: threadTs ? [threadTs] : undefined,
    timestamp: new Date(),
    modality: detectModality(content),
  };
}
