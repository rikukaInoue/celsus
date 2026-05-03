import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { createRouter } from './router';

export const librarianPlugin = createBackendPlugin({
  pluginId: 'librarian',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        database: coreServices.database,
        httpRouter: coreServices.httpRouter,
        auth: coreServices.auth,
        httpAuth: coreServices.httpAuth,
        catalog: catalogServiceRef,
        scheduler: coreServices.scheduler,
      },
      async init({ logger, database, httpRouter, auth, httpAuth, catalog, scheduler }) {
        const knex = await database.getClient();
        await applyMigrations(knex);

        const router = await createRouter({ logger, knex, auth, httpAuth, catalog });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/views',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/relations',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/search',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/similar',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/popular',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/stats',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/faqs',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });

        await scheduler.scheduleTask({
          id: 'librarian-index-catalog',
          frequency: { minutes: 10 },
          timeout: { minutes: 5 },
          initialDelay: { seconds: 30 },
          fn: async () => {
            await indexCatalog({ knex, catalog, auth, logger });
          },
        });

        logger.info('Librarian plugin initialized');
      },
    });
  },
});

async function indexCatalog(options: {
  knex: import('knex').Knex;
  catalog: import('@backstage/plugin-catalog-node').CatalogService;
  auth: import('@backstage/backend-plugin-api').AuthService;
  logger: import('@backstage/backend-plugin-api').LoggerService;
}) {
  const { knex, catalog, auth, logger } = options;

  const { items: entities } = await catalog.getEntities(undefined, { credentials: await auth.getOwnServiceCredentials() });
  let indexed = 0;

  for (const entity of entities) {
    const kind = entity.kind;
    const name = entity.metadata?.name ?? '';
    const namespace = entity.metadata?.namespace ?? 'default';
    const entityRef = `${kind.toLowerCase()}:${namespace}/${name}`;
    const description = entity.metadata?.description ?? '';
    const tags = (entity.metadata?.tags ?? []).join(' ');
    const relations = entity.relations ?? [];
    const relationsJson = JSON.stringify(relations);

    const searchText = [
      name,
      kind,
      description,
      tags,
      relations.map((r: { type: string; targetRef: string }) => `${r.type} ${r.targetRef}`).join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    await knex('librarian_entity_index')
      .insert({
        entity_ref: entityRef,
        kind,
        name,
        description,
        tags,
        relations_json: relationsJson,
        search_text: searchText,
        indexed_at: knex.fn.now(),
      })
      .onConflict('entity_ref')
      .merge();

    indexed++;
  }

  logger.info(`Indexed ${indexed} entities`);
}

async function applyMigrations(knex: import('knex').Knex) {
  if (!(await knex.schema.hasTable('librarian_views'))) {
    await knex.schema.createTable('librarian_views', table => {
      table.increments('id').primary();
      table.string('entity_ref').notNullable().index();
      table.string('user_ref').nullable();
      table.timestamp('viewed_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable('librarian_entity_index'))) {
    await knex.schema.createTable('librarian_entity_index', table => {
      table.string('entity_ref').primary();
      table.string('kind').notNullable().index();
      table.string('name').notNullable();
      table.text('description').nullable();
      table.text('tags').nullable();
      table.text('relations_json').nullable();
      table.text('search_text').notNullable();
      table.timestamp('indexed_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable('librarian_faqs'))) {
    await knex.schema.createTable('librarian_faqs', table => {
      table.increments('id').primary();
      table.string('question').notNullable();
      table.text('answer').notNullable();
      table.string('entity_ref').nullable().index();
      table.integer('ask_count').defaultTo(1);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }
}
