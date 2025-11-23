import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

async function handler(req: NextRequest & { user?: any }) {
  if (req.method === 'GET') {
    try {
      const { searchParams } = new URL(req.url);
      const nativeLanguage = searchParams.get('nativeLanguage');
      const learningLanguage = searchParams.get('learningLanguage');
      const difficulty = searchParams.get('difficulty');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '10');

      const where: any = {};
      if (nativeLanguage) where.nativeLanguageId = nativeLanguage;
      if (learningLanguage) where.learningLanguageId = learningLanguage;
      if (difficulty) where.difficulty = difficulty;

      const [phrases, total] = await Promise.all([
        prisma.phrase.findMany({
          where,
          include: {
            nativeLanguage: true,
            learningLanguage: true,
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.phrase.count({ where }),
      ]);

      return NextResponse.json({
        phrases,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Get phrases error:', error);
      return NextResponse.json(
        { error: 'Error al obtener frases' },
        { status: 500 }
      );
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { nativeLanguageId, learningLanguageId, nativeText, learningText, difficulty, cefrLevel, category } = body;

      if (!nativeLanguageId || !learningLanguageId || !nativeText || !learningText || !difficulty || !cefrLevel) {
        return NextResponse.json(
          { error: 'Todos los campos requeridos deben estar presentes' },
          { status: 400 }
        );
      }

      const phrase = await prisma.phrase.create({
        data: {
          nativeLanguageId,
          learningLanguageId,
          nativeText,
          learningText,
          difficulty,
          cefrLevel,
          category: category || null,
        },
        include: {
          nativeLanguage: true,
          learningLanguage: true,
        },
      });

      return NextResponse.json(phrase, { status: 201 });
    } catch (error) {
      console.error('Create phrase error:', error);
      return NextResponse.json(
        { error: 'Error al crear frase' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: 'Método no permitido' },
    { status: 405 }
  );
}

export const GET = requireAuth(handler);
export const POST = requireAuth(handler);

