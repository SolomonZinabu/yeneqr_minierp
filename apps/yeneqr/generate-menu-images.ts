// Generate AI images for all menu items using z-ai-web-dev-sdk
// With rate-limit handling, retry logic, and progress tracking

import ZAI from 'z-ai-web-dev-sdk';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DIR = './public/images/menu';
mkdirSync(DIR, { recursive: true });

const MENU_ITEMS = [
  // Main Dishes - Beef
  { name: 'doro-wot', prompt: 'Professional food photography of Doro Wot, Ethiopian spicy chicken stew in dark red berbere sauce on injera, hard-boiled egg, warm lighting, overhead shot' },
  { name: 'doro-wot-special', prompt: 'Professional food photography of Doro Wot Special, premium Ethiopian chicken stew extra berbere sauce two eggs on injera with side salads, elegant presentation' },
  { name: 'kitfo-raw', prompt: 'Professional food photography of Kitfo raw, Ethiopian finely minced raw beef with mitmita spice and niter kibbeh on injera, kocho bread, warm lighting' },
  { name: 'kitfo-lebleb', prompt: 'Professional food photography of Kitfo Lebleb, Ethiopian lightly cooked minced beef pink center with mitmita spice on injera, warm lighting' },
  { name: 'kitfo-fully-cooked', prompt: 'Professional food photography of Kitfo Fully Cooked, Ethiopian well-done minced beef with spices on injera with sides, warm lighting' },
  { name: 'kitfo-tibs', prompt: 'Professional food photography of Kitfo Tibs, Ethiopian sauteed minced beef with onions peppers sizzling on injera, warm lighting' },
  { name: 'kitfo-kocho', prompt: 'Professional food photography of Kitfo with Kocho, Ethiopian raw beef served on kocho false banana bread, Gurage style, warm lighting' },
  { name: 'tibs', prompt: 'Professional food photography of Tibs, Ethiopian sauteed beef cubes with onions tomatoes peppers sizzling hot on injera, warm lighting' },
  { name: 'tibs-special', prompt: 'Professional food photography of Tibs Special, premium Ethiopian sauteed tender beef vegetables sizzling plate injera herbs, dramatic lighting' },
  { name: 'yebeg-tibs', prompt: 'Professional food photography of Yebeg Tibs, Ethiopian sauteed lamb with onions peppers sizzling on injera, warm restaurant lighting' },
  { name: 'awaze-tibs', prompt: 'Professional food photography of Awaze Tibs, Ethiopian spicy sauteed beef in awaze pepper paste on injera, dark red, warm lighting' },
  { name: 'dereq-tibs', prompt: 'Professional food photography of Dereq Tibs, Ethiopian dry-fried crispy beef tips golden on injera with salad, warm lighting' },
  { name: 'zilzil-tibs', prompt: 'Professional food photography of Zilzil Tibs, Ethiopian thinly sliced rolled beef strips sauteed with spices on injera, warm lighting' },
  { name: 'sega-wot', prompt: 'Professional food photography of Sega Wot, Ethiopian beef stew in rich berbere sauce dark red on injera, warm restaurant lighting' },
  { name: 'key-wot', prompt: 'Professional food photography of Key Wot, Ethiopian spicy red beef stew with berbere thick sauce on injera, warm lighting' },
  { name: 'beg-wot-keyih', prompt: 'Professional food photography of Beg Wot Keyih, Ethiopian spicy lamb stew in red berbere sauce on injera, warm lighting' },
  { name: 'yebeg-wot', prompt: 'Professional food photography of Yebeg Wot, Ethiopian lamb stew in savory sauce on injera, warm restaurant lighting' },
  { name: 'kik-wot', prompt: 'Professional food photography of Kik Wot, Ethiopian yellow split pea stew golden on injera, warm ambient lighting' },
  { name: 'dinich-wot', prompt: 'Professional food photography of Dinich Wot, Ethiopian potato stew in spicy berbere sauce chunky on injera, warm lighting' },
  { name: 'gomen', prompt: 'Professional food photography of Gomen, Ethiopian collard greens sauteed with garlic spices vibrant green on injera, warm lighting' },
  { name: 'fosolia', prompt: 'Professional food photography of Fosolia, Ethiopian string beans carrots sauteed with onions colorful vegetarian on injera, warm lighting' },
  { name: 'atkilt-wot', prompt: 'Professional food photography of Atkilt Wot, Ethiopian vegetable stew potatoes carrots cabbage mild sauce on injera, warm lighting' },
  { name: 'azifa', prompt: 'Professional food photography of Azifa, Ethiopian cold lentil salad with mustard lime green herbaceous side dish, warm lighting' },
  { name: 'shiro', prompt: 'Professional food photography of Shiro, Ethiopian chickpea flour stew smooth golden bubbling on injera, warm comfort food lighting' },
  { name: 'shiro-wot-mitin', prompt: 'Professional food photography of Shiro Wot with Mitin, Ethiopian chickpea stew with spiced butter mitin seasoning golden on injera' },
  { name: 'misir-wot', prompt: 'Professional food photography of Misir Wot, Ethiopian spicy red lentil stew dark red berbere on injera with vegetables, warm lighting' },
  { name: 'dulet-wot', prompt: 'Professional food photography of Dulet Wot, Ethiopian spicy tripe liver stew dark rich sauce on injera, warm restaurant lighting' },
  { name: 'quanta-wot', prompt: 'Professional food photography of Quanta Wot, Ethiopian dried beef stew in spicy berbere sauce on injera, warm lighting' },
  { name: 'quanta-firfir', prompt: 'Professional food photography of Quanta Firfir, Ethiopian shredded injera with dried beef spicy berbere dark red traditional bowl' },
  { name: 'firfir', prompt: 'Professional food photography of Firfir, Ethiopian shredded injera mixed with spicy berbere sauce niter kibbeh dark red traditional bowl' },
  { name: 'firfir-egg', prompt: 'Professional food photography of Firfir with Egg, Ethiopian shredded injera spicy sauce topped with fried egg, warm lighting' },
  { name: 'kita-firfir', prompt: 'Professional food photography of Kita Firfir, Ethiopian flatbread torn mixed with spicy sauce butter rustic homestyle, warm lighting' },
  { name: 'chechebsa', prompt: 'Professional food photography of Chechebsa, Ethiopian shredded flatbread with spiced butter berbere golden crispy breakfast, warm lighting' },
  { name: 'fatira', prompt: 'Professional food photography of Fatira, Ethiopian pan-fried flatbread with egg filling golden crispy cut into triangles breakfast' },
  { name: 'genfo', prompt: 'Professional food photography of Genfo, Ethiopian thick porridge barley flour shaped mound with well of spiced butter, warm lighting' },
  { name: 'kinche', prompt: 'Professional food photography of Kinche, Ethiopian cracked wheat porridge with niter kibbeh butter wholesome bowl, soft warm lighting' },
  { name: 'ful-medames', prompt: 'Professional food photography of Ful Medames, Ethiopian fava bean stew olive oil cumin vegetables bowl with bread, warm lighting' },
  { name: 'ful-special', prompt: 'Professional food photography of Ful Special, Ethiopian fava beans with egg yogurt feta cheese toppings elaborate bowl, warm lighting' },
  { name: 'enkulal-firfir', prompt: 'Professional food photography of Enkulal Firfir, Ethiopian scrambled eggs with onions tomatoes peppers colorful skillet, warm lighting' },
  { name: 'enkulal-tibs', prompt: 'Professional food photography of Enkulal Tibs, Ethiopian scrambled eggs with sauteed meat vegetables hearty breakfast, warm lighting' },
  { name: 'shakshouka', prompt: 'Professional food photography of Shakshouka, eggs poached in spiced tomato sauce vibrant red runny eggs cast iron skillet, warm lighting' },
  { name: 'fata', prompt: 'Professional food photography of Fata, Ethiopian torn bread mixed with spicy berbere sauce yogurt traditional bowl comfort food' },
  { name: 'kita-honey', prompt: 'Professional food photography of Kita with Honey, Ethiopian flatbread with golden honey drizzle sweet breakfast, warm amber lighting' },
  { name: 'ambasha', prompt: 'Professional food photography of Ambasha, Ethiopian sweet braided bread golden brown crust celebration bread sliced on board, warm lighting' },
  { name: 'himbasha', prompt: 'Professional food photography of Himbasha, Ethiopian sweet flatbread with decorative pattern golden top sliced festive, warm lighting' },
  { name: 'honey-bread', prompt: 'Professional food photography of Ethiopian Honey Bread, sweet golden bread with honey glaze sliced rustic board, warm bakery lighting' },
  // Meat & Fish
  { name: 'gored-gored', prompt: 'Professional food photography of Gored Gored, Ethiopian raw cubed beef mitmita spiced butter bright red with injera, warm lighting' },
  { name: 'kurt-raw', prompt: 'Professional food photography of Kurt, Ethiopian raw cubed beef served plain with dipping sauces dramatic presentation, warm lighting' },
  { name: 'beef-steak-ethiopian', prompt: 'Professional food photography of Ethiopian Beef Steak, grilled with berbere crust served with vegetables injera, elegant plating, warm lighting' },
  { name: 'lamb-chops', prompt: 'Professional food photography of Ethiopian Spiced Lamb Chops, grilled with berbere rosemary marinade char marks sides, warm lighting' },
  { name: 'asa-tibs', prompt: 'Professional food photography of Asa Tibs, Ethiopian sauteed fish with onions tomatoes peppers tilapia sizzling with injera' },
  { name: 'asa-wot', prompt: 'Professional food photography of Asa Wot, Ethiopian fish stew in spicy berbere sauce chunks of fish on injera' },
  { name: 'grilled-tilapia', prompt: 'Professional food photography of Grilled Tilapia Ethiopian style, whole grilled fish with spice rub charred skin injera salad, dramatic lighting' },
  { name: 'fish-chips', prompt: 'Professional food photography of Ethiopian Fish and Chips, crispy battered fish with thick fries awaze sauce, casual dining' },
  { name: 'shrimp-tibs', prompt: 'Professional food photography of Shrimp Tibs, Ethiopian sauteed shrimp with onions peppers spices sizzling with injera' },
  { name: 'sambusa', prompt: 'Professional food photography of Sambusa, Ethiopian golden crispy fried pastry triangles filled with spiced lentils, warm lighting' },
  { name: 'sambusa-meat', prompt: 'Professional food photography of Meat Sambusa, Ethiopian crispy fried pastry triangles filled with spiced ground beef golden, warm lighting' },
  // Soups & Salads
  { name: 'doro-shorba', prompt: 'Professional food photography of Doro Shorba, Ethiopian chicken soup clear golden broth with chicken vegetables steaming bowl, warm lighting' },
  { name: 'shorba', prompt: 'Professional food photography of Shorba, Ethiopian lentil soup smooth creamy garnished herbs steaming bowl, warm lighting' },
  { name: 'egg-drop-soup', prompt: 'Professional food photography of Ethiopian Egg Drop Soup, silky broth with egg ribbons scallions steaming bowl, warm lighting' },
  { name: 'timatim-salata', prompt: 'Professional food photography of Timatim Salata, Ethiopian tomato salad with onions jalapenos lemon dressing bright colorful, warm lighting' },
  { name: 'timita-salata', prompt: 'Professional food photography of Timita Salata, Ethiopian tomato salad green chilies lime vibrant fresh, warm lighting' },
  { name: 'fruit-salad', prompt: 'Professional food photography of fresh Fruit Salad, colorful tropical fruits mango papaya banana in glass bowl, bright natural lighting' },
  // Pasta
  { name: 'macaroni-alicha', prompt: 'Professional food photography of Macaroni Alicha, Ethiopian pasta in mild turmeric sauce with vegetables fusion dish, warm lighting' },
  { name: 'pasta-meat-sauce', prompt: 'Professional food photography of Pasta with Meat Sauce Ethiopian style, spaghetti with spiced ground beef injera side, warm lighting' },
  { name: 'pasta-salsa', prompt: 'Professional food photography of Pasta with Salsa, Ethiopian spaghetti with fresh tomato sauce vegetables colorful, warm lighting' },
  // Snacks
  { name: 'dabbo-kolo', prompt: 'Professional food photography of Dabbo Kolo, Ethiopian sweet fried bread snacks small golden crunchy bites in basket, warm lighting' },
  { name: 'kolo', prompt: 'Professional food photography of Kolo, Ethiopian roasted barley snack with peanuts sunflower seeds in basket, warm lighting' },
  { name: 'beye-aynet', prompt: 'Professional food photography of Beye Aynet, Ethiopian assorted breakfast platter stews breads sides colorful spread on mesob' },
  // Desserts
  { name: 'baklava', prompt: 'Professional food photography of Baklava, golden flaky pastry with honey nuts diamond shaped pistachio garnish, warm lighting' },
  { name: 'basbousa', prompt: 'Professional food photography of Basbousa, semolina cake soaked in rose syrup diamond cut almond topping golden, warm lighting' },
  { name: 'cheesecake', prompt: 'Professional food photography of Cheesecake, creamy New York style slice with berry compote drizzle elegant plating, warm lighting' },
  { name: 'date-cake', prompt: 'Professional food photography of Date Cake, rich moist cake with date chunks caramel glaze sliced plate, warm bakery lighting' },
  { name: 'tiramisu-ethiopian', prompt: 'Professional food photography of Ethiopian Tiramisu, coffee-flavored dessert with Ethiopian coffee cocoa dusted layered cream glass, warm lighting' },
  { name: 'banana-split', prompt: 'Professional food photography of Banana Split, three scoops ice cream chocolate vanilla strawberry banana whipped cream cherry, bright lighting' },
  { name: 'ice-cream', prompt: 'Professional food photography of Ice Cream, three scoops artisanal in waffle bowl chocolate vanilla strawberry drizzled sauces, warm lighting' },
  // Coffee & Hot Drinks
  { name: 'ethiopian-coffee', prompt: 'Professional food photography of Ethiopian Coffee, traditional jebena clay pot pouring black coffee into cups frankincense, warm cultural lighting' },
  { name: 'coffee-ceremony', prompt: 'Professional food photography of Full Ethiopian Coffee Ceremony, three rounds coffee with popcorn jebena pot incense, warm lighting' },
  { name: 'macchiato', prompt: 'Professional food photography of Ethiopian Macchiato, layered espresso with steamed milk foam in clear glass cup, warm cafe lighting' },
  { name: 'buna-salaam', prompt: 'Professional food photography of Buna Salaam iced coffee, Ethiopian cold coffee in tall glass with ice and cream, refreshing, warm lighting' },
  { name: 'spris-layered-coffee', prompt: 'Professional food photography of Spris, Ethiopian layered coffee drink visible espresso and milk layers in tall glass, warm lighting' },
  { name: 'hot-chocolate', prompt: 'Professional food photography of Hot Chocolate, rich dark hot chocolate with marshmallows whipped cream steaming mug, cozy lighting' },
  { name: 'spiced-tea', prompt: 'Professional food photography of Ethiopian Spiced Tea, warm amber tea with cinnamon cardamom cloves in glass steaming, warm lighting' },
  { name: 'shai-tea', prompt: 'Professional food photography of Shai, Ethiopian black tea in small glass cup with sugar side, simple warm, close-up' },
  { name: 'atmit', prompt: 'Professional food photography of Atmit, Ethiopian warm oat drink with butter honey creamy golden traditional cup, warm lighting' },
  // Juices
  { name: 'avocado-juice', prompt: 'Professional food photography of Avocado Juice, thick creamy green smoothie in tall glass fresh avocado milk straw, warm lighting' },
  { name: 'mango-juice', prompt: 'Professional food photography of Mango Juice, vibrant orange fresh mango juice in tall glass with ice refreshing, warm lighting' },
  { name: 'papaya-juice', prompt: 'Professional food photography of Papaya Juice, fresh orange-yellow papaya juice in tall glass tropical refreshing, warm lighting' },
  { name: 'orange-juice', prompt: 'Professional food photography of Fresh Orange Juice, bright orange juice in glass with orange slice garnish refreshing, natural lighting' },
  { name: 'pineapple-juice', prompt: 'Professional food photography of Pineapple Juice, fresh golden pineapple juice in tall glass with ice tropical refreshing, warm lighting' },
  { name: 'lemonade', prompt: 'Professional food photography of Fresh Lemonade, cloudy yellow lemonade with lemon slices mint ice cubes refreshing, bright lighting' },
  { name: 'mixed-fruit-juice', prompt: 'Professional food photography of Mixed Fruit Juice, colorful layered mango guava papaya layers in tall glass vibrant, warm lighting' },
  // Alcoholic Drinks
  { name: 'tej', prompt: 'Professional food photography of Tej, Ethiopian honey wine in traditional berele glass flask golden amber cultural drink, warm lighting' },
  { name: 'tej-spritz', prompt: 'Professional food photography of Tej Spritz, modern cocktail with Ethiopian honey wine sparkling water citrus garnish elegant glass, warm bar lighting' },
  { name: 'tella', prompt: 'Professional food photography of Tella, Ethiopian traditional fermented barley beer dark brown cloudy in clay vessel rustic, warm lighting' },
  { name: 'areke', prompt: 'Professional food photography of Areke, Ethiopian traditional distilled spirit in small glass clear potent liquor, warm lighting' },
  { name: 'borde', prompt: 'Professional food photography of Borde, Ethiopian fermented cereal beverage light colored in clay pot cultural, warm lighting' },
  { name: 'korefe', prompt: 'Professional food photography of Korefe, Ethiopian traditional fermented sorghum drink in rustic container cultural beverage, warm lighting' },
  { name: 'chala', prompt: 'Professional food photography of Chala, Ethiopian local beer in traditional cup golden amber, warm lighting' },
  { name: 'st-george-beer', prompt: 'Professional food photography of St George Beer, Ethiopia iconic lager in branded bottle and poured glass golden condensation, cool lighting' },
  { name: 'dashen-beer', prompt: 'Professional food photography of Dashen Beer, Ethiopian premium lager in branded bottle and glass golden pour refreshing, cool lighting' },
  { name: 'harar-beer', prompt: 'Professional food photography of Harar Beer, Ethiopian lager in branded bottle golden amber poured glass cool refreshing, bar lighting' },
  { name: 'meta-beer', prompt: 'Professional food photography of Meta Beer, Ethiopian beer in branded bottle and glass golden lager refreshing, cool lighting' },
  { name: 'castel-beer', prompt: 'Professional food photography of Castel Beer, premium Ethiopian lager in branded glass bottle golden pour condensation, cool lighting' },
  { name: 'coca-cola', prompt: 'Professional food photography of Coca Cola, classic red branded glass bottle with condensation ice cold refreshing, cool lighting' },
  { name: 'fanta-orange', prompt: 'Professional food photography of Fanta Orange, bright orange soda in branded glass bottle icy cold condensation, cool lighting' },
  { name: 'sprite', prompt: 'Professional food photography of Sprite, lemon-lime soda in branded glass bottle green tint icy cold condensation, cool lighting' },
  { name: 'ambo-mineral-water', prompt: 'Professional food photography of Ambo Mineral Water, Ethiopia premium sparkling mineral water in branded bottle clean refreshing, cool lighting' },
  { name: 'mineral-water', prompt: 'Professional food photography of Mineral Water, crystal clear water in elegant glass bottle refreshing clean minimalist, cool lighting' },
  { name: 'axumit-wine', prompt: 'Professional food photography of Axumit Wine, Ethiopian red wine in elegant glass rich burgundy bottle background, warm restaurant lighting' },
  { name: 'rift-valley-wine-red', prompt: 'Professional food photography of Rift Valley Red Wine, Ethiopian wine in glass deep red bottle background, warm restaurant lighting' },
  { name: 'rift-valley-wine-white', prompt: 'Professional food photography of Rift Valley White Wine, Ethiopian white wine in glass pale golden refreshing, cool restaurant lighting' },
  { name: 'yirgacheffe-origin', prompt: 'Professional food photography of Yirgacheffe Single Origin Coffee, premium Ethiopian beans in burlap bag brewed cup, warm artisanal lighting' },
  { name: 'sidamo-origin', prompt: 'Professional food photography of Sidamo Single Origin Coffee, premium Ethiopian beans brewed in ceramic cup, warm rustic lighting' },
  { name: 'harrar-origin', prompt: 'Professional food photography of Harrar Single Origin Coffee, premium Ethiopian dry processed beans brewed cup, warm artisanal lighting' },
  // Cocktails
  { name: 'addis-mule', prompt: 'Professional food photography of Addis Mule cocktail, Ethiopian Moscow Mule in copper mug with lime berbere rim spicy refreshing, warm bar lighting' },
  { name: 'blue-nile-breeze', prompt: 'Professional food photography of Blue Nile Breeze cocktail, blue curacao tropical in hurricane glass vibrant blue orange slice, warm bar lighting' },
  { name: 'ethiopian-negroni', prompt: 'Professional food photography of Ethiopian Negroni, dark red cocktail in rocks glass orange peel Ethiopian spice twist, warm bar lighting' },
  { name: 'mitmita-margarita', prompt: 'Professional food photography of Mitmita Margarita, spicy Ethiopian cocktail in mitmita salt-rimmed glass lime tequila, warm bar lighting' },
  { name: 'rift-valley-sunset', prompt: 'Professional food photography of Rift Valley Sunset cocktail, gradient orange to red in tall glass tropical Ethiopian-inspired, warm bar lighting' },
  { name: 'spiced-espresso-martini', prompt: 'Professional food photography of Spiced Espresso Martini, rich dark cocktail in martini glass coffee beans Ethiopian coffee, warm bar lighting' },
  { name: 'lalibela-old-fashioned', prompt: 'Professional food photography of Lalibela Old Fashioned, premium whiskey cocktail in rocks glass large ice cube orange peel honey, warm bar lighting' },
];

// Mapping from unique image name to all DB menu item names that should use it
export const IMAGE_MAP = {
  'doro-wot': ['Doro Wot'],
  'doro-wot-special': ['Doro Wot Special'],
  'kitfo-raw': ['Kitfo (Raw)'],
  'kitfo-lebleb': ['Kitfo Lebleb'],
  'kitfo-fully-cooked': ['Kitfo Fully Cooked'],
  'kitfo-tibs': ['Kitfo Tibs'],
  'kitfo-kocho': ['Kitfo with Kocho'],
  'tibs': ['Tibs'],
  'tibs-special': ['Tibs Special'],
  'yebeg-tibs': ['Yebeg Tibs'],
  'awaze-tibs': ['Awaze Tibs'],
  'dereq-tibs': ['Dereq Tibs'],
  'zilzil-tibs': ['Zilzil Tibs'],
  'sega-wot': ['Sega Wot'],
  'key-wot': ['Key Wot', 'Kai Wot with Metin'],
  'beg-wot-keyih': ['Beg Wot Keyih'],
  'yebeg-wot': ['Yebeg Wot'],
  'kik-wot': ['Kik Wot'],
  'dinich-wot': ['Dinich Wot'],
  'gomen': ['Gomen'],
  'fosolia': ['Fosolia'],
  'atkilt-wot': ['Atkilt Wot'],
  'azifa': ['Azifa'],
  'shiro': ['Shiro'],
  'shiro-wot-mitin': ['Shiro Wot with Mitin'],
  'misir-wot': ['Misir Wot'],
  'dulet-wot': ['Dulet Wot'],
  'quanta-wot': ['Quanta Wot'],
  'quanta-firfir': ['Quanta Firfir'],
  'firfir': ['Firfir'],
  'firfir-egg': ['Firfir with Egg'],
  'kita-firfir': ['Kita Firfir'],
  'chechebsa': ['Chechebsa'],
  'fatira': ['Fatira'],
  'genfo': ['Genfo'],
  'kinche': ['Kinche'],
  'ful-medames': ['Ful Medames'],
  'ful-special': ['Ful Special'],
  'enkulal-firfir': ['Enkulal Firfir'],
  'enkulal-tibs': ['Enkulal Tibs (Breakfast)'],
  'shakshouka': ['Shakshouka'],
  'fata': ['Fata'],
  'kita-honey': ['Kita with Honey'],
  'ambasha': ['Ambasha'],
  'himbasha': ['Himbasha'],
  'honey-bread': ['Honey Bread'],
  'gored-gored': ['Gored Gored'],
  'kurt-raw': ['Kurt (Raw Meat)'],
  'beef-steak-ethiopian': ['Beef Steak Ethiopian Style'],
  'lamb-chops': ['Lamb Chops'],
  'asa-tibs': ['Asa Tibs'],
  'asa-wot': ['Asa Wot'],
  'grilled-tilapia': ['Grilled Tilapia'],
  'fish-chips': ['Fish and Chips Ethiopian'],
  'shrimp-tibs': ['Shrimp Tibs'],
  'sambusa': ['Sambusa'],
  'sambusa-meat': ['Sambusa (Meat)'],
  'doro-shorba': ['Doro Shorba'],
  'shorba': ['Shorba'],
  'egg-drop-soup': ['Egg Drop Soup'],
  'timatim-salata': ['Timatim Salata'],
  'timita-salata': ['Timita Salata'],
  'fruit-salad': ['Fruit Salad'],
  'macaroni-alicha': ['Macaroni Alicha'],
  'pasta-meat-sauce': ['Pasta with Meat Sauce'],
  'pasta-salsa': ['Pasta with Salsa'],
  'dabbo-kolo': ['Dabbo Kolo'],
  'kolo': ['Kolo'],
  'beye-aynet': ['Beye Aynet'],
  'baklava': ['Baklava'],
  'basbousa': ['Basbousa'],
  'cheesecake': ['Cheesecake'],
  'date-cake': ['Date Cake'],
  'tiramisu-ethiopian': ['Tiramisu Ethiopian'],
  'banana-split': ['Banana Split'],
  'ice-cream': ['Ice Cream'],
  'ethiopian-coffee': ['Ethiopian Coffee'],
  'coffee-ceremony': ['Coffee Ceremony (Full)'],
  'macchiato': ['Macchiato'],
  'buna-salaam': ['Buna Salaam (Iced Coffee)'],
  'spris-layered-coffee': ['Spris (Layered Coffee)'],
  'hot-chocolate': ['Hot Chocolate'],
  'spiced-tea': ['Spiced Tea'],
  'shai-tea': ['Shai (Tea)'],
  'atmit': ['Atmit'],
  'avocado-juice': ['Avocado Juice'],
  'mango-juice': ['Mango Juice'],
  'papaya-juice': ['Papaya Juice'],
  'orange-juice': ['Orange Juice'],
  'pineapple-juice': ['Pineapple Juice'],
  'lemonade': ['Lemonade'],
  'mixed-fruit-juice': ['Mixed Fruit Juice'],
  'tej': ['Tej'],
  'tej-spritz': ['Tej Spritz'],
  'tella': ['Tella'],
  'areke': ['Areke'],
  'borde': ['Borde'],
  'korefe': ['Korefe'],
  'chala': ['Chala'],
  'st-george-beer': ['St. George Beer'],
  'dashen-beer': ['Dashen Beer'],
  'harar-beer': ['Harar Beer'],
  'meta-beer': ['Meta Beer'],
  'castel-beer': ['Castel Beer'],
  'coca-cola': ['Coca Cola'],
  'fanta-orange': ['Fanta Orange'],
  'sprite': ['Sprite'],
  'ambo-mineral-water': ['Ambo Mineral Water'],
  'mineral-water': ['Mineral Water'],
  'axumit-wine': ['Axumit Wine'],
  'rift-valley-wine-red': ['Rift Valley Wine (Red)'],
  'rift-valley-wine-white': ['Rift Valley Wine (White)'],
  'yirgacheffe-origin': ['Yirgacheffe Single Origin'],
  'sidamo-origin': ['Sidamo Single Origin'],
  'harrar-origin': ['Harrar Single Origin'],
  'addis-mule': ['Addis Mule'],
  'blue-nile-breeze': ['Blue Nile Breeze'],
  'ethiopian-negroni': ['Ethiopian Negroni'],
  'mitmita-margarita': ['Mitmita Margarita'],
  'rift-valley-sunset': ['Rift Valley Sunset'],
  'spiced-espresso-martini': ['Spiced Espresso Martini'],
  'lalibela-old-fashioned': ['Lalibela Old Fashioned'],
};

async function main() {
  const zai = await ZAI.create();
  
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const item of MENU_ITEMS) {
    const filePath = join(DIR, `${item.name}.png`);
    
    if (existsSync(filePath)) {
      console.log(`SKIP: ${item.name} (already exists)`);
      skipped++;
      continue;
    }
    
    let retries = 3;
    while (retries > 0) {
      try {
        console.log(`Generating: ${item.name}...`);
        const response = await zai.images.generations.create({
          prompt: item.prompt,
          size: '864x1152',
        });
        
        const imageData = response.data[0].base64;
        const buffer = Buffer.from(imageData, 'base64');
        writeFileSync(filePath, buffer);
        
        console.log(`  ✓ Saved: ${item.name}.png (${(buffer.length / 1024).toFixed(0)}KB)`);
        generated++;
        break;
      } catch (err: any) {
        if (err.message?.includes('429') || err.message?.includes('rate')) {
          retries--;
          const waitTime = (4 - retries) * 10; // 10s, 20s, 30s
          console.log(`  Rate limited. Waiting ${waitTime}s... (${retries} retries left)`);
          await new Promise(r => setTimeout(r, waitTime * 1000));
        } else {
          console.error(`  ✗ Failed: ${item.name} - ${err.message}`);
          failed++;
          break;
        }
      }
    }
    
    if (retries === 0) {
      console.error(`  ✗ All retries exhausted for: ${item.name}`);
      failed++;
    }
    
    // Small delay between requests to avoid rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log(`\n========================================`);
  console.log(`Generation complete!`);
  console.log(`  Generated: ${generated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total images: ${generated + skipped}`);
  console.log(`========================================`);
}

main().catch(console.error);
