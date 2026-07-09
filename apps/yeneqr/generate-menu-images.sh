#!/bin/bash
# Generate AI images for all 124 unique menu items
# Run one at a time to avoid rate limits

DIR="./public/images/menu"
mkdir -p "$DIR"

generate() {
  local name="$1"
  local prompt="$2"
  local file="$DIR/$name.png"
  
  if [ -f "$file" ]; then
    echo "SKIP: $name (already exists)"
    return
  fi
  
  echo "Generating: $name..."
  z-ai-generate -p "$prompt" -o "$file" -s 864x1152 2>&1 | tail -1
  
  # Small delay to avoid rate limiting
  sleep 2
}

# ========================
# ETHIOPIAN MAIN DISHES
# ========================

generate "doro-wot" "Professional food photography of Doro Wot, Ethiopian spicy chicken stew in dark red berbere sauce on injera, hard-boiled egg, traditional mesob, warm lighting, overhead shot, restaurant plating"

generate "doro-wot-special" "Professional food photography of Doro Wot Special, premium Ethiopian chicken stew with extra berbere sauce, two eggs, served on injera with side salads, elegant restaurant presentation, warm lighting"

generate "kitfo-raw" "Professional food photography of Kitfo raw, Ethiopian finely minced raw beef with mitmita spice and niter kibbeh butter on injera, kocho bread, fresh salads, top-down food photography, warm lighting"

generate "kitfo-lebleb" "Professional food photography of Kitfo Lebleb, Ethiopian lightly cooked minced beef with mitmita spice, pink center, served on injera, warm restaurant lighting, overhead shot"

generate "kitfo-fully-cooked" "Professional food photography of Kitfo Fully Cooked, Ethiopian well-done minced beef with spices, served on injera with sides, warm lighting, restaurant quality shot"

generate "kitfo-tibs" "Professional food photography of Kitfo Tibs, Ethiopian sauteed minced beef cubes with onions and peppers, sizzling hot, served with injera, warm lighting, close-up"

generate "kitfo-kocho" "Professional food photography of Kitfo with Kocho, Ethiopian raw minced beef served on kocho false banana bread instead of injera, traditional Gurage presentation, warm lighting"

generate "tibs" "Professional food photography of Tibs, Ethiopian sauteed beef cubes with onions tomatoes green peppers, sizzling hot, served with injera, rosemary garnish, warm lighting"

generate "tibs-special" "Professional food photography of Tibs Special, premium Ethiopian sauteed tender beef with fresh vegetables, sizzling plate presentation, injera, herbs, dramatic lighting"

generate "yebeg-tibs" "Professional food photography of Yebeg Tibs, Ethiopian sauteed lamb cubes with onions and peppers, sizzling hot, served on injera, warm restaurant lighting, appetizing"

generate "awaze-tibs" "Professional food photography of Awaze Tibs, Ethiopian spicy sauteed beef in awaze pepper paste sauce, rich dark red color, served with injera, warm lighting, overhead"

generate "dereq-tibs" "Professional food photography of Dereq Tibs, Ethiopian dry-fried beef tips crispy and golden, no sauce, served with injera and fresh salad, warm restaurant lighting"

generate "zilzil-tibs" "Professional food photography of Zilzil Tibs, Ethiopian thinly sliced rolled beef strips sauteed with spices, unique rolled presentation, served on injera, warm lighting"

generate "sega-wot" "Professional food photography of Sega Wot, Ethiopian beef stew in rich berbere sauce, dark red spicy gravy, served on injera, warm restaurant lighting, overhead shot"

generate "key-wot" "Professional food photography of Key Wot, Ethiopian spicy red beef stew with berbere, thick rich sauce, served on injera flatbread, warm lighting, restaurant food photography"

generate "beg-wot-keyih" "Professional food photography of Beg Wot Keyih, Ethiopian spicy lamb stew in red berbere sauce, tender lamb chunks, served on injera, warm lighting, overhead shot"

generate "yebeg-wot" "Professional food photography of Yebeg Wot, Ethiopian lamb stew in savory sauce, tender lamb pieces, served on spongy injera, warm restaurant lighting, appetizing"

generate "kik-wot" "Professional food photography of Kik Wot, Ethiopian split pea stew, yellow golden color, smooth creamy texture, served on injera, warm ambient lighting, overhead shot"

generate "dinich-wot" "Professional food photography of Dinich Wot, Ethiopian potato stew in spicy berbere sauce, chunky potatoes in red sauce, served on injera, warm lighting, restaurant style"

generate "gomen" "Professional food photography of Gomen, Ethiopian collard greens sauteed with garlic and spices, vibrant green color, served on injera, side dish, warm restaurant lighting"

generate "fosolia" "Professional food photography of Fosolia, Ethiopian string beans and carrots sauteed with onions, colorful vegetable dish, served on injera, warm lighting, vegetarian"

generate "atkilt-wot" "Professional food photography of Atkilt Wot, Ethiopian vegetable stew with potatoes carrots and cabbage in mild sauce, colorful, served on injera, warm lighting"

generate "azifa" "Professional food photography of Azifa, Ethiopian cold lentil salad with mustard and lime, green herbaceous color, fresh and tangy, side dish, warm restaurant lighting"

generate "shiro" "Professional food photography of Shiro, Ethiopian chickpea flour stew, smooth golden-brown consistency, served bubbling on injera, warm lighting, comfort food"

generate "shiro-wot-mitin" "Professional food photography of Shiro Wot with Mitin, enhanced Ethiopian chickpea stew with spiced butter and mitin seasoning, rich golden color, served on injera, warm lighting"

generate "misir-wot" "Professional food photography of Misir Wot, Ethiopian spicy red lentil stew, rich dark red from berbere, served on injera flatbread, side of vegetables, warm lighting"

generate "dulet-wot" "Professional food photography of Dulet Wot, Ethiopian spicy tripe and liver stew with onions and peppers, dark rich sauce, served on injera, warm restaurant lighting"

generate "quanta-wot" "Professional food photography of Quanta Wot, Ethiopian dried beef stew in spicy berbere sauce, jerky-like beef in rich sauce, served on injera, warm lighting"

generate "quanta-firfir" "Professional food photography of Quanta Firfir, Ethiopian shredded injera mixed with dried beef and spicy berbere sauce, dark red, served in traditional bowl, warm lighting"

generate "firfir" "Professional food photography of Firfir, Ethiopian shredded injera mixed with spicy berbere sauce and niter kibbeh, dark red color, traditional bowl, warm restaurant lighting"

generate "firfir-egg" "Professional food photography of Firfir with Egg, Ethiopian shredded injera with spicy sauce topped with fried egg, colorful presentation, warm lighting, overhead shot"

generate "kita-firfir" "Professional food photography of Kita Firfir, Ethiopian flatbread torn and mixed with spicy sauce and butter, rustic homestyle presentation, warm lighting"

generate "chechebsa" "Professional food photography of Chechebsa, Ethiopian shredded flatbread with spiced butter and berbere, golden crispy texture, served warm, breakfast dish, warm lighting"

generate "fatira" "Professional food photography of Fatira, Ethiopian large pan-fried flatbread with egg filling, golden crispy, cut into triangles, breakfast dish, warm lighting, overhead"

generate "genfo" "Professional food photography of Genfo, Ethiopian thick porridge made from barley or wheat flour, shaped in a mound with well of spiced butter, unique presentation, warm lighting"

generate "kinche" "Professional food photography of Kinche, Ethiopian cracked wheat porridge with niter kibbeh butter, simple wholesome bowl, warm breakfast comfort food, soft lighting"

generate "ful-medames" "Professional food photography of Ful Medames, Ethiopian fava bean stew with olive oil cumin and vegetables, served in bowl with fresh bread, warm lighting, Middle Eastern style"

generate "ful-special" "Professional food photography of Ful Special, premium Ethiopian fava beans with egg yogurt and feta cheese toppings, elaborate bowl presentation, warm lighting, colorful"

generate "enkulal-firfir" "Professional food photography of Enkulal Firfir, Ethiopian scrambled eggs with onions tomatoes and peppers, colorful skillet presentation, breakfast dish, warm lighting"

generate "enkulal-tibs" "Professional food photography of Enkulal Tibs breakfast, Ethiopian scrambled eggs with sauteed meat and vegetables, hearty breakfast skillet, warm restaurant lighting"

generate "shakshouka" "Professional food photography of Shakshouka, eggs poached in spiced tomato sauce, vibrant red sauce with runny eggs, served in cast iron skillet, warm lighting, overhead shot"

generate "fata" "Professional food photography of Fata, Ethiopian torn bread mixed with spicy berbere sauce and yogurt, served in traditional bowl, warm comfort food, warm lighting"

generate "kita-honey" "Professional food photography of Kita with Honey, Ethiopian flatbread served with golden honey drizzle, simple sweet breakfast, warm amber lighting, overhead shot"

generate "ambasha" "Professional food photography of Ambasha, Ethiopian sweet braided bread, golden brown crust, traditional celebration bread, sliced on wooden board, warm lighting"

generate "himbasha" "Professional food photography of Himbasha, Eritrean Ethiopian sweet flatbread with decorative pattern, golden top, sliced, festive bread on board, warm lighting"

generate "honey-bread" "Professional food photography of Ethiopian Honey Bread, sweet golden bread with honey glaze, sliced on rustic board, warm bakery lighting, appetizing"

# ========================
# MEAT & FISH DISHES
# ========================

generate "gored-gored" "Professional food photography of Gored Gored, Ethiopian raw cubed beef with mitmita spice and spiced butter, bright red fresh meat, served with injera, warm lighting"

generate "kurt-raw" "Professional food photography of Kurt, Ethiopian raw meat dish, fresh cubed beef served plain with dipping sauces, dramatic presentation, warm restaurant lighting"

generate "beef-steak-ethiopian" "Professional food photography of Ethiopian Style Beef Steak, grilled beef steak with berbere spice crust, served with vegetables and injera, warm lighting, elegant plating"

generate "lamb-chops" "Professional food photography of Ethiopian Spiced Lamb Chops, grilled lamb chops with berbere and rosemary marinade, char marks, served with sides, warm lighting"

generate "asa-tibs" "Professional food photography of Asa Tibs, Ethiopian sauteed fish with onions tomatoes and peppers, tilapia pieces, sizzling pan, served with injera, warm lighting"

generate "asa-wot" "Professional food photography of Asa Wot, Ethiopian fish stew in spicy berbere sauce, chunks of fish in red sauce, served on injera, warm restaurant lighting"

generate "grilled-tilapia" "Professional food photography of Grilled Tilapia Ethiopian style, whole grilled tilapia fish with spice rub, charred skin, served with injera and salad, dramatic lighting"

generate "fish-chips" "Professional food photography of Ethiopian Fish and Chips, crispy battered fish fillets with thick cut fries, served with spicy awaze sauce, warm casual dining lighting"

generate "shrimp-tibs" "Professional food photography of Shrimp Tibs, Ethiopian sauteed shrimp with onions peppers and spices, sizzling hot, served with injera, warm restaurant lighting"

generate "sambusa" "Professional food photography of Sambusa, Ethiopian golden crispy fried pastry triangles filled with spiced lentils, close-up, warm lighting, appetizing crunch"

generate "sambusa-meat" "Professional food photography of Meat Sambusa, Ethiopian crispy fried pastry triangles filled with spiced ground beef, golden brown, close-up, warm lighting"

# ========================
# SOUPS & SALADS
# ========================

generate "doro-shorba" "Professional food photography of Doro Shorba, Ethiopian chicken soup, clear golden broth with chicken pieces and vegetables, steaming bowl, warm lighting, comfort food"

generate "shorba" "Professional food photography of Shorba, Ethiopian lentil soup, smooth creamy texture, garnished with herbs, steaming bowl, warm lighting, overhead restaurant shot"

generate "egg-drop-soup" "Professional food photography of Ethiopian Egg Drop Soup, silky broth with egg ribbons, scallions, steaming bowl, warm restaurant lighting, overhead shot"

generate "timatim-salata" "Professional food photography of Timatim Salata, Ethiopian fresh tomato salad with onions and jalapenos in lemon dressing, bright colorful, side dish, warm lighting"

generate "timita-salata" "Professional food photography of Timita Salata, Ethiopian tomato salad with green chilies and lime, vibrant fresh colors, traditional side, warm restaurant lighting"

generate "fruit-salad" "Professional food photography of fresh Fruit Salad, colorful mix of tropical fruits mango papaya banana, served in elegant glass bowl, bright natural lighting"

# ========================
# PASTA & INTERNATIONAL
# ========================

generate "macaroni-alicha" "Professional food photography of Macaroni Alicha, Ethiopian style pasta in mild turmeric sauce with vegetables, unique fusion dish, warm lighting, overhead shot"

generate "pasta-meat-sauce" "Professional food photography of Pasta with Meat Sauce Ethiopian style, spaghetti with spiced ground beef bolognese, injera on side, fusion dish, warm lighting"

generate "pasta-salsa" "Professional food photography of Pasta with Salsa, Ethiopian style spaghetti with fresh tomato sauce and vegetables, colorful, warm restaurant lighting, overhead shot"

# ========================
# BREAKFAST & SNACKS
# ========================

generate "dabbo-kolo" "Professional food photography of Dabbo Kolo, Ethiopian sweet fried bread snacks, small golden crunchy bites in a basket, traditional snack, warm lighting, close-up"

generate "kolo" "Professional food photography of Kolo, Ethiopian roasted barley snack with peanuts and sunflower seeds, served in traditional basket, warm lighting, casual snack"

generate "beye-aynet" "Professional food photography of Beye Aynet, Ethiopian assorted breakfast platter with various stews breads and sides, colorful spread on mesob, warm lighting, overhead"

# ========================
# DESSERTS
# ========================

generate "baklava" "Professional food photography of Baklava, golden flaky pastry with honey and nuts, diamond shaped pieces, pistachio garnish, close-up, warm lighting, sweet dessert"

generate "basbousa" "Professional food photography of Basbousa, Middle Eastern semolina cake soaked in rose syrup, diamond cut with almond topping, golden color, warm lighting, dessert"

generate "cheesecake" "Professional food photography of Cheesecake, creamy New York style cheesecake slice with berry compote drizzle, elegant plating, warm restaurant lighting, dessert"

generate "date-cake" "Professional food photography of Date Cake, rich moist cake with chunks of dates, caramel glaze, sliced on plate, warm bakery lighting, dessert, overhead shot"

generate "tiramisu-ethiopian" "Professional food photography of Ethiopian Tiramisu, coffee-flavored Italian dessert with Ethiopian coffee twist, cocoa dusted, layered cream, elegant glass, warm lighting"

generate "banana-split" "Professional food photography of Banana Split, classic dessert with three scoops ice cream chocolate strawberry vanilla, banana, whipped cream cherry, colorful, bright lighting"

generate "ice-cream" "Professional food photography of Ice Cream, three scoops of artisanal ice cream in waffle bowl, chocolate vanilla strawberry, drizzled sauces, warm dessert lighting"

# ========================
# BEVERAGES - COFFEE & HOT DRINKS
# ========================

generate "ethiopian-coffee" "Professional food photography of Ethiopian Coffee Ceremony, traditional jebena clay pot pouring black coffee into small cups, frankincense smoke, green coffee beans, warm lighting, cultural"

generate "coffee-ceremony" "Professional food photography of Full Ethiopian Coffee Ceremony, three rounds of coffee with popcorn and bread, jebena pot, burning incense, traditional setting, warm ambient lighting"

generate "macchiato" "Professional food photography of Ethiopian Macchiato, layered espresso with steamed milk foam, served in clear glass cup, Ethiopian cafe style, warm lighting, close-up"

generate "buna-salaam" "Professional food photography of Buna Salaam iced coffee, Ethiopian cold coffee drink in tall glass with ice and cream, refreshing, warm outdoor lighting, close-up"

generate "spris-layered-coffee" "Professional food photography of Spris, Ethiopian layered coffee drink with visible layers of espresso and milk in tall clear glass, beautiful gradient, warm lighting"

generate "hot-chocolate" "Professional food photography of Hot Chocolate, rich dark hot chocolate with marshmallows and whipped cream in mug, steaming, warm cozy lighting, close-up"

generate "spiced-tea" "Professional food photography of Ethiopian Spiced Tea, warm amber tea with cinnamon cardamom and cloves in clear glass, steaming, aromatic, warm lighting"

generate "shai-tea" "Professional food photography of Shai, Ethiopian black tea served in small glass cup with sugar on side, simple and warm, close-up, restaurant lighting"

generate "atmit" "Professional food photography of Atmit, Ethiopian warm oat drink with butter and honey, creamy golden in traditional cup, comfort drink, warm lighting, close-up"

# ========================
# BEVERAGES - JUICES
# ========================

generate "avocado-juice" "Professional food photography of Avocado Juice, thick creamy green smoothie in tall glass, fresh avocado blended with milk, straw, warm lighting, close-up"

generate "mango-juice" "Professional food photography of Mango Juice, vibrant orange fresh mango juice in tall glass with ice, tropical, refreshing, warm lighting, close-up"

generate "papaya-juice" "Professional food photography of Papaya Juice, fresh orange-yellow papaya juice in tall glass, tropical fruit, refreshing, warm lighting, close-up"

generate "orange-juice" "Professional food photography of Fresh Orange Juice, bright orange juice in glass with orange slice garnish, refreshing breakfast drink, natural lighting, close-up"

generate "pineapple-juice" "Professional food photography of Pineapple Juice, fresh golden pineapple juice in tall glass with ice, tropical, refreshing, warm lighting, close-up"

generate "lemonade" "Professional food photography of Fresh Lemonade, cloudy yellow lemonade in glass with lemon slices and mint, ice cubes, refreshing summer drink, bright lighting"

generate "mixed-fruit-juice" "Professional food photography of Mixed Fruit Juice, colorful layered fruit juice with mango guava and papaya layers in tall glass, vibrant, warm lighting, close-up"

# ========================
# BEVERAGES - ALCOHOLIC
# ========================

generate "tej" "Professional food photography of Tej, Ethiopian honey wine in traditional berele glass flask, golden amber color, traditional drink, warm lighting, cultural presentation"

generate "tej-spritz" "Professional food photography of Tej Spritz, modern cocktail with Ethiopian honey wine sparkling water and citrus garnish, elegant glass, warm bar lighting"

generate "tella" "Professional food photography of Tella, Ethiopian traditional fermented barley beer, dark brown cloudy, served in traditional clay vessel, rustic, warm lighting"

generate "areke" "Professional food photography of Areke, Ethiopian traditional distilled spirit in small glass, clear potent liquor, traditional serving, warm lighting, close-up"

generate "borde" "Professional food photography of Borde, Ethiopian fermented cereal beverage, light colored traditional drink in clay pot, cultural, warm lighting"

generate "korefe" "Professional food photography of Korefe, Ethiopian traditional fermented drink made from sorghum, served in rustic container, cultural beverage, warm lighting"

generate "chala" "Professional food photography of Chala, Ethiopian local beer, served in traditional cup, golden amber color, warm lighting, close-up"

generate "st-george-beer" "Professional food photography of St George Beer, Ethiopia's iconic lager beer in branded glass bottle and poured glass, golden color, condensation, cool bar lighting"

generate "dashen-beer" "Professional food photography of Dashen Beer, Ethiopian premium lager in branded bottle and glass, golden pour, refreshing, cool bar lighting, close-up"

generate "harar-beer" "Professional food photography of Harar Beer, Ethiopian lager beer in branded bottle, golden amber, poured into glass, cool refreshing, bar lighting"

generate "meta-beer" "Professional food photography of Meta Beer, Ethiopian beer in branded bottle and glass, golden lager, refreshing, cool bar lighting, close-up"

generate "castel-beer" "Professional food photography of Castel Beer, premium Ethiopian lager in branded glass bottle, golden pour, condensation on glass, cool bar lighting"

generate "coca-cola" "Professional food photography of Coca Cola, classic red branded glass bottle with condensation, ice cold, refreshing, cool restaurant lighting, close-up"

generate "fanta-orange" "Professional food photography of Fanta Orange, bright orange soda in branded glass bottle, icy cold with condensation, refreshing, cool lighting, close-up"

generate "sprite" "Professional food photography of Sprite, lemon-lime soda in branded glass bottle, green tint, icy cold with condensation, refreshing, cool lighting, close-up"

generate "ambo-mineral-water" "Professional food photography of Ambo Mineral Water, Ethiopia's premium sparkling mineral water in branded bottle, clean refreshing, cool lighting, close-up"

generate "mineral-water" "Professional food photography of Mineral Water, crystal clear water in elegant glass bottle, refreshing, clean minimalist, cool lighting, close-up"

generate "axumit-wine" "Professional food photography of Axumit Wine, Ethiopian red wine in elegant glass, rich burgundy color, wine bottle in background, warm restaurant lighting, close-up"

generate "rift-valley-wine-red" "Professional food photography of Rift Valley Red Wine, Ethiopian wine in glass, deep red color, bottle in background, warm restaurant lighting, elegant"

generate "rift-valley-wine-white" "Professional food photography of Rift Valley White Wine, Ethiopian white wine in glass, pale golden color, refreshing, cool restaurant lighting, close-up"

generate "yirgacheffe-origin" "Professional food photography of Yirgacheffe Single Origin Coffee, premium Ethiopian coffee beans in burlap bag, brewed coffee in cup, warm lighting, artisanal"

generate "sidamo-origin" "Professional food photography of Sidamo Single Origin Coffee, premium Ethiopian coffee beans, brewed coffee in ceramic cup, warm rustic lighting, artisanal"

generate "harrar-origin" "Professional food photography of Harrar Single Origin Coffee, premium Ethiopian coffee beans, dry processed, brewed in cup, warm lighting, artisanal"

# ========================
# COCKTAILS
# ========================

generate "addis-mule" "Professional food photography of Addis Mule cocktail, Ethiopian twist on Moscow Mule in copper mug with lime and berbere rim, spicy and refreshing, warm bar lighting"

generate "blue-nile-breeze" "Professional food photography of Blue Nile Breeze cocktail, blue curacao tropical cocktail in hurricane glass, vibrant blue, orange slice, warm bar lighting"

generate "ethiopian-negroni" "Professional food photography of Ethiopian Negroni, dark red cocktail in rocks glass with orange peel and Ethiopian spice twist, warm bar lighting, elegant"

generate "mitmita-margarita" "Professional food photography of Mitmita Margarita, spicy Ethiopian cocktail in salt-rimmed glass with mitmita spice rim, lime, tequila, warm bar lighting"

generate "rift-valley-sunset" "Professional food photography of Rift Valley Sunset cocktail, gradient orange to red cocktail in tall glass, tropical, Ethiopian-inspired, warm bar lighting"

generate "spiced-espresso-martini" "Professional food photography of Spiced Espresso Martini, rich dark cocktail in martini glass with coffee beans, Ethiopian coffee, warm bar lighting, elegant"

generate "lalibela-old-fashioned" "Professional food photography of Lalibela Old Fashioned, premium whiskey cocktail in rocks glass with large ice cube, orange peel, Ethiopian honey, warm bar lighting"

echo ""
echo "=========================================="
echo "Image generation complete!"
echo "Total images: $(ls $DIR/*.png 2>/dev/null | wc -l)"
echo "=========================================="
