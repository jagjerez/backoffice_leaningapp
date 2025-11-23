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
  originalPhrase: string,
  userAnswer: string,
  expectedAnswer: string,
  difficulty: string
): Promise<VerificationResult> {
  const prompt = `Eres un profesor de idiomas experto. Tu tarea es evaluar si la respuesta del estudiante es correcta comparándola con la respuesta esperada.

Frase original: "${originalPhrase}"
Respuesta esperada: "${expectedAnswer}"
Respuesta del estudiante: "${userAnswer}"
Nivel de dificultad: ${difficulty}

Evalúa la respuesta considerando:
1. Corrección gramatical
2. Significado y contexto
3. Variaciones aceptables (sinónimos, diferentes estructuras gramaticales válidas)
4. Errores menores vs errores graves

Responde SOLO con un JSON válido en este formato exacto:
{
  "isCorrect": true/false,
  "feedback": "Explicación detallada en español",
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

