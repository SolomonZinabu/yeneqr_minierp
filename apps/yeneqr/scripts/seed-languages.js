// ============================================================
// Yene QR — Language & RestaurantLanguage Seed Script
// Seeds the Language table with all 5 supported languages
// and creates RestaurantLanguage entries for both restaurants
// Languages: en, am, om, ti, ar
// ============================================================

// Load DATABASE_URL from .env first, then .env.production as fallback
require('dotenv').config();
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: '.env.production' });
}
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: '.env.development' });
}
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found in any .env file. Set it explicitly:');
  console.error('  DATABASE_URL="file:./yeneqr.db" node scripts/seed-languages.js');
  process.exit(1);
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    nameLocal: 'English',
    direction: 'ltr',
    fontFamily: null,
    flagEmoji: '🇬🇧',
    isActive: true,
    sortOrder: 0,
  },
  {
    code: 'am',
    name: 'Amharic',
    nameLocal: 'አማርኛ',
    direction: 'ltr',
    fontFamily: 'Noto Sans Ethiopic',
    flagEmoji: '🇪🇹',
    isActive: true,
    sortOrder: 1,
  },
  {
    code: 'om',
    name: 'Oromo',
    nameLocal: 'Afaan Oromoo',
    direction: 'ltr',
    fontFamily: 'Noto Sans Ethiopic',
    flagEmoji: '🇪🇹',
    isActive: true,
    sortOrder: 2,
  },
  {
    code: 'ti',
    name: 'Tigrinya',
    nameLocal: 'ትግርኛ',
    direction: 'ltr',
    fontFamily: 'Noto Sans Ethiopic',
    flagEmoji: '🇪🇷',
    isActive: true,
    sortOrder: 3,
  },
  {
    code: 'ar',
    name: 'Arabic',
    nameLocal: 'العربية',
    direction: 'rtl',
    fontFamily: 'Noto Naskh Arabic',
    flagEmoji: '🇸🇦',
    isActive: true,
    sortOrder: 4,
  },
];

async function seed() {
  try {
    console.log('🌐 Seeding languages...\n');

    // ── Seed Language table ──
    let langCreated = 0;
    let langUpdated = 0;
    let langSkipped = 0;

    for (const lang of LANGUAGES) {
      const existing = await prisma.language.findUnique({ where: { code: lang.code } });
      if (!existing) {
        await prisma.language.create({ data: lang });
        langCreated++;
        console.log(`  ✅ Created language: ${lang.code} (${lang.nameLocal})`);
      } else {
        // Update if any fields differ
        const needsUpdate =
          existing.name !== lang.name ||
          existing.nameLocal !== lang.nameLocal ||
          existing.direction !== lang.direction ||
          existing.fontFamily !== lang.fontFamily ||
          existing.flagEmoji !== lang.flagEmoji ||
          existing.isActive !== lang.isActive ||
          existing.sortOrder !== lang.sortOrder;

        if (needsUpdate) {
          await prisma.language.update({
            where: { code: lang.code },
            data: lang,
          });
          langUpdated++;
          console.log(`  🔄 Updated language: ${lang.code}`);
        } else {
          langSkipped++;
        }
      }
    }

    console.log(`\n📋 Language seed results:`);
    console.log(`   Created: ${langCreated}`);
    console.log(`   Updated: ${langUpdated}`);
    console.log(`   Skipped: ${langSkipped} (already up-to-date)`);

    // ── Seed RestaurantLanguage entries for ALL restaurants ──
    console.log('\n🌐 Seeding restaurant language configurations...\n');

    const restaurants = await prisma.restaurant.findMany();
    let rlCreated = 0;
    let rlUpdated = 0;
    let rlSkipped = 0;

    for (const restaurant of restaurants) {
      console.log(`  Restaurant: ${restaurant.name} (${restaurant.slug})`);

      // Determine the default language for this restaurant
      const defaultLang = restaurant.defaultLanguage || 'en';
      console.log(`    Default language: ${defaultLang}`);

      // Enable all 5 languages for each restaurant
      const enabledCodes = ['en', 'am', 'om', 'ti', 'ar'];

      for (let i = 0; i < enabledCodes.length; i++) {
        const code = enabledCodes[i];
        const isDefault = code === defaultLang;

        // Check if this RestaurantLanguage already exists
        const existing = await prisma.restaurantLanguage.findUnique({
          where: {
            restaurantId_languageCode: {
              restaurantId: restaurant.id,
              languageCode: code,
            },
          },
        });

        if (!existing) {
          await prisma.restaurantLanguage.create({
            data: {
              restaurantId: restaurant.id,
              languageCode: code,
              isDefault,
              isActive: true,
              isRequired: code === 'en' || isDefault,
              sortOrder: i,
            },
          });
          rlCreated++;
          console.log(`    ✅ Created: ${code} (default: ${isDefault})`);
        } else {
          // Update if needed (ensure isActive = true for all 5 languages)
          if (!existing.isActive || existing.isDefault !== isDefault) {
            await prisma.restaurantLanguage.update({
              where: { id: existing.id },
              data: {
                isActive: true,
                isDefault,
                sortOrder: i,
              },
            });
            rlUpdated++;
            console.log(`    🔄 Updated: ${code} (active: true, default: ${isDefault})`);
          } else {
            rlSkipped++;
          }
        }
      }

      // Also update the restaurant's enabledLanguages JSON field
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: {
          enabledLanguages: JSON.stringify(enabledCodes),
        },
      });
      console.log(`    ✅ Updated enabledLanguages on restaurant record`);
    }

    console.log(`\n📋 RestaurantLanguage seed results:`);
    console.log(`   Created: ${rlCreated}`);
    console.log(`   Updated: ${rlUpdated}`);
    console.log(`   Skipped: ${rlSkipped} (already up-to-date)`);
    console.log(`\n✨ Language seed COMPLETE!\n`);
  } catch (error) {
    console.error('Error seeding languages:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
