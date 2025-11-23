import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/middleware';
import { AuthenticatedRequest } from '@/lib/types';

interface UpdateUserData {
  email?: string;
  password?: string;
  role?: string;
  nativeLanguage?: string;
  learningLanguage?: string;
}

async function handler(req: AuthenticatedRequest) {
  const url = new URL(req.url);
  const userId = url.pathname.split('/').pop() || '';

  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
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
      console.error('Get user error:', error);
      return NextResponse.json(
        { error: 'Error al obtener usuario' },
        { status: 500 }
      );
    }
  }

  if (req.method === 'PUT') {
    try {
      const body = await req.json();
      const { email, password, role, nativeLanguage, learningLanguage } = body;

      const updateData: UpdateUserData = {};
      if (email) updateData.email = email;
      if (role) updateData.role = role;
      if (nativeLanguage) updateData.nativeLanguage = nativeLanguage;
      if (learningLanguage) updateData.learningLanguage = learningLanguage;
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const user = await prisma.user.update({
        where: { id: userId },
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
      console.error('Update user error:', error);
      return NextResponse.json(
        { error: 'Error al actualizar usuario' },
        { status: 500 }
      );
    }
  }

  if (req.method === 'DELETE') {
    try {
      await prisma.user.delete({
        where: { id: userId },
      });

      return NextResponse.json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
      console.error('Delete user error:', error);
      return NextResponse.json(
        { error: 'Error al eliminar usuario' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: 'Método no permitido' },
    { status: 405 }
  );
}

export const GET = requireAdmin(handler);
export const PUT = requireAdmin(handler);
export const DELETE = requireAdmin(handler);

