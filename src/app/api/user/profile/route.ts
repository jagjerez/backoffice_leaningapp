import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { AuthenticatedRequest } from '@/lib/types';

async function handler(req: AuthenticatedRequest) {
  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: {
          nativeLanguage: true,
          learningLanguage: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: 'Usuario no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        id: user.id,
        email: user.email,
        role: user.role,
        nativeLanguage: user.nativeLanguage.code,
        learningLanguage: user.learningLanguage.code,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      console.error('Get profile error:', error);
      return NextResponse.json(
        { error: 'Error al obtener perfil' },
        { status: 500 }
      );
    }
  }

  if (req.method === 'PUT') {
    try {
      const body = await req.json();
      const { nativeLanguage, learningLanguage, password } = body;

      const updateData: { nativeLanguageId?: string; learningLanguageId?: string; password?: string } = {};
      
      // Convert language codes to IDs if provided
      if (nativeLanguage) {
        const lang = await prisma.language.findUnique({ where: { code: nativeLanguage } });
        if (!lang) {
          return NextResponse.json(
            { error: `Idioma nativo "${nativeLanguage}" no encontrado` },
            { status: 400 }
          );
        }
        updateData.nativeLanguageId = lang.id;
      }
      
      if (learningLanguage) {
        const lang = await prisma.language.findUnique({ where: { code: learningLanguage } });
        if (!lang) {
          return NextResponse.json(
            { error: `Idioma a aprender "${learningLanguage}" no encontrado` },
            { status: 400 }
          );
        }
        updateData.learningLanguageId = lang.id;
      }
      
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const user = await prisma.user.update({
        where: { id: req.user!.userId },
        data: updateData,
        include: {
          nativeLanguage: true,
          learningLanguage: true,
        },
      });

      return NextResponse.json({
        id: user.id,
        email: user.email,
        role: user.role,
        nativeLanguage: user.nativeLanguage.code,
        learningLanguage: user.learningLanguage.code,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      console.error('Update profile error:', error);
      return NextResponse.json(
        { error: 'Error al actualizar perfil' },
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

