import { pgTable, uuid, text, integer, real, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const agentUtterances = pgTable('agent_utterances', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  agentId: text('agent_id').notNull(),
  configVersion: integer('config_version').notNull(),
  turnId: text('turn_id').notNull(),
  parentMsgId: uuid('parent_msg_id'),
  content: text('content').notNull(),
  embedding: text('embedding'),
  viewContext: jsonb('view_context'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_utterances_agent').on(table.agentId),
]);

export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  utteranceId: uuid('utterance_id').notNull().references(() => agentUtterances.id),
  source: text('source').notNull(),
  axis: text('axis'),
  signal: real('signal').notNull(),
  context: jsonb('context'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_feedback_utterance').on(table.utteranceId),
]);

export const designDocChunks = pgTable('design_doc_chunks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  docId: text('doc_id').notNull(),
  sourcePath: text('source_path'),
  chunkText: text('chunk_text').notNull(),
  embedding: text('embedding'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
