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

    // Get user's language preferences if not provided
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { nativeLanguage: true, learningLanguage: true },
    });

    const where: PrismaWhereClause = {};
    
    if (nativeLanguage) {
      const lang = await prisma.language.findUnique({ where: { code: nativeLanguage } });
      if (lang) where.nativeLanguageId = lang.id;
    } else if (user) {
      const lang = await prisma.language.findUnique({ where: { code: user.nativeLanguage } });
      if (lang) where.nativeLanguageId = lang.id;
    }
    
    if (learningLanguage) {
      const lang = await prisma.language.findUnique({ where: { code: learningLanguage } });
      if (lang) where.learningLanguageId = lang.id;
    } else if (user) {
      const lang = await prisma.language.findUnique({ where: { code: user.learningLanguage } });
      if (lang) where.learningLanguageId = lang.id;
    }
    
    if (difficulty) {
      where.difficulty = difficulty;
    }

    // Get count
    const count = await prisma.phrase.count({ where });
    
    if (count === 0) {
      return NextResponse.json(
        { error: 'No hay frases disponibles' },
        { status: 404 }
      );
    }

    // Get random phrase
    const randomSkip = Math.floor(Math.random() * count);
    const phrase = await prisma.phrase.findFirst({
      where,
      include: {
        nativeLanguage: true,
        learningLanguage: true,
      },
      skip: randomSkip,
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
    return NextResponse.json(
      { error: 'Error al obtener frase aleatoria' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(handler);

