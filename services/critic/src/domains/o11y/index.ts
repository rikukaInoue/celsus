// o11y domain — placeholder for the operations (observability) 職能.
//
// Currently a harmless stub: no extractors, no agents, and classify only ever
// returns 'noise'. Its job at this stage is to prove a second domain can ride
// the same pipeline vessel without disturbing the librarian. The real metric /
// log extractors and the incident/vuln/release/noise classify vocabulary land
// in a later phase.

import type { Domain } from '../../core/domain.js';
import type { AgentConfig, DomainInput, Extractor } from '../../core/types.js';
import { registerDomain } from '../../core/domain-registry.js';

export const o11yDomain: Domain = {
  id: 'o11y',

  async classify(_input: DomainInput): Promise<string> {
    return 'noise';
  },

  extractorsFor(_agent: AgentConfig, _modality: string): Extractor[] {
    return [];
  },

  loadAgents(): AgentConfig[] {
    return [];
  },
};

registerDomain(o11yDomain);
