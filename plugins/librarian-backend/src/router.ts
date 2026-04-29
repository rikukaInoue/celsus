import { LoggerService, AuthService, HttpAuthService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { Knex } from 'knex';

interface RouterOptions {
  logger: LoggerService;
  knex: Knex;
  auth: AuthService;
  httpAuth: HttpAuthService;
  catalog: unknown;
}

export async function createRouter(options: RouterOptions): Promise<express.Router> {
  const { logger, knex, httpAuth } = options;
  const router = Router();
  router.use(express.json());

  router.get('/health', (_, res) => {
    res.json({ status: 'ok' });
  });

  router.post('/views', async (req, res) => {
    const { entityRef } = req.body;
    if (!entityRef) {
      res.status(400).json({ error: 'entityRef is required' });
      return;
    }

    let userRef: string | null = null;
    try {
      const credentials = await httpAuth.credentials(req);
      const principal = credentials.principal as { userEntityRef?: string };
      userRef = principal.userEntityRef ?? null;
    } catch {
      // anonymous view
    }

    await knex('librarian_views').insert({
      entity_ref: entityRef,
      user_ref: userRef,
    });

    logger.debug(`View recorded: ${entityRef} by ${userRef ?? 'anonymous'}`);
    res.status(201).json({ recorded: true });
  });

  router.get('/views/:entityRef', async (req, res) => {
    const { entityRef } = req.params;
    const decoded = decodeURIComponent(entityRef);

    const [result] = await knex('librarian_views')
      .where('entity_ref', decoded)
      .count('id as count');

    const recentViews = await knex('librarian_views')
      .where('entity_ref', decoded)
      .orderBy('viewed_at', 'desc')
      .limit(10)
      .select('user_ref', 'viewed_at');

    res.json({
      entityRef: decoded,
      totalViews: Number(result.count),
      recentViews,
    });
  });

  router.get('/popular', async (_req, res) => {
    const limit = 20;

    const popular = await knex('librarian_views')
      .select('entity_ref')
      .count('id as view_count')
      .groupBy('entity_ref')
      .orderBy('view_count', 'desc')
      .limit(limit);

    res.json(
      popular.map(row => ({
        entityRef: row.entity_ref,
        viewCount: Number(row.view_count),
      })),
    );
  });

  router.get('/stats', async (_req, res) => {
    const [totalViews] = await knex('librarian_views').count('id as count');
    const [uniqueEntities] = await knex('librarian_views')
      .countDistinct('entity_ref as count');
    const [uniqueUsers] = await knex('librarian_views')
      .whereNotNull('user_ref')
      .countDistinct('user_ref as count');

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [todayViews] = await knex('librarian_views')
      .where('viewed_at', '>=', todayStart)
      .count('id as count');

    res.json({
      totalViews: Number(totalViews.count),
      uniqueEntities: Number(uniqueEntities.count),
      uniqueUsers: Number(uniqueUsers.count),
      todayViews: Number(todayViews.count),
    });
  });

  // FAQ endpoints
  router.get('/faqs', async (_req, res) => {
    const faqs = await knex('librarian_faqs')
      .orderBy('ask_count', 'desc')
      .limit(50);

    res.json(faqs);
  });

  router.post('/faqs', async (req, res) => {
    const { question, answer, entityRef } = req.body;
    if (!question || !answer) {
      res.status(400).json({ error: 'question and answer are required' });
      return;
    }

    const [id] = await knex('librarian_faqs')
      .insert({
        question,
        answer,
        entity_ref: entityRef ?? null,
      })
      .returning('id');

    logger.info(`FAQ created: ${question}`);
    res.status(201).json({ id: id.id ?? id });
  });

  // Full-text search across indexed entities
  router.get('/search', async (req, res) => {
    const q = (req.query.q as string ?? '').toLowerCase().trim();
    if (!q) {
      res.status(400).json({ error: 'q query parameter is required' });
      return;
    }

    const terms = q.split(/\s+/).filter(Boolean);
    let query = knex('librarian_entity_index').select('*');
    for (const term of terms) {
      query = query.where('search_text', 'like', `%${term}%`);
    }
    const results = await query.limit(20);

    res.json(
      results.map(row => ({
        entityRef: row.entity_ref,
        kind: row.kind,
        name: row.name,
        description: row.description,
        tags: row.tags,
        score: terms.reduce((s: number, t: string) => {
          const matches = (row.search_text as string).split(t).length - 1;
          return s + matches;
        }, 0),
      })),
    );
  });

  // Get relations for an entity (impact analysis)
  router.get('/relations/:entityRef', async (req, res) => {
    const entityRef = decodeURIComponent(req.params.entityRef);

    const entity = await knex('librarian_entity_index')
      .where('entity_ref', entityRef)
      .first();

    if (!entity) {
      res.status(404).json({ error: 'Entity not found in index' });
      return;
    }

    const relations = JSON.parse(entity.relations_json || '[]');

    // Find reverse relations (who depends on this entity)
    const allEntities = await knex('librarian_entity_index').select('entity_ref', 'relations_json');
    const dependedOnBy: string[] = [];
    for (const e of allEntities) {
      const rels = JSON.parse(e.relations_json || '[]');
      for (const r of rels) {
        if (r.targetRef === entityRef && (r.type === 'dependsOn' || r.type === 'consumesApi')) {
          dependedOnBy.push(e.entity_ref);
        }
      }
    }

    res.json({
      entityRef,
      relations,
      dependedOnBy,
      impactScore: dependedOnBy.length,
    });
  });

  // Find similar entities based on shared terms
  router.get('/similar/:entityRef', async (req, res) => {
    const entityRef = decodeURIComponent(req.params.entityRef);

    const entity = await knex('librarian_entity_index')
      .where('entity_ref', entityRef)
      .first();

    if (!entity) {
      res.status(404).json({ error: 'Entity not found in index' });
      return;
    }

    const words = (entity.search_text as string)
      .split(/\s+/)
      .filter((w: string) => w.length > 2);

    const uniqueWords = [...new Set(words)];

    const allEntities = await knex('librarian_entity_index')
      .whereNot('entity_ref', entityRef)
      .select('*');

    const scored = allEntities.map(other => {
      const otherText = other.search_text as string;
      let matchCount = 0;
      for (const word of uniqueWords) {
        if (otherText.includes(word)) matchCount++;
      }
      return {
        entityRef: other.entity_ref,
        kind: other.kind,
        name: other.name,
        description: other.description,
        similarity: uniqueWords.length > 0 ? matchCount / uniqueWords.length : 0,
      };
    });

    scored.sort((a, b) => b.similarity - a.similarity);

    res.json(scored.filter(s => s.similarity > 0).slice(0, 10));
  });

  router.patch('/faqs/:id/increment', async (req, res) => {
    const { id } = req.params;
    await knex('librarian_faqs')
      .where('id', id)
      .increment('ask_count', 1)
      .update({ updated_at: knex.fn.now() });

    res.json({ incremented: true });
  });

  return router;
}
