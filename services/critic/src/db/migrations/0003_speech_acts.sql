CREATE TABLE speech_act_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_text TEXT NOT NULL,
  classified_as TEXT NOT NULL,
  input_length INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_speech_act_classified ON speech_act_logs(classified_as);
