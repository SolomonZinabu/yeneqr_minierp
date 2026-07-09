// ============================================================
// Yene QR — Production Seed Script
// Creates 2 fully-staffed restaurants with real menu items
// and professional images for pilot deployment.
//
// Usage:
//   npx prisma db push --force-reset && node prisma/seed-prod.js
// ============================================================

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

const prisma = new PrismaClient()

// ─── Configuration ──────────────────────────────────────────
const DEFAULT_PASSWORD = 'admin123'
const QR_SECRET = process.env.QR_SECRET || 'yene-qr-prod-hmac-2024-habesha-continental'

// ─── Helper: hash password ──────────────────────────────────
async function hashPassword() {
  return bcrypt.hash(DEFAULT_PASSWORD, 12)
}

// ─── Helper: sign QR payload ────────────────────────────────
function signPayload(payload) {
  const data = `${payload.rid}:${payload.bid}:${payload.tid}:${payload.type}:${payload.iat}:${payload.exp || 'none'}`
  return crypto.createHmac('sha256', QR_SECRET).update(data).digest('hex')
}

// ─── Ethiopian first names & last names for realistic staff ──
const ethiopianMaleNames = [
  'Abebe', 'Kebede', 'Tadesse', 'Mulugeta', 'Assefa', 'Dereje', 'Worku', 'Hailu',
  'Girma', 'Belay', 'Tsegaye', 'Mekonnen', 'Alemu', 'Yohannes', 'Demissie', 'Fikru',
  'Solomon', 'Daniel', 'Samuel', 'Eyob'
]
const ethiopianFemaleNames = [
  'Tigist', 'Aster', 'Almaz', 'Sara', 'Hiwot', 'Meron', 'Selamawit', 'Eleni',
  ' Bethlehem', 'Kidist', 'Feven', 'Hanna', 'Nardos', 'Mekdes', 'Rediet', 'Liya',
  'Abigail', 'Yordanos', 'Tiruwork', 'Mimi'
]
const ethiopianLastNames = [
  'Tadesse', 'Kebede', 'Mulugeta', 'Assefa', 'Dereje', 'Girma', 'Abebe', 'Hailu',
  'Belay', 'Tsegaye', 'Mekonnen', 'Alemu', 'Worku', 'Fikru', 'Demissie', 'Yohannes'
]

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateStaffName(gender) {
  const firstNames = gender === 'M' ? ethiopianMaleNames : ethiopianFemaleNames
  return `${randomFrom(firstNames)} ${randomFrom(ethiopianLastNames)}`
}

// ─── Main Seed ──────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding production data...\n')

  const passwordHash = await hashPassword()
  console.log('✓ Password hash generated\n')

  // ════════════════════════════════════════════════════════════
  // 1. PLATFORM DATA
  // ════════════════════════════════════════════════════════════
  console.log('📋 Creating platform data...')

  // Super Admin
  await prisma.superAdmin.upsert({
    where: { id: 'sa-admin' },
    update: {},
    create: {
      id: 'sa-admin',
      email: 'admin@yeneqr.com',
      name: 'System Admin',
      password: passwordHash,
      isActive: true,
    },
  })

  // Subscription Plans
  // NOTE: slugs must match what the app expects ('basic', 'pro', 'premium').
  //       limit keys must be 'maxBranches'/'maxTables'/etc. (not 'branches'/'tables').
  //       feeRatePercent is the per-transaction platform fee (3% Free, 2% Pro, 1% Premium).
  for (const plan of [
    { id: 'plan-basic', name: 'Basic', slug: 'basic', description: 'Perfect for getting started. 3% per-transaction fee.', priceCents: 0, yearlyPriceCents: 0, feeRatePercent: 3.0, features: JSON.stringify(['1_branch', '5_tables', 'basic_analytics']), limits: JSON.stringify({ maxBranches: 1, maxTables: 5, maxStaff: 3, maxMenuItems: 50, maxQRCodes: 5 }), isActive: true, sortOrder: 0 },
    { id: 'plan-pro', name: 'Pro', slug: 'pro', description: 'For growing restaurants. 2% per-transaction fee + monthly subscription.', priceCents: 4900, yearlyPriceCents: 49000, feeRatePercent: 2.0, features: JSON.stringify(['5_branches', '50_tables', 'advanced_analytics', 'multilingual', 'ai_assistant']), limits: JSON.stringify({ maxBranches: 5, maxTables: 50, maxStaff: 20, maxMenuItems: 500, maxQRCodes: 50 }), isActive: true, sortOrder: 1 },
    { id: 'plan-premium', name: 'Premium', slug: 'premium', description: 'For restaurant chains. 1% per-transaction fee + monthly subscription.', priceCents: 9900, yearlyPriceCents: 99000, feeRatePercent: 1.0, features: JSON.stringify(['unlimited_branches', 'unlimited_tables', 'priority_support', 'custom_branding', 'api_access']), limits: JSON.stringify({ maxBranches: -1, maxTables: -1, maxStaff: -1, maxMenuItems: -1, maxQRCodes: -1 }), isActive: true, sortOrder: 2 },
    { id: 'plan-configurable', name: 'Configurable', slug: 'configurable', description: 'Custom-negotiated subscription. Fee rate and price are set per-restaurant by the YeneQR team. Use for enterprise deals, chains, and special partnerships.', priceCents: 0, yearlyPriceCents: 0, feeRatePercent: 0, features: JSON.stringify(['unlimited_branches', 'unlimited_tables', 'priority_support', 'custom_branding', 'api_access', 'custom_deal']), limits: JSON.stringify({ maxBranches: -1, maxTables: -1, maxStaff: -1, maxMenuItems: -1, maxQRCodes: -1 }), isActive: true, sortOrder: 3 },
  ]) {
    await prisma.subscriptionPlan.upsert({ where: { id: plan.id }, update: {}, create: plan })
  }

  // Feature Flags
  for (const flag of [
    { id: 'flag-multilingual', key: 'multilingual', name: 'Multi-language Support', enabled: true },
    { id: 'flag-ai-assistant', key: 'ai_assistant', name: 'AI Waiter Assistant', enabled: true },
    { id: 'flag-loyalty', key: 'loyalty', name: 'Loyalty Program', enabled: true },
    { id: 'flag-entertainment', key: 'entertainment', name: 'Customer Entertainment', enabled: true },
    { id: 'flag-realtime', key: 'realtime', name: 'Real-time Order Tracking', enabled: true },
  ]) {
    await prisma.platformFeatureFlag.upsert({ where: { id: flag.id }, update: {}, create: flag })
  }

  // Languages (must include all languages used by RestaurantLanguage configs)
  for (const lang of [
    { code: 'en', name: 'English', nameLocal: 'English', flagEmoji: '🇬🇧', direction: 'ltr', sortOrder: 0, isActive: true },
    { code: 'am', name: 'Amharic', nameLocal: 'አማርኛ', flagEmoji: '🇪🇹', direction: 'ltr', sortOrder: 1, isActive: true },
    { code: 'om', name: 'Oromo', nameLocal: 'Afaan Oromoo', flagEmoji: '🇪🇹', direction: 'ltr', sortOrder: 2, isActive: true },
    { code: 'ti', name: 'Tigrinya', nameLocal: 'ትግርኛ', flagEmoji: '🇪🇷', direction: 'ltr', sortOrder: 3, isActive: true },
    { code: 'ar', name: 'Arabic', nameLocal: 'العربية', flagEmoji: '🇸🇦', direction: 'rtl', sortOrder: 4, isActive: true },
  ]) {
    await prisma.language.upsert({ where: { code: lang.code }, update: {}, create: lang })
  }

  console.log('✓ Platform data created\n')

  // ════════════════════════════════════════════════════════════
  // 2. RESTAURANT 1: HABESHA MAEBEL (Ethiopian)
  // ════════════════════════════════════════════════════════════
  console.log('🏛️  Creating Habesha Maebel...')

  const habesha = await prisma.restaurant.upsert({
    where: { id: 'rest-habesha' },
    update: {},
    create: {
      id: 'rest-habesha',
      slug: 'habesha-maebel',
      name: 'Habesha Maebel',
      nameI18n: JSON.stringify({ am: 'ሐበሻ መብል', om: 'Habesha Maebel', ti: 'ሓበሻ መብል', ar: 'حبشة مأبل' }),
      description: 'Authentic Ethiopian dining experience featuring traditional dishes prepared with age-old recipes. From our famous Doro Wot to sizzling Tibs, every dish tells a story of Ethiopian heritage.',
      descriptionI18n: JSON.stringify({ am: 'ባህላዊ የኢትዮጵያ ምግብ ቤት', om: 'Yaasa dhabbata sammuu Ethiopia' }),
      cuisineType: 'Ethiopian Traditional',
      logo: '/uploads/restaurants/habesha-logo.png',
      banner: '/uploads/restaurants/habesha-banner.png',
      phone: '+251-11-555-0101',
      email: 'info@habeshamaebel.com',
      address: 'Bole Road, Atlas Building',
      city: 'Addis Ababa',
      currency: 'ETB',
      defaultLanguage: 'am',
      enabledLanguages: JSON.stringify(['am', 'en', 'om', 'ti', 'ar']),
      taxRate: 0.15,
      serviceCharge: 0.10,
      workingHours: JSON.stringify({
        mon: { open: '08:00', close: '22:00' },
        tue: { open: '08:00', close: '22:00' },
        wed: { open: '08:00', close: '22:00' },
        thu: { open: '08:00', close: '22:00' },
        fri: { open: '08:00', close: '23:00' },
        sat: { open: '09:00', close: '23:00' },
        sun: { open: '09:00', close: '21:00' },
      }),
      isActive: true,
      isVerified: true,
    },
  })

  // Subscription
  await prisma.subscription.upsert({
    where: { id: 'sub-rest-habesha' },
    update: {},
    create: {
      id: 'sub-rest-habesha',
      restaurantId: habesha.id,
      planId: 'plan-premium',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  })

  // Sample invoices for Habesha Maebel (Premium plan = 5000 ETB / mo)
  // Skip if already seeded
  {
    const existing = await prisma.invoice.count({ where: { subscriptionId: 'sub-rest-habesha' } })
    if (existing === 0) {
      const priceCents = 500000
      const taxCents = Math.round(priceCents * 0.15)
      const totalCents = priceCents + taxCents
      const now = Date.now()
      const samples = [
        { id: 'inv-habesha-1', status: 'paid',     createdOff: -60*86400000, dueOff: -55*86400000, paidOff: -52*86400000, num: 'INV-HAB-0001' },
        { id: 'inv-habesha-2', status: 'paid',     createdOff: -30*86400000, dueOff: -25*86400000, paidOff: -22*86400000, num: 'INV-HAB-0002' },
        { id: 'inv-habesha-3', status: 'pending',  createdOff:  -2*86400000, dueOff:   5*86400000, paidOff: null,           num: 'INV-HAB-0003' },
      ]
      for (const s of samples) {
        await prisma.invoice.upsert({
          where: { id: s.id },
          update: {},
          create: {
            id: s.id,
            subscriptionId: 'sub-rest-habesha',
            amountCents: priceCents,
            taxCents,
            totalCents,
            status: s.status,
            dueDate: new Date(now + s.dueOff),
            paidAt: s.paidOff !== null ? new Date(now + s.paidOff) : null,
            invoiceNumber: s.num,
            createdAt: new Date(now + s.createdOff),
          },
        })
      }
    }
  }

  // Restaurant Languages (5 languages: am, en, om, ti, ar)
  for (const rl of [
    { id: 'rl-habesha-am', restaurantId: habesha.id, languageCode: 'am', isDefault: true, isActive: true, sortOrder: 0 },
    { id: 'rl-habesha-en', restaurantId: habesha.id, languageCode: 'en', isDefault: false, isActive: true, sortOrder: 1 },
    { id: 'rl-habesha-om', restaurantId: habesha.id, languageCode: 'om', isDefault: false, isActive: true, sortOrder: 2 },
    { id: 'rl-habesha-ti', restaurantId: habesha.id, languageCode: 'ti', isDefault: false, isActive: true, sortOrder: 3 },
    { id: 'rl-habesha-ar', restaurantId: habesha.id, languageCode: 'ar', isDefault: false, isActive: true, sortOrder: 4 },
  ]) {
    await prisma.restaurantLanguage.upsert({ where: { id: rl.id }, update: {}, create: rl })
  }

  // ─── Habesha Branches ─────────────────────────────────────
  const habeshaBranches = [
    { id: 'branch-habesha-bole', name: 'Bole Branch', nameI18n: JSON.stringify({ am: 'ቦሌ ቅርንጫፍ' }), address: 'Bole Road, Atlas Building, Addis Ababa', phone: '+251-11-555-0101', city: 'Addis Ababa', isMainBranch: true },
    { id: 'branch-habesha-cmc', name: 'CMC Branch', nameI18n: JSON.stringify({ am: 'ሲኤምሲ ቅርንጫፍ' }), address: 'CMC Road, Sunshine Building, Addis Ababa', phone: '+251-11-555-0102', city: 'Addis Ababa', isMainBranch: false },
  ]

  for (const branchData of habeshaBranches) {
    await prisma.branch.upsert({
      where: { id: branchData.id },
      update: {},
      create: {
        id: branchData.id,
        restaurantId: habesha.id,
        name: branchData.name,
        nameI18n: branchData.nameI18n,
        address: branchData.address,
        phone: branchData.phone,
        city: branchData.city,
        isMainBranch: branchData.isMainBranch,
        isActive: true,
      },
    })
  }

  // ─── Habesha Floors & Tables ──────────────────────────────
  const habeshaFloors = [
    { id: 'floor-habesha-bole-0', branchId: 'branch-habesha-bole', name: 'Main Floor', sortOrder: 0, tables: 12 },
    { id: 'floor-habesha-bole-1', branchId: 'branch-habesha-bole', name: 'Upper Floor', sortOrder: 1, tables: 8 },
    { id: 'floor-habesha-cmc-0', branchId: 'branch-habesha-cmc', name: 'Main Floor', sortOrder: 0, tables: 10 },
  ]

  for (const floor of habeshaFloors) {
    await prisma.floor.upsert({
      where: { id: floor.id },
      update: {},
      create: {
        id: floor.id,
        branchId: floor.branchId,
        name: floor.name,
        sortOrder: floor.sortOrder,
        width: 1200,
        height: 800,
      },
    })

    // Create tables
    for (let i = 1; i <= floor.tables; i++) {
      const tableId = `tbl-${floor.id}-${i}`
      const capacity = i <= Math.ceil(floor.tables * 0.3) ? 2 : i <= Math.ceil(floor.tables * 0.7) ? 4 : 6
      await prisma.table.upsert({
        where: { id: tableId },
        update: {},
        create: {
          id: tableId,
          branchId: floor.branchId,
          floorId: floor.id,
          number: String(i),
          capacity,
          status: 'available',
          shape: capacity <= 2 ? 'round' : 'square',
          positionX: 100 + (i % 5) * 200,
          positionY: 100 + Math.floor(i / 5) * 200,
          isActive: true,
        },
      })

      // Create QR code for each table
      const payload = {
        rid: habesha.id,
        bid: floor.branchId,
        tid: tableId,
        type: 'static',
        iat: Math.floor(Date.now() / 1000),
        exp: null,
      }
      const signature = signPayload(payload)
      await prisma.qRCode.upsert({
        where: { id: `qr-${tableId}` },
        update: {},
        create: {
          id: `qr-${tableId}`,
          tableId,
          restaurantId: habesha.id,
          branchId: floor.branchId,
          type: 'static',
          payload: JSON.stringify(payload),
          signature,
          isActive: true,
        },
      })
    }
  }

  // ─── Habesha Kitchen Stations ─────────────────────────────
  for (const station of [
    { id: 'ks-habesha-bole-0', branchId: 'branch-habesha-bole', name: 'Wot Station', type: 'hot' },
    { id: 'ks-habesha-bole-1', branchId: 'branch-habesha-bole', name: 'Tibs Grill', type: 'grill' },
    { id: 'ks-habesha-bole-2', branchId: 'branch-habesha-bole', name: 'Beverage Bar', type: 'bar' },
    { id: 'ks-habesha-cmc-0', branchId: 'branch-habesha-cmc', name: 'Wot Station', type: 'hot' },
    { id: 'ks-habesha-cmc-1', branchId: 'branch-habesha-cmc', name: 'Tibs Grill', type: 'grill' },
  ]) {
    await prisma.kitchenStation.upsert({
      where: { id: station.id },
      update: {},
      create: {
        id: station.id,
        branchId: station.branchId,
        name: station.name,
        type: station.type,
        isActive: true,
      },
    })
  }

  // ─── Habesha Staff ────────────────────────────────────────
  console.log('👤 Creating Habesha staff...')
  const habeshaStaff = []

  // 1 Owner
  habeshaStaff.push({
    id: 'user-habesha-owner',
    restaurantId: habesha.id,
    branchId: null,
    email: 'owner@habeshamaebel.com',
    name: 'Abebe Tadesse',
    password: passwordHash,
    role: 'owner',
    phone: '+251-911-555-001',
    isActive: true,
  })

  // 2 Managers (1 per branch)
  habeshaStaff.push({
    id: 'user-habesha-mgr-bole',
    restaurantId: habesha.id,
    branchId: 'branch-habesha-bole',
    email: 'manager.bole@habeshamaebel.com',
    name: 'Tigist Mekonnen',
    password: passwordHash,
    role: 'manager',
    phone: '+251-911-555-002',
    isActive: true,
  })
  habeshaStaff.push({
    id: 'user-habesha-mgr-cmc',
    restaurantId: habesha.id,
    branchId: 'branch-habesha-cmc',
    email: 'manager.cmc@habeshamaebel.com',
    name: 'Almaz Girma',
    password: passwordHash,
    role: 'manager',
    phone: '+251-911-555-003',
    isActive: true,
  })

  // 2 Cashiers (1 per branch)
  habeshaStaff.push({
    id: 'user-habesha-cash-bole',
    restaurantId: habesha.id,
    branchId: 'branch-habesha-bole',
    email: 'cashier.bole@habeshamaebel.com',
    name: 'Hiwot Assefa',
    password: passwordHash,
    role: 'cashier',
    phone: '+251-911-555-004',
    isActive: true,
  })
  habeshaStaff.push({
    id: 'user-habesha-cash-cmc',
    restaurantId: habesha.id,
    branchId: 'branch-habesha-cmc',
    email: 'cashier.cmc@habeshamaebel.com',
    name: 'Feven Dereje',
    password: passwordHash,
    role: 'cashier',
    phone: '+251-911-555-005',
    isActive: true,
  })

  // 10 Waiters (5 per branch)
  const boleWaiterNames = ['Kebede Alemu', 'Mulugeta Hailu', 'Sara Worku', 'Meron Belay', 'Selamawit Fikru']
  const cmcWaiterNames = ['Tadesse Demissie', 'Aster Yohannes', 'Dereje Abebe', 'Hanna Tsegaye', 'Nardos Kuma']
  boleWaiterNames.forEach((name, i) => {
    habeshaStaff.push({
      id: `user-habesha-waiter-bole-${i + 1}`,
      restaurantId: habesha.id,
      branchId: 'branch-habesha-bole',
      email: `waiter.bole${i + 1}@habeshamaebel.com`,
      name,
      password: passwordHash,
      role: 'waiter',
      phone: `+251-911-555-${String(10 + i).padStart(3, '0')}`,
      isActive: true,
    })
  })
  cmcWaiterNames.forEach((name, i) => {
    habeshaStaff.push({
      id: `user-habesha-waiter-cmc-${i + 1}`,
      restaurantId: habesha.id,
      branchId: 'branch-habesha-cmc',
      email: `waiter.cmc${i + 1}@habeshamaebel.com`,
      name,
      password: passwordHash,
      role: 'waiter',
      phone: `+251-911-555-${String(20 + i).padStart(3, '0')}`,
      isActive: true,
    })
  })

  // 5 Kitchen Staff per branch (10 total)
  const boleKitchenNames = ['Worku Tadesse', 'Girma Kebede', 'Alemu Mulugeta', 'Yohannes Assefa', 'Belay Hailu']
  const cmcKitchenNames = ['Fikru Demissie', 'Tsegaye Abebe', 'Mekonnen Dereje', 'Samuel Girma', 'Eyob Belay']
  boleKitchenNames.forEach((name, i) => {
    habeshaStaff.push({
      id: `user-habesha-kitchen-bole-${i + 1}`,
      restaurantId: habesha.id,
      branchId: 'branch-habesha-bole',
      email: `kitchen.bole${i + 1}@habeshamaebel.com`,
      name,
      password: passwordHash,
      role: 'kitchen_staff',
      phone: `+251-911-555-${String(30 + i).padStart(3, '0')}`,
      isActive: true,
    })
  })
  cmcKitchenNames.forEach((name, i) => {
    habeshaStaff.push({
      id: `user-habesha-kitchen-cmc-${i + 1}`,
      restaurantId: habesha.id,
      branchId: 'branch-habesha-cmc',
      email: `kitchen.cmc${i + 1}@habeshamaebel.com`,
      name,
      password: passwordHash,
      role: 'kitchen_staff',
      phone: `+251-911-555-${String(40 + i).padStart(3, '0')}`,
      isActive: true,
    })
  })

  for (const staff of habeshaStaff) {
    await prisma.restaurantUser.upsert({ where: { id: staff.id }, update: {}, create: staff })
  }
  console.log(`✓ Created ${habeshaStaff.length} Habesha staff members`)

  // ─── Habesha Menu ─────────────────────────────────────────
  const habeshaMenu = await prisma.menu.upsert({
    where: { id: 'menu-habesha-main' },
    update: {},
    create: {
      id: 'menu-habesha-main',
      restaurantId: habesha.id,
      name: 'Main Menu',
      nameI18n: JSON.stringify({ am: 'ዋና ምናሌ', om: 'Menu Ijoo' }),
      isActive: true,
    },
  })

  // Categories
  const habeshaCategories = [
    { id: 'cat-habesha-wot', name: 'Wot (Stews)', nameI18n: JSON.stringify({ am: 'ወጥ', om: 'Wot' }), icon: '🍲', image: '/uploads/menu-items/doro-wot.png', sortOrder: 0 },
    { id: 'cat-habesha-tibs', name: 'Tibs & Grills', nameI18n: JSON.stringify({ am: 'ጥብስ', om: 'Tibs' }), icon: '🥩', image: '/uploads/menu-items/tibs.png', sortOrder: 1 },
    { id: 'cat-habesha-raw', name: 'Raw Specials', nameI18n: JSON.stringify({ am: 'ስጋ ስር', om: 'Suga Sirri' }), icon: '🥩', image: '/uploads/menu-items/kitfo.png', sortOrder: 2 },
    { id: 'cat-habesha-veg', name: 'Vegetarian & Fasting', nameI18n: JSON.stringify({ am: 'የጾም ምግብ', om: 'Nyaata Ayyaana' }), icon: '🥬', image: '/uploads/menu-items/veggie-combo.png', sortOrder: 3 },
    { id: 'cat-habesha-combo', name: 'Combos & Platters', nameI18n: JSON.stringify({ am: 'ኮምቦ', om: 'Kombii' }), icon: '🍽️', image: '/uploads/menu-items/kitfo-combo.png', sortOrder: 4 },
    { id: 'cat-habesha-breakfast', name: 'Breakfast', nameI18n: JSON.stringify({ am: 'ቁርስ', om: 'Qorxa' }), icon: '🌅', image: '/uploads/menu-items/firfir.png', sortOrder: 5 },
    { id: 'cat-habesha-drinks', name: 'Drinks', nameI18n: JSON.stringify({ am: 'መጠጥ', om: 'Dhugaa' }), icon: '🍺', image: '/uploads/menu-items/tej.png', sortOrder: 6 },
    { id: 'cat-habesha-coffee', name: 'Coffee & Tea', nameI18n: JSON.stringify({ am: 'ቡና', om: 'Buna' }), icon: '☕', image: '/uploads/menu-items/ethiopian-coffee.png', sortOrder: 7 },
  ]

  for (const cat of habeshaCategories) {
    await prisma.menuCategory.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        id: cat.id,
        menuId: habeshaMenu.id,
        restaurantId: habesha.id,
        name: cat.name,
        nameI18n: cat.nameI18n,
        icon: cat.icon,
        image: cat.image,
        sortOrder: cat.sortOrder,
        isActive: true,
      },
    })
  }

  // Menu Items
  const habeshaItems = [
    // Wot (Stews)
    { id: 'item-habesha-doro-wot', name: 'Doro Wot', nameI18n: JSON.stringify({ am: 'ዶሮ ወጥ', om: 'Diro Wot' }), catId: 'cat-habesha-wot', desc: 'Signature spicy chicken stew slow-cooked in rich berbere sauce with hard-boiled egg and served on fresh injera', descI18n: JSON.stringify({ am: 'በበርበሬ ስር የተቀቀለ ዶሮ ወጥ', om: 'Diro wot biraabaraara' }), price: 350, image: '/uploads/menu-items/doro-wot.png', prep: 30, popular: true, spicy: true },
    { id: 'item-habesha-shiro', name: 'Shiro Wot', nameI18n: JSON.stringify({ am: 'ሽሮ ወጥ', om: 'Shiro Wot' }), catId: 'cat-habesha-wot', desc: 'Creamy chickpea flour stew seasoned with garlic, ginger and berbere, a beloved Ethiopian comfort food', descI18n: JSON.stringify({ am: 'የሽሮ ወጥ', om: 'Shiro wot nyaata tasgabbii' }), price: 150, image: '/uploads/menu-items/shiro.png', prep: 15, popular: true, veg: true, spicy: true },
    { id: 'item-habesha-misir-wot', name: 'Misir Wot', nameI18n: JSON.stringify({ am: 'ሚስር ወጥ', om: 'Misir Wot' }), catId: 'cat-habesha-wot', desc: 'Spicy red lentil stew simmered with berbere and onions, perfect fasting dish', descI18n: JSON.stringify({ am: 'የሚስር ወጥ', om: 'Misir wot' }), price: 140, image: '/uploads/menu-items/misir-wot.png', prep: 15, veg: true, spicy: true },
    { id: 'item-habesha-yebeg-alicha', name: 'Yebeg Alicha', nameI18n: JSON.stringify({ am: 'የበግ አሊጫ', om: 'Hoolaa Alicha' }), catId: 'cat-habesha-wot', desc: 'Mild and aromatic lamb stew cooked with turmeric, onions, and green chilies', descI18n: JSON.stringify({ am: 'የበግ አሊጫ', om: 'Hoolaa alicha' }), price: 300, image: '/uploads/menu-items/yebeg-alicha.png', prep: 25, spicy: false },
    { id: 'item-habesha-yetakelt-wot', name: 'Yetakelt Wot', nameI18n: JSON.stringify({ am: 'የታቀለ ወጥ', om: 'Yaatakil Wot' }), catId: 'cat-habesha-wot', desc: 'Mixed vegetable stew with seasonal vegetables in a light, flavorful sauce', descI18n: JSON.stringify({ am: 'የታቀለ ወጥ', om: 'Yaatakil wot' }), price: 160, image: '/uploads/menu-items/yetakelt-wot.png', prep: 15, veg: true },

    // Tibs & Grills
    { id: 'item-habesha-tibs', name: 'Key Siga Tibs', nameI18n: JSON.stringify({ am: 'ቀይ ስጋ ጥብስ', om: 'Suga Diimaa Tibs' }), catId: 'cat-habesha-tibs', desc: 'Sizzling spicy beef cubes with rosemary, garlic, and jalapeno peppers on a hot iron skillet', descI18n: JSON.stringify({ am: 'ቀይ ስጋ ጥብስ', om: 'Suga diimaa tibs' }), price: 320, image: '/uploads/menu-items/tibs.png', prep: 15, popular: true, spicy: true },
    { id: 'item-habesha-erek-tibs', name: 'Erek Tibs (Mild)', nameI18n: JSON.stringify({ am: 'እርቅ ጥብስ', om: 'Tibs Laafaa' }), catId: 'cat-habesha-tibs', desc: 'Mild pan-fried beef cubes with onions, tomatoes, and green peppers', descI18n: JSON.stringify({ am: 'እርቅ ጥብስ', om: 'Tibs laafaa' }), price: 300, image: '/uploads/menu-items/tibs.png', prep: 12, spicy: false },
    { id: 'item-habesha-doro-tibs', name: 'Doro Tibs', nameI18n: JSON.stringify({ am: 'ዶሮ ጥብስ', om: 'Diro Tibs' }), catId: 'cat-habesha-tibs', desc: 'Stir-fried chicken pieces with onions, garlic and special spices', descI18n: JSON.stringify({ am: 'ዶሮ ጥብስ', om: 'Diro tibs' }), price: 280, image: '/uploads/menu-items/tibs.png', prep: 15 },

    // Raw Specials
    { id: 'item-habesha-kitfo', name: 'Kitfo', nameI18n: JSON.stringify({ am: 'ክትፎ', om: 'Kitfo' }), catId: 'cat-habesha-raw', desc: 'Premium lean beef minced and seasoned with mitmita spice and niter kibe (clarified butter), served with kocho and cottage cheese', descI18n: JSON.stringify({ am: 'ክትፎ', om: 'Kitfo' }), price: 380, image: '/uploads/menu-items/kitfo.png', prep: 10, popular: true, spicy: true },
    { id: 'item-habesha-kurt', name: 'Kurt (Raw Cubes)', nameI18n: JSON.stringify({ am: 'ኩርት', om: 'Kurt' }), catId: 'cat-habesha-raw', desc: 'Fresh premium beef cut into cubes, served with awaze dip and mitmita on the side', descI18n: JSON.stringify({ am: 'ኩርት', om: 'Kurt' }), price: 400, image: '/uploads/menu-items/kifto-special.png', prep: 8, spicy: true },
    { id: 'item-habesha-tere-sega', name: 'Tere Siga (Gored Gored)', nameI18n: JSON.stringify({ am: 'ቴረ ስጋ', om: 'Tere Siga' }), catId: 'cat-habesha-raw', desc: 'Large cubes of raw premium beef with awaze and mitmita dipping sauces, traditional Ethiopian steak tartare', descI18n: JSON.stringify({ am: 'ቴረ ስጋ', om: 'Tere siga' }), price: 450, image: '/uploads/menu-items/kifto-special.png', prep: 8, popular: true, spicy: true },

    // Vegetarian & Fasting
    { id: 'item-habesha-gomen', name: 'Gomen', nameI18n: JSON.stringify({ am: 'ጎመን', om: 'Gomen' }), catId: 'cat-habesha-veg', desc: 'Tender collard greens slow-cooked with garlic, ginger and olive oil, healthy and delicious', descI18n: JSON.stringify({ am: 'ጎመን', om: 'Gomen' }), price: 120, image: '/uploads/menu-items/gomen.png', prep: 15, veg: true },
    { id: 'item-habesha-atkilt', name: 'Atkilt Wot', nameI18n: JSON.stringify({ am: 'አትክልት ወጥ', om: 'Atkilt Wot' }), catId: 'cat-habesha-veg', desc: 'Mixed vegetable stew with cabbage, potatoes, and carrots in turmeric sauce', descI18n: JSON.stringify({ am: 'አትክልት ወጥ', om: 'Atkilt wot' }), price: 130, image: '/uploads/menu-items/yetakelt-wot.png', prep: 12, veg: true },
    { id: 'item-habesha-fasting-combo', name: 'Fasting Platter', nameI18n: JSON.stringify({ am: 'የጾም ዲሽ', om: 'Disa Ayyaanaa' }), catId: 'cat-habesha-veg', desc: 'Assortment of shiro, misir, gomen, atkilt on a large injera — perfect for sharing', descI18n: JSON.stringify({ am: 'የጾም ዲሽ', om: 'Disa ayyaanaa' }), price: 250, image: '/uploads/menu-items/veggie-combo.png', prep: 15, veg: true, popular: true },

    // Combos & Platters
    { id: 'item-habesha-combo-meat', name: 'Habesha Meat Combo', nameI18n: JSON.stringify({ am: 'ሐበሻ ስጋ ኮምቦ', om: 'Kombii Suga' }), catId: 'cat-habesha-combo', desc: 'Doro wot, tibs, and kitfo served together on large injera with side vegetables — perfect for 2-3 people', descI18n: JSON.stringify({ am: 'ሐበሻ ስጋ ኮምቦ', om: 'Kombii suga' }), price: 750, image: '/uploads/menu-items/kitfo-combo.png', prep: 25, popular: true },
    { id: 'item-habesha-yehabesha-likit', name: 'Yehabesha Likit (Full Platter)', nameI18n: JSON.stringify({ am: 'የሐበሻ ሊኪት', om: 'Likitii Habashaa' }), catId: 'cat-habesha-combo', desc: 'Grand Ethiopian feast for 4-6: doro wot, tibs, kitfo, shiro, gomen, and all traditional sides on massive injera', descI18n: JSON.stringify({ am: 'የሐበሻ ሊኪት', om: 'Likitii habashaa' }), price: 1200, image: '/uploads/menu-items/kitfo-combo.png', prep: 30, popular: true },

    // Breakfast
    { id: 'item-habesha-firfir', name: 'Firfir', nameI18n: JSON.stringify({ am: 'ፍርፍር', om: 'Firfir' }), catId: 'cat-habesha-breakfast', desc: 'Shredded injera sautéed with spicy berbere sauce, served with boiled egg and yogurt', descI18n: JSON.stringify({ am: 'ፍርፍር', om: 'Firfir' }), price: 180, image: '/uploads/menu-items/firfir.png', prep: 10, popular: true, spicy: true },
    { id: 'item-habesha-fetira', name: 'Fetira', nameI18n: JSON.stringify({ am: 'ፈጢራ', om: 'Fetira' }), catId: 'cat-habesha-breakfast', desc: 'Flaky pastry with honey and scrambled egg, a classic Ethiopian breakfast', descI18n: JSON.stringify({ am: 'ፈጢራ', om: 'Fetira' }), price: 200, image: '/uploads/menu-items/firfir.png', prep: 10 },
    { id: 'item-habesha-chechebsa', name: 'Chechebsa', nameI18n: JSON.stringify({ am: 'ጨጨብሳ', om: 'Chechebsa' }), catId: 'cat-habesha-breakfast', desc: 'Shredded flatbread with spiced butter and berbere, served with yogurt and honey', descI18n: JSON.stringify({ am: 'ጨጨብሳ', om: 'Chechebsa' }), price: 180, image: '/uploads/menu-items/firfir.png', prep: 10, popular: true },

    // Drinks
    { id: 'item-habesha-tej', name: 'Tej (Honey Wine)', nameI18n: JSON.stringify({ am: 'ጠጅ', om: 'Dhahaa' }), catId: 'cat-habesha-drinks', desc: 'Traditional Ethiopian honey wine served in a berele (flask), golden and sweet with a kick', descI18n: JSON.stringify({ am: 'ጠጅ', om: 'Dhahaa' }), price: 120, image: '/uploads/menu-items/tej.png', prep: 2, popular: true },
    { id: 'item-habesha-tella', name: 'Tella (Local Beer)', nameI18n: JSON.stringify({ am: 'ጠላ', om: 'Farsoo' }), catId: 'cat-habesha-drinks', desc: 'Traditional Ethiopian home-brewed beer made from teff and gesho, mildly alcoholic', descI18n: JSON.stringify({ am: 'ጠላ', om: 'Farsoo' }), price: 80, image: '/uploads/menu-items/beer-mug.png', prep: 2 },
    { id: 'item-habesha-beer', name: 'Imported Beer', nameI18n: JSON.stringify({ am: 'የመጡ ቢራ', om: 'Bira Dhufte' }), catId: 'cat-habesha-drinks', desc: 'Selection of imported beers: Heineken, Beck\'s, or Paulaner', descI18n: JSON.stringify({ am: 'የመጡ ቢራ', om: 'Bira dhufte' }), price: 100, image: '/uploads/menu-items/beer-mug.png', prep: 2 },
    { id: 'item-habesha-awash', name: 'Awash Wine', nameI18n: JSON.stringify({ am: 'አዋሽ ወይን', om: 'Awash Waynii' }), catId: 'cat-habesha-drinks', desc: 'Ethiopian dry red wine from Awash Winery, perfect with spicy food', descI18n: JSON.stringify({ am: 'አዋሽ ወይን', om: 'Awash waynii' }), price: 200, image: '/uploads/menu-items/tej.png', prep: 2 },
    { id: 'item-habesha-soft', name: 'Soft Drinks', nameI18n: JSON.stringify({ am: 'ሶፍት መጠጥ', om: 'Dhugaa Laafaa' }), catId: 'cat-habesha-drinks', desc: 'Coca-Cola, Fanta, Sprite, or Mirinda — served chilled', descI18n: JSON.stringify({ am: 'ሶፍት መጠጥ', om: 'Dhugaa laafaa' }), price: 40, image: '/uploads/menu-items/beer-mug.png', prep: 1 },
    { id: 'item-habesha-water', name: 'Bottled Water', nameI18n: JSON.stringify({ am: 'ውሃ', om: 'Bishaan' }), catId: 'cat-habesha-drinks', desc: 'Premium bottled still water', descI18n: JSON.stringify({ am: 'ውሃ', om: 'Bishaan' }), price: 30, image: '/uploads/menu-items/beer-mug.png', prep: 1 },

    // Coffee & Tea
    { id: 'item-habesha-coffee', name: 'Ethiopian Coffee Ceremony', nameI18n: JSON.stringify({ am: 'የቡና ስር', om: 'Sirna Bunaa' }), catId: 'cat-habesha-coffee', desc: 'Full traditional coffee ceremony with fresh roasted beans, popcorn, and burning frankincense — three cups included', descI18n: JSON.stringify({ am: 'የቡና ስር', om: 'Sirna bunaa' }), price: 80, image: '/uploads/menu-items/ethiopian-coffee.png', prep: 15, popular: true },
    { id: 'item-habesha-macchiato', name: 'Ethiopian Macchiato', nameI18n: JSON.stringify({ am: 'ማኪያቶ', om: 'Makiyaato' }), catId: 'cat-habesha-coffee', desc: 'Espresso with a splash of steamed milk, Addis-style — strong and sweet', descI18n: JSON.stringify({ am: 'ማኪያቶ', om: 'Makiyaato' }), price: 50, image: '/uploads/menu-items/ethiopian-coffee.png', prep: 5, popular: true },
    { id: 'item-habesha-shai', name: 'Shai (Tea)', nameI18n: JSON.stringify({ am: 'ሻይ', om: 'Shaayii' }), catId: 'cat-habesha-coffee', desc: 'Ethiopian spiced black tea with milk, served with sugar on the side', descI18n: JSON.stringify({ am: 'ሻይ', om: 'Shaayii' }), price: 35, image: '/uploads/menu-items/ethiopian-coffee.png', prep: 5 },
  ]

  for (const item of habeshaItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: {
        id: item.id,
        categoryId: item.catId,
        restaurantId: habesha.id,
        name: item.name,
        nameI18n: item.nameI18n,
        description: item.desc,
        descriptionI18n: item.descI18n,
        priceCents: item.price * 100,
        image: item.image,
        preparationTime: item.prep,
        isAvailable: true,
        isPopular: item.popular || false,
        isVegetarian: item.veg || false,
        isSpicy: item.spicy || false,
        sortOrder: 0,
      },
    })
  }

  // Add modifier groups for key items
  const habeshaModifiers = [
    { itemId: 'item-habesha-kitfo', name: 'Cooking Level', nameI18n: JSON.stringify({ am: 'የማብሰያ ደረጃ', om: 'Safxa Bisanisaa' }), options: [
      { name: 'Raw (Tere)', nameI18n: JSON.stringify({ am: 'ቴረ', om: 'Tere' }), delta: 0, isDefault: true },
      { name: 'Rare (Kurt)', nameI18n: JSON.stringify({ am: 'ኩርት', om: 'Kurt' }), delta: 0 },
      { name: 'Medium (Lebleb)', nameI18n: JSON.stringify({ am: 'ሌብሌብ', om: 'Lebleb' }), delta: 0 },
      { name: 'Well Done (Yebesebil)', nameI18n: JSON.stringify({ am: 'የበሰለ', om: 'Bisame' }), delta: 0 },
    ]},
    { itemId: 'item-habesha-doro-wot', name: 'Spice Level', nameI18n: JSON.stringify({ am: 'መራር ደረጃ', om: 'Safxa Quba' }), options: [
      { name: 'Mild (Alicha)', nameI18n: JSON.stringify({ am: 'አሊጫ', om: 'Laafaa' }), delta: 0 },
      { name: 'Medium', nameI18n: JSON.stringify({ am: 'መካከለኛ', om: 'Giddu' }), delta: 0, isDefault: true },
      { name: 'Spicy (Key)', nameI18n: JSON.stringify({ am: 'ቀይ', om: 'Diimaa' }), delta: 0 },
    ]},
    { itemId: 'item-habesha-tej', name: 'Size', nameI18n: JSON.stringify({ am: 'መጠን', om: 'Bay\'aa' }), options: [
      { name: 'Small (1 Berele)', nameI18n: JSON.stringify({ am: 'ትንሽ', om: 'Xiqqaa' }), delta: 0, isDefault: true },
      { name: 'Large (2 Berele)', nameI18n: JSON.stringify({ am: 'ትልቅ', om: 'Guddaa' }), delta: 6000 },
    ]},
  ]

  for (let mi = 0; mi < habeshaModifiers.length; mi++) {
    const mod = habeshaModifiers[mi]
    const groupId = `modgroup-habesha-${mi}`
    await prisma.modifierGroup.upsert({
      where: { id: groupId },
      update: {},
      create: {
        id: groupId,
        menuItemId: mod.itemId,
        name: mod.name,
        nameI18n: mod.nameI18n,
        isRequired: true,
        selectionType: 'single',
        minSelection: 1,
        maxSelection: 1,
      },
    })
    for (let oi = 0; oi < mod.options.length; oi++) {
      const opt = mod.options[oi]
      const optId = `modopt-habesha-${mi}-${oi}`
      await prisma.modifierOption.upsert({
        where: { id: optId },
        update: {},
        create: {
          id: optId,
          modifierGroupId: groupId,
          name: opt.name,
          nameI18n: opt.nameI18n,
          priceDeltaCents: opt.delta || 0,
          isDefault: opt.isDefault || false,
          isActive: true,
        },
      })
    }
  }

  console.log(`✓ Created ${habeshaCategories.length} categories, ${habeshaItems.length} items with modifiers\n`)

  // ════════════════════════════════════════════════════════════
  // 3. RESTAURANT 2: THE CONTINENTAL (International)
  // ════════════════════════════════════════════════════════════
  console.log('🌍 Creating The Continental...')

  const continental = await prisma.restaurant.upsert({
    where: { id: 'rest-continental' },
    update: {},
    create: {
      id: 'rest-continental',
      slug: 'the-continental',
      name: 'The Continental',
      nameI18n: JSON.stringify({ am: 'ዘ ኮንቲኔንታል', om: 'The Continental', ti: 'ዘ ኮንቲኔንታል', ar: 'ذا كونتيننتال' }),
      description: 'International fine dining reimagined. From Japanese sashimi to Italian truffle risotto, Wagyu steak to Thai pad thai — a culinary journey around the world on every plate.',
      cuisineType: 'International Fusion',
      logo: '/uploads/restaurants/continental-logo.png',
      banner: '/uploads/restaurants/continental-banner.png',
      phone: '+251-11-666-0101',
      email: 'info@thecontinental.et',
      address: 'Kazanchis, UN Conference Center Road',
      city: 'Addis Ababa',
      currency: 'ETB',
      defaultLanguage: 'en',
      enabledLanguages: JSON.stringify(['en', 'am', 'om', 'ti', 'ar']),
      taxRate: 0.15,
      serviceCharge: 0.15,
      workingHours: JSON.stringify({
        mon: { open: '11:00', close: '23:00' },
        tue: { open: '11:00', close: '23:00' },
        wed: { open: '11:00', close: '23:00' },
        thu: { open: '11:00', close: '23:00' },
        fri: { open: '11:00', close: '00:00' },
        sat: { open: '10:00', close: '00:00' },
        sun: { open: '10:00', close: '22:00' },
      }),
      isActive: true,
      isVerified: true,
    },
  })

  // Subscription
  await prisma.subscription.upsert({
    where: { id: 'sub-rest-continental' },
    update: {},
    create: {
      id: 'sub-rest-continental',
      restaurantId: continental.id,
      planId: 'plan-premium',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  })

  // Sample invoices for The Continental (Premium plan = 5000 ETB / mo)
  {
    const existing = await prisma.invoice.count({ where: { subscriptionId: 'sub-rest-continental' } })
    if (existing === 0) {
      const priceCents = 500000
      const taxCents = Math.round(priceCents * 0.15)
      const totalCents = priceCents + taxCents
      const now = Date.now()
      const samples = [
        { id: 'inv-continental-1', status: 'paid',     createdOff: -45*86400000, dueOff: -40*86400000, paidOff: -38*86400000, num: 'INV-CON-0001' },
        { id: 'inv-continental-2', status: 'overdue',  createdOff: -15*86400000, dueOff:  -1*86400000, paidOff: null,           num: 'INV-CON-0002' },
        { id: 'inv-continental-3', status: 'pending',  createdOff:  -1*86400000, dueOff:   6*86400000, paidOff: null,           num: 'INV-CON-0003' },
      ]
      for (const s of samples) {
        await prisma.invoice.upsert({
          where: { id: s.id },
          update: {},
          create: {
            id: s.id,
            subscriptionId: 'sub-rest-continental',
            amountCents: priceCents,
            taxCents,
            totalCents,
            status: s.status,
            dueDate: new Date(now + s.dueOff),
            paidAt: s.paidOff !== null ? new Date(now + s.paidOff) : null,
            invoiceNumber: s.num,
            createdAt: new Date(now + s.createdOff),
          },
        })
      }
    }
  }

  // Restaurant Languages (5 languages: en, am, om, ti, ar)
  for (const rl of [
    { id: 'rl-continental-en', restaurantId: continental.id, languageCode: 'en', isDefault: true, isActive: true, sortOrder: 0 },
    { id: 'rl-continental-am', restaurantId: continental.id, languageCode: 'am', isDefault: false, isActive: true, sortOrder: 1 },
    { id: 'rl-continental-om', restaurantId: continental.id, languageCode: 'om', isDefault: false, isActive: true, sortOrder: 2 },
    { id: 'rl-continental-ti', restaurantId: continental.id, languageCode: 'ti', isDefault: false, isActive: true, sortOrder: 3 },
    { id: 'rl-continental-ar', restaurantId: continental.id, languageCode: 'ar', isDefault: false, isActive: true, sortOrder: 4 },
  ]) {
    await prisma.restaurantLanguage.upsert({ where: { id: rl.id }, update: {}, create: rl })
  }

  // ─── Continental Branches ─────────────────────────────────
  const continentalBranches = [
    { id: 'branch-continental-kazanchis', name: 'Kazanchis Flagship', address: 'UN Conference Center Road, Kazanchis, Addis Ababa', phone: '+251-11-666-0101', city: 'Addis Ababa', isMainBranch: true },
    { id: 'branch-continental-bole', name: 'Bole Sky Lounge', address: 'Bole Medhane Alem Road, 12th Floor, Addis Ababa', phone: '+251-11-666-0102', city: 'Addis Ababa', isMainBranch: false },
  ]

  for (const branchData of continentalBranches) {
    await prisma.branch.upsert({
      where: { id: branchData.id },
      update: {},
      create: {
        id: branchData.id,
        restaurantId: continental.id,
        name: branchData.name,
        address: branchData.address,
        phone: branchData.phone,
        city: branchData.city,
        isMainBranch: branchData.isMainBranch,
        isActive: true,
      },
    })
  }

  // ─── Continental Floors & Tables ──────────────────────────
  const continentalFloors = [
    { id: 'floor-continental-kaz-0', branchId: 'branch-continental-kazanchis', name: 'Main Dining', sortOrder: 0, tables: 14 },
    { id: 'floor-continental-kaz-1', branchId: 'branch-continental-kazanchis', name: 'VIP Mezzanine', sortOrder: 1, tables: 6 },
    { id: 'floor-continental-bole-0', branchId: 'branch-continental-bole', name: 'Sky Floor', sortOrder: 0, tables: 10 },
  ]

  for (const floor of continentalFloors) {
    await prisma.floor.upsert({
      where: { id: floor.id },
      update: {},
      create: {
        id: floor.id,
        branchId: floor.branchId,
        name: floor.name,
        sortOrder: floor.sortOrder,
        width: 1200,
        height: 800,
      },
    })

    for (let i = 1; i <= floor.tables; i++) {
      const tableId = `tbl-${floor.id}-${i}`
      const capacity = floor.name.includes('VIP') ? 2 : i <= Math.ceil(floor.tables * 0.3) ? 2 : 4
      await prisma.table.upsert({
        where: { id: tableId },
        update: {},
        create: {
          id: tableId,
          branchId: floor.branchId,
          floorId: floor.id,
          number: floor.name.includes('VIP') ? `V${i}` : String(i),
          capacity,
          status: 'available',
          shape: capacity <= 2 ? 'round' : 'square',
          positionX: 100 + (i % 5) * 200,
          positionY: 100 + Math.floor(i / 5) * 200,
          isActive: true,
        },
      })

      const payload = {
        rid: continental.id,
        bid: floor.branchId,
        tid: tableId,
        type: 'static',
        iat: Math.floor(Date.now() / 1000),
        exp: null,
      }
      const signature = signPayload(payload)
      await prisma.qRCode.upsert({
        where: { id: `qr-${tableId}` },
        update: {},
        create: {
          id: `qr-${tableId}`,
          tableId,
          restaurantId: continental.id,
          branchId: floor.branchId,
          type: 'static',
          payload: JSON.stringify(payload),
          signature,
          isActive: true,
        },
      })
    }
  }

  // ─── Continental Kitchen Stations ─────────────────────────
  for (const station of [
    { id: 'ks-continental-kaz-0', branchId: 'branch-continental-kazanchis', name: 'Main Kitchen', type: 'general' },
    { id: 'ks-continental-kaz-1', branchId: 'branch-continental-kazanchis', name: 'Sushi Station', type: 'cold' },
    { id: 'ks-continental-kaz-2', branchId: 'branch-continental-kazanchis', name: 'Cocktail Bar', type: 'bar' },
    { id: 'ks-continental-bole-0', branchId: 'branch-continental-bole', name: 'Sky Kitchen', type: 'general' },
    { id: 'ks-continental-bole-1', branchId: 'branch-continental-bole', name: 'Rooftop Bar', type: 'bar' },
  ]) {
    await prisma.kitchenStation.upsert({
      where: { id: station.id },
      update: {},
      create: { id: station.id, branchId: station.branchId, name: station.name, type: station.type, isActive: true },
    })
  }

  // ─── Continental Staff ────────────────────────────────────
  console.log('👤 Creating Continental staff...')
  const continentalStaff = []

  // 1 Owner
  continentalStaff.push({
    id: 'user-continental-owner',
    restaurantId: continental.id,
    branchId: null,
    email: 'owner@thecontinental.et',
    name: 'Solomon Zinabu',
    password: passwordHash,
    role: 'owner',
    phone: '+251-922-666-001',
    isActive: true,
  })

  // 2 Managers
  continentalStaff.push({
    id: 'user-continental-mgr-kaz',
    restaurantId: continental.id,
    branchId: 'branch-continental-kazanchis',
    email: 'manager.kaz@thecontinental.et',
    name: 'Daniel Mekonnen',
    password: passwordHash,
    role: 'manager',
    phone: '+251-922-666-002',
    isActive: true,
  })
  continentalStaff.push({
    id: 'user-continental-mgr-bole',
    restaurantId: continental.id,
    branchId: 'branch-continental-bole',
    email: 'manager.bole@thecontinental.et',
    name: 'Bethlehem Alemu',
    password: passwordHash,
    role: 'manager',
    phone: '+251-922-666-003',
    isActive: true,
  })

  // 2 Cashiers
  continentalStaff.push({
    id: 'user-continental-cash-kaz',
    restaurantId: continental.id,
    branchId: 'branch-continental-kazanchis',
    email: 'cashier.kaz@thecontinental.et',
    name: 'Kidist Worku',
    password: passwordHash,
    role: 'cashier',
    phone: '+251-922-666-004',
    isActive: true,
  })
  continentalStaff.push({
    id: 'user-continental-cash-bole',
    restaurantId: continental.id,
    branchId: 'branch-continental-bole',
    email: 'cashier.bole@thecontinental.et',
    name: 'Liya Girma',
    password: passwordHash,
    role: 'cashier',
    phone: '+251-922-666-005',
    isActive: true,
  })

  // 10 Waiters (5 per branch)
  const kazWaiterNames = ['Samuel Tadesse', 'Meron Assefa', 'Yohannes Hailu', 'Hanna Dereje', 'Abigail Fikru']
  const boleWaiterNames2 = ['Eyob Kebede', 'Rediet Mulugeta', 'Solomon Belay', 'Yordanos Abebe', 'Mimi Demissie']
  kazWaiterNames.forEach((name, i) => {
    continentalStaff.push({
      id: `user-continental-waiter-kaz-${i + 1}`,
      restaurantId: continental.id,
      branchId: 'branch-continental-kazanchis',
      email: `waiter.kaz${i + 1}@thecontinental.et`,
      name,
      password: passwordHash,
      role: 'waiter',
      phone: `+251-922-666-${String(10 + i).padStart(3, '0')}`,
      isActive: true,
    })
  })
  boleWaiterNames2.forEach((name, i) => {
    continentalStaff.push({
      id: `user-continental-waiter-bole-${i + 1}`,
      restaurantId: continental.id,
      branchId: 'branch-continental-bole',
      email: `waiter.bole${i + 1}@thecontinental.et`,
      name,
      password: passwordHash,
      role: 'waiter',
      phone: `+251-922-666-${String(20 + i).padStart(3, '0')}`,
      isActive: true,
    })
  })

  // 10 Kitchen Staff (5 per branch)
  const kazKitchenNames = ['Girma Tsegaye', 'Alemu Yohannes', 'Worku Demissie', 'Belay Abebe', 'Kebede Fikru']
  const continentalBoleKitchenNames = ['Mekonnen Hailu', 'Assefa Girma', 'Tadesse Dereje', 'Abebe Mulugeta', 'Dereje Belay']
  kazKitchenNames.forEach((name, i) => {
    continentalStaff.push({
      id: `user-continental-kitchen-kaz-${i + 1}`,
      restaurantId: continental.id,
      branchId: 'branch-continental-kazanchis',
      email: `kitchen.kaz${i + 1}@thecontinental.et`,
      name,
      password: passwordHash,
      role: 'kitchen_staff',
      phone: `+251-922-666-${String(30 + i).padStart(3, '0')}`,
      isActive: true,
    })
  })
  continentalBoleKitchenNames.forEach((name, i) => {
    continentalStaff.push({
      id: `user-continental-kitchen-bole-${i + 1}`,
      restaurantId: continental.id,
      branchId: 'branch-continental-bole',
      email: `kitchen.bole${i + 1}@thecontinental.et`,
      name,
      password: passwordHash,
      role: 'kitchen_staff',
      phone: `+251-922-666-${String(40 + i).padStart(3, '0')}`,
      isActive: true,
    })
  })

  for (const staff of continentalStaff) {
    await prisma.restaurantUser.upsert({ where: { id: staff.id }, update: {}, create: staff })
  }
  console.log(`✓ Created ${continentalStaff.length} Continental staff members`)

  // ─── Continental Menu ─────────────────────────────────────
  const continentalMenu = await prisma.menu.upsert({
    where: { id: 'menu-continental-main' },
    update: {},
    create: {
      id: 'menu-continental-main',
      restaurantId: continental.id,
      name: 'Main Menu',
      isActive: true,
    },
  })

  const continentalCategories = [
    { id: 'cat-continental-starters', name: 'Starters & Soups', icon: '🥗', image: '/uploads/menu-items/caesar-salad.png', sortOrder: 0 },
    { id: 'cat-continental-mains', name: 'Main Courses', icon: '🍽️', image: '/uploads/menu-items/wagyu-steak.png', sortOrder: 1 },
    { id: 'cat-continental-seafood', name: 'Seafood & Sushi', icon: '🐟', image: '/uploads/menu-items/salmon-sashimi.png', sortOrder: 2 },
    { id: 'cat-continental-pizza', name: 'Pizza & Pasta', icon: '🍕', image: '/uploads/menu-items/margherita-pizza.png', sortOrder: 3 },
    { id: 'cat-continental-asian', name: 'Asian Selection', icon: '🥢', image: '/uploads/menu-items/pad-thai.png', sortOrder: 4 },
    { id: 'cat-continental-desserts', name: 'Desserts', icon: '🍰', image: '/uploads/menu-items/tiramisu.png', sortOrder: 5 },
    { id: 'cat-continental-cocktails', name: 'Cocktails & Spirits', icon: '🍸', image: '/uploads/menu-items/mojito.png', sortOrder: 6 },
    { id: 'cat-continental-wine', name: 'Wine & Beer', icon: '🍷', image: '/uploads/menu-items/red-wine.png', sortOrder: 7 },
  ]

  for (const cat of continentalCategories) {
    await prisma.menuCategory.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        id: cat.id,
        menuId: continentalMenu.id,
        restaurantId: continental.id,
        name: cat.name,
        icon: cat.icon,
        image: cat.image,
        sortOrder: cat.sortOrder,
        isActive: true,
      },
    })
  }

  const continentalItems = [
    // Starters & Soups
    { id: 'item-continental-caesar', name: 'Classic Caesar Salad', catId: 'cat-continental-starters', desc: 'Crisp romaine lettuce, shaved parmesan, garlic croutons, anchovy fillets, and creamy Caesar dressing', price: 280, image: '/uploads/menu-items/caesar-salad.png', prep: 8, popular: true },
    { id: 'item-continental-french-onion', name: 'French Onion Soup', catId: 'cat-continental-starters', desc: 'Caramelized onion broth topped with crusty bread and melted Gruyère cheese, served piping hot', price: 220, image: '/uploads/menu-items/french-onion-soup.png', prep: 10 },
    { id: 'item-continental-bruschetta', name: 'Tomato Bruschetta', catId: 'cat-continental-starters', desc: 'Toasted ciabatta topped with fresh tomatoes, basil, garlic, and extra virgin olive oil', price: 180, image: '/uploads/menu-items/caesar-salad.png', prep: 5, veg: true },
    { id: 'item-continental-truffle-risotto-starter', name: 'Truffle Arancini', catId: 'cat-continental-starters', desc: 'Crispy fried risotto balls with truffle and mozzarella center, served with aioli dip', price: 260, image: '/uploads/menu-items/truffle-risotto.png', prep: 10, veg: true },

    // Main Courses
    { id: 'item-continental-wagyu', name: 'Wagyu Ribeye Steak', catId: 'cat-continental-mains', desc: 'Premium A5 Wagyu ribeye, grilled to perfection, served with truffle mashed potatoes and roasted asparagus', price: 2800, image: '/uploads/menu-items/wagyu-steak.png', prep: 25, popular: true },
    { id: 'item-continental-ribeye', name: 'Grass-Fed Ribeye (300g)', catId: 'cat-continental-mains', desc: 'Dry-aged grass-fed beef ribeye with choice of peppercorn or red wine jus, garlic butter, and seasonal vegetables', price: 1200, image: '/uploads/menu-items/wagyu-steak.png', prep: 20, popular: true },
    { id: 'item-continental-burger', name: 'The Continental Burger', catId: 'cat-continental-mains', desc: 'Angus beef patty with caramelized onions, aged cheddar, truffle aioli, on brioche bun with truffle fries', price: 450, image: '/uploads/menu-items/gourmet-burger.png', prep: 15, popular: true },
    { id: 'item-continental-chicken', name: 'Herb-Roasted Chicken', catId: 'cat-continental-mains', desc: 'Free-range half chicken roasted with thyme, rosemary and garlic, served with roasted root vegetables and jus', price: 550, image: '/uploads/menu-items/wagyu-steak.png', prep: 20 },
    { id: 'item-continental-lamb', name: 'Rack of Lamb', catId: 'cat-continental-mains', desc: 'New Zealand rack of lamb with mint pesto, fondant potato, and Mediterranean vegetables', price: 1400, image: '/uploads/menu-items/wagyu-steak.png', prep: 22 },

    // Seafood & Sushi
    { id: 'item-continental-sashimi', name: 'Salmon Sashimi (8pc)', catId: 'cat-continental-seafood', desc: 'Fresh Norwegian salmon, artfully sliced, served with wasabi, pickled ginger, and soy sauce', price: 650, image: '/uploads/menu-items/salmon-sashimi.png', prep: 8, popular: true },
    { id: 'item-continental-sea-bass', name: 'Grilled Mediterranean Sea Bass', catId: 'cat-continental-seafood', desc: 'Whole grilled sea bass with lemon, capers, olive oil, roasted cherry tomatoes, and herbed potatoes', price: 900, image: '/uploads/menu-items/sea-bass.png', prep: 20 },
    { id: 'item-continental-shrimp', name: 'Garlic Butter Prawns', catId: 'cat-continental-seafood', desc: 'Jumbo prawns sautéed in garlic butter with white wine, chili flakes, and fresh parsley, served with sourdough', price: 700, image: '/uploads/menu-items/sea-bass.png', prep: 12 },

    // Pizza & Pasta
    { id: 'item-continental-margherita', name: 'Margherita Pizza', catId: 'cat-continental-pizza', desc: 'Wood-fired thin crust with San Marzano tomato sauce, fresh mozzarella, basil, and extra virgin olive oil', price: 350, image: '/uploads/menu-items/margherita-pizza.png', prep: 12, veg: true, popular: true },
    { id: 'item-continental-truffle-risotto', name: 'Black Truffle Risotto', catId: 'cat-continental-pizza', desc: 'Creamy Arborio rice with black truffle shavings, parmesan, and wild mushrooms', price: 550, image: '/uploads/menu-items/truffle-risotto.png', prep: 18, veg: true },
    { id: 'item-continental-carbonara', name: 'Spaghetti Carbonara', catId: 'cat-continental-pizza', desc: 'Traditional Roman carbonara with guanciale, egg yolk, pecorino romano, and black pepper', price: 380, image: '/uploads/menu-items/truffle-risotto.png', prep: 12 },

    // Asian Selection
    { id: 'item-continental-tikka', name: 'Chicken Tikka Masala', catId: 'cat-continental-asian', desc: 'Tandoori chicken in creamy tomato-based curry sauce, served with basmati rice and garlic naan', price: 420, image: '/uploads/menu-items/tikka-masala.png', prep: 15, spicy: true, popular: true },
    { id: 'item-continental-pad-thai', name: 'Pad Thai', catId: 'cat-continental-asian', desc: 'Stir-fried rice noodles with prawns, bean sprouts, peanuts, lime, and tamarind sauce', price: 380, image: '/uploads/menu-items/pad-thai.png', prep: 12 },
    { id: 'item-continental-thai-green', name: 'Thai Green Curry', catId: 'cat-continental-asian', desc: 'Coconut green curry with chicken, Thai basil, bamboo shoots, and jasmine rice', price: 400, image: '/uploads/menu-items/pad-thai.png', prep: 15, spicy: true },

    // Desserts
    { id: 'item-continental-tiramisu', name: 'Classic Tiramisu', catId: 'cat-continental-desserts', desc: 'Layers of espresso-soaked ladyfingers and mascarpone cream, dusted with cocoa — Italian perfection', price: 250, image: '/uploads/menu-items/tiramisu.png', prep: 5, popular: true },
    { id: 'item-continental-lava-cake', name: 'Chocolate Lava Cake', catId: 'cat-continental-desserts', desc: 'Warm dark chocolate cake with molten center, served with vanilla bean ice cream and berry compote', price: 280, image: '/uploads/menu-items/chocolate-lava-cake.png', prep: 12, popular: true },
    { id: 'item-continental-creme-brulee', name: 'Crème Brûlée', catId: 'cat-continental-desserts', desc: 'Classic vanilla custard with caramelized sugar crust, served with fresh berries', price: 220, image: '/uploads/menu-items/tiramisu.png', prep: 5 },

    // Cocktails & Spirits
    { id: 'item-continental-mojito', name: 'Classic Mojito', catId: 'cat-continental-cocktails', desc: 'White rum, fresh mint, lime juice, sugar, and soda water — refreshing and timeless', price: 180, image: '/uploads/menu-items/mojito.png', prep: 3, popular: true },
    { id: 'item-continental-old-fashioned', name: 'Old Fashioned', catId: 'cat-continental-cocktails', desc: 'Bourbon whiskey, Angostura bitters, sugar cube, and orange peel — the original cocktail', price: 220, image: '/uploads/menu-items/old-fashioned.png', prep: 3 },
    { id: 'item-continental-espresso-martini', name: 'Espresso Martini', catId: 'cat-continental-cocktails', desc: 'Vodka, fresh espresso, coffee liqueur, and simple syrup — caffeinated elegance', price: 200, image: '/uploads/menu-items/mojito.png', prep: 3, popular: true },
    { id: 'item-continental-negroni', name: 'Negroni', catId: 'cat-continental-cocktails', desc: 'Gin, Campari, and sweet vermouth — bold, bitter, and beautiful', price: 200, image: '/uploads/menu-items/old-fashioned.png', prep: 3 },

    // Wine & Beer
    { id: 'item-continental-wine-red', name: 'Cabernet Sauvignon (Glass)', catId: 'cat-continental-wine', desc: 'Full-bodied red wine with notes of blackcurrant and oak — French or Chilean selection', price: 250, image: '/uploads/menu-items/red-wine.png', prep: 2 },
    { id: 'item-continental-wine-white', name: 'Chardonnay (Glass)', catId: 'cat-continental-wine', desc: 'Crisp and buttery white wine with tropical fruit notes — perfect with seafood', price: 230, image: '/uploads/menu-items/red-wine.png', prep: 2 },
    { id: 'item-continental-champagne', name: 'Champagne (Glass)', catId: 'cat-continental-wine', desc: 'French champagne — for celebrations, or just because it\'s Tuesday', price: 450, image: '/uploads/menu-items/red-wine.png', prep: 2 },
    { id: 'item-continental-craft-beer', name: 'Craft Beer Selection', catId: 'cat-continental-wine', desc: 'Rotating selection of local and imported craft beers — ask your server for today\'s picks', price: 120, image: '/uploads/menu-items/beer-mug.png', prep: 2 },
    { id: 'item-continental-soft', name: 'Soft Drinks', catId: 'cat-continental-wine', desc: 'Coca-Cola, Fanta, Sprite, or sparkling water', price: 50, image: '/uploads/menu-items/beer-mug.png', prep: 1 },
  ]

  for (const item of continentalItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: {
        id: item.id,
        categoryId: item.catId,
        restaurantId: continental.id,
        name: item.name,
        description: item.desc,
        priceCents: item.price * 100,
        image: item.image,
        preparationTime: item.prep,
        isAvailable: true,
        isPopular: item.popular || false,
        isVegetarian: item.veg || false,
        isSpicy: item.spicy || false,
        sortOrder: 0,
      },
    })
  }

  // Continental Modifiers
  const continentalModifiers = [
    { itemId: 'item-continental-wagyu', name: 'Cooking Level', options: [
      { name: 'Rare', delta: 0, isDefault: false },
      { name: 'Medium Rare', delta: 0, isDefault: true },
      { name: 'Medium', delta: 0, isDefault: false },
      { name: 'Medium Well', delta: 0, isDefault: false },
      { name: 'Well Done', delta: 0, isDefault: false },
    ]},
    { itemId: 'item-continental-ribeye', name: 'Cooking Level', options: [
      { name: 'Rare', delta: 0 },
      { name: 'Medium Rare', delta: 0, isDefault: true },
      { name: 'Medium', delta: 0 },
      { name: 'Well Done', delta: 0 },
    ]},
    { itemId: 'item-continental-wagyu', name: 'Side Dish', options: [
      { name: 'Truffle Mashed Potatoes', delta: 0, isDefault: true },
      { name: 'French Fries', delta: 0 },
      { name: 'Roasted Vegetables', delta: 0 },
      { name: 'Caesar Salad', delta: 5000 },
    ]},
    { itemId: 'item-continental-burger', name: 'Doneness', options: [
      { name: 'Medium', delta: 0, isDefault: true },
      { name: 'Medium Well', delta: 0 },
      { name: 'Well Done', delta: 0 },
    ]},
  ]

  for (let mi = 0; mi < continentalModifiers.length; mi++) {
    const mod = continentalModifiers[mi]
    const groupId = `modgroup-continental-${mi}`
    await prisma.modifierGroup.upsert({
      where: { id: groupId },
      update: {},
      create: {
        id: groupId,
        menuItemId: mod.itemId,
        name: mod.name,
        isRequired: true,
        selectionType: 'single',
        minSelection: 1,
        maxSelection: 1,
      },
    })
    for (let oi = 0; oi < mod.options.length; oi++) {
      const opt = mod.options[oi]
      const optId = `modopt-continental-${mi}-${oi}`
      await prisma.modifierOption.upsert({
        where: { id: optId },
        update: {},
        create: {
          id: optId,
          modifierGroupId: groupId,
          name: opt.name,
          priceDeltaCents: opt.delta || 0,
          isDefault: opt.isDefault || false,
          isActive: true,
        },
      })
    }
  }

  console.log(`✓ Created ${continentalCategories.length} categories, ${continentalItems.length} items with modifiers\n`)

  // ════════════════════════════════════════════════════════════
  // 4. SUMMARY
  // ════════════════════════════════════════════════════════════
  console.log('\n🎉 Production seed complete!\n')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('SUMMARY')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`🏛️  Habesha Maebel:`)
  console.log(`   - 2 branches (Bole + CMC)`)
  console.log(`   - 3 floors, 30 tables, 30 QR codes`)
  console.log(`   - ${habeshaStaff.length} staff (1 owner, 2 managers, 2 cashiers, 10 waiters, 10 kitchen)`)
  console.log(`   - ${habeshaCategories.length} categories, ${habeshaItems.length} menu items`)
  console.log('')
  console.log(`🌍 The Continental:`)
  console.log(`   - 2 branches (Kazanchis + Bole Sky Lounge)`)
  console.log(`   - 3 floors, 30 tables, 30 QR codes`)
  console.log(`   - ${continentalStaff.length} staff (1 owner, 2 managers, 2 cashiers, 10 waiters, 10 kitchen)`)
  console.log(`   - ${continentalCategories.length} categories, ${continentalItems.length} menu items`)
  console.log('')
  console.log('🔐 All passwords: admin123')
  console.log('📧 Owner emails: owner@habeshamaebel.com, owner@thecontinental.et')
  console.log('═══════════════════════════════════════════════════════════\n')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
