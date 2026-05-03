import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { AgentConfigSchema } from './schema.js';
import type { AgentConfig } from './types.js';

export function loadAgentConfig(configPath: string): AgentConfig {
  const raw = readFileSync(configPath, 'utf-8');
  const parsed = parse(raw);
  const validated = AgentConfigSchema.parse(parsed);

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
    tone: validated.tone,
  };
}

export function loadAllAgentConfigs(definitionsDir: string): AgentConfig[] {
  const dirs = readdirSync(definitionsDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  return dirs.map(dir => {
    const configPath = join(definitionsDir, dir.name, 'config.yaml');
    return loadAgentConfig(configPath);
  });
}
