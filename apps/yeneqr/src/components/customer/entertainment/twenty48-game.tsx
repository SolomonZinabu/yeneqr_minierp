'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, RotateCcw, Trophy, Undo2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ─────────────────────────────────────────────────────
interface GameProps {
  onBack: () => void
  language: string
  t: (key: string, fallback: string) => string
}

type GameState = 'idle' | 'playing' | 'won' | 'gameover'

interface Tile {
  id: number
  value: number
  row: number
  col: number
  isNew?: boolean
  isMerged?: boolean
}

interface GridState {
  tiles: Tile[]
  score: number
}

// ─── Constants ─────────────────────────────────────────────────
const GRID_SIZE = 4
const STORAGE_KEY_BEST = 'yene-qr-2048-best'

const TILE_COLORS: Record<number, { bg: string; text: string; darkBg: string; darkText: string }> = {
  2:    { bg: '#E8F5E9', text: '#2E7D32', darkBg: '#1B3A1D', darkText: '#81C784' },
  4:    { bg: '#C8E6C9', text: '#1B5E20', darkBg: '#1E4D20', darkText: '#A5D6A7' },
  8:    { bg: '#66BB6A', text: '#FFFFFF', darkBg: '#2E7D32', darkText: '#FFFFFF' },
  16:   { bg: '#43A047', text: '#FFFFFF', darkBg: '#388E3C', darkText: '#FFFFFF' },
  32:   { bg: '#039D55', text: '#FFFFFF', darkBg: '#04B55F', darkText: '#FFFFFF' },
  64:   { bg: '#0277BD', text: '#FFFFFF', darkBg: '#0288D1', darkText: '#FFFFFF' },
  128:  { bg: '#F57C00', text: '#FFFFFF', darkBg: '#E65100', darkText: '#FFE0B2' },
  256:  { bg: '#EF6C00', text: '#FFFFFF', darkBg: '#BF360C', darkText: '#FFCCBC' },
  512:  { bg: '#E53935', text: '#FFFFFF', darkBg: '#C62828', darkText: '#FFCDD2' },
  1024: { bg: '#AB47BC', text: '#FFFFFF', darkBg: '#7B1FA2', darkText: '#E1BEE7' },
  2048: { bg: '#FFD600', text: '#1A1A1A', darkBg: '#F9A825', darkText: '#1A1A1A' },
}

function getTileStyle(value: number) {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const colors = TILE_COLORS[value] || { bg: '#3E2723', text: '#FFFFFF', darkBg: '#4E342E', darkText: '#FFFFFF' }
  return {
    backgroundColor: isDark ? colors.darkBg : colors.bg,
    color: isDark ? colors.darkText : colors.text,
  }
}

// ─── Helper Functions ──────────────────────────────────────────
let tileIdCounter = 0
function nextTileId() { return ++tileIdCounter }

function getBestScore(): number {
  if (typeof window === 'undefined') return 0
  try { return parseInt(localStorage.getItem(STORAGE_KEY_BEST) || '0', 10) } catch { return 0 }
}

function setBestScore(score: number) {
  try { localStorage.setItem(STORAGE_KEY_BEST, String(score)) } catch { /* noop */ }
}

function emptyGrid(): number[][] {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0))
}

function cloneGrid(grid: number[][]): number[][] {
  return grid.map(row => [...row])
}

function addRandomTile(grid: number[][]): { grid: number[][]; row: number; col: number; value: number } | null {
  const empty: { row: number; col: number }[] = []
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 0) empty.push({ row: r, col: c })
    }
  }
  if (empty.length === 0) return null
  const cell = empty[Math.floor(Math.random() * empty.length)]
  const value = Math.random() < 0.9 ? 2 : 4
  const newGrid = cloneGrid(grid)
  newGrid[cell.row][cell.col] = value
  return { grid: newGrid, row: cell.row, col: cell.col, value }
}

function canMove(grid: number[][]): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 0) return true
      if (c < GRID_SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true
      if (r < GRID_SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true
    }
  }
  return false
}

function hasWon(grid: number[][]): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] >= 2048) return true
    }
  }
  return false
}

// Slide and merge a single row to the left, returning new row and score gained
function slideRow(row: number[]): { newRow: number[]; score: number; mergedPositions: number[] } {
  let score = 0
  const mergedPositions: number[] = []
  // Remove zeros
  let arr = row.filter(v => v !== 0)
  // Merge
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      arr[i] *= 2
      score += arr[i]
      mergedPositions.push(i)
      arr.splice(i + 1, 1)
    }
  }
  // Pad with zeros
  while (arr.length < GRID_SIZE) arr.push(0)
  return { newRow: arr, score, mergedPositions }
}

// ─── 2048 Game Component ───────────────────────────────────────
export default function Twenty48Game({ onBack, language, t }: GameProps) {
  const [gameState, setGameState] = useState<GameState>('idle')
  const [grid, setGrid] = useState<number[][]>(emptyGrid())
  const [score, setScore] = useState(0)
  const [bestScore, setBestScoreState] = useState(getBestScore)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [newTileIds, setNewTileIds] = useState<Set<number>>(new Set())
  const [mergedTileIds, setMergedTileIds] = useState<Set<number>>(new Set())

  // History for undo (1 move)
  const prevGridRef = useRef<number[][] | null>(null)
  const prevScoreRef = useRef<number>(0)
  const prevTilesRef = useRef<Tile[] | null>(null)

  // Touch tracking
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Grid ref for move logic
  const gridRef = useRef(grid)
  gridRef.current = grid
  const gameStateRef = useRef(gameState)
  gameStateRef.current = gameState
  const scoreRef = useRef(score)
  scoreRef.current = score

  // ─── Build tiles from grid ─────────────────────────────────
  const buildTiles = useCallback((gridState: number[][], existingTiles: Tile[], newPositions?: Set<string>, mergedPositions?: Set<string>): Tile[] => {
    const result: Tile[] = []
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (gridState[r][c] !== 0) {
          const key = `${r},${c}`
          const existing = existingTiles.find(t => t.row === r && t.col === c && t.value === gridState[r][c])
          result.push({
            id: existing?.id || nextTileId(),
            value: gridState[r][c],
            row: r,
            col: c,
            isNew: newPositions?.has(key) || false,
            isMerged: mergedPositions?.has(key) || false,
          })
        }
      }
    }
    return result
  }, [])

  // ─── Initialize Game ───────────────────────────────────────
  const initGame = useCallback(() => {
    tileIdCounter = 0
    let g = emptyGrid()
    const t1 = addRandomTile(g)
    if (t1) g = t1.grid
    const t2 = addRandomTile(g)
    if (t2) g = t2.grid

    const newPositions = new Set<string>()
    if (t1) newPositions.add(`${t1.row},${t1.col}`)
    if (t2) newPositions.add(`${t2.row},${t2.col}`)

    const initialTiles = buildTiles(g, [], newPositions)

    setGrid(g)
    setScore(0)
    setTiles(initialTiles)
    setNewTileIds(new Set(initialTiles.filter(t => t.isNew).map(t => t.id)))
    setMergedTileIds(new Set())
    prevGridRef.current = null
    prevScoreRef.current = 0
    prevTilesRef.current = null
    gameStateRef.current = 'playing'
    setGameState('playing')
  }, [buildTiles])

  // ─── Execute Move ──────────────────────────────────────────
  const executeMove = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    if (gameStateRef.current !== 'playing') return

    const oldGrid = gridRef.current
    const oldScore = scoreRef.current
    let newGrid = cloneGrid(oldGrid)
    let totalScore = 0
    const mergedPositions = new Set<string>()

    if (direction === 'left') {
      for (let r = 0; r < GRID_SIZE; r++) {
        const { newRow, score: s, mergedPositions: mp } = slideRow(newGrid[r])
        newGrid[r] = newRow
        totalScore += s
        mp.forEach(c => mergedPositions.add(`${r},${c}`))
      }
    } else if (direction === 'right') {
      for (let r = 0; r < GRID_SIZE; r++) {
        const reversed = [...newGrid[r]].reverse()
        const { newRow, score: s, mergedPositions: mp } = slideRow(reversed)
        newGrid[r] = newRow.reverse()
        totalScore += s
        mp.forEach(idx => mergedPositions.add(`${r},${GRID_SIZE - 1 - idx}`))
      }
    } else if (direction === 'up') {
      for (let c = 0; c < GRID_SIZE; c++) {
        const col = newGrid.map(row => row[c])
        const { newRow, score: s, mergedPositions: mp } = slideRow(col)
        for (let r = 0; r < GRID_SIZE; r++) newGrid[r][c] = newRow[r]
        totalScore += s
        mp.forEach(r => mergedPositions.add(`${r},${c}`))
      }
    } else if (direction === 'down') {
      for (let c = 0; c < GRID_SIZE; c++) {
        const col = newGrid.map(row => row[c]).reverse()
        const { newRow, score: s, mergedPositions: mp } = slideRow(col)
        const unrev = newRow.reverse()
        for (let r = 0; r < GRID_SIZE; r++) newGrid[r][c] = unrev[r]
        totalScore += s
        mp.forEach(idx => mergedPositions.add(`${GRID_SIZE - 1 - idx},${c}`))
      }
    }

    // Check if anything changed
    let changed = false
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (oldGrid[r][c] !== newGrid[r][c]) { changed = true; break }
      }
      if (changed) break
    }
    if (!changed) return

    // Save for undo
    prevGridRef.current = oldGrid
    prevScoreRef.current = oldScore
    prevTilesRef.current = tiles

    // Add new tile
    const added = addRandomTile(newGrid)
    if (added) newGrid = added.grid

    const newPositions = new Set<string>()
    if (added) newPositions.add(`${added.row},${added.col}`)

    const newScore = oldScore + totalScore
    const newTiles = buildTiles(newGrid, tiles, newPositions, mergedPositions)

    setGrid(newGrid)
    setScore(newScore)
    setTiles(newTiles)
    setNewTileIds(new Set(newTiles.filter(t => t.isNew).map(t => t.id)))
    setMergedTileIds(new Set(newTiles.filter(t => t.isMerged).map(t => t.id)))

    if (newScore > getBestScore()) {
      setBestScore(newScore)
      setBestScoreState(newScore)
    }

    // Check win/lose
    if (hasWon(newGrid) && gameStateRef.current === 'playing') {
      gameStateRef.current = 'won'
      setGameState('won')
    } else if (!canMove(newGrid)) {
      gameStateRef.current = 'gameover'
      setGameState('gameover')
    }
  }, [tiles, buildTiles])

  // ─── Undo ──────────────────────────────────────────────────
  const undo = useCallback(() => {
    if (!prevGridRef.current) return
    setGrid(prevGridRef.current)
    setScore(prevScoreRef.current)
    setTiles(prevTilesRef.current || [])
    setNewTileIds(new Set())
    setMergedTileIds(new Set())
    scoreRef.current = prevScoreRef.current
    if (gameStateRef.current === 'gameover') {
      gameStateRef.current = 'playing'
      setGameState('playing')
    }
    prevGridRef.current = null
    prevTilesRef.current = null
  }, [])

  // ─── Continue after winning ────────────────────────────────
  const continueGame = useCallback(() => {
    gameStateRef.current = 'playing'
    setGameState('playing')
  }, [])

  // ─── Keyboard Controls ─────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const keyMap: Record<string, 'left' | 'right' | 'up' | 'down'> = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
      }
      const dir = keyMap[e.key]
      if (dir) {
        e.preventDefault()
        executeMove(dir)
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [executeMove, undo])

  // ─── Touch/Swipe Controls ──────────────────────────────────
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStartRef.current.x
      const dy = touch.clientY - touchStartRef.current.y
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (Math.max(absDx, absDy) < 30) return

      let dir: 'left' | 'right' | 'up' | 'down'
      if (absDx > absDy) {
        dir = dx > 0 ? 'right' : 'left'
      } else {
        dir = dy > 0 ? 'down' : 'up'
      }
      executeMove(dir)
      touchStartRef.current = null
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [executeMove])

  // ─── Calculate grid dimensions ─────────────────────────────
  const [gridDimensions, setGridDimensions] = useState({ size: 0, cellSize: 0, gap: 8 })

  useEffect(() => {
    function calc() {
      const vw = window.innerWidth
      const size = Math.min(vw - 32, 400)
      const gap = size > 300 ? 8 : 6
      const cellSize = (size - gap * (GRID_SIZE + 1)) / GRID_SIZE
      setGridDimensions({ size, cellSize, gap })
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  const { size: gridSize, cellSize, gap } = gridDimensions

  // ─── Render JSX ────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-screen bg-gradient-to-b from-brand/5 via-background to-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5" />
          {t('back', 'Back')}
        </button>
        <h1 className="text-lg font-bold flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          2048
        </h1>
        <div className="w-16" />
      </div>

      {/* Score Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 rounded-lg bg-brand/10">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('score', 'Score')}</p>
            <p className="text-lg font-bold text-brand">{score}</p>
          </div>
          <div className="px-3 py-1 rounded-lg bg-yellow-500/10">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('best', 'Best')}</p>
            <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{bestScore}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!prevGridRef.current}
            className="p-2 rounded-lg hover:bg-muted active:scale-90 transition-all disabled:opacity-30"
            title={t('undo', 'Undo')}
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <Button
            size="sm"
            onClick={initGame}
            className="bg-brand hover:bg-brand-dark text-brand-foreground rounded-xl text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            {t('newGame', 'New')}
          </Button>
        </div>
      </div>

      {/* Game Grid */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div
          className="relative rounded-2xl shadow-lg border border-border overflow-hidden"
          style={{
            width: gridSize,
            height: gridSize,
            backgroundColor: 'var(--color-muted)',
          }}
          onTouchStart={(e) => {
            const touch = e.touches[0]
            touchStartRef.current = { x: touch.clientX, y: touch.clientY }
          }}
        >
          {/* Grid cells (background) */}
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const r = Math.floor(i / GRID_SIZE)
            const c = i % GRID_SIZE
            return (
              <div
                key={`cell-${r}-${c}`}
                className="absolute rounded-lg"
                style={{
                  width: cellSize,
                  height: cellSize,
                  left: gap + c * (cellSize + gap),
                  top: gap + r * (cellSize + gap),
                  backgroundColor: 'var(--color-card)',
                  opacity: 0.6,
                }}
              />
            )
          })}

          {/* Tiles */}
          {tiles.map((tile) => {
            const style = getTileStyle(tile.value)
            const fontSize = tile.value >= 1024 ? cellSize * 0.28 : tile.value >= 128 ? cellSize * 0.32 : cellSize * 0.38
            const isNew = newTileIds.has(tile.id)
            const isMerged = mergedTileIds.has(tile.id)

            return (
              <div
                key={tile.id}
                className="absolute rounded-lg flex items-center justify-center font-bold transition-all duration-120 ease-out"
                style={{
                  width: cellSize,
                  height: cellSize,
                  left: gap + tile.col * (cellSize + gap),
                  top: gap + tile.row * (cellSize + gap),
                  backgroundColor: style.backgroundColor,
                  color: style.color,
                  fontSize,
                  transform: isNew ? 'scale(0)' : isMerged ? 'scale(1.15)' : 'scale(1)',
                  animation: isNew ? 'tileAppear 200ms ease-out 50ms forwards' : isMerged ? 'tileMerge 200ms ease-out' : 'none',
                  zIndex: isMerged ? 10 : isNew ? 5 : 1,
                }}
              >
                {tile.value}
              </div>
            )
          })}

          {/* Overlays */}
          <AnimatePresence>
            {gameState === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl z-20"
              >
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                >
                  <span className="text-6xl font-black text-brand">2048</span>
                </motion.div>
                <p className="text-sm text-muted-foreground mt-2 mb-4">
                  {t('2048Subtitle', 'Join the tiles, get to 2048!')}
                </p>
                <Button
                  onClick={initGame}
                  size="lg"
                  className="bg-brand hover:bg-brand-dark text-brand-foreground rounded-2xl shadow-lg shadow-brand/25"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t('startGame', 'Start Game')}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('swipeToPlay', 'Swipe or use arrow keys')}
                </p>
              </motion.div>
            )}

            {gameState === 'won' && (
              <motion.div
                key="won"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-brand/20 backdrop-blur-sm rounded-2xl z-20"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-5xl mb-3"
                >
                  🎉
                </motion.div>
                <h2 className="text-2xl font-bold text-brand mb-1">{t('youWin', 'You Win!')}</h2>
                <p className="text-sm text-muted-foreground mb-1">
                  {t('reached2048', 'You reached 2048!')}
                </p>
                <p className="text-lg font-bold mb-4">{t('score', 'Score')}: {score}</p>
                <div className="flex gap-3">
                  <Button
                    onClick={continueGame}
                    variant="outline"
                    className="rounded-xl"
                  >
                    {t('keepPlaying', 'Keep Going')}
                  </Button>
                  <Button
                    onClick={initGame}
                    className="bg-brand hover:bg-brand-dark text-brand-foreground rounded-xl"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    {t('newGame', 'New Game')}
                  </Button>
                </div>
              </motion.div>
            )}

            {gameState === 'gameover' && (
              <motion.div
                key="gameover"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl z-20"
              >
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-5xl mb-3"
                >
                  😔
                </motion.div>
                <h2 className="text-2xl font-bold mb-1">{t('gameOver', 'Game Over!')}</h2>
                <div className="flex items-center gap-4 mt-2">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-brand">{score}</p>
                    <p className="text-xs text-muted-foreground">{t('score', 'Score')}</p>
                  </div>
                  <div className="w-px h-10 bg-border" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-500">{bestScore}</p>
                    <p className="text-xs text-muted-foreground">{t('best', 'Best')}</p>
                  </div>
                </div>
                {score >= bestScore && score > 0 && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-sm text-yellow-500 font-semibold mt-2"
                  >
                    <Trophy className="w-4 h-4 inline mr-1" />
                    {t('newBest', 'New Best Score!')}
                  </motion.p>
                )}
                <div className="flex gap-3 mt-4">
                  {prevGridRef.current && (
                    <Button onClick={undo} variant="outline" className="rounded-xl">
                      <Undo2 className="w-4 h-4 mr-1" />
                      {t('undo', 'Undo')}
                    </Button>
                  )}
                  <Button
                    onClick={initGame}
                    className="bg-brand hover:bg-brand-dark text-brand-foreground rounded-xl shadow-lg shadow-brand/25"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    {t('tryAgain', 'Try Again')}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls hint */}
        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">←</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">↓</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">→</kbd>
          </span>
          <span>|</span>
          <span>{t('swipeOrArrows', 'Swipe to move tiles')}</span>
          <span>|</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">⌘Z</kbd>
            {t('undo', 'Undo')}
          </span>
        </div>
      </div>
    </div>
  )
}
