import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { AuthenticatedRequest } from '@/lib/types';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function handler(req: AuthenticatedRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Método no permitido' },
      { status: 405 }
    );
  }

  try {
    const body = await req.json();
    const { phraseId, word, wordIndex } = body;

    if (!phraseId || !word) {
      return NextResponse.json(
        { error: 'phraseId y word son requeridos' },
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

    // Check if explanation already exists in database
    const existingExplanation = await prisma.wordExplanation.findUnique({
      where: {
        phraseId_word_nativeLanguageId_learningLanguageId: {
          phraseId: phrase.id,
          word: word.toLowerCase().trim(),
          nativeLanguageId: phrase.nativeLanguageId,
          learningLanguageId: phrase.learningLanguageId,
        },
      },
    });

    if (existingExplanation) {
      return NextResponse.json({
        word,
        translation: existingExplanation.translation,
        explanation: existingExplanation.explanation,
        examples: existingExplanation.examples ? JSON.parse(existingExplanation.examples) : [],
        grammarNotes: existingExplanation.grammarNotes,
        grammarExplanation: existingExplanation.grammarExplanation,
        cached: true,
      });
    }

    // Generate explanation with AI
    const prompt = `Eres un profesor de idiomas experto. Explica el significado de la palabra "${word}" en el contexto de esta frase:

Frase en idioma nativo (${phrase.nativeLanguage.name}): "${phrase.nativeText}"
Frase traducida (${phrase.learningLanguage.name}): "${phrase.learningText}"
Palabra seleccionada: "${word}"
Índice de la palabra en la frase: ${wordIndex !== undefined ? wordIndex : 'no especificado'}

Proporciona:
1. La traducción equivalente de "${word}" en ${phrase.learningLanguage.name}
2. Una explicación del significado de la palabra en el contexto de esta frase específica
3. Ejemplos de uso si es relevante
4. Notas gramaticales si aplican
5. Una explicación gramatical completa de POR QUÉ la frase traducida está estructurada así, explicando la gramática del idioma ${phrase.learningLanguage.name} (${phrase.learningLanguage.code}) en el contexto de esta frase completa. Explica reglas gramaticales, orden de palabras, conjugaciones, casos, etc.

Responde SOLO con un JSON válido en este formato exacto:
{
  "translation": "traducción de la palabra",
  "explanation": "explicación detallada en español del significado en contexto",
  "examples": ["ejemplo 1", "ejemplo 2"] o null,
  "grammarNotes": "notas gramaticales específicas de la palabra" o null,
  "grammarExplanation": "explicación gramatical completa de la frase en ${phrase.learningLanguage.name}, explicando por qué está estructurada así, reglas aplicadas, orden de palabras, etc."
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente que siempre responde con JSON válido, sin texto adicional.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const explanation = JSON.parse(content);

    // Save to database
    const savedExplanation = await prisma.wordExplanation.create({
      data: {
        phraseId: phrase.id,
        word: word.toLowerCase().trim(),
        nativeLanguageId: phrase.nativeLanguageId,
        learningLanguageId: phrase.learningLanguageId,
        translation: explanation.translation,
        explanation: explanation.explanation,
        examples: explanation.examples ? JSON.stringify(explanation.examples) : null,
        grammarNotes: explanation.grammarNotes || null,
        grammarExplanation: explanation.grammarExplanation || null,
      },
    });

    return NextResponse.json({
      word,
      translation: savedExplanation.translation,
      explanation: savedExplanation.explanation,
      examples: savedExplanation.examples ? JSON.parse(savedExplanation.examples) : [],
      grammarNotes: savedExplanation.grammarNotes,
      grammarExplanation: savedExplanation.grammarExplanation,
      cached: false,
    });
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
