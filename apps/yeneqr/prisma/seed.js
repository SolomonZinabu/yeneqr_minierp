// ============================================================
// Yene QR — Extensive Modular Seed Script
// Run with: node prisma/seed.js
// Reset with: npx prisma db push --force-reset && node prisma/seed.js
// ============================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

const restaurants = require('./seed-data/restaurants');
const cuisine = require('./seed-data/cuisine');

async function main() {
  console.log('🌱 Yene QR — Seeding database...\n');
  const password = await bcrypt.hash('admin123', 12);
  let totalCreated = { restaurants: 0, branches: 0, floors: 0, tables: 0, users: 0, menus: 0, categories: 0, menuItems: 0, kitchenStations: 0, reservations: 0, subscriptions: 0, plans: 0, featureFlags: 0, modifierGroups: 0, modifierOptions: 0, qrCodes: 0, languages: 0, restaurantLanguages: 0, aiConfigs: 0, supportAdmins: 0, supportTickets: 0, orders: 0, orderItems: 0, invoices: 0 };

  // ====================== PLATFORM LAYER ======================
  console.log('📦 Creating subscription plans...');
  const plans = [
    { id: 'plan-basic', name: 'Basic', slug: 'basic', description: 'Perfect for getting started with QR ordering. 3% per-transaction fee.', priceCents: 0, yearlyPriceCents: 0, feeRatePercent: 3.0, features: '{"qr_codes":true,"cash_payment":true,"basic_analytics":true,"single_branch":true}', limits: '{"maxBranches":1,"maxTables":20,"maxStaff":5,"maxMenuItems":50,"maxQRCodes":20}', isActive: true, sortOrder: 1 },
    { id: 'plan-pro', name: 'Pro', slug: 'pro', description: 'For growing restaurants. 2% per-transaction fee + monthly subscription.', priceCents: 200000, yearlyPriceCents: 2000000, feeRatePercent: 2.0, features: '{"qr_codes":true,"all_payments":true,"advanced_analytics":true,"kitchen_display":true,"loyalty":true,"custom_branding":true,"multi_branch":true}', limits: '{"maxBranches":3,"maxTables":100,"maxStaff":20,"maxMenuItems":500,"maxQRCodes":100}', isActive: true, sortOrder: 2 },
    { id: 'plan-premium', name: 'Premium', slug: 'premium', description: 'For restaurant chains and enterprise. 1% per-transaction fee + monthly subscription.', priceCents: 500000, yearlyPriceCents: 5000000, feeRatePercent: 1.0, features: '{"qr_codes":true,"all_payments":true,"advanced_analytics":true,"kitchen_display":true,"loyalty":true,"custom_branding":true,"unlimited_branches":true,"api_access":true,"white_label":true,"priority_support":true}', limits: '{"maxBranches":-1,"maxTables":-1,"maxStaff":-1,"maxMenuItems":-1,"maxQRCodes":-1}', isActive: true, sortOrder: 3 },
    { id: 'plan-configurable', name: 'Configurable', slug: 'configurable', description: 'Custom-negotiated subscription. Fee rate and price are set per-restaurant by the YeneQR team. Use for enterprise deals, chains, and special partnerships.', priceCents: 0, yearlyPriceCents: 0, feeRatePercent: 0, features: '{"qr_codes":true,"all_payments":true,"advanced_analytics":true,"kitchen_display":true,"loyalty":true,"custom_branding":true,"unlimited_branches":true,"api_access":true,"white_label":true,"priority_support":true,"custom_deal":true}', limits: '{"maxBranches":-1,"maxTables":-1,"maxStaff":-1,"maxMenuItems":-1,"maxQRCodes":-1}', isActive: true, sortOrder: 4 },
  ];
  for (const p of plans) {
    await prisma.subscriptionPlan.upsert({ where: { id: p.id }, update: {}, create: p });
    totalCreated.plans++;
  }

  console.log('👑 Creating super admin...');
  await prisma.superAdmin.upsert({ where: { id: 'sa-1' }, update: {}, create: { id: 'sa-1', email: 'admin@yeneqr.com', name: 'Platform Admin', password, isActive: true } });

  console.log('🚩 Creating feature flags...');
  const flags = [
    { id: 'ff-1', key: 'loyalty_program', name: 'Loyalty Program', enabled: true, config: '{"plan":"pro"}' },
    { id: 'ff-2', key: 'api_access', name: 'API Access', enabled: false, config: '{"plan":"premium"}' },
    { id: 'ff-3', key: 'white_label', name: 'White Label', enabled: false, config: '{"plan":"premium"}' },
    { id: 'ff-4', key: 'multi_station_kds', name: 'Multi-Station KDS', enabled: true, config: '{"plan":"pro"}' },
    { id: 'ff-5', key: 'happy_hour', name: 'Happy Hour Promotions', enabled: true, config: '{"plan":"basic"}' },
    { id: 'ff-6', key: 'ai_enabled', name: 'AI Enabled', enabled: true, config: '{"plan":"basic"}' },
    { id: 'ff-7', key: 'ai_owner_enabled', name: 'Business AI', enabled: true, config: '{"plan":"pro"}' },
    { id: 'ff-8', key: 'ai_kitchen_enabled', name: 'Kitchen AI', enabled: true, config: '{"plan":"pro"}' },
    { id: 'ff-9', key: 'ai_waiter_enabled', name: 'Waiter AI', enabled: true, config: '{"plan":"pro"}' },
    { id: 'ff-10', key: 'ai_customer_enabled', name: 'Menu AI', enabled: true, config: '{"plan":"basic"}' },
  ];
  for (const f of flags) {
    await prisma.platformFeatureFlag.upsert({ where: { id: f.id }, update: {}, create: f });
    totalCreated.featureFlags++;
  }

  // ====================== LANGUAGES ======================
  console.log('🌐 Creating languages...');
  const languages = [
    { code: 'en', name: 'English', nameLocal: 'English', direction: 'ltr', flagEmoji: '🇬🇧', isActive: true, sortOrder: 1 },
    { code: 'am', name: 'Amharic', nameLocal: 'አማርኛ', direction: 'ltr', fontFamily: 'Noto Sans Ethiopic', flagEmoji: '🇪🇹', isActive: true, sortOrder: 2 },
    { code: 'om', name: 'Oromo', nameLocal: 'Afaan Oromoo', direction: 'ltr', fontFamily: 'Noto Sans Ethiopic', flagEmoji: '🇪🇹', isActive: true, sortOrder: 3 },
    { code: 'ti', name: 'Tigrinya', nameLocal: 'ትግርኛ', direction: 'ltr', fontFamily: 'Noto Sans Ethiopic', flagEmoji: '🇪🇷', isActive: true, sortOrder: 4 },
    { code: 'so', name: 'Somali', nameLocal: 'Soomaali', direction: 'ltr', flagEmoji: '🇸🇴', isActive: true, sortOrder: 5 },
    { code: 'aa', name: 'Afar', nameLocal: 'Afaraf', direction: 'ltr', flagEmoji: '🇪🇹', isActive: true, sortOrder: 6 },
    { code: 'sid', name: 'Sidamo', nameLocal: 'Sidaamu Afo', direction: 'ltr', flagEmoji: '🇪🇹', isActive: true, sortOrder: 7 },
    { code: 'ar', name: 'Arabic', nameLocal: 'العربية', direction: 'rtl', fontFamily: 'Noto Naskh Arabic', flagEmoji: '🇸🇦', isActive: true, sortOrder: 8 },
    { code: 'it', name: 'Italian', nameLocal: 'Italiano', direction: 'ltr', flagEmoji: '🇮🇹', isActive: true, sortOrder: 9 },
    { code: 'zh', name: 'Chinese', nameLocal: '中文', direction: 'ltr', fontFamily: 'Noto Sans SC', flagEmoji: '🇨🇳', isActive: true, sortOrder: 10 },
    { code: 'fr', name: 'French', nameLocal: 'Français', direction: 'ltr', flagEmoji: '🇫🇷', isActive: true, sortOrder: 11 },
    { code: 'es', name: 'Spanish', nameLocal: 'Español', direction: 'ltr', flagEmoji: '🇪🇸', isActive: true, sortOrder: 12 },
    { code: 'de', name: 'German', nameLocal: 'Deutsch', direction: 'ltr', flagEmoji: '🇩🇪', isActive: true, sortOrder: 13 },
  ];
  for (const lang of languages) {
    await prisma.language.upsert({ where: { code: lang.code }, update: {}, create: lang });
    totalCreated.languages++;
  }

  // ====================== SUPPORT ADMIN ======================
  console.log('🎧 Creating support admin...');
  await prisma.supportAdmin.upsert({
    where: { id: 'sup-admin-1' },
    update: {},
    create: { id: 'sup-admin-1', email: 'support@yeneqr.com', name: 'Support Admin', password, isActive: true },
  });
  totalCreated.supportAdmins++;

  // ====================== RESTAURANTS ======================
  console.log(`\n🍽️  Creating ${restaurants.length} restaurants...`);

  for (const rest of restaurants) {
    // Create restaurant
    // Set feeRate based on plan (decoupled — fee rate is per-restaurant, not per-plan)
    const planToFeeRate = { 'plan-basic': 0.03, 'plan-pro': 0.02, 'plan-premium': 0.01, 'plan-configurable': 0.015 };
    await prisma.restaurant.upsert({
      where: { id: rest.id },
      update: {},
      create: {
        id: rest.id,
        slug: rest.slug,
        name: rest.name,
        nameAm: rest.nameAm,
        description: rest.description,
        descriptionAm: rest.descriptionAm,
        cuisineType: rest.cuisineType,
        phone: rest.phone,
        email: rest.email,
        address: rest.address,
        city: rest.city,
        taxRate: rest.taxRate,
        serviceCharge: rest.serviceCharge,
        workingHours: rest.workingHours || null,
        currency: 'ETB',
        defaultLanguage: 'en',
        isActive: true,
        isVerified: true,
        feeRate: planToFeeRate[rest.plan] ?? 0.03,
      },
    });
    totalCreated.restaurants++;

    // Create restaurant languages (English + Amharic for all, extras for some)
    const restLangs = [
      { id: `rl-${rest.id}-en`, restaurantId: rest.id, languageCode: 'en', isDefault: true, isActive: true, sortOrder: 1 },
      { id: `rl-${rest.id}-am`, restaurantId: rest.id, languageCode: 'am', isDefault: false, isActive: true, isRequired: true, sortOrder: 2 },
    ];
    for (const rl of restLangs) {
      await prisma.restaurantLanguage.upsert({ where: { id: rl.id }, update: {}, create: rl });
      totalCreated.restaurantLanguages++;
    }

    // Create subscription
    await prisma.subscription.upsert({
      where: { id: `sub-${rest.id}` },
      update: {},
      create: {
        id: `sub-${rest.id}`,
        restaurantId: rest.id,
        planId: rest.plan || 'plan-basic',
        status: 'trial',
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-07-01'),
        trialEndsAt: new Date('2026-02-01'),
      },
    });
    totalCreated.subscriptions++;

    // Create sample invoices (so the Invoices UI isn't empty on first run)
    // Only create if no invoices exist yet for this subscription.
    const existingInvoiceCount = await prisma.invoice.count({ where: { subscriptionId: `sub-${rest.id}` } });
    if (existingInvoiceCount === 0 && rest.plan && rest.plan !== 'plan-basic') {
      const planData = plans.find(p => p.id === rest.plan);
      if (planData && planData.priceCents > 0) {
        const now = new Date();
        const sampleInvoices = [
          // Paid — 2 months ago
          {
            id: `inv-${rest.id}-1`,
            subscriptionId: `sub-${rest.id}`,
            amountCents: planData.priceCents,
            taxCents: Math.round(planData.priceCents * 0.15),
            totalCents: planData.priceCents + Math.round(planData.priceCents * 0.15),
            status: 'paid',
            dueDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
            paidAt: new Date(now.getTime() - 55 * 24 * 60 * 60 * 1000),
            invoiceNumber: `INV-${rest.id.toUpperCase()}-1`,
            createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          },
          // Paid — 1 month ago
          {
            id: `inv-${rest.id}-2`,
            subscriptionId: `sub-${rest.id}`,
            amountCents: planData.priceCents,
            taxCents: Math.round(planData.priceCents * 0.15),
            totalCents: planData.priceCents + Math.round(planData.priceCents * 0.15),
            status: 'paid',
            dueDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
            paidAt: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
            invoiceNumber: `INV-${rest.id.toUpperCase()}-2`,
            createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          },
          // Pending — current period
          {
            id: `inv-${rest.id}-3`,
            subscriptionId: `sub-${rest.id}`,
            amountCents: planData.priceCents,
            taxCents: Math.round(planData.priceCents * 0.15),
            totalCents: planData.priceCents + Math.round(planData.priceCents * 0.15),
            status: 'pending',
            dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            paidAt: null,
            invoiceNumber: `INV-${rest.id.toUpperCase()}-3`,
            createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          },
        ];
        for (const inv of sampleInvoices) {
          await prisma.invoice.upsert({ where: { id: inv.id }, update: {}, create: inv });
          totalCreated.invoices++;
        }
      }
    }

    // Create staff users
    for (const s of rest.staff) {
      const userId = `user-${rest.id}-${s.role}`;
      await prisma.restaurantUser.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          restaurantId: rest.id,
          email: s.email,
          name: s.name,
          password,
          phone: s.phone,
          role: s.role,
          isActive: true,
        },
      });
      totalCreated.users++;
    }

    // Create branches, floors, tables, kitchen stations
    for (const branch of rest.branches) {
      await prisma.branch.upsert({
        where: { id: branch.id },
        update: {},
        create: {
          id: branch.id,
          restaurantId: rest.id,
          name: branch.name,
          nameAm: branch.nameAm,
          address: branch.address,
          city: branch.city,
          phone: branch.phone,
          isActive: true,
          isMainBranch: branch.isMainBranch,
        },
      });
      totalCreated.branches++;

      // Create floors
      for (const floor of branch.floors) {
        const floorId = `floor-${branch.id}-${floor.sortOrder}`;
        await prisma.floor.upsert({
          where: { id: floorId },
          update: {},
          create: {
            id: floorId,
            branchId: branch.id,
            name: floor.name,
            sortOrder: floor.sortOrder,
            width: floor.width,
            height: floor.height,
            walls: floor.walls ? JSON.stringify(floor.walls) : null,
            obstacles: floor.obstacles ? JSON.stringify(floor.obstacles) : null,
          },
        });
        totalCreated.floors++;

        // Create tables on this floor
        for (let ti = 0; ti < floor.tables.length; ti++) {
          const t = floor.tables[ti];
          const tableId = `tbl-${branch.id}-${floor.sortOrder}-${ti + 1}`;
          const defaultSizes = { round: { w: 70, h: 70 }, square: { w: 80, h: 80 }, rectangle: { w: 120, h: 80 }, oval: { w: 110, h: 75 } };
          const size = defaultSizes[t.shape] || defaultSizes.square;
          await prisma.table.upsert({
            where: { id: tableId },
            update: {},
            create: {
              id: tableId,
              branchId: branch.id,
              floorId: floorId,
              number: t.number,
              capacity: t.capacity,
              status: t.status || 'available',
              positionX: t.positionX || null,
              positionY: t.positionY || null,
              width: t.width || size.w,
              height: t.height || size.h,
              rotation: t.rotation || 0,
              shape: t.shape,
              notes: t.notes || null,
              isActive: true,
            },
          });
          totalCreated.tables++;
        }
      }

      // Create kitchen stations
      for (const station of branch.kitchenStations) {
        const stationId = `ks-${branch.id}-${station.sortOrder}`;
        await prisma.kitchenStation.upsert({
          where: { id: stationId },
          update: {},
          create: {
            id: stationId,
            branchId: branch.id,
            name: station.name,
            type: station.type,
            sortOrder: station.sortOrder,
            isActive: true,
          },
        });
        totalCreated.kitchenStations++;
      }
    }

    // Create menu and categories for this restaurant
    const menuId = `menu-${rest.id}-main`;
    await prisma.menu.upsert({
      where: { id: menuId },
      update: {},
      create: {
        id: menuId,
        restaurantId: rest.id,
        name: 'Main Menu',
        nameAm: 'ዋና ምናሌ',
        isActive: true,
        sortOrder: 1,
      },
    });
    totalCreated.menus++;

    // Create categories for this restaurant
    for (const cat of cuisine.categories) {
      const catId = `cat-${rest.id}-${cat.id}`;
      await prisma.menuCategory.upsert({
        where: { id: catId },
        update: {},
        create: {
          id: catId,
          menuId: menuId,
          restaurantId: rest.id,
          name: cat.name,
          nameAm: cat.nameAm,
          icon: cat.icon,
          isActive: true,
          sortOrder: cat.sortOrder,
        },
      });
      totalCreated.categories++;
    }

    // Create menu items for this restaurant (filter by restaurants field)
    let itemSortOrder = 0;
    for (const item of cuisine.menuItems) {
      // Check if this item is available at this restaurant
      const isAvailable = item.restaurants === '*' || item.restaurants.includes(rest.id);
      if (!isAvailable) continue;

      // Find matching category
      const catId = `cat-${rest.id}-${item.catId}`;
      const itemId = `item-${rest.id}-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`;

      await prisma.menuItem.upsert({
        where: { id: itemId },
        update: {},
        create: {
          id: itemId,
          categoryId: catId,
          restaurantId: rest.id,
          name: item.name,
          nameAm: item.nameAm,
          description: item.desc,
          priceCents: item.price * 100,
          preparationTime: item.prepTime,
          isAvailable: true,
          isPopular: item.isPopular,
          isVegetarian: item.isVegetarian,
          isSpicy: item.isSpicy,
          availabilityType: 'always',
          sortOrder: itemSortOrder++,
        },
      });
      totalCreated.menuItems++;

      // Add modifier groups for popular items
      if (item.isPopular && (item.catId === 'cat-wot' || item.catId === 'cat-tibs' || item.catId === 'cat-kitfo')) {
        // Spice Level modifier
        const spiceGroupId = `mod-spice-${rest.id}-${itemId}`;
        await prisma.modifierGroup.upsert({
          where: { id: spiceGroupId },
          update: {},
          create: {
            id: spiceGroupId,
            menuItemId: itemId,
            name: 'Spice Level',
            nameAm: 'ቅመማ መጠን',
            isRequired: true,
            selectionType: 'single',
            minSelection: 1,
            maxSelection: 1,
            sortOrder: 1,
          },
        });
        totalCreated.modifierGroups++;

        const spiceOpts = [
          { name: 'Mild', nameAm: 'ቀለል', delta: 0, isDefault: false },
          { name: 'Medium', nameAm: 'መካከለኛ', delta: 0, isDefault: true },
          { name: 'Hot', nameAm: 'መᠠጨት', delta: 0, isDefault: false },
        ];
        for (let si = 0; si < spiceOpts.length; si++) {
          const opt = spiceOpts[si];
          await prisma.modifierOption.upsert({
            where: { id: `opt-${spiceGroupId}-${si}` },
            update: {},
            create: {
              id: `opt-${spiceGroupId}-${si}`,
              modifierGroupId: spiceGroupId,
              name: opt.name,
              nameAm: opt.nameAm,
              priceDeltaCents: opt.delta * 100,
              isDefault: opt.isDefault,
              isActive: true,
              sortOrder: si + 1,
            },
          });
          totalCreated.modifierOptions++;
        }

        // Serving Size modifier — only for drinks/beverages (Ethiopian stews don't have sizes)
        if (item.catId === 'cat-drinks' || item.catId === 'cat-beverages' || item.catId === 'cat-coffee') {
          const sizeGroupId = `mod-size-${rest.id}-${itemId}`;
          await prisma.modifierGroup.upsert({
            where: { id: sizeGroupId },
            update: {},
            create: {
              id: sizeGroupId,
              menuItemId: itemId,
              name: 'Serving Size',
              nameAm: 'መጠን',
              isRequired: false,
              selectionType: 'single',
              minSelection: 1,
              maxSelection: 1,
              sortOrder: 2,
            },
          });
          totalCreated.modifierGroups++;

          const sizeOpts = [
            { name: 'Small', nameAm: 'ትንሽ', delta: -20, isDefault: false },
            { name: 'Regular', nameAm: 'መደበኛ', delta: 0, isDefault: true },
            { name: 'Large', nameAm: 'ትልቅ', delta: 30, isDefault: false },
          ];
          for (let si = 0; si < sizeOpts.length; si++) {
            const opt = sizeOpts[si];
            await prisma.modifierOption.upsert({
              where: { id: `opt-${sizeGroupId}-${si}` },
              update: {},
              create: {
                id: `opt-${sizeGroupId}-${si}`,
                modifierGroupId: sizeGroupId,
                name: opt.name,
                nameAm: opt.nameAm,
                priceDeltaCents: opt.delta * 100,
                isDefault: opt.isDefault,
                isActive: true,
                sortOrder: si + 1,
              },
            });
            totalCreated.modifierOptions++;
          }
        }
      }
    }

    console.log(`  ✅ ${rest.name} — ${rest.branches.length} branch(es), menu items created`);
  }

  // ====================== RESERVATIONS ======================
  console.log('\n📅 Creating reservations...');
  const reservationNames = [
    { name: 'Sara Tadesse', phone: '+251912345001' },
    { name: 'Dawit Haile', phone: '+251912345002' },
    { name: 'Marta Girma', phone: '+251912345003' },
    { name: 'Yohannes Abebe', phone: '+251912345004' },
    { name: 'Liya Bekele', phone: '+251912345005' },
    { name: 'Solomon Zinabu', phone: '+251912345006' },
    { name: 'Helen Kasahun', phone: '+251912345007' },
    { name: 'Abel Meshesha', phone: '+251912345008' },
    { name: 'Tigist Mekonnen', phone: '+251912345009' },
    { name: 'Natnael Fikru', phone: '+251912345010' },
    { name: 'Bethlehem Ayele', phone: '+251912345011' },
    { name: 'Samuel Desta', phone: '+251912345012' },
    { name: 'Meron Teshome', phone: '+251912345013' },
    { name: 'Bereket Hailu', phone: '+251912345014' },
    { name: 'Enat Belete', phone: '+251912345015' },
  ];
  const statuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
  const times = ['12:00', '12:30', '13:00', '18:00', '18:30', '19:00', '19:30', '20:00'];
  const specialRequests = [
    'Window seat preferred', 'Birthday celebration', 'Allergy to peanuts',
    'Business dinner — quiet table', 'High chair needed', 'Anniversary dinner',
    'Vegan options required', 'Near the stage', null, null, null,
  ];

  let resvCount = 0;
  for (const rest of restaurants) {
    for (const branch of rest.branches) {
      // Get tables for this branch
      const branchTables = await prisma.table.findMany({ where: { branchId: branch.id }, take: 10 });
      // Create 3-5 reservations per branch
      const numResv = 3 + Math.floor(Math.random() * 3);
      for (let r = 0; r < numResv; r++) {
        const person = reservationNames[resvCount % reservationNames.length];
        const table = branchTables[r % branchTables.length] || null;
        const date = new Date('2026-05-30');
        date.setDate(date.getDate() + (r % 3));
        await prisma.tableReservation.create({
          data: {
            restaurantId: rest.id,
            branchId: branch.id,
            tableId: table?.id || null,
            customerName: person.name,
            customerPhone: person.phone,
            customerEmail: r % 3 === 0 ? `${person.name.split(' ')[0].toLowerCase()}@example.com` : null,
            partySize: 2 + Math.floor(Math.random() * 8),
            reservedDate: date,
            reservedTime: times[r % times.length],
            duration: 90 + Math.floor(Math.random() * 90),
            status: statuses[r % statuses.length],
            specialRequests: specialRequests[r % specialRequests.length],
          },
        });
        resvCount++;
        totalCreated.reservations++;
      }
    }
  }

  // ====================== QR CODES ======================
  console.log('\n📲 Generating QR codes for all tables...');
  const crypto = require('crypto');
  const QR_SECRET = process.env.QR_SECRET || 'yene-qr-hmac-secret-change-in-production';

  function signQRPayload(payload) {
    const data = `${payload.rid}:${payload.bid}:${payload.tid}:${payload.type}:${payload.iat}:${payload.exp || 'none'}`;
    return crypto.createHmac('sha256', QR_SECRET).update(data).digest('hex');
  }

  for (const rest of restaurants) {
    for (const branch of rest.branches) {
      const branchTables = await prisma.table.findMany({ where: { branchId: branch.id } });
      for (const table of branchTables) {
        const iat = Math.floor(Date.now() / 1000);
        const payload = { rid: rest.id, bid: branch.id, tid: table.id, type: 'static', iat, exp: null };
        const signature = signQRPayload(payload);
        const qrId = `qr-${table.id}`;

        await prisma.qRCode.upsert({
          where: { id: qrId },
          update: {},
          create: {
            id: qrId,
            tableId: table.id,
            restaurantId: rest.id,
            branchId: branch.id,
            type: 'static',
            payload: JSON.stringify(payload),
            signature,
            isActive: true,
            scanCount: Math.floor(Math.random() * 50),
          },
        });
        totalCreated.qrCodes++;
      }
    }
  }

  // ====================== AI AGENT CONFIGS ======================
  console.log('\n🤖 Creating AI agent configs...');
  const agentTypes = ['owner', 'kitchen', 'waiter', 'customer'];
  for (const rest of restaurants) {
    for (const agentType of agentTypes) {
      const configId = `ai-${rest.id}-${agentType}`;
      await prisma.aIAgentConfig.upsert({
        where: { id: configId },
        update: {},
        create: {
          id: configId,
          restaurantId: rest.id,
          agentType,
          isEnabled: true,
          temperature: 0.7,
          maxToolIterations: 5,
          maxTokens: 2048,
          language: 'en',
        },
      });
      totalCreated.aiConfigs++;
    }
  }

  // ====================== SUPPORT TICKETS ======================
  console.log('🎫 Creating support tickets...');
  const ticketData = [
    { subject: 'Cannot generate QR codes', description: 'The QR code generation page shows a loading spinner but never completes. Happens on Chrome and Firefox.', priority: 'high', category: 'technical', status: 'open' },
    { subject: 'Payment integration question', description: 'We want to add Telebirr as a payment option. How do we configure it in the settings?', priority: 'medium', category: 'billing', status: 'in_progress' },
    { subject: 'Menu item not showing on customer view', description: 'Added new items to the menu but they are not visible when scanning the QR code. Other items work fine.', priority: 'high', category: 'technical', status: 'open' },
    { subject: 'Request for additional branch', description: 'We are opening a second location next month. Need to add it to our subscription.', priority: 'low', category: 'account', status: 'resolved' },
  ];
  for (let ti = 0; ti < ticketData.length; ti++) {
    const t = ticketData[ti];
    const restId = restaurants[ti % restaurants.length].id;
    await prisma.supportTicket.create({
      data: {
        subject: t.subject,
        description: t.description,
        priority: t.priority,
        category: t.category,
        status: t.status,
        restaurantId: restId,
        createdBy: 'sa-1',
        assignedTo: ti % 2 === 0 ? 'sup-admin-1' : null,
        resolution: t.status === 'resolved' ? 'Added branch to subscription. New branch is now active.' : null,
      },
    });
    totalCreated.supportTickets++;
  }

  // ====================== SAMPLE ORDERS ======================
  console.log('🧾 Creating sample orders...');
  const orderStatuses = ['pending', 'accepted', 'preparing', 'ready', 'served', 'completed'];
  let orderCount = 0;

  for (const rest of restaurants.slice(0, 3)) { // Create orders for first 3 restaurants
    const restMenuItems = await prisma.menuItem.findMany({ where: { restaurantId: rest.id }, take: 10 });
    const restBranches = await prisma.branch.findMany({ where: { restaurantId: rest.id } });
    if (restMenuItems.length === 0 || restBranches.length === 0) continue;
    const restTables = await prisma.table.findMany({ where: { branchId: restBranches[0].id }, take: 5 });

    // Create 5-8 orders per restaurant
    const numOrders = 5 + Math.floor(Math.random() * 4);
    for (let oi = 0; oi < numOrders; oi++) {
      const orderDate = new Date();
      orderDate.setHours(orderDate.getHours() - Math.floor(Math.random() * 72));
      const status = orderStatuses[oi % orderStatuses.length];
      const table = restTables[oi % restTables.length];
      const numItems = 2 + Math.floor(Math.random() * 4);
      const selectedItems = [...restMenuItems].sort(() => Math.random() - 0.5).slice(0, numItems);

      let totalCents = 0;
      const orderItems = selectedItems.map((item, idx) => {
        const qty = 1 + Math.floor(Math.random() * 3);
        const itemTotal = item.priceCents * qty;
        totalCents += itemTotal;
        return {
          restaurantId: rest.id,
          menuItemId: item.id,
          name: item.name,
          priceCents: item.priceCents,
          quantity: qty,
          kitchenStatus: status === 'cancelled' ? 'cancelled' : (status === 'completed' || status === 'served' ? 'ready' : 'pending'),
          roundNumber: 1,
        };
      });

      const orderId = `order-${rest.id}-${oi}`;
      const orderNum = String(1001 + orderCount);
      try {
        await prisma.order.create({
          data: {
            id: orderId,
            restaurantId: rest.id,
            branchId: restBranches[0].id,
            tableId: table?.id || null,
            orderNumber: orderNum,
            type: 'dine_in',
            status,
            subtotalCents: totalCents,
            taxAmountCents: Math.round(totalCents * 0.15),
            tipAmountCents: Math.random() > 0.5 ? Math.round(totalCents * 0.1) : 0,
            totalAmountCents: totalCents + Math.round(totalCents * 0.15),
            specialInstructions: oi % 3 === 0 ? 'No onions please' : null,
            guestCount: 1 + Math.floor(Math.random() * 4),
            createdAt: orderDate,
            updatedAt: orderDate,
            items: { create: orderItems },
          },
        });
        totalCreated.orders++;
        totalCreated.orderItems += orderItems.length;
        orderCount++;
      } catch (e) {
        // Skip duplicate or FK errors gracefully
        console.log(`  ⚠️  Skipped order ${orderId}: ${e.message?.substring(0, 80)}`);
      }
    }
  }

  // ====================== SUMMARY ======================
  console.log('\n' + '═'.repeat(50));
  console.log('🌱 SEED COMPLETE — Yene QR Database');
  console.log('═'.repeat(50));
  console.log(`  📋 Subscription Plans:  ${totalCreated.plans}`);
  console.log(`  🏪 Restaurants:         ${totalCreated.restaurants}`);
  console.log(`  🏢 Branches:            ${totalCreated.branches}`);
  console.log(`  🏗️  Floors:              ${totalCreated.floors}`);
  console.log(`  🪑 Tables:              ${totalCreated.tables}`);
  console.log(`  🍳 Kitchen Stations:    ${totalCreated.kitchenStations}`);
  console.log(`  👥 Staff Users:         ${totalCreated.users}`);
  console.log(`  📖 Menus:               ${totalCreated.menus}`);
  console.log(`  📂 Categories:          ${totalCreated.categories}`);
  console.log(`  🍽️  Menu Items:          ${totalCreated.menuItems}`);
  console.log(`  🔧 Modifier Groups:     ${totalCreated.modifierGroups}`);
  console.log(`  ⚙️  Modifier Options:    ${totalCreated.modifierOptions}`);
  console.log(`  📅 Reservations:        ${totalCreated.reservations}`);
  console.log(`  📲 QR Codes:            ${totalCreated.qrCodes}`);
  console.log(`  💳 Subscriptions:       ${totalCreated.subscriptions}`);
  console.log(`  🧾 Invoices:            ${totalCreated.invoices}`);
  console.log(`  🚩 Feature Flags:       ${totalCreated.featureFlags}`);
  console.log(`  🌐 Languages:           ${totalCreated.languages}`);
  console.log(`  🗣️  Restaurant Languages: ${totalCreated.restaurantLanguages}`);
  console.log(`  🤖 AI Agent Configs:    ${totalCreated.aiConfigs}`);
  console.log(`  🎧 Support Admins:      ${totalCreated.supportAdmins}`);
  console.log(`  🎫 Support Tickets:     ${totalCreated.supportTickets}`);
  console.log(`  🧾 Sample Orders:       ${totalCreated.orders}`);
  console.log(`  📦 Order Items:         ${totalCreated.orderItems}`);
  console.log('═'.repeat(50));
  console.log('\n🔐 Default password for ALL users: admin123');
  console.log('👑 Super Admin: admin@yeneqr.com / admin123');
  console.log('🎧 Support Admin: support@yeneqr.com / admin123');
  console.log('📱 Owner login: owner@habesha.et / admin123\n');
}

main().catch(e => { console.error('❌ Seed failed:', e); process.exit(1); }).finally(() => prisma.$disconnect());
