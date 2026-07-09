// Create a test platform fee ledger entry for Habesha restaurant
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // Look up a real branch and table for Habesha
  const branch = await prisma.branch.findFirst({ where: { restaurantId: 'rest-habesha' } });
  const table = await prisma.table.findFirst({ where: { branchId: branch.id } });
  console.log('Using branch:', branch.id, 'table:', table?.id);

  // Create a test order
  const order = await prisma.order.create({
    data: {
      restaurantId: 'rest-habesha',
      branchId: branch.id,
      tableId: table?.id || null,
      orderNumber: 'TEST-' + Date.now(),
      status: 'completed',
      totalAmountCents: 10000,
      completedAt: new Date(),
    },
  });
  console.log('Created test order:', order.id);

  // Create a test payment
  const payment = await prisma.payment.create({
    data: {
      id: 'test-payment-' + Date.now(),
      restaurantId: 'rest-habesha',
      orderId: order.id,
      branchId: branch.id,
      method: 'cash',
      provider: 'manual',
      amountCents: 10000, // 100 ETB
      status: 'completed',
      paidAt: new Date(),
    },
  });
  console.log('Created test payment:', payment.id);

  // Create a platform fee ledger entry at 1% (Premium plan rate)
  const ledger = await prisma.platformFeeLedger.create({
    data: {
      restaurantId: 'rest-habesha',
      paymentId: payment.id,
      orderId: payment.orderId,
      branchId: payment.branchId,
      transactionAmountCents: 10000,
      feeRate: 0.01, // 1% (Premium plan)
      feeAmountCents: 100, // 1 ETB
      status: 'unbilled',
    },
  });
  console.log('Created test ledger entry:', ledger.id);
  console.log('Fee amount:', ledger.feeAmountCents, 'cents =', ledger.feeAmountCents / 100, 'ETB');

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
