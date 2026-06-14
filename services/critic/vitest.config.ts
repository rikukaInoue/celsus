import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // db/client.ts throws at import time if DATABASE_URL is unset, and the
    // librarian domain transitively imports it. postgres-js connects lazily, so
    // a dummy URL lets modules load without ever opening a real connection —
    // enough for unit tests that don't hit the database.
    env: {
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    },
  },
});
