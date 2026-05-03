import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { AgentConfigSchema } from './schema.js';
import type { AgentConfig, VoiceSample } from './types.js';

function loadVoiceSamples(dir: string): VoiceSample[] {
  const filePath = join(dir, 'voice_samples.jsonl');
  if (!existsSync(filePath)) return [];

  const raw = readFileSync(filePath, 'utf-8');
  return raw
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as VoiceSample);
}

export function loadAgentConfig(configDir: string): AgentConfig {
  const configPath = join(configDir, 'config.yaml');
  const raw = readFileSync(configPath, 'utf-8');
  const parsed = parse(raw);
  const validated = AgentConfigSchema.parse(parsed);
  const voiceSamples = loadVoiceSamples(configDir);

  return {
    id: validated.id,
    displayName: validated.display_name,
    version: validated.version,
    extractors: validated.extractors,
    judgmentAxes: validated.judgment_axes,
    speechPolicy: {
      alphaWeights: validated.speech_policy.alpha_weights,
      thresholdLow: validated.speech_policy.threshold_low,
      thresholdHigh: validated.speech_policy.threshold_high,
    },
    anchorStrength: validated.anchor_strength,
    anisotropyTolerance: validated.anisotropy_tolerance,
    voiceSamples,
  };
}

export function loadAllAgentConfigs(definitionsDir: string): AgentConfig[] {
  const dirs = readdirSync(definitionsDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  return dirs.map(dir => loadAgentConfig(join(definitionsDir, dir.name)));
}
