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
    const { phraseId, word } = body;

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

    // Check if word explanation exists (it should have grammar explanation)
    const wordExplanation = await prisma.wordExplanation.findUnique({
      where: {
        phraseId_word_nativeLanguageId_learningLanguageId: {
          phraseId: phrase.id,
          word: word.toLowerCase().trim(),
          nativeLanguageId: phrase.nativeLanguageId,
          learningLanguageId: phrase.learningLanguageId,
        },
      },
    });

    if (wordExplanation && wordExplanation.grammarExplanation) {
      return NextResponse.json({
        word,
        grammarExplanation: wordExplanation.grammarExplanation,
        cached: true,
      });
    }

    // Generate grammar explanation with AI
    const prompt = `Eres un profesor de gramática experto en ${phrase.learningLanguage.name} (${phrase.learningLanguage.code}).

Analiza esta frase completa y explica la gramática del idioma ${phrase.learningLanguage.name}:

Frase en idioma nativo (${phrase.nativeLanguage.name}): "${phrase.nativeText}"
Frase traducida (${phrase.learningLanguage.name}): "${phrase.learningText}"
Palabra seleccionada: "${word}"

Explica:
1. La estructura gramatical completa de la frase en ${phrase.learningLanguage.name}
2. Por qué está estructurada así (reglas gramaticales aplicadas)
3. El orden de las palabras y por qué es así
4. Conjugaciones, casos, géneros, números si aplican
5. Cómo se relaciona la palabra "${word}" con el resto de la frase gramaticalmente
6. Reglas específicas del idioma ${phrase.learningLanguage.name} que se aplican aquí

Responde SOLO con un JSON válido en este formato exacto:
{
  "grammarExplanation": "explicación gramatical completa y detallada en español explicando la gramática de ${phrase.learningLanguage.name} en esta frase, por qué está estructurada así, reglas aplicadas, etc."
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

    const result = JSON.parse(content);

    // Update word explanation if it exists, otherwise create it
    if (wordExplanation) {
      await prisma.wordExplanation.update({
        where: { id: wordExplanation.id },
        data: {
          grammarExplanation: result.grammarExplanation,
        },
      });
    } else {
      // Create basic entry
      await prisma.wordExplanation.create({
        data: {
          phraseId: phrase.id,
          word: word.toLowerCase().trim(),
          nativeLanguageId: phrase.nativeLanguageId,
          learningLanguageId: phrase.learningLanguageId,
          translation: word,
          explanation: '',
          grammarExplanation: result.grammarExplanation,
        },
      });
    }

    return NextResponse.json({
      word,
      grammarExplanation: result.grammarExplanation,
      cached: false,
    });
  } catch (error) {
    console.error('Grammar explanation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error al obtener explicación gramatical';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export const POST = requireAuth(handler);

