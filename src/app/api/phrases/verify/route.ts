import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { AuthenticatedRequest } from '@/lib/types';
import { verifyPhraseAnswer } from '@/lib/openai';

async function handler(req: AuthenticatedRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Método no permitido' },
      { status: 405 }
    );
  }

  try {
    const body = await req.json();
    const { phraseId, userAnswer } = body;

    if (!phraseId || !userAnswer) {
      return NextResponse.json(
        { error: 'phraseId y userAnswer son requeridos' },
        { status: 400 }
      );
    }

    // Get phrase
    const phrase = await prisma.phrase.findUnique({
      where: { id: phraseId },
      include: {
        nativeLanguage: true,
        learningLanguage: true,
      },
    });

    if (!phrase) {
      return NextResponse.json(
        { error: 'Frase no encontrada' },
        { status: 404 }
      );
    }

    // Verify with AI
    const verification = await verifyPhraseAnswer(
      phrase.nativeText,
      userAnswer,
      phrase.learningText,
      phrase.difficulty
    );

    // Save progress
    const progress = await prisma.userPhraseProgress.create({
      data: {
        userId: req.user!.userId,
        phraseId: phrase.id,
        userAnswer,
        aiFeedback: verification.feedback,
        isCorrect: verification.isCorrect,
        accuracyScore: verification.accuracyScore,
        wordsLearned: verification.wordsLearned ? JSON.stringify(verification.wordsLearned) : null,
        wordsForgotten: verification.wordsForgotten ? JSON.stringify(verification.wordsForgotten) : null,
      },
    });

    return NextResponse.json({
      ...verification,
      progressId: progress.id,
    });
  } catch (error) {
    console.error('Verify phrase error:', error);
    return NextResponse.json(
      { error: 'Error al verificar frase' },
      { status: 500 }
    );
  }
}

export const POST = requireAuth(handler);

