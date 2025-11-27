import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { AuthenticatedRequest } from '@/lib/types';

async function handler(req: AuthenticatedRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Método no permitido' },
      { status: 405 }
    );
  }

  try {
    const body = await req.json();
    const { phraseId, word } = body;

    if (!phraseId || !word) {
      return NextResponse.json(
        { error: 'phraseId y word son requeridos' },
        { status: 400 }
      );
    }

    // Get phrase with minimal fields needed (optimized)
    const phrase = await prisma.phrase.findUnique({
      where: { id: phraseId },
      select: {
        id: true,
        nativeLanguageId: true,
        learningLanguageId: true,
      },
    });

    if (!phrase) {
      return NextResponse.json(
        { error: 'Frase no encontrada' },
        { status: 404 }
      );
    }

    // Normalize word for lookup (same as when saving)
    const normalizedWord = word.toLowerCase().trim();
    
    // Optimized: Use unique constraint directly (fastest lookup)
    const existingExplanation = await prisma.wordExplanation.findUnique({
      where: {
        phraseId_word_nativeLanguageId_learningLanguageId: {
          phraseId: phrase.id,
          word: normalizedWord,
          nativeLanguageId: phrase.nativeLanguageId,
          learningLanguageId: phrase.learningLanguageId,
        },
      },
      select: {
        word: true,
        translation: true,
        explanation: true,
        examples: true,
        grammarNotes: true,
        grammarExplanation: true,
      },
    });

    if (existingExplanation) {
      
      // Parse examples if they exist
      let parsedExamples: Array<{ learningText: string; nativeText: string }> = [];
      if (existingExplanation.examples) {
        try {
          const parsed = JSON.parse(existingExplanation.examples);
          parsedExamples = Array.isArray(parsed) ? parsed : [];
        } catch {
          parsedExamples = [];
        }
      }
      
      return NextResponse.json({
        word,
        translation: existingExplanation.translation,
        explanation: existingExplanation.explanation,
        examples: parsedExamples,
        grammarNotes: existingExplanation.grammarNotes,
        grammarExplanation: existingExplanation.grammarExplanation,
        cached: true,
      });
    }
    
    // Explanation not found
    return NextResponse.json(
      { 
        error: `Explicación no encontrada para la palabra "${word}". Las explicaciones deberían haberse generado al crear la frase.`,
        hint: 'Esta palabra puede no tener explicación disponible. Intenta con otra palabra de la frase.'
      },
      { status: 404 }
    );
  } catch (error) {
    console.error('Word explanation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error al obtener explicación de la palabra';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export const POST = requireAuth(handler);
