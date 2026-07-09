'use client';

// ============================================================
// YeneQR Arena — Competitive Dining Games
// ============================================================
// Embedded in the customer menu page's entertainment hub.
// Four games: Wot Crush (match-3 puzzle), Trivia Royale, Speed
// Order Challenge, Emoji Guess. Leaderboard, rewards, streak
// multipliers, real-time scoring.
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap, Target, Brain, Clock, Star, Crown, Medal, RotateCcw, ChevronRight, Sparkles, Flame } from 'lucide-react';
import { toast } from 'sonner';
import { WotCrushGame } from './wot-crush-game';

// Fallback trivia questions used when DB has no EntertainmentContent
// (ensures Trivia Royale always works, even on fresh installs)
const FALLBACK_TRIVIA = [
  { question: 'What grain is traditionally used to make injera?', options: ['Wheat', 'Teff', 'Barley', 'Corn'], correctIndex: 1, explanation: 'Teff is a tiny grain native to Ethiopia.' },
  { question: 'What is the national dish of Ethiopia?', options: ['Pasta', 'Doro Wot', 'Sushi', 'Pizza'], correctIndex: 1, explanation: 'Doro Wot is a spicy chicken stew, considered the national dish.' },
  { question: 'What is Tej made from?', options: ['Barley', 'Honey', 'Grapes', 'Sorghum'], correctIndex: 1, explanation: 'Tej is a traditional Ethiopian honey wine (mead).' },
  { question: 'Where was coffee first discovered?', options: ['Yemen', 'Brazil', 'Ethiopia', 'Colombia'], correctIndex: 2, explanation: 'Coffee was discovered in the Kaffa region of Ethiopia around 850 AD.' },
  { question: 'How many months are in the Ethiopian calendar?', options: ['10', '12', '13', '14'], correctIndex: 2, explanation: 'The Ethiopian calendar has 13 months — 12 of 30 days + 1 of 5-6 days.' },
  { question: 'What is berbere?', options: ['A dance', 'A spice blend', 'A musical instrument', 'A type of bread'], correctIndex: 1, explanation: 'Berbere is a spice blend with chili, fenugreek, ginger, and more.' },
  { question: 'What is kolo?', options: ['A drink', 'Roasted barley snack', 'A type of wot', 'A dessert'], correctIndex: 1, explanation: 'Kolo is a popular roasted barley and peanut snack.' },
  { question: 'What does "wot" mean?', options: ['Bread', 'Stew', 'Drink', 'Dessert'], correctIndex: 1, explanation: 'Wot is the Ethiopian word for stew.' },
  { question: 'What is kitfo?', options: ['Raw minced beef', 'Vegetable stew', 'Flatbread', 'Coffee ceremony'], correctIndex: 0, explanation: 'Kitfo is a dish of raw minced beef marinated in spices.' },
  { question: 'What is shiro?', options: ['A meat dish', 'Chickpea flour stew', 'A type of bread', 'A drink'], correctIndex: 1, explanation: 'Shiro is a stew made from chickpea flour and spices.' },
];

// Fallback emoji questions for Emoji Food Guess
const FALLBACK_EMOJI = [
  { emojis: '☕🔥🐐', answer: 'Kaldi Coffee Discovery', hint: 'Goats dancing' },
  { emojis: '🍯🍷', answer: 'Tej', hint: 'Honey wine' },
  { emojis: '🌶️🔥🍗', answer: 'Doro Wot', hint: 'Spicy chicken stew' },
  { emojis: '🌾🫓', answer: 'Injera', hint: 'Spongy flatbread' },
  { emojis: '🥩🌶️', answer: 'Kitfo', hint: 'Raw spiced beef' },
  { emojis: '🍲🥜', answer: 'Shiro', hint: 'Chickpea stew' },
  { emojis: '🥜🔥', answer: 'Kolo', hint: 'Roasted barley snack' },
  { emojis: '☕🙏', answer: 'Coffee Ceremony', hint: 'Sacred ritual' },
];

interface GameConfig {
  type: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  questionsPerGame: number;
  timePerQuestion: number;
  pointsCorrect: number;
  pointsTimeBonus: number;
  streakMultiplier: number;
  questions?: any[];
}

interface LeaderboardEntry {
  customerName: string;
  bestScore: number;
  totalPlays: number;
  rank: number;
}

interface GameResult {
  score: number;
  correctAnswers: number;
  maxStreak: number;
  dailyRank: number | null;
  rewards: Array<{ period: string; position: number; type: string; points?: number; badge?: string; description?: string }>;
}

type GameState = 'menu' | 'playing' | 'result' | 'wot_crush';

export function GameArena({ restaurantId, sessionToken, playerName }: { restaurantId: string; sessionToken: string; playerName?: string | null }) {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [activeGame, setActiveGame] = useState<GameConfig | null>(null);
  const [games, setGames] = useState<GameConfig[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeaderboardGame, setSelectedLeaderboardGame] = useState('wot_crush');

  // Game state
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [shuffledQuestions, setShuffledQuestions] = useState<any[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // Fetch games list
  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/restaurants/${restaurantId}/games`)
      .then(res => res.json())
      .then(data => {
        setGames(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [restaurantId]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async (gameType: string) => {
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/games/leaderboard?gameType=${gameType}&period=daily`);
      const data = await res.json();
      setLeaderboard(data.data || []);
    } catch {}
  }, [restaurantId]);

  useEffect(() => {
    fetchLeaderboard(selectedLeaderboardGame);
  }, [selectedLeaderboardGame, fetchLeaderboard]);

  // Timer
  useEffect(() => {
    if (gameState !== 'playing' || answered || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          handleAnswer(-1); // Time out = wrong answer
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, answered, timeLeft]);

  // Start a game
  const startGame = async (game: GameConfig) => {
    // Wot Crush is a self-contained match-3 game (no questions to fetch)
    if (game.type === 'wot_crush') {
      setActiveGame(game);
      setGameState('wot_crush');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/games?gameType=${game.type}`);
      const data = await res.json();
      const gameData = data.data;
      let questions = gameData.questions || [];

      // Fallback: if DB has no questions, use hardcoded ones so the game still works
      if (questions.length === 0) {
        if (game.type === 'trivia_royale') {
          questions = FALLBACK_TRIVIA;
          console.log('[GAME] Using fallback trivia questions (DB has none)');
        } else if (game.type === 'emoji_guess') {
          questions = FALLBACK_EMOJI;
          console.log('[GAME] Using fallback emoji questions (DB has none)');
        }
      }

      if (questions.length === 0) {
        toast.error('No questions available for this game yet. Try another game!');
        setLoading(false);
        return;
      }

      // Shuffle and limit questions
      const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, game.questionsPerGame === 999 ? 999 : game.questionsPerGame);

      setActiveGame({ ...game, questions: shuffled });
      setShuffledQuestions(shuffled);
      setQuestionIndex(0);
      setScore(0);
      setStreak(0);
      setMaxStreak(0);
      setCorrectCount(0);
      setAnswered(false);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setStartTime(Date.now());

      // Set timer for first question
      if (game.timePerQuestion > 0) {
        setTimeLeft(game.timePerQuestion);
      } else {
        // Speed mode: 60 seconds total
        setTimeLeft(60);
      }

      setGameState('playing');
    } catch (e) {
      toast.error('Failed to load game. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle answer
  const handleAnswer = (answerIndex: number) => {
    if (answered) return;
    setAnswered(true);
    setSelectedAnswer(answerIndex);

    const question = shuffledQuestions[questionIndex];
    const isCorrect = question.correctIndex !== undefined
      ? answerIndex === question.correctIndex
      : answerIndex === 0; // For emoji_guess, correctAnswer is first

    if (isCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setMaxStreak(Math.max(maxStreak, newStreak));
      setCorrectCount(c => c + 1);

      // Calculate points: base + time bonus + streak multiplier
      const basePoints = activeGame!.pointsCorrect;
      const timeBonus = activeGame!.timePerQuestion > 0
        ? Math.round((timeLeft / activeGame!.timePerQuestion) * activeGame!.pointsTimeBonus)
        : 0;
      const streakBonus = newStreak >= 3 ? Math.round(basePoints * (activeGame!.streakMultiplier - 1)) : 0;
      const totalPoints = basePoints + timeBonus + streakBonus;

      setScore(s => s + totalPoints);
    } else {
      setStreak(0);
    }

    setShowExplanation(true);
  };

  // Next question
  const nextQuestion = () => {
    if (questionIndex + 1 >= shuffledQuestions.length) {
      finishGame();
      return;
    }

    setQuestionIndex(i => i + 1);
    setAnswered(false);
    setSelectedAnswer(null);
    setShowExplanation(false);

    if (activeGame!.timePerQuestion > 0) {
      setTimeLeft(activeGame!.timePerQuestion);
    }
  };

  // Finish game and submit score
  const finishGame = async () => {
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/games/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          gameType: activeGame!.type,
          score,
          correctAnswers: correctCount,
          totalQuestions: shuffledQuestions.length,
          maxStreak,
          durationSeconds,
          customerName: playerName || 'Guest',
        }),
      });

      const data = await res.json();
      setResult(data.data);
      setGameState('result');
    } catch {
      setResult({ score, correctAnswers: correctCount, maxStreak, dailyRank: null, rewards: [] });
      setGameState('result');
    }
  };

  // Reset to menu
  const backToMenu = () => {
    setGameState('menu');
    setActiveGame(null);
    setResult(null);
    fetchLeaderboard(selectedLeaderboardGame);
  };

  // Handle Wot Crush game completion — submit score to leaderboard + show result
  const handleWotCrushComplete = async (result: { score: number; stars: number; level: number; completed: boolean }) => {
    if (!result.completed) return; // User failed level — let them retry from inside WotCrushGame

    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/games/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          gameType: 'wot_crush',
          score: result.score,
          correctAnswers: result.level, // use level reached as a proxy for "correct"
          totalQuestions: 20,
          maxStreak: result.stars,
          durationSeconds: 0,
          customerName: playerName || 'Guest',
        }),
      });

      const data = await res.json();
      setActiveGame({ ...activeGame!, type: 'wot_crush' });
      setResult(data.data);
      setGameState('result');
    } catch {
      setResult({ score: result.score, correctAnswers: result.level, maxStreak: result.stars, dailyRank: null, rewards: [] });
      setGameState('result');
    }
  };

  const currentQuestion = shuffledQuestions[questionIndex];

  // ====== RENDER ======

  if (loading && gameState === 'menu') {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading games...</div>;
  }

  // WOT CRUSH — full-screen match-3 game
  if (gameState === 'wot_crush') {
    return (
      <WotCrushGame
        onComplete={handleWotCrushComplete}
        onExit={backToMenu}
      />
    );
  }

  // GAME MENU
  if (gameState === 'menu') {
    return (
      <div className="space-y-4">
        {/* Game cards */}
        <div className="grid grid-cols-1 gap-3">
          {games.map(game => (
            <button
              key={game.type}
              onClick={() => startGame(game)}
              className="group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all hover:shadow-lg active:scale-[0.98]"
              style={{ borderColor: `${game.color}40`, background: `${game.color}08` }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: `${game.color}15` }}>
                  {game.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm" style={{ color: game.color }}>{game.name}</h4>
                  <p className="text-[11px] text-muted-foreground">{game.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-amber-500" />
              Today's Leaderboard
            </h4>
            <select
              value={selectedLeaderboardGame}
              onChange={e => setSelectedLeaderboardGame(e.target.value)}
              className="text-xs rounded-md border bg-background px-2 py-1"
            >
              <option value="wot_crush">Wot Crush</option>
              <option value="trivia_royale">Trivia Royale</option>
              <option value="speed_order">Speed Order</option>
              <option value="emoji_guess">Emoji Guess</option>
            </select>
          </div>

          {leaderboard.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No scores yet. Be the first to play!
            </p>
          ) : (
            <div className="space-y-1.5">
              {leaderboard.slice(0, 10).map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-lg p-2 ${
                    i === 0 ? 'bg-amber-50 dark:bg-amber-950/30' : i < 3 ? 'bg-muted/50' : ''
                  }`}
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-gray-400 text-white' : i === 2 ? 'bg-orange-600 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {i + 1}
                  </div>
                  <span className="text-sm font-medium flex-1 truncate">{entry.customerName}</span>
                  <span className="text-sm font-bold">{entry.bestScore}</span>
                  {i === 0 && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // GAME PLAYING
  if (gameState === 'playing' && activeGame && currentQuestion) {
    const question = currentQuestion as any;

    // Build the options array. For trivia questions, options come from the DB.
    // For emoji_guess questions, we need to construct options from the answer
    // + distractors pulled from the other questions' answers.
    let options: string[] = question.options || [];
    let correctIndex: number = question.correctIndex !== undefined ? question.correctIndex : 0;

    if (activeGame.type === 'emoji_guess' && question.answer && options.length === 0) {
      // Construct 4 options: the correct answer + 3 distractors from other questions
      const otherAnswers = shuffledQuestions
        .map((q: any) => q.answer)
        .filter((a: string, i: number) => a !== question.answer && i !== questionIndex)
      const distractors = [...new Set(otherAnswers)].sort(() => Math.random() - 0.5).slice(0, 3)
      options = [question.answer, ...distractors].sort(() => Math.random() - 0.5)
      correctIndex = options.indexOf(question.answer)
    }

    return (
      <div className="space-y-4">
        {/* Game HUD */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{activeGame.icon}</span>
            <span className="font-bold text-sm">{activeGame.name}</span>
          </div>
          <div className="flex items-center gap-3">
            {streak >= 3 && (
              <div className="flex items-center gap-1 text-orange-500">
                <Flame className="h-4 w-4" />
                <span className="text-xs font-bold">{streak}x</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-primary">
              <Star className="h-4 w-4 fill-primary" />
              <span className="font-bold text-sm">{score}</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {activeGame.questionsPerGame !== 999 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{questionIndex + 1}/{shuffledQuestions.length}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${((questionIndex) / shuffledQuestions.length) * 100}%`, background: activeGame.color }}
              />
            </div>
          </div>
        )}

        {/* Timer */}
        {activeGame.timePerQuestion > 0 && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${timeLeft <= 5 ? 'bg-red-500' : 'bg-primary'}`}
                style={{ width: `${(timeLeft / activeGame.timePerQuestion) * 100}%` }}
              />
            </div>
            <span className={`text-sm font-bold ${timeLeft <= 5 ? 'text-red-500' : ''}`}>{timeLeft}s</span>
          </div>
        )}

        {/* Question */}
        <motion.div
          key={questionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-xl border-2 p-4"
          style={{ borderColor: `${activeGame.color}30` }}
        >
          {/* Image for speed_order */}
          {question.imageUrl && (
            <div className="mb-3 flex justify-center">
              <img src={question.imageUrl} alt="Dish" className="h-32 w-32 rounded-xl object-cover" />
            </div>
          )}

          {/* Emoji for emoji_guess */}
          {question.emojis && (
            <div className="mb-3 text-center text-4xl">{question.emojis}</div>
          )}

          <p className="font-semibold text-sm mb-3">{question.question || 'What dish is this?'}</p>

          {/* Answer options */}
          <div className="grid grid-cols-1 gap-2">
            {options.map((opt: string, i: number) => {
              const isCorrect = i === correctIndex;
              const isSelected = i === selectedAnswer;
              let bgClass = 'bg-card hover:bg-accent border-input';

              if (answered) {
                if (isCorrect) bgClass = 'bg-green-50 dark:bg-green-950/30 border-green-500';
                else if (isSelected) bgClass = 'bg-red-50 dark:bg-red-950/30 border-red-500';
                else bgClass = 'bg-muted/50 border-transparent opacity-50';
              }

              return (
                <button
                  key={i}
                  disabled={answered}
                  onClick={() => handleAnswer(i)}
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left text-sm transition-all ${bgClass}`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {answered && isCorrect && <span className="text-green-600">✓</span>}
                  {answered && isSelected && !isCorrect && <span className="text-red-600">✗</span>}
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {showExplanation && question.explanation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-700 dark:text-blue-400"
            >
              💡 {question.explanation}
            </motion.div>
          )}
        </motion.div>

        {/* Next button */}
        {answered && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={nextQuestion}
            className="w-full rounded-xl py-3 font-bold text-sm text-white transition-all hover:opacity-90"
            style={{ background: activeGame.color }}
          >
            {questionIndex + 1 >= shuffledQuestions.length ? 'See Results →' : 'Next Question →'}
          </motion.button>
        )}
      </div>
    );
  }

  // GAME RESULT
  if (gameState === 'result' && result) {
    return (
      <div className="space-y-4">
        {/* Score display */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-6"
        >
          <div className="text-5xl mb-2">
            {result.dailyRank === 1 ? '🏆' : result.dailyRank && result.dailyRank <= 3 ? '🥉' : '🎮'}
          </div>
          <h3 className="text-2xl font-bold mb-1">{result.score} pts</h3>
          <p className="text-sm text-muted-foreground">
            {result.correctAnswers}/{activeGame?.questionsPerGame === 999 ? '∞' : shuffledQuestions.length} correct
            {result.maxStreak >= 3 && ` • 🔥 ${result.maxStreak}x best streak`}
          </p>
          {result.dailyRank && result.dailyRank <= 10 && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-950/40 px-4 py-1.5">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                Rank #{result.dailyRank} today!
              </span>
            </div>
          )}
        </motion.div>

        {/* Rewards */}
        {result.rewards.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="space-y-2"
          >
            {result.rewards.map((reward, i) => (
              <div key={i} className="rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="font-bold text-sm text-amber-700 dark:text-amber-400">
                      {reward.badge || `#${reward.position} ${reward.period}`}
                    </p>
                    {reward.points && (
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        +{reward.points} loyalty points earned!
                      </p>
                    )}
                    {reward.description && (
                      <p className="text-xs text-amber-600 dark:text-amber-500">{reward.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => startGame(activeGame!)}
            className="flex-1 rounded-xl border-2 py-3 font-bold text-sm transition-all hover:bg-accent"
            style={{ borderColor: `${activeGame?.color}40`, color: activeGame?.color }}
          >
            <RotateCcw className="h-4 w-4 inline mr-1" />
            Play Again
          </button>
          <button
            onClick={backToMenu}
            className="flex-1 rounded-xl bg-primary py-3 font-bold text-sm text-white transition-all hover:opacity-90"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  return null;
}
