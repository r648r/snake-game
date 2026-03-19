/**
 * Storage backend — tri-mode (priority order):
 *   1. PostgreSQL  (Docker / DATABASE_URL set)
 *   2. Netlify Blobs  (prod + `netlify dev`)
 *   3. JSON file  (local `npm run dev` without DB)
 */

import { GAME_CONFIG } from '@/game.config';

export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  date: string;
}

// ── Environment detection ─────────────────────────────────────────────────────

function usePostgres(): boolean {
  return !!process.env.DATABASE_URL;
}

function useBlobs(): boolean {
  return !!(
    process.env.NETLIFY ||
    process.env.NETLIFY_LOCAL ||
    process.env.BLOB_READ_WRITE_TOKEN
  );
}

// ── PostgreSQL backend ────────────────────────────────────────────────────────

async function pgGetTop(n: number): Promise<ScoreEntry[]> {
  const { getPool, ensureSchema } = await import('./db');
  await ensureSchema();
  const { rows } = await getPool().query<{
    id: string; name: string; score: number; date: Date;
  }>(
    `SELECT id::text, name, score, created_at AS date
     FROM scores
     ORDER BY score DESC
     LIMIT $1`,
    [n],
  );
  return rows.map(r => ({ ...r, date: r.date.toISOString() }));
}

async function pgAdd(entry: Omit<ScoreEntry, 'id' | 'date'>): Promise<ScoreEntry> {
  const { getPool, ensureSchema } = await import('./db');
  await ensureSchema();
  const { rows } = await getPool().query<{
    id: string; name: string; score: number; date: Date;
  }>(
    `INSERT INTO scores (name, score)
     VALUES ($1, $2)
     RETURNING id::text, name, score, created_at AS date`,
    [entry.name, entry.score],
  );
  return { ...rows[0], date: rows[0].date.toISOString() };
}

// ── Netlify Blobs backend ─────────────────────────────────────────────────────

const BLOB_KEY = 'all-scores';

async function blobsRead(): Promise<ScoreEntry[]> {
  const { getStore } = await import('@netlify/blobs');
  const store = getStore({ name: 'game-scores', consistency: 'strong' });
  const data = await store.get(BLOB_KEY, { type: 'json' });
  return (data as ScoreEntry[]) ?? [];
}

async function blobsWrite(entries: ScoreEntry[]): Promise<void> {
  const { getStore } = await import('@netlify/blobs');
  const store = getStore({ name: 'game-scores', consistency: 'strong' });
  await store.set(BLOB_KEY, JSON.stringify(entries));
}

// ── Filesystem backend (local dev) ────────────────────────────────────────────

import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), 'data', 'scores.json');

function fsRead(): ScoreEntry[] {
  try {
    if (!fs.existsSync(FILE)) return [];
    return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as ScoreEntry[];
  } catch {
    return [];
  }
}

function fsWrite(entries: ScoreEntry[]): void {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(entries, null, 2));
}

// ── Unified read / write (Blobs + FS) ────────────────────────────────────────

async function readAll(): Promise<ScoreEntry[]> {
  return useBlobs() ? blobsRead() : fsRead();
}

async function writeAll(entries: ScoreEntry[]): Promise<void> {
  if (useBlobs()) {
    await blobsWrite(entries);
  } else {
    fsWrite(entries);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getTopScores(n: number = GAME_CONFIG.topN): Promise<ScoreEntry[]> {
  if (usePostgres()) return pgGetTop(n);
  const all = await readAll();
  return all.sort((a, b) => b.score - a.score).slice(0, n);
}

export async function addScore(
  entry: Omit<ScoreEntry, 'id' | 'date'>,
): Promise<ScoreEntry> {
  if (usePostgres()) return pgAdd(entry);
  const all = await readAll();
  const newEntry: ScoreEntry = {
    ...entry,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
  };
  all.push(newEntry);
  all.sort((a, b) => b.score - a.score);
  await writeAll(all.slice(0, 200));
  return newEntry;
}

export async function deleteScore(id: string): Promise<boolean> {
  if (usePostgres()) {
    const { getPool } = await import('./db');
    const res = await getPool().query('DELETE FROM scores WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }
  const all = await readAll();
  const filtered = all.filter(e => e.id !== id);
  if (filtered.length === all.length) return false;
  await writeAll(filtered);
  return true;
}

export async function clearScores(): Promise<void> {
  if (usePostgres()) {
    const { getPool } = await import('./db');
    await getPool().query('TRUNCATE scores');
    return;
  }
  await writeAll([]);
}
