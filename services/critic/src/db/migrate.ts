import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
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

  const migrationsDir = join(__dirname, 'migrations');
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const migrationPath = join(migrationsDir, file);
    const migration = readFileSync(migrationPath, 'utf-8');
    console.log(`Running ${file}...`);
    try {
      await sql.unsafe(migration);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        console.log(`  Skipped (already applied)`);
      } else {
        throw err;
      }
    }
  }
  console.log('Migration complete.');

  await sql.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
