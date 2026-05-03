import 'dotenv/config';
import { App } from '@slack/bolt';
import { queryClient } from '../../db/client.js';
import { embed } from '../../embeddings/embed.js';
import { setupEvents } from './events.js';
import { setupReactions } from './reactions.js';
import type { PipelineDeps } from '../../agents/pipeline.js';
import type { Utterance } from '../../core/types.js';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

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
      SELECT embedding::text as embedding
      FROM agent_utterances
      WHERE agent_id = ${agentId} AND embedding IS NOT NULL
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return rows
      .filter(r => r.embedding)
      .map(r => JSON.parse(r.embedding as string));
  },

  embed,
};

setupEvents(app, deps);
setupReactions(app);

(async () => {
  await app.start();
  console.log('⚡ Critic Slack bot is running (socket mode)');
})();
