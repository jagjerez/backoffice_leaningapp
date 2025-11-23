import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/middleware';
import { generatePhrasesWithAI } from '@/lib/phrase-generator';

async function handler(req: NextRequest & { user?: any }) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Método no permitido' },
      { status: 405 }
    );
  }

  try {
    const body = await req.json();
    const { nativeLanguageCode, learningLanguageCode, cefrLevel, category, quantity } = body;

    // Validation
    if (!nativeLanguageCode || !learningLanguageCode || !cefrLevel || !category || !quantity) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    if (!['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(cefrLevel)) {
      return NextResponse.json(
        { error: 'Nivel CEFR inválido. Debe ser A1, A2, B1, B2, C1 o C2' },
        { status: 400 }
      );
    }

    if (quantity < 1 || quantity > 50) {
      return NextResponse.json(
        { error: 'La cantidad debe estar entre 1 y 50' },
        { status: 400 }
      );
    }

    // Get language IDs
    const [nativeLang, learningLang] = await Promise.all([
      prisma.language.findUnique({ where: { code: nativeLanguageCode } }),
      prisma.language.findUnique({ where: { code: learningLanguageCode } }),
    ]);

    if (!nativeLang || !learningLang) {
      return NextResponse.json(
        { error: 'Idiomas no encontrados' },
        { status: 404 }
      );
    }

    // Generate phrases with AI
    const generatedPhrases = await generatePhrasesWithAI({
      nativeLanguageCode,
      learningLanguageCode,
      cefrLevel,
      category,
      quantity,
    });

    if (generatedPhrases.length === 0) {
      return NextResponse.json(
        { error: 'No se pudieron generar frases nuevas. Puede que ya existan todas las frases posibles para esta combinación.' },
        { status: 400 }
      );
    }

    // Map difficulty based on CEFR level
    const difficultyMap: Record<string, string> = {
      A1: 'BEGINNER',
      A2: 'BEGINNER',
      B1: 'INTERMEDIATE',
      B2: 'INTERMEDIATE',
      C1: 'ADVANCED',
      C2: 'ADVANCED',
    };

    const difficulty = difficultyMap[cefrLevel] || 'BEGINNER';

    // Check for duplicates before inserting
    const existingPhrases = await prisma.phrase.findMany({
      where: {
        nativeLanguageId: nativeLang.id,
        learningLanguageId: learningLang.id,
      },
      select: {
        nativeText: true,
      },
    });

    const existingTexts = new Set(
      existingPhrases.map((p) => p.nativeText.toLowerCase().trim())
    );

    // Filter out duplicates
    const uniquePhrases = generatedPhrases.filter((phrase) => {
      const normalizedText = phrase.nativeText.toLowerCase().trim();
      return !existingTexts.has(normalizedText);
    });

    if (uniquePhrases.length === 0) {
      return NextResponse.json(
        { error: 'Todas las frases generadas ya existen en la base de datos' },
        { status: 400 }
      );
    }

    // Insert phrases
    const createdPhrases = await Promise.all(
      uniquePhrases.map((phrase) =>
        prisma.phrase.create({
          data: {
            nativeLanguageId: nativeLang.id,
            learningLanguageId: learningLang.id,
            nativeText: phrase.nativeText.trim(),
            learningText: phrase.learningText.trim(),
            difficulty,
            cefrLevel,
            category: category.trim(),
          },
          include: {
            nativeLanguage: true,
            learningLanguage: true,
          },
        })
      )
    );

    return NextResponse.json({
      message: `Se generaron ${createdPhrases.length} frases exitosamente`,
      phrases: createdPhrases,
      requested: quantity,
      created: createdPhrases.length,
      duplicates: generatedPhrases.length - uniquePhrases.length,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Generate phrases error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al generar frases' },
      { status: 500 }
    );
  }
}

export const POST = requireAdmin(handler);

