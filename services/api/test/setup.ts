import { Pool } from 'pg';
import { runMigrationsOnStartup } from '../src/database/run-migrations';

export default async function globalSetup() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://webinar:webinar@localhost:5444/webinar_test';
  
  try {
    const pool = new Pool({ connectionString: dbUrl });
    await pool.query('SELECT 1');
    await pool.end();
    console.log('[Test Setup] Running migrations on test DB:', dbUrl);
    await runMigrationsOnStartup(dbUrl);
  } catch (err: any) {
    console.warn('[Test Setup] Could not connect to DB for migrations (will skip if DB is mocked or unavailable):', err.message);
  }
}
