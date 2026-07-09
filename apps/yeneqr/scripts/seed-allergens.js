// ============================================================
// Yene QR — Seed Allergens & Dietary Flags
// Run with: node scripts/seed-allergens.js
// ============================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧬 Seeding allergens and dietary flags...\n');

  // ─── 1. Seed the 8 major allergens ───
  const allergens = [
    { id: 'allergen-gluten', name: 'Gluten', icon: '🌾' },
    { id: 'allergen-dairy', name: 'Dairy', icon: '🥛' },
    { id: 'allergen-nuts', name: 'Nuts', icon: '🥜' },
    { id: 'allergen-shellfish', name: 'Shellfish', icon: '🦐' },
    { id: 'allergen-eggs', name: 'Eggs', icon: '🥚' },
    { id: 'allergen-soy', name: 'Soy', icon: '🫘' },
    { id: 'allergen-fish', name: 'Fish', icon: '🐟' },
    { id: 'allergen-sesame', name: 'Sesame', icon: '⚪' },
  ];

  let allergensCreated = 0;
  for (const a of allergens) {
    const result = await prisma.allergen.upsert({
      where: { id: a.id },
      update: {},
      create: a,
    });
    allergensCreated++;
    console.log(`  ✅ Allergen: ${a.name} ${a.icon}`);
  }

  // ─── 2. Assign allergens to menu items based on category ───
  // Get all menu items
  const menuItems = await prisma.menuItem.findMany({
    select: { id: true, name: true, categoryId: true },
  });

  // Get categories to map items
  const categories = await prisma.menuCategory.findMany({
    select: { id: true, name: true },
  });

  const categoryMap = new Map(categories.map(c => [c.id, c.name.toLowerCase()]));

  let allergenLinksCreated = 0;
  let dietaryFlagsSet = 0;

  for (const item of menuItems) {
    const catName = categoryMap.get(item.categoryId) || '';
    const itemName = item.name.toLowerCase();
    const updates = {};

    // Assign dietary flags based on category and name heuristics
    // Vegetarian items (already set in existing seed for Ethiopian dishes)
    // Let's add Vegan, Gluten-Free, Dairy-Free, Halal flags

    // Vegan: vegetable dishes, lentil dishes (misir), shiro (without butter), salads
    if (itemName.includes('misir') || itemName.includes('lentil') || 
        itemName.includes('shiro') || itemName.includes('salad') ||
        itemName.includes('gomen') || itemName.includes('kik') ||
        itemName.includes('atkilt') || itemName.includes('vegetable') ||
        itemName.includes('fossolia') || itemName.includes('dinich')) {
      updates.isVegan = true;
      updates.isVegetarian = true; // vegan implies vegetarian
    }

    // Gluten-Free: injera is made from teff (gluten-free), most wots are GF
    // Ethiopian food is largely naturally gluten-free except bread
    if (catName.includes('wot') || catName.includes('tibs') || catName.includes('kitfo') ||
        catName.includes('vegetable') || catName.includes('lentil') || catName.includes('shiro') ||
        catName.includes('salad') || catName.includes('soup')) {
      updates.isGlutenFree = true;
    }

    // Dairy-Free: many Ethiopian dishes use niter kibbeh (clarified butter)
    // Raw meat dishes and some tibs are dairy-free
    if (itemName.includes('kitfo') || itemName.includes('tartare') ||
        itemName.includes('gored') || itemName.includes('dulet') ||
        itemName.includes('tibs') || catName.includes('tibs')) {
      updates.isDairyFree = true;
    }

    // Halal: all items are halal by default in Ethiopian Muslim cuisine
    // Except pork (which doesn't exist in Ethiopian cuisine) and items with alcohol
    if (!itemName.includes('wine') && !itemName.includes('beer') && !itemName.includes('cocktail')) {
      updates.isHalal = true;
    }

    // Apply dietary flag updates
    if (Object.keys(updates).length > 0) {
      await prisma.menuItem.update({
        where: { id: item.id },
        data: updates,
      });
      dietaryFlagsSet++;
    }

    // Assign allergens to items based on category and name heuristics
    const allergenIds = [];

    // Items with bread/pasta contain gluten
    if (itemName.includes('bread') || itemName.includes('pasta') || 
        itemName.includes('cake') || itemName.includes('pastry')) {
      allergenIds.push('allergen-gluten');
    }

    // Dairy items
    if (itemName.includes('cheese') || itemName.includes('yogurt') || 
        itemName.includes('ayib') || itemName.includes('butter') ||
        itemName.includes('cream') || itemName.includes('milk')) {
      allergenIds.push('allergen-dairy');
    }

    // Nut items
    if (itemName.includes('nut') || itemName.includes('peanut') || 
        itemName.includes('almond') || itemName.includes('cashew')) {
      allergenIds.push('allergen-nuts');
    }

    // Shellfish items
    if (itemName.includes('shrimp') || itemName.includes('lobster') || 
        itemName.includes('crab') || itemName.includes('shellfish') ||
        itemName.includes('prawn')) {
      allergenIds.push('allergen-shellfish');
    }

    // Egg items
    if (itemName.includes('egg') || itemName.includes('enqulal')) {
      allergenIds.push('allergen-eggs');
    }

    // Soy items
    if (itemName.includes('soy') || itemName.includes('tofu')) {
      allergenIds.push('allergen-soy');
    }

    // Fish items
    if (itemName.includes('fish') || itemName.includes('salmon') || 
        itemName.includes('tuna') || itemName.includes('asa')) {
      allergenIds.push('allergen-fish');
    }

    // Sesame items (common in Ethiopian: tahini, hummus)
    if (itemName.includes('sesame') || itemName.includes('tahini') || 
        itemName.includes('hummus') || itemName.includes('selit')) {
      allergenIds.push('allergen-sesame');
    }

    // Also assign common allergens to popular Ethiopian categories
    // Most wot dishes contain butter (dairy) unless vegan
    if (catName.includes('wot') && !itemName.includes('shiro') && !itemName.includes('misir')) {
      if (!allergenIds.includes('allergen-dairy')) {
        allergenIds.push('allergen-dairy');
      }
    }

    // Create allergen links
    for (const allergenId of allergenIds) {
      try {
        await prisma.menuItemAllergen.upsert({
          where: {
            menuItemId_allergenId: {
              menuItemId: item.id,
              allergenId,
            },
          },
          update: {},
          create: {
            menuItemId: item.id,
            allergenId,
          },
        });
        allergenLinksCreated++;
      } catch (e) {
        // Skip duplicates or missing allergens
      }
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log('🧬 ALLERGENS & DIETARY SEED COMPLETE');
  console.log(`${'═'.repeat(50)}`);
  console.log(`  🧬 Allergens Created:       ${allergensCreated}`);
  console.log(`  🏷️  Allergen Links Created:  ${allergenLinksCreated}`);
  console.log(`  🥗 Dietary Flags Set:       ${dietaryFlagsSet}`);
  console.log(`${'═'.repeat(50)}\n`);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
