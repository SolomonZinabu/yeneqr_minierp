#!/bin/bash
cd /home/z/my-project

generate_img() {
  local name="$1"
  local prompt="$2"
  local file="./public/images/menu/${name}.png"
  
  if [ -f "$file" ]; then
    echo "SKIP: $name"
    return 0
  fi
  
  echo -n "GEN: $name... "
  local result
  result=$(z-ai-generate -p "$prompt" -o "$file" -s 864x1152 2>&1)
  local code=$?
  
  if [ $code -eq 0 ] && echo "$result" | grep -q "completed"; then
    echo "OK ($(stat -c%s "$file" 2>/dev/null || echo '?') bytes)"
    sleep 3
    return 0
  else
    echo "FAILED, waiting 20s..."
    sleep 20
    result=$(z-ai-generate -p "$prompt" -o "$file" -s 864x1152 2>&1)
    code=$?
    if [ $code -eq 0 ] && echo "$result" | grep -q "completed"; then
      echo "  RETRY OK"
      sleep 3
      return 0
    else
      echo "  RETRY FAILED"
      return 1
    fi
  fi
}

# Continue from where we left off (already have: doro-wot, doro-wot-special, kitfo-raw, kitfo-lebleb, kitfo-fully-cooked, kitfo-tibs, kitfo-kocho, shiro-wot, misir-wot, tibs)

# More stews
generate_img "tibs-special" "Professional food photography of Tibs Special, premium Ethiopian sauteed tender beef sizzling plate on injera, warm lighting"
generate_img "yebeg-tibs" "Professional food photography of Yebeg Tibs, Ethiopian sauteed lamb with onions peppers on injera, warm lighting"
generate_img "awaze-tibs" "Professional food photography of Awaze Tibs, Ethiopian spicy beef in awaze pepper paste on injera dark red, warm lighting"
generate_img "dereq-tibs" "Professional food photography of Dereq Tibs, Ethiopian dry-fried crispy beef tips golden on injera, warm lighting"
generate_img "zilzil-tibs" "Professional food photography of Zilzil Tibs, Ethiopian thinly sliced rolled beef strips on injera, warm lighting"
generate_img "sega-wot" "Professional food photography of Sega Wot, Ethiopian beef stew in rich berbere sauce dark red on injera, warm lighting"
generate_img "key-wot" "Professional food photography of Key Wot, Ethiopian spicy red beef stew berbere thick sauce on injera, warm lighting"
generate_img "beg-wot-keyih" "Professional food photography of Beg Wot Keyih, Ethiopian spicy lamb stew red berbere on injera, warm lighting"
generate_img "yebeg-wot" "Professional food photography of Yebeg Wot, Ethiopian lamb stew savory sauce on injera, warm lighting"
generate_img "kik-wot" "Professional food photography of Kik Wot, Ethiopian yellow split pea stew golden on injera, warm lighting"
generate_img "dinich-wot" "Professional food photography of Dinich Wot, Ethiopian potato stew spicy berbere on injera, warm lighting"
generate_img "gomen" "Professional food photography of Gomen, Ethiopian collard greens sauteed garlic vibrant green on injera, warm lighting"
generate_img "fosolia" "Professional food photography of Fosolia, Ethiopian string beans carrots sauteed onions colorful vegetarian on injera"
generate_img "atkilt-wot" "Professional food photography of Atkilt Wot, Ethiopian vegetable stew potatoes carrots cabbage on injera, warm lighting"
generate_img "azifa" "Professional food photography of Azifa, Ethiopian cold lentil salad mustard lime green herbaceous, warm lighting"
generate_img "shiro" "Professional food photography of Shiro, Ethiopian chickpea flour stew smooth golden bubbling on injera, warm lighting"
generate_img "shiro-wot-mitin" "Professional food photography of Shiro Wot with Mitin, Ethiopian chickpea stew spiced butter golden on injera"
generate_img "dulet-wot" "Professional food photography of Dulet Wot, Ethiopian spicy tripe liver stew dark rich sauce on injera, warm lighting"
generate_img "quanta-wot" "Professional food photography of Quanta Wot, Ethiopian dried beef stew spicy berbere on injera, warm lighting"
generate_img "quanta-firfir" "Professional food photography of Quanta Firfir, Ethiopian shredded injera dried beef spicy berbere dark red bowl"
generate_img "firfir" "Professional food photography of Firfir, Ethiopian shredded injera spicy berbere sauce niter kibbeh dark red bowl"
generate_img "firfir-egg" "Professional food photography of Firfir with Egg, Ethiopian shredded injera spicy sauce topped fried egg"
generate_img "kita-firfir" "Professional food photography of Kita Firfir, Ethiopian flatbread torn mixed spicy sauce butter rustic"
generate_img "chechebsa" "Professional food photography of Chechebsa, Ethiopian shredded flatbread spiced butter berbere golden crispy breakfast"
generate_img "fatira" "Professional food photography of Fatira, Ethiopian pan-fried flatbread with egg filling golden crispy triangles breakfast"
generate_img "genfo" "Professional food photography of Genfo, Ethiopian thick porridge barley mound with well of spiced butter, warm lighting"
generate_img "kinche" "Professional food photography of Kinche, Ethiopian cracked wheat porridge with niter kibbeh butter wholesome bowl"
generate_img "ful-medames" "Professional food photography of Ful Medames, Ethiopian fava bean stew olive oil cumin vegetables bowl with bread"
generate_img "ful-special" "Professional food photography of Ful Special, Ethiopian fava beans with egg yogurt feta cheese toppings bowl"
generate_img "enkulal-firfir" "Professional food photography of Enkulal Firfir, Ethiopian scrambled eggs with onions tomatoes peppers colorful skillet"
generate_img "enkulal-tibs" "Professional food photography of Enkulal Tibs breakfast, Ethiopian scrambled eggs sauteed meat vegetables hearty"
generate_img "shakshouka" "Professional food photography of Shakshouka, eggs poached in spiced tomato sauce vibrant red cast iron skillet"
generate_img "fata" "Professional food photography of Fata, Ethiopian torn bread mixed spicy berbere sauce yogurt traditional bowl"
generate_img "kita-honey" "Professional food photography of Kita with Honey, Ethiopian flatbread golden honey drizzle sweet breakfast"
generate_img "ambasha" "Professional food photography of Ambasha, Ethiopian sweet braided bread golden brown crust celebration bread sliced"
generate_img "himbasha" "Professional food photography of Himbasha, Ethiopian sweet flatbread decorative pattern golden top sliced festive"
generate_img "honey-bread" "Professional food photography of Ethiopian Honey Bread, sweet golden bread honey glaze sliced rustic board"
generate_img "gored-gored" "Professional food photography of Gored Gored, Ethiopian raw cubed beef mitmita spiced butter bright red on injera"
generate_img "kurt-raw" "Professional food photography of Kurt, Ethiopian raw meat cubed beef with dipping sauces dramatic presentation"
generate_img "beef-steak-ethiopian" "Professional food photography of Ethiopian Beef Steak, grilled with berbere crust vegetables injera elegant plating"
generate_img "lamb-chops" "Professional food photography of Ethiopian Spiced Lamb Chops, grilled berbere rosemary marinade char marks warm lighting"
generate_img "asa-tibs" "Professional food photography of Asa Tibs, Ethiopian sauteed fish with onions tomatoes peppers tilapia on injera"
generate_img "asa-wot" "Professional food photography of Asa Wot, Ethiopian fish stew in spicy berbere sauce chunks of fish on injera"
generate_img "grilled-tilapia" "Professional food photography of Grilled Tilapia Ethiopian style, whole grilled fish spice rub charred skin injera"
generate_img "fish-chips" "Professional food photography of Ethiopian Fish and Chips, crispy battered fish thick fries awaze sauce"
generate_img "shrimp-tibs" "Professional food photography of Shrimp Tibs, Ethiopian sauteed shrimp with onions peppers spices on injera"
generate_img "sambusa" "Professional food photography of Sambusa, Ethiopian golden crispy fried pastry triangles spiced lentils warm lighting"
generate_img "sambusa-meat" "Professional food photography of Meat Sambusa, Ethiopian crispy pastry triangles spiced ground beef golden warm lighting"
generate_img "doro-shorba" "Professional food photography of Doro Shorba, Ethiopian chicken soup golden broth chicken vegetables steaming bowl"
generate_img "shorba" "Professional food photography of Shorba, Ethiopian lentil soup smooth creamy garnished herbs steaming bowl"
generate_img "egg-drop-soup" "Professional food photography of Ethiopian Egg Drop Soup, silky broth egg ribbons scallions steaming bowl"
generate_img "timatim-salata" "Professional food photography of Timatim Salata, Ethiopian tomato salad onions jalapenos lemon dressing bright colorful"
generate_img "timita-salata" "Professional food photography of Timita Salata, Ethiopian tomato salad green chilies lime vibrant fresh"
generate_img "fruit-salad" "Professional food photography of fresh Fruit Salad, colorful tropical fruits mango papaya banana in glass bowl"
generate_img "macaroni-alicha" "Professional food photography of Macaroni Alicha, Ethiopian pasta mild turmeric sauce vegetables fusion dish"
generate_img "pasta-meat-sauce" "Professional food photography of Pasta with Meat Sauce Ethiopian style, spaghetti spiced ground beef injera side"
generate_img "pasta-salsa" "Professional food photography of Pasta with Salsa, Ethiopian spaghetti fresh tomato sauce vegetables colorful"
generate_img "dabbo-kolo" "Professional food photography of Dabbo Kolo, Ethiopian sweet fried bread snacks small golden crunchy bites in basket"
generate_img "kolo" "Professional food photography of Kolo, Ethiopian roasted barley snack peanuts sunflower seeds in basket"
generate_img "beye-aynet" "Professional food photography of Beye Aynet, Ethiopian assorted breakfast platter stews breads sides colorful mesob"
generate_img "baklava" "Professional food photography of Baklava, golden flaky pastry honey nuts diamond shaped pistachio garnish warm lighting"
generate_img "basbousa" "Professional food photography of Basbousa, semolina cake rose syrup diamond cut almond topping golden"
generate_img "cheesecake" "Professional food photography of Cheesecake, creamy New York style slice berry compote drizzle elegant plating"
generate_img "date-cake" "Professional food photography of Date Cake, rich moist cake date chunks caramel glaze sliced plate"
generate_img "tiramisu-ethiopian" "Professional food photography of Ethiopian Tiramisu, coffee-flavored dessert Ethiopian coffee cocoa layered cream glass"
generate_img "banana-split" "Professional food photography of Banana Split, three scoops ice cream chocolate vanilla strawberry banana whipped cream cherry"
generate_img "ice-cream" "Professional food photography of Ice Cream, three scoops artisanal waffle bowl chocolate vanilla strawberry drizzled sauces"
generate_img "ethiopian-coffee" "Professional food photography of Ethiopian Coffee, traditional jebena clay pot pouring black coffee frankincense warm cultural lighting"
generate_img "coffee-ceremony" "Professional food photography of Full Ethiopian Coffee Ceremony, three rounds coffee popcorn jebena pot incense warm lighting"
generate_img "macchiato" "Professional food photography of Ethiopian Macchiato, layered espresso steamed milk foam in clear glass cup warm cafe"
generate_img "buna-salaam" "Professional food photography of Buna Salaam iced coffee, Ethiopian cold coffee in tall glass with ice and cream refreshing"
generate_img "spris-layered-coffee" "Professional food photography of Spris, Ethiopian layered coffee drink espresso and milk layers in tall glass"
generate_img "hot-chocolate" "Professional food photography of Hot Chocolate, rich dark hot chocolate marshmallows whipped cream steaming mug cozy lighting"
generate_img "spiced-tea" "Professional food photography of Ethiopian Spiced Tea, warm amber tea cinnamon cardamom cloves in glass steaming"
generate_img "shai-tea" "Professional food photography of Shai, Ethiopian black tea in small glass cup with sugar side simple warm"
generate_img "atmit" "Professional food photography of Atmit, Ethiopian warm oat drink butter honey creamy golden traditional cup"
generate_img "avocado-juice" "Professional food photography of Avocado Juice, thick creamy green smoothie tall glass fresh avocado milk straw"
generate_img "mango-juice" "Professional food photography of Mango Juice, vibrant orange fresh mango juice tall glass ice refreshing"
generate_img "papaya-juice" "Professional food photography of Papaya Juice, fresh orange-yellow papaya juice tall glass tropical refreshing"
generate_img "orange-juice" "Professional food photography of Fresh Orange Juice, bright orange juice glass orange slice garnish refreshing"
generate_img "pineapple-juice" "Professional food photography of Pineapple Juice, fresh golden pineapple juice tall glass ice tropical refreshing"
generate_img "lemonade" "Professional food photography of Fresh Lemonade, cloudy yellow lemonade lemon slices mint ice cubes refreshing"
generate_img "mixed-fruit-juice" "Professional food photography of Mixed Fruit Juice, colorful layered mango guava papaya layers tall glass vibrant"
generate_img "tej" "Professional food photography of Tej, Ethiopian honey wine in traditional berele glass flask golden amber cultural drink"
generate_img "tej-spritz" "Professional food photography of Tej Spritz, modern cocktail Ethiopian honey wine sparkling water citrus elegant glass"
generate_img "tella" "Professional food photography of Tella, Ethiopian traditional fermented barley beer dark brown cloudy clay vessel rustic"
generate_img "areke" "Professional food photography of Areke, Ethiopian traditional distilled spirit in small glass clear potent liquor"
generate_img "borde" "Professional food photography of Borde, Ethiopian fermented cereal beverage light colored in clay pot cultural"
generate_img "korefe" "Professional food photography of Korefe, Ethiopian traditional fermented sorghum drink in rustic container cultural"
generate_img "chala" "Professional food photography of Chala, Ethiopian local beer in traditional cup golden amber warm lighting"
generate_img "st-george-beer" "Professional food photography of St George Beer, Ethiopia iconic lager in branded bottle poured glass golden condensation"
generate_img "dashen-beer" "Professional food photography of Dashen Beer, Ethiopian premium lager branded bottle glass golden pour refreshing"
generate_img "harar-beer" "Professional food photography of Harar Beer, Ethiopian lager branded bottle golden amber poured glass cool refreshing"
generate_img "meta-beer" "Professional food photography of Meta Beer, Ethiopian beer branded bottle glass golden lager refreshing"
generate_img "castel-beer" "Professional food photography of Castel Beer, premium Ethiopian lager branded glass bottle golden pour condensation"
generate_img "coca-cola" "Professional food photography of Coca Cola, classic red branded glass bottle with condensation ice cold refreshing"
generate_img "fanta-orange" "Professional food photography of Fanta Orange, bright orange soda branded glass bottle icy cold condensation"
generate_img "sprite" "Professional food photography of Sprite, lemon-lime soda branded glass bottle green tint icy cold condensation"
generate_img "ambo-mineral-water" "Professional food photography of Ambo Mineral Water, Ethiopia premium sparkling water branded bottle clean refreshing"
generate_img "mineral-water" "Professional food photography of Mineral Water, crystal clear water in elegant glass bottle refreshing clean minimalist"
generate_img "axumit-wine" "Professional food photography of Axumit Wine, Ethiopian red wine in elegant glass rich burgundy bottle background"
generate_img "rift-valley-wine-red" "Professional food photography of Rift Valley Red Wine, Ethiopian wine in glass deep red bottle background"
generate_img "rift-valley-wine-white" "Professional food photography of Rift Valley White Wine, Ethiopian white wine in glass pale golden refreshing"
generate_img "yirgacheffe-origin" "Professional food photography of Yirgacheffe Single Origin Coffee, premium Ethiopian beans burlap bag brewed cup artisanal"
generate_img "sidamo-origin" "Professional food photography of Sidamo Single Origin Coffee, premium Ethiopian beans brewed ceramic cup rustic"
generate_img "harrar-origin" "Professional food photography of Harrar Single Origin Coffee, premium Ethiopian dry processed beans brewed cup artisanal"
generate_img "addis-mule" "Professional food photography of Addis Mule cocktail, Ethiopian Moscow Mule copper mug lime berbere rim spicy bar"
generate_img "blue-nile-breeze" "Professional food photography of Blue Nile Breeze cocktail, blue curacao tropical hurricane glass vibrant blue orange"
generate_img "ethiopian-negroni" "Professional food photography of Ethiopian Negroni, dark red cocktail rocks glass orange peel Ethiopian spice twist bar"
generate_img "mitmita-margarita" "Professional food photography of Mitmita Margarita, spicy Ethiopian cocktail mitmita salt-rimmed glass lime tequila bar"
generate_img "rift-valley-sunset" "Professional food photography of Rift Valley Sunset cocktail, gradient orange to red tall glass tropical Ethiopian bar"
generate_img "spiced-espresso-martini" "Professional food photography of Spiced Espresso Martini, rich dark cocktail martini glass coffee beans Ethiopian coffee bar"
generate_img "lalibela-old-fashioned" "Professional food photography of Lalibela Old Fashioned, premium whiskey cocktail rocks glass large ice orange peel honey bar"

echo ""
echo "=========================================="
echo "Total images: $(ls ./public/images/menu/*.png 2>/dev/null | wc -l)"
echo "=========================================="
