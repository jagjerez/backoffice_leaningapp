import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/middleware';
import { AuthenticatedRequest } from '@/lib/types';

async function handler(req: AuthenticatedRequest) {
  if (req.method === 'GET') {
    try {
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '10');

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          select: {
            id: true,
            email: true,
            role: true,
            nativeLanguage: true,
            learningLanguage: true,
            createdAt: true,
            updatedAt: true,
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count(),
      ]);

      return NextResponse.json({
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Get users error:', error);
      return NextResponse.json(
        { error: 'Error al obtener usuarios' },
        { status: 500 }
      );
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { email, password, role, nativeLanguage, learningLanguage } = body;

      if (!email || !password) {
        return NextResponse.json(
          { error: 'Email y contraseña son requeridos' },
          { status: 400 }
        );
      }

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'El usuario ya existe' },
          { status: 400 }
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: role || 'USER',
          nativeLanguage: nativeLanguage || 'es',
          learningLanguage: learningLanguage || 'en',
        },
        select: {
          id: true,
          email: true,
          role: true,
          nativeLanguage: true,
          learningLanguage: true,
          createdAt: true,
        },
      });

      return NextResponse.json(user, { status: 201 });
    } catch (error) {
      console.error('Create user error:', error);
      return NextResponse.json(
        { error: 'Error al crear usuario' },
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
export const POST = requireAdmin(handler);

