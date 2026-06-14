import type { AgentConfig, DomainInput, Extractor } from './types.js';

// A Domain bundles the pieces that are specific to one problem area (librarian,
// o11y, ...) behind a stable contract. The core pipeline (extract → draft →
// score → refine → persist) stays domain-agnostic and reaches domain-specific
// behaviour only through this interface, resolved via the domain registry.
//
// Wiring status (intentional, incremental): today the pipeline only routes
// `extractorsFor` through this seam. `classify` and `loadAgents` are defined and
// implemented ahead of their callers — they get wired when the approval-gate /
// o11y phase lands (draft.ts stops calling classifySpeechAct directly, and the
// channels resolve agents via getDomain(id).loadAgents() instead of importing the
// librarian registry). Until then they are deliberately dormant, not dead code.
export interface Domain {
  // Stable identifier, e.g. 'librarian' | 'o11y'. Matches DomainInput.domainId.
  readonly id: string;

  // Generalised form of the librarian's classifySpeechAct. The return value is a
  // plain string so each domain can use its own vocabulary (speech acts for the
  // librarian, incident/vuln/release/noise for o11y, ...).
  // NOT yet invoked through the seam — see "Wiring status" above.
  classify(input: DomainInput): Promise<string>;

  // Build the extractors that should run for the given agent and input modality.
  // This is the one method the pipeline currently resolves via the registry.
  extractorsFor(agent: AgentConfig, modality: string): Extractor[];

  // Load the agent configurations that belong to this domain.
  // NOT yet invoked through the seam — see "Wiring status" above.
  loadAgents(): AgentConfig[];
}
