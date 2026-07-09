// Check for user-added categories (recent)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });

(async () => {
  // Most recently created categories
  const recent = await prisma.menuCategory.findMany({
    include: {
      menu: { select: { name: true, id: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  console.log(`\n=== 20 Most Recently Created Categories ===`);
  for (const c of recent) {
    console.log({
      id: c.id,
      name: c.name,
      icon: c.icon,
      isActive: c.isActive,
      sortOrder: c.sortOrder,
      menuId: c.menuId,
      menuName: c.menu?.name,
      itemCount: c._count.items,
      createdAt: c.createdAt?.toISOString(),
    });
  }

  // Check menuId on the category — does the menu exist?
  // Also: the guest side picks mainMenu.id based on QR code menuId or first active menu
  // Print the menus per restaurant with their first-active flag
  const menus = await prisma.menu.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, restaurantId: true, isActive: true, createdAt: true },
  });
  console.log(`\n=== Active Menus (in creation order — first per restaurant is the default) ===`);
  const seenRestaurants = new Set();
  for (const m of menus) {
    const isDefault = !seenRestaurants.has(m.restaurantId);
    seenRestaurants.add(m.restaurantId);
    console.log(`  ${isDefault ? '[DEFAULT]' : '         '}  rest=${m.restaurantId}  menu=${m.id}  name="${m.name}"  created=${m.createdAt?.toISOString()}`);
  }

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
