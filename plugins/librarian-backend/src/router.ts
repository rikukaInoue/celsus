import { LoggerService, AuthService, HttpAuthService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { Knex } from 'knex';

interface RouterOptions {
  logger: LoggerService;
  knex: Knex;
  auth: AuthService;
  httpAuth: HttpAuthService;
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
