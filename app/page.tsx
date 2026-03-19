'use client';

import { useState } from 'react';
import SnakeGame from './components/SnakeGame';
import Leaderboard from './components/Leaderboard';

export default function Home() {
  const [refresh, setRefresh] = useState(0);

  return (
    <div className="page">
      <header className="header">
        <span className="header-tag">// SPECTRA LABS</span>
        <h1 className="header-title">SNAKE.EXE</h1>
        <span className="header-tag">v1.0.0</span>
      </header>

      <div className="layout">
        <SnakeGame onScoreSubmit={() => setRefresh(r => r + 1)} />
        <Leaderboard refresh={refresh} />
      </div>
    </div>
  );
}
