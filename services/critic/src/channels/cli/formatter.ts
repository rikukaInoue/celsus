import chalk from 'chalk';
import type { AgentResponse } from '../../agents/pipeline.js';

export function formatResponse(response: AgentResponse): string {
  if (response.suppressed) {
    return chalk.dim(`  ─── ${response.agentId} ── [suppressed]`);
  }

  const color = response.agentId === 'mitra' ? chalk.bold.yellow : chalk.bold.blue;
  const emoji = response.agentId === 'mitra' ? '🟠' : '🔵';
  const header = color(`  ${emoji} ${response.agentId} ${'─'.repeat(45)}`);
  const body = response.content
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');

  return `\n${header}\n${body}\n`;
}

export function formatPreferencePrompt(responses: AgentResponse[]): string {
  const active = responses.filter(r => !r.suppressed);
  if (active.length < 2) return '';

  const options = active.map((r, i) => `[${i + 1}] ${r.agentId}`).join('  ');
  return `\n${chalk.yellow('  Which response was more helpful?')}\n  ${options}  [s] skip\n`;
}

export function formatStats(stats: { agentId: string; utteranceCount: number; variance: number; preferredCount: number }[]): string {
  return stats.map(s =>
    `  ${chalk.bold(s.agentId)}: ${s.utteranceCount} utterances, variance: ${s.variance.toFixed(4)}, preferred: ${s.preferredCount}x`
  ).join('\n');
}
