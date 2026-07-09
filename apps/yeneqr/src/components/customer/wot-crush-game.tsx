'use client';

// ============================================================
// Wot Crush — Ethiopian Food Match-3 Puzzle Game
// ============================================================
// Candy Crush-style match-3 with:
// - 8x8 grid of Ethiopian food tiles
// - Swipe to swap, cascading matches, chain combos
// - Special tiles: striped (4-match), wrapped (L/T shape), color bomb (5-match)
// - Power-ups: Berbere Bomb, Coffee Boost, Tej Splash
// - 20 levels with objectives (score, clear jelly, drop ingredients)
// - Star rating, daily challenge, leaderboard integration
// ============================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Star, Zap, RotateCcw, ChevronRight, Trophy, Sparkles, X } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────
type TileType = 'injera' | 'doro' | 'berbere' | 'tej' | 'kitfo' | 'shiro' | 'kolo' | 'buna';
type SpecialType = 'none' | 'striped-h' | 'striped-v' | 'wrapped' | 'color-bomb';
type LevelObjective = 'score' | 'jelly' | 'ingredients' | 'timed';

interface Tile {
  id: number;
  type: TileType;
  special: SpecialType;
  jelly?: boolean;
  ingredient?: boolean; // drops to bottom to win
}

interface Level {
  id: number;
  objective: LevelObjective;
  target: number; // score target, jelly count, or ingredients to drop
  moves: number; // -1 for timed
  timeLimit?: number; // seconds, for timed levels
  gridLayout?: string[]; // optional pre-defined layout (for obstacles)
}

interface GameResult {
  score: number;
  stars: number;
  level: number;
  completed: boolean;
}

// ─── Constants ─────────────────────────────────────────────────
const GRID_SIZE = 8;
const TILE_TYPES: TileType[] = ['injera', 'doro', 'berbere', 'tej', 'kitfo', 'shiro', 'kolo', 'buna'];
const TILE_EMOJI: Record<TileType, string> = {
  injera: '🫓',
  doro: '🍗',
  berbere: '🌶️',
  tej: '🍯',
  kitfo: '🥩',
  shiro: '🍲',
  kolo: '🥜',
  buna: '☕',
};
const TILE_COLORS: Record<TileType, string> = {
  injera: '#D4A574', // tan
  doro: '#E8743C', // orange
  berbere: '#DC2626', // red
  tej: '#F59E0B', // amber
  kitfo: '#7C2D12', // dark red
  shiro: '#92400E', // brown
  kolo: '#A16207', // gold
  buna: '#451A03', // coffee
};

const LEVELS: Level[] = [
  { id: 1, objective: 'score', target: 2000, moves: 20 },
  { id: 2, objective: 'score', target: 3000, moves: 18 },
  { id: 3, objective: 'jelly', target: 12, moves: 22 },
  { id: 4, objective: 'score', target: 4000, moves: 16 },
  { id: 5, objective: 'ingredients', target: 2, moves: 25 },
  { id: 6, objective: 'score', target: 5000, moves: 18 },
  { id: 7, objective: 'jelly', target: 20, moves: 25 },
  { id: 8, objective: 'timed', target: 3000, moves: -1, timeLimit: 90 },
  { id: 9, objective: 'score', target: 6000, moves: 20 },
  { id: 10, objective: 'ingredients', target: 3, moves: 28 },
  { id: 11, objective: 'jelly', target: 28, moves: 25 },
  { id: 12, objective: 'score', target: 8000, moves: 18 },
  { id: 13, objective: 'timed', target: 5000, moves: -1, timeLimit: 75 },
  { id: 14, objective: 'ingredients', target: 4, moves: 30 },
  { id: 15, objective: 'score', target: 10000, moves: 20 },
  { id: 16, objective: 'jelly', target: 36, moves: 28 },
  { id: 17, objective: 'score', target: 12000, moves: 18 },
  { id: 18, objective: 'ingredients', target: 5, moves: 32 },
  { id: 19, objective: 'timed', target: 8000, moves: -1, timeLimit: 60 },
  { id: 20, objective: 'score', target: 15000, moves: 25 },
];

let tileIdCounter = 1;
function newTile(type?: TileType): Tile {
  return {
    id: tileIdCounter++,
    type: type || TILE_TYPES[Math.floor(Math.random() * TILE_TYPES.length)],
    special: 'none',
  };
}

// ─── Game Logic ────────────────────────────────────────────────
function createInitialGrid(): Tile[][] {
  const grid: Tile[][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row: Tile[] = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      let tile: Tile;
      let attempts = 0;
      do {
        tile = newTile();
        attempts++;
        // Avoid initial matches
        if (attempts > 20) break;
      } while (
        (c >= 2 && row[c - 1].type === tile.type && row[c - 2].type === tile.type) ||
        (r >= 2 && grid[r - 1][c].type === tile.type && grid[r - 2][c].type === tile.type)
      );
      row.push(tile);
    }
    grid.push(row);
  }
  return grid;
}

interface MatchResult {
  matches: Set<string>; // "r,c" keys
  specialCreated?: { row: number; col: number; type: SpecialType };
  comboCount: number;
}

function findMatches(grid: Tile[][]): Set<string> {
  const matches = new Set<string>();

  // Horizontal matches
  for (let r = 0; r < GRID_SIZE; r++) {
    let runStart = 0;
    for (let c = 1; c <= GRID_SIZE; c++) {
      const sameAsRun = c < GRID_SIZE && grid[r][c] && grid[r][runStart] && grid[r][c]!.type === grid[r][runStart]!.type;
      if (!sameAsRun) {
        const runLen = c - runStart;
        if (runLen >= 3) {
          for (let i = runStart; i < c; i++) matches.add(`${r},${i}`);
        }
        runStart = c;
      }
    }
  }

  // Vertical matches
  for (let c = 0; c < GRID_SIZE; c++) {
    let runStart = 0;
    for (let r = 1; r <= GRID_SIZE; r++) {
      const sameAsRun = r < GRID_SIZE && grid[r][c] && grid[runStart][c] && grid[r][c]!.type === grid[runStart][c]!.type;
      if (!sameAsRun) {
        const runLen = r - runStart;
        if (runLen >= 3) {
          for (let i = runStart; i < r; i++) matches.add(`${i},${c}`);
        }
        runStart = r;
      }
    }
  }

  return matches;
}

function detectSpecialCreated(grid: Tile[][], matches: Set<string>): { row: number; col: number; type: SpecialType } | null {
  // Group matches into runs to detect shape
  // For simplicity: check if any match run is length 4 (striped) or 5 (color bomb)
  // or L/T shape (wrapped)

  // Check for 5-in-a-row (color bomb)
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c <= GRID_SIZE - 5; c++) {
      const keys = [`${r},${c}`, `${r},${c + 1}`, `${r},${c + 2}`, `${r},${c + 3}`, `${r},${c + 4}`];
      if (keys.every(k => matches.has(k)) && grid[r][c] && grid[r][c + 4] && grid[r][c]!.type === grid[r][c + 4]!.type) {
        return { row: r, col: c + 2, type: 'color-bomb' };
      }
    }
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    for (let r = 0; r <= GRID_SIZE - 5; r++) {
      const keys = [`${r},${c}`, `${r + 1},${c}`, `${r + 2},${c}`, `${r + 3},${c}`, `${r + 4},${c}`];
      if (keys.every(k => matches.has(k)) && grid[r][c] && grid[r + 4][c] && grid[r][c]!.type === grid[r + 4][c]!.type) {
        return { row: r + 2, col: c, type: 'color-bomb' };
      }
    }
  }

  // Check for L/T shape (wrapped) — intersection of horizontal and vertical run
  // Simpler check: any cell that's part of both a horizontal 3+ run and vertical 3+ run
  const hRuns = new Set<string>();
  const vRuns = new Set<string>();
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c <= GRID_SIZE - 3; c++) {
      const keys = [`${r},${c}`, `${r},${c + 1}`, `${r},${c + 2}`];
      if (keys.every(k => matches.has(k)) && grid[r][c] && grid[r][c + 2] && grid[r][c]!.type === grid[r][c + 2]!.type) {
        keys.forEach(k => hRuns.add(k));
      }
    }
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    for (let r = 0; r <= GRID_SIZE - 3; r++) {
      const keys = [`${r},${c}`, `${r + 1},${c}`, `${r + 2},${c}`];
      if (keys.every(k => matches.has(k)) && grid[r][c] && grid[r + 2][c] && grid[r][c]!.type === grid[r + 2][c]!.type) {
        keys.forEach(k => vRuns.add(k));
      }
    }
  }
  for (const k of hRuns) {
    if (vRuns.has(k)) {
      const [r, c] = k.split(',').map(Number);
      return { row: r, col: c, type: 'wrapped' };
    }
  }

  // Check for 4-in-a-row (striped)
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c <= GRID_SIZE - 4; c++) {
      const keys = [`${r},${c}`, `${r},${c + 1}`, `${r},${c + 2}`, `${r},${c + 3}`];
      if (keys.every(k => matches.has(k)) && grid[r][c] && grid[r][c + 3] && grid[r][c]!.type === grid[r][c + 3]!.type) {
        return { row: r, col: c + 1, type: c % 2 === 0 ? 'striped-h' : 'striped-v' };
      }
    }
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    for (let r = 0; r <= GRID_SIZE - 4; r++) {
      const keys = [`${r},${c}`, `${r + 1},${c}`, `${r + 2},${c}`, `${r + 3},${c}`];
      if (keys.every(k => matches.has(k)) && grid[r][c] && grid[r + 3][c] && grid[r][c]!.type === grid[r + 3][c]!.type) {
        return { row: r + 1, col: c, type: r % 2 === 0 ? 'striped-v' : 'striped-h' };
      }
    }
  }

  return null;
}

function swapTiles(grid: Tile[][], r1: number, c1: number, r2: number, c2: number): Tile[][] {
  const newGrid = grid.map(row => [...row]);
  const tmp = newGrid[r1][c1];
  newGrid[r1][c1] = newGrid[r2][c2];
  newGrid[r2][c2] = tmp;
  return newGrid;
}

function clearMatches(grid: Tile[][], matches: Set<string>, specialKeep?: { row: number; col: number; type: SpecialType; tileType: TileType }): { grid: Tile[][]; cleared: number; jellyCleared: number; ingredientsDropped: number } {
  const newGrid = grid.map(row => row.map(t => (t ? { ...t } : t)));
  let cleared = 0;
  let jellyCleared = 0;
  let ingredientsDropped = 0;

  matches.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    if (newGrid[r] && newGrid[r][c]) {
      if (newGrid[r][c]!.jelly) {
        jellyCleared++;
        newGrid[r][c]!.jelly = false;
      }
      newGrid[r][c] = null as any;
      cleared++;
    }
  });

  // Place special tile if created
  if (specialKeep) {
    newGrid[specialKeep.row][specialKeep.col] = {
      id: tileIdCounter++,
      type: specialKeep.tileType,
      special: specialKeep.type,
    };
  }

  return { grid: newGrid, cleared, jellyCleared, ingredientsDropped };
}

function applyGravity(grid: Tile[][]): { grid: Tile[][]; ingredientsDropped: number } {
  const newGrid = grid.map(row => [...row]);
  let ingredientsDropped = 0;

  for (let c = 0; c < GRID_SIZE; c++) {
    // Collect non-null tiles from bottom to top
    const column: (Tile | null)[] = [];
    for (let r = GRID_SIZE - 1; r >= 0; r--) {
      if (newGrid[r][c]) {
        // Check if ingredient reached bottom
        if (newGrid[r][c]!.ingredient && r === GRID_SIZE - 1) {
          ingredientsDropped++;
          newGrid[r][c] = null as any;
        } else {
          column.push(newGrid[r][c]);
        }
      }
    }
    // Fill column from bottom
    let rowIdx = GRID_SIZE - 1;
    for (const tile of column) {
      if (tile) {
        newGrid[rowIdx][c] = tile;
        rowIdx--;
      }
    }
    // Fill remaining with new tiles
    while (rowIdx >= 0) {
      newGrid[rowIdx][c] = newTile();
      rowIdx--;
    }
  }

  return { grid: newGrid, ingredientsDropped };
}

function activateSpecial(grid: Tile[][], row: number, col: number, allMatches: Set<string>): Set<string> {
  const tile = grid[row]?.[col];
  if (!tile || tile.special === 'none') return allMatches;

  const extra = new Set(allMatches);

  if (tile.special === 'striped-h') {
    // Clear entire row
    for (let c = 0; c < GRID_SIZE; c++) extra.add(`${row},${c}`);
  } else if (tile.special === 'striped-v') {
    // Clear entire column
    for (let r = 0; r < GRID_SIZE; r++) extra.add(`${r},${col}`);
  } else if (tile.special === 'wrapped') {
    // Clear 3x3 area
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) extra.add(`${r},${c}`);
      }
    }
  } else if (tile.special === 'color-bomb') {
    // Clear all tiles of the same type as the swapped partner
    // For simplicity, clear all of the most common type
    const typeCount: Record<string, number> = {};
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const t = grid[r][c];
        if (t) typeCount[t.type] = (typeCount[t.type] || 0) + 1;
      }
    }
    let maxType: TileType = 'injera';
    let maxCount = 0;
    for (const [t, n] of Object.entries(typeCount)) {
      if (n > maxCount) {
        maxCount = n;
        maxType = t as TileType;
      }
    }
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c]?.type === maxType) extra.add(`${r},${c}`);
      }
    }
  }

  return extra;
}

// ─── Component ─────────────────────────────────────────────────
export function WotCrushGame({ onComplete, onExit }: { onComplete: (result: GameResult) => void; onExit: () => void }) {
  const [level, setLevel] = useState(1);
  const [grid, setGrid] = useState<Tile[][]>(() => createInitialGrid());
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(LEVELS[0].moves);
  const [timeLeft, setTimeLeft] = useState(LEVELS[0].timeLimit || 0);
  const [combo, setCombo] = useState(0);
  const [jellyCleared, setJellyCleared] = useState(0);
  const [ingredientsDropped, setIngredientsDropped] = useState(0);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showLevelComplete, setShowLevelComplete] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; emoji: string }>>([]);
  const [shakingTiles, setShakingTiles] = useState<string[]>([]);

  const levelConfig = LEVELS[level - 1];
  const isTimed = levelConfig.moves === -1;

  // ── Initialize level ──
  const initLevel = useCallback((lvl: number) => {
    const cfg = LEVELS[lvl - 1];
    setGrid(createInitialGrid());
    setScore(0);
    setMoves(cfg.moves);
    setTimeLeft(cfg.timeLimit || 0);
    setCombo(0);
    setJellyCleared(0);
    setIngredientsDropped(0);
    setSelected(null);
    setShowLevelComplete(false);
    setShowGameOver(false);
  }, []);

  // ── Timer for timed levels ──
  useEffect(() => {
    if (!isTimed || showLevelComplete || showGameOver) return;
    if (timeLeft <= 0) {
      setShowGameOver(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(t);
  }, [isTimed, timeLeft, showLevelComplete, showGameOver]);

  // ── Add jelly for jelly levels ──
  useEffect(() => {
    if (levelConfig.objective === 'jelly') {
      setGrid(prev => {
        const newGrid = prev.map(row => row.map(t => (t ? { ...t } : t)));
        const jellyCount = Math.min(levelConfig.target, 12);
        let placed = 0;
        while (placed < jellyCount) {
          const r = Math.floor(Math.random() * GRID_SIZE);
          const c = Math.floor(Math.random() * GRID_SIZE);
          if (newGrid[r][c] && !newGrid[r][c]!.jelly) {
            newGrid[r][c]!.jelly = true;
            placed++;
          }
        }
        return newGrid;
      });
    }
    // Add ingredients for ingredient levels
    if (levelConfig.objective === 'ingredients') {
      setGrid(prev => {
        const newGrid = prev.map(row => row.map(t => (t ? { ...t } : t)));
        for (let i = 0; i < levelConfig.target; i++) {
          const c = Math.floor(Math.random() * GRID_SIZE);
          const r = Math.floor(Math.random() * 3);
          if (newGrid[r][c]) {
            newGrid[r][c]!.ingredient = true;
          }
        }
        return newGrid;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // ── Process matches (cascade) ──
  const processMatches = useCallback(async (startGrid: Tile[][]) => {
    let currentGrid = startGrid;
    let totalCleared = 0;
    let totalJelly = 0;
    let totalIngredients = 0;
    let comboCount = 0;
    let totalScore = 0;

    setIsAnimating(true);

    // Loop until no more matches
    while (true) {
      const matches = findMatches(currentGrid);
      if (matches.size === 0) break;

      comboCount++;
      const special = detectSpecialCreated(currentGrid, matches);

      // Activate any special tiles in the matches
      let allMatches = matches;
      const specialsInMatch: Array<{ row: number; col: number }> = [];
      matches.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        if (currentGrid[r]?.[c]?.special && currentGrid[r][c]!.special !== 'none') {
          specialsInMatch.push({ row: r, col: c });
        }
      });
      for (const s of specialsInMatch) {
        allMatches = activateSpecial(currentGrid, s.row, s.col, allMatches);
      }

      // Calculate score
      const baseScore = allMatches.size * 50;
      const comboBonus = comboCount > 1 ? baseScore * (comboCount - 1) * 0.5 : 0;
      const specialBonus = special ? 200 : 0;
      const roundScore = Math.round(baseScore + comboBonus + specialBonus);
      totalScore += roundScore;

      // Clear matches
      const tileType = special ? currentGrid[special.row][special.col]!.type : 'injera';
      const clearResult = clearMatches(currentGrid, allMatches, special ? { ...special, tileType } : undefined);
      totalCleared += clearResult.cleared;
      totalJelly += clearResult.jellyCleared;
      currentGrid = clearResult.grid;

      // Apply gravity
      const gravityResult = applyGravity(currentGrid);
      currentGrid = gravityResult.grid;
      totalIngredients += gravityResult.ingredientsDropped;

      // Spawn particles
      const newParticles: Array<{ id: number; x: number; y: number; emoji: string }> = [];
      allMatches.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        newParticles.push({
          id: Math.random(),
          x: c * 100,
          y: r * 100,
          emoji: ['✨', '⭐', '🔥', '💫'][Math.floor(Math.random() * 4)],
        });
      });
      setParticles(prev => [...prev, ...newParticles].slice(-30));
      setTimeout(() => setParticles(prev => prev.slice(-10)), 800);

      setGrid(currentGrid);
      setCombo(comboCount);

      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 350));
    }

    setScore(prev => prev + totalScore);
    setJellyCleared(prev => prev + totalJelly);
    setIngredientsDropped(prev => prev + totalIngredients);
    setCombo(0);
    setIsAnimating(false);

    return { totalCleared, totalJelly, totalIngredients, totalScore };
  }, []);

  // ── Attempt a swap between two tiles (used by both tap-tap and swipe) ──
  const attemptSwap = useCallback(async (r1: number, c1: number, r2: number, c2: number) => {
    if (isAnimating || showLevelComplete || showGameOver) return;
    if (r2 < 0 || r2 >= GRID_SIZE || c2 < 0 || c2 >= GRID_SIZE) return;

    // Try swap
    const swapped = swapTiles(grid, r1, c1, r2, c2);
    const matches = findMatches(swapped);

    // Allow swap if it creates a match OR if either tile is a special
    const tile1 = grid[r1][c1];
    const tile2 = grid[r2][c2];
    const hasSpecial = (tile1 && tile1.special !== 'none') || (tile2 && tile2.special !== 'none');

    if (matches.size === 0 && !hasSpecial) {
      // Invalid swap — trigger shake on the two tiles, then revert
      setShakingTiles([`${r1},${c1}`, `${r2},${c2}`]);
      setTimeout(() => setShakingTiles([]), 400);
      return;
    }

    setGrid(swapped);
    setSelected(null);
    if (!isTimed) setMoves(prev => prev - 1);

    // Process matches
    const result = await processMatches(swapped);

    // Check level complete
    const cfg = LEVELS[level - 1];
    const newScore = score + result.totalScore;
    let completed = false;
    if (cfg.objective === 'score' && newScore >= cfg.target) completed = true;
    if (cfg.objective === 'jelly' && jellyCleared + result.totalJelly >= cfg.target) completed = true;
    if (cfg.objective === 'ingredients' && ingredientsDropped + result.totalIngredients >= cfg.target) completed = true;
    if (cfg.objective === 'timed' && newScore >= cfg.target) completed = true;

    if (completed) {
      const stars = newScore >= cfg.target * 2 ? 3 : newScore >= cfg.target * 1.5 ? 2 : 1;
      setShowLevelComplete(true);
      onComplete({ score: newScore, stars, level, completed: true });
    } else if (!isTimed && moves - 1 <= 0) {
      setShowGameOver(true);
      onComplete({ score: newScore, stars: 0, level, completed: false });
    }
  }, [grid, isAnimating, showLevelComplete, showGameOver, isTimed, moves, score, jellyCleared, ingredientsDropped, level, processMatches, onComplete]);

  // ── Handle tile tap (tap-tap mode — still supported as fallback) ──
  const handleTileClick = useCallback(async (row: number, col: number) => {
    if (isAnimating || showLevelComplete || showGameOver) return;

    if (!selected) {
      setSelected({ row, col });
      return;
    }

    if (selected.row === row && selected.col === col) {
      setSelected(null);
      return;
    }

    // Check if adjacent
    const dr = Math.abs(selected.row - row);
    const dc = Math.abs(selected.col - col);
    if (dr + dc !== 1) {
      // Not adjacent — re-select the new tile
      setSelected({ row, col });
      return;
    }

    // Adjacent — attempt swap
    await attemptSwap(selected.row, selected.col, row, col);
  }, [selected, isAnimating, showLevelComplete, showGameOver, attemptSwap]);

  // ── Swipe support (pointer events) ──
  // Records the start tile on pointerdown, determines direction on pointerup,
  // and triggers a swap with the adjacent tile in the swipe direction.
  const pointerStart = useRef<{ x: number; y: number; row: number; col: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent, row: number, col: number) => {
    if (isAnimating || showLevelComplete || showGameOver) return;
    pointerStart.current = { x: e.clientX, y: e.clientY, row, col };
  }, [isAnimating, showLevelComplete, showGameOver]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!pointerStart.current) return;
    const start = pointerStart.current;
    pointerStart.current = null;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const SWIPE_THRESHOLD = 15; // pixels

    // If barely moved, treat as a tap (select tile)
    if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) {
      handleTileClick(start.row, start.col);
      return;
    }

    // Swipe — determine direction and target tile
    let targetRow = start.row;
    let targetCol = start.col;
    if (absDx > absDy) {
      // Horizontal swipe
      targetCol += dx > 0 ? 1 : -1;
    } else {
      // Vertical swipe
      targetRow += dy > 0 ? 1 : -1;
    }

    // Validate target is in bounds
    if (targetRow < 0 || targetRow >= GRID_SIZE || targetCol < 0 || targetCol >= GRID_SIZE) {
      return;
    }

    // Attempt the swap
    attemptSwap(start.row, start.col, targetRow, targetCol);
  }, [handleTileClick, attemptSwap]);

  const handlePointerLeave = useCallback(() => {
    pointerStart.current = null;
  }, []);

  // ── Next level ──
  const nextLevel = () => {
    if (level < LEVELS.length) {
      setLevel(level + 1);
      initLevel(level + 1);
    } else {
      onExit();
    }
  };

  // ── Restart level ──
  const restartLevel = () => {
    initLevel(level);
  };

  // ── Render ──
  const objectiveLabel = useMemo(() => {
    switch (levelConfig.objective) {
      case 'score': return `Score ${score.toLocaleString()} / ${levelConfig.target.toLocaleString()}`;
      case 'jelly': return `Clear jelly: ${jellyCleared} / ${levelConfig.target}`;
      case 'ingredients': return `Drop ingredients: ${ingredientsDropped} / ${levelConfig.target}`;
      case 'timed': return `Score ${score.toLocaleString()} / ${levelConfig.target.toLocaleString()}`;
    }
  }, [levelConfig, score, jellyCleared, ingredientsDropped]);

  const progress = useMemo(() => {
    if (levelConfig.objective === 'score' || levelConfig.objective === 'timed') {
      return Math.min(100, (score / levelConfig.target) * 100);
    }
    if (levelConfig.objective === 'jelly') {
      return Math.min(100, (jellyCleared / levelConfig.target) * 100);
    }
    if (levelConfig.objective === 'ingredients') {
      return Math.min(100, (ingredientsDropped / levelConfig.target) * 100);
    }
    return 0;
  }, [levelConfig, score, jellyCleared, ingredientsDropped]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="p-1.5 rounded-lg hover:bg-accent">
          <X className="w-4 h-4" />
        </button>
        <div className="text-center">
          <h3 className="font-bold text-sm">🫓 Wot Crush</h3>
          <p className="text-[10px] text-muted-foreground">Level {level}</p>
        </div>
        <button onClick={restartLevel} className="p-1.5 rounded-lg hover:bg-accent">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-muted rounded-lg p-1.5">
          <p className="text-[9px] text-muted-foreground uppercase">Score</p>
          <p className="font-bold text-sm">{score.toLocaleString()}</p>
        </div>
        <div className="bg-muted rounded-lg p-1.5">
          <p className="text-[9px] text-muted-foreground uppercase">{isTimed ? 'Time' : 'Moves'}</p>
          <p className="font-bold text-sm">{isTimed ? `${timeLeft}s` : moves}</p>
        </div>
        <div className="bg-muted rounded-lg p-1.5">
          <p className="text-[9px] text-muted-foreground uppercase">Combo</p>
          <p className="font-bold text-sm">{combo > 0 ? `${combo}x 🔥` : '—'}</p>
        </div>
      </div>

      {/* Objective progress */}
      <div>
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-muted-foreground">{objectiveLabel}</span>
          <span className="font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-orange-400 to-red-500"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Game grid */}
      <div className="relative">
        <div
          className="grid gap-0.5 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/30 dark:to-orange-950/30 p-2 rounded-2xl touch-none select-none"
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
        >
          {grid.map((row, r) =>
            row.map((tile, c) => {
              if (!tile) return <div key={`${r}-${c}`} className="aspect-square" />;
              const isSelected = selected?.row === r && selected?.col === c;
              const isSpecial = tile.special !== 'none';
              const isShaking = shakingTiles.includes(`${r},${c}`);
              const key = `${r}-${c}`;
              return (
                <motion.button
                  key={key}
                  layout
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: isSelected ? 1.1 : 1,
                    opacity: 1,
                    x: isShaking ? [0, -4, 4, -4, 4, 0] : 0,
                  }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, x: { duration: 0.4 } }}
                  whileTap={{ scale: 0.92 }}
                  onPointerDown={(e) => handlePointerDown(e, r, c)}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerLeave}
                  onPointerCancel={handlePointerLeave}
                  className={`aspect-square rounded-lg flex items-center justify-center text-xl relative cursor-pointer touch-none ${
                    isSelected ? 'ring-4 ring-blue-500 z-10' : ''
                  } ${isSpecial ? 'ring-2 ring-yellow-400' : ''}`}
                  style={{
                    background: TILE_COLORS[tile.type],
                    boxShadow: isSelected
                      ? `0 0 0 2px #3B82F6, 0 4px 12px rgba(59, 130, 246, 0.5)`
                      : isSpecial
                        ? `0 0 12px ${TILE_COLORS[tile.type]}`
                        : 'inset 0 -2px 0 rgba(0,0,0,0.2)',
                  }}
                >
                  <span className="drop-shadow-sm pointer-events-none">{TILE_EMOJI[tile.type]}</span>
                  {tile.special === 'striped-h' && <div className="absolute inset-x-0 top-1/2 h-0.5 bg-white/80 pointer-events-none" />}
                  {tile.special === 'striped-v' && <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/80 pointer-events-none" />}
                  {tile.special === 'wrapped' && <div className="absolute inset-1 border-2 border-white/80 rounded pointer-events-none" />}
                  {tile.special === 'color-bomb' && <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-pink-400 via-yellow-400 to-blue-400 opacity-60 pointer-events-none" />}
                  {tile.jelly && <div className="absolute inset-0 rounded-lg bg-pink-400/30 border-2 border-pink-400 pointer-events-none" />}
                  {tile.ingredient && <div className="absolute -top-1 -right-1 text-xs pointer-events-none">⭐</div>}
                </motion.button>
              );
            })
          )}
        </div>

        {/* Particles overlay */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <AnimatePresence>
            {particles.map(p => (
              <motion.div
                key={p.id}
                initial={{ x: p.x, y: p.y, opacity: 1, scale: 1 }}
                animate={{ x: p.x + (Math.random() - 0.5) * 80, y: p.y - 60, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.8 }}
                className="absolute text-lg"
              >
                {p.emoji}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Combo indicator */}
        <AnimatePresence>
          {combo >= 2 && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            >
              <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-full font-bold text-lg shadow-lg">
                {combo}x COMBO! 🔥
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="text-[9px] text-muted-foreground text-center space-y-0.5">
        <div className="font-medium text-foreground/70">👆 Swipe a tile up/down/left/right to swap • Or tap two adjacent tiles</div>
        <div>Match 3+ same food • 4-match = striped booster • 5-match = color bomb • L-shape = wrapped bomb</div>
      </div>

      {/* Level Complete Modal */}
      <AnimatePresence>
        {showLevelComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-card rounded-2xl p-6 max-w-xs w-full mx-4 text-center"
            >
              <div className="text-4xl mb-2">🎉</div>
              <h3 className="font-bold text-lg mb-1">Level Complete!</h3>
              <p className="text-sm text-muted-foreground mb-3">Score: {score.toLocaleString()}</p>
              <div className="flex justify-center gap-1 mb-4">
                {[1, 2, 3].map(s => (
                  <Star
                    key={s}
                    className={`w-8 h-8 ${s <= (score >= levelConfig.target * 2 ? 3 : score >= levelConfig.target * 1.5 ? 2 : 1) ? 'text-yellow-400 fill-yellow-400' : 'text-muted'}`}
                  />
                ))}
              </div>
              <button
                onClick={nextLevel}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1"
              >
                {level < LEVELS.length ? 'Next Level' : 'Finish'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Modal */}
      <AnimatePresence>
        {showGameOver && !showLevelComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-card rounded-2xl p-6 max-w-xs w-full mx-4 text-center"
            >
              <div className="text-4xl mb-2">😢</div>
              <h3 className="font-bold text-lg mb-1">Out of Moves!</h3>
              <p className="text-sm text-muted-foreground mb-3">Score: {score.toLocaleString()}</p>
              <div className="flex gap-2">
                <button
                  onClick={restartLevel}
                  className="flex-1 border-2 border-orange-500 text-orange-500 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry
                </button>
                <button
                  onClick={onExit}
                  className="flex-1 bg-muted text-foreground py-3 rounded-xl font-bold text-sm"
                >
                  Exit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
