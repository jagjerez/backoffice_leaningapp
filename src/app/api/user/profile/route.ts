import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

async function handler(req: NextRequest & { user?: any }) {
  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: {
          id: true,
          email: true,
          role: true,
          nativeLanguage: true,
          learningLanguage: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: 'Usuario no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json(user);
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

      const updateData: any = {};
      if (nativeLanguage) updateData.nativeLanguage = nativeLanguage;
      if (learningLanguage) updateData.learningLanguage = learningLanguage;
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const user = await prisma.user.update({
        where: { id: req.user!.userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          role: true,
          nativeLanguage: true,
          learningLanguage: true,
          updatedAt: true,
        },
      });

      return NextResponse.json(user);
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

