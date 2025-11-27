import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create languages first
  const languages = [
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Français' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Português' },
  ];

  const createdLanguages: Record<string, string> = {};
  for (const lang of languages) {
    const created = await prisma.language.upsert({
      where: { code: lang.code },
      update: { name: lang.name },
      create: lang,
    });
    createdLanguages[lang.code] = created.id;
  }

  console.log('✅ Languages created');

  // Get default language IDs
  const esLangId = createdLanguages['es'];
  const enLangId = createdLanguages['en'];

  if (!esLangId || !enLangId) {
    throw new Error('No se pudieron crear los idiomas por defecto');
  }

  // Create admin user with language IDs
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@learningapp.com' },
    update: {
      password: hashedPassword,
      role: 'ADMIN',
      nativeLanguageId: esLangId,
      learningLanguageId: enLangId,
    },
    create: {
      email: 'admin@learningapp.com',
      password: hashedPassword,
      role: 'ADMIN',
      nativeLanguageId: esLangId,
      learningLanguageId: enLangId,
    },
  });

  console.log('✅ Admin user created:', admin.email);

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    // Don't exit with error code in production to allow build to continue
    // The seed uses upsert, so it's safe to run multiple times
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ Continuing build despite seed error (may already be seeded)');
    } else {
      process.exit(1);
    }
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

