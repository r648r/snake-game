'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { GAME_CONFIG } from '@/game.config';
import { submitScore } from './Leaderboard';

// ── Types ──────────────────────────────────────────────────────────────────

type Dir = 'U' | 'D' | 'L' | 'R';
type Phase = 'IDLE' | 'PLAY' | 'DEAD';
interface Pt { x: number; y: number }

const OPPOSITE: Record<Dir, Dir> = { U: 'D', D: 'U', L: 'R', R: 'L' };

const DIR_KEYS: Record<string, Dir> = {
  ArrowUp: 'U', w: 'U', W: 'U',
  ArrowDown: 'D', s: 'D', S: 'D',
  ArrowLeft: 'L', a: 'L', A: 'L',
  ArrowRight: 'R', d: 'R', D: 'R',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function spawnFood(snake: Pt[]): Pt {
  const { gridCols: W, gridRows: H } = GAME_CONFIG;
  let p: Pt;
  do {
    p = { x: (Math.random() * W) | 0, y: (Math.random() * H) | 0 };
  } while (snake.some(s => s.x === p.x && s.y === p.y));
  return p;
}

function pad(n: number, len = 7) {
  return String(n).padStart(len, '0');
}

// ── Mutable game state (avoids stale-closure hell) ──────────────────────────

interface GameRef {
  phase: Phase;
  snake: Pt[];
  dir: Dir;
  nextDir: Dir;
  food: Pt;
  score: number;
  eaten: number;
  lastTick: number;
  raf: number;
}

function makeInitialState(): GameRef {
  const { gridCols: W, gridRows: H } = GAME_CONFIG;
  const cx = (W / 2) | 0, cy = (H / 2) | 0;
  const snake = [{ x: cx, y: cy }];
  return {
    phase: 'IDLE',
    snake,
    dir: 'R',
    nextDir: 'R',
    food: spawnFood(snake),
    score: 0,
    eaten: 0,
    lastTick: 0,
    raf: 0,
  };
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  onScoreSubmit?: () => void;
}

export default function SnakeGame({ onScoreSubmit }: Props) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const g = useRef<GameRef>(makeInitialState());

  const [phase, setPhase] = useState<Phase>('IDLE');
  const [score, setScore] = useState(0);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  // ── Render ────────────────────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { gridCols: W, gridRows: H, cellSize: C, colors } = GAME_CONFIG;
    const PW = W * C, PH = H * C;

    // Background
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, PW, PH);

    // Grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x++) {
      ctx.beginPath(); ctx.moveTo(x * C, 0); ctx.lineTo(x * C, PH); ctx.stroke();
    }
    for (let y = 0; y <= H; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * C); ctx.lineTo(PW, y * C); ctx.stroke();
    }

    // Food — pulsing dot with glow
    const { food } = g.current;
    const fx = food.x * C + C / 2;
    const fy = food.y * C + C / 2;
    const pulse = 0.78 + 0.22 * Math.sin(Date.now() / 280);

    const grd = ctx.createRadialGradient(fx, fy, 0, fx, fy, C * 0.85);
    grd.addColorStop(0, colors.foodGlow + '55');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(fx, fy, C * 0.85, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = colors.food;
    ctx.shadowColor = colors.food;
    ctx.shadowBlur = 16 * pulse;
    ctx.beginPath(); ctx.arc(fx, fy, C * 0.3 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Snake — gradient from head to tail
    const { snake } = g.current;
    snake.forEach((seg, i) => {
      const t = i / Math.max(snake.length - 1, 1);
      ctx.globalAlpha = Math.max(0.22, 1 - t * 0.78);
      ctx.fillStyle = i === 0
        ? colors.snakeHead
        : t < 0.45 ? colors.snakeBody : colors.snakeDim;

      if (i === 0) {
        ctx.shadowColor = colors.snakeHead;
        ctx.shadowBlur = 14;
      }

      const pad = i === 0 ? 2 : 3;
      ctx.fillRect(seg.x * C + pad, seg.y * C + pad, C - pad * 2, C - pad * 2);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });

    // Scanlines (subtle CRT feel)
    ctx.fillStyle = 'rgba(0,0,0,0.035)';
    for (let y = 0; y < PH; y += 2) ctx.fillRect(0, y, PW, 1);
  }, []);

  // ── Game loop ─────────────────────────────────────────────────────────────

  const getSpeed = useCallback(() => {
    const { initialSpeed, speedDecrement, minSpeed } = GAME_CONFIG;
    return Math.max(minSpeed, initialSpeed - g.current.eaten * speedDecrement);
  }, []);

  const loop = useCallback((ts: number) => {
    const state = g.current;
    if (state.phase !== 'PLAY') return;

    if (ts - state.lastTick >= getSpeed()) {
      state.lastTick = ts;
      state.dir = state.nextDir;

      const { x, y } = state.snake[0];
      const nh: Pt =
        state.dir === 'U' ? { x, y: y - 1 } :
        state.dir === 'D' ? { x, y: y + 1 } :
        state.dir === 'L' ? { x: x - 1, y } :
                            { x: x + 1, y };

      const { gridCols: W, gridRows: H } = GAME_CONFIG;

      // Wall collision
      if (nh.x < 0 || nh.x >= W || nh.y < 0 || nh.y >= H) {
        state.phase = 'DEAD';
        setPhase('DEAD');
        setScore(state.score);
        render();
        return;
      }
      // Self collision
      if (state.snake.some(s => s.x === nh.x && s.y === nh.y)) {
        state.phase = 'DEAD';
        setPhase('DEAD');
        setScore(state.score);
        render();
        return;
      }

      // Eat food
      if (nh.x === state.food.x && nh.y === state.food.y) {
        state.eaten++;
        state.score += GAME_CONFIG.pointsPerFood;
        if (state.eaten % GAME_CONFIG.bonusEvery === 0) state.score += GAME_CONFIG.bonusPoints;
        state.snake = [nh, ...state.snake];
        state.food = spawnFood(state.snake);
        setScore(state.score);
      } else {
        state.snake = [nh, ...state.snake.slice(0, -1)];
      }
    }

    render();
    state.raf = requestAnimationFrame(loop);
  }, [render, getSpeed]);

  // ── Start / restart ───────────────────────────────────────────────────────

  const start = useCallback(() => {
    const state = g.current;
    cancelAnimationFrame(state.raf);

    const fresh = makeInitialState();
    fresh.phase = 'PLAY';
    Object.assign(state, fresh);

    setSaved(false);
    setScore(0);
    setPhase('PLAY');

    state.raf = requestAnimationFrame(loop);
  }, [loop]);

  // ── Submit score ──────────────────────────────────────────────────────────

  const saveScore = useCallback(async () => {
    if (!name.trim()) return;
    await submitScore(name, g.current.score);
    setSaved(true);
    onScoreSubmit?.();
  }, [name, onScoreSubmit]);

  // ── Keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const state = g.current;

      if (state.phase !== 'PLAY') {
        if (e.key === ' ' || e.key === 'Enter') start();
        return;
      }

      const nd = DIR_KEYS[e.key];
      if (nd && nd !== OPPOSITE[state.dir]) {
        state.nextDir = nd;
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [start]);

  // ── Initial render + cleanup ──────────────────────────────────────────────

  useEffect(() => {
    render();
    // Animate food pulse while idle/dead
    let idle: number;
    const idleLoop = () => {
      if (g.current.phase !== 'PLAY') render();
      idle = requestAnimationFrame(idleLoop);
    };
    idle = requestAnimationFrame(idleLoop);
    return () => {
      cancelAnimationFrame(idle);
      cancelAnimationFrame(g.current.raf);
    };
  }, [render]);

  // ── Mobile touch ─────────────────────────────────────────────────────────

  const touchStart = useRef<Pt | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const state = g.current;
    if (!touchStart.current) return;
    if (state.phase !== 'PLAY') { start(); return; }
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    let nd: Dir;
    if (Math.abs(dx) > Math.abs(dy)) nd = dx > 0 ? 'R' : 'L';
    else nd = dy > 0 ? 'D' : 'U';
    if (nd !== OPPOSITE[state.dir]) state.nextDir = nd;
    touchStart.current = null;
  };

  // ── Sizes ─────────────────────────────────────────────────────────────────

  const { gridCols: W, gridRows: H, cellSize: C } = GAME_CONFIG;

  return (
    <div className="game-wrap">
      {/* Score bar */}
      <div className="scorebar">
        <span className="scorebar-label">SCORE</span>
        <span className="scorebar-digits">{pad(score)}</span>
        <span className="scorebar-label">LVL</span>
        <span className="scorebar-digits">
          {String(Math.floor(g.current.eaten / GAME_CONFIG.bonusEvery) + 1).padStart(2, '0')}
        </span>
      </div>

      {/* Canvas + overlays */}
      <div
        className="crt-wrap"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <canvas ref={cvs} width={W * C} height={H * C} className="game-canvas" />

        {/* IDLE overlay */}
        {phase === 'IDLE' && (
          <div className="overlay">
            <div className="ov-title blink">SNAKE.EXE</div>
            <div className="ov-sub pulse">▶ PRESS SPACE TO BOOT</div>
            <div className="ov-keys">
              <kbd>↑↓←→</kbd>&nbsp; or &nbsp;<kbd>WASD</kbd>
              &nbsp;&nbsp;&nbsp;
              <kbd>SWIPE</kbd> on mobile
            </div>
          </div>
        )}

        {/* DEAD overlay */}
        {phase === 'DEAD' && (
          <div className="overlay">
            <div className="ov-killed">PROCESS KILLED</div>
            <div className="ov-final-score">{pad(score)}</div>

            {!saved ? (
              <div className="ov-save-row">
                <input
                  className="ov-name-input"
                  placeholder="PLAYER__"
                  value={name}
                  maxLength={8}
                  autoFocus
                  onChange={e => setName(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && saveScore()}
                />
                <button
                  className="ov-btn ov-btn-save"
                  onClick={saveScore}
                  disabled={!name.trim()}
                >
                  SAVE
                </button>
              </div>
            ) : (
              <div className="ov-saved">✓ SCORE LOGGED TO DB</div>
            )}

            <button className="ov-btn ov-btn-restart" onClick={start}>
              [ RESTART ]
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
