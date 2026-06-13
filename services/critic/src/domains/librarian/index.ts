// Librarian domain — the original "critic" (司書) behaviour.
//
// Implements the Domain contract over the existing librarian modules
// (classifier, extractor registry, agent registry) and registers itself as a
// side effect of import. Files are not physically moved yet; that happens in a
// later step. Importing this module is what makes the librarian available to the
// pipeline, so entry points import it for its registration side effect.

import type { Domain } from '../../core/domain.js';
import type { AgentConfig, DomainInput, Extractor } from '../../core/types.js';
import { registerDomain } from '../../core/domain-registry.js';
import { classifySpeechAct } from '../../agents/classifier.js';
import { createExtractorsForAgent } from '../../extractors/interface.js';
import { getAgents } from '../../agents/registry.js';

// Register the librarian extractors as a side effect (also pulled in via the
// agent registry, but kept explicit so the domain owns its registrations).
import '../../extractors/ast-signature.js';
import '../../extractors/type-info.js';
import '../../extractors/design-doc.js';
import '../../extractors/plan-context.js';

function narrowModality(modality: string): 'code' | 'prose' | 'mixed' {
  return modality === 'code' || modality === 'prose' ? modality : 'mixed';
}

export const librarianDomain: Domain = {
  id: 'librarian',

  async classify(input: DomainInput): Promise<string> {
    return classifySpeechAct(input.content);
  },

  extractorsFor(agent: AgentConfig, modality: string): Extractor[] {
    return createExtractorsForAgent(agent.extractors, narrowModality(modality));
  },

  loadAgents(): AgentConfig[] {
    return getAgents();
  },
};

registerDomain(librarianDomain);

export { classifySpeechAct, type SpeechAct } from '../../agents/classifier.js';
export { getAgents, getAgent } from '../../agents/registry.js';
