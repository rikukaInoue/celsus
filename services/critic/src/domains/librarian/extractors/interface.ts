import type { Extractor, ReviewInput, ExtractedContext } from '../../../core/types.js';

export type ExtractorFactory = (weight: number) => Extractor;

const registry = new Map<string, ExtractorFactory>();

export function registerExtractor(type: string, factory: ExtractorFactory) {
  registry.set(type, factory);
}

export function createExtractor(type: string, weight: number): Extractor {
  const factory = registry.get(type);
  if (!factory) {
    throw new Error(`Unknown extractor type: ${type}`);
  }
  return factory(weight);
}

export function createExtractorsForAgent(
  config: { code: { type: string; weight: number }[]; prose: { type: string; weight: number }[]; shared: { type: string; weight: number }[] },
  inputModality: 'code' | 'prose' | 'mixed',
): Extractor[] {
  const extractors: Extractor[] = [];

  if (inputModality === 'code' || inputModality === 'mixed') {
    for (const def of config.code) {
      extractors.push(createExtractor(def.type, def.weight));
    }
  }

  if (inputModality === 'prose' || inputModality === 'mixed') {
    for (const def of config.prose) {
      extractors.push(createExtractor(def.type, def.weight));
    }
  }

  for (const def of config.shared) {
    extractors.push(createExtractor(def.type, def.weight));
  }

  return extractors;
}
