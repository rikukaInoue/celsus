ALTER TABLE agent_utterances ADD COLUMN slack_ts TEXT;
ALTER TABLE agent_utterances ADD COLUMN slack_channel TEXT;
CREATE INDEX idx_utterances_slack_ts ON agent_utterances(slack_ts);
