'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Pause, Play, RotateCcw, Trophy, Zap, Cherry, Drumstick, Apple } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ─────────────────────────────────────────────────────
interface GameProps {
  onBack: () => void
  language: string
  t: (key: string, fallback: string) => string
}

type GameState = 'idle' | 'playing' | 'paused' | 'gameover'
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

interface Point {
  x: number
  y: number
}

interface FoodItem {
  position: Point
  type: 'regular' | 'bonus' | 'super'
  spawnTime: number
  duration?: number // ms before disappearing (bonus only)
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

// ─── Constants ─────────────────────────────────────────────────
const GRID_SIZE = 20
const INITIAL_SPEED = 150 // ms per tick
const MIN_SPEED = 60
const BONUS_FOOD_DURATION = 5000 // ms
const SUPER_FOOD_CHANCE = 0.08
const BONUS_FOOD_CHANCE = 0.25
const STORAGE_KEY = 'yene-qr-snake-highscore'

const FOOD_EMOJIS: Record<string, string[]> = {
  regular: ['🍕', '🍔', '🌮', '🍣', '🥗', '🍜', '🥘', '🍱'],
  bonus: ['🧁', '🍰', '🥂', '🎂', '🍩', '🍪'],
  super: ['👑', '💎', '⭐', '🌟'],
}

const FOOD_COLORS: Record<string, string> = {
  regular: '#039D55',
  bonus: '#F59E0B',
  super: '#EF4444',
}

// ─── Helper Functions ──────────────────────────────────────────
function getHighScore(): number {
  if (typeof window === 'undefined') return 0
  try { return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) } catch { return 0 }
}

function setHighScore(score: number) {
  try { localStorage.setItem(STORAGE_KEY, String(score)) } catch { /* noop */ }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function oppositeDir(d: Direction): Direction {
  const map: Record<Direction, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
  return map[d]
}

// ─── Snake Game Component ──────────────────────────────────────
export default function SnakeGame({ onBack, language, t }: GameProps) {
  // Game state
  const [gameState, setGameState] = useState<GameState>('idle')
  const [score, setScore] = useState(0)
  const [highScore, setHighScoreState] = useState(getHighScore)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  // Refs for game loop
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const snakeRef = useRef<Point[]>([{ x: 10, y: 10 }])
  const directionRef = useRef<Direction>('RIGHT')
  const nextDirectionRef = useRef<Direction>('RIGHT')
  const foodRef = useRef<FoodItem | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const scoreRef = useRef(0)
  const speedRef = useRef(INITIAL_SPEED)
  const lastTickRef = useRef(0)
  const animFrameRef = useRef<number>(0)
  const gameStateRef = useRef<GameState>('idle')
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const emojiMapRef = useRef<Record<string, string>>({
    regular: FOOD_EMOJIS.regular[randomInt(0, FOOD_EMOJIS.regular.length - 1)],
    bonus: FOOD_EMOJIS.bonus[randomInt(0, FOOD_EMOJIS.bonus.length - 1)],
    super: FOOD_EMOJIS.super[randomInt(0, FOOD_EMOJIS.super.length - 1)],
  })

  // Derived
  const cellSize = canvasSize.width > 0 ? canvasSize.width / GRID_SIZE : 0
  const isPlaying = gameState === 'playing'
  const isPaused = gameState === 'paused'
  const isIdle = gameState === 'idle'
  const isGameOver = gameState === 'gameover'

  // ─── Canvas Sizing ─────────────────────────────────────────
  useEffect(() => {
    function resize() {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const size = Math.min(rect.width, rect.height, 480)
      setCanvasSize({ width: size, height: size })
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // ─── Food Spawning ─────────────────────────────────────────
  const spawnFood = useCallback(() => {
    const snake = snakeRef.current
    const occupied = new Set(snake.map(p => `${p.x},${p.y}`))
    let pos: Point
    do {
      pos = { x: randomInt(0, GRID_SIZE - 1), y: randomInt(0, GRID_SIZE - 1) }
    } while (occupied.has(`${pos.x},${pos.y}`))

    const roll = Math.random()
    let type: FoodItem['type'] = 'regular'
    if (roll < SUPER_FOOD_CHANCE) type = 'super'
    else if (roll < SUPER_FOOD_CHANCE + BONUS_FOOD_CHANCE) type = 'bonus'

    // Pick new emoji for this food
    emojiMapRef.current[type] = FOOD_EMOJIS[type][randomInt(0, FOOD_EMOJIS[type].length - 1)]

    foodRef.current = {
      position: pos,
      type,
      spawnTime: Date.now(),
      duration: type === 'bonus' ? BONUS_FOOD_DURATION : undefined,
    }
  }, [])

  // ─── Particle Effect ───────────────────────────────────────
  const spawnParticles = useCallback((x: number, y: number, color: string, count: number = 8) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
      const speed = 1 + Math.random() * 3
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        color,
        size: 2 + Math.random() * 3,
      })
    }
  }, [])

  // ─── Game Logic ────────────────────────────────────────────
  const tick = useCallback(() => {
    const snake = snakeRef.current
    const dir = nextDirectionRef.current
    directionRef.current = dir

    const head = snake[0]
    let newHead: Point

    switch (dir) {
      case 'UP': newHead = { x: head.x, y: head.y - 1 }; break
      case 'DOWN': newHead = { x: head.x, y: head.y + 1 }; break
      case 'LEFT': newHead = { x: head.x - 1, y: head.y }; break
      case 'RIGHT': newHead = { x: head.x + 1, y: head.y }; break
    }

    // Wall collision
    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      gameStateRef.current = 'gameover'
      setGameState('gameover')
      const s = scoreRef.current
      const hs = getHighScore()
      if (s > hs) { setHighScore(s); setHighScoreState(s) }
      return
    }

    // Self collision
    if (snake.some(p => p.x === newHead.x && p.y === newHead.y)) {
      gameStateRef.current = 'gameover'
      setGameState('gameover')
      const s = scoreRef.current
      const hs = getHighScore()
      if (s > hs) { setHighScore(s); setHighScoreState(s) }
      return
    }

    const newSnake = [newHead, ...snake]
    let ate = false

    // Check food
    const food = foodRef.current
    if (food && newHead.x === food.position.x && newHead.y === food.position.y) {
      ate = true
      const points = food.type === 'super' ? 5 : food.type === 'bonus' ? 3 : 1
      scoreRef.current += points
      setScore(scoreRef.current)

      // Speed up
      speedRef.current = Math.max(MIN_SPEED, INITIAL_SPEED - Math.floor(scoreRef.current / 5) * 5)

      // Particles
      const cx = food.position.x * cellSize + cellSize / 2
      const cy = food.position.y * cellSize + cellSize / 2
      spawnParticles(cx, cy, FOOD_COLORS[food.type], food.type === 'super' ? 16 : food.type === 'bonus' ? 12 : 8)

      spawnFood()
    } else {
      newSnake.pop()
    }

    snakeRef.current = newSnake

    // Check if bonus food expired
    if (foodRef.current?.type === 'bonus' && foodRef.current.duration) {
      if (Date.now() - foodRef.current.spawnTime > foodRef.current.duration) {
        spawnFood()
      }
    }
  }, [cellSize, spawnFood, spawnParticles])

  // ─── Render ────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const cs = w / GRID_SIZE

    // Clear
    const isDark = document.documentElement.classList.contains('dark')
    ctx.fillStyle = isDark ? '#111820' : '#F8FAF5'
    ctx.fillRect(0, 0, w, h)

    // Grid lines (subtle)
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath()
      ctx.moveTo(i * cs, 0)
      ctx.lineTo(i * cs, h)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * cs)
      ctx.lineTo(w, i * cs)
      ctx.stroke()
    }

    // Border
    ctx.strokeStyle = isDark ? 'rgba(3,157,85,0.3)' : 'rgba(3,157,85,0.2)'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, w, h)

    // Snake
    const snake = snakeRef.current
    snake.forEach((segment, i) => {
      const x = segment.x * cs
      const y = segment.y * cs
      const pad = 1

      if (i === 0) {
        // Head - brighter, rounded
        const grad = ctx.createLinearGradient(x, y, x + cs, y + cs)
        grad.addColorStop(0, '#04C26E')
        grad.addColorStop(1, '#039D55')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.roundRect(x + pad, y + pad, cs - pad * 2, cs - pad * 2, 5)
        ctx.fill()

        // Eyes
        ctx.fillStyle = '#fff'
        const dir = directionRef.current
        let eye1x: number, eye1y: number, eye2x: number, eye2y: number
        const eyeSize = cs * 0.14
        const pupilSize = cs * 0.08

        if (dir === 'RIGHT') {
          eye1x = x + cs * 0.65; eye1y = y + cs * 0.3
          eye2x = x + cs * 0.65; eye2y = y + cs * 0.7
        } else if (dir === 'LEFT') {
          eye1x = x + cs * 0.35; eye1y = y + cs * 0.3
          eye2x = x + cs * 0.35; eye2y = y + cs * 0.7
        } else if (dir === 'UP') {
          eye1x = x + cs * 0.3; eye1y = y + cs * 0.35
          eye2x = x + cs * 0.7; eye2y = y + cs * 0.35
        } else {
          eye1x = x + cs * 0.3; eye1y = y + cs * 0.65
          eye2x = x + cs * 0.7; eye2y = y + cs * 0.65
        }

        ctx.beginPath()
        ctx.arc(eye1x, eye1y, eyeSize, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(eye2x, eye2y, eyeSize, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = isDark ? '#111' : '#222'
        ctx.beginPath()
        ctx.arc(eye1x, eye1y, pupilSize, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(eye2x, eye2y, pupilSize, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // Body - gradient that fades towards the tail
        const ratio = 1 - (i / snake.length) * 0.5
        const r = Math.round(4 * ratio * 16)
        const g = Math.round((157 + (194 - 157) * (1 - ratio)))
        const b = Math.round(85 * ratio)
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
        ctx.beginPath()
        ctx.roundRect(x + pad + 0.5, y + pad + 0.5, cs - pad * 2 - 1, cs - pad * 2 - 1, 3)
        ctx.fill()
      }
    })

    // Food
    const food = foodRef.current
    if (food) {
      const fx = food.position.x * cs
      const fy = food.position.y * cs

      // Glow effect
      const glowSize = cs * 0.4
      const glowGrad = ctx.createRadialGradient(
        fx + cs / 2, fy + cs / 2, 0,
        fx + cs / 2, fy + cs / 2, cs
      )
      const glowColor = FOOD_COLORS[food.type]
      glowGrad.addColorStop(0, glowColor + '40')
      glowGrad.addColorStop(1, glowColor + '00')
      ctx.fillStyle = glowGrad
      ctx.fillRect(fx - glowSize, fy - glowSize, cs + glowSize * 2, cs + glowSize * 2)

      // Pulsating effect for bonus/super
      const time = Date.now() - food.spawnTime
      let scale = 1
      if (food.type === 'bonus') {
        const remaining = (food.duration || BONUS_FOOD_DURATION) - time
        if (remaining < 1500) {
          scale = 0.6 + Math.abs(Math.sin(time * 0.01)) * 0.4
        }
      } else if (food.type === 'super') {
        scale = 0.85 + Math.sin(time * 0.005) * 0.15
      }

      const emoji = emojiMapRef.current[food.type]
      const fontSize = cs * scale * 0.75
      ctx.font = `${fontSize}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(emoji, fx + cs / 2, fy + cs / 2)

      // Timer indicator for bonus food
      if (food.type === 'bonus' && food.duration) {
        const progress = Math.max(0, 1 - time / food.duration)
        ctx.strokeStyle = '#F59E0B'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(fx + cs / 2, fy + cs / 2, cs * 0.45, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress)
        ctx.stroke()
      }
    }

    // Particles
    const particles = particlesRef.current
    particles.forEach((p) => {
      const alpha = p.life / p.maxLife
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // Update particles
    particlesRef.current = particles
      .map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.05,
        life: p.life - 0.03,
      }))
      .filter(p => p.life > 0)
  }, [])

  // ─── Game Loop ─────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return

    let lastTick = performance.now()

    const loop = (now: number) => {
      if (gameStateRef.current !== 'playing') return

      if (now - lastTick >= speedRef.current) {
        tick()
        lastTick = now
      }

      render()
      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isPlaying, tick, render])

  // Render on pause/idle/gameover too (for static display)
  useEffect(() => {
    if (isPlaying) return
    render()
  }, [gameState, render, isPlaying])

  // ─── Start Game ────────────────────────────────────────────
  const startGame = useCallback(() => {
    snakeRef.current = [
      { x: 12, y: 10 },
      { x: 11, y: 10 },
      { x: 10, y: 10 },
    ]
    directionRef.current = 'RIGHT'
    nextDirectionRef.current = 'RIGHT'
    scoreRef.current = 0
    speedRef.current = INITIAL_SPEED
    particlesRef.current = []
    setScore(0)
    spawnFood()
    gameStateRef.current = 'playing'
    setGameState('playing')
  }, [spawnFood])

  // ─── Visibility Change (Pause) ─────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && gameStateRef.current === 'playing') {
        gameStateRef.current = 'paused'
        setGameState('paused')
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // ─── Keyboard Controls ─────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
        w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
        W: 'UP', S: 'DOWN', A: 'LEFT', D: 'RIGHT',
      }

      if (e.key === ' ' || e.key === 'Escape') {
        e.preventDefault()
        if (gameStateRef.current === 'idle') {
          startGame()
        } else if (gameStateRef.current === 'playing') {
          gameStateRef.current = 'paused'
          setGameState('paused')
        } else if (gameStateRef.current === 'paused') {
          gameStateRef.current = 'playing'
          setGameState('playing')
        } else if (gameStateRef.current === 'gameover') {
          startGame()
        }
        return
      }

      const newDir = keyMap[e.key]
      if (newDir && gameStateRef.current === 'playing') {
        e.preventDefault()
        if (newDir !== oppositeDir(directionRef.current)) {
          nextDirectionRef.current = newDir
        }
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [startGame])

  // ─── Touch/Swipe Controls ──────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      if (!touchStartRef.current) return

      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStartRef.current.x
      const dy = touch.clientY - touchStartRef.current.y
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (Math.max(absDx, absDy) < 20) {
        // Tap - start/pause
        if (gameStateRef.current === 'idle') startGame()
        else if (gameStateRef.current === 'gameover') startGame()
        return
      }

      let newDir: Direction
      if (absDx > absDy) {
        newDir = dx > 0 ? 'RIGHT' : 'LEFT'
      } else {
        newDir = dy > 0 ? 'DOWN' : 'UP'
      }

      if (gameStateRef.current === 'playing' && newDir !== oppositeDir(directionRef.current)) {
        nextDirectionRef.current = newDir
      }

      touchStartRef.current = null
    }

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false })

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchend', handleTouchEnd)
    }
  }, [canvasSize, startGame])

  // ─── Directional Pad (mobile) ──────────────────────────────
  const handleDirection = useCallback((dir: Direction) => {
    if (gameStateRef.current === 'playing' && dir !== oppositeDir(directionRef.current)) {
      nextDirectionRef.current = dir
    }
  }, [])

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
          <span className="text-2xl">🐍</span>
          {t('snakeTitle', 'Snake')}
        </h1>
        <div className="w-16" /> {/* Spacer */}
      </div>

      {/* Score Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-brand" />
            <span className="text-sm font-bold">{score}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-muted-foreground">{highScore}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPlaying && (
            <button
              onClick={() => {
                gameStateRef.current = 'paused'
                setGameState('paused')
              }}
              className="p-2 rounded-lg hover:bg-muted active:scale-90 transition-transform"
            >
              <Pause className="w-5 h-5" />
            </button>
          )}
          {(isIdle || isGameOver) && (
            <Button
              size="sm"
              onClick={startGame}
              className="bg-brand hover:bg-brand-dark text-brand-foreground rounded-xl text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              {isGameOver ? t('playAgain', 'Play Again') : t('start', 'Start')}
            </Button>
          )}
        </div>
      </div>

      {/* Game Canvas Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-4" ref={containerRef}>
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="rounded-2xl shadow-lg border border-border"
            style={{ width: canvasSize.width, height: canvasSize.height, touchAction: 'none' }}
          />

          {/* Overlays */}
          <AnimatePresence>
            {isIdle && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl"
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-6xl mb-4"
                >
                  🐍
                </motion.div>
                <h2 className="text-2xl font-bold mb-2">{t('snakeTitle', 'Snake Game')}</h2>
                <p className="text-sm text-muted-foreground mb-1">
                  {t('snakeSubtitle', 'Eat food, grow longer!')}
                </p>
                <div className="flex items-center gap-3 mt-4">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Apple className="w-3 h-3 text-brand" /> +1
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Cherry className="w-3 h-3 text-yellow-500" /> +3
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Drumstick className="w-3 h-3 text-red-500" /> +5
                  </div>
                </div>
                <Button
                  onClick={startGame}
                  size="lg"
                  className="mt-6 bg-brand hover:bg-brand-dark text-brand-foreground rounded-2xl shadow-lg shadow-brand/25"
                >
                  {t('tapToStart', 'Tap to Start')}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('orPressSpace', 'or press Space')}
                </p>
              </motion.div>
            )}

            {isPaused && (
              <motion.div
                key="paused"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl"
              >
                <Play className="w-12 h-12 text-brand mb-3" />
                <h2 className="text-xl font-bold mb-1">{t('paused', 'Paused')}</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('tapToResume', 'Tap to resume')}
                </p>
                <Button
                  onClick={() => {
                    gameStateRef.current = 'playing'
                    setGameState('playing')
                  }}
                  className="bg-brand hover:bg-brand-dark text-brand-foreground rounded-2xl"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {t('resume', 'Resume')}
                </Button>
              </motion.div>
            )}

            {isGameOver && (
              <motion.div
                key="gameover"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm rounded-2xl"
              >
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-5xl mb-3"
                >
                  💀
                </motion.div>
                <h2 className="text-2xl font-bold mb-1">{t('gameOver', 'Game Over!')}</h2>
                <div className="flex items-center gap-4 mt-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-brand">{score}</p>
                    <p className="text-xs text-muted-foreground">{t('score', 'Score')}</p>
                  </div>
                  <div className="w-px h-10 bg-border" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-500">{highScore}</p>
                    <p className="text-xs text-muted-foreground">{t('best', 'Best')}</p>
                  </div>
                </div>
                {score >= highScore && score > 0 && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-sm text-yellow-500 font-semibold mt-2"
                  >
                    🏆 {t('newHighScore', 'New High Score!')}
                  </motion.p>
                )}
                <Button
                  onClick={startGame}
                  size="lg"
                  className="mt-5 bg-brand hover:bg-brand-dark text-brand-foreground rounded-2xl shadow-lg shadow-brand/25"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {t('playAgain', 'Play Again')}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* D-Pad for mobile */}
        <div className="mt-4 grid grid-cols-3 gap-1 w-40 select-none">
          <div />
          <button
            onTouchStart={(e) => { e.preventDefault(); handleDirection('UP') }}
            onMouseDown={() => handleDirection('UP')}
            className="h-12 rounded-xl bg-card border border-border flex items-center justify-center active:bg-brand active:text-brand-foreground active:scale-90 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3l5 6H3z" /></svg>
          </button>
          <div />
          <button
            onTouchStart={(e) => { e.preventDefault(); handleDirection('LEFT') }}
            onMouseDown={() => handleDirection('LEFT')}
            className="h-12 rounded-xl bg-card border border-border flex items-center justify-center active:bg-brand active:text-brand-foreground active:scale-90 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 8l6-5v10z" /></svg>
          </button>
          <div className="h-12 rounded-xl bg-muted border border-border flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-brand/50" />
          </div>
          <button
            onTouchStart={(e) => { e.preventDefault(); handleDirection('RIGHT') }}
            onMouseDown={() => handleDirection('RIGHT')}
            className="h-12 rounded-xl bg-card border border-border flex items-center justify-center active:bg-brand active:text-brand-foreground active:scale-90 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13 8l-6-5v10z" /></svg>
          </button>
          <div />
          <button
            onTouchStart={(e) => { e.preventDefault(); handleDirection('DOWN') }}
            onMouseDown={() => handleDirection('DOWN')}
            className="h-12 rounded-xl bg-card border border-border flex items-center justify-center active:bg-brand active:text-brand-foreground active:scale-90 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 13l-5-6h10z" /></svg>
          </button>
          <div />
        </div>

        <p className="text-xs text-muted-foreground mt-3 text-center">
          {t('swipeOrArrows', 'Swipe or use arrow keys / WASD')}
        </p>
      </div>
    </div>
  )
}
