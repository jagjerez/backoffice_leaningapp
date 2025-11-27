import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { AuthenticatedRequest } from '@/lib/types';

async function handler(req: AuthenticatedRequest) {
  const url = new URL(req.url);
  const phraseId = url.pathname.split('/').pop() || '';

  if (req.method === 'GET') {
    try {
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

      return NextResponse.json(phrase);
    } catch (error) {
      console.error('Get phrase error:', error);
      return NextResponse.json(
        { error: 'Error al obtener frase' },
        { status: 500 }
      );
    }
  }

  if (req.method === 'PUT') {
    try {
      const body = await req.json();
      const { 
        nativeLanguageId, 
        learningLanguageId, 
        situationText, 
        expectedAnswer, 
        situationExplanation,
        difficulty,
        cefrLevel,
        category
      } = body;

      if (!situationText || !expectedAnswer || !difficulty || !cefrLevel) {
        return NextResponse.json(
          { error: 'Los campos requeridos son: situationText, expectedAnswer, difficulty, cefrLevel' },
          { status: 400 }
        );
      }

      const phrase = await prisma.phrase.update({
        where: { id: phraseId },
        data: {
          ...(nativeLanguageId && { nativeLanguageId }),
          ...(learningLanguageId && { learningLanguageId }),
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

      return NextResponse.json(phrase);
    } catch (error) {
      console.error('Update phrase error:', error);
      return NextResponse.json(
        { error: 'Error al actualizar frase' },
        { status: 500 }
      );
    }
  }

  if (req.method === 'DELETE') {
    try {
      await prisma.phrase.delete({
        where: { id: phraseId },
      });

      return NextResponse.json({ message: 'Frase eliminada correctamente' });
    } catch (error) {
      console.error('Delete phrase error:', error);
      return NextResponse.json(
        { error: 'Error al eliminar frase' },
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
export const PUT = requireAuth(handler);
export const DELETE = requireAuth(handler);

