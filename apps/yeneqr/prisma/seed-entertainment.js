// ============================================================
// Yene QR — Entertainment Content Seed
// Seeds platform-wide trivia, facts, stories, and reads
// Run: node prisma/seed-entertainment.js
// ============================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding entertainment content...\n');

  // ── Trivia Questions ──
  const trivia = [
    { title: 'Injera Ingredients', content: JSON.stringify({ question: 'What grain is traditionally used to make injera?', options: ['Wheat', 'Teff', 'Barley', 'Corn'], correctIndex: 1, explanation: 'Teff is a tiny grain native to Ethiopia and is the main ingredient in injera.' }), category: 'food', difficulty: 'easy' },
    { title: 'Coffee Origin', content: JSON.stringify({ question: 'Coffee was first discovered in which region?', options: ['Yemen', 'Ethiopia', 'Brazil', 'Colombia'], correctIndex: 1, explanation: 'Coffee was discovered in the Kaffa region of Ethiopia by a goat herder named Kaldi.' }), category: 'food', difficulty: 'easy' },
    { title: 'Ethiopian Calendar', content: JSON.stringify({ question: 'How many months are in the Ethiopian calendar?', options: ['10', '12', '13', '14'], correctIndex: 2, explanation: 'The Ethiopian calendar has 13 months — 12 months of 30 days and one month of 5 or 6 days.' }), category: 'culture', difficulty: 'medium' },
    { title: 'Berbere Spice', content: JSON.stringify({ question: 'What is the main spice in berbere?', options: ['Cumin', 'Chili pepper', 'Turmeric', 'Coriander'], correctIndex: 1, explanation: 'Berbere is a spice mixture whose key ingredient is chili pepper, combined with many other spices.' }), category: 'food', difficulty: 'medium' },
    { title: 'Ethiopian New Year', content: JSON.stringify({ question: 'When is Ethiopian New Year (Enkutatash)?', options: ['January 1', 'September 11', 'March 21', 'December 25'], correctIndex: 1, explanation: 'Enkutatash, the Ethiopian New Year, falls on September 11 (or 12 in leap years).' }), category: 'culture', difficulty: 'hard' },
    { title: 'Doro Wot', content: JSON.stringify({ question: 'What is the key ingredient in Doro Wot?', options: ['Beef', 'Chicken', 'Fish', 'Lamb'], correctIndex: 1, explanation: 'Doro Wot is a spicy chicken stew, considered the national dish of Ethiopia.' }), category: 'food', difficulty: 'easy' },
    { title: 'Ethiopian Alphabet', content: JSON.stringify({ question: 'How many letters are in the Amharic alphabet (fidel)?', options: ['26', '200+', '50', '100'], correctIndex: 1, explanation: 'The Amharic fidel has over 200 characters, each representing a consonant-vowel combination.' }), category: 'culture', difficulty: 'hard' },
    { title: 'Tej Drink', content: JSON.stringify({ question: 'What is Tej made from?', options: ['Barley', 'Honey', 'Grapes', 'Sorghum'], correctIndex: 1, explanation: 'Tej is a traditional Ethiopian honey wine (mead) made from honey, water, and gesho leaves.' }), category: 'food', difficulty: 'medium' },
    { title: 'Lalibela Churches', content: JSON.stringify({ question: 'How many rock-hewn churches are in Lalibela?', options: ['7', '11', '13', '21'], correctIndex: 2, explanation: 'There are 13 rock-hewn churches in Lalibela, carved from solid rock in the 12th century.' }), category: 'history', difficulty: 'hard' },
    { title: 'Meskel Celebration', content: JSON.stringify({ question: 'What does Meskel celebrate?', options: ['New Year', 'Finding of the True Cross', 'Harvest', 'Coffee discovery'], correctIndex: 1, explanation: 'Meskel celebrates the finding of the True Cross by Empress Helena in the 4th century.' }), category: 'culture', difficulty: 'medium' },
  ];

  for (const t of trivia) {
    await prisma.entertainmentContent.upsert({
      where: { id: `ent-trivia-${t.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}` },
      update: {},
      create: { id: `ent-trivia-${t.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, type: 'trivia_question', ...t, isActive: true, sortOrder: 0 },
    });
  }
  console.log(`  ✅ ${trivia.length} trivia questions seeded`);

  // ── Facts ──
  const facts = [
    { title: 'Coffee Discovery', content: 'Coffee was discovered in Ethiopia around 850 AD by a goat herder named Kaldi, who noticed his goats became energetic after eating coffee berries.' },
    { title: '13 Months of Sunshine', content: 'Ethiopia has 13 months in its calendar — 12 months of 30 days each, plus a 13th month called Pagume with 5 or 6 days. This is why Ethiopia promotes "13 Months of Sunshine."' },
    { title: 'Injera Nutrition', content: 'Teff, the grain used to make injera, is naturally gluten-free and rich in iron, calcium, and resistant starch — making injera one of the most nutritious breads in the world.' },
    { title: 'Ethiopian Time', content: 'Ethiopia uses a 12-hour clock system that starts at 6:00 AM. So when it\'s 7:00 AM in Ethiopia, it\'s 1:00 in Ethiopian time. Day starts at sunrise.' },
    { title: 'Unique Script', content: 'Ethiopia is the only African country with its own indigenous alphabet (Ge\'ez/Amharic script), which has been in continuous use for over 2,000 years.' },
    { title: 'Berbere Spice Blend', content: 'Berbere contains up to 15 different spices including chili, fenugreek, ginger, cardamom, coriander, and allspice. Each family\'s recipe is unique and often a closely guarded secret.' },
    { title: 'Coffee Ceremony', content: 'The Ethiopian coffee ceremony can take up to 3 hours. It involves roasting green beans, grinding them, and brewing in a clay pot called a jebena. It\'s a symbol of hospitality and community.' },
    { title: 'Ensete Plant', content: 'The ensete plant (false banana) is a drought-resistant crop that feeds over 20 million Ethiopians. It can be stored underground for years, making it a crucial food security crop.' },
  ];

  for (const f of facts) {
    await prisma.entertainmentContent.upsert({
      where: { id: `ent-fact-${f.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}` },
      update: {},
      create: { id: `ent-fact-${f.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, type: 'fact', title: f.title, content: f.content, category: 'ethiopian', isActive: true, sortOrder: 0 },
    });
  }
  console.log(`  ✅ ${facts.length} facts seeded`);

  // ── Stories ──
  const stories = [
    { title: 'Kaldi and the Dancing Goats', content: 'Long ago in the highlands of Kaffa, a goat herder named Kaldi noticed his goats dancing with unusual energy after eating red berries from a mysterious plant. Curious, Kaldi tried the berries himself and felt invigorated. He brought them to a local monk, who initially dismissed them as temptation and threw them into the fire. The aroma of roasting beans was so captivating that they raked them from the fire, crushed them, and dissolved them in hot water — creating the world\'s first cup of coffee. From that day, coffee spread across the world, but its heart remains in Ethiopia.' },
    { title: 'The Queen of Sheba', content: 'The Queen of Sheba (Makeda in Ethiopian tradition) ruled the ancient kingdom of Saba. According to the Kebra Nagast, Ethiopia\'s national epic, she traveled to Jerusalem to visit King Solomon, drawn by his wisdom. Their meeting resulted in the birth of Menelik I, who founded the Solomonic Dynasty of Ethiopia — a dynasty that would rule for nearly 3,000 years until 1974. The dynasty\'s claim to the biblical Ark of the Covenant, reportedly brought to Ethiopia by Menelik, remains one of history\'s greatest mysteries.' },
    { title: 'The Origin of Meskel', content: 'In the 4th century, Empress Helena, mother of Emperor Constantine, traveled to Jerusalem searching for the cross on which Jesus was crucified. After much prayer and searching, smoke from a bonfire rose toward the sky, pointing to the burial site. Three crosses were found. To identify the True Cross, a sick woman was touched by each — and healed only by the third. This discovery is celebrated every September 27 as Meskel, one of Ethiopia\'s most colorful festivals, marked by the lighting of a massive bonfire called the Demera.' },
  ];

  for (const s of stories) {
    await prisma.entertainmentContent.upsert({
      where: { id: `ent-story-${s.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}` },
      update: {},
      create: { id: `ent-story-${s.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, type: 'story', title: s.title, content: s.content, category: 'ethiopian', isActive: true, sortOrder: 0 },
    });
  }
  console.log(`  ✅ ${stories.length} stories seeded`);

  // ── Reads ──
  const reads = [
    { title: 'The Art of the Coffee Ceremony', content: 'The Ethiopian coffee ceremony is more than a beverage preparation — it is a sacred ritual of community and hospitality. The ceremony begins with the hostess spreading fresh grass and flowers on the floor, evoking the highland meadows where coffee was born. Green beans are washed and roasted in a flat pan over charcoal, filling the room with an aroma that signals to neighbors: come, there is coffee. The roasted beans are ground by hand in a wooden mortar and brewed in a clay jebena. The coffee is served in three rounds — Abol (first), Kalei (second), and Bereka (third) — each with its own significance. The ceremony can take hours, and leaving before the third round is considered impolite. In a world of instant coffee and drive-throughs, this tradition reminds us that some things are worth waiting for.' },
    { title: 'Berbere: More Than a Spice', content: 'Berbere is not just a spice blend — it is the soul of Ethiopian cooking. The word itself comes from the Amharic "barebare," meaning "to burn" or "to flame," reflecting its deep red color and warming heat. Every Ethiopian family has their own berbere recipe, passed down through generations. Some use 15 spices, others 20. The process of making berbere can take days: chilies are sun-dried, then ground; spices are separately roasted and ground; everything is blended by hand. The result is a complex flavor profile — initially sweet and warm, then building to a deep, satisfying heat. Berbere is the backbone of wot (stew), the national dish. Without berbere, there is no Ethiopian cuisine.' },
  ];

  for (const r of reads) {
    await prisma.entertainmentContent.upsert({
      where: { id: `ent-read-${r.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}` },
      update: {},
      create: { id: `ent-read-${r.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, type: 'read', title: r.title, content: r.content, category: 'ethiopian', isActive: true, sortOrder: 0 },
    });
  }
  console.log(`  ✅ ${reads.length} reads seeded`);

  // ── Game Configs ──
  const gameConfigs = [
    { title: 'Word Scramble', content: JSON.stringify({ enabled: true, difficulty: 'medium', timeLimit: 60, words: ['injera', 'berbere', 'doro', 'wot', 'tej', 'kolo', 'kitfo', 'shiro', 'tibs', 'gored'] }), category: 'food' },
    { title: 'Emoji Food Quiz', content: JSON.stringify({ enabled: true, difficulty: 'easy', timeLimit: 30, questions: [{ emojis: '☕🔥🐐', answer: 'Kaldi Coffee Discovery', hint: 'Goats dancing' }, { emojis: '🌾圆形扁平面包', answer: 'Injera', hint: 'Spongy flatbread' }, { emojis: '🍯🍷', answer: 'Tej', hint: 'Honey wine' }, { emojis: '🌶️🔥🍗', answer: 'Doro Wot', hint: 'Spicy chicken stew' }] }), category: 'food' },
  ];

  for (const g of gameConfigs) {
    await prisma.entertainmentContent.upsert({
      where: { id: `ent-game-${g.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}` },
      update: {},
      create: { id: `ent-game-${g.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, type: 'game_config', title: g.title, content: g.content, category: g.category, isActive: true, sortOrder: 0 },
    });
  }
  console.log(`  ✅ ${gameConfigs.length} game configs seeded`);

  console.log('\n🎉 Entertainment content seeded successfully!');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
