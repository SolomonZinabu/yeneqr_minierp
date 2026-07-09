// Comprehensive menu/category inspection
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });

(async () => {
  // List all restaurants
  const restaurants = await prisma.restaurant.findMany({
    select: { id: true, name: true, slug: true },
    take: 30,
  });
  console.log(`\n=== Restaurants (${restaurants.length}) ===`);
  for (const r of restaurants.slice(0, 5)) {
    console.log(`  ${r.id}  ${r.name}`);
  }

  // List all menus
  const menus = await prisma.menu.findMany({
    include: { _count: { select: { categories: true } }, restaurant: { select: { name: true } } },
    take: 30,
    orderBy: { createdAt: 'asc' },
  });
  console.log(`\n=== Menus (${menus.length}) ===`);
  for (const m of menus) {
    console.log(`  ${m.id}  "${m.name}"  restaurant=${m.restaurant?.name}  isActive=${m.isActive}  cats=${m._count.categories}`);
  }

  // List all categories
  const categories = await prisma.menuCategory.findMany({
    include: {
      menu: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  console.log(`\n=== Categories (${categories.length}) ===`);
  for (const c of categories) {
    console.log({
      id: c.id,
      name: c.name,
      icon: c.icon,
      isActive: c.isActive,
      sortOrder: c.sortOrder,
      menuName: c.menu?.name,
      itemCount: c._count.items,
      createdAt: c.createdAt?.toISOString(),
    });
  }

  // Group categories by menu and report any with 0 categories
  const menusWithCats = new Set(categories.map(c => c.menuId));
  const menusWithoutCats = menus.filter(m => !menusWithCats.has(m.id));
  console.log(`\n=== Menus without any categories: ${menusWithoutCats.length} ===`);
  for (const m of menusWithoutCats) {
    console.log(`  ${m.id}  "${m.name}"  (${m.restaurant?.name})`);
  }

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
