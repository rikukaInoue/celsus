import { describe, it, expect } from 'vitest';

// Importing the bootstrap registers every domain as a side effect.
import './index.js';
import { getDomain, listDomains } from '../core/domain-registry.js';
import { librarianDomain, getAgents, LIBRARIAN_DOMAIN_ID } from './librarian/index.js';
import { o11yDomain } from './o11y/index.js';
import { createExtractorsForAgent } from './librarian/extractors/interface.js';

// Locks the domain seam introduced by the domain-non-dependent refactor. These
// assertions are the codified form of the smoke checks described in the PR.
describe('domain registry seam', () => {
  it('resolves registered domains by id', () => {
    expect(getDomain(LIBRARIAN_DOMAIN_ID)).toBe(librarianDomain);
    expect(getDomain('o11y')).toBe(o11yDomain);
  });

  it('returns undefined for an unknown domain id', () => {
    expect(getDomain('does-not-exist')).toBeUndefined();
  });

  it('lists at least the librarian and o11y domains', () => {
    const ids = listDomains().map((d) => d.id);
    expect(ids).toContain(LIBRARIAN_DOMAIN_ID);
    expect(ids).toContain('o11y');
  });
});

describe('librarian domain', () => {
  it('loads the same agent set as the direct registry (unchanged behaviour)', () => {
    const viaDomain = librarianDomain.loadAgents();
    expect(viaDomain).toEqual(getAgents());
    expect(viaDomain.length).toBeGreaterThan(0);
  });

  it('resolves the same extractor set as createExtractorsForAgent', () => {
    const agent = librarianDomain.loadAgents()[0];
    const viaDomain = librarianDomain.extractorsFor(agent, 'code').map((e) => e.id);
    const direct = createExtractorsForAgent(agent.extractors, 'code').map((e) => e.id);
    expect(viaDomain).toEqual(direct);
  });
});

describe('o11y domain (stub vessel)', () => {
  it('classifies everything as noise and contributes no extractors/agents yet', async () => {
    expect(o11yDomain.extractorsFor({} as never, 'code')).toEqual([]);
    expect(o11yDomain.loadAgents()).toEqual([]);
    await expect(
      o11yDomain.classify({
        id: 't',
        domainId: 'o11y',
        content: 'anything',
        source: 'api',
      }),
    ).resolves.toBe('noise');
  });
});
