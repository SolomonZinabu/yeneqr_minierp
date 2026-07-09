'use client'

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Clock,
  MousePointerClick,
  Star,
  RotateCcw,
  Trophy,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ─── Types ────────────────────────────────────────────────────────
interface GameProps {
  onBack: () => void
  language: string
  t: (key: string, fallback: string) => string
  restaurantId?: string
}

type Difficulty = 'easy' | 'medium' | 'hard'
type GameState = 'idle' | 'playing' | 'won'

interface CardData {
  id: number
  emoji: string
  pairId: number
  isFlipped: boolean
  isMatched: boolean
}

// ─── Constants ────────────────────────────────────────────────────
const BRAND_COLOR = '#039D55'

const ALL_EMOJIS = ['🍕', '🍔', '🍣', '🌮', '🥗', '🍝', '🍩', '🧁', '☕', '🍵', '🥘', '🍛', '🍜']

const DIFFICULTY_CONFIG: Record<Difficulty, { cols: number; rows: number; pairs: number; label: string; labelAm: string }> = {
  easy: { cols: 4, rows: 3, pairs: 6, label: 'Easy', labelAm: 'ቀላል' },
  medium: { cols: 4, rows: 4, pairs: 8, label: 'Medium', labelAm: 'መካከለኛ' },
  hard: { cols: 5, rows: 4, pairs: 10, label: 'Hard', labelAm: 'ከባድ' },
}

// ─── Fisher-Yates Shuffle ─────────────────────────────────────────
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ─── Format Time (mm:ss) ─────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// ─── Card Back Design ─────────────────────────────────────────────
function CardBack() {
  return (
    <div
      className="absolute inset-0 rounded-xl flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: BRAND_COLOR }}
    >
      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 border-2 border-white rounded-lg rotate-45" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border-2 border-white rounded-lg rotate-45" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border-2 border-white rounded-lg rotate-45" />
      </div>
      <span className="text-white text-2xl font-bold relative z-10 select-none">YQ</span>
    </div>
  )
}

// ─── Single Card Component ────────────────────────────────────────
function MemoryCard({
  card,
  onClick,
  disabled,
  index,
}: {
  card: CardData
  onClick: () => void
  disabled: boolean
  index: number
}) {
  const isRevealed = card.isFlipped || card.isMatched

  return (
    <motion.div
      className="relative cursor-pointer"
      style={{ perspective: 600 }}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      onClick={() => {
        if (!disabled && !isRevealed) onClick()
      }}
    >
      <motion.div
        className="relative w-full aspect-square"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: isRevealed ? 180 : 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Back face */}
        <div
          className="absolute inset-0 rounded-xl"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <CardBack />
        </div>

        {/* Front face */}
        <div
          className={`absolute inset-0 rounded-xl flex items-center justify-center bg-card border-2 ${
            card.isMatched
              ? 'border-brand shadow-[0_0_15px_rgba(3,157,85,0.4)]'
              : 'border-border'
          }`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <motion.span
            className="text-3xl sm:text-4xl select-none"
            animate={card.isMatched ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.4 }}
          >
            {card.emoji}
          </motion.span>
        </div>
      </motion.div>

      {/* Mismatch shake */}
      <AnimatePresence>
        {card.isFlipped && !card.isMatched && (
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-red-400/60"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 0],
              x: [0, -4, 4, -4, 4, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Star Rating Display ──────────────────────────────────────────
function StarRating({ stars, size = 'md' }: { stars: number; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-5 h-5' : 'w-8 h-8'
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: i * 0.15, type: 'spring', stiffness: 200 }}
        >
          <Star
            className={`${s} ${i <= stars ? 'fill-yellow-400 text-yellow-400' : 'fill-muted text-muted'}`}
          />
        </motion.div>
      ))}
    </div>
  )
}

// ─── Difficulty Selection Screen ──────────────────────────────────
function DifficultyScreen({
  onSelect,
  language,
  t: translate,
}: {
  onSelect: (d: Difficulty) => void
  language: string
  t: (key: string, fallback: string) => string
}) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-[70vh] px-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {/* Title */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
        style={{ backgroundColor: BRAND_COLOR }}
      >
        <span className="text-4xl">🃏</span>
      </motion.div>

      <h2 className="text-2xl font-bold mb-2 text-center">
        {translate('memoryGame.title', language === 'am' ? 'የማስታወሻ ጨዋታ' : 'Memory Match')}
      </h2>
      <p className="text-muted-foreground text-sm text-center mb-8 max-w-xs">
        {translate(
          'memoryGame.subtitle',
          language === 'am'
            ? 'ካርዶችን ያዙሩ እና ጥንዶችን ያገኙ!'
            : 'Flip cards and find matching pairs!'
        )}
      </p>

      {/* Difficulty buttons */}
      <div className="w-full max-w-xs space-y-3">
        {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff, i) => {
          const config = DIFFICULTY_CONFIG[diff]
          return (
            <motion.button
              key={diff}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              onClick={() => onSelect(diff)}
              className="w-full p-4 rounded-2xl border-2 border-border bg-card hover:border-brand hover:shadow-md transition-all active:scale-[0.98] text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-base">
                    {language === 'am' ? config.labelAm : config.label}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {config.cols}×{config.rows} • {config.pairs}{' '}
                    {language === 'am' ? 'ጥንድ' : 'pairs'}
                  </p>
                </div>
                <div className="flex gap-0.5">
                  {diff === 'easy' && (
                    <>
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <Star className="w-4 h-4 fill-muted text-muted" />
                      <Star className="w-4 h-4 fill-muted text-muted" />
                    </>
                  )}
                  {diff === 'medium' && (
                    <>
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <Star className="w-4 h-4 fill-muted text-muted" />
                    </>
                  )}
                  {diff === 'hard' && (
                    <>
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    </>
                  )}
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Victory Screen ───────────────────────────────────────────────
function VictoryScreen({
  moves,
  time,
  stars,
  difficulty,
  onPlayAgain,
  onBack,
  language,
  t: translate,
}: {
  moves: number
  time: number
  stars: number
  difficulty: Difficulty
  onPlayAgain: () => void
  onBack: () => void
  language: string
  t: (key: string, fallback: string) => string
}) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-[70vh] px-6 py-8"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.4 }}
    >
      {/* Confetti / celebration */}
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        className="w-24 h-24 rounded-full flex items-center justify-center mb-4 shadow-lg"
        style={{ backgroundColor: BRAND_COLOR }}
      >
        <Trophy className="w-12 h-12 text-white" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-2xl font-bold mb-2"
      >
        {translate(
          'memoryGame.congratulations',
          language === 'am' ? 'እንኳን ደስ አለዎት!' : 'Congratulations!'
        )}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-muted-foreground text-sm mb-6"
      >
        {translate(
          'memoryGame.youWon',
          language === 'am' ? 'ሁሉንም ጥንዶች አገኙ!' : 'You found all the pairs!'
        )}
      </motion.p>

      {/* Star rating */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-6"
      >
        <StarRating stars={stars} size="md" />
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-3 gap-4 w-full max-w-xs mb-8"
      >
        <div className="flex flex-col items-center p-3 rounded-xl bg-muted/50">
          <Clock className="w-5 h-5 text-brand mb-1" />
          <span className="text-lg font-bold">{formatTime(time)}</span>
          <span className="text-[10px] text-muted-foreground">
            {language === 'am' ? 'ሰዓት' : 'Time'}
          </span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-xl bg-muted/50">
          <MousePointerClick className="w-5 h-5 text-brand mb-1" />
          <span className="text-lg font-bold">{moves}</span>
          <span className="text-[10px] text-muted-foreground">
            {language === 'am' ? 'እርምጃ' : 'Moves'}
          </span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-xl bg-muted/50">
          <Sparkles className="w-5 h-5 text-brand mb-1" />
          <span className="text-lg font-bold capitalize">
            {language === 'am'
              ? DIFFICULTY_CONFIG[difficulty].labelAm
              : DIFFICULTY_CONFIG[difficulty].label}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {language === 'am' ? 'ደረጃ' : 'Level'}
          </span>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="w-full max-w-xs space-y-3"
      >
        <Button
          onClick={onPlayAgain}
          className="w-full h-12 rounded-xl text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-all"
          style={{ backgroundColor: BRAND_COLOR }}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {translate(
            'memoryGame.playAgain',
            language === 'am' ? 'እንደገና ይጫወቱ' : 'Play Again'
          )}
        </Button>
        <Button
          onClick={onBack}
          variant="outline"
          className="w-full h-10 rounded-xl active:scale-[0.98] transition-all"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {translate('back', language === 'am' ? 'ተመለስ' : 'Back')}
        </Button>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Memory Game Component ───────────────────────────────────
export default function MemoryGame({ onBack, language, t: translate }: GameProps) {
  const [gameState, setGameState] = useState<GameState>('idle')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [cards, setCards] = useState<CardData[]>([])
  const [flippedIds, setFlippedIds] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [matchedPairs, setMatchedPairs] = useState(0)
  const [time, setTime] = useState(0)
  const [isLocked, setIsLocked] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [totalPairs, setTotalPairs] = useState(0)

  // Calculate optimal moves for star rating
  const optimalMoves = totalPairs

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Timer effect
  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTime((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [gameState])

  // Initialize game
  const initGame = useCallback(
    (diff: Difficulty) => {
      const config = DIFFICULTY_CONFIG[diff]
      setDifficulty(diff)
      setTotalPairs(config.pairs)

      const selectedEmojis = shuffleArray(ALL_EMOJIS).slice(0, config.pairs)
      const cardPairs: CardData[] = []

      selectedEmojis.forEach((emoji, pairIndex) => {
        cardPairs.push({ id: pairIndex * 2, emoji, pairId: pairIndex, isFlipped: false, isMatched: false })
        cardPairs.push({ id: pairIndex * 2 + 1, emoji, pairId: pairIndex, isFlipped: false, isMatched: false })
      })

      setCards(shuffleArray(cardPairs))
      setFlippedIds([])
      setMoves(0)
      setMatchedPairs(0)
      setTime(0)
      setIsLocked(false)
      setGameState('playing')
    },
    []
  )

  // Handle card flip
  const handleCardClick = useCallback(
    (cardId: number) => {
      if (isLocked) return

      const card = cards.find((c) => c.id === cardId)
      if (!card || card.isFlipped || card.isMatched) return
      if (flippedIds.includes(cardId)) return

      const newFlipped = [...flippedIds, cardId]
      setFlippedIds(newFlipped)

      // Flip the card
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, isFlipped: true } : c))
      )

      // If two cards are flipped
      if (newFlipped.length === 2) {
        setMoves((prev) => prev + 1)
        setIsLocked(true)

        const [firstId, secondId] = newFlipped
        const firstCard = cards.find((c) => c.id === firstId)!
        const secondCard = cards.find((c) => c.id === secondId)!

        if (firstCard.pairId === secondCard.pairId) {
          // Match!
          const newMatchedCount = matchedPairs + 1
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                c.id === firstId || c.id === secondId
                  ? { ...c, isMatched: true, isFlipped: true }
                  : c
              )
            )
            setMatchedPairs(newMatchedCount)
            setFlippedIds([])
            setIsLocked(false)
            // Check for win
            if (newMatchedCount === totalPairs) {
              setGameState('won')
            }
          }, 300)
        } else {
          // No match — flip back after 800ms
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                c.id === firstId || c.id === secondId
                  ? { ...c, isFlipped: false }
                  : c
              )
            )
            setFlippedIds([])
            setIsLocked(false)
          }, 800)
        }
      }
    },
    [cards, flippedIds, isLocked, matchedPairs, totalPairs]
  )

  // Star rating calculation
  const stars = useMemo((): number => {
    if (moves <= optimalMoves + 2) return 3
    if (moves <= optimalMoves + 5) return 2
    return 1
  }, [moves, optimalMoves])

  // Grid columns class
  const gridColsClass = useMemo(() => {
    const config = DIFFICULTY_CONFIG[difficulty]
    switch (config.cols) {
      case 4: return 'grid-cols-4'
      case 5: return 'grid-cols-5'
      default: return 'grid-cols-4'
    }
  }, [difficulty])

  const config = DIFFICULTY_CONFIG[difficulty]

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground active:scale-95 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            {translate('back', language === 'am' ? 'ተመለስ' : 'Back')}
          </button>

          {gameState === 'playing' && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="gap-1 text-xs">
                <Clock className="w-3 h-3" />
                {formatTime(time)}
              </Badge>
              <Badge variant="secondary" className="gap-1 text-xs">
                <MousePointerClick className="w-3 h-3" />
                {moves}
              </Badge>
              <Badge
                className="gap-1 text-xs text-white"
                style={{ backgroundColor: BRAND_COLOR }}
              >
                {matchedPairs}/{totalPairs}
              </Badge>
            </div>
          )}

          {gameState === 'playing' && (
            <button
              onClick={() => initGame(difficulty)}
              className="p-2 rounded-lg hover:bg-muted active:scale-95 transition-all"
              title={language === 'am' ? 'እንደገና ጀምር' : 'Restart'}
            >
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          {gameState === 'idle' && (
            <DifficultyScreen
              key="difficulty"
              onSelect={initGame}
              language={language}
              t={translate}
            />
          )}

          {gameState === 'playing' && (
            <motion.div
              key="game"
              className="px-4 py-4 max-w-md mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Progress bar */}
              <div className="mb-4">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: BRAND_COLOR }}
                    animate={{
                      width: `${totalPairs > 0 ? (matchedPairs / totalPairs) * 100 : 0}%`,
                    }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Card Grid */}
              <div className={`grid ${gridColsClass} gap-2 sm:gap-3`}>
                {cards.map((card, index) => (
                  <MemoryCard
                    key={card.id}
                    card={card}
                    onClick={() => handleCardClick(card.id)}
                    disabled={isLocked}
                    index={index}
                  />
                ))}
              </div>

              {/* Hint text */}
              <motion.p
                className="text-center text-xs text-muted-foreground mt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                {matchedPairs === 0
                  ? translate(
                      'memoryGame.tapToStart',
                      language === 'am'
                        ? 'ለመጀመር ካርድ ይጫኑ'
                        : 'Tap a card to begin'
                    )
                  : `${matchedPairs}/${totalPairs} ${language === 'am' ? 'ጥንዶች ተገኝተዋል' : 'pairs found'}`}
              </motion.p>
            </motion.div>
          )}

          {gameState === 'won' && (
            <VictoryScreen
              key="victory"
              moves={moves}
              time={time}
              stars={stars}
              difficulty={difficulty}
              onPlayAgain={() => initGame(difficulty)}
              onBack={onBack}
              language={language}
              t={translate}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
