// Comprehensive promotion + restaurant inspection
const { PrismaClient } = require('@prisma/client');

// Try multiple DB paths
const candidates = [
  'file:/tmp/my-project/db/custom.db',
  'file:/home/z/my-project/db/custom.db',
  'file:/home/z/my-project/YeneQR/db/dev.db',
];

(async () => {
  for (const url of candidates) {
    console.log(`\n========== Trying DATABASE_URL=${url} ==========`);
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const restaurantCount = await prisma.restaurant.count();
      console.log(`Restaurants: ${restaurantCount}`);
      if (restaurantCount === 0) continue;

      const restaurants = await prisma.restaurant.findMany({
        select: { id: true, name: true, slug: true, isActive: true, isSuspended: true },
        take: 20,
      });
      console.log('Restaurants:', JSON.stringify(restaurants, null, 2));

      const promoCount = await prisma.promotion.count();
      console.log(`Promotions: ${promoCount}`);

      if (promoCount > 0) {
        const promos = await prisma.promotion.findMany({
          include: { restaurant: { select: { name: true, slug: true } } },
          orderBy: { createdAt: 'desc' },
          take: 30,
        });
        const now = new Date();
        for (const p of promos) {
          const from = new Date(p.validFrom);
          const until = new Date(p.validUntil);
          const inWindow = from <= now && until >= now;
          console.log({
            id: p.id,
            restaurant: p.restaurant?.name,
            name: p.name,
            type: p.type,
            isActive: p.isActive,
            discountType: p.discountType,
            discountValueCents: p.discountValueCents,
            validFrom: p.validFrom?.toISOString(),
            validUntil: p.validUntil?.toISOString(),
            inWindow,
            schedule: p.schedule,
            applicableItems: p.applicableItems,
          });
        }
      }
      await prisma.$disconnect();
      return;
    } catch (e) {
      console.error('Error:', e.message);
      await prisma.$disconnect();
    }
  }
})();
