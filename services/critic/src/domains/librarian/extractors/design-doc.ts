import { registerExtractor } from './interface.js';
import type { ReviewInput, ExtractedContext } from '../../../core/types.js';
import { db } from '../../../db/client.js';
import { sql } from 'drizzle-orm';

registerExtractor('design_doc', (weight) => ({
  id: 'design_doc',
  type: 'shared',
  weight,
  async extract(input: ReviewInput): Promise<ExtractedContext | null> {
    if (!input.content.trim()) return null;

    // Phase 1: keyword-based search against design_doc_chunks
    // TODO: replace with vector similarity once embeddings are populated
    const keywords = input.content
      .split(/\s+/)
      .filter(w => w.length > 4)
      .slice(0, 10);

    if (keywords.length === 0) return null;

    const likeConditions = keywords.map(k => `chunk_text ILIKE '%${k.replace(/'/g, "''")}%'`);
    const query = sql.raw(`
      SELECT chunk_text, source_path
      FROM design_doc_chunks
      WHERE ${likeConditions.join(' OR ')}
      LIMIT 3
    `);

    try {
      const results = await db.execute(query) as unknown as { chunk_text: string; source_path: string }[];
      if (!results || results.length === 0) return null;

      const content = results
        .map(r => `[${r.source_path ?? 'doc'}]\n${r.chunk_text}`)
        .join('\n\n---\n\n');

      return {
        extractorId: 'design_doc',
        type: 'shared',
        content,
        metadata: { relevanceHint: 0.5 },
        tokenEstimate: Math.ceil(content.length / 4),
      };
    } catch {
      return null;
    }
  },
}));
