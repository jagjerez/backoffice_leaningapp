import OpenAI from 'openai';
import { prisma } from './prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GeneratePhrasesRequest {
  nativeLanguageCode: string;
  learningLanguageCode: string;
  cefrLevel: string; // A1, A2, B1, B2, C1, C2
  category: string;
  quantity: number;
}

export interface GeneratedPhrase {
  nativeText: string;
  learningText: string;
}

export async function generatePhrasesWithAI(
  request: GeneratePhrasesRequest
): Promise<GeneratedPhrase[]> {
  // Get existing phrases to avoid duplicates
  const existingPhrases = await prisma.phrase.findMany({
    where: {
      nativeLanguage: { code: request.nativeLanguageCode },
      learningLanguage: { code: request.learningLanguageCode },
      cefrLevel: request.cefrLevel,
      ...(request.category && { category: request.category }),
    },
    select: {
      nativeText: true,
      learningText: true,
    },
  });

  const existingTexts = new Set(
    existingPhrases.map((p) => p.nativeText.toLowerCase().trim())
  );

  // Get language names for better prompts
  const languages = await prisma.language.findMany({
    where: {
      code: { in: [request.nativeLanguageCode, request.learningLanguageCode] },
    },
  });

  const nativeLang = languages.find((l) => l.code === request.nativeLanguageCode);
  const learningLang = languages.find((l) => l.code === request.learningLanguageCode);

  const prompt = `Eres un experto en enseñanza de idiomas. Genera ${request.quantity} frases para practicar traducción.

Idioma nativo: ${nativeLang?.name || request.nativeLanguageCode}
Idioma a aprender: ${learningLang?.name || request.learningLanguageCode}
Nivel CEFR: ${request.cefrLevel}
Categoría temática: ${request.category}

REQUISITOS:
- Las frases deben ser apropiadas para el nivel ${request.cefrLevel}
- Deben estar relacionadas con la categoría "${request.category}"
- Las frases deben ser útiles para el aprendizaje práctico
- Deben variar en estructura gramatical y vocabulario
- Las traducciones deben ser precisas y naturales

FRASES EXISTENTES (NO REPETIR):
${existingPhrases.slice(0, 20).map((p) => `- "${p.nativeText}"`).join('\n')}

Responde SOLO con un JSON válido en este formato exacto:
{
  "phrases": [
    {
      "nativeText": "Frase en idioma nativo",
      "learningText": "Traducción en idioma a aprender"
    }
  ]
}

Genera exactamente ${request.quantity} frases nuevas que NO estén en la lista de frases existentes.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente que siempre responde con JSON válido, sin texto adicional.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content) as { phrases: GeneratedPhrase[] };
    
    if (!result.phrases || !Array.isArray(result.phrases)) {
      throw new Error('Invalid response format from OpenAI');
    }

    // Filter out duplicates
    const uniquePhrases = result.phrases.filter((phrase) => {
      const normalizedText = phrase.nativeText.toLowerCase().trim();
      return !existingTexts.has(normalizedText);
    });

    return uniquePhrases;
  } catch (error) {
    console.error('Error generating phrases with OpenAI:', error);
    throw new Error('Error al generar frases con IA');
  }
}

