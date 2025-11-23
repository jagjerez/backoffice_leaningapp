import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function handler(req: NextRequest & { user?: any }) {
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

Responde SOLO con un JSON válido en este formato exacto:
{
  "translation": "traducción de la palabra",
  "explanation": "explicación detallada en español del significado en contexto",
  "examples": ["ejemplo 1", "ejemplo 2"] o null,
  "grammarNotes": "notas gramaticales" o null
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

    return NextResponse.json({
      word,
      translation: explanation.translation,
      explanation: explanation.explanation,
      examples: explanation.examples || [],
      grammarNotes: explanation.grammarNotes || null,
    });
  } catch (error: any) {
    console.error('Word explanation error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener explicación de la palabra' },
      { status: 500 }
    );
  }
}

export const POST = requireAuth(handler);

