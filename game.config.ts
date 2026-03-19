/**
 * ╔══════════════════════════════════════╗
 * ║        SNAKE.EXE — CONFIG FILE       ║
 * ║   Modify this file to tweak the game ║
 * ╚══════════════════════════════════════╝
 */

export const GAME_CONFIG = {

  // ── Netlify Forms (leaderboard partagé) ───────────────────────────────────
  //  1. Site ID   → netlify.com > ton site > Site settings > General > Site ID
  //  2. Token     → netlify.com > User settings > Applications > New access token
  netlify: {
    siteId: 'REMPLACE_PAR_TON_SITE_ID',
    token:  'REMPLACE_PAR_TON_TOKEN',
  },

  // ── Grid ──────────────────────────────────────────────────────────────────
  gridCols: 25,
  gridRows: 20,
  cellSize: 26,

  // ── Speed (ms per tick — plus petit = plus rapide) ─────────────────────────
  initialSpeed:  160,
  speedDecrement: 5,
  minSpeed:       55,

  // ── Scoring ───────────────────────────────────────────────────────────────
  pointsPerFood: 10,
  bonusEvery:     5,
  bonusPoints:   50,

  // ── Leaderboard ───────────────────────────────────────────────────────────
  topN: 10,

  // ── Visuals ───────────────────────────────────────────────────────────────
  colors: {
    bg:         '#000d0a',
    grid:       '#001a10',
    snakeHead:  '#00ff41',
    snakeBody:  '#00cc33',
    snakeDim:   '#007722',
    food:       '#ff2d55',
    foodGlow:   '#ff003c',
  },

} as const;
