import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
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
      },
      async init({ logger, database, httpRouter, auth, httpAuth }) {
        const knex = await database.getClient();
        await applyMigrations(knex);

        const router = await createRouter({ logger, knex, auth, httpAuth });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/views',
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

        logger.info('Librarian plugin initialized');
      },
    });
  },
});

async function applyMigrations(knex: import('knex').Knex) {
  if (!(await knex.schema.hasTable('librarian_views'))) {
    await knex.schema.createTable('librarian_views', table => {
      table.increments('id').primary();
      table.string('entity_ref').notNullable().index();
      table.string('user_ref').nullable();
      table.timestamp('viewed_at').defaultTo(knex.fn.now());
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
