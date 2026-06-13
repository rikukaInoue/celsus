import 'dotenv/config';
import { App } from '@slack/bolt';
import { queryClient } from '../../db/client.js';
import { embed } from '../../embeddings/embed.js';
import { setupAgentBot } from './agent-bot.js';
// Register the librarian domain so the pipeline can resolve it by id.
import '../../domains/librarian/index.js';
import { connectGitHubServer } from '../../shared/mcp-client.js';
import type { PipelineDeps } from '../../agents/pipeline.js';
import type { Utterance } from '../../core/types.js';

const deps: PipelineDeps = {
  async saveUtterance(u: Omit<Utterance, 'createdAt'>) {
    const embeddingVector = await embed(u.content);
    const embeddingStr = `[${embeddingVector.join(',')}]`;
    await queryClient`
      INSERT INTO agent_utterances (id, agent_id, config_version, turn_id, parent_msg_id, content, embedding, view_context)
      VALUES (${u.id}, ${u.agentId}, ${u.configVersion}, ${u.turnId}, ${u.parentMsgId ?? null}, ${u.content}, ${embeddingStr}::vector, ${JSON.stringify(u.viewContext ?? {})})
    `;
  },
  async getRecentEmbeddings(agentId: string, limit: number): Promise<number[][]> {
    const rows = await queryClient`
      SELECT embedding::text as embedding FROM agent_utterances
      WHERE agent_id = ${agentId} AND embedding IS NOT NULL
      ORDER BY created_at DESC LIMIT ${limit}
    `;
    return rows.filter(r => r.embedding).map(r => JSON.parse(r.embedding as string));
  },
  embed,
};

const botConfigs = [
  {
    agentId: 'mitra',
    botToken: process.env.MITRA_SLACK_BOT_TOKEN,
    appToken: process.env.MITRA_SLACK_APP_TOKEN,
    botUserId: process.env.MITRA_SLACK_BOT_USER_ID,
  },
  {
    agentId: 'aria',
    botToken: process.env.ARIA_SLACK_BOT_TOKEN,
    appToken: process.env.ARIA_SLACK_APP_TOKEN,
    botUserId: process.env.ARIA_SLACK_BOT_USER_ID,
  },
];

const peerMap = new Map<string, { agentId: string; slackUserId: string }>();

(async () => {
  await connectGitHubServer();
  for (const bot of botConfigs) {
    if (!bot.botToken || !bot.appToken) {
      console.log(`⏭ Skipping ${bot.agentId} (no tokens configured)`);
      continue;
    }

    const peers = botConfigs
      .filter(b => b.agentId !== bot.agentId && b.botUserId)
      .map(b => ({ agentId: b.agentId, slackUserId: b.botUserId! }));

    const app = new App({
      token: bot.botToken,
      appToken: bot.appToken,
      socketMode: true,
    });

    setupAgentBot(app, bot.agentId, deps, peers);
    try {
      await app.start();
      console.log(`⚡ ${bot.agentId} bot is running (socket mode)`);
    } catch (err) {
      console.error(`❌ ${bot.agentId} failed to start: ${(err as Error).message}`);
    }
  }
})();
