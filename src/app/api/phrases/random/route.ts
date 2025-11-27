import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { AuthenticatedRequest, PrismaWhereClause } from '@/lib/types';

async function handler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const nativeLanguage = searchParams.get('nativeLanguage');
    const learningLanguage = searchParams.get('learningLanguage');
    const difficulty = searchParams.get('difficulty');

    const where: PrismaWhereClause = {};
    
    // Optimized: Get user with minimal fields if needed
    let userNativeLangId: string | undefined;
    let userLearningLangId: string | undefined;
    
    if (!nativeLanguage || !learningLanguage) {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: {
          nativeLanguageId: true,
          learningLanguageId: true,
        },
      });
      
      if (user) {
        userNativeLangId = user.nativeLanguageId;
        userLearningLangId = user.learningLanguageId;
      }
    }
    
    // Use provided language codes or user's language IDs
    if (nativeLanguage) {
      // Convert code to ID (cached lookup)
      const lang = await prisma.language.findUnique({ 
        where: { code: nativeLanguage },
        select: { id: true },
      });
      if (lang) {
        where.nativeLanguageId = lang.id;
      } else {
        return NextResponse.json(
          { 
            error: `Idioma nativo "${nativeLanguage}" no encontrado`,
            hint: 'Verifica que el código de idioma sea válido (es, en, de, fr, etc.)'
          },
          { status: 400 }
        );
      }
    } else if (userNativeLangId) {
      where.nativeLanguageId = userNativeLangId;
    }
    
    if (learningLanguage) {
      // Convert code to ID (cached lookup)
      const lang = await prisma.language.findUnique({ 
        where: { code: learningLanguage },
        select: { id: true },
      });
      if (lang) {
        where.learningLanguageId = lang.id;
      } else {
        return NextResponse.json(
          { 
            error: `Idioma a aprender "${learningLanguage}" no encontrado`,
            hint: 'Verifica que el código de idioma sea válido (es, en, de, fr, etc.)'
          },
          { status: 400 }
        );
      }
    } else if (userLearningLangId) {
      where.learningLanguageId = userLearningLangId;
    }
    
    if (difficulty) {
      where.difficulty = difficulty;
    }

    // Ensure we have at least language filters
    if (!where.nativeLanguageId || !where.learningLanguageId) {
      return NextResponse.json(
        { 
          error: 'Se requieren idioma nativo e idioma a aprender',
          hint: 'Configura tus idiomas en el perfil o proporciona los parámetros nativeLanguage y learningLanguage'
        },
        { status: 400 }
      );
    }

    // Optimized: Get count directly with database filter
    const totalCount = await prisma.phrase.count({
      where: {
        ...where,
        situationText: { not: '' },
        expectedAnswer: { not: '' },
      },
    });

    if (totalCount === 0) {
      return NextResponse.json(
        { 
          error: 'No hay frases disponibles con el formato correcto',
          hint: 'Por favor, crea nuevas frases usando el formulario de generación con IA o el formulario manual'
        },
        { status: 404 }
      );
    }

    // Optimized: Get random phrase directly from database using OFFSET
    const randomOffset = Math.floor(Math.random() * totalCount);
    
    const phrases = await prisma.phrase.findMany({
      where: {
        ...where,
        situationText: { not: '' },
        expectedAnswer: { not: '' },
      },
      select: {
        id: true,
      },
      skip: randomOffset,
      take: 1,
    });

    if (phrases.length === 0) {
      return NextResponse.json(
        { error: 'No se pudo obtener frase aleatoria' },
        { status: 500 }
      );
    }

    const selectedPhraseId = phrases[0].id;

    // Get full phrase data with languages
    const phrase = await prisma.phrase.findUnique({
      where: { id: selectedPhraseId },
      include: {
        nativeLanguage: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        learningLanguage: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!phrase) {
      return NextResponse.json(
        { error: 'No se pudo obtener frase aleatoria' },
        { status: 500 }
      );
    }

    return NextResponse.json(phrase);
  } catch (error) {
    console.error('Get random phrase error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { errorMessage, errorStack });
    
    // Check if it's a Prisma schema error
    if (errorMessage.includes('Unknown arg') || errorMessage.includes('does not exist')) {
      return NextResponse.json(
        { 
          error: 'Error de esquema de base de datos',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          hint: 'El cliente de Prisma necesita regenerarse. Detén el servidor, ejecuta "npm run db:generate" y reinicia el servidor.'
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Error al obtener frase aleatoria',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(handler);

