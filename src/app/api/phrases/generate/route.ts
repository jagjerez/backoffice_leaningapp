import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/middleware';
import { AuthenticatedRequest } from '@/lib/types';
import { generatePhrasesWithAI } from '@/lib/phrase-generator';
import { validateWordExplanations, ValidationResult } from '@/lib/validate-word-explanations';
import { fixWordExplanations } from '@/lib/fix-word-explanations';

interface CreatedPhraseWithValidation {
  id: string;
  situationText: string;
  expectedAnswer: string;
  situationExplanation: string | null;
  difficulty: string;
  cefrLevel: string;
  category: string | null;
  nativeLanguage: { id: string; code: string; name: string };
  learningLanguage: { id: string; code: string; name: string };
  createdAt: Date;
  updatedAt: Date;
  validation: ValidationResult;
}

async function handler(req: AuthenticatedRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Método no permitido' },
      { status: 405 }
    );
  }

  try {
    const body = await req.json();
    const { nativeLanguageCode, learningLanguageCode, cefrLevel, category, quantity } = body;

    // Validation
    if (!nativeLanguageCode || !learningLanguageCode || !cefrLevel || !category || !quantity) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    if (!['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(cefrLevel)) {
      return NextResponse.json(
        { error: 'Nivel CEFR inválido. Debe ser A1, A2, B1, B2, C1 o C2' },
        { status: 400 }
      );
    }

    if (quantity < 1 || quantity > 50) {
      return NextResponse.json(
        { error: 'La cantidad debe estar entre 1 y 50' },
        { status: 400 }
      );
    }

    // Get language IDs
    const [nativeLang, learningLang] = await Promise.all([
      prisma.language.findUnique({ where: { code: nativeLanguageCode } }),
      prisma.language.findUnique({ where: { code: learningLanguageCode } }),
    ]);

    if (!nativeLang || !learningLang) {
      return NextResponse.json(
        { error: 'Idiomas no encontrados' },
        { status: 404 }
      );
    }

    // Generate phrases with AI
    const generatedPhrases = await generatePhrasesWithAI({
      nativeLanguageCode,
      learningLanguageCode,
      cefrLevel,
      category,
      quantity,
    });

    if (generatedPhrases.length === 0) {
      return NextResponse.json(
        { error: 'No se pudieron generar frases nuevas. Puede que ya existan todas las frases posibles para esta combinación.' },
        { status: 400 }
      );
    }

    // Map difficulty based on CEFR level
    const difficultyMap: Record<string, string> = {
      A1: 'BEGINNER',
      A2: 'BEGINNER',
      B1: 'INTERMEDIATE',
      B2: 'INTERMEDIATE',
      C1: 'ADVANCED',
      C2: 'ADVANCED',
    };

    const difficulty = difficultyMap[cefrLevel] || 'BEGINNER';

    // Check for duplicates before inserting
    const existingPhrases = await prisma.phrase.findMany({
      where: {
        nativeLanguageId: nativeLang.id,
        learningLanguageId: learningLang.id,
      },
      select: {
        situationText: true,
      },
    });

    const existingSituations = new Set(
      existingPhrases.map((p) => p.situationText.toLowerCase().trim())
    );

    // Filter out duplicates
    const uniquePhrases = generatedPhrases.filter((phrase) => {
      const normalizedText = phrase.situationText?.toLowerCase().trim();
      return normalizedText && !existingSituations.has(normalizedText);
    });

    if (uniquePhrases.length === 0) {
      return NextResponse.json(
        { error: 'Todas las situaciones generadas ya existen en la base de datos' },
        { status: 400 }
      );
    }

    // Insert phrases with word explanations
    const createdPhrases = await Promise.all(
      uniquePhrases.map(async (phrase) => {
        // Create phrase
        const createdPhrase = await prisma.phrase.create({
          data: {
            nativeLanguageId: nativeLang.id,
            learningLanguageId: learningLang.id,
            situationText: phrase.situationText.trim(),
            expectedAnswer: phrase.expectedAnswer.trim(),
            situationExplanation: phrase.situationExplanation?.trim() || null,
            difficulty,
            cefrLevel,
            category: category.trim(),
          },
          include: {
            nativeLanguage: true,
            learningLanguage: true,
          },
        });

        // Create word explanations if provided
        if (phrase.wordExplanations && phrase.wordExplanations.length > 0) {
          console.log(`📝 Processing ${phrase.wordExplanations.length} word explanations for phrase ${createdPhrase.id}`);
          console.log(`📝 Words to save:`, phrase.wordExplanations.map(w => w.word).join(', '));
          
          const savedWords = await Promise.all(
            phrase.wordExplanations.map((wordExp) => {
              const normalizedWord = wordExp.word.toLowerCase().trim();
              
              // Validate word explanation data
              if (!wordExp.word || !wordExp.translation || !wordExp.explanation) {
                console.warn(`⚠️ Skipping incomplete word explanation:`, wordExp);
                return null;
              }
              
              return prisma.wordExplanation.create({
                data: {
                  phraseId: createdPhrase.id,
                  word: normalizedWord,
                  nativeLanguageId: nativeLang.id,
                  learningLanguageId: learningLang.id,
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
              }).then(() => {
                console.log(`✅ Saved word explanation for "${normalizedWord}" in phrase ${createdPhrase.id}`);
                return normalizedWord;
              }).catch((err) => {
                // Check if it's a duplicate error (unique constraint violation)
                if (err.code === 'P2002') {
                  console.warn(`⚠️ Word explanation for "${normalizedWord}" already exists, skipping`);
                  return normalizedWord; // Return as success since it already exists
                }
                // Log but don't fail if word explanation fails
                console.error(`❌ Error creating word explanation for "${wordExp.word}":`, err);
                return null;
              });
            })
          );
          
          const successfulWords = savedWords.filter((w) => w !== null);
          console.log(`💾 Saved ${successfulWords.length}/${phrase.wordExplanations.length} word explanations for phrase ${createdPhrase.id}`);
          
          if (successfulWords.length < phrase.wordExplanations.length) {
            console.warn(`⚠️ Some word explanations failed to save for phrase ${createdPhrase.id}`);
          }
        } else {
          console.warn(`⚠️ No word explanations provided for phrase ${createdPhrase.id} - situationText: "${phrase.situationText}"`);
        }

        // Validate word explanations after saving
        const savedWordExplanations = await prisma.wordExplanation.findMany({
          where: {
            phraseId: createdPhrase.id,
            nativeLanguageId: nativeLang.id,
            learningLanguageId: learningLang.id,
          },
        });

        let validation = await validateWordExplanations(
          createdPhrase.id,
          phrase.situationText,
          savedWordExplanations.map((we) => ({
            word: we.word,
            translation: we.translation,
            explanation: we.explanation,
            examples: we.examples
              ? (JSON.parse(we.examples) as Array<{ learningText: string; nativeText: string }>)
              : [],
          }))
        );

        console.log(`\n📊 Validation for phrase "${phrase.situationText.substring(0, 50)}...":`);
        console.log(`   Total important words: ${validation.totalWords}`);
        console.log(`   Explained words: ${validation.explainedWords}`);
        console.log(`   Coverage: ${validation.coverage}%`);
        
        if (validation.missingWords.length > 0) {
          console.log(`   ⚠️ Missing explanations for: ${validation.missingWords.join(', ')}`);
        }
        
        if (validation.extraWords.length > 0) {
          console.log(`   ⚠️ Extra explanations (not in text): ${validation.extraWords.join(', ')}`);
        }
        
        if (validation.isValid) {
          console.log(`   ✅ Validation passed`);
        } else {
          console.log(`   ❌ Validation failed - Coverage: ${validation.coverage}%, Extra: ${validation.extraWords.length}`);
          console.log(`   🔧 Auto-fixing validation issues...`);
          
          // Auto-fix: remove extra explanations and generate missing ones
          const fixResult = await fixWordExplanations(
            createdPhrase.id,
            phrase.situationText,
            phrase.expectedAnswer,
            phrase.situationExplanation || null,
            validation,
            nativeLang.id,
            learningLang.id,
            nativeLanguageCode,
            learningLanguageCode
          );
          
          console.log(`   ✅ Fixed: Added ${fixResult.added} explanations, Removed ${fixResult.removed} extra explanations`);
          
          // Re-validate after fixing (up to 3 attempts to ensure 100% coverage)
          let attempts = 0;
          const maxAttempts = 3;
          
          while (attempts < maxAttempts && !validation.isValid) {
            attempts++;
            const updatedWordExplanations = await prisma.wordExplanation.findMany({
              where: {
                phraseId: createdPhrase.id,
                nativeLanguageId: nativeLang.id,
                learningLanguageId: learningLang.id,
              },
            });
            
            validation = await validateWordExplanations(
              createdPhrase.id,
              phrase.situationText,
              updatedWordExplanations.map((we) => ({
                word: we.word,
                translation: we.translation,
                explanation: we.explanation,
                examples: we.examples
                  ? (JSON.parse(we.examples) as Array<{ learningText: string; nativeText: string }>)
                  : [],
              }))
            );
            
            console.log(`   📊 Re-validation attempt ${attempts}: Coverage: ${validation.coverage}%, Valid: ${validation.isValid}`);
            
            if (!validation.isValid && attempts < maxAttempts) {
              console.log(`   🔧 Still not valid, fixing again...`);
              const fixResult2 = await fixWordExplanations(
                createdPhrase.id,
                phrase.situationText,
                phrase.expectedAnswer,
                phrase.situationExplanation || null,
                validation,
                nativeLang.id,
                learningLang.id,
                nativeLanguageCode,
                learningLanguageCode
              );
              console.log(`   ✅ Fixed again: Added ${fixResult2.added} explanations, Removed ${fixResult2.removed} extra explanations`);
            }
          }
          
          if (!validation.isValid) {
            console.warn(`   ⚠️ After ${maxAttempts} attempts, validation still failed. Coverage: ${validation.coverage}%`);
          }
        }

        return {
          ...createdPhrase,
          validation,
        };
      })
    );

    // Summary report
    const typedCreatedPhrases = createdPhrases as CreatedPhraseWithValidation[];
    const validPhrases = typedCreatedPhrases.filter((p) => p.validation?.isValid).length;
    const invalidPhrases = typedCreatedPhrases.length - validPhrases;
    const totalCoverage = typedCreatedPhrases.reduce((sum, p) => sum + (p.validation?.coverage || 0), 0) / typedCreatedPhrases.length;
    
    console.log(`\n📈 GENERATION SUMMARY:`);
    console.log(`   Total phrases created: ${typedCreatedPhrases.length}`);
    console.log(`   Valid phrases: ${validPhrases}`);
    console.log(`   Invalid phrases: ${invalidPhrases}`);
    console.log(`   Average coverage: ${Math.round(totalCoverage * 100) / 100}%`);
    
    if (invalidPhrases > 0) {
      console.log(`\n⚠️ Phrases with validation issues:`);
      typedCreatedPhrases.forEach((p) => {
        if (!p.validation?.isValid) {
          console.log(`   - "${p.situationText.substring(0, 60)}..."`);
          console.log(`     Coverage: ${p.validation?.coverage}%, Missing: ${p.validation?.missingWords.length}, Extra: ${p.validation?.extraWords.length}`);
        }
      });
    }

    // Prepare response with validation info (remove validation from phrase objects)
    const phrasesResponse = typedCreatedPhrases.map((p) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { validation: _validation, ...phraseData } = p;
      return phraseData;
    });

    return NextResponse.json({
      message: `Se generaron ${typedCreatedPhrases.length} frases exitosamente`,
      phrases: phrasesResponse,
      requested: quantity,
      created: typedCreatedPhrases.length,
      duplicates: generatedPhrases.length - uniquePhrases.length,
      validation: {
        validPhrases: validPhrases,
        invalidPhrases: invalidPhrases,
        averageCoverage: Math.round(totalCoverage * 100) / 100,
        details: typedCreatedPhrases.map((p) => ({
          phraseId: p.id,
          situationText: p.situationText.substring(0, 60),
          isValid: p.validation?.isValid,
          coverage: p.validation?.coverage,
          totalWords: p.validation?.totalWords,
          explainedWords: p.validation?.explainedWords,
          missingWords: p.validation?.missingWords,
          extraWords: p.validation?.extraWords,
        })),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Generate phrases error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error al generar frases';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export const POST = requireAdmin(handler);

