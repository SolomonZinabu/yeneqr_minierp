// Check the DB file and list categories sorted by creation time
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });
const fs = require('fs');

(async () => {
  // DB file mtime
  try {
    const stat = fs.statSync('/home/z/my-project/db/custom.db');
    console.log(`DB file mtime: ${stat.mtime.toISOString()}`);
    console.log(`DB file size: ${stat.size} bytes`);
  } catch (e) {
    console.log('Could not stat DB file:', e.message);
  }

  // Group categories by createdAt hour
  const all = await prisma.menuCategory.findMany({
    select: { id: true, name: true, createdAt: true, menuId: true, isActive: true, icon: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`\nTotal categories: ${all.length}`);
  const byHour = {};
  for (const c of all) {
    const hour = c.createdAt.toISOString().slice(0, 13);
    byHour[hour] = (byHour[hour] || 0) + 1;
  }
  console.log('Categories per hour:');
  for (const [hour, count] of Object.entries(byHour).sort()) {
    console.log(`  ${hour}: ${count}`);
  }

  // Last 5 added
  console.log(`\nLast 5 categories added:`);
  for (const c of all.slice(-5)) {
    console.log(`  ${c.createdAt.toISOString()}  menuId=${c.menuId}  name="${c.name}"  icon="${c.icon}"  isActive=${c.isActive}`);
  }
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
