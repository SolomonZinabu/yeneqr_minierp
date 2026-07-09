// Update database with AI-generated menu item images
// Maps item names to their generated image paths

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// Map from menu item name to image slug
const NAME_TO_IMAGE = {
  'Doro Wot': 'doro-wot',
  'Doro Wot Special': 'doro-wot-special',
  'Kitfo (Raw)': 'kitfo-raw',
  'Kitfo Lebleb': 'kitfo-lebleb',
  'Kitfo Fully Cooked': 'kitfo-fully-cooked',
  'Kitfo Tibs': 'kitfo-tibs',
  'Kitfo with Kocho': 'kitfo-kocho',
  'Tibs': 'tibs',
  'Tibs Special': 'tibs-special',
  'Yebeg Tibs': 'yebeg-tibs',
  'Awaze Tibs': 'awaze-tibs',
  'Dereq Tibs': 'dereq-tibs',
  'Zilzil Tibs': 'zilzil-tibs',
  'Sega Wot': 'sega-wot',
  'Key Wot': 'key-wot',
  'Kai Wot with Metin': 'key-wot',
  'Beg Wot Keyih': 'beg-wot-keyih',
  'Yebeg Wot': 'yebeg-wot',
  'Kik Wot': 'kik-wot',
  'Dinich Wot': 'dinich-wot',
  'Gomen': 'gomen',
  'Fosolia': 'fosolia',
  'Atkilt Wot': 'atkilt-wot',
  'Keysir Alicha': 'keysir-alicha',
  'Azifa': 'azifa',
  'Shiro': 'shiro',
  'Shiro Wot with Mitin': 'shiro-wot-mitin',
  'Misir Wot': 'misir-wot',
  'Dulet Wot': 'dulet-wot',
  'Quanta Wot': 'quanta-wot',
  'Quanta Firfir': 'quanta-firfir',
  'Firfir': 'firfir',
  'Firfir with Egg': 'firfir-egg',
  'Kita Firfir': 'kita-firfir',
  'Chechebsa': 'chechebsa',
  'Fatira': 'fatira',
  'Genfo': 'genfo',
  'Kinche': 'kinche',
  'Ful Medames': 'ful-medames',
  'Ful Special': 'ful-special',
  'Enkulal Firfir': 'enkulal-firfir',
  'Enkulal Tibs (Breakfast)': 'enkulal-tibs',
  'Shakshouka': 'shakshouka',
  'Fata': 'fata',
  'Kita with Honey': 'kita-honey',
  'Ambasha': 'ambasha',
  'Himbasha': 'himbasha',
  'Honey Bread': 'honey-bread',
  'Gored Gored': 'gored-gored',
  'Kurt (Raw Meat)': 'kurt-raw',
  'Beef Steak Ethiopian Style': 'beef-steak-ethiopian',
  'Lamb Chops': 'lamb-chops',
  'Asa Tibs': 'asa-tibs',
  'Asa Wot': 'asa-wot',
  'Grilled Tilapia': 'grilled-tilapia',
  'Fish and Chips Ethiopian': 'fish-chips',
  'Shrimp Tibs': 'shrimp-tibs',
  'Sambusa': 'sambusa',
  'Sambusa (Meat)': 'sambusa-meat',
  'Doro Shorba': 'doro-shorba',
  'Shorba': 'shorba',
  'Egg Drop Soup': 'egg-drop-soup',
  'Timatim Salata': 'timatim-salata',
  'Timita Salata': 'timita-salata',
  'Fruit Salad': 'fruit-salad',
  'Macaroni Alicha': 'macaroni-alicha',
  'Pasta with Meat Sauce': 'pasta-meat-sauce',
  'Pasta with Salsa': 'pasta-salsa',
  'Dabbo Kolo': 'dabbo-kolo',
  'Kolo': 'kolo',
  'Beye Aynet': 'beye-aynet',
  'Baklava': 'baklava',
  'Basbousa': 'basbousa',
  'Cheesecake': 'cheesecake',
  'Date Cake': 'date-cake',
  'Tiramisu Ethiopian': 'tiramisu-ethiopian',
  'Banana Split': 'banana-split',
  'Ice Cream': 'ice-cream',
  'Ethiopian Coffee': 'ethiopian-coffee',
  'Coffee Ceremony (Full)': 'coffee-ceremony',
  'Macchiato': 'macchiato',
  'Buna Salaam (Iced Coffee)': 'buna-salaam',
  'Spris (Layered Coffee)': 'spris-layered-coffee',
  'Hot Chocolate': 'hot-chocolate',
  'Spiced Tea': 'spiced-tea',
  'Shai (Tea)': 'shai-tea',
  'Atmit': 'atmit',
  'Avocado Juice': 'avocado-juice',
  'Mango Juice': 'mango-juice',
  'Papaya Juice': 'papaya-juice',
  'Orange Juice': 'orange-juice',
  'Pineapple Juice': 'pineapple-juice',
  'Lemonade': 'lemonade',
  'Mixed Fruit Juice': 'mixed-fruit-juice',
  'Tej': 'tej',
  'Tej Spritz': 'tej-spritz',
  'Tella': 'tella',
  'Areke': 'areke',
  'Borde': 'borde',
  'Korefe': 'korefe',
  'Chala': 'chala',
  'St. George Beer': 'st-george-beer',
  'Dashen Beer': 'dashen-beer',
  'Harar Beer': 'harar-beer',
  'Meta Beer': 'meta-beer',
  'Castel Beer': 'castel-beer',
  'Coca Cola': 'coca-cola',
  'Fanta Orange': 'fanta-orange',
  'Sprite': 'sprite',
  'Ambo Mineral Water': 'ambo-mineral-water',
  'Mineral Water': 'mineral-water',
  'Axumit Wine': 'axumit-wine',
  'Rift Valley Wine (Red)': 'rift-valley-wine-red',
  'Rift Valley Wine (White)': 'rift-valley-wine-white',
  'Yirgacheffe Single Origin': 'yirgacheffe-origin',
  'Sidamo Single Origin': 'sidamo-origin',
  'Harrar Single Origin': 'harrar-origin',
  'Addis Mule': 'addis-mule',
  'Blue Nile Breeze': 'blue-nile-breeze',
  'Ethiopian Negroni': 'ethiopian-negroni',
  'Mitmita Margarita': 'mitmita-margarita',
  'Rift Valley Sunset': 'rift-valley-sunset',
  'Spiced Espresso Martini': 'spiced-espresso-martini',
  'Lalibela Old Fashioned': 'lalibela-old-fashioned',
};

const fs = require('fs');
const path = require('path');

async function main() {
  // Check which images actually exist on disk
  const imgDir = path.join(__dirname, 'public/images/menu');
  
  let updated = 0;
  let skipped = 0;
  let noImage = 0;
  
  for (const [itemName, imageSlug] of Object.entries(NAME_TO_IMAGE)) {
    const imagePath = `/images/menu/${imageSlug}.png`;
    const fullPath = path.join(__dirname, 'public', imagePath.substring(1));
    
    // Check if image file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`SKIP: ${itemName} - image file not found: ${fullPath}`);
      noImage++;
      continue;
    }
    
    // Update all menu items with this name
    const result = await db.menuItem.updateMany({
      where: { name: itemName },
      data: { image: imagePath },
    });
    
    if (result.count > 0) {
      console.log(`UPDATED: ${itemName} -> ${imagePath} (${result.count} items)`);
      updated += result.count;
    } else {
      console.log(`NO MATCH: ${itemName} - no items found in DB`);
      skipped++;
    }
  }
  
  console.log(`\n========================================`);
  console.log(`Database update complete!`);
  console.log(`  Items updated: ${updated}`);
  console.log(`  Names not found in DB: ${skipped}`);
  console.log(`  Images not generated yet: ${noImage}`);
  console.log(`========================================`);
}

main().catch(console.error).finally(() => db.$disconnect());
