import type { AgentConfig, DomainInput, Extractor } from './types.js';

// A Domain bundles the pieces that are specific to one problem area (librarian,
// o11y, ...) behind a stable contract. The core pipeline (extract → draft →
// score → refine → persist) stays domain-agnostic and reaches domain-specific
// behaviour only through this interface, resolved via the domain registry.
export interface Domain {
  // Stable identifier, e.g. 'librarian' | 'o11y'. Matches DomainInput.domainId.
  readonly id: string;

  // Generalised form of the librarian's classifySpeechAct. The return value is a
  // plain string so each domain can use its own vocabulary (speech acts for the
  // librarian, incident/vuln/release/noise for o11y, ...).
  classify(input: DomainInput): Promise<string>;

  // Build the extractors that should run for the given agent and input modality.
  extractorsFor(agent: AgentConfig, modality: string): Extractor[];

  // Load the agent configurations that belong to this domain.
  loadAgents(): AgentConfig[];
}
