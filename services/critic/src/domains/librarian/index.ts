// Librarian domain — the original "critic" (司書) behaviour.
//
// Step 1 (re-export shell): this file is a thin gateway that points at the
// existing librarian-specific modules without moving them yet. Nothing imports
// it in this step; it just establishes the `domains/librarian` namespace so the
// later contract wiring and physical file moves stay non-breaking.

// Register the librarian extractors as a side effect of importing this domain.
import '../../extractors/ast-signature.js';
import '../../extractors/type-info.js';
import '../../extractors/design-doc.js';
import '../../extractors/plan-context.js';

export { classifySpeechAct, type SpeechAct } from '../../agents/classifier.js';
export { createExtractorsForAgent } from '../../extractors/interface.js';
export { getAgents, getAgent } from '../../agents/registry.js';
