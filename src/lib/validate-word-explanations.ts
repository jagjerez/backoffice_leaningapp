import { prisma } from './prisma';
import { WordExplanationData } from './phrase-generator';

export interface ValidationResult {
  phraseId: string;
  situationText: string;
  totalWords: number;
  explainedWords: number;
  missingWords: string[];
  extraWords: string[];
  isValid: boolean;
  coverage: number; // Percentage
}

/**
 * Valida que todas las palabras importantes del situationText tengan explicaciones
 * y que no haya explicaciones para palabras que no están en el texto
 */
export async function validateWordExplanations(
  phraseId: string,
  situationText: string,
  wordExplanations: WordExplanationData[]
): Promise<ValidationResult> {
  // Normalize function - must match exactly how words are saved
  const normalizeWord = (word: string): string => {
    return word.replace(/[.,!?;:()]/g, '').trim().toLowerCase();
  };

  // Extract all words from situationText
  const wordsInText = situationText
    .split(/\s+/)
    .map((w) => {
      const clean = normalizeWord(w);
      return {
        original: w,
        clean: clean,
      };
    })
    .filter((w) => w.clean.length > 0);

  // Remove duplicates (same word appearing multiple times)
  const uniqueWords = Array.from(
    new Map(wordsInText.map((w) => [w.clean, w])).values()
  );

  // Filter out very common words that might not need explanations
  // (articles, very short words, etc.) - but keep important ones
  const importantWords = uniqueWords.filter((w) => {
    const word = w.clean;
    // Keep words longer than 2 characters
    if (word.length <= 2) {
      // But keep important short words (question words, pronouns, prepositions, particles, etc.)
      const importantShortWords = [
        // German question words
        'wie', 'was', 'wo', 'wann', 'warum', 'wer', 'wohin', 'woher',
        // English question words
        'what', 'how', 'where', 'when', 'why', 'who', 'which',
        // German pronouns
        'sie', 'er', 'es', 'ihr', 'ihm', 'ihn', 'uns', 'mir', 'dir',
        // English pronouns
        'he', 'she', 'it', 'we', 'they', 'you', 'me', 'us', 'him', 'her',
        // German articles
        'der', 'die', 'das', 'ein', 'eine', 'den', 'dem', 'des',
        // English articles
        'the', 'a', 'an',
        // German common verbs
        'ist', 'sind', 'hat', 'haben', 'bin', 'bist', 'seid',
        // English common verbs
        'is', 'are', 'has', 'have', 'am', 'was', 'were',
        // German conjunctions
        'und', 'oder', 'aber',
        // English conjunctions
        'and', 'or', 'but',
        // German prepositions and particles (CRITICAL for grammar)
        'zu', 'an', 'in', 'am', 'im', 'zum', 'zur', 'auf', 'um', 'von', 'mit', 'für', 'vor', 'nach', 'über', 'unter', 'durch', 'bei', 'seit', 'bis',
        // English prepositions
        'to', 'in', 'on', 'at', 'of', 'for', 'with', 'by', 'from', 'up', 'as', 'is',
      ];
      return importantShortWords.includes(word);
    }
    return true;
  });

  // Get explained words (normalized) - use same normalization
  const explainedWordsSet = new Set(
    wordExplanations.map((we) => normalizeWord(we.word))
  );

  // Debug logging
  console.log(`   🔍 Validation details:`);
  console.log(`      Words in text (all): ${wordsInText.length}`);
  console.log(`      Important words: ${importantWords.length}`);
  console.log(`      Important words list:`, importantWords.map(w => `"${w.clean}"`).join(', '));
  console.log(`      Explained words: ${wordExplanations.length}`);
  console.log(`      Explained words list:`, wordExplanations.map(we => `"${normalizeWord(we.word)}"`).join(', '));

  // Find missing words (words in text but not explained)
  const missingWords = importantWords
    .filter((w) => {
      const found = explainedWordsSet.has(w.clean);
      if (!found) {
        console.log(`      ❌ Missing: "${w.clean}" (original: "${w.original}")`);
      }
      return !found;
    })
    .map((w) => w.original);

  // Find extra words (explained but not in text or not important)
  const wordsInTextSet = new Set(importantWords.map((w) => w.clean));
  const extraWords = wordExplanations
    .filter((we) => {
      const normalized = normalizeWord(we.word);
      const isExtra = !wordsInTextSet.has(normalized);
      if (isExtra) {
        console.log(`      ⚠️ Extra: "${normalized}" (not in important words)`);
      }
      return isExtra;
    })
    .map((we) => we.word);

  // Calculate coverage
  const coverage =
    importantWords.length > 0
      ? ((importantWords.length - missingWords.length) / importantWords.length) *
        100
      : 100;

  // Consider valid if coverage is 100% and no extra words
  const isValid = coverage === 100 && extraWords.length === 0;

  console.log(`      Missing: ${missingWords.length}, Extra: ${extraWords.length}, Coverage: ${coverage.toFixed(1)}%, Valid: ${isValid}`);

  return {
    phraseId,
    situationText,
    totalWords: importantWords.length,
    explainedWords: wordExplanations.length,
    missingWords,
    extraWords,
    isValid,
    coverage: Math.round(coverage * 100) / 100,
  };
}

/**
 * Valida todas las explicaciones de palabras para una frase ya guardada en la BD
 */
export async function validatePhraseWordExplanations(
  phraseId: string
): Promise<ValidationResult> {
  const phrase = await prisma.phrase.findUnique({
    where: { id: phraseId },
    include: {
      wordExplanations: true,
    },
  });

  if (!phrase) {
    throw new Error('Phrase not found');
  }

  const wordExplanations: WordExplanationData[] = phrase.wordExplanations.map(
    (we) => ({
      word: we.word,
      translation: we.translation,
      explanation: we.explanation,
      examples: we.examples
        ? (JSON.parse(we.examples) as Array<{
            learningText: string;
            nativeText: string;
          }>)
        : [],
    })
  );

  return validateWordExplanations(
    phraseId,
    phrase.situationText,
    wordExplanations
  );
}

