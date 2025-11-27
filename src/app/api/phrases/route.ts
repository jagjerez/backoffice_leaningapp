import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { AuthenticatedRequest, PrismaWhereClause } from '@/lib/types';

async function handler(req: AuthenticatedRequest) {
  if (req.method === 'GET') {
    try {
      const { searchParams } = new URL(req.url);
      const nativeLanguage = searchParams.get('nativeLanguage');
      const learningLanguage = searchParams.get('learningLanguage');
      const difficulty = searchParams.get('difficulty');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '10');

      const where: PrismaWhereClause = {};
      
      // Convert language codes to IDs if provided
      if (nativeLanguage) {
        // Check if it's a GUID (UUID format) or a language code
        const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nativeLanguage);
        if (isGuid) {
          where.nativeLanguageId = nativeLanguage;
        } else {
          const lang = await prisma.language.findUnique({ where: { code: nativeLanguage } });
          if (lang) {
            where.nativeLanguageId = lang.id;
          }
        }
      }
      
      if (learningLanguage) {
        // Check if it's a GUID (UUID format) or a language code
        const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(learningLanguage);
        if (isGuid) {
          where.learningLanguageId = learningLanguage;
        } else {
          const lang = await prisma.language.findUnique({ where: { code: learningLanguage } });
          if (lang) {
            where.learningLanguageId = lang.id;
          }
        }
      }
      
      if (difficulty) {
        where.difficulty = difficulty;
      }

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
      const { nativeLanguageId, learningLanguageId, situationText, expectedAnswer, situationExplanation, difficulty, cefrLevel, category } = body;

      if (!nativeLanguageId || !learningLanguageId || !situationText || !expectedAnswer || !difficulty || !cefrLevel) {
        return NextResponse.json(
          { error: 'Todos los campos requeridos deben estar presentes' },
          { status: 400 }
        );
      }

      const phrase = await prisma.phrase.create({
        data: {
          nativeLanguageId,
          learningLanguageId,
          situationText,
          expectedAnswer,
          situationExplanation: situationExplanation || null,
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

