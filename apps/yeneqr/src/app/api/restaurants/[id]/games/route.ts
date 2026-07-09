// ============================================================
// YeneQR Arena — Game API
// ============================================================
// GET /api/restaurants/[id]/games
// Returns available games + today's trivia questions + config
//
// POST /api/restaurants/[id]/games/submit
// Submit a game session score → updates leaderboard → triggers rewards
//
// GET /api/restaurants/[id]/games/leaderboard?gameType=trivia_royale&period=daily
// Returns leaderboard for a game type and period
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/api-auth'

const GAMES = [
  {
    type: 'wot_crush',
    name: 'Wot Crush',
    description: 'Match-3 puzzle with Ethiopian food tiles — 20 levels, power-ups, combos!',
    icon: '🫓',
    color: '#F97316',
    questionsPerGame: 20,
    timePerQuestion: 0,
    pointsCorrect: 50,
    pointsTimeBonus: 0,
    streakMultiplier: 1,
  },
  {
    type: 'trivia_royale',
    name: 'Trivia Royale',
    description: 'Test your knowledge of Ethiopian food & culture',
    icon: '🧠',
    color: '#8B5CF6',
    questionsPerGame: 10,
    timePerQuestion: 15,
    pointsCorrect: 100,
    pointsTimeBonus: 50,
    streakMultiplier: 2,
  },
  {
    type: 'speed_order',
    name: 'Speed Order Challenge',
    description: 'Match menu items to their names as fast as you can',
    icon: '⚡',
    color: '#F59E0B',
    questionsPerGame: 999, // unlimited — play for 60 seconds
    timePerQuestion: 0, // no per-question timer, overall 60s
    pointsCorrect: 50,
    pointsTimeBonus: 25,
    streakMultiplier: 3,
  },
  {
    type: 'emoji_guess',
    name: 'Emoji Food Guess',
    description: 'Guess the Ethiopian dish from emoji clues',
    icon: '🎯',
    color: '#EF4444',
    questionsPerGame: 10,
    timePerQuestion: 20,
    pointsCorrect: 150,
    pointsTimeBonus: 30,
    streakMultiplier: 2,
  },
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const { searchParams } = new URL(request.url)
    const gameType = searchParams.get('gameType')

    // Return available games
    if (!gameType) {
      return NextResponse.json({ data: GAMES })
    }

    // Return game config + today's questions
    const game = GAMES.find(g => g.type === gameType)
    if (!game) {
      return NextResponse.json({ error: 'Invalid game type' }, { status: 400 })
    }

    // Fetch trivia questions from EntertainmentContent (for trivia_royale)
    let questions: unknown[] = []
    if (gameType === 'trivia_royale') {
      const trivia = await db.entertainmentContent.findMany({
        where: {
          type: 'trivia_question',
          isActive: true,
          OR: [
            { restaurantId: null },
            { restaurantId }
          ]
        },
        select: { content: true },
        orderBy: { sortOrder: 'asc' },
        take: 50, // Pool of 50, client picks 10 random
      })

      questions = trivia.map(t => {
        try {
          const parsed = JSON.parse(t.content)
          return {
            question: parsed.question,
            options: parsed.options,
            correctIndex: parsed.correctIndex,
            explanation: parsed.explanation || '',
          }
        } catch {
          return null
        }
      }).filter(Boolean)
    }

    // For speed_order — fetch menu items with images
    if (gameType === 'speed_order') {
      const items = await db.menuItem.findMany({
        where: { restaurantId, isAvailable: true, image: { not: null } },
        select: { id: true, name: true, image: true, priceCents: true },
        take: 50,
      })
      questions = items.map(item => ({
        type: 'image_to_name',
        imageUrl: item.image,
        correctAnswer: item.name,
        // Generate 3 wrong options from other items
        options: items
          .filter(i => i.id !== item.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map(i => i.name),
      }))
    }

    // For emoji_guess — fetch game_config from EntertainmentContent
    if (gameType === 'emoji_guess') {
      const config = await db.entertainmentContent.findFirst({
        where: { type: 'game_config', title: 'Emoji Food Quiz', isActive: true },
      })
      if (config) {
        try {
          const parsed = JSON.parse(config.content)
          questions = parsed.questions || []
        } catch {}
      }
    }

    return NextResponse.json({
      data: {
        ...game,
        questions,
      }
    })
  } catch (error) {
    console.error('[GAMES_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 })
  }
}
