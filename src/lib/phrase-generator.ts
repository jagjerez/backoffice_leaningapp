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
  situationText: string; // Situación en idioma a aprender
  expectedAnswer: string; // Respuesta esperada en idioma a aprender
  situationExplanation?: string; // Explicación de la situación en idioma nativo
  wordExplanations?: WordExplanationData[]; // Explicaciones de palabras generadas
}

export interface WordExplanationData {
  word: string;
  translation: string;
  explanation: string;
  examples: Array<{ learningText: string; nativeText: string }>;
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
      situationText: true,
      expectedAnswer: true,
    },
  });

  const existingSituations = new Set(
    existingPhrases.map((p) => p.situationText.toLowerCase().trim())
  );

  // Get language names for better prompts
  const languages = await prisma.language.findMany({
    where: {
      code: { in: [request.nativeLanguageCode, request.learningLanguageCode] },
    },
  });

  const nativeLang = languages.find((l) => l.code === request.nativeLanguageCode);
  const learningLang = languages.find((l) => l.code === request.learningLanguageCode);

  const prompt = `Eres un experto en enseñanza de idiomas. Genera ${request.quantity} situaciones prácticas para aprender ${learningLang?.name || request.learningLanguageCode}.

Idioma nativo del estudiante: ${nativeLang?.name || request.nativeLanguageCode}
Idioma a aprender: ${learningLang?.name || request.learningLanguageCode}
Nivel CEFR: ${request.cefrLevel}
Categoría temática: ${request.category}

FORMATO REQUERIDO:
Cada situación debe tener:
1. situationText: Una pregunta o descripción de situación EN EL IDIOMA A APRENDER (${learningLang?.name || request.learningLanguageCode})
   Ejemplos:
   - "Wie würden Sie einen Kaffee bestellen?" (alemán)
   - "Was tun, wenn man jemanden abends trifft?" (alemán)
   - "How would you order a coffee?" (inglés)
   - "What would you do if you meet someone in the evening?" (inglés)

2. expectedAnswer: Una respuesta apropiada EN EL IDIOMA A APRENDER que sea adecuada para el nivel ${request.cefrLevel}
   Ejemplos:
   - "Hallo, ich möchte bitte einen Kaffee." (alemán, nivel A1-A2)
   - "Hallo, guten Tag, wie geht es Ihrer Familie?" (alemán, nivel A2-B1)

EJEMPLO COMPLETO DE wordExplanations:
Para la frase "Wie würden Sie einen Kaffee bestellen?" DEBES incluir explicaciones como estas:

- "Wie": 
  explanation: "'Wie' es una palabra interrogativa que introduce una pregunta sobre el modo o manera de realizar una acción. En esta oración funciona como el elemento que pregunta '¿cómo?' y está en la posición inicial porque en alemán las preguntas con palabras interrogativas siempre comienzan con la palabra interrogativa (V2 word order). Se relaciona sintácticamente con el verbo modal 'würden' para formar la pregunta completa sobre cómo se realizaría la acción de ordenar. Es esencial porque sin 'wie' la oración no sería una pregunta, sino una afirmación."

- "würden":
  explanation: "'Würden' es el verbo modal en forma condicional (Konjunktiv II) del verbo 'werden'. En esta oración funciona como el verbo auxiliar que expresa una acción hipotética o cortés ('¿cómo haría usted...?'). Está en segunda posición después de 'Wie' siguiendo la regla V2 del alemán. Se relaciona con el verbo principal 'bestellen' en infinitivo al final de la oración, formando una construcción modal. Es necesario porque expresa el modo condicional/cortés de la pregunta."

- "Sie":
  explanation: "'Sie' es el pronombre personal formal de tercera persona plural que se usa como tratamiento de cortesía en alemán (equivalente a 'usted' en español). En esta oración funciona como el sujeto de la oración y está en posición de sujeto después del verbo modal. Se relaciona con 'würden' como su sujeto y con 'bestellen' como el agente que realizaría la acción. Es esencial porque identifica a quién se dirige la pregunta y establece el nivel de formalidad."

Total: mínimo 6 explicaciones para esta frase corta, cada una explicando función gramatical, posición, relaciones sintácticas y necesidad en la oración.

3. situationExplanation: Una breve explicación EN EL IDIOMA NATIVO (${nativeLang?.name || request.nativeLanguageCode}) que describa el contexto de la situación

4. wordExplanations: DEBES generar explicaciones para TODAS las palabras significativas del situationText. 
   IMPORTANTE: Incluye explicaciones para:
   - TODOS los sustantivos (nombres)
   - TODOS los verbos (incluyendo verbos auxiliares y modales)
   - TODOS los adjetivos importantes
   - TODAS las palabras de pregunta (wie, was, wo, etc. en alemán; what, how, where, etc. en inglés)
   - TODAS las palabras gramaticalmente importantes (artículos, preposiciones clave, pronombres)
   - TODAS las preposiciones y partículas (zu, an, in, um, von, mit, für, etc. en alemán; to, in, on, at, etc. en inglés)
   - CRÍTICO: Incluye palabras cortas importantes como "zu" (preposición/partícula en alemán), "an" (preposición), "in" (preposición), etc.
   - Mínimo 5-8 explicaciones por frase, dependiendo de la longitud
   
   Para cada palabra genera:
   - word: la palabra exacta como aparece en el situationText (respeta mayúsculas/minúsculas originales)
   - translation: traducción al idioma nativo
   - explanation: explicación MUY DETALLADA que incluya:
     * La función gramatical específica de la palabra en esta oración (sujeto, objeto, verbo principal, auxiliar, preposición, artículo, etc.)
     * Por qué esta palabra está en esta posición específica en la oración
     * Qué papel cumple en la estructura gramatical de la frase
     * Cómo se relaciona con las otras palabras de la oración
     * Por qué es necesaria para el significado completo de la frase
     * Explicación en idioma nativo, muy específica y técnica pero comprensible
   - examples: array de 2-3 ejemplos, cada uno con:
     * learningText: ejemplo en idioma a aprender
     * nativeText: traducción del ejemplo en idioma nativo

REQUISITOS CRÍTICOS:
- Las situaciones deben ser apropiadas para el nivel ${request.cefrLevel}
- Deben estar relacionadas con la categoría "${request.category}"
- Las situaciones deben ser prácticas y útiles para la vida real
- Las respuestas esperadas deben ser apropiadas para el nivel ${request.cefrLevel}
- DEBES incluir explicaciones para TODAS las palabras importantes del situationText (mínimo 5-8 palabras)
- NO omitas palabras importantes solo porque sean comunes
- Los ejemplos deben ser claros y relevantes
- Cada explicación debe ser útil para el aprendizaje

SITUACIONES EXISTENTES (NO REPETIR):
${existingPhrases.slice(0, 20).map((p) => `- "${p.situationText}"`).join('\n')}

Responde SOLO con un JSON válido en este formato exacto:
{
  "phrases": [
    {
      "situationText": "Situación en idioma a aprender",
      "expectedAnswer": "Respuesta esperada en idioma a aprender",
      "situationExplanation": "Explicación en idioma nativo",
      "wordExplanations": [
        {
          "word": "palabra exacta del situationText",
          "translation": "traducción",
          "explanation": "explicación MUY DETALLADA que incluya: función gramatical específica (ej: 'verbo modal que expresa posibilidad', 'artículo definido en caso acusativo', 'preposición que indica dirección', 'palabra interrogativa que pregunta sobre modo'), por qué está en esta posición específica (reglas de orden de palabras del idioma), qué papel cumple en la estructura gramatical completa de la oración, cómo se relaciona sintácticamente con otras palabras (qué palabras modifica, con qué forma una unidad sintáctica), y por qué es necesaria para el significado completo. NO solo digas 'es la traducción de X', explica SU FUNCIÓN GRAMATICAL y SU PAPEL EN LA ORACIÓN.",
          "examples": [
            {
              "learningText": "ejemplo en idioma a aprender",
              "nativeText": "traducción del ejemplo"
            }
          ]
        }
      ]
    }
  ]
}

REGLAS CRÍTICAS PARA wordExplanations:
1. DEBES incluir explicaciones para TODAS las palabras significativas del situationText
2. Mínimo 5-8 explicaciones por frase (más si la frase es larga)
3. Incluye TODAS las palabras de pregunta (wie, was, wo, wann, etc. en alemán)
4. Incluye TODOS los verbos (incluyendo auxiliares y modales)
5. Incluye TODOS los sustantivos importantes
6. Incluye palabras gramaticales importantes (artículos definidos, preposiciones clave)
7. NO omitas palabras solo porque sean "comunes" - todas son importantes para el aprendizaje
8. El campo "word" debe ser EXACTAMENTE como aparece en el situationText (respeta mayúsculas/minúsculas)
9. CRÍTICO: Cada "explanation" debe ser MUY DETALLADA explicando:
   - La función gramatical específica (ej: "verbo modal que expresa posibilidad", "artículo definido en caso acusativo", "preposición que indica dirección")
   - Por qué está en esta posición en la oración
   - Qué papel cumple en la estructura gramatical completa
   - Cómo se relaciona sintácticamente con otras palabras
   - Por qué es necesaria para el significado completo
   - Ejemplo: En lugar de solo decir "traducción de 'wie'", explica: "'Wie' es una palabra interrogativa que introduce una pregunta sobre el modo o manera. En esta oración funciona como el elemento que pregunta '¿cómo?' y está en la posición inicial porque en alemán las preguntas con palabras interrogativas siempre comienzan con la palabra interrogativa. Se relaciona con el verbo modal 'würden' para formar la pregunta completa sobre cómo se realizaría una acción."

Genera exactamente ${request.quantity} situaciones nuevas que NO estén en la lista de situaciones existentes.
Cada situación DEBE tener al menos 5-8 explicaciones de palabras en wordExplanations.`;

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

    // Filter out duplicates and validate
    const uniquePhrases = result.phrases.filter((phrase) => {
      const normalizedText = phrase.situationText?.toLowerCase().trim();
      return normalizedText && !existingSituations.has(normalizedText);
    }).map((phrase) => {
      // Ensure all required fields are present
      if (!phrase.situationText || !phrase.expectedAnswer) {
        throw new Error('Invalid phrase format: missing required fields');
      }
      
      // Validate word explanations
      const wordExplanations = phrase.wordExplanations || [];
      
      if (wordExplanations.length === 0) {
        console.warn(`⚠️ No word explanations provided for phrase: "${phrase.situationText}"`);
      } else {
        console.log(`✅ Phrase "${phrase.situationText.substring(0, 50)}..." has ${wordExplanations.length} word explanations`);
        
        // Extract words from situationText to validate coverage
        const wordsInText = phrase.situationText
          .split(/\s+/)
          .map(w => w.replace(/[.,!?;:()]/g, '').toLowerCase().trim())
          .filter(w => w.length > 0);
        
        const explainedWords = new Set(
          wordExplanations.map(we => we.word.toLowerCase().trim())
        );
        
        const missingWords = wordsInText.filter(w => !explainedWords.has(w));
        
        if (missingWords.length > 0 && wordExplanations.length < 5) {
          console.warn(`⚠️ Some words may be missing explanations for phrase "${phrase.situationText}":`, missingWords.slice(0, 5));
        }
      }
      
      return {
        ...phrase,
        wordExplanations: wordExplanations,
      };
    });

    return uniquePhrases;
  } catch (error) {
    console.error('Error generating phrases with OpenAI:', error);
    throw new Error('Error al generar frases con IA');
  }
}

