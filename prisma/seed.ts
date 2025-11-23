import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@learningapp.com' },
    update: {},
    create: {
      email: 'admin@learningapp.com',
      password: hashedPassword,
      role: 'ADMIN',
      nativeLanguage: 'es',
      learningLanguage: 'en',
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create languages
  const languages = [
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Français' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Português' },
  ];

  for (const lang of languages) {
    await prisma.language.upsert({
      where: { code: lang.code },
      update: {},
      create: lang,
    });
  }

  console.log('✅ Languages created');

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

