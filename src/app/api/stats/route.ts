import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

async function handler(req: NextRequest & { user?: any }) {
  try {
    const userId = req.user!.userId;

    // Get user's language preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { nativeLanguage: true, learningLanguage: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Get all progress for this user
    const progress = await prisma.userPhraseProgress.findMany({
      where: { userId },
      include: {
        phrase: {
          include: {
            nativeLanguage: true,
            learningLanguage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate statistics
    const totalAttempts = progress.length;
    const correctAttempts = progress.filter((p) => p.isCorrect).length;
    const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;

    // Get average accuracy score
    const scores = progress.map((p) => p.accuracyScore).filter((s) => s !== null) as number[];
    const averageScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    // Get learned phrases (phrases with at least one correct attempt)
    const learnedPhraseIds = new Set(
      progress.filter((p) => p.isCorrect).map((p) => p.phraseId)
    );
    const learnedPhrases = await prisma.phrase.findMany({
      where: {
        id: { in: Array.from(learnedPhraseIds) },
        nativeLanguage: { code: user.nativeLanguage },
        learningLanguage: { code: user.learningLanguage },
      },
    });

    // Get words learned and forgotten
    const allWordsLearned = new Set<string>();
    const allWordsForgotten = new Set<string>();

    progress.forEach((p) => {
      if (p.wordsLearned) {
        try {
          const words = JSON.parse(p.wordsLearned) as string[];
          words.forEach((w) => allWordsLearned.add(w));
        } catch (e) {
          // Ignore parse errors
        }
      }
      if (p.wordsForgotten) {
        try {
          const words = JSON.parse(p.wordsForgotten) as string[];
          words.forEach((w) => allWordsForgotten.add(w));
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    // Get phrases by difficulty
    const phrasesByDifficulty = await prisma.phrase.groupBy({
      by: ['difficulty'],
      where: {
        nativeLanguage: { code: user.nativeLanguage },
        learningLanguage: { code: user.learningLanguage },
      },
      _count: true,
    });

    return NextResponse.json({
      totalAttempts,
      correctAttempts,
      accuracy: Math.round(accuracy * 100) / 100,
      averageScore: Math.round(averageScore * 100) / 100,
      learnedPhrasesCount: learnedPhrases.length,
      wordsLearned: Array.from(allWordsLearned),
      wordsForgotten: Array.from(allWordsForgotten),
      phrasesByDifficulty: phrasesByDifficulty.map((p) => ({
        difficulty: p.difficulty,
        total: p._count,
      })),
      recentProgress: progress.slice(0, 10).map((p) => ({
        id: p.id,
        phrase: p.phrase.nativeText,
        userAnswer: p.userAnswer,
        isCorrect: p.isCorrect,
        accuracyScore: p.accuracyScore,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(handler);

