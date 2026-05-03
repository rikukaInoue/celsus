CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE agent_utterances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  config_version INT NOT NULL,
  turn_id TEXT NOT NULL,
  parent_msg_id UUID,
  content TEXT NOT NULL,
  embedding vector(384),
  view_context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utterance_id UUID NOT NULL REFERENCES agent_utterances(id),
  source TEXT NOT NULL,
  axis TEXT,
  signal REAL NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE design_doc_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id TEXT NOT NULL,
  source_path TEXT,
  chunk_text TEXT NOT NULL,
  embedding vector(384),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_utterances_agent ON agent_utterances(agent_id);
CREATE INDEX idx_utterances_embedding ON agent_utterances
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
CREATE INDEX idx_doc_chunks_embedding ON design_doc_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
CREATE INDEX idx_feedback_utterance ON feedback(utterance_id);
