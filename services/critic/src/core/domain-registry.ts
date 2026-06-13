import type { Domain } from './domain.js';

// Registry of all domains known to the pipeline. Domains register themselves as
// a side effect of being imported (see e.g. domains/librarian/index.ts), and the
// pipeline resolves them by id from DomainInput.domainId.
const domains = new Map<string, Domain>();

export function registerDomain(d: Domain): void {
  domains.set(d.id, d);
}

export function getDomain(id: string): Domain | undefined {
  return domains.get(id);
}

export function listDomains(): Domain[] {
  return [...domains.values()];
}
