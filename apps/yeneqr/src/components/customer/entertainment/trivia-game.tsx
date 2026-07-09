'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Trophy,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Zap,
  Flame,
  ChevronRight,
  Brain,
  Star,
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

type GameState = 'idle' | 'playing' | 'answered' | 'game_over'
type QuestionCategory = 'food' | 'culture' | 'science' | 'history' | 'general'

interface TriviaQuestion {
  id: number
  question: string
  questionAm?: string
  options: string[]
  optionsAm?: string[]
  correctIndex: number
  category: QuestionCategory
}

// ─── Constants ────────────────────────────────────────────────────
const BRAND_COLOR = '#039D55'
const QUESTION_TIME = 15 // seconds
const SPEED_BONUS_THRESHOLD = 5 // seconds
const CORRECT_POINTS = 10
const SPEED_BONUS_POINTS = 5
const STREAK_BONUS_POINTS = 3

const CATEGORY_COLORS: Record<QuestionCategory, { bg: string; text: string; darkBg: string; darkText: string }> = {
  food: { bg: 'bg-orange-100', text: 'text-orange-700', darkBg: 'dark:bg-orange-900/30', darkText: 'dark:text-orange-300' },
  culture: { bg: 'bg-purple-100', text: 'text-purple-700', darkBg: 'dark:bg-purple-900/30', darkText: 'dark:text-purple-300' },
  science: { bg: 'bg-cyan-100', text: 'text-cyan-700', darkBg: 'dark:bg-cyan-900/30', darkText: 'dark:text-cyan-300' },
  history: { bg: 'bg-amber-100', text: 'text-amber-700', darkBg: 'dark:bg-amber-900/30', darkText: 'dark:text-amber-300' },
  general: { bg: 'bg-slate-100', text: 'text-slate-700', darkBg: 'dark:bg-slate-800/30', darkText: 'dark:text-slate-300' },
}

const CATEGORY_LABELS: Record<QuestionCategory, { en: string; am: string }> = {
  food: { en: 'Food', am: 'ምግብ' },
  culture: { en: 'Culture', am: 'ባህል' },
  science: { en: 'Science', am: 'ሳይንስ' },
  history: { en: 'History', am: 'ታሪክ' },
  general: { en: 'General', am: 'አጠቃላይ' },
}

// ─── Fallback Questions (20 diverse food/culture questions) ───────
const FALLBACK_QUESTIONS: TriviaQuestion[] = [
  {
    id: 1,
    question: 'What country is the origin of sushi?',
    questionAm: 'ሱሺ የትኛው ሀገር ምንጭ ነው?',
    options: ['China', 'Japan', 'Korea', 'Thailand'],
    optionsAm: ['ቻይና', 'ጃፓን', 'ኮሪያ', 'ታይላንድ'],
    correctIndex: 1,
    category: 'food',
  },
  {
    id: 2,
    question: 'Which spice is known as the "King of Spices"?',
    questionAm: 'የትኛው ቅመም "የቅመማ ንጉሥ" በመባል ይታወቃል?',
    options: ['Turmeric', 'Cumin', 'Black Pepper', 'Cinnamon'],
    optionsAm: ['ሱርሜሪች', 'ኪሚን', 'ጥቁር ሜከሌሻ', 'ቀረፋ'],
    correctIndex: 2,
    category: 'food',
  },
  {
    id: 3,
    question: 'Injera is a traditional flatbread from which country?',
    questionAm: 'እንጀራ የትኛው ሀገር ባህላዊ ዳቦ ነው?',
    options: ['Kenya', 'Ethiopia', 'Nigeria', 'Egypt'],
    optionsAm: ['ኬንያ', 'ኢትዮጵያ', 'ናይጄሪያ', 'ግብፅ'],
    correctIndex: 1,
    category: 'food',
  },
  {
    id: 4,
    question: 'What is the main ingredient in hummus?',
    questionAm: 'ሁሙስ ውስጥ ዋናው ንጥረ ነገር ምንድነው?',
    options: ['Lentils', 'Chickpeas', 'Black Beans', 'Peas'],
    optionsAm: ['ምስር', 'ሽንብራ', 'ጥቁር አተር', 'አተር'],
    correctIndex: 1,
    category: 'food',
  },
  {
    id: 5,
    question: 'Coffee was first discovered in which region?',
    questionAm: 'ቡና መጀመሪያ የትኛው ክልል ተገኝቷል?',
    options: ['South America', 'Ethiopia', 'India', 'Yemen'],
    optionsAm: ['ደቡብ አሜሪካ', 'ኢትዮጵያ', 'ህንድ', 'የመን'],
    correctIndex: 1,
    category: 'history',
  },
  {
    id: 6,
    question: 'Which fruit is known as the "King of Fruits"?',
    questionAm: 'የትኛው ፍሬ "የፍራፍሬ ንጉሥ" በመባል ይታወቃል?',
    options: ['Mango', 'Durian', 'Pineapple', 'Jackfruit'],
    optionsAm: ['ማንጎ', 'ዱሪያን', 'አናናስ', 'ጃክፍሩት'],
    correctIndex: 1,
    category: 'food',
  },
  {
    id: 7,
    question: 'What is the traditional Ethiopian coffee ceremony called?',
    questionAm: 'ባህላዊው የኢትዮጵያ የቡና ስርዓት ምን ተብሎ ይጠራል?',
    options: ['Buna Tetu', 'Buna Maflat', 'Buna Dabo', 'Buna Qwankwa'],
    optionsAm: ['ቡና ቴቱ', 'ቡና ማፍላት', 'ቡና ዳቦ', 'ቡና ቋንቋ'],
    correctIndex: 0,
    category: 'culture',
  },
  {
    id: 8,
    question: 'How many calories are in one gram of protein?',
    questionAm: 'አንድ ግራም ፕሮቲን ስንት ካሎሪ አለው?',
    options: ['2 calories', '4 calories', '7 calories', '9 calories'],
    optionsAm: ['2 ካሎሪ', '4 ካሎሪ', '7 ካሎሪ', '9 ካሎሪ'],
    correctIndex: 1,
    category: 'science',
  },
  {
    id: 9,
    question: 'Which country consumes the most pasta per capita?',
    questionAm: 'የትኛው ሀገር በአንድ ሰው ምዕራፍ በጣም ብዙ ፓስታ ይጠቀማል?',
    options: ['USA', 'China', 'Italy', 'Brazil'],
    optionsAm: ['አሜሪካ', 'ቻይና', 'ጣሊያን', 'ብራዚል'],
    correctIndex: 2,
    category: 'food',
  },
  {
    id: 10,
    question: 'What year was the first Michelin Guide published?',
    questionAm: 'የመጀመሪያው ሚሼሊን መመሪያ ምን ዓመት ታተመ?',
    options: ['1890', '1900', '1910', '1920'],
    optionsAm: ['1890', '1900', '1910', '1920'],
    correctIndex: 1,
    category: 'history',
  },
  {
    id: 11,
    question: 'What vitamin is abundant in citrus fruits?',
    questionAm: 'ምን ቫይታሚን በሎሚ ፍሬዎች ውስጥ ብዙ ነው?',
    options: ['Vitamin A', 'Vitamin B', 'Vitamin C', 'Vitamin D'],
    optionsAm: ['ቫይታሚን A', 'ቫይታሚን B', 'ቫይታሚን C', 'ቫይታሚን D'],
    correctIndex: 2,
    category: 'science',
  },
  {
    id: 12,
    question: 'Tej is a traditional honey wine from which country?',
    questionAm: 'ጤጅ የትኛው ሀገር ባህላዊ የማር ወይን ነው?',
    options: ['Morocco', 'Ethiopia', 'Ghana', 'South Africa'],
    optionsAm: ['ሞሮኮ', 'ኢትዮጵያ', 'ጋና', 'ደቡብ አፍሪካ'],
    correctIndex: 1,
    category: 'culture',
  },
  {
    id: 13,
    question: 'Which grain is used to make traditional beer in Africa?',
    questionAm: 'የትኛው እህል በአፍሪካ ባህላዊ ቢራ ለመስራት ይያያዛል?',
    options: ['Rice', 'Sorghum', 'Wheat', 'Oats'],
    optionsAm: ['ሩዝ', 'ማሽላ', 'ስንዴ', 'ኦትስ'],
    correctIndex: 1,
    category: 'culture',
  },
  {
    id: 14,
    question: 'What is the process of fermenting milk called?',
    questionAm: 'ወተትን ማብገስ ምን ተብሎ ይጠራል?',
    options: ['Pasteurization', 'Culturing', 'Homogenization', 'Condensation'],
    optionsAm: ['ፓስቸራይዜሽን', 'ካልቸሪንግ', 'ሆሞጄናይዜሽን', 'ኮንደንሴሽን'],
    correctIndex: 1,
    category: 'science',
  },
  {
    id: 15,
    question: 'The Silk Road was primarily used for trading what?',
    questionAm: 'የሐር መንገድ ዋና ዋናው ለምን ንግድ ጥቅም ነበር?',
    options: ['Gold', 'Silk and Spices', 'Weapons', 'Animals'],
    optionsAm: ['ወርቅ', 'ሐር እና ቅመማ ቅመም', 'መሣሪያ', 'እንስሳት'],
    correctIndex: 1,
    category: 'history',
  },
  {
    id: 16,
    question: 'Kimchi is a fermented dish from which country?',
    questionAm: 'ኪምቺ የትኛው ሀገር የተቀባ ዳቦ ነው?',
    options: ['Japan', 'Vietnam', 'Korea', 'China'],
    optionsAm: ['ጃፓን', 'ቬትናም', 'ኮሪያ', 'ቻይና'],
    correctIndex: 2,
    category: 'food',
  },
  {
    id: 17,
    question: 'What is the world&apos;s most consumed beverage after water?',
    questionAm: 'ከውሃ በኋላ በዓለም ላይ በጣም የሚጠጣ መጠጥ ምንድነው?',
    options: ['Coffee', 'Tea', 'Milk', 'Beer'],
    optionsAm: ['ቡና', 'ሻይ', 'ወተት', 'ቢራ'],
    correctIndex: 1,
    category: 'general',
  },
  {
    id: 18,
    question: 'What percentage of the world&apos;s food comes from just 12 plants?',
    questionAm: 'የዓለም ምግብ ስንት በመቶ ከ12 ተክሎች ብቻ ይመጣል?',
    options: ['50%', '60%', '75%', '80%'],
    optionsAm: ['50%', '60%', '75%', '80%'],
    correctIndex: 2,
    category: 'science',
  },
  {
    id: 19,
    question: 'Which ancient civilization first cultivated olives?',
    questionAm: 'የትኛው ጥንታዊ ሥልጣኔ ዘመን የመጀመሪያ ወይራ አሳደገ?',
    options: ['Egyptians', 'Greeks', 'Romans', 'Persians'],
    optionsAm: ['ግብፃውያን', 'ግሪኮች', 'ሮማውያን', 'ፋርሲዎች'],
    correctIndex: 1,
    category: 'history',
  },
  {
    id: 20,
    question: 'How many spices are typically in Ethiopian berbere?',
    questionAm: 'በኢትዮጵያ በርበሬ ውስጥ በተለምዶ ስንት ቅመማ ቅመም አሉ?',
    options: ['5-7', '8-10', '12-15', '20+'],
    optionsAm: ['5-7', '8-10', '12-15', '20+'],
    correctIndex: 2,
    category: 'food',
  },
]

// ─── Fisher-Yates Shuffle ─────────────────────────────────────────
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ─── Circular Timer Component ─────────────────────────────────────
function CircularTimer({
  timeLeft,
  totalTime,
  isLow,
}: {
  timeLeft: number
  totalTime: number
  isLow: boolean
}) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const progress = timeLeft / totalTime
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={isLow ? '#ef4444' : BRAND_COLOR}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <motion.span
        key={timeLeft}
        initial={{ scale: isLow && timeLeft <= 3 ? 1.3 : 1 }}
        animate={{ scale: 1 }}
        className={`text-lg font-bold ${isLow && timeLeft <= 3 ? 'text-red-500' : 'text-foreground'}`}
      >
        {timeLeft}
      </motion.span>
    </div>
  )
}

// ─── Start Screen ─────────────────────────────────────────────────
function StartScreen({
  onStart,
  language,
  t: translate,
}: {
  onStart: () => void
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
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
        style={{ backgroundColor: BRAND_COLOR }}
      >
        <Brain className="w-10 h-10 text-white" />
      </motion.div>

      <h2 className="text-2xl font-bold mb-2 text-center">
        {translate('trivia.title', language === 'am' ? 'የእውቀት ጨዋታ' : 'Food Trivia')}
      </h2>
      <p className="text-muted-foreground text-sm text-center mb-2 max-w-xs">
        {translate(
          'trivia.subtitle',
          language === 'am'
            ? 'ስለ ምግብ፣ ባህል እና ሳይንስ ይፈትሹ!'
            : 'Test your knowledge about food, culture & science!'
        )}
      </p>

      {/* Scoring info */}
      <div className="w-full max-w-xs p-4 rounded-2xl bg-muted/50 mb-8 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-brand" />
          <span>{language === 'am' ? '+10 ነጥብ ትክክል መሆን' : '+10 points for correct'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Zap className="w-4 h-4 text-yellow-500" />
          <span>{language === 'am' ? '+5 ቦነስ በ5 ሰከንድ ውስጥ' : '+5 bonus if under 5s'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Flame className="w-4 h-4 text-orange-500" />
          <span>{language === 'am' ? '+3 ስትሪክ ቦነስ' : '+3 streak bonus'}</span>
        </div>
      </div>

      <div className="w-full max-w-xs">
        <Button
          onClick={onStart}
          className="w-full h-14 text-lg font-semibold rounded-2xl text-white shadow-lg active:scale-[0.98] transition-all"
          style={{ backgroundColor: BRAND_COLOR }}
        >
          {translate('trivia.start', language === 'am' ? 'ጨዋታ ጀምር' : 'Start Game')}
        </Button>
      </div>
    </motion.div>
  )
}

// ─── Game Over Screen ─────────────────────────────────────────────
function GameOverScreen({
  score,
  totalQuestions,
  correctCount,
  bestStreak,
  onPlayAgain,
  onBack,
  language,
  t: translate,
}: {
  score: number
  totalQuestions: number
  correctCount: number
  bestStreak: number
  onPlayAgain: () => void
  onBack: () => void
  language: string
  t: (key: string, fallback: string) => string
}) {
  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
  const maxPossible = totalQuestions * (CORRECT_POINTS + SPEED_BONUS_POINTS + STREAK_BONUS_POINTS)

  const getRating = () => {
    if (percentage >= 90) return { stars: 3, label: language === 'am' ? 'አስደናቂ!' : 'Amazing!' }
    if (percentage >= 70) return { stars: 2, label: language === 'am' ? 'ጥሩ!' : 'Great!' }
    if (percentage >= 50) return { stars: 1, label: language === 'am' ? 'አይበጃ!' : 'Not Bad!' }
    return { stars: 0, label: language === 'am' ? 'እንደገና ይሞክሩ' : 'Try Again' }
  }

  const rating = getRating()

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-[70vh] px-6 py-8"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.4 }}
    >
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
        className="text-2xl font-bold mb-1"
      >
        {rating.label}
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex gap-1 mb-6"
      >
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 + i * 0.1, type: 'spring' }}
          >
            <Star
              className={`w-8 h-8 ${
                i <= rating.stars ? 'fill-yellow-400 text-yellow-400' : 'fill-muted text-muted'
              }`}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Score display */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-4xl font-bold mb-1"
        style={{ color: BRAND_COLOR }}
      >
        {score}
      </motion.div>
      <p className="text-xs text-muted-foreground mb-6">
        {language === 'am' ? 'ነጥቦች' : 'points'}
      </p>

      {/* Stats grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="grid grid-cols-3 gap-3 w-full max-w-xs mb-8"
      >
        <div className="flex flex-col items-center p-3 rounded-xl bg-muted/50">
          <CheckCircle2 className="w-5 h-5 text-brand mb-1" />
          <span className="text-lg font-bold">{correctCount}/{totalQuestions}</span>
          <span className="text-[10px] text-muted-foreground">
            {language === 'am' ? 'ትክክል' : 'Correct'}
          </span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-xl bg-muted/50">
          <span className="text-lg font-bold text-brand">{percentage}%</span>
          <span className="text-lg font-bold">-</span>
          <span className="text-[10px] text-muted-foreground">
            {language === 'am' ? 'ውጤት' : 'Score %'}
          </span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-xl bg-muted/50">
          <Flame className="w-5 h-5 text-orange-500 mb-1" />
          <span className="text-lg font-bold">{bestStreak}🔥</span>
          <span className="text-[10px] text-muted-foreground">
            {language === 'am' ? 'ስትሪክ' : 'Streak'}
          </span>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="w-full max-w-xs space-y-3"
      >
        <Button
          onClick={onPlayAgain}
          className="w-full h-12 rounded-xl text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-all"
          style={{ backgroundColor: BRAND_COLOR }}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {translate('trivia.playAgain', language === 'am' ? 'እንደገና ይጫወቱ' : 'Play Again')}
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

// ─── Main Trivia Game Component ───────────────────────────────────
export default function TriviaGame({ onBack, language, t: translate, restaurantId }: GameProps) {
  const [gameState, setGameState] = useState<GameState>('idle')
  const [questions, setQuestions] = useState<TriviaQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME)
  const [questionStartTime, setQuestionStartTime] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const questionCount = 10 // questions per game

  // Clean up timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Handle time up
  const handleTimeUp = useCallback(() => {
    setSelectedAnswer(-1) // indicate timeout
    setStreak(0)
    setGameState('answered')
  }, [])

  // Timer effect
  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Time's up — auto-answer wrong
            if (timerRef.current) clearInterval(timerRef.current)
            handleTimeUp()
            return 0
          }
          return prev - 1
        })
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
  }, [gameState, currentIndex, handleTimeUp])

  // Fetch questions from API with fallback
  const fetchQuestions = useCallback(async () => {
    setIsLoading(true)
    try {
      if (restaurantId) {
        const res = await fetch(
          `/api/restaurants/${restaurantId}/entertainment?type=trivia_question`
        )
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.questions) && data.questions.length > 0) {
            // Map API questions to our format
            const mapped: TriviaQuestion[] = data.questions.map(
              (q: any, i: number) => ({
                id: q.id || i,
                question: language === 'am' && q.questionAm ? q.questionAm : q.question,
                questionAm: q.questionAm,
                options:
                  language === 'am' && q.optionsAm
                    ? q.optionsAm
                    : q.options,
                optionsAm: q.optionsAm,
                correctIndex: q.correctIndex ?? q.correct ?? 0,
                category: q.category || 'general',
              })
            )
            setQuestions(shuffleArray(mapped).slice(0, questionCount))
            setIsLoading(false)
            return
          }
        }
      }
    } catch {
      // Fall back to hardcoded
    }

    // Use fallback questions
    const langQuestions = FALLBACK_QUESTIONS.map((q) => ({
      ...q,
      question: language === 'am' && q.questionAm ? q.questionAm : q.question,
      options:
        language === 'am' && q.optionsAm ? q.optionsAm : q.options,
    }))
    setQuestions(shuffleArray(langQuestions).slice(0, questionCount))
    setIsLoading(false)
  }, [restaurantId, language])

  // Start game
  const startGame = useCallback(async () => {
    await fetchQuestions()
    setCurrentIndex(0)
    setScore(0)
    setCorrectCount(0)
    setStreak(0)
    setBestStreak(0)
    setSelectedAnswer(null)
    setTimeLeft(QUESTION_TIME)
    setQuestionStartTime(Date.now())
    setGameState('playing')
  }, [fetchQuestions])

  // Handle answer selection
  const handleAnswer = useCallback(
    (answerIndex: number) => {
      if (gameState !== 'playing' || selectedAnswer !== null) return

      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      setSelectedAnswer(answerIndex)
      const question = questions[currentIndex]
      if (!question) return

      const isCorrect = answerIndex === question.correctIndex

      if (isCorrect) {
        const timeTaken = (Date.now() - questionStartTime) / 1000
        let points = CORRECT_POINTS

        // Speed bonus
        if (timeTaken < SPEED_BONUS_THRESHOLD) {
          points += SPEED_BONUS_POINTS
        }

        // Streak bonus
        const newStreak = streak + 1
        if (newStreak >= 2) {
          points += STREAK_BONUS_POINTS
        }

        setScore((prev) => prev + points)
        setCorrectCount((prev) => prev + 1)
        setStreak(newStreak)
        setBestStreak((prev) => Math.max(prev, newStreak))
      } else {
        setStreak(0)
      }

      setGameState('answered')
    },
    [gameState, selectedAnswer, questions, currentIndex, questionStartTime, streak]
  )

  // Next question or game over
  const nextQuestion = useCallback(() => {
    if (isTransitioning) return
    setIsTransitioning(true)

    if (currentIndex + 1 >= questions.length) {
      setGameState('game_over')
      setIsTransitioning(false)
      return
    }

    setCurrentIndex((prev) => prev + 1)
    setSelectedAnswer(null)
    setTimeLeft(QUESTION_TIME)
    setQuestionStartTime(Date.now())
    setGameState('playing')
    setIsTransitioning(false)
  }, [currentIndex, questions.length, isTransitioning])

  // Current question
  const currentQuestion = questions[currentIndex]
  const isCorrect = selectedAnswer !== null && selectedAnswer !== -1 && currentQuestion && selectedAnswer === currentQuestion.correctIndex
  const isTimeout = selectedAnswer === -1

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

          {gameState !== 'idle' && (
            <div className="flex items-center gap-2">
              {streak >= 2 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-0.5"
                >
                  <Badge className="gap-1 text-xs bg-orange-500 text-white border-0">
                    <Flame className="w-3 h-3" />
                    {streak}×
                  </Badge>
                </motion.div>
              )}
              <Badge
                className="gap-1 text-xs text-white"
                style={{ backgroundColor: BRAND_COLOR }}
              >
                {score} pts
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          {gameState === 'idle' && (
            <StartScreen
              key="start"
              onStart={startGame}
              language={language}
              t={translate}
            />
          )}

          {(gameState === 'playing' || gameState === 'answered') && currentQuestion && (
            <motion.div
              key={`question-${currentIndex}`}
              className="px-4 py-4 max-w-lg mx-auto"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">
                    {language === 'am' ? 'ጥያቄ' : 'Question'} {currentIndex + 1}/{questions.length}
                  </span>
                  {currentQuestion.category && (
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${CATEGORY_COLORS[currentQuestion.category].bg} ${CATEGORY_COLORS[currentQuestion.category].text} ${CATEGORY_COLORS[currentQuestion.category].darkBg} ${CATEGORY_COLORS[currentQuestion.category].darkText}`}
                    >
                      {CATEGORY_LABELS[currentQuestion.category]
                        ? language === 'am'
                          ? CATEGORY_LABELS[currentQuestion.category].am
                          : CATEGORY_LABELS[currentQuestion.category].en
                        : currentQuestion.category}
                    </Badge>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: BRAND_COLOR }}
                    animate={{
                      width: `${((currentIndex + 1) / questions.length) * 100}%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Timer */}
              <div className="flex justify-center mb-4">
                <CircularTimer
                  timeLeft={timeLeft}
                  totalTime={QUESTION_TIME}
                  isLow={timeLeft <= 5}
                />
              </div>

              {/* Question */}
              <motion.div
                className="mb-6 p-5 rounded-2xl bg-card border border-border shadow-sm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h3 className="text-lg font-semibold text-center leading-relaxed">
                  {currentQuestion.question}
                </h3>
              </motion.div>

              {/* Options */}
              <div className="space-y-3">
                {currentQuestion.options.map((option, i) => {
                  const isThisCorrect = i === currentQuestion.correctIndex
                  const isSelected = selectedAnswer === i
                  const showResult = gameState === 'answered'

                  let optionStyle = 'border-border bg-card hover:border-brand/30 hover:shadow-sm'
                  if (showResult) {
                    if (isThisCorrect) {
                      optionStyle = 'border-brand bg-brand/10 shadow-[0_0_15px_rgba(3,157,85,0.2)]'
                    } else if (isSelected && !isThisCorrect) {
                      optionStyle = 'border-red-400 bg-red-50 dark:bg-red-900/20'
                    } else {
                      optionStyle = 'border-border bg-muted/50 opacity-60'
                    }
                  } else if (isSelected) {
                    optionStyle = 'border-brand bg-brand/5'
                  }

                  return (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.05 }}
                      onClick={() => handleAnswer(i)}
                      disabled={gameState === 'answered'}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${optionStyle} ${
                        gameState === 'answered' ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            showResult && isThisCorrect
                              ? 'bg-brand text-white'
                              : showResult && isSelected && !isThisCorrect
                              ? 'bg-red-500 text-white'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {showResult && isThisCorrect ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : showResult && isSelected && !isThisCorrect ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            String.fromCharCode(65 + i)
                          )}
                        </div>
                        <span className="font-medium text-sm">{option}</span>
                      </div>
                    </motion.button>
                  )
                })}
              </div>

              {/* Answer feedback */}
              <AnimatePresence>
                {gameState === 'answered' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-4"
                  >
                    {/* Result message */}
                    <motion.div
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      className={`p-3 rounded-xl text-center text-sm font-semibold mb-3 ${
                        isTimeout
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          : isCorrect
                          ? 'bg-brand/10 text-brand'
                          : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                      }`}
                    >
                      {isTimeout
                        ? language === 'am'
                          ? '⏰ ጊዜው አልፏል!'
                          : "⏰ Time's up!"
                        : isCorrect
                        ? language === 'am'
                          ? '✅ ትክክል ነው!'
                          : '✅ Correct!'
                        : language === 'am'
                        ? `❌ ትክክል ያልሆነ። መልሱ: ${currentQuestion.options[currentQuestion.correctIndex]}`
                        : `❌ Wrong! The answer was: ${currentQuestion.options[currentQuestion.correctIndex]}`}
                    </motion.div>

                    {/* Points earned */}
                    {isCorrect && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-center text-xs text-muted-foreground"
                      >
                        {(() => {
                          const timeTaken = (Date.now() - questionStartTime) / 1000
                          const points = [CORRECT_POINTS]
                          if (timeTaken < SPEED_BONUS_THRESHOLD) points.push(SPEED_BONUS_POINTS)
                          if (streak >= 2) points.push(STREAK_BONUS_POINTS)
                          return `+${points.join(' + ')} pts`
                        })()}
                      </motion.div>
                    )}

                    {/* Next button */}
                    <Button
                      onClick={nextQuestion}
                      className="w-full h-11 rounded-xl text-white font-semibold mt-3 shadow-md active:scale-[0.98] transition-all"
                      style={{ backgroundColor: BRAND_COLOR }}
                    >
                      {currentIndex + 1 >= questions.length
                        ? translate(
                            'trivia.seeResults',
                            language === 'am' ? 'ውጤት ይመልከቱ' : 'See Results'
                          )
                        : translate(
                            'trivia.nextQuestion',
                            language === 'am' ? 'ቀጣይ ጥያቄ' : 'Next Question'
                          )}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {gameState === 'game_over' && (
            <GameOverScreen
              key="gameover"
              score={score}
              totalQuestions={questions.length}
              correctCount={correctCount}
              bestStreak={bestStreak}
              onPlayAgain={startGame}
              onBack={onBack}
              language={language}
              t={translate}
            />
          )}
        </AnimatePresence>

        {/* Loading overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
            >
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-10 h-10 border-3 border-brand border-t-transparent rounded-full"
                  style={{ borderWidth: '3px' }}
                />
                <p className="text-sm text-muted-foreground">
                  {language === 'am' ? 'ጥያቄዎችን በመጫን ላይ...' : 'Loading questions...'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
