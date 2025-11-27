import OpenAI from 'openai';
import { prisma } from './prisma';
import { WordExplanationData } from './phrase-generator';
import { ValidationResult } from './validate-word-explanations';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Normalize function - must match exactly how words are saved and validated
const normalizeWord = (word: string): string => {
  return word.replace(/[.,!?;:()]/g, '').trim().toLowerCase();
};

/**
 * Genera explicaciones para palabras faltantes
 */
export async function generateMissingExplanations(
  phraseId: string,
  situationText: string,
  expectedAnswer: string,
  situationExplanation: string | null,
  missingWords: string[],
  nativeLanguageId: string,
  learningLanguageId: string,
  nativeLanguageCode: string,
  learningLanguageCode: string
): Promise<WordExplanationData[]> {
  if (missingWords.length === 0) {
    return [];
  }

  // Normalize missing words for consistency
  const normalizedMissingWords = missingWords.map(w => normalizeWord(w));
  console.log(`🔄 Generating ${normalizedMissingWords.length} missing explanations...`);
  console.log(`   Missing words (normalized):`, normalizedMissingWords.join(', '));

  // Get language names
  const languages = await prisma.language.findMany({
    where: {
      id: { in: [nativeLanguageId, learningLanguageId] },
    },
  });

  const nativeLang = languages.find((l) => l.id === nativeLanguageId);
  const learningLang = languages.find((l) => l.id === learningLanguageId);

  const prompt = `Eres un profesor de idiomas experto. Genera explicaciones para las siguientes palabras del idioma ${learningLang?.name || learningLanguageCode} en el contexto de esta situación:

Situación: "${situationText}"
Respuesta esperada: "${expectedAnswer}"
${situationExplanation ? `Explicación: "${situationExplanation}"` : ''}
Idioma nativo del estudiante: ${nativeLang?.name || nativeLanguageCode}
Idioma a aprender: ${learningLang?.name || learningLanguageCode}

Palabras que necesitan explicación (ya normalizadas):
${normalizedMissingWords.map((w, i) => `${i + 1}. "${w}"`).join('\n')}

EJEMPLO DE EXPLICACIÓN DETALLADA:
Para la palabra "wie" en la frase "Wie würden Sie einen Kaffee bestellen?":
"'Wie' es una palabra interrogativa que introduce una pregunta sobre el modo o manera de realizar una acción. En esta oración funciona como el elemento que pregunta '¿cómo?' y está en la posición inicial porque en alemán las preguntas con palabras interrogativas siempre comienzan con la palabra interrogativa (V2 word order). Se relaciona sintácticamente con el verbo modal 'würden' para formar la pregunta completa sobre cómo se realizaría la acción de ordenar. Es esencial porque sin 'wie' la oración no sería una pregunta, sino una afirmación."

Para CADA palabra, proporciona:
- word: la palabra exacta (en minúsculas, sin puntuación)
- translation: traducción al idioma nativo (${nativeLang?.name || nativeLanguageCode})
- explanation: explicación MUY DETALLADA que incluya:
  * La función gramatical específica de la palabra en esta oración (sujeto, objeto directo/indirecto, verbo principal/auxiliar/modal, preposición, artículo definido/indefinido, pronombre, palabra interrogativa, etc.)
  * Por qué esta palabra está en esta posición específica en la oración (reglas de orden de palabras del idioma)
  * Qué papel cumple en la estructura gramatical de la frase completa
  * Cómo se relaciona sintácticamente con las otras palabras de la oración (qué palabras modifica, con qué palabras forma una unidad sintáctica)
  * Por qué es necesaria para el significado completo de la frase
  * Explicación en idioma nativo, muy específica y técnica pero comprensible
  IMPORTANTE: NO solo digas "es una traducción de X". Explica SU FUNCIÓN GRAMATICAL y SU PAPEL EN LA ORACIÓN.
- examples: array de 2-3 ejemplos, cada uno con:
  * learningText: ejemplo en ${learningLang?.name || learningLanguageCode}
  * nativeText: traducción del ejemplo en ${nativeLang?.name || nativeLanguageCode}

Responde SOLO con un JSON válido en este formato exacto:
{
  "wordExplanations": [
    {
      "word": "palabra",
      "translation": "traducción",
      "explanation": "explicación MUY DETALLADA que incluya: función gramatical específica (ej: 'verbo modal que expresa posibilidad', 'artículo definido en caso acusativo', 'preposición que indica dirección'), por qué está en esta posición (reglas de orden de palabras), qué papel cumple en la estructura gramatical completa, cómo se relaciona sintácticamente con otras palabras, y por qué es necesaria para el significado completo",
      "examples": [
        {
          "learningText": "ejemplo en idioma a aprender",
          "nativeText": "traducción del ejemplo"
        }
      ]
    }
  ]
}

IMPORTANTE: Genera explicaciones para TODAS las palabras listadas arriba.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Eres un asistente que siempre responde con JSON válido, sin texto adicional.',
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

    const result = JSON.parse(content) as {
      wordExplanations: WordExplanationData[];
    };

    if (!result.wordExplanations || !Array.isArray(result.wordExplanations)) {
      throw new Error('Invalid response format from OpenAI');
    }

    // Validate and normalize words (use same normalization function)
    const validExplanations = result.wordExplanations
      .filter((exp) => exp.word && exp.translation && exp.explanation)
      .map((exp) => ({
        ...exp,
        word: normalizeWord(exp.word),
      }))
      .filter((exp) => {
        // Only keep explanations for words that are actually missing
        const isMissing = normalizedMissingWords.includes(exp.word);
        if (!isMissing) {
          console.warn(`   ⚠️ Skipping "${exp.word}" - not in missing words list`);
        }
        return isMissing;
      });

    console.log(
      `✅ Generated ${validExplanations.length} explanations for missing words`
    );

    return validExplanations;
  } catch (error) {
    console.error('Error generating missing word explanations:', error);
    return [];
  }
}

/**
 * Corrige las explicaciones de palabras según la validación:
 * - Elimina explicaciones extra (palabras no en el texto)
 * - Genera explicaciones faltantes
 */
export async function fixWordExplanations(
  phraseId: string,
  situationText: string,
  expectedAnswer: string,
  situationExplanation: string | null,
  validation: ValidationResult,
  nativeLanguageId: string,
  learningLanguageId: string,
  nativeLanguageCode: string,
  learningLanguageCode: string
): Promise<{ added: number; removed: number }> {
  let added = 0;
  let removed = 0;

  // Remove extra explanations (words not in text)
  if (validation.extraWords.length > 0) {
    console.log(`🗑️ Removing ${validation.extraWords.length} extra explanations...`);
    
    for (const extraWord of validation.extraWords) {
      const normalizedExtraWord = normalizeWord(extraWord);
      try {
        const deleteResult = await prisma.wordExplanation.deleteMany({
          where: {
            phraseId,
            word: normalizedExtraWord,
            nativeLanguageId,
            learningLanguageId,
          },
        });
        if (deleteResult.count > 0) {
          removed += deleteResult.count;
          console.log(`   ✅ Removed ${deleteResult.count} explanation(s) for "${normalizedExtraWord}"`);
        } else {
          console.warn(`   ⚠️ No explanation found to remove for "${normalizedExtraWord}"`);
        }
      } catch (error) {
        console.error(`   ❌ Error removing explanation for "${normalizedExtraWord}":`, error);
      }
    }
  }

  // Generate missing explanations
  if (validation.missingWords.length > 0) {
    console.log(`➕ Generating ${validation.missingWords.length} missing explanations...`);
    
    const missingExplanations = await generateMissingExplanations(
      phraseId,
      situationText,
      expectedAnswer,
      situationExplanation,
      validation.missingWords,
      nativeLanguageId,
      learningLanguageId,
      nativeLanguageCode,
      learningLanguageCode
    );

    // Save missing explanations
    for (const wordExp of missingExplanations) {
      const normalizedWord = normalizeWord(wordExp.word);
      
      // Verify this word is actually missing (normalize the missing words for comparison)
      const missingWordsNormalized = validation.missingWords.map(w => normalizeWord(w));
      if (!missingWordsNormalized.includes(normalizedWord)) {
        console.warn(`⚠️ Skipping "${normalizedWord}" - not in missing words list`);
        console.warn(`   Missing words list:`, missingWordsNormalized.join(', '));
        continue;
      }

      try {
        await prisma.wordExplanation.create({
          data: {
            phraseId,
            word: normalizedWord,
            nativeLanguageId,
            learningLanguageId,
            translation: wordExp.translation,
            explanation: wordExp.explanation,
            examples: wordExp.examples && wordExp.examples.length > 0
              ? JSON.stringify(
                  wordExp.examples.map((ex) => ({
                    learningText: ex.learningText || '',
                    nativeText: ex.nativeText || '',
                  }))
                )
              : null,
          },
        });
        added++;
        console.log(`   ✅ Added explanation for "${normalizedWord}"`);
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code === 'P2002') {
          console.warn(`   ⚠️ Explanation for "${normalizedWord}" already exists`);
        } else {
          console.error(`   ❌ Error adding explanation for "${wordExp.word}":`, error);
        }
      }
    }
  }

  return { added, removed };
}

