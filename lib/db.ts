import { Pool } from 'pg';

let pool: Pool | null = null;
let initialized = false;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export async function ensureSchema(): Promise<void> {
  if (initialized) return;
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS scores (
      id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name       VARCHAR(16)  NOT NULL,
      score      INTEGER      NOT NULL CHECK (score >= 0),
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_scores_score ON scores (score DESC);
  `);
  initialized = true;
}
