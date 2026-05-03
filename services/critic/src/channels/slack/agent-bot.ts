import type { App } from '@slack/bolt';
import { normalizeSlackInput } from '../normalizer.js';
import { runPipeline, type PipelineDeps } from '../../agents/pipeline.js';
import { getAgents, getAgent } from '../../agents/registry.js';
import { recordFeedback } from '../../feedback/collector.js';
import { reactionToSignal } from '../../feedback/signals.js';
import type { ReviewInput } from '../../core/types.js';

const utteranceMap = new Map<string, { agentId: string; utteranceId: string }>();

export function setupAgentBot(app: App, agentId: string, deps: PipelineDeps) {
  const agent = getAgent(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  app.event('app_mention', async ({ event, say }) => {
    const content = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
    if (!content) {
      await say({ text: '何か聞いてください！', thread_ts: event.ts });
      return;
    }

    const message = normalizeSlackInput(content, event.user ?? 'unknown', event.thread_ts ?? event.ts);

    const input: ReviewInput = {
      id: message.id,
      content: message.content,
      language: message.modality === 'code' ? 'typescript' : undefined,
    };

    // Run pipeline with only this agent, named mode
    const result = await runPipeline(input, [agent], deps, { speakingMode: 'named' });
    const response = result.responses.find(r => !r.suppressed);

    if (response) {
      const msg = await say({
        text: response.content,
        thread_ts: event.thread_ts ?? event.ts,
      });

      if (msg.ts) {
        utteranceMap.set(msg.ts, { agentId: response.agentId, utteranceId: response.utteranceId });
      }
    }
  });

  // Reactions as feedback
  app.event('reaction_added', async ({ event }) => {
    const signal = reactionToSignal(event.reaction);
    if (!signal) return;

    const utterance = utteranceMap.get(event.item.ts);
    if (!utterance) return;

    await recordFeedback({
      utteranceId: utterance.utteranceId,
      source: 'human',
      axis: signal.axis,
      signal: signal.signal,
      context: { reaction: event.reaction, slackUser: event.user },
    });
  });
}
