// Domain bootstrap: importing this module registers every available domain with
// the domain registry as a side effect. Entry points import it once at startup
// so the pipeline can resolve any domain by id. Add new domains here.
import './librarian/index.js';
import './o11y/index.js';
