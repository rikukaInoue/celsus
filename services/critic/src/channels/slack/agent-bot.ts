import type { App } from '@slack/bolt';
import { normalizeSlackInput } from '../normalizer.js';
import { runPipeline, type PipelineDeps } from '../../agents/pipeline.js';
import { getAgents, getAgent } from '../../agents/registry.js';
import { recordFeedback } from '../../feedback/collector.js';
import { reactionToSignal } from '../../feedback/signals.js';
import type { ReviewInput, Message } from '../../core/types.js';

const utteranceMap = new Map<string, { agentId: string; utteranceId: string }>();

async function fetchThreadMessages(app: App, channel: string, threadTs: string): Promise<Message[]> {
  try {
    const result = await app.client.conversations.replies({
      channel,
      ts: threadTs,
      limit: 200,
    });

    if (!result.messages) return [];

    return result.messages
      .map(m => ({
        id: m.ts ?? '',
        source: 'slack' as const,
        author: m.bot_id ? 'agent' : (m.user ?? 'unknown'),
        content: (m.text ?? '').replace(/<@[A-Z0-9]+>/g, '').trim(),
        timestamp: new Date(parseFloat(m.ts ?? '0') * 1000),
        modality: 'prose' as const,
      }));
  } catch {
    return [];
  }
}

export function setupAgentBot(app: App, agentId: string, deps: PipelineDeps) {
  const agent = getAgent(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  app.event('app_mention', async ({ event, say }) => {
    const content = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
    if (!content) {
      const emptyReplies = agentId === 'mitra'
        ? [
            'あっ 何かありました？ 聞きますよ！',
            '先輩！ 何でも聞いてください',
            'はいっ なんでしょう？',
            '呼びました？ 何か手伝えることあります？',
            'お疲れ様です！ 何かあったら言ってくださいね',
          ]
        : [
            '……うん',
            '……何？',
            '聞いてる',
            '……',
            '呼んだ？',
          ];
      const reply = emptyReplies[Math.floor(Math.random() * emptyReplies.length)];
      await say({ text: reply, thread_ts: event.ts });
      return;
    }

    // Fetch thread history if in a thread
    const threadTs = event.thread_ts ?? event.ts;
    const priorMessages = event.thread_ts
      ? await fetchThreadMessages(app, event.channel, event.thread_ts)
      : [];

    const message = normalizeSlackInput(content, event.user ?? 'unknown', threadTs);

    const input: ReviewInput = {
      id: message.id,
      content: message.content,
      language: message.modality === 'code' ? 'typescript' : undefined,
      priorMessages,
    };

    const result = await runPipeline(input, [agent], deps, { speakingMode: 'named' });
    const response = result.responses.find(r => !r.suppressed);

    if (response) {
      const msg = await say({
        text: response.content,
        thread_ts: threadTs,
      });

      if (msg.ts) {
        utteranceMap.set(msg.ts, { agentId: response.agentId, utteranceId: response.utteranceId });
      }
    }
  });

  const reactionReplies: Record<string, string[]> = agentId === 'mitra'
    ? {
        thumbsup: ['ありがとうございます！', 'うれしいです！', 'イェイ'],
        thumbsdown: ['あっ すみません…！ 次はもっとちゃんと考えます', 'ごめんなさい… もうちょっと考え直しますね'],
        heavy_check_mark: ['よかった！', 'おっ 合ってました？ うれしい'],
        thinking_face: ['うーん 分かりにくかったですかね？ もう少し詳しく聞きます？'],
      }
    : {
        thumbsup: ['ありがとうございます', 'お役に立てたなら良かったです'],
        thumbsdown: ['すみません… もう少し整理し直しますね', '的外れでしたか… 別の角度から考えてみます'],
        heavy_check_mark: ['よかったです', '確認できて安心しました'],
        thinking_face: ['……もう少し掘り下げた方がいいですかね？'],
      };

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

    const replies = reactionReplies[event.reaction];
    if (replies) {
      const reply = replies[Math.floor(Math.random() * replies.length)];
      try {
        const channel = event.item.channel;
        const threadTs = event.item.ts;
        await app.client.chat.postMessage({
          channel,
          text: reply,
          thread_ts: threadTs,
        });
      } catch {
        // ignore reply failures
      }
    }
  });
}
