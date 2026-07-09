// ============================================================
// Yene QR — Ethiopian Cuisine Data Module
// Hundreds of authentic dishes, drinks, and categories
// ============================================================

// Universal categories that apply to all restaurants
module.exports.categories = [
  { id: 'cat-wot', name: 'Wot (Stews)', nameAm: 'ወጥ', icon: '🍲', sortOrder: 1 },
  { id: 'cat-tibs', name: 'Tibs & Grilled', nameAm: 'ጥብስ', icon: '🥩', sortOrder: 2 },
  { id: 'cat-kitfo', name: 'Kitfo & Raw', nameAm: 'ክፍቶ', icon: '🥩', sortOrder: 3 },
  { id: 'cat-vegan', name: 'Vegan & Lentil', nameAm: 'ረገማ ምግብ', icon: '🌿', sortOrder: 4 },
  { id: 'cat-injera-dishes', name: 'Injera Specials', nameAm: 'እንጀራ', icon: '🫓', sortOrder: 5 },
  { id: 'cat-breakfast', name: 'Breakfast', nameAm: 'ቁርስ', icon: '🍳', sortOrder: 6 },
  { id: 'cat-soups', name: 'Soups & Broths', nameAm: 'ሾርባ', icon: '🍜', sortOrder: 7 },
  { id: 'cat-appetizer', name: 'Appetizers & Sides', nameAm: 'መክሰስ', icon: '🥗', sortOrder: 8 },
  { id: 'cat-pasta', name: 'Pasta & Fusion', nameAm: 'ፓስታ', icon: '🍝', sortOrder: 9 },
  { id: 'cat-seafood', name: 'Fish & Seafood', nameAm: 'ዓሳ', icon: '🐟', sortOrder: 10 },
  { id: 'cat-coffee', name: 'Coffee & Tea', nameAm: 'ቡና', icon: '☕', sortOrder: 11 },
  { id: 'cat-hot-drinks', name: 'Hot Drinks', nameAm: 'ሞቅ ያለ መጠጥ', icon: '🍵', sortOrder: 12 },
  { id: 'cat-cold-drinks', name: 'Cold Drinks & Juices', nameAm: 'ቀዝቃዛ መጠጥ', icon: '🧃', sortOrder: 13 },
  { id: 'cat-traditional-drinks', name: 'Traditional Drinks', nameAm: 'ባህላዊ መጠጥ', icon: '🍺', sortOrder: 14 },
  { id: 'cat-dessert', name: 'Desserts & Sweets', nameAm: 'ፍሬ', icon: '🍰', sortOrder: 15 },
  { id: 'cat-cocktail', name: 'Cocktails', nameAm: 'ኮክቴል', icon: '🍸', sortOrder: 16 },
];

// Each restaurant gets a menu with items selected from this pool
// Items have a `restaurants` field — array of restaurant IDs that serve this item
// Use '*' for items available at all restaurants
module.exports.menuItems = [
  // ====================== WOT (STEWs) ======================
  { name: 'Doro Wot', nameAm: 'ዶሮ ወጥ', catId: 'cat-wot', desc: 'The crown jewel of Ethiopian cuisine — slow-cooked chicken in rich berbere sauce with hard-boiled eggs, served on injera. Takes 4-6 hours to prepare.', price: 380, prepTime: 45, isPopular: true, isVegetarian: false, isSpicy: true, restaurants: '*' },
  { name: 'Sega Wot', nameAm: 'ስጋ ወጥ', catId: 'cat-wot', desc: 'Tender beef chunks simmered in berbere-infused sauce with onions, garlic, and traditional spices', price: 320, prepTime: 40, isPopular: true, isVegetarian: false, isSpicy: true, restaurants: '*' },
  { name: 'Yebeg Wot', nameAm: 'የበግ ወጥ', catId: 'cat-wot', desc: 'Slow-braised lamb in aromatic berbere sauce with rosemary and a hint of cardamom', price: 350, prepTime: 45, isPopular: false, isVegetarian: false, isSpicy: true, restaurants: '*' },
  { name: 'Key Wot', nameAm: 'ቀይ ወጥ', catId: 'cat-wot', desc: 'Spicy red beef stew with generous berbere, niter kibbeh, and caramelized onions', price: 300, prepTime: 35, isPopular: true, isVegetarian: false, isSpicy: true, restaurants: '*' },
  { name: 'Doro Wot Special', nameAm: 'ልዩ ዶሮ ወጥ', catId: 'cat-wot', desc: 'Premium doro wot with organic free-range chicken and extra berbere layers', price: 480, prepTime: 50, isPopular: true, isVegetarian: false, isSpicy: true, restaurants: ['rest-habesha', 'rest-yod-abyssinia', 'rest-entsoto'] },
  { name: 'Kai Wot with Metin', nameAm: 'ቀይ ወጥ ሜጥን', catId: 'cat-wot', desc: 'Red pepper stew with crumbled cottage cheese on top', price: 280, prepTime: 30, isPopular: false, isVegetarian: false, isSpicy: true, restaurants: ['rest-habesha', 'rest-lalibela', 'rest-harar-gate'] },
  { name: 'Gored Gored', nameAm: 'ጎረድ ጎረድ', catId: 'cat-wot', desc: 'Raw cubed beef marinated in mitmita and niter kibbeh, topped with awaze', price: 400, prepTime: 10, isPopular: true, isVegetarian: false, isSpicy: true, restaurants: ['rest-habesha', 'rest-blue-nile', 'rest-yod-abyssinia'] },
  { name: 'Quanta Wot', nameAm: 'ቋንጣ ወጥ', catId: 'cat-wot', desc: 'Dried beef jerky stew with berbere — a rich, concentrated flavor from sun-dried meat', price: 350, prepTime: 35, isPopular: false, isVegetarian: false, isSpicy: true, restaurants: ['rest-habesha', 'rest-aster-kitchen', 'rest-lalibela'] },
  { name: 'Dulet Wot', nameAm: 'ዱለት ወጥ', catId: 'cat-wot', desc: 'Spicy tripe, liver, and lamb mix with peppers and berbere', price: 290, prepTime: 25, isPopular: true, isVegetarian: false, isSpicy: true, restaurants: '*' },
  { name: 'Beg Wot Keyih', nameAm: 'በግ ወጥ ቀይ', catId: 'cat-wot', desc: 'Spicy red lamb stew with rosemary and traditional spices', price: 340, prepTime: 40, isPopular: false, isVegetarian: false, isSpicy: true, restaurants: ['rest-yod-abyssinia', 'rest-lalibela', 'rest-entsoto'] },

  // ====================== TIBS & GRILLED ======================
  { name: 'Tibs', nameAm: 'ጥብስ', catId: 'cat-tibs', desc: 'Pan-fried cubed beef with onions, peppers, and rosemary — the quintessential Ethiopian grilled meat dish', price: 320, prepTime: 20, isPopular: true, isVegetarian: false, isSpicy: false, restaurants: '*' },
  { name: 'Tibs Special', nameAm: 'ልዩ ጥብስ', catId: 'cat-tibs', desc: 'Premium tibs with tenderloin, extra vegetables, and a splash of awaze sauce', price: 420, prepTime: 22, isPopular: true, isVegetarian: false, isSpicy: false, restaurants: ['rest-habesha', 'rest-blue-nile', 'rest-yod-abyssinia', 'rest-entsoto'] },
  { name: 'Yebeg Tibs', nameAm: 'የበግ ጥብስ', catId: 'cat-tibs', desc: 'Pan-fried lamb with onions, rosemary, and green chilies', price: 360, prepTime: 20, isPopular: true, isVegetarian: false, isSpicy: false, restaurants: '*' },
  { name: 'Kitfo Tibs', nameAm: 'ክፍቶ ጥብስ', catId: 'cat-tibs', desc: 'Lightly cooked minced beef tibs with butter and mitmita', price: 380, prepTime: 15, isPopular: false, isVegetarian: false, isSpicy: true, restaurants: ['rest-habesha', 'rest-yod-abyssinia', 'rest-lalibela'] },
  { name: 'Zilzil Tibs', nameAm: 'ዝልዝል ጥብስ', catId: 'cat-tibs', desc: 'Strips of marinated beef grilled on charcoal with jalapeños', price: 340, prepTime: 18, isPopular: true, isVegetarian: false, isSpicy: false, restaurants: ['rest-habesha', 'rest-blue-nile', 'rest-rift-valley'] },
  { name: 'Awaze Tibs', nameAm: 'አዋዜ ጥብስ', catId: 'cat-tibs', desc: 'Beef tibs glazed in spicy awaze pepper paste with garlic', price: 350, prepTime: 20, isPopular: true, isVegetarian: false, isSpicy: true, restaurants: '*' },
  { name: 'Dereq Tibs', nameAm: 'ደረቅ ጥብስ', catId: 'cat-tibs', desc: 'Dry-fried crispy beef with green chilies and onions', price: 300, prepTime: 18, isPopular: false, isVegetarian: false, isSpicy: true, restaurants: ['rest-blue-nile', 'rest-harar-gate', 'rest-sheba-lounge'] },
  { name: 'Beef Steak Ethiopian Style', nameAm: 'ስቴክ', catId: 'cat-tibs', desc: 'Thick-cut beef steak grilled with berbere butter and served with sautéed vegetables', price: 500, prepTime: 25, isPopular: false, isVegetarian: false, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-entsoto'] },
  { name: 'Lamb Chops', nameAm: 'የበግ አጥንት', catId: 'cat-tibs', desc: 'Grilled lamb chops marinated in rosemary, garlic, and Ethiopian spices', price: 550, prepTime: 25, isPopular: true, isVegetarian: false, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-entsoto', 'rest-sheba-lounge'] },

  // ====================== KITFO & RAW ======================
  { name: 'Kitfo (Raw)', nameAm: 'ክፍቶ ሕያው', catId: 'cat-kitfo', desc: 'Premium raw minced beef with mitmita spice and niter kibbeh — Ethiopian steak tartare', price: 350, prepTime: 10, isPopular: true, isVegetarian: false, isSpicy: true, restaurants: '*' },
  { name: 'Kitfo Lebleb', nameAm: 'ክፍቶ ሌበሌብ', catId: 'cat-kitfo', desc: 'Lightly warmed kitfo — rare minced beef with spices', price: 350, prepTime: 12, isPopular: true, isVegetarian: false, isSpicy: true, restaurants: '*' },
  { name: 'Kitfo Fully Cooked', nameAm: 'ክፍቶ ተጠብሷል', catId: 'cat-kitfo', desc: 'Fully cooked minced beef with mitmita for those who prefer it well done', price: 350, prepTime: 15, isPopular: false, isVegetarian: false, isSpicy: true, restaurants: '*' },
  { name: 'Kitfo with Kocho', nameAm: 'ክፍቶ ከቆቾ', catId: 'cat-kitfo', desc: 'Kitfo served on kocho (enset bread) — a Gurage specialty', price: 380, prepTime: 12, isPopular: true, isVegetarian: false, isSpicy: true, restaurants: ['rest-habesha', 'rest-lalibela', 'rest-wolkite-queen'] },
  { name: 'Kurt (Raw Meat)', nameAm: 'ኩርት', catId: 'cat-kitfo', desc: 'Traditional raw beef strips dipped in awaze or mitmita sauce — for the adventurous', price: 300, prepTime: 5, isPopular: false, isVegetarian: false, isSpicy: true, restaurants: ['rest-habesha', 'rest-yod-abyssinia', 'rest-harar-gate'] },

  // ====================== VEGAN & LENTIL ======================
  { name: 'Shiro', nameAm: 'ሽሮ', catId: 'cat-vegan', desc: 'Creamy chickpea flour stew with garlic, ginger, and onions — Ethiopia\'s beloved comfort food', price: 180, prepTime: 25, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Shiro Wot with Mitin', nameAm: 'ሽሮ ወጥ ሜጥን', catId: 'cat-vegan', desc: 'Rich shiro topped with crumbled cottage cheese', price: 200, prepTime: 25, isPopular: false, isVegetarian: false, isSpicy: false, restaurants: ['rest-habesha', 'rest-lalibela', 'rest-aster-kitchen'] },
  { name: 'Misir Wot', nameAm: 'ምስር ወጥ', catId: 'cat-vegan', desc: 'Spicy red lentil stew with berbere — a fasting staple', price: 160, prepTime: 30, isPopular: true, isVegetarian: true, isSpicy: true, restaurants: '*' },
  { name: 'Kik Wot', nameAm: 'ክክ ወጥ', catId: 'cat-vegan', desc: 'Yellow split pea stew with turmeric and garlic', price: 150, prepTime: 25, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Gomen', nameAm: 'ጎመን', catId: 'cat-vegan', desc: 'Collard greens sautéed with garlic, ginger, and onions', price: 140, prepTime: 20, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Atkilt Wot', nameAm: 'አትክልት ወጥ', catId: 'cat-vegan', desc: 'Mixed vegetable stew with potatoes, carrots, and cabbage in turmeric sauce', price: 160, prepTime: 20, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Fosolia', nameAm: 'ፎሶሊያ', catId: 'cat-vegan', desc: 'Green beans and carrots sautéed with garlic and rosemary', price: 140, prepTime: 15, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Dinich Wot', nameAm: 'ድንች ወጥ', catId: 'cat-vegan', desc: 'Spicy potato stew with berbere and garlic', price: 130, prepTime: 20, isPopular: false, isVegetarian: true, isSpicy: true, restaurants: '*' },
  { name: 'Keysir Alicha', nameAm: 'እንደርት አሊጫ', catId: 'cat-vegan', desc: 'Mild beet stew with turmeric and ginger', price: 130, prepTime: 18, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-habesha', 'rest-lalibela', 'rest-entsoto'] },
  { name: 'Timatim Salata', nameAm: 'ቲማቲም ሰላጣ', catId: 'cat-vegan', desc: 'Fresh tomato salad with onions, jalapeños, and lemon dressing', price: 100, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Azifa', nameAm: 'አዚፋ', catId: 'cat-vegan', desc: 'Cold lentil salad with mustard, lemon, and green chilies', price: 120, prepTime: 10, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-habesha', 'rest-entsoto', 'rest-meskel-cafe'] },

  // ====================== INJERA SPECIALS ======================
  { name: 'Firfir', nameAm: 'ፍርፍር', catId: 'cat-injera-dishes', desc: 'Shredded injera tossed in spicy berbere sauce with butter and onions', price: 200, prepTime: 15, isPopular: true, isVegetarian: true, isSpicy: true, restaurants: '*' },
  { name: 'Firfir with Egg', nameAm: 'ፍርፍር ከእንቁላል', catId: 'cat-injera-dishes', desc: 'Spicy firfir topped with fried egg', price: 230, prepTime: 18, isPopular: true, isVegetarian: false, isSpicy: true, restaurants: '*' },
  { name: 'Quanta Firfir', nameAm: 'ቋንጣ ፍርፍር', catId: 'cat-injera-dishes', desc: 'Firfir with dried beef jerky — an intensely flavored combination', price: 280, prepTime: 18, isPopular: true, isVegetarian: false, isSpicy: true, restaurants: ['rest-habesha', 'rest-yod-abyssinia', 'rest-aster-kitchen'] },
  { name: 'Enkulal Firfir', nameAm: 'እንቁላል ፍርፍር', catId: 'cat-injera-dishes', desc: 'Scrambled eggs with shredded injera and berbere', price: 180, prepTime: 10, isPopular: false, isVegetarian: false, isSpicy: true, restaurants: '*' },
  { name: 'Fata', nameAm: 'ፋታ', catId: 'cat-injera-dishes', desc: 'Torn injera soaked in rich wot sauce with garlic and pepper — a Harari specialty', price: 170, prepTime: 12, isPopular: false, isVegetarian: true, isSpicy: true, restaurants: ['rest-harar-gate', 'rest-lalibela', 'rest-aster-kitchen'] },
  { name: 'Beye Aynet', nameAm: 'በየ አይነት', catId: 'cat-injera-dishes', desc: 'Mixed platter of various wots on a single injera — sampler of all flavors', price: 450, prepTime: 30, isPopular: true, isVegetarian: false, isSpicy: true, restaurants: ['rest-habesha', 'rest-yod-abyssinia', 'rest-lalibela'] },

  // ====================== BREAKFAST ======================
  { name: 'Ful Medames', nameAm: 'ፉል', catId: 'cat-breakfast', desc: 'Slow-cooked fava beans with onions, tomatoes, green chilies, olive oil, and cumin', price: 150, prepTime: 15, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Ful Special', nameAm: 'ልዩ ፉል', catId: 'cat-breakfast', desc: 'Fava beans topped with egg, yogurt, and feta cheese', price: 200, prepTime: 18, isPopular: true, isVegetarian: false, isSpicy: false, restaurants: ['rest-habesha', 'rest-blue-nile', 'rest-meskel-cafe'] },
  { name: 'Chechebsa', nameAm: 'ቸቸብሳ', catId: 'cat-breakfast', desc: 'Shredded flatbread (kita) with spiced butter and berbere — a traditional Oromo breakfast', price: 160, prepTime: 12, isPopular: true, isVegetarian: true, isSpicy: true, restaurants: ['rest-habesha', 'rest-lalibela', 'rest-entsoto', 'rest-aster-kitchen'] },
  { name: 'Kinche', nameAm: 'ቂንጬ', catId: 'cat-breakfast', desc: 'Cracked wheat porridge with niter kibbeh and onions', price: 120, prepTime: 15, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Genfo', nameAm: 'ገንፎ', catId: 'cat-breakfast', desc: 'Thick porridge of barley or wheat flour with spiced butter and berbere center', price: 130, prepTime: 12, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-aster-kitchen', 'rest-lalibela', 'rest-wolkite-queen'] },
  { name: 'Enkulal Tibs (Breakfast)', nameAm: 'እንቁላል ጥብስ', catId: 'cat-breakfast', desc: 'Scrambled or fried eggs with onions, tomatoes, and green chilies', price: 140, prepTime: 8, isPopular: true, isVegetarian: false, isSpicy: false, restaurants: '*' },
  { name: 'Fatira', nameAm: 'ፋጥራ', catId: 'cat-breakfast', desc: 'Flaky layered pastry with egg and honey — a Harari morning favorite', price: 160, prepTime: 15, isPopular: false, isVegetarian: false, isSpicy: false, restaurants: ['rest-harar-gate', 'rest-blue-nile'] },
  { name: 'Kita Firfir', nameAm: 'ቂጣ ፍርፍር', catId: 'cat-breakfast', desc: 'Shredded flatbread with berbere and butter — rustic breakfast', price: 130, prepTime: 10, isPopular: false, isVegetarian: true, isSpicy: true, restaurants: ['rest-aster-kitchen', 'rest-wolkite-queen'] },

  // ====================== SOUPS & BROTHS ======================
  { name: 'Shorba', nameAm: 'ሾርባ', catId: 'cat-soups', desc: 'Hearty lentil soup with carrots, onions, and warming spices', price: 100, prepTime: 20, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Doro Shorba', nameAm: 'ዶሮ ሾርባ', catId: 'cat-soups', desc: 'Chicken broth with vegetables and traditional herbs', price: 140, prepTime: 25, isPopular: false, isVegetarian: false, isSpicy: false, restaurants: ['rest-habesha', 'rest-yod-abyssinia', 'rest-lalibela'] },
  { name: 'Egg Drop Soup', nameAm: 'የእንቁላል ሾርባ', catId: 'cat-soups', desc: 'Light chicken broth with ribboned egg and lemongrass', price: 120, prepTime: 10, isPopular: false, isVegetarian: false, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-sheba-lounge'] },

  // ====================== APPETIZERS & SIDES ======================
  { name: 'Sambusa', nameAm: 'ሳምቡሳ', catId: 'cat-appetizer', desc: 'Crispy golden triangle with spiced lentil filling', price: 80, prepTime: 10, isPopular: true, isVegetarian: true, isSpicy: true, restaurants: '*' },
  { name: 'Sambusa (Meat)', nameAm: 'ሳምቡሳ ስጋ', catId: 'cat-appetizer', desc: 'Crispy pastry with seasoned minced beef filling', price: 100, prepTime: 10, isPopular: true, isVegetarian: false, isSpicy: true, restaurants: '*' },
  { name: 'Dabbo Kolo', nameAm: 'ዳቦ ቆሎ', catId: 'cat-appetizer', desc: 'Snack-sized fried bread bites with berbere spice coating', price: 60, prepTime: 8, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Timita Salata', nameAm: 'ቲማቲም ሰላጣ', catId: 'cat-appetizer', desc: 'Fresh tomato and onion salad with lime and chili', price: 80, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Kolo', nameAm: 'ቆሎ', catId: 'cat-appetizer', desc: 'Roasted barley snack mix — traditional Ethiopian bar snack', price: 50, prepTime: 3, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-sheba-lounge', 'rest-harar-gate', 'rest-habesha'] },
  { name: 'Himbasha', nameAm: 'ህምባሻ', catId: 'cat-appetizer', desc: 'Decorative sweet bread with cardamom — Tigrayan special occasion bread', price: 90, prepTime: 15, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-lalibela', 'rest-habesha', 'rest-meskel-cafe'] },
  { name: 'Ambasha', nameAm: 'አምባሻ', catId: 'cat-appetizer', desc: 'Large festive sweet bread with fenugreek and cardamom', price: 100, prepTime: 15, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-habesha', 'rest-yod-abyssinia'] },

  // ====================== PASTA & FUSION ======================
  { name: 'Pasta with Salsa', nameAm: 'ፓስታ ሳልሳ', catId: 'cat-pasta', desc: 'Spaghetti with berbere-spiced tomato sauce — an Italian-Ethiopian fusion classic', price: 180, prepTime: 15, isPopular: false, isVegetarian: true, isSpicy: true, restaurants: '*' },
  { name: 'Pasta with Meat Sauce', nameAm: 'ፓስታ ስጋ', catId: 'cat-pasta', desc: 'Spaghetti with savory minced beef sauce', price: 220, prepTime: 18, isPopular: false, isVegetarian: false, isSpicy: false, restaurants: '*' },
  { name: 'Shakshouka', nameAm: 'ሻክሹካ', catId: 'cat-pasta', desc: 'Eggs poached in spiced tomato sauce with injera or bread', price: 200, prepTime: 15, isPopular: true, isVegetarian: false, isSpicy: true, restaurants: ['rest-blue-nile', 'rest-harar-gate', 'rest-sheba-lounge'] },
  { name: 'Macaroni Alicha', nameAm: 'ማካሮኒ አሊጫ', catId: 'cat-pasta', desc: 'Macaroni in mild turmeric sauce with vegetables', price: 160, prepTime: 12, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-aster-kitchen', 'rest-wolkite-queen'] },

  // ====================== FISH & SEAFOOD ======================
  { name: 'Asa Tibs', nameAm: 'ዓሳ ጥብስ', catId: 'cat-seafood', desc: 'Pan-fried fish fillet with garlic, lemon, and green chilies', price: 300, prepTime: 18, isPopular: true, isVegetarian: false, isSpicy: false, restaurants: ['rest-rift-valley', 'rest-blue-nile', 'rest-entsoto'] },
  { name: 'Asa Wot', nameAm: 'ዓሳ ወጥ', catId: 'cat-seafood', desc: 'Fish stew in berbere sauce with hard-boiled egg', price: 320, prepTime: 30, isPopular: false, isVegetarian: false, isSpicy: true, restaurants: ['rest-rift-valley', 'rest-lalibela'] },
  { name: 'Grilled Tilapia', nameAm: 'የተጠበሰ ቲላፒያ', catId: 'cat-seafood', desc: 'Whole grilled tilapia from Lake Langano with lime and spices', price: 450, prepTime: 25, isPopular: true, isVegetarian: false, isSpicy: false, restaurants: ['rest-rift-valley'] },
  { name: 'Fish and Chips Ethiopian', nameAm: 'ዓሳ እና ቺፕስ', catId: 'cat-seafood', desc: 'Beer-battered fish fillet with spiced potato wedges', price: 280, prepTime: 20, isPopular: false, isVegetarian: false, isSpicy: false, restaurants: ['rest-rift-valley', 'rest-blue-nile'] },
  { name: 'Shrimp Tibs', nameAm: 'ስልጠ ጥብስ', catId: 'cat-seafood', desc: 'Sautéed shrimp with garlic butter, rosemary, and berbere', price: 420, prepTime: 15, isPopular: true, isVegetarian: false, isSpicy: false, restaurants: ['rest-rift-valley', 'rest-blue-nile', 'rest-sheba-lounge'] },

  // ====================== COFFEE & TEA ======================
  { name: 'Ethiopian Coffee', nameAm: 'የኢትዮጵያ ቡና', catId: 'cat-coffee', desc: 'Freshly roasted and brewed Ethiopian coffee ceremony style', price: 60, prepTime: 15, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Macchiato', nameAm: 'ማኪያቶ', catId: 'cat-coffee', desc: 'Espresso with a splash of steamed milk — Addis style', price: 50, prepTime: 5, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Buna Salaam (Iced Coffee)', nameAm: 'ቡና ሰላም', catId: 'cat-coffee', desc: 'Cold-brewed Ethiopian coffee over ice', price: 70, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-meskel-cafe', 'rest-blue-nile', 'rest-sheba-lounge'] },
  { name: 'Spris (Layered Coffee)', nameAm: 'ስፕሪስ', catId: 'cat-coffee', desc: 'Layered coffee and tea in one glass — half macchiato, half tea', price: 60, prepTime: 5, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: ['rest-meskel-cafe', 'rest-sheba-lounge'] },
  { name: 'Coffee Ceremony (Full)', nameAm: 'የቡና ስርዓት', catId: 'cat-coffee', desc: 'Traditional 3-cup coffee ceremony with incense and popcorn — for 2-4 people', price: 200, prepTime: 30, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: ['rest-habesha', 'rest-yod-abyssinia', 'rest-meskel-cafe', 'rest-entsoto'] },
  { name: 'Yirgacheffe Single Origin', nameAm: 'ይርጋጨፌ', catId: 'cat-coffee', desc: 'Premium single-origin pour-over from Yirgacheffe region — floral and citrus notes', price: 120, prepTime: 10, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: ['rest-meskel-cafe', 'rest-entsoto', 'rest-blue-nile'] },
  { name: 'Sidamo Single Origin', nameAm: 'ሲዳሞ', catId: 'cat-coffee', desc: 'Full-bodied pour-over from Sidamo — chocolate and berry notes', price: 110, prepTime: 10, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-meskel-cafe', 'rest-entsoto'] },
  { name: 'Harrar Single Origin', nameAm: 'ሐረር', catId: 'cat-coffee', desc: 'Wild and fruity Harrar coffee — blueberry and wine notes', price: 110, prepTime: 10, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-meskel-cafe', 'rest-harar-gate'] },

  // ====================== HOT DRINKS ======================
  { name: 'Shai (Tea)', nameAm: 'ሻይ', catId: 'cat-hot-drinks', desc: 'Ethiopian black tea with spices — cinnamon, cardamom, and cloves', price: 30, prepTime: 5, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Spiced Tea', nameAm: 'ቅመማ ሻይ', catId: 'cat-hot-drinks', desc: 'Black tea with extra ginger, cinnamon, and honey', price: 40, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Hot Chocolate', nameAm: 'ሞቅ ያለ ቸኮሌት', catId: 'cat-hot-drinks', desc: 'Rich dark hot chocolate made with Ethiopian cacao', price: 80, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-meskel-cafe', 'rest-blue-nile', 'rest-sheba-lounge'] },
  { name: 'Atmit', nameAm: 'አጥሚት', catId: 'cat-hot-drinks', desc: 'Warm oat and barley drink with honey and butter — Ethiopian comfort drink', price: 60, prepTime: 8, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-aster-kitchen', 'rest-lalibela', 'rest-wolkite-queen'] },

  // ====================== COLD DRINKS & JUICES ======================
  { name: 'Mango Juice', nameAm: 'የማንጎ ጭማቂ', catId: 'cat-cold-drinks', desc: 'Fresh pressed mango juice', price: 70, prepTime: 5, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Avocado Juice', nameAm: 'አቮካዶ ጭማቂ', catId: 'cat-cold-drinks', desc: 'Creamy blended avocado with milk and sugar', price: 80, prepTime: 5, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Papaya Juice', nameAm: 'ፓፓያ ጭማቂ', catId: 'cat-cold-drinks', desc: 'Fresh papaya juice with a hint of lime', price: 60, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Orange Juice', nameAm: 'ብርቱካን ጭማቂ', catId: 'cat-cold-drinks', desc: 'Freshly squeezed orange juice', price: 60, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Pineapple Juice', nameAm: 'አናናስ ጭማቂ', catId: 'cat-cold-drinks', desc: 'Fresh pineapple juice', price: 70, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Mixed Fruit Juice', nameAm: 'ድንች ፍሬ ጭማቂ', catId: 'cat-cold-drinks', desc: 'Blend of mango, papaya, and passion fruit', price: 90, prepTime: 5, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-entsoto', 'rest-sheba-lounge'] },
  { name: 'Lemonade', nameAm: 'ሎሚናድ', catId: 'cat-cold-drinks', desc: 'Fresh lemonade with mint and honey', price: 50, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Mineral Water', nameAm: 'ውሃ', catId: 'cat-cold-drinks', desc: 'Bottled mineral water', price: 25, prepTime: 1, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Coca Cola', nameAm: 'ኮካ ኮላ', catId: 'cat-cold-drinks', desc: 'Classic Coca-Cola', price: 30, prepTime: 1, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Sprite', nameAm: 'ስፕራይት', catId: 'cat-cold-drinks', desc: 'Sprite lemon-lime soda', price: 30, prepTime: 1, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Fanta Orange', nameAm: 'ፋንታ', catId: 'cat-cold-drinks', desc: 'Fanta orange soda', price: 30, prepTime: 1, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Ambo Mineral Water', nameAm: 'አምቦ ውሃ', catId: 'cat-cold-drinks', desc: 'Ethiopia\'s famous naturally sparkling mineral water from Ambo', price: 35, prepTime: 1, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: '*' },

  // ====================== TRADITIONAL DRINKS ======================
  { name: 'Tej', nameAm: 'ጠጀ', catId: 'cat-traditional-drinks', desc: 'Traditional Ethiopian honey wine — sweet, golden, and potent. Served in a berele', price: 150, prepTime: 3, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: ['rest-habesha', 'rest-yod-abyssinia', 'rest-harar-gate', 'rest-lalibela'] },
  { name: 'Tella', nameAm: 'ጠላ', catId: 'cat-traditional-drinks', desc: 'Traditional Ethiopian homebrewed beer from barley and gesho', price: 80, prepTime: 3, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-habesha', 'rest-yod-abyssinia', 'rest-harar-gate', 'rest-aster-kitchen'] },
  { name: 'Borde', nameAm: 'ቦርዴ', catId: 'cat-traditional-drinks', desc: 'Fermented grain drink from southern Ethiopia — slightly sour and refreshing', price: 60, prepTime: 3, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-lalibela', 'rest-wolkite-queen', 'rest-yod-abyssinia'] },
  { name: 'Areke', nameAm: 'አረቄ', catId: 'cat-traditional-drinks', desc: 'Ethiopian distilled spirit from grain — strong and clear', price: 100, prepTime: 3, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-habesha', 'rest-yod-abyssinia', 'rest-harar-gate'] },
  { name: 'Korefe', nameAm: 'ኮረፈ', catId: 'cat-traditional-drinks', desc: 'Traditional fermented drink from the Afar region', price: 70, prepTime: 3, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-lalibela', 'rest-yod-abyssinia'] },
  { name: 'Chala', nameAm: 'ቻላ', catId: 'cat-traditional-drinks', desc: 'Fermented sorghum drink from Wolaita — mild and tangy', price: 60, prepTime: 3, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-wolkite-queen', 'rest-lalibela'] },

  // ====================== DESSERTS & SWEETS ======================
  { name: 'Honey Bread', nameAm: 'የማር ዳቦ', catId: 'cat-dessert', desc: 'Traditional sweet bread with Ethiopian honey', price: 100, prepTime: 10, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Baklava', nameAm: 'ባክላቫ', catId: 'cat-dessert', desc: 'Flaky pastry with nuts and honey syrup', price: 120, prepTime: 5, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: ['rest-habesha', 'rest-blue-nile', 'rest-harar-gate'] },
  { name: 'Ice Cream', nameAm: 'አይስ ክሪም', catId: 'cat-dessert', desc: 'Vanilla ice cream with fresh fruits', price: 90, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Tiramisu Ethiopian', nameAm: 'ቲራሚሱ', catId: 'cat-dessert', desc: 'Classic tiramisu with Ethiopian coffee liqueur', price: 150, prepTime: 5, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-sheba-lounge'] },
  { name: 'Banana Split', nameAm: 'ባናና ስፕሊት', catId: 'cat-dessert', desc: 'Split banana with ice cream, chocolate, and nuts', price: 120, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-sheba-lounge'] },
  { name: 'Date Cake', nameAm: 'የቀኔ ኬክ', catId: 'cat-dessert', desc: 'Rich date cake with cardamom and walnuts', price: 110, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-harar-gate', 'rest-blue-nile', 'rest-meskel-cafe'] },
  { name: 'Kita with Honey', nameAm: 'ቂጣ ከማር', catId: 'cat-dessert', desc: 'Flatbread drizzled with Ethiopian wild honey', price: 80, prepTime: 8, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-aster-kitchen', 'rest-wolkite-queen', 'rest-lalibela'] },
  { name: 'Fruit Salad', nameAm: 'ፍራፍሮ ሰላጣ', catId: 'cat-dessert', desc: 'Seasonal tropical fruits with honey and lime', price: 90, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Cheesecake', nameAm: 'ቸዝኬክ', catId: 'cat-dessert', desc: 'New York style cheesecake with passion fruit coulis', price: 140, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-sheba-lounge'] },
  { name: 'Basbousa', nameAm: 'ባስቡሳ', catId: 'cat-dessert', desc: 'Semolina cake soaked in rose syrup — a Harari specialty', price: 100, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-harar-gate', 'rest-blue-nile'] },

  // ====================== COCKTAILS ======================
  { name: 'Tej Spritz', nameAm: 'ጠጀ ስፕሪትዝ', catId: 'cat-cocktail', desc: 'Ethiopian honey wine with prosecco and soda — sparkling and sweet', price: 200, prepTime: 5, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-sheba-lounge'] },
  { name: 'Addis Mule', nameAm: 'አዲስ ሙል', catId: 'cat-cocktail', desc: 'Vodka, lime, and ginger beer with a berbere rim', price: 220, prepTime: 5, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-sheba-lounge'] },
  { name: 'Rift Valley Sunset', nameAm: 'ረፍት ሸለቆ ፀሐይ', catId: 'cat-cocktail', desc: 'Rum, passion fruit, orange, and grenadine', price: 240, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-sheba-lounge'] },
  { name: 'Spiced Espresso Martini', nameAm: 'ኤስፕሬሶ ማርቲኒ', catId: 'cat-cocktail', desc: 'Vodka, Ethiopian coffee liqueur, and cardamom', price: 250, prepTime: 5, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-sheba-lounge'] },
  { name: 'Blue Nile Breeze', nameAm: 'ሰማያዊ ናይል', catId: 'cat-cocktail', desc: 'Gin, blue curacao, lemon, and soda', price: 230, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-sheba-lounge'] },
  { name: 'Mitmita Margarita', nameAm: 'ሚጥሚጣ ማርጋሪታ', catId: 'cat-cocktail', desc: 'Tequila with lime and mitmita-spiced salt rim — fiery and refreshing', price: 240, prepTime: 5, isPopular: true, isVegetarian: true, isSpicy: true, restaurants: ['rest-sheba-lounge'] },
  { name: 'Lalibela Old Fashioned', nameAm: 'ላሊበላ ኦልድ ፋሽንድ', catId: 'cat-cocktail', desc: 'Bourbon, tej syrup, and bitters with Ethiopian rosemary', price: 260, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-sheba-lounge'] },
  { name: 'Ethiopian Negroni', nameAm: 'ኢትዮጵያዊ ኔግሮኒ', catId: 'cat-cocktail', desc: 'Gin, campari, and tej-infused sweet vermouth', price: 250, prepTime: 5, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-sheba-lounge'] },

  // ====================== BEER & WINE ======================
  { name: 'Dashen Beer', nameAm: 'ዳሸን ቢራ', catId: 'cat-traditional-drinks', desc: 'Ethiopia\'s premium lager beer', price: 50, prepTime: 2, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Harar Beer', nameAm: 'ሐረር ቢራ', catId: 'cat-traditional-drinks', desc: 'Classic Ethiopian beer from Harar', price: 45, prepTime: 2, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Meta Beer', nameAm: 'ሜታ ቢራ', catId: 'cat-traditional-drinks', desc: 'Premium Ethiopian beer from Meta Brewery', price: 50, prepTime: 2, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-sheba-lounge', 'rest-rift-valley'] },
  { name: 'St. George Beer', nameAm: 'ቅዱስ ጊዮርጊስ ቢራ', catId: 'cat-traditional-drinks', desc: 'Ethiopia\'s most popular beer brand', price: 40, prepTime: 2, isPopular: true, isVegetarian: true, isSpicy: false, restaurants: '*' },
  { name: 'Castel Beer', nameAm: 'ካስቴል ቢራ', catId: 'cat-traditional-drinks', desc: 'Premium Ethiopian-French beer', price: 55, prepTime: 2, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-sheba-lounge'] },
  { name: 'Rift Valley Wine (Red)', nameAm: 'ረፍት ሸለቆ ወይን', catId: 'cat-traditional-drinks', desc: 'Ethiopian red wine from Rift Valley Winery', price: 150, prepTime: 2, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-entsoto', 'rest-sheba-lounge'] },
  { name: 'Rift Valley Wine (White)', nameAm: 'ረፍት ሸለቆ ነጭ ወይን', catId: 'cat-traditional-drinks', desc: 'Ethiopian white wine — crisp and fruity', price: 150, prepTime: 2, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-entsoto', 'rest-sheba-lounge'] },
  { name: 'Axumit Wine', nameAm: 'አክሱሚት ወይን', catId: 'cat-traditional-drinks', desc: 'Premium Ethiopian dry red wine', price: 200, prepTime: 2, isPopular: false, isVegetarian: true, isSpicy: false, restaurants: ['rest-blue-nile', 'rest-entsoto', 'rest-sheba-lounge'] },
];
