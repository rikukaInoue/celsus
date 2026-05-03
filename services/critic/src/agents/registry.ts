import { resolve } from 'node:path';
import type { AgentConfig } from '../core/types.js';
import { loadAllAgentConfigs } from '../core/config-loader.js';

// Register all extractors on import
import '../extractors/ast-signature.js';
import '../extractors/type-info.js';
import '../extractors/design-doc.js';
import '../extractors/plan-context.js';

let agents: AgentConfig[] | null = null;

export function getAgents(): AgentConfig[] {
  if (!agents) {
    const configDir = process.env.AGENTS_CONFIG_DIR ?? resolve(import.meta.dirname, '../../definitions');
    agents = loadAllAgentConfigs(configDir);
  }
  return agents;
}

export function getAgent(id: string): AgentConfig | undefined {
  return getAgents().find(a => a.id === id);
}
