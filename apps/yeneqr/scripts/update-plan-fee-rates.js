// One-off script to update existing plans with feeRatePercent
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const updates = [
    { id: 'plan-basic', feeRatePercent: 3.0 },
    { id: 'plan-pro', feeRatePercent: 2.0 },
    { id: 'plan-premium', feeRatePercent: 1.0 },
  ];
  for (const u of updates) {
    const updated = await prisma.subscriptionPlan.update({
      where: { id: u.id },
      data: { feeRatePercent: u.feeRatePercent },
    });
    console.log(`Updated ${u.id}: feeRatePercent=${updated.feeRatePercent}`);
  }
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
