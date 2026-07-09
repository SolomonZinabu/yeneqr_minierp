// ============================================================
// Yene QR — Digital Books & Magazines Seed
// ============================================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding digital books & magazines...\n');

  // ── Book 1: Ethiopian Coffee Culture ──
  const book1 = await prisma.book.upsert({
    where: { id: 'book-coffee-culture' },
    update: {},
    create: {
      id: 'book-coffee-culture',
      title: 'Ethiopian Coffee Culture',
      author: 'YeneQR Press',
      description: 'A journey through the history, ritual, and soul of Ethiopian coffee — from Kaldi\'s dancing goats to the modern coffee ceremony.',
      coverImage: null,
      category: 'culture',
      language: 'en',
      isActive: true,
      sortOrder: 1,
    },
  });

  const chapters1 = [
    { title: 'The Discovery', content: 'In the ancient highlands of Kaffa, around 850 AD, a goat herder named Kaldi noticed something extraordinary. His goats, usually calm and sedate, were dancing with unusual energy after eating red berries from a mysterious plant. Curious, Kaldi tried the berries himself and felt a surge of vitality unlike anything he had experienced before.\n\nHe rushed to the nearest monastery, eager to share his discovery. The head monk, skeptical of this "devil\'s fruit," threw the berries into the fire. But as the beans roasted, an intoxicating aroma filled the room. The monks raked them from the flames, crushed them, and dissolved them in hot water — creating the world\'s first cup of coffee.\n\nFrom that moment, coffee became woven into the fabric of Ethiopian life. It was not merely a beverage but a sacred ritual, a symbol of hospitality, and a cornerstone of community. The story of Kaldi and his dancing goats spread across the highlands, and eventually across the world.', chapterNumber: 1 },
    { title: 'The Coffee Ceremony', content: 'The Ethiopian coffee ceremony, known as "Buna Tetu" or "come drink coffee," is one of the most important social rituals in Ethiopian culture. It is performed three times a day in many households — morning, noon, and evening — and can last up to three hours.\n\nThe ceremony is always led by a woman, who begins by spreading fresh grass and flowers on the floor, evoking the highland meadows where coffee was born. Green coffee beans are washed and roasted in a flat pan over charcoal, filling the room with an aromatic smoke that is believed to cleanse the space and invite blessings.\n\nThe roasted beans are ground by hand in a wooden mortar and brewed in a clay pot called a jebena. The coffee is served in three rounds, each with its own name and significance:\n\n• Abol (First Round): The strongest and most flavorful, representing the spirit of the ceremony.\n• Tona (Second Round): Brewed by adding more water to the same grounds, slightly milder.\n• Bereka (Third Round): The weakest but most spiritually significant — "bereka" means "to be blessed."\n\nEach round is served in small handleless cups called sini, often accompanied by popcorn or roasted barley. Leaving before the third round is considered impolite, as the full ceremony represents a complete act of hospitality and community.', chapterNumber: 2 },
    { title: 'From Ethiopia to the World', content: 'Coffee\'s journey from the Ethiopian highlands to the rest of the world is a story of trade, religion, and empire. By the 15th century, coffee had reached Yemen, where Sufi monks used it to stay awake during nighttime prayers. From Yemen, coffee spread to Mecca, Cairo, and Istanbul, where the world\'s first coffeehouses opened in the 16th century.\n\nThese coffeehouses became centers of social life, political discussion, and intellectual exchange. They were called "schools of the wise" — places where people gathered to listen to poetry, play chess, and debate the issues of the day. The English word "coffee" itself derives from the Amharic "buna" through the Arabic "qahwa" and the Turkish "kahve."\n\nToday, Ethiopia is the fifth-largest coffee producer in the world and the top producer in Africa. The country produces some of the most distinctive and sought-after coffee varieties, including Yirgacheffe, Sidamo, and Harrar — each with its own unique flavor profile shaped by the terroir of the Ethiopian highlands.\n\nYet despite coffee\'s global journey, its heart remains in Ethiopia, where the coffee ceremony continues to be performed much as it was a thousand years ago — a sacred ritual of community, hospitality, and connection.', chapterNumber: 3 },
  ];

  for (const ch of chapters1) {
    await prisma.bookChapter.create({
      data: { bookId: book1.id, ...ch, wordCount: ch.content.split(/\s+/).length },
    }).catch(() => {}); // Skip if exists
  }
  console.log(`  ✅ Book 1: "${book1.title}" with ${chapters1.length} chapters`);

  // ── Book 2: Guide to Ethiopian Cuisine ──
  const book2 = await prisma.book.upsert({
    where: { id: 'book-ethiopian-cuisine' },
    update: {},
    create: {
      id: 'book-ethiopian-cuisine',
      title: 'A Guide to Ethiopian Cuisine',
      author: 'YeneQR Press',
      description: 'Everything you need to know about Ethiopian food — from injera to berbere, from wot to gursha.',
      coverImage: null,
      category: 'food',
      language: 'en',
      isActive: true,
      sortOrder: 2,
    },
  });

  const chapters2 = [
    { title: 'Injera: The Foundation', content: 'Injera is more than just bread — it is the foundation of Ethiopian dining. Made from teff, an ancient grain native to the Ethiopian highlands, injera is a sourdough flatbread unlike anything else in the world. Its unique spongy texture and slightly sour taste come from a fermentation process that takes several days.\n\nThe preparation of injera is an art passed down through generations. The batter is poured in a thin circle onto a large clay plate called a mitad, heated over an open fire. As it cooks, tiny bubbles form on the surface, creating the characteristic porous texture that makes injera perfect for soaking up sauces and stews.\n\nIn Ethiopian culture, injera is both plate and utensil. Meals are served on a shared platter of injera, with stews ladled on top. Diners tear off pieces of the injera to scoop up food, eating with their right hand. The injera underneath the stews absorbs all the flavors — Ethiopians call this "wot-fita" and consider it the best part.', chapterNumber: 1 },
    { title: 'Berbere: The Soul of Ethiopian Cooking', content: 'Berbere is the fiery, complex spice blend that defines Ethiopian cuisine. Its name comes from the Amharic word "barbare," meaning "pepper" or "hot." A single batch can contain up to 20 different spices, including chili peppers, fenugreek, coriander, cardamom, black pepper, allspice, cumin, cloves, cinnamon, and nutmeg.\n\nEvery family has its own closely guarded berbere recipe, passed down through generations. The preparation is labor-intensive: whole dried chili peppers are sun-dried and ground by hand on a traditional stone mortar. Other spices are separately roasted and ground before being carefully blended.\n\nBerbere is the backbone of wot (stew), Ethiopia\'s national dish. Without berbere, there is no Ethiopian cuisine. It transforms simple ingredients — chicken, lentils, beef — into complex, deeply flavorful dishes that linger in memory long after the meal is over.', chapterNumber: 2 },
  ];

  for (const ch of chapters2) {
    await prisma.bookChapter.create({
      data: { bookId: book2.id, ...ch, wordCount: ch.content.split(/\s+/).length },
    }).catch(() => {});
  }
  console.log(`  ✅ Book 2: "${book2.title}" with ${chapters2.length} chapters`);

  // ── Magazine 1: Taste of Ethiopia Issue 1 ──
  const mag1 = await prisma.magazine.upsert({
    where: { id: 'mag-taste-ethiopia-1' },
    update: {},
    create: {
      id: 'mag-taste-ethiopia-1',
      title: 'Taste of Ethiopia',
      description: 'A digital magazine celebrating Ethiopian food, culture, and innovation.',
      coverImage: null,
      issueNumber: 1,
      publishDate: new Date('2024-09-01'),
      category: 'food',
      isActive: true,
      sortOrder: 1,
    },
  });

  const articles1 = [
    { title: 'The Rise of Modern Ethiopian Cuisine', subtitle: 'How a new generation of chefs is reimagining tradition', author: 'Editorial Team', content: 'In restaurants across Addis Ababa, a culinary revolution is underway. Young chefs trained in Paris, New York, and Tokyo are returning home with new techniques and ideas, applying them to the ancient ingredients and recipes of Ethiopian cuisine.\n\nThe result is something entirely new: modern Ethiopian cuisine that respects tradition while embracing innovation. Think injera made with ancient grain blends, doro wot slow-cooked sous-vide, and berbere-infused cocktails. These chefs are not replacing tradition — they are extending it, proving that Ethiopian food has unlimited potential for reinvention.\n\n"Ethiopian cuisine has always been innovative," says Chef Meron Tesfaye, owner of Blue Nile Bistro. "We were fermenting teff before anyone knew what probiotics were. We were plant-based before it was trendy. The world is just catching up to what we\'ve known for thousands of years."', readTimeMinutes: 4, sortOrder: 1 },
    { title: 'Coffee Tourism in Ethiopia', subtitle: 'Visit the birthplace of coffee', author: 'Travel Desk', content: 'For coffee lovers, a trip to Ethiopia is a pilgrimage. The country offers several coffee tourism experiences, from visiting the Kaffa region where coffee was first discovered to participating in traditional coffee ceremonies in Addis Ababa.\n\nPopular destinations include the Yirgacheffe region, known for its light, floral coffee; Sidamo, home to full-bodied, fruity beans; and Harrar, famous for its natural-process coffee with blueberry notes. Many farms offer tours where visitors can pick coffee cherries, participate in the washing process, and roast their own beans.\n\nThe Ethiopian Coffee Museum in Jimma offers a comprehensive look at coffee\'s history, from its discovery to its global spread. And in Addis Ababa, the Tomoca Coffee shop — established in 1953 — remains the city\'s most iconic coffee destination.', readTimeMinutes: 3, sortOrder: 2 },
  ];

  for (const art of articles1) {
    await prisma.magazineArticle.create({
      data: { magazineId: mag1.id, ...art },
    }).catch(() => {});
  }
  console.log(`  ✅ Magazine 1: "${mag1.title}" Issue #${mag1.issueNumber} with ${articles1.length} articles`);

  console.log('\n🎉 Digital books & magazines seeded!');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
