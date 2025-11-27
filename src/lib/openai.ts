import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface VerificationResult {
  isCorrect: boolean;
  feedback: string;
  accuracyScore: number;
  wordsLearned?: string[];
  wordsForgotten?: string[];
}

export async function verifyPhraseAnswer(
  situationText: string,
  userAnswer: string,
  expectedAnswer: string,
  cefrLevel: string,
  difficulty: string
): Promise<VerificationResult> {
  const levelTips: Record<string, string> = {
    A1: 'Nivel básico: Evalúa si la respuesta usa vocabulario básico y estructuras simples. Da tips sobre palabras básicas y frases comunes.',
    A2: 'Nivel elemental: Evalúa si la respuesta muestra comprensión de estructuras básicas. Da tips sobre conectores simples y vocabulario cotidiano.',
    B1: 'Nivel intermedio: Evalúa si la respuesta muestra fluidez básica. Da tips sobre estructuras más complejas y vocabulario variado.',
    B2: 'Nivel intermedio-alto: Evalúa si la respuesta es natural y fluida. Da tips sobre matices y expresiones idiomáticas.',
    C1: 'Nivel avanzado: Evalúa precisión y naturalidad. Da tips sobre sutilezas y registro apropiado.',
    C2: 'Nivel maestría: Evalúa dominio completo del idioma. Da tips sobre perfeccionamiento y expresiones avanzadas.',
  };

  const prompt = `Eres un profesor de idiomas experto. Tu tarea es evaluar si la respuesta del estudiante es correcta comparándola con la respuesta esperada.

Situación/Pregunta: "${situationText}"
Respuesta esperada: "${expectedAnswer}"
Respuesta del estudiante: "${userAnswer}"
Nivel CEFR: ${cefrLevel}
Nivel de dificultad: ${difficulty}

${levelTips[cefrLevel] || levelTips.A1}

Evalúa la respuesta considerando:
1. Corrección gramatical apropiada para el nivel ${cefrLevel}
2. Significado y contexto de la situación
3. Variaciones aceptables (sinónimos, diferentes estructuras gramaticales válidas)
4. Errores menores vs errores graves según el nivel ${cefrLevel}
5. Naturalidad y fluidez apropiadas para el nivel

IMPORTANTE: El feedback debe ser:
- En español (idioma nativo del estudiante)
- Adaptado al nivel ${cefrLevel}
- Incluir tips específicos para mejorar según el nivel
- Ser constructivo y educativo
- Si hay errores, explicar por qué están mal y cómo corregirlos
- Si está bien, felicitar y sugerir formas de mejorar aún más

Responde SOLO con un JSON válido en este formato exacto:
{
  "isCorrect": true/false,
  "feedback": "Explicación detallada en español con tips específicos para el nivel ${cefrLevel}",
  "accuracyScore": 0-100,
  "wordsLearned": ["palabra1", "palabra2"] o null,
  "wordsForgotten": ["palabra1", "palabra2"] o null
}

Si la respuesta es correcta o muy cercana (variaciones aceptables), marca isCorrect como true.
El accuracyScore debe reflejar qué tan precisa es la respuesta (100 = perfecta, 80-99 = muy buena con pequeños errores, 50-79 = aceptable con errores, 0-49 = incorrecta).
wordsLearned debe contener palabras nuevas que el estudiante usó correctamente.
wordsForgotten debe contener palabras que el estudiante conocía pero usó incorrectamente.`;

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
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content) as VerificationResult;
    
    // Ensure accuracyScore is between 0-100
    result.accuracyScore = Math.max(0, Math.min(100, result.accuracyScore || 0));
    
    return result;
  } catch (error) {
    console.error('Error verifying phrase with OpenAI:', error);
    // Fallback response
    return {
      isCorrect: false,
      feedback: 'Error al verificar la respuesta. Por favor, intenta de nuevo.',
      accuracyScore: 0,
    };
  }
}

