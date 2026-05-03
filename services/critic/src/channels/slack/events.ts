import type { App } from '@slack/bolt';
import { normalizeSlackInput } from '../normalizer.js';
import { runPipeline, type PipelineDeps } from '../../agents/pipeline.js';
import { getAgents } from '../../agents/registry.js';
import type { ReviewInput } from '../../core/types.js';

// Track which message ts maps to which utterance for feedback
const utteranceMap = new Map<string, { agentId: string; utteranceId: string }>();

export function getUtteranceForMessage(ts: string) {
  return utteranceMap.get(ts);
}

export function setupEvents(app: App, deps: PipelineDeps) {
  app.event('app_mention', async ({ event, say }) => {
    const content = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
    if (!content) {
      await say({ text: 'Send me code or a design question to review.', thread_ts: event.ts });
      return;
    }

    const message = normalizeSlackInput(content, event.user ?? 'unknown', event.thread_ts ?? event.ts);
    const agents = getAgents();

    const input: ReviewInput = {
      id: message.id,
      content: message.content,
      language: message.modality === 'code' ? 'typescript' : undefined,
    };

    const result = await runPipeline(input, agents, deps, { speakingMode: 'both' });
    const active = result.responses.filter(r => !r.suppressed);

    for (const response of active) {
      const emoji = response.agentId === 'signature_critic' ? ':mag:' : ':dart:';
      const msg = await say({
        text: `${emoji} *${response.agentId}* (α=${response.alpha.toFixed(2)})\n\n${response.content}`,
        thread_ts: event.thread_ts ?? event.ts,
      });

      if (msg.ts) {
        utteranceMap.set(msg.ts, { agentId: response.agentId, utteranceId: response.utteranceId });
      }
    }

    if (active.length >= 2) {
      await say({
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: 'Which review was more helpful?' },
          },
          {
            type: 'actions',
            elements: active.map(r => ({
              type: 'button' as const,
              text: { type: 'plain_text' as const, text: r.agentId },
              action_id: `prefer_${r.agentId}`,
              value: JSON.stringify({ selected: r.utteranceId, other: active.find(a => a.utteranceId !== r.utteranceId)?.utteranceId }),
            })),
          },
        ],
        thread_ts: event.thread_ts ?? event.ts,
      });
    }
  });

  app.action(/^prefer_/, async ({ action, ack, body }) => {
    await ack();
    if (action.type !== 'button') return;

    const { selected, other } = JSON.parse(action.value ?? '{}');
    const { recordPreference } = await import('../../feedback/collector.js');
    await recordPreference(selected, other, 'human');
  });
}
