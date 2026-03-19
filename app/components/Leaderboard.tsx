'use client';

import { useEffect, useState } from 'react';
export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  date: string;
}

// ── Scores API ────────────────────────────────────────────────────────────────

export async function submitScore(name: string, score: number): Promise<void> {
  const res = await fetch('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim().slice(0, 16).toUpperCase(), score }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
}

async function fetchScores(): Promise<ScoreEntry[]> {
  const res = await fetch('/api/scores');
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { refresh?: number }

export default function Leaderboard({ refresh }: Props) {
  const [entries, setEntries] = useState<ScoreEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  const load = async () => {
    setStatus('loading');
    try {
      setEntries(await fetchScores());
      setStatus('ok');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  useEffect(() => { load(); }, [refresh]);

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`;
  };

  return (
    <div className="lb">
      <div className="lb-header">
        <span className="lb-title">HIGH SCORES</span>
        <button className="lb-refresh" onClick={load} title="Refresh">↺</button>
      </div>

      {status === 'loading' && <div className="lb-state pulse">LOADING···</div>}
      {status === 'error'   && <div className="lb-state lb-state-err">API UNREACHABLE</div>}
      {status === 'ok' && entries.length === 0 && <div className="lb-state">NO RECORDS YET</div>}

      {status === 'ok' && entries.length > 0 && (
        <ol className="lb-list">
          {entries.map((e, i) => (
            <li key={e.id} className={`lb-entry ${i===0?'lb-gold':''} ${i===1?'lb-silver':''} ${i===2?'lb-bronze':''}`}>
              <span className="lb-rank">{String(i+1).padStart(2,'0')}</span>
              <span className="lb-name">{e.name}</span>
              <span className="lb-score">{String(e.score).padStart(7,'0')}</span>
              <span className="lb-date">{fmt(e.date)}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="lb-footer"><span>powered by postgresql</span></div>
    </div>
  );
}
