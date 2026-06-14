import 'dotenv/config';
import { db, queryClient } from '../../db/client.js';
import { agentUtterances } from '../../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { embed } from '../../embeddings/embed.js';
import { startRepl } from './repl.js';
// Register all domains so the pipeline can resolve them by id.
import '../../domains/index.js';
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
      SELECT embedding::text as embedding
      FROM agent_utterances
      WHERE agent_id = ${agentId} AND embedding IS NOT NULL
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return rows
      .filter(r => r.embedding)
      .map(r => JSON.parse((r.embedding as string).replace('[', '[').replace(']', ']')));
  },

  embed,
};

startRepl(deps);
