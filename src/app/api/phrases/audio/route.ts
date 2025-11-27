import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { AuthenticatedRequest } from '@/lib/types';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function handler(req: AuthenticatedRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Método no permitido' },
      { status: 405 }
    );
  }

  try {
    const body = await req.json();
    const { phraseId, text } = body;

    if (!phraseId && !text) {
      return NextResponse.json(
        { error: 'phraseId o text es requerido' },
        { status: 400 }
      );
    }

    let textToSpeak = text;

    // If phraseId is provided, get the phrase
    if (phraseId) {
      const phrase = await prisma.phrase.findUnique({
        where: { id: phraseId },
        include: {
          learningLanguage: true,
        },
      });

      if (!phrase) {
        return NextResponse.json(
          { error: 'Frase no encontrada' },
          { status: 404 }
        );
      }

      textToSpeak = phrase.situationText;
    }

    if (!textToSpeak) {
      return NextResponse.json(
        { error: 'No hay texto para convertir a audio' },
        { status: 400 }
      );
    }

    // Map language codes to OpenAI TTS voices
    // OpenAI TTS supports multiple voices: alloy, echo, fable, onyx, nova, shimmer
    // The voice doesn't depend on language, but we can choose based on preference
    const voice = 'alloy'; // You can use: alloy, echo, fable, onyx, nova, shimmer

    // Generate audio using OpenAI TTS
    // Note: OpenAI TTS automatically detects the language from the input text
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice,
      input: textToSpeak,
    });

    // Convert response to base64
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    return NextResponse.json({
      audio: base64Audio,
      format: 'mp3',
      text: textToSpeak,
    });
  } catch (error) {
    console.error('Audio generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error al generar audio';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export const POST = requireAuth(handler);

