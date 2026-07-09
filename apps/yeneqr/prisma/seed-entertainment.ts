// ============================================================
// Yene QR — Entertainment Content Seed Script
// Seeds default platform-wide entertainment content with i18n
// ============================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// -------------------------------------------------------
// 20 FOOD FACTS (Ethiopian + World Cuisine)
// -------------------------------------------------------
const foodFacts = [
  {
    title: 'The Original Coffee',
    content: 'Ethiopia is the birthplace of coffee. According to legend, a goat herder named Kaldi discovered coffee around 800 AD when he noticed his goats dancing after eating coffee berries.',
    titleI18n: { am: 'የመጀመሪያው ቡና', om: 'Buna Jalqabaa', ar: 'القهوة الأصلية' },
    contentI18n: { am: 'ኢትዮጵያ የቡና ሀገር ናት። እንደ ትውፊቱ ካልዲ የተባለ አጋዘን አሳሽ በ800 ዓ.ም ግድም አጋዘኖቹ ቡና ቤራ ከበሉ በኋላ እየዘፈኑ ሲያያቸው ቡናውን አግኝቷል።', om: 'Itoophiyaan buna dhalate. Akka seenaa, Kaldi jedhamu buna bara 800 dhk argate.', ar: 'إثيوبيا هي مولد القهوة. وفقا للأسطورة، اكتشف راعي ماعز يُدعى كالدي القهوة حوالي عام 800 م.' },
    category: 'food',
    sortOrder: 1,
  },
  {
    title: 'Injera — The Superfood Flatbread',
    content: 'Injera, Ethiopia\'s signature flatbread, is made from teff flour — a gluten-free ancient grain packed with iron, calcium, and protein. A single injera can contain up to 10 essential amino acids.',
    titleI18n: { am: 'እንጀራ — ሱፐርፉድ ዳቦ', om: 'Buddeena — Qoraansa Nyaata', ar: 'إنجيرا — الخبز المسطح الفائق' },
    contentI18n: { am: 'እንጀራ የኢትዮጵያ ስም ያለው ዳቦ ከጤፍ ዱቄት የሚሰራ ሲሆን ጤፍ የግሉተን ነፃ፣ ብረት፣ ካልሲየም እና ፕሮቲን የበዛበት ጥንታዊ እህል ነው።', om: 'Buddeeni Itoophiyaa raajeffama t\'aana irraa hojjetame. T\'aanni bishaan bilchaate, ayinan, kaalsiyemii fi pirootiinii qaba.' },
    category: 'food',
    sortOrder: 2,
  },
  {
    title: 'Doro Wot — The Celebration Dish',
    content: 'Doro Wot (chicken stew) is Ethiopia\'s most celebratory dish, often served during holidays and special occasions. A traditional preparation can take over 24 hours of slow cooking with dozens of spices.',
    titleI18n: { am: 'ዶሮ ወጥ — የበዓል ምግብ', om: 'Doro Wot — Nyaata Ayyaanaa', ar: 'دورو ووت — طبق الاحتفال' },
    contentI18n: { am: 'ዶሮ ወጥ በኢትዮጵያ ውስጥ በጣም የሚከበረው ምግብ ሲሆን በበዓላት እና ልዩ መድረኮች ላይ ይቀርባል። ባህላዊ ዝግጅት ከ24 ሰዓት በላይ ቀስ ብሎ የማብሰል ሂደት ይጠይቃል።' },
    category: 'food',
    sortOrder: 3,
  },
  {
    title: 'The Spice Matrix — Berbere',
    content: 'Berbere is a complex Ethiopian spice blend containing up to 20 individual spices including chili peppers, fenugreek, coriander, cardamom, and black pepper. Every family has their own secret recipe passed down through generations.',
    titleI18n: { am: 'በርበሬ — የቅመማ ቅመም', om: 'Barbaaree — Makaa Qamadii', ar: 'بيربيريه — مصفوفة التوابل' },
    contentI18n: { am: 'በርበሬ እስከ 20 የተለያዩ ቅመሞችን የያዘ ውስብስብ የኢትዮጵያ ቅመም ድብልቅ ነው። እያንዳንዱ ቤተሰብ ትውልድ ወደ ትውልድ የሚተላለፍ ራሱን ያለ የሚመስል የሚስጥር የቅመም የተለየ አዘገጃጀት አለው።' },
    category: 'food',
    sortOrder: 4,
  },
  {
    title: 'Coffee Ceremony — A Sacred Ritual',
    content: 'The Ethiopian coffee ceremony can last up to 3 hours and involves roasting green beans, grinding them by hand, and brewing in a clay pot called a jebena. It\'s performed three times a day in many households — morning, noon, and evening.',
    titleI18n: { am: 'የቡና ስርዓት — ቅዱስ ልምምድ', om: 'Sirna Buna — Taphatoo Qulqulluu', ar: 'حفل القهوة — طقس مقدس' },
    contentI18n: { am: 'የኢትዮጵያ የቡና ስርዓት እስከ 3 ሰዓት ሊቆይ ይችላል። አረንጓዴ ቡና ማጥመድ፣ በእጅ መፍጨት እና በጀበና ውስጥ መጠብስ ይጠቀልላል።' },
    category: 'food',
    sortOrder: 5,
  },
  {
    title: 'Kitfo — Ethiopian Steak Tartare',
    content: 'Kitfo is finely minced raw beef seasoned with mitmita (a spicy chili powder blend) and niter kibbeh (spiced clarified butter). It\'s considered one of Ethiopia\'s finest dishes and is often served during special celebrations.',
    titleI18n: { am: 'ክፍቶ — የኢትዮጵያ ጥሬ ስጋ', om: 'Kitfoo — Nyacha Itoophiyaa', ar: 'كيتفو — التارتار الإثيوبي' },
    contentI18n: { am: 'ክፍቶ በሚጥሚጥ እና በንጥር ቅቤ የተቀመመ ደቂቅ የተፈጨ ጥሬ ስጋ ነው። ከኢትዮጵያ ምርጥ ምግቦች አንዱ ሆኖ በልዩ ልዩ በዓላት ይቀርባል።' },
    category: 'food',
    sortOrder: 6,
  },
  {
    title: 'Teff — The Tiny Super Grain',
    content: 'Teff grains are so small that 150 grains equal the size of one grain of wheat. Despite its size, teff is a nutritional powerhouse — rich in iron, fiber, protein, and calcium. Ethiopia produces about 90% of the world\'s teff supply.',
    titleI18n: { am: 'ጤፍ — ትንሽ ሱፐር እህል', om: 'T\'aana — Xiqqaa Qoraansa', ar: 'تف — الحبة الخارقة الصغيرة' },
    contentI18n: { am: 'የጤፍ እህሎች በጣም ትናንሽ ስለሆኑ 150 እህሎች የአንድ ስንዴ እህል መጠን ይሆናሉ። ሆኖም ጤፍ ብረት፣ ፋይበር፣ ፕሮቲን እና ካልሲየም በመብዛት ይገኛል። ኢትዮጵያ የዓለም ጤፍ አቅርቦት 90% ታመርቃለች።' },
    category: 'food',
    sortOrder: 7,
  },
  {
    title: 'Niter Kibbeh — Spiced Clarified Butter',
    content: 'Niter kibbeh is a staple in Ethiopian cooking made by slowly simmering butter with onions, garlic, ginger, turmeric, cardamom, and other spices. It\'s the secret flavor base in many Ethiopian dishes and can last for months without refrigeration.',
    titleI18n: { am: 'ንጥር ቅቤ — የቅመም ቅቤ', om: "Niter Kibbeh — Vaa'a Qamaddaa", ar: 'نيتر كيبيه — الزبدة المنكهة' },
    contentI18n: { am: 'ንጥር ቅቤ በኢትዮጵያ ምግብ አሰራር ውስጥ መሰረታዊ የሆነ ቅቤ ከሽንኩርት፣ ነጭ ሽንኩርት፣ ዝንጅብል፣ ሱማል እና ሌሎች ቅመሞች ጋር ቀስ ብሎ የሚቀላ ነው።' },
    category: 'food',
    sortOrder: 8,
  },
  {
    title: 'Shiro — The Beloved Legume Stew',
    content: 'Shiro is a smooth, thick stew made from chickpea or broad bean flour, seasoned with onions, garlic, and berbere. It\'s one of the most commonly eaten dishes in Ethiopia and is a staple during fasting periods when meat is forbidden.',
    titleI18n: { am: 'ሽሮ — የሚወደው የጥራጣ ወጥ', om: 'Shiroo — Nyaata Xixiqqaa', ar: 'شيرو — يخنة البقوليات المحبوبة' },
    contentI18n: { am: 'ሽሮ ከሽምብላ ወይም አተር ዱቄት የሚሰራ ለስላሳ፣ ወፍጮ ወጥ ሲሆን በሽንኩርት፣ ነጭ ሽንኩርት እና በርበሬ ይቀመማል።' },
    category: 'food',
    sortOrder: 9,
  },
  {
    title: 'Honey Wine — Tej',
    content: 'Tej is an ancient Ethiopian honey wine (mead) that has been brewed for over 2,000 years. It\'s made from honey, water, and gesho (Rhamnus prinoides) leaves which give it a unique bitter-sweet flavor and act as a natural preservative.',
    titleI18n: { am: 'ጠጅ — የማር ወይን', om: 'T\'ejj — Daadhii Fala', ar: 'تيج — نبيذ العسل' },
    contentI18n: { am: 'ጠጅ ከ2,000 ዓመት በላይ የተመረቀ ጥንታዊ የኢትዮጵያ የማር ወይን ነው። ከማር፣ ውሃ እና ጌሾ ቅጠል የሚሰራ ሲሆን ጌሾው ልዩ የመራራ-ጣፋጭ ጣዕም እና ተፈጥሮአዊ እርጥበት ሰጪነት ይሰጣል።' },
    category: 'food',
    sortOrder: 10,
  },
  {
    title: 'Sushi — Ancient Preservation Method',
    content: 'Sushi originated in Southeast Asia as a way to preserve fish in fermented rice. The modern nigiri sushi we know today was invented in Edo (Tokyo) in the 1820s by Hanaya Yohei, who replaced the fermentation with fresh fish on vinegared rice.',
    titleI18n: { am: 'ሱሺ — ጥንታዊ የማቆያ ዘዴ', om: 'Sushi — Malaa Faya', ar: 'سوشي — طريقة الحفظ القديمة' },
    contentI18n: { am: 'ሱሺ የተጀመረው በደቡብ ምስራቅ እስያ ዓሳን በተከሰቀ ሩዝ ውስጥ ለማቆየት እንደ ዘዴ ነው። ዘመናዊው ኒጊሪ ሱሺ በ1820ዎቹ በሃናያ ዮሄይ ተፈለሰፈ።' },
    category: 'food',
    sortOrder: 11,
  },
  {
    title: 'Pasta\'s Asian Origins',
    content: 'While pasta is synonymous with Italy, noodles actually originated in China around 4,000 years ago. Marco Polo is often credited with bringing pasta to Italy, but historians have found evidence of pasta-making in Italy before his travels to China.',
    titleI18n: { am: 'የፓስታ እስያዊ ምንጭ', om: 'Uumaa Paastaa Aziyaa', ar: 'الأصول الآسيوية للمعكرونة' },
    contentI18n: { am: 'ፓስታ ከጣሊያን ጋር ቢያያዝም ኑድሎች በእርግጥ በቻይና ውስጥ ከ4,000 ዓመታት በፊት ጀምረዋል። ማርኮ ፖሎ ፓስታን ወደ ጣሊያን ያመጣ ይባል እንጂ ታሪክ ተመራማሪዎች ከቻይና ጉዞው በፊት በጣሊያን ውስጥ ፓስታ ማዘጋጀት ማስረጃ አግኝተዋል።' },
    category: 'food',
    sortOrder: 12,
  },
  {
    title: 'The World\'s Most Expensive Spice',
    content: 'Saffron is the world\'s most expensive spice by weight, costing between $500-$5,000 per pound. It takes about 75,000 saffron crocus flowers to produce just one pound of saffron, as each flower only contains three stigmas that must be hand-picked.',
    titleI18n: { am: 'የዓለም አዋጪ ቅመም', om: 'Qamadda Duniyaa Gatii Ol\'aanaa', ar: 'أغل توابل في العالم' },
    contentI18n: { am: 'ሳፍሮን በክብደት የዓለም አዋጪ ቅመም ነው — በአንድ ፓውንድ $500-$5,000 ይከፍላል። አንድ ፓውንድ ሳፍሮን ለማምረት ከ75,000 የሳፍሮን አበባዎች ይፈለጋል።' },
    category: 'food',
    sortOrder: 13,
  },
  {
    title: 'Chocolate — Food of the Gods',
    content: 'Chocolate comes from cacao beans, and the word "chocolate" comes from the Aztec word "xocolātl." The ancient Mesoamericans drank chocolate as a bitter, frothy beverage and considered it a gift from the god Quetzalcoatl. It wasn\'t sweetened until the Spanish brought it to Europe.',
    titleI18n: { am: 'ቸኮሌት — የአማልክት ምግብ', om: 'Chookolaatii — Nyaata Waaqayyoo', ar: 'الشوكولاتة — طعام الآلهة' },
    contentI18n: { am: 'ቸኮሌት ከካኮው አቧራ ይመጣል። "ቸኮሌት" የሚለው ቃል ከአዝቴክኛ "ዞኮላትል" ይመጣል። ጥንታዊ ሜሶአሜሪካውያን ቸኮሌትን እንደ መራራ፣ ፎሚት ያለ መጠጥ ይጠጡ እና ከእግዚአብሔር ስጦታ ይቆጥሩት ነበር።' },
    category: 'food',
    sortOrder: 14,
  },
  {
    title: 'Chili Peppers — New World Heat',
    content: 'Chili peppers are native to the Americas and were unknown in the Old World until Columbus brought them back in 1493. Today, they are essential in cuisines worldwide — from Ethiopian berbere to Thai curries to Indian vindaloo.',
    titleI18n: { am: 'ቁልቁል በርበሬ — የአዲስ ዓለም ሙቀት', om: 'Milaacha — Qonnaan Bishaan Haaraa', ar: 'الفلفل الحار — حرارة العالم الجديد' },
    contentI18n: { am: 'ቁልቁል በርበሬ ወደ አሜሪካ አህጉር ኗሪ ሲሆን ኮሎምቦስ በ1493 እስኪያመጣቸው ድረስ በድሮው ዓለም የማይታወቁ ነበሩ። ዛሬ ከኢትዮጵያ በርበሬ እስከ ታይ ካሪ ድረስ በዓለም ምግቦች ውስጥ አስፈላጊ ሆነዋል።' },
    category: 'food',
    sortOrder: 15,
  },
  {
    title: 'Fermentation — The Oldest Cooking Method',
    content: 'Fermentation is one of the oldest food preservation methods, dating back over 9,000 years. From Ethiopian injera to Korean kimchi to German sauerkraut, virtually every culture has fermented foods that define their cuisine.',
    titleI18n: { am: 'ማብሰል — የጥንታዊ የምግብ አሰራር ዘዴ', om: "Aana'aa — Malaa Nyaata Durii", ar: 'التخمير — أقدم طريقة طهي' },
    contentI18n: { am: 'ማብሰል ከ9,000 ዓመት በላይ ከሆኑ የምግብ እርጥበት ሰጪነት ዘዴዎች አንዱ ነው። ከኢትዮጵያ እንጀራ እስከ ኮሪያ ኪምቺ ድረስ ባህል የራሱን የተከሰቀ ምግብ አለው።' },
    category: 'food',
    sortOrder: 16,
  },
  {
    title: 'The Ethiopian Fasting Tradition',
    content: 'Ethiopian Orthodox Christians observe over 250 fasting days per year, during which they eat no animal products. This has created one of the world\'s richest vegan cuisines, with dishes like shiro, misir wot, and gomen becoming globally celebrated.',
    titleI18n: { am: 'የኢትዮጵያ ጾም ባህል', om: 'Aadaa Soomii Itoophiyaa', ar: 'تقاليد الصيام الإثيوبي' },
    contentI18n: { am: 'የኢትዮጵያ ኦርቶዶክስ ክርስቲያኖች በዓመት ከ250 በላይ የጾም ቀናትን ይጠብቃሉ — በእነዚህ ቀናት የእንስሳ ቱንዎችን አይመገቡም። ይህ ከዓለም ሀብታም የቬጋን ምግብ አሰራሮች አንዱን ፈጥሯል።' },
    category: 'food',
    sortOrder: 17,
  },
  {
    title: 'Cheese Origins — An Accident',
    content: 'Legend says cheese was discovered around 8000 BCE when an Arab trader stored milk in a pouch made from a sheep\'s stomach. The rennet in the stomach lining caused the milk to separate into curds and whey, creating the first cheese.',
    titleI18n: { am: 'የአይብ ምንጭ — አደጋ', om: 'Uumaa Aannanii — Dogoggora', ar: 'أصول الجبن — حادث' },
    contentI18n: { am: 'እንደ ትውፊቱ አይብ በ8000 ዓ.ዓ. ግድም የአረብ ነጋዴ ወተትን በበግ ሆድ ኪስ ውስጥ ሲያከማቸው ተገኝቷል። በሆድ ክፍሉ ውስጥ የነበረው ሬኔት ወተቱን ወደ ኩርድ እና ወይቅ እንዲለይ አድርጎታል።' },
    category: 'food',
    sortOrder: 18,
  },
  {
    title: 'Water — The Forgotten Ingredient',
    content: 'The mineral content of water dramatically affects food taste and texture. This is why New York bagels, Neapolitan pizza, and Belgian beer are said to be impossible to replicate elsewhere — the local water chemistry is a crucial, irreplaceable ingredient.',
    titleI18n: { am: 'ውሃ — የተረሳ ንጥረ ነገር', om: 'Bishaan — Wantii Dhagahame', ar: 'الماء — المكون المنسي' },
    contentI18n: { am: 'የውሃው የማዕድን ይዘት የምግብ ጣዕም እና ድብልቅነት ላይ ከፍተኛ ተጽዕኖ ያሳድራል። ይህም የኒውዮርክ ቤግሎች፣ የኔፕልስ ፒዛ እና የቤልጅግ ቢራ ሌላ ቦታ ማባዣት የማይቻሉ የሚባሉት ነው።' },
    category: 'food',
    sortOrder: 19,
  },
  {
    title: 'Mesob — The Community Table',
    content: 'The mesob is a traditional Ethiopian communal dining basket-table where everyone eats from a shared platter of injera. Eating from the same plate is considered a sign of friendship and trust. Gursha — the act of hand-feeding another person a mouthful — is the ultimate expression of love and respect.',
    titleI18n: { am: 'መሶብ — የማህበረሰብ ጠረጴዛ', om: 'Mesob — Maqaa Hawaasummaa', ar: 'مسوب — مائدة المجتمع' },
    contentI18n: { am: 'መሶብ ባህላዊ የኢትዮጵያ የጋራ ምግብ ቋሚ ቅርጸ-ተርስ ነው ሁሉም ሰው ከአንድ የእንጀራ ድስት የሚመገብበት። ከተመሳሰለ ጠረጴዛ መመገብ የወዳጅነት እና የእምነት ምልክት ነው። ጉርሻ — ሌላ ሰውን በእጅ አፍ መሙላት — የፍቅር እና የክብር መግለጫ ነው።' },
    category: 'food',
    sortOrder: 20,
  },
]

// -------------------------------------------------------
// 10 CULTURAL STORIES
// -------------------------------------------------------
const culturalStories = [
  {
    title: 'The Queen of Sheba\'s Journey',
    content: 'According to Ethiopian legend, the Queen of Sheba (Makeda) traveled to Jerusalem to visit King Solomon around 950 BCE. Their meeting produced a son, Menelik I, who founded the Solomonic Dynasty that ruled Ethiopia for nearly 3,000 years. The Ark of the Covenant is said to rest in Aksum, brought there by Menelik.',
    titleI18n: { am: 'የሳባ ንግሥት ጉዞ', om: 'Imala Nagaartii Saba', ar: 'رحلة ملكة سبأ' },
    contentI18n: { am: 'እንደ ኢትዮጵያ ትውፊት የሳባ ንግሥት (ማከዳ) በ950 ዓ.ዓ. ግድም ወደ እየሩሳሌም ወደ ንጉሥ ሰሎሞን ለመጎብኘት ጉዞ አድርጋለች። የሁለቱ ስብሰባ የማኔሊክ ቀዳማዊ የተባለ ልጅ አፍርቷል እሱም ለገደል 3,000 ዓመታት የኢትዮጵያን የሰሎሞናዊ ሥርወ መንግሥት የመሰረተው።' },
    category: 'culture',
    sortOrder: 1,
  },
  {
    title: 'Lucy — Our Oldest Ancestor',
    content: 'In 1974, scientists discovered "Lucy" (Dinknesh) in the Afar region of Ethiopia — a 3.2 million-year-old Australopithecus afarensis fossil. She was named after the Beatles song "Lucy in the Sky with Diamonds," but Ethiopians call her "Dinknesh," meaning "you are wonderful." She walked upright, changing our understanding of human evolution.',
    titleI18n: { am: 'ሉሲ — የእኛ አፍቃሪ ቅድመ-አያት', om: 'Luusii — Dhaloota Keessan', ar: 'لوسي — أقدم أجدادنا' },
    contentI18n: { am: 'በ1974 ሳይንቲስቶች "ሉሲን" (ድንቅነሽ) በኢትዮጵያ የአፋር ክልል አግኝተዋል — 3.2 ሚሊዮን ዓመት የኦስትራሎፒቴኩስ አፋረንሲስ ፖሲል። የተሰየመው የቢትልስ ዘፈን "ሉሲ ኢን ዘ ስካይ ዊዝ ዳይመንድስ" ቢሆንም ኢትዮጵያውያን "ድንቅነሽ" ብለው ይጠሯታል።' },
    category: 'culture',
    sortOrder: 2,
  },
  {
    title: 'The Rock-Hewn Churches of Lalibela',
    content: 'In the 12th century, King Gebre Mesqel Lalibela commissioned the construction of 11 monolithic churches carved entirely from single blocks of living rock. The Church of St. George (Bete Giyorgis) is carved in the shape of a cross from top to bottom. Some believe angels helped build them, working alongside humans at night.',
    titleI18n: { am: 'የላሊበላ የድንጋይ-ከተሰራ አብያተ ክርስቲያናት', om: 'Gaarrockii Haqaawaa Lallibalaa', ar: 'الكنائس المنحوتة في الصخر في لاليبيلا' },
    contentI18n: { am: 'በ12ኛው ክፍለ ዘመን ንጉሥ ገብረ መስቀል ላሊበላ ከአንድ ድንጋይ ሙሉ በሙሉ የተቆረጡ 11 ሞኖሊቲክ አብያተ ክርስቲያናትን ለመገንባት ትእዛዝ አስተላለፈ። የቅዱስ ጊዮርጊስ ቤተ ክርስቲያን ከላይ ወደ ታች በመስቀል ቅርጽ ተቆርጧል።' },
    category: 'culture',
    sortOrder: 3,
  },
  {
    title: 'Timkat — The Epiphany Celebration',
    content: 'Timkat is Ethiopia\'s most colorful festival, celebrating the baptism of Jesus Christ. Held every January 19th (20th in leap years), priests carry replicas of the Ark of the Covenant in grand processions, and thousands gather at water bodies for symbolic re-baptism. The celebrations last three days with singing, dancing, and feasting.',
    titleI18n: { am: 'ጥምቀት — የጌታ መጥምቀ በዓል', om: 'Timqat — Ayyaana Qabbanaa', ar: 'تيمكات — عيد الغطاس' },
    contentI18n: { am: 'ጥምቀት በኢትዮጵያ ውስጥ በጣም ልቦ ወለድ የሆነ በዓል ሲሆን የኢየሱስ ክርስቶስን ጥምቀት ያከብራል። በየጥር 19 ቀን (በወረሰው ዓመት 20) ቄሳውያን የቃል ኪዳን ታቦት ቅጂዎችን በታላቅ ሰልፍ ይሸከማሉ።' },
    category: 'culture',
    sortOrder: 4,
  },
  {
    title: 'The Battle of Adwa',
    content: 'On March 1, 1896, Ethiopia defeated Italy at the Battle of Adwa, becoming the first African nation to successfully resist European colonization. Emperor Menelik II and Empress Taytu Betul led a diverse army of over 100,000 soldiers. This victory inspired pan-African movements worldwide and remains a symbol of African resistance and pride.',
    titleI18n: { am: 'የአድዋ ጦርነት', om: 'Torban Aduwaa', ar: 'معركة عدوة' },
    contentI18n: { am: 'መጋቢት 1 ቀን 1896 ኢትዮጵያ በአድዋ ጦርነት ጣሊያንን አሸንፋለች — የአውሮፓ ቅኝ ግዛትን በተሳካ ሁኔታ የቋቋመች የመጀመሪያ አፍሪካ ሀገር ሆናለች። ንጉሥ ምኒልክ እና ንግሥት ጣይቱ በጠሉ ከ100,000 በላይ ወታደሮችን መርተዋል።' },
    category: 'culture',
    sortOrder: 5,
  },
  {
    title: 'The Ge\'ez Script — Ancient Writing System',
    content: 'Ethiopia is one of only two African countries (along with Egypt) with an indigenous writing system. Ge\'ez (ግዕዝ) script dates back to the 5th century BCE and is the only native African script still in daily use. It has 231 characters representing consonant-vowel combinations, and is used to write Amharic, Tigrinya, and other Ethiopian languages.',
    titleI18n: { am: 'የግዕዝ ፊደል — ጥንታዊ የጽሑፍ ስርዓት', om: 'Fageessuu Geez — Qubeessa Durii', ar: 'خط Ge\'ez — نظام الكتابة القديم' },
    contentI18n: { am: 'ኢትዮጵያ ከግብፅ ጋር ኗሪ የጽሑፍ ስርዓት ያላቸው ሁለት አፍሪካ ሀገራት አንዷ ናት። የግዕዝ ፊደል ከ5ኛው ክፍለ ዘመን ዓ.ዓ. ጀምሮ ይመላስሳል እና በዕለት ተዕለት ጥቅም ላይ የዋለ ብቸኛው ኗሪ አፍሪካ ፊደል ነው።' },
    category: 'culture',
    sortOrder: 6,
  },
  {
    title: 'Meskel — Finding the True Cross',
    content: 'Meskel commemorates the discovery of the True Cross upon which Jesus was crucified. According to tradition, Queen Helena (Eleni) in the 4th century was guided by smoke from a bonfire to find the cross. Ethiopians celebrate with enormous bonfires (Demera) topped with Meskel daisies, singing and dancing around the flames.',
    titleI18n: { am: 'መስቀል — የእውነተኛውን መስቀል ማግኘት', om: 'Mesqel — Argannoo Mashaqa Dhugaa', ar: 'مسكل — العثور على الصليب الحقيقي' },
    contentI18n: { am: 'መስቀል ኢየሱስ እርግማን የተሰቀለበትን እውነተኛ መስቀል ማግኘት ያከብራል። እንደ ትውፊቱ ንግሥት ሄሌና (ኤሌኒ) በ4ኛው ክፍለ ዘመን ከእሳት ጭስ ተመርታ መስቀሉን አግኝታለች። ኢትዮጵያውያን በመስቀል አበባ የታጀቁ ግዙፍ እሳቶች (ደሜራ) በማቃጠል ያከብራሉ።' },
    category: 'culture',
    sortOrder: 7,
  },
  {
    title: 'The Oromo Gadaa System',
    content: 'The Gadaa system is an ancient Oromo democratic governance system that has operated for over 500 years. It divides society into age-based classes that rotate power every 8 years. UNESCO recognized it as an Intangible Cultural Heritage in 2016. It\'s considered one of the world\'s oldest democratic systems.',
    titleI18n: { am: 'የኦሮሞ ጋዳ ስርዓት', om: 'Sirna Gadaa Oromoo', ar: 'نظام الغادا الأورومو' },
    contentI18n: { am: 'የጋዳ ስርዓት ከ500 ዓመት በላይ የሠራ ጥንታዊ የኦሮሞ ዴሞክራሲያዊ አስተዳደር ስርዓት ነው። ማህበረሰቡን በዕድሜ ላይ የተመሰረቱ መድረኮች ይከፍለዋል እነርሱም ሥልጣንን በየ8 ዓመት ይቀይራሉ። ዩኔስኮ በ2016 እንደ ማይታይ ባህላዊ ቅርስ አውቆታል።' },
    category: 'culture',
    sortOrder: 8,
  },
  {
    title: 'Ethiopian Calendar — 13 Months of Sunshine',
    content: 'Ethiopia uses a unique calendar that is 7-8 years behind the Gregorian calendar. It has 13 months — 12 months of 30 days each and one month of 5 or 6 days. This is why Ethiopia\'s tourism slogan is "13 Months of Sunshine." Ethiopian New Year (Enkutatash) falls on September 11th (or 12th in leap years).',
    titleI18n: { am: 'የኢትዮጵያ ቀን መቁጠሪያ — 13 ወር የፀሐይ', om: 'Waggaa Itoophiyaa — Ji\'a 13 Aduu', ar: 'التقويم الإثيوبي — 13 شهراً من أشعة الشمس' },
    contentI18n: { am: 'ኢትዮጵያ ከግሪጎሪያን ቀን መቁጠሪያ 7-8 ዓመት የኋላ የሆነ ልዩ ቀን መቁጠሪያ ትጠቀማለች። 13 ወራት አሉት — እያንዳንዱ 30 ቀን ያለው 12 ወር እና 5 ወይም 6 ቀን ያለው አንድ ወር። ይህም የኢትዮጵያ ቱሪዝም መልእክት "13 ወር ፀሐይ" የሚለው ለምን እንደሆነ ያስረግጣል።' },
    category: 'culture',
    sortOrder: 9,
  },
  {
    title: 'Aksum — The Ancient Kingdom',
    content: 'The Aksumite Empire (1st-7th century CE) was one of the four greatest civilizations of its time, alongside Rome, Persia, and China. It was the first African state to issue its own coins, and its obelisks (stelae) still stand as UNESCO World Heritage monuments. Aksum was also an early adopter of Christianity, converting in the 4th century.',
    titleI18n: { am: 'አክሱም — ጥንታዊ መንግሥት', om: 'Aksum — Mootummaa Durii', ar: 'أكسوم — المملكة القديمة' },
    contentI18n: { am: 'የአክሱማዊ መንግሥት (1ኛ-7ኛ ክፍለ ዘመን ዓ.ዓ.) ከሮም፣ ፋርስ እና ቻይና ጋር በዘመኑ ከነበሩ አራት ታላላቅ ሥልጣኔዎች አንዱ ነበር። የራሱን ሳንቲም የሰራ የመጀመሪያ አፍሪካ ሀገር ነበረች እና የኋላው ሐውልቶች (ስቲሌ) እስካሁን ዩኔስኮ የዓለም ቅርስ ሐውልቶች ሆነው ይቆማሉ።' },
    category: 'culture',
    sortOrder: 10,
  },
]

// -------------------------------------------------------
// 10 READS (Food/Cooking Articles)
// -------------------------------------------------------
const reads = [
  {
    title: 'The Art of Slow Cooking Ethiopian Stews',
    content: 'Ethiopian wot (stew) is never rushed. The base begins with slowly caramelized onions — sometimes cooked for over an hour without oil, using only the onions\' natural moisture. This technique, called "ye\'doro wot yemeslal," creates a deeply complex flavor foundation that no shortcut can replicate. Patience isn\'t just a virtue in Ethiopian cooking — it\'s an ingredient.',
    titleI18n: { am: 'የኢትዮጵያ ወጥ ቀስ በቀስ ማብሰል ጥበብ', om: 'Ogummaan Wot Itoophiyaa Qoftee', ar: 'فن الطهي البطيء لليخنات الإثيوبية' },
    contentI18n: { am: 'የኢትዮጵያ ወጥ (ምግብ) አቋራጭ የለውም። መሰረቱ ቀስ ብሎ ካራሜላይዝ የተደረጉ ሽንኩርቶች ይጀምራል — አንዳንድ ጊዜ ያለ ዘይት ከአንድ ሰዓት በላይ ይበስላል። ይህ ዘዴ ጥልቅ ውስብስብ የጣዕም መሠረት ይፈጥራል።' },
    category: 'food',
    sortOrder: 1,
  },
  {
    title: 'Understanding Umami — The Fifth Taste',
    content: 'Umami, discovered by Japanese chemist Kikunae Ikeda in 1908, is the fifth basic taste alongside sweet, sour, salty, and bitter. It\'s the savory, meaty flavor found in foods like aged cheese, mushrooms, soy sauce, and tomatoes. Many Ethiopian dishes naturally layer umami through berbere spice, fermented injera, and slow-cooked meats.',
    titleI18n: { am: 'ኡማሚን መረዳት — አምስተኛው ጣዕም', om: "Hubachiisa Umamii — Dhandham'a Shanaffaa", ar: 'فهم الأومامي — المذاق الخامس' },
    contentI18n: { am: 'ኡማሚ በ1908 በጃፓናዊው ኬሚስት ኪኩናዔ ኢኬዳ የተገኘ ከጣፋጭ፣ ስንጥቅ፣ ለስላሳ እና መራራ ጋር አምስተኛው መሰረታዊ ጣዕም ነው። ብዙ የኢትዮጵያ ምግቦች በተፈጥሮ ኡማሚን ይደረድራሉ።' },
    category: 'food',
    sortOrder: 2,
  },
  {
    title: 'The Science of Spicing: Why Heat Feels Good',
    content: 'Capsaicin, the compound that makes chili peppers hot, tricks your brain into thinking your mouth is on fire. In response, your brain releases endorphins — natural painkillers that create a mild euphoria. This is why spicy food can be addictive. Ethiopian cuisine uses this science masterfully, balancing heat with cooling elements like injera and yogurt.',
    titleI18n: { am: 'የቅመም ሳይንስ፡ ሙቀት ለምን ጥሩ ይሰማል', om: "Saayinsii Qamaddaa: Maaliif Ho'aan Gaarii Dhaga'ama", ar: 'علم التوابل: لماذا يشعر الحرارة بالرضا' },
    contentI18n: { am: 'ካፕሳይሲን በርበሬ ሙቀትን የሚያመጣው ውህድ አእምሮዎን አፍዎ እሳት እንደያዘ ያታልላል። ምላሽ ሆኖ አእምሮዎ እንዶርፊኖችን — ቀለል ያለ ደስታ የሚፈጥሩ ተፈጥሮአዊ ህክምናዎች — ያመርታል። ይህም ለምን መራራ ምግብ ሱስ ሊሆን የሚችለው ነው።' },
    category: 'science',
    sortOrder: 3,
  },
  {
    title: 'Fermentation: How Bacteria Feed the World',
    content: 'From the tang of injera to the fizz of kombucha, fermentation transforms food through beneficial microorganisms. During injera fermentation, wild yeasts and lactic acid bacteria break down teff starches over 2-5 days, producing a spongy, slightly sour bread that\'s easier to digest and more nutritious than unfermented flatbreads.',
    titleI18n: { am: 'ማብሰል፡ ባክቴሪያ አለምን እንዴት ያገለግላል', om: "Aana'aa: Bakteeriyaa Akkamitt Duniyaa Nyaachisa", ar: 'التخمير: كيف تغذي البكتيريا العالم' },
    contentI18n: { am: 'ከእንጀራ ጣዕም እስከ ኮምቡቻ ፋዝ ድረስ ማብሰል ምግብን በጠቃሚ ማይክሮኦርጋኒዝሞች ይቀይራል። በእንጀራ ማብሰል ወቅት ዱቄት እህሎች በ2-5 ቀናት ውስጥ በተፈጥሮ እረኞች እና ባክቴሪያዎች ይፈራረሳሉ።' },
    category: 'science',
    sortOrder: 4,
  },
  {
    title: 'Knife Skills Every Home Cook Should Know',
    content: 'Mastering basic knife cuts transforms your cooking speed and consistency. The julienne (matchstick cut), brunoise (tiny dice), and chiffonade (ribbon cut for herbs) are essential techniques. In Ethiopian cooking, finely diced onions (tikur suk\'a) and minced garlic are the foundation of almost every dish — consistency in cutting ensures even cooking.',
    titleI18n: { am: 'እያንዳንዱ የቤት ምግብ ሰሪ መማር ያለበት የስራ ጥበብ', om: 'Ogeeyyii Sakataa Mana Nyaata Barachuu Qabu', ar: 'مهارات السكاكين التي يجب أن يعرفها كل طباخ منزلي' },
    contentI18n: { am: 'መሰረታዊ የስራ ጥበብ መቆረጥ የምግብ አሰራር ፍጥነትን እና ወጥነትን ይቀይራል። በኢትዮጵያ ምግብ አሰራር ውስጥ ደቂቅ የተቆረጠ ሽንኩርት እና ደቂቅ ነጭ ሽንኩርት ማእከላዊ ናቸው።' },
    category: 'food',
    sortOrder: 5,
  },
  {
    title: 'The Maillard Reaction — Why Brown Food Tastes Better',
    content: 'The Maillard reaction is the chemical process that gives browned food its distinctive flavor. When proteins and sugars are heated above 280°F (140°C), they react to create hundreds of new flavor compounds. This is why seared meat, toasted bread, and roasted coffee smell and taste incredible. Ethiopian cooking leverages this through roasted coffee, toasted spices, and seared tibs.',
    titleI18n: { am: 'ማይያር ምላሽ — ቡናማ ምግብ ለምን የተሻለ ጣዕም ያለው', om: "Deebii Maillard — Maaliif Nyaata Boodaa Dhandham'a Qabdi", ar: 'تفاعل مايار — لماذا طعم الطعام البني أفضل' },
    contentI18n: { am: 'የማይያር ምላሽ ቡናማ ምግብ ልዩ ጣዕም የሚሰጠው ኬሚካላዊ ሂደት ነው። ፕሮቲኖች እና ስኳሮች ከ280°F (140°C) በላይ ሲሞቁ መቶዎችን አዳዲስ የጣዕም ውህዶች ለመፍጠር ይሰራሉ።' },
    category: 'science',
    sortOrder: 6,
  },
  {
    title: 'How to Build Flavor Layers',
    content: 'Great cooking is about building flavors in layers, not dumping ingredients together. Start with aromatics (onions, garlic, ginger), add spices and toast them to bloom their oils, introduce acidity (tomato, lemon), then build body with stocks or reductions. Ethiopian cooking masters this: onions first, then niter kibbeh, then berbere bloomed in fat, then the main ingredient.',
    titleI18n: { am: 'የጣዕም ደረጃዎችን እንዴት መገንባት', om: 'Safartuu Dhandhamaa Akkamitt Ijaaruu', ar: 'كيفية بناء طبقات النكهة' },
    contentI18n: { am: 'ጥሩ ምግብ አሰራር ጣዕሞችን በደረጃ መገንባት ነው እንጂ ንጥረ ነገሮችን በአንድ ላይ መውረድ አይደለም። በኢትዮጵያ ምግብ አሰራር ይህ በደንብ ይተገበራል፡ መጀመሪያ ሽንኩርት፣ ከዚያ ንጥር ቅቤ፣ ከዚያ በርበሬ በዘይት ውስጥ ይበቅላል።' },
    category: 'food',
    sortOrder: 7,
  },
  {
    title: 'The Magic of Resting Meat',
    content: 'After cooking meat, letting it rest for 5-15 minutes allows the juices to redistribute evenly throughout the muscle fibers. Cut too soon, and the juices run out onto the cutting board, leaving the meat dry. This applies to everything from a seared steak to Ethiopian tibs — patience after cooking is as important as patience during cooking.',
    titleI18n: { am: 'ስጋን የማረፍ ቻሎቹ', om: 'Seena Nyachaa Boqachuu', ar: 'سحر راحة اللحوم' },
    contentI18n: { am: 'ስጋ ከተበሰለ በኋላ 5-15 ደቂቃ መረጥጥ ጭማቂዎች በጡንቻ ፋይበሮች ውስጥ እንዲዳብሩ ያስችላል። በጣም በፍጥነት መቁረጥ ጭማቂዎች ወደ መቁረጫ ሰሌዳው ላይ ይወርዳሉ እና ስጋው ደረቅ ይሆናል።' },
    category: 'food',
    sortOrder: 8,
  },
  {
    title: 'Salt — The Most Important Ingredient',
    content: 'Salt doesn\'t just make food salty — it enhances all other flavors by suppressing bitterness and amplifying sweetness and umami. The timing of salting matters too: salting meat in advance (dry brining) improves texture, while salting at the end only adds surface flavor. In Ethiopian cooking, salt is often added during the long onion-cooking phase.',
    titleI18n: { am: 'ጨው — አስፈላጊው ንጥረ ነገር', om: 'Mila — Wantii Barbaachisaa', ar: 'الملح — المكون الأهم' },
    contentI18n: { am: 'ጨው ምግቡን ጨው ብቻ አያደርግም — መራራነትን ይጨርሳል እና ጣፋጭነትን እና ኡማሚን ያሳድጋል። በኢትዮጵያ ምግብ አሰራር ውስጥ ጨው ብዙውን ጊዜ በረጅሙ የሽንኩርት ማብሰል ደረጃ ላይ ይታከላል።' },
    category: 'food',
    sortOrder: 9,
  },
  {
    title: 'Acid — The Unsung Hero of Cooking',
    content: 'Acid (lemon juice, vinegar, tomatoes) is what makes a dish feel "complete." It brightens flavors, cuts through richness, and balances heat. If a dish tastes flat, a squeeze of lemon or splash of vinegar often fixes it instantly. Ethiopian cuisine uses lime with raw meat dishes (kitfo) and awaze with tibs for this exact reason — acid balances the richness of the meat.',
    titleI18n: { am: 'አሲድ — የምግብ አሰራር ያልተዘከረ ጀግና', om: 'Asidii — Injifataa Nyaata Hin Yaadatamne', ar: 'الحمض — البطل غير المغني له في الطهي' },
    contentI18n: { am: 'አሲድ (የሎሚ ጭማቂ፣ ኮምጣጤ፣ ቲማቲም) ምግብ "ሙሉ" እንዲሰማ የሚያደርገው ነው። ጣዕሞችን ያበራሳል፣ ብዛትን ይቆርጣል፣ እና ሙቀትን ያመጣጣል። ኢትዮጵያዊ ምግብ ለዚህ ትክክለኛ ምክንያት ከጥሬ ስጋ (ክፍቶ) ጋር ሎሚ እና ከቲብስ ጋር አዋዜ ይጠቀማል።' },
    category: 'food',
    sortOrder: 10,
  },
]

// -------------------------------------------------------
// 30 TRIVIA QUESTIONS (Mix of food, culture, science)
// -------------------------------------------------------
const triviaQuestions = [
  {
    title: 'Ethiopian Coffee Origin',
    content: JSON.stringify({
      question: 'Which country is considered the birthplace of coffee?',
      options: ['Brazil', 'Ethiopia', 'Colombia', 'Vietnam'],
      correctIndex: 1,
      explanation: 'Ethiopia is widely recognized as the birthplace of coffee. The legend of Kaldi the goat herder discovering coffee originates from Ethiopia around 800 AD.',
    }),
    contentI18n: JSON.stringify({
      am: JSON.stringify({
        question: 'የትኛው ሀገር የቡና ሀገር ትቆጠራለች?',
        options: ['ብራዚል', 'ኢትዮጵያ', 'ኮሎምቢያ', 'ቬትናም'],
        correctIndex: 1,
        explanation: 'ኢትዮጵያ የቡና ሀገር ሆና ትቆጠራለች። የካልዲ አጋዘን አሳሽ ቡናን የአገኘበት ታሪክ ከኢትዮጵያ ይጀምራል።',
      }),
      om: JSON.stringify({
        question: 'Biyyi kam buna dhalatte jedhamee beekama?',
        options: ['Brazil', 'Itoophiyaa', 'Kolombiyaa', 'Veetinaam'],
        correctIndex: 1,
        explanation: 'Itoophiyaan buna dhalatte jedhamee beekama.',
      }),
    }),
    category: 'food',
    metadata: JSON.stringify({ difficulty: 'easy' }),
    sortOrder: 1,
  },
  {
    title: 'Injera Grain',
    content: JSON.stringify({
      question: 'What grain is used to make traditional Ethiopian injera?',
      options: ['Wheat', 'Rice', 'Teff', 'Corn'],
      correctIndex: 2,
      explanation: 'Teff is an ancient grain native to Ethiopia and is the primary ingredient in injera. It\'s gluten-free and packed with nutrients.',
    }),
    contentI18n: JSON.stringify({
      am: JSON.stringify({
        question: 'ባህላዊ የኢትዮጵያ እንጀራ ለማዘጋጀት የትኛው እህል ይጠቀማል?',
        options: ['ስንዴ', 'ሩዝ', 'ጤፍ', 'በቆሎ'],
        correctIndex: 2,
        explanation: 'ጤፍ ወደ ኢትዮጵያ ኗሪ ጥንታዊ እህል ሲሆን ዋነኛው የእንጀራ ንጥረ ነገር ነው።',
      }),
    }),
    category: 'food',
    metadata: JSON.stringify({ difficulty: 'easy' }),
    sortOrder: 2,
  },
  {
    title: 'Ethiopian Calendar',
    content: JSON.stringify({
      question: 'How many months does the Ethiopian calendar have?',
      options: ['12', '13', '14', '11'],
      correctIndex: 1,
      explanation: 'The Ethiopian calendar has 13 months — 12 months of 30 days each and one month of 5 or 6 days. This is why Ethiopia promotes "13 Months of Sunshine."',
    }),
    contentI18n: JSON.stringify({
      am: JSON.stringify({
        question: 'የኢትዮጵያ ቀን መቁጠሪያ ስንት ወራት አሉት?',
        options: ['12', '13', '14', '11'],
        correctIndex: 1,
        explanation: 'የኢትዮጵያ ቀን መቁጠሪያ 13 ወራት አሉት — እያንዳንዱ 30 ቀን ያለው 12 ወር እና 5 ወይም 6 ቀን ያለው አንድ ወር።',
      }),
    }),
    category: 'culture',
    metadata: JSON.stringify({ difficulty: 'easy' }),
    sortOrder: 3,
  },
  {
    title: 'Berbere Spice Count',
    content: JSON.stringify({
      question: 'How many individual spices can be in Ethiopian berbere blend?',
      options: ['3-5', '5-10', 'Up to 20', 'Over 30'],
      correctIndex: 2,
      explanation: 'Berbere can contain up to 20 individual spices including chili peppers, fenugreek, coriander, cardamom, and black pepper. Every family has their own recipe.',
    }),
    contentI18n: JSON.stringify({
      am: JSON.stringify({
        question: 'በኢትዮጵያ በርበሬ ድብልቅ ውስጥ ስንት ቅመሞች ሊካተቱ ይችላሉ?',
        options: ['3-5', '5-10', 'እስከ 20', 'ከ30 በላይ'],
        correctIndex: 2,
        explanation: 'በርበሬ እስከ 20 የተለያዩ ቅመሞችን ሊይዝ ይችላል።',
      }),
    }),
    category: 'food',
    metadata: JSON.stringify({ difficulty: 'medium' }),
    sortOrder: 4,
  },
  {
    title: 'Lucy Discovery',
    content: JSON.stringify({
      question: 'How old is the fossil "Lucy" (Dinknesh) discovered in Ethiopia?',
      options: ['1.2 million years', '3.2 million years', '5 million years', '10 million years'],
      correctIndex: 1,
      explanation: 'Lucy (Dinknesh) is a 3.2 million-year-old Australopithecus afarensis fossil found in the Afar region of Ethiopia in 1974.',
    }),
    contentI18n: JSON.stringify({
      am: JSON.stringify({
        question: 'በኢትዮጵያ የተገኘው "ሉሲ" (ድንቅነሽ) ፖሲል የስንት ዓመት ነው?',
        options: ['1.2 ሚሊዮን ዓመት', '3.2 ሚሊዮን ዓመት', '5 ሚሊዮን ዓመት', '10 ሚሊዮን ዓመት'],
        correctIndex: 1,
        explanation: 'ሉሲ (ድንቅነሽ) 3.2 ሚሊዮን ዓመት የኦስትራሎፒቴኩስ አፋረንሲስ ፖሲል ነው።',
      }),
    }),
    category: 'culture',
    metadata: JSON.stringify({ difficulty: 'medium' }),
    sortOrder: 5,
  },
  {
    title: 'Saffron Cost',
    content: JSON.stringify({
      question: 'Why is saffron the world\'s most expensive spice?',
      options: ['It only grows in one country', 'Each flower has only 3 stigmas hand-picked', 'It takes 10 years to grow', 'It requires rare soil'],
      correctIndex: 1,
      explanation: 'Each saffron crocus flower contains only 3 stigmas that must be hand-picked. It takes about 75,000 flowers to produce one pound of saffron.',
    }),
    category: 'food',
    metadata: JSON.stringify({ difficulty: 'medium' }),
    sortOrder: 6,
  },
  {
    title: 'Adwa Battle Year',
    content: JSON.stringify({
      question: 'In what year did Ethiopia defeat Italy at the Battle of Adwa?',
      options: ['1885', '1896', '1902', '1914'],
      correctIndex: 1,
      explanation: 'On March 1, 1896, Ethiopia defeated Italy at the Battle of Adwa, becoming the first African nation to successfully resist European colonization.',
    }),
    contentI18n: JSON.stringify({
      am: JSON.stringify({
        question: 'ኢትዮጵያ ጣሊያንን በአድዋ ጦርነት በየትኛው ዓመት አሸንፋለች?',
        options: ['1885', '1896', '1902', '1914'],
        correctIndex: 1,
        explanation: 'መጋቢት 1 ቀን 1896 ኢትዮጵያ በአድዋ ጦርነት ጣሊያንን አሸንፋለች።',
      }),
    }),
    category: 'history',
    metadata: JSON.stringify({ difficulty: 'medium' }),
    sortOrder: 7,
  },
  {
    title: 'Cooking Temperature',
    content: JSON.stringify({
      question: 'At what temperature does the Maillard reaction begin?',
      options: ['212°F (100°C)', '280°F (140°C)', '350°F (175°C)', '400°F (200°C)'],
      correctIndex: 1,
      explanation: 'The Maillard reaction begins at approximately 280°F (140°C), when proteins and sugars react to create the browning and complex flavors in cooked food.',
    }),
    category: 'science',
    metadata: JSON.stringify({ difficulty: 'hard' }),
    sortOrder: 8,
  },
  {
    title: 'Lalibela Churches',
    content: JSON.stringify({
      question: 'How many rock-hewn churches are in Lalibela?',
      options: ['7', '9', '11', '13'],
      correctIndex: 2,
      explanation: 'There are 11 monolithic rock-hewn churches in Lalibela, carved in the 12th century from single blocks of living rock. They are a UNESCO World Heritage Site.',
    }),
    contentI18n: JSON.stringify({
      am: JSON.stringify({
        question: 'ላሊበላ ውስጥ ስንት የድንጋይ-ከተሰራ አብያተ ክርስቲያናት አሉ?',
        options: ['7', '9', '11', '13'],
        correctIndex: 2,
        explanation: 'ላሊበላ ውስጥ 11 ሞኖሊቲክ የድንጋይ-ከተሰራ አብያተ ክርስቲያናት አሉ።',
      }),
    }),
    category: 'culture',
    metadata: JSON.stringify({ difficulty: 'medium' }),
    sortOrder: 9,
  },
  {
    title: 'Capsaicin Effect',
    content: JSON.stringify({
      question: 'What chemical in chili peppers causes the sensation of heat?',
      options: ['Caffeine', 'Capsaicin', 'Piperine', 'Allicin'],
      correctIndex: 1,
      explanation: 'Capsaicin is the chemical compound in chili peppers that binds to pain receptors in your mouth, creating the sensation of heat and triggering endorphin release.',
    }),
    category: 'science',
    metadata: JSON.stringify({ difficulty: 'easy' }),
    sortOrder: 10,
  },
  {
    title: 'Tej Ingredients',
    content: JSON.stringify({
      question: 'What plant gives Ethiopian honey wine (Tej) its unique bitter-sweet flavor?',
      options: ['Hops', 'Gesho (Rhamnus prinoides)', 'Moringa', 'Rosemary'],
      correctIndex: 1,
      explanation: 'Gesho (Rhamnus prinoides) leaves are used in Tej production, providing both the distinctive bitter-sweet flavor and acting as a natural preservative.',
    }),
    category: 'food',
    metadata: JSON.stringify({ difficulty: 'medium' }),
    sortOrder: 11,
  },
  {
    title: 'Coffee Production',
    content: JSON.stringify({
      question: 'Which country is currently the world\'s largest coffee producer?',
      options: ['Ethiopia', 'Colombia', 'Vietnam', 'Brazil'],
      correctIndex: 3,
      explanation: 'Brazil is currently the world\'s largest coffee producer, followed by Vietnam. Ethiopia, while the birthplace of coffee, is the 5th largest producer globally.',
    }),
    category: 'food',
    metadata: JSON.stringify({ difficulty: 'easy' }),
    sortOrder: 12,
  },
  {
    title: 'Gursha Meaning',
    content: JSON.stringify({
      question: 'What is "Gursha" in Ethiopian culture?',
      options: ['A type of bread', 'Hand-feeding another person a mouthful', 'A coffee ceremony step', 'A traditional dance'],
      correctIndex: 1,
      explanation: 'Gursha is the Ethiopian tradition of hand-feeding another person a mouthful of food. It\'s the ultimate expression of love, respect, and friendship in Ethiopian culture.',
    }),
    contentI18n: JSON.stringify({
      am: JSON.stringify({
        question: '"ጉርሻ" በኢትዮጵያ ባህል ውስጥ ምን ማለት ነው?',
        options: ['የዳቦ ዓይነት', 'ሌላ ሰውን በእጅ አፍ መሙላት', 'የቡና ስርዓት ደረጃ', 'ባህላዊ ዘፈን'],
        correctIndex: 1,
        explanation: 'ጉርሻ በኢትዮጵያ ባህል ውስጥ ሌላ ሰውን በእጅ አፍ መሙላት ማለት ነው። የፍቅር፣ ክብር እና ወዳጅነት መግለጫ ነው።',
      }),
    }),
    category: 'culture',
    metadata: JSON.stringify({ difficulty: 'easy' }),
    sortOrder: 13,
  },
  {
    title: 'Fermentation Discovery',
    content: JSON.stringify({
      question: 'How old is the practice of food fermentation?',
      options: ['2,000 years', '5,000 years', 'Over 9,000 years', '500 years'],
      correctIndex: 2,
      explanation: 'Fermentation is one of the oldest food preservation methods, dating back over 9,000 years. It\'s used in cultures worldwide, from Ethiopian injera to Korean kimchi.',
    }),
    category: 'science',
    metadata: JSON.stringify({ difficulty: 'medium' }),
    sortOrder: 14,
  },
  {
    title: 'Fasting Days',
    content: JSON.stringify({
      question: 'How many fasting days do Ethiopian Orthodox Christians observe per year?',
      options: ['40', '100', 'Over 250', '365'],
      correctIndex: 2,
      explanation: 'Ethiopian Orthodox Christians observe over 250 fasting days per year, during which they abstain from all animal products, creating one of the world\'s richest vegan cuisines.',
    }),
    contentI18n: JSON.stringify({
      am: JSON.stringify({
        question: 'የኢትዮጵያ ኦርቶዶክስ ክርስቲያኖች በዓመት ስንት የጾም ቀናትን ይጠብቃሉ?',
        options: ['40', '100', 'ከ250 በላይ', '365'],
        correctIndex: 2,
        explanation: 'የኢትዮጵያ ኦርቶዶክስ ክርስቲያኖች በዓመት ከ250 በላይ የጾም ቀናትን ይጠብቃሉ።',
      }),
    }),
    category: 'culture',
    metadata: JSON.stringify({ difficulty: 'hard' }),
    sortOrder: 15,
  },
  {
    title: 'Cheese Origin',
    content: JSON.stringify({
      question: 'According to legend, how was cheese accidentally discovered?',
      options: ['Milk left in the sun', 'Milk stored in a sheep stomach pouch', 'Milk mixed with honey', 'Milk frozen then thawed'],
      correctIndex: 1,
      explanation: 'Legend says cheese was discovered when an Arab trader stored milk in a pouch made from a sheep\'s stomach. The rennet in the stomach lining caused the milk to separate into curds and whey.',
    }),
    category: 'food',
    metadata: JSON.stringify({ difficulty: 'easy' }),
    sortOrder: 16,
  },
  {
    title: 'Ge\'ez Script Age',
    content: JSON.stringify({
      question: 'How old is the Ge\'ez writing system used in Ethiopia?',
      options: ['500 years', '1,000 years', 'Over 2,500 years', '100 years'],
      correctIndex: 2,
      explanation: 'The Ge\'ez script dates back to the 5th century BCE, making it over 2,500 years old. It\'s the only native African script still in daily use today.',
    }),
    category: 'culture',
    metadata: JSON.stringify({ difficulty: 'hard' }),
    sortOrder: 17,
  },
  {
    title: 'Teff Size',
    content: JSON.stringify({
      question: 'How many teff grains equal the size of one grain of wheat?',
      options: ['10', '50', '150', '500'],
      correctIndex: 2,
      explanation: 'Teff grains are so small that 150 grains equal the size of one grain of wheat. Despite its tiny size, teff is a nutritional powerhouse.',
    }),
    category: 'food',
    metadata: JSON.stringify({ difficulty: 'hard' }),
    sortOrder: 18,
  },
  {
    title: 'Umami Discovery',
    content: JSON.stringify({
      question: 'In what year was umami identified as the fifth basic taste?',
      options: ['1898', '1908', '1928', '1958'],
      correctIndex: 1,
      explanation: 'Umami was identified by Japanese chemist Kikunae Ikeda in 1908. He discovered that glutamate was responsible for the savory taste in dashi (Japanese soup stock).',
    }),
    category: 'science',
    metadata: JSON.stringify({ difficulty: 'medium' }),
    sortOrder: 19,
  },
  {
    title: 'Aksum Coinage',
    content: JSON.stringify({
      question: 'The Aksumite Empire was the first African state to do what?',
      options: ['Build stone buildings', 'Issue its own coins', 'Adopt Christianity', 'Create a written language'],
      correctIndex: 1,
      explanation: 'The Aksumite Empire was the first African state to issue its own coins, around the 3rd century CE. This demonstrated their economic sophistication and international trade connections.',
    }),
    category: 'history',
    metadata: JSON.stringify({ difficulty: 'medium' }),
    sortOrder: 20,
  },
  {
    title: 'Doro Wot Cooking Time',
    content: JSON.stringify({
      question: 'How long can a traditional Ethiopian Doro Wot take to prepare?',
      options: ['1 hour', '3 hours', 'Over 24 hours', '6 hours'],
      correctIndex: 2,
      explanation: 'A traditional Doro Wot preparation can take over 24 hours, primarily due to the slow caramelization of onions without oil, which alone can take several hours.',
    }),
    contentI18n: JSON.stringify({
      am: JSON.stringify({
        question: 'ባህላዊ የኢትዮጵያ ዶሮ ወጥ ለማዘጋጀት ስንት ጊዜ ይወስዳል?',
        options: ['1 ሰዓት', '3 ሰዓት', 'ከ24 ሰዓት በላይ', '6 ሰዓት'],
        correctIndex: 2,
        explanation: 'ባህላዊ የዶሮ ወጥ ዝግጅት ከ24 ሰዓት በላይ ሊወስድ ይችላል።',
      }),
    }),
    category: 'food',
    metadata: JSON.stringify({ difficulty: 'medium' }),
    sortOrder: 21,
  },
  {
    title: 'Chocolate Origin Word',
    content: JSON.stringify({
      question: 'The word "chocolate" comes from which ancient language?',
      options: ['Latin', 'Aztec (Nahuatl)', 'Greek', 'Sanskrit'],
      correctIndex: 1,
      explanation: 'The word "chocolate" comes from the Aztec (Nahuatl) word "xocolātl," which referred to a bitter, frothy cacao beverage drunk by the Aztecs.',
    }),
    category: 'food',
    metadata: JSON.stringify({ difficulty: 'medium' }),
    sortOrder: 22,
  },
  {
    title: 'Coffee Ceremony Duration',
    content: JSON.stringify({
      question: 'How long can a traditional Ethiopian coffee ceremony last?',
      options: ['15 minutes', '30 minutes', 'Up to 3 hours', '1 hour'],
      correctIndex: 2,
      explanation: 'A traditional Ethiopian coffee ceremony can last up to 3 hours, involving roasting green beans, grinding by hand, and brewing in a jebena clay pot.',
    }),
    category: 'culture',
    metadata: JSON.stringify({ difficulty: 'easy' }),
    sortOrder: 23,
  },
  {
    title: 'Gadaa System',
    content: JSON.stringify({
      question: 'How often does power rotate in the Oromo Gadaa system?',
      options: ['Every 4 years', 'Every 8 years', 'Every 12 years', 'Every 16 years'],
      correctIndex: 1,
      explanation: 'In the Gadaa system, power rotates every 8 years between age-based classes. This democratic governance system has operated for over 500 years and was recognized by UNESCO in 2016.',
    }),
    category: 'culture',
    metadata: JSON.stringify({ difficulty: 'hard' }),
    sortOrder: 24,
  },
  {
    title: 'New World Chili',
    content: JSON.stringify({
      question: 'When were chili peppers introduced to the Old World?',
      options: ['1000 CE', '1493', '1600', '1800'],
      correctIndex: 1,
      explanation: 'Chili peppers are native to the Americas and were unknown in the Old World until Columbus brought them back to Europe in 1493.',
    }),
    category: 'history',
    metadata: JSON.stringify({ difficulty: 'medium' }),
    sortOrder: 25,
  },
  {
    title: 'Niter Kibbeh Shelf Life',
    content: JSON.stringify({
      question: 'What makes Ethiopian niter kibbeh (spiced butter) able to last without refrigeration?',
      options: ['High salt content', 'Clarification removes milk solids', 'Added preservatives', 'Freezing'],
      correctIndex: 1,
      explanation: 'Niter kibbeh is clarified butter — the clarification process removes milk solids (which spoil) leaving only the pure fat. The added spices also have antimicrobial properties.',
    }),
    category: 'science',
    metadata: JSON.stringify({ difficulty: 'medium' }),
    sortOrder: 26,
  },
  {
    title: 'Meskel Celebration',
    content: JSON.stringify({
      question: 'What flower is traditionally used to decorate the Meskel bonfire?',
      options: ['Roses', 'Meskel daisies', 'Lilies', 'Sunflowers'],
      correctIndex: 1,
      explanation: 'Meskel daisies (golden Adey Abeba) are traditionally used to decorate the Demera bonfire during the Meskel celebration, which commemorates the finding of the True Cross.',
    }),
    category: 'culture',
    metadata: JSON.stringify({ difficulty: 'easy' }),
    sortOrder: 27,
  },
  {
    title: 'Sushi Modern Form',
    content: JSON.stringify({
      question: 'Who invented modern nigiri sushi?',
      options: ['A Chinese chef', 'Hanaya Yohei in Edo', 'A Korean monk', 'A Thai merchant'],
      correctIndex: 1,
      explanation: 'Modern nigiri sushi was invented by Hanaya Yohei in Edo (Tokyo) in the 1820s, who replaced the traditional fermentation process with fresh fish on vinegared rice.',
    }),
    category: 'food',
    metadata: JSON.stringify({ difficulty: 'hard' }),
    sortOrder: 28,
  },
  {
    title: 'Ethiopian New Year',
    content: JSON.stringify({
      question: 'When does Ethiopian New Year (Enkutatash) fall on the Gregorian calendar?',
      options: ['January 1', 'March 21', 'September 11', 'July 1'],
      correctIndex: 2,
      explanation: 'Ethiopian New Year (Enkutatash) falls on September 11th (or 12th in leap years) on the Gregorian calendar, marking the end of the rainy season.',
    }),
    contentI18n: JSON.stringify({
      am: JSON.stringify({
        question: 'የኢትዮጵያ አዲስ ዓመት (እንቁጣጣሽ) በግሪጎሪያን ቀን መቁጠሪያ መቼ ነው?',
        options: ['ጥር 1', 'መጋቢት 21', 'መስከረም 11', 'ሐምሌ 1'],
        correctIndex: 2,
        explanation: 'የኢትዮጵያ አዲስ ዓመት (እንቁጣጣሽ) በግሪጎሪያን ቀን መቁጠሪያ መስከረም 11 ቀን ይወድቃል።',
      }),
    }),
    category: 'culture',
    metadata: JSON.stringify({ difficulty: 'medium' }),
    sortOrder: 29,
  },
  {
    title: 'Teff World Supply',
    content: JSON.stringify({
      question: 'What percentage of the world\'s teff supply does Ethiopia produce?',
      options: ['50%', '70%', '90%', '100%'],
      correctIndex: 2,
      explanation: 'Ethiopia produces about 90% of the world\'s teff supply. Teff is native to Ethiopia and remains primarily an Ethiopian crop, though interest in it is growing globally.',
    }),
    category: 'food',
    metadata: JSON.stringify({ difficulty: 'medium' }),
    sortOrder: 30,
  },
]

// -------------------------------------------------------
// SEED FUNCTION
// -------------------------------------------------------

async function main() {
  console.log('🌱 Seeding entertainment content...\n')

  // Clear existing platform-wide content
  const deleted = await prisma.entertainmentContent.deleteMany({
    where: { restaurantId: null },
  })
  console.log(`  🗑️  Cleared ${deleted.count} existing platform-wide items\n`)

  let totalCreated = 0

  // Seed food facts
  console.log('📋 Seeding food facts...')
  for (const fact of foodFacts) {
    await prisma.entertainmentContent.create({
      data: {
        restaurantId: null,
        type: 'fact',
        category: fact.category,
        title: fact.title,
        titleI18n: fact.titleI18n ? JSON.stringify(fact.titleI18n) : null,
        content: fact.content,
        contentI18n: fact.contentI18n ? JSON.stringify(fact.contentI18n) : null,
        imageUrl: null,
        metadata: null,
        sortOrder: fact.sortOrder,
        isActive: true,
      },
    })
    totalCreated++
  }
  console.log(`  ✅ Created ${foodFacts.length} food facts\n`)

  // Seed cultural stories
  console.log('📖 Seeding cultural stories...')
  for (const story of culturalStories) {
    await prisma.entertainmentContent.create({
      data: {
        restaurantId: null,
        type: 'story',
        category: story.category,
        title: story.title,
        titleI18n: story.titleI18n ? JSON.stringify(story.titleI18n) : null,
        content: story.content,
        contentI18n: story.contentI18n ? JSON.stringify(story.contentI18n) : null,
        imageUrl: null,
        metadata: null,
        sortOrder: story.sortOrder,
        isActive: true,
      },
    })
    totalCreated++
  }
  console.log(`  ✅ Created ${culturalStories.length} cultural stories\n`)

  // Seed reads
  console.log('📚 Seeding reads...')
  for (const read of reads) {
    await prisma.entertainmentContent.create({
      data: {
        restaurantId: null,
        type: 'read',
        category: read.category,
        title: read.title,
        titleI18n: read.titleI18n ? JSON.stringify(read.titleI18n) : null,
        content: read.content,
        contentI18n: read.contentI18n ? JSON.stringify(read.contentI18n) : null,
        imageUrl: null,
        metadata: null,
        sortOrder: read.sortOrder,
        isActive: true,
      },
    })
    totalCreated++
  }
  console.log(`  ✅ Created ${reads.length} reads\n`)

  // Seed trivia questions
  console.log('❓ Seeding trivia questions...')
  for (const trivia of triviaQuestions) {
    await prisma.entertainmentContent.create({
      data: {
        restaurantId: null,
        type: 'trivia_question',
        category: trivia.category,
        title: trivia.title,
        titleI18n: (trivia as any).titleI18n ? JSON.stringify((trivia as any).titleI18n) : null,
        content: trivia.content,
        contentI18n: trivia.contentI18n ? JSON.stringify(trivia.contentI18n) : null,
        imageUrl: null,
        metadata: trivia.metadata || null,
        sortOrder: trivia.sortOrder,
        isActive: true,
      },
    })
    totalCreated++
  }
  console.log(`  ✅ Created ${triviaQuestions.length} trivia questions\n`)

  console.log(`🎉 Entertainment content seeding complete!`)
  console.log(`   Total items created: ${totalCreated}`)
  console.log(`   - ${foodFacts.length} food facts`)
  console.log(`   - ${culturalStories.length} cultural stories`)
  console.log(`   - ${reads.length} reads`)
  console.log(`   - ${triviaQuestions.length} trivia questions`)
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
