import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, nativeLanguage, learningLanguage } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'El usuario ya existe' },
        { status: 400 }
      );
    }

    // Convert language codes to IDs
    const nativeLangCode = nativeLanguage || 'es';
    const learningLangCode = learningLanguage || 'en';

    console.log('Register request:', {
      email,
      nativeLanguage: nativeLangCode,
      learningLanguage: learningLangCode,
    });

    const [nativeLang, learningLang] = await Promise.all([
      prisma.language.findUnique({ where: { code: nativeLangCode } }),
      prisma.language.findUnique({ where: { code: learningLangCode } }),
    ]);

    if (!nativeLang) {
      console.error(`Native language "${nativeLangCode}" not found`);
      return NextResponse.json(
        { 
          error: `Idioma nativo "${nativeLangCode}" no encontrado`,
          hint: 'Verifica que el código de idioma sea válido (es, en, de, fr, it, pt)'
        },
        { status: 400 }
      );
    }

    if (!learningLang) {
      console.error(`Learning language "${learningLangCode}" not found`);
      return NextResponse.json(
        { 
          error: `Idioma a aprender "${learningLangCode}" no encontrado`,
          hint: 'Verifica que el código de idioma sea válido (es, en, de, fr, it, pt)'
        },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (always USER role from app registration)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'USER',
        nativeLanguageId: nativeLang.id,
        learningLanguageId: learningLang.id,
      },
      include: {
        nativeLanguage: true,
        learningLanguage: true,
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        nativeLanguage: user.nativeLanguage.code,
        learningLanguage: user.learningLanguage.code,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Error en el servidor' },
      { status: 500 }
    );
  }
}

