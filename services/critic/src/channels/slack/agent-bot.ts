import type { App } from '@slack/bolt';
import { normalizeSlackInput } from '../normalizer.js';
import { runPipeline, type PipelineDeps } from '../../agents/pipeline.js';
import { getAgents, getAgent } from '../../agents/registry.js';
import { recordFeedback } from '../../feedback/collector.js';
import { reactionToSignal } from '../../feedback/signals.js';
import type { ReviewInput, Message } from '../../core/types.js';

const utteranceMap = new Map<string, { agentId: string; utteranceId: string }>();
const activeThreads = new Set<string>();

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

export interface PeerBot {
  agentId: string;
  slackUserId: string;
}

const calledPeerInThread = new Set<string>();

export function setupAgentBot(app: App, agentId: string, deps: PipelineDeps, peers: PeerBot[] = []) {
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

    const threadTs = event.thread_ts ?? event.ts;
    activeThreads.add(threadTs);
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

      await maybeSummonPeer(app, response.content, threadTs, event.channel);
    }
  });

  const positivePatterns = [
    /なるほど/, /ありがとう/, /いいね/, /いい感じ/, /助かる/, /さすが/,
    /たしかに/, /それだ/, /わかった/, /すごい/, /おお/,
  ];
  const negativePatterns = [
    /違う/, /そうじゃな/, /雑/, /的外れ/, /意味わからん/, /ずれて/,
    /それは違/, /ちがくない/, /微妙/, /う[ーん]+/, /いや[、。]/,
  ];

  function classifyReply(text: string): number {
    const posScore = positivePatterns.filter(p => p.test(text)).length;
    const negScore = negativePatterns.filter(p => p.test(text)).length;
    if (posScore > negScore) return 0.5;
    if (negScore > posScore) return -0.3;
    return 0;
  }

  async function recordImplicitFeedback(userReply: string, threadTs: string) {
    const signal = classifyReply(userReply);
    if (signal === 0) return;

    const recentUtterances = [...utteranceMap.entries()]
      .filter(([ts]) => ts > threadTs)
      .sort(([a], [b]) => b.localeCompare(a));

    const lastBotUtterance = recentUtterances[0];
    if (!lastBotUtterance) return;

    const [, utterance] = lastBotUtterance;

    await recordFeedback({
      utteranceId: utterance.utteranceId,
      source: 'human_implicit',
      axis: 'general',
      signal,
      context: { userReply, type: 'implicit_chat' },
    });
  }

  async function maybeSummonPeer(app: App, responseContent: string, threadTs: string, channel: string) {
    if (peers.length === 0) return;
    if (calledPeerInThread.has(threadTs)) return;

    const shouldSummon = /Aria|アリア|Mitra|ミトラ|別の視点|他の意見|聞いてみ/.test(responseContent);
    if (!shouldSummon) return;

    const peer = peers[0];
    calledPeerInThread.add(threadTs);

    const summonMessages = agentId === 'mitra'
      ? [
          `<@${peer.slackUserId}> ちょっと聞いてもいいですか？`,
          `<@${peer.slackUserId}> これどう思います？`,
          `<@${peer.slackUserId}> 先輩の意見も聞きたいです！`,
        ]
      : [
          `<@${peer.slackUserId}> ……どう思う？`,
          `<@${peer.slackUserId}>`,
        ];

    const msg = summonMessages[Math.floor(Math.random() * summonMessages.length)];

    try {
      await app.client.chat.postMessage({
        channel,
        text: msg,
        thread_ts: threadTs,
      });
    } catch {
    }
  }

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

  app.message(async ({ message, say }) => {
    if (message.subtype) return;
    const msg = message as { text?: string; thread_ts?: string; ts: string; channel: string; user?: string; bot_id?: string };
    if (msg.bot_id) return;
    if (!msg.thread_ts) return;
    if (!activeThreads.has(msg.thread_ts)) return;
    if ((msg.text ?? '').includes(`<@`)) return;

    const content = (msg.text ?? '').trim();
    if (!content) return;

    await recordImplicitFeedback(content, msg.thread_ts);

    const priorMessages = await fetchThreadMessages(app, msg.channel, msg.thread_ts);
    const normalized = normalizeSlackInput(content, msg.user ?? 'unknown', msg.thread_ts);

    const input: ReviewInput = {
      id: normalized.id,
      content: normalized.content,
      language: normalized.modality === 'code' ? 'typescript' : undefined,
      priorMessages,
    };

    const result = await runPipeline(input, [agent], deps, { speakingMode: 'auto' });
    const response = result.responses.find(r => !r.suppressed);

    if (response) {
      const posted = await say({
        text: response.content,
        thread_ts: msg.thread_ts,
      });

      if (posted.ts) {
        utteranceMap.set(posted.ts, { agentId: response.agentId, utteranceId: response.utteranceId });
      }
    }
  });
}
