import type { App } from '@slack/bolt';
import { reactionToSignal } from '../../feedback/signals.js';
import { recordFeedback } from '../../feedback/collector.js';
import { getUtteranceForMessage } from './events.js';

export function setupReactions(app: App) {
  app.event('reaction_added', async ({ event }) => {
    const signal = reactionToSignal(event.reaction);
    if (!signal) return;

    const utterance = getUtteranceForMessage(event.item.ts);
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
