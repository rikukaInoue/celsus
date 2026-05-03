import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = postgres(connectionString);

  const migrationPath = join(__dirname, 'migrations', '0001_initial.sql');
  const migration = readFileSync(migrationPath, 'utf-8');

  console.log('Running migration...');
  await sql.unsafe(migration);
  console.log('Migration complete.');

  await sql.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
