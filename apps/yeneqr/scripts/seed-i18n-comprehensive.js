// ============================================================
// Yene QR — Comprehensive i18n Seed Script
// Seeds ALL missing UI string keys with full translations
// in 5 languages: en, am, om, ti, ar
// Groups: kitchen, waiter, staff
// Uses upsert pattern: only creates new keys, and updates
// existing keys with any missing language translations.
// ============================================================

// Load DATABASE_URL from .env first, then .env.production as fallback
require('dotenv').config();
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: '.env.production' });
}
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: '.env.development' });
}
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found in any .env file. Set it explicitly:');
  console.error('  DATABASE_URL="file:./yeneqr.db" node scripts/seed-i18n-comprehensive.js');
  process.exit(1);
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌐 Seeding comprehensive i18n keys...\n');

    const uiStrings = [
      // ══════════════════════════════════════════════════════════
      // ── Kitchen Group (kitchen.*) ──────────────────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'kitchen.title', group: 'kitchen', defaultValue: 'Kitchen Display', translations: { am: 'የምግብ ቤት ማሳያ', om: 'Qishinaa Agarsiisaa', ti: 'ናይ ምግቢ ቤት ምርኣይ', ar: 'شاشة المطبخ' } },
      { key: 'kitchen.all_stations', group: 'kitchen', defaultValue: 'All Stations', translations: { am: 'ሁሉም ጣቢያዎች', om: 'Bakka Hunda', ti: 'ኩሉ ቦታታት', ar: 'جميع المحطات' } },
      { key: 'kitchen.loading', group: 'kitchen', defaultValue: 'Loading kitchen...', translations: { am: 'ምግብ ቤት እየጫነ ነው...', om: 'Qishinaa kenna jira...', ti: 'ምግቢ ቤት እያቕረበ ኣሎ...', ar: 'جاري تحميل المطبخ...' } },
      { key: 'kitchen.no_orders', group: 'kitchen', defaultValue: 'No active kitchen orders', translations: { am: 'ንቁ የምግብ ቤት ትዕዛዞች የሉም', om: 'Ajajileen qishinaa hojii hin jiran', ti: 'ንቁ ናይ ምግቢ ቤት ትዕዛዛት የለን', ar: 'لا توجد طلبات مطبخ نشطة' } },
      { key: 'kitchen.no_station_orders', group: 'kitchen', defaultValue: 'No orders for this station', translations: { am: 'ለዚህ ጣቢያ ትዕዛዞች የሉም', om: 'Bakka kanaaf ajajilee hin jiran', ti: 'ንዚህ ቦታ ትዕዛዛት የለን', ar: 'لا توجد طلبات لهذه المحطة' } },
      { key: 'kitchen.mark_all_ready', group: 'kitchen', defaultValue: 'Mark All Ready', translations: { am: 'ሁሉንም ዝግጁ ምልክት አድርግ', om: "Hunda Qophaa'eera Mallattoo", ti: 'ኩሉ ድሉይ ምልክት ኣድርግ', ar: 'وضع علامة جاهز على الكل' } },
      { key: 'kitchen.start', group: 'kitchen', defaultValue: 'Start', translations: { am: 'ጀምር', om: 'Jalqabi', ti: 'ጀምር', ar: 'ابدأ' } },
      { key: 'kitchen.ready', group: 'kitchen', defaultValue: 'Ready', translations: { am: 'ዝግጁ', om: "Qophaa'eera", ti: 'ድሉይ', ar: 'جاهز' } },
      { key: 'kitchen.picked_up', group: 'kitchen', defaultValue: 'Picked Up', translations: { am: 'ተወስዷል', om: 'Fudhateera', ti: 'ተረክቡ', ar: 'تم الاستلام' } },
      { key: 'kitchen.overdue', group: 'kitchen', defaultValue: 'OVERDUE', translations: { am: 'ዘግይቷል', om: 'Dheessameera', ti: 'ሓሊፉ', ar: 'متأخر' } },
      { key: 'kitchen.slow', group: 'kitchen', defaultValue: 'SLOW', translations: { am: 'ዝግ ነው', om: 'Ariifataa', ti: 'ቀልጢፍ', ar: 'بطيء' } },
      { key: 'kitchen.item', group: 'kitchen', defaultValue: 'item', translations: { am: 'ዕቃ', om: 'Wanta', ti: 'ኣቕሓ', ar: 'عنصر' } },
      { key: 'kitchen.items', group: 'kitchen', defaultValue: 'items', translations: { am: 'ዕቃዎች', om: 'Wantoota', ti: 'ኣቕሓታት', ar: 'عناصر' } },
      { key: 'kitchen.unassigned', group: 'kitchen', defaultValue: 'Unassigned', translations: { am: 'ያልተመደበ', om: 'Ramatamne', ti: 'ዘይተመደበ', ar: 'غير معين' } },
      { key: 'kitchen.cancel_item', group: 'kitchen', defaultValue: 'Cancel Item?', translations: { am: 'ዕቃውን ሰርዝ?', om: 'Wanta Dhiisaa?', ti: 'ኣቕሓ ስርዝ?', ar: 'إلغاء العنصر؟' } },
      { key: 'kitchen.keep_item', group: 'kitchen', defaultValue: 'Keep Item', translations: { am: 'ዕቃውን ያስቀምጡ', om: 'Wanta Eegi', ti: 'ኣቕሓ ሓልይ', ar: 'الاحتفاظ بالعنصر' } },
      { key: 'kitchen.cancel_item_btn', group: 'kitchen', defaultValue: 'Cancel Item', translations: { am: 'ዕቃ ሰርዝ', om: 'Wanta Dhiisi', ti: 'ኣቕሓ ስርዝ', ar: 'إلغاء العنصر' } },
      { key: 'kitchen.sound_on', group: 'kitchen', defaultValue: 'Sound On', translations: { am: 'ድምፅ አብራ', om: 'Sagalee Banaa', ti: 'ድምፂ ኣብር', ar: 'الصوت قيد التشغيل' } },
      { key: 'kitchen.sound_off', group: 'kitchen', defaultValue: 'Sound Off', translations: { am: 'ድምፅ አጥፋ', om: 'Sagalee Dhufti', ti: 'ድምፂ ኣፍርዝ', ar: 'الصوت مغلق' } },
      { key: 'kitchen.shortcuts', group: 'kitchen', defaultValue: 'Shortcuts', translations: { am: 'አቋራጮች', om: 'Arsitii', ti: 'ቅልጡፋት', ar: 'اختصارات' } },
      { key: 'kitchen.live', group: 'kitchen', defaultValue: 'Live', translations: { am: 'ቀጥታ', om: 'Kallattii', ti: 'ቀጥታ', ar: 'مباشر' } },
      { key: 'kitchen.polling', group: 'kitchen', defaultValue: 'Polling', translations: { am: 'ፍለጋ', om: 'Gaafachaa', ti: 'ምርካብ', ar: 'استطلاع' } },
      { key: 'kitchen.pending_count', group: 'kitchen', defaultValue: 'Pending', translations: { am: 'በመጠባበቅ ላይ', om: 'Eegaa', ti: 'ኣብ መጠቕለሊ', ar: 'معلق' } },
      { key: 'kitchen.preparing_count', group: 'kitchen', defaultValue: 'Preparing', translations: { am: 'እያዘጋጀ', om: "Qophaa'aa", ti: 'እያዘጋጀ', ar: 'قيد التحضير' } },
      { key: 'kitchen.ready_count', group: 'kitchen', defaultValue: 'Ready', translations: { am: 'ዝግጁ', om: "Qophaa'eera", ti: 'ድሉይ', ar: 'جاهز' } },

      // ══════════════════════════════════════════════════════════
      // ── Waiter Group (waiter.*) ───────────────────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'waiter.title', group: 'waiter', defaultValue: 'Waiter Dashboard', translations: { am: 'የአገልጋይ ዳሽቦርድ', om: 'Daashboordii Tajaajilaa', ti: 'ናይ ኣገልጋይ ዳሽቦርድ', ar: 'لوحة النادل' } },
      { key: 'waiter.in_progress', group: 'waiter', defaultValue: 'In Progress', translations: { am: 'በሂደት ላይ', om: 'Hojii Ijoo', ti: 'ኣብ ሂደት', ar: 'قيد التنفيذ' } },
      { key: 'waiter.ready_for_pickup', group: 'waiter', defaultValue: 'Ready for Pickup', translations: { am: 'ለመውሰድ ዝግጁ', om: "Fudhachuuuf Qophaa'eera", ti: 'ንምውሳድ ድሉይ', ar: 'جاهز للاستلام' } },
      { key: 'waiter.on_its_way', group: 'waiter', defaultValue: 'On Its Way', translations: { am: 'በመምጣት ላይ', om: 'Dhufaa jira', ti: 'ኣብ መጺኡ', ar: 'في الطريق' } },
      { key: 'waiter.served', group: 'waiter', defaultValue: 'Served', translations: { am: 'የቀረበ', om: 'Dhiyaateera', ti: 'ቀሪቡ', ar: 'تم التقديم' } },
      { key: 'waiter.table_calls', group: 'waiter', defaultValue: 'Table Calls', translations: { am: 'የጠረጴዛ ጥሪዎች', om: 'Waamicha Meechaalee', ti: 'ናይ ጠረጴዛ ምጽዋዓት', ar: 'نداءات الطاولة' } },
      { key: 'waiter.pick_up_deliver', group: 'waiter', defaultValue: 'Pick Up & Deliver', translations: { am: 'ይውሰዱ እና ያቅርቡ', om: 'Fudhaa fi Dhiyaadhaa', ti: 'ሓዝን ኣቕርብን', ar: 'استلم وقدّم' } },
      { key: 'waiter.mark_delivered', group: 'waiter', defaultValue: 'Mark Delivered', translations: { am: 'የቀረበ ምልክት አድርግ', om: 'Dhiyaateera Mallattoo', ti: 'ቀሪቡ ምልክት ኣድርግ', ar: 'وضع علامة تم التسليم' } },
      { key: 'waiter.call_waiter', group: 'waiter', defaultValue: 'Call Waiter', translations: { am: 'አገልጋዩን ይጥሩ', om: 'Tajaajilaa Waami', ti: 'ኣገልጋይ ጠሓስ', ar: 'استدعاء النادل' } },
      { key: 'waiter.request_bill', group: 'waiter', defaultValue: 'Request Bill', translations: { am: 'ሂሳብ ይጠይቁ', om: 'Waadaa Gaafadhu', ti: 'ሂሳብ ሓትው', ar: 'طلب الفاتورة' } },
      { key: 'waiter.request_menu', group: 'waiter', defaultValue: 'Request Menu', translations: { am: 'ምናዝ ይጠይቁ', om: 'Makala Gaafadhu', ti: 'ሜኑ ሓትው', ar: 'طلب القائمة' } },
      { key: 'waiter.custom_request', group: 'waiter', defaultValue: 'Custom Request', translations: { am: 'ብጁ ጥያቄ', om: 'Gaaffii Addaa', ti: 'ብጁ ሕቶ', ar: 'طلب مخصص' } },
      { key: 'waiter.on_my_way', group: 'waiter', defaultValue: 'On My Way', translations: { am: 'መጥቻለሁ', om: 'Ani Dhufaa jira', ti: 'ኣብ መጺአ', ar: 'في طريقي' } },
      { key: 'waiter.resolved', group: 'waiter', defaultValue: 'Resolved', translations: { am: 'ተፈትቷል', om: "Milkaa'eera", ti: 'ተፈቲሑ', ar: 'تم الحل' } },
      { key: 'waiter.done', group: 'waiter', defaultValue: 'Done', translations: { am: 'ተከናወነ', om: 'Xumurameera', ti: 'ተዛዚሙ', ar: 'تم' } },
      { key: 'waiter.loading', group: 'waiter', defaultValue: 'Loading waiter dashboard...', translations: { am: 'የአገልጋይ ዳሽቦርድ እየጫነ ነው...', om: 'Daashboordii tajaajilaa kenna jira...', ti: 'ናይ ኣገልጋይ ዳሽቦርድ እያቕረበ ኣሎ...', ar: 'جاري تحميل لوحة النادل...' } },
      { key: 'waiter.live', group: 'waiter', defaultValue: 'Live', translations: { am: 'ቀጥታ', om: 'Kallattii', ti: 'ቀጥታ', ar: 'مباشر' } },
      { key: 'waiter.polling', group: 'waiter', defaultValue: 'Polling', translations: { am: 'ፍለጋ', om: 'Gaafachaa', ti: 'ምርካብ', ar: 'استطلاع' } },
      { key: 'waiter.sound_on', group: 'waiter', defaultValue: 'Sound On', translations: { am: 'ድምፅ አብራ', om: 'Sagalee Banaa', ti: 'ድምፂ ኣብር', ar: 'الصوت قيد التشغيل' } },
      { key: 'waiter.sound_off', group: 'waiter', defaultValue: 'Sound Off', translations: { am: 'ድምፅ አጥፋ', om: 'Sagalee Dhufti', ti: 'ድምፂ ኣፍርዝ', ar: 'الصوت مغلق' } },
      { key: 'waiter.calls_pending', group: 'waiter', defaultValue: 'Calls Pending', translations: { am: 'ጥሪዎች በመጠባበቅ ላይ', om: 'Waamichaan Eegaa', ti: 'ምጽዋዓት ኣብ መጠቕለሊ', ar: 'نداءات معلقة' } },
      { key: 'waiter.acknowledged', group: 'waiter', defaultValue: 'Acknowledged', translations: { am: 'ተቀብሏል', om: 'Beekameera', ti: 'ተቐቢሉ', ar: 'تم الإقرار' } },
      { key: 'waiter.no_ready_orders', group: 'waiter', defaultValue: 'No orders ready for pickup', translations: { am: 'ለመውሰድ ዝግጁ ትዕዛዞች የሉም', om: "Fudhachuuuf qophaa'eera ajajilee hin jiran", ti: 'ንምውሳድ ድሉይ ትዕዛዛት የለን', ar: 'لا توجد طلبات جاهزة للاستلام' } },
      { key: 'waiter.no_calls', group: 'waiter', defaultValue: 'No active table calls', translations: { am: 'ንቁ የጠረጴዛ ጥሪዎች የሉም', om: 'Waamichaan meechaalee hojii hin jiran', ti: 'ንቁ ናይ ጠረጴዛ ምጽዋዓት የለን', ar: 'لا توجد نداءات طاولة نشطة' } },
      { key: 'waiter.your_tables', group: 'waiter', defaultValue: 'Your tables: {n} assigned', translations: { am: 'የእርስዎ ጠረጴዛዎች: {n} ተመድበዋል', om: 'Meechaalee keessan: {n} ramatamaniiru', ti: 'ጠረጴዛታትኩም: {n} ተመድቡ', ar: 'طاولاتك: {n} مخصصة' } },
      { key: 'waiter.all_tables', group: 'waiter', defaultValue: 'All tables (no assignments set up)', translations: { am: 'ሁሉም ጠረጴዛዎች (ምደባ አልተሰራም)', om: 'Meechaalee hunda (ramaddii hin jiru)', ti: 'ኩሉ ጠረጴዛታት (ምደባ ዘይተሰራኸ)', ar: 'جميع الطاولات (لم يتم إعداد التعيينات)' } },
      { key: 'waiter.ready_sound_hint', group: 'waiter', defaultValue: "You'll hear a sound when an order is ready", translations: { am: 'ትዕዛዝ ሲዘጋዝ ድምፅ ይሰማዎታል', om: "Ajajaan yoo qophaa'e sagaleen isin dhaga'ama", ti: 'ትዕዛዝ ምስ ድሉይ ድምፂ ክሰምዓኩም እዩ', ar: 'ستسمع صوتًا عندما يكون الطلب جاهزًا' } },

      // ══════════════════════════════════════════════════════════
      // ── Staff / Permission Group (staff.*) ────────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'staff.title', group: 'staff', defaultValue: 'Staff Management', translations: { am: 'የሰራተኛ አስተዳደር', om: 'Bulchiinsa Hojettootaa', ti: 'ናይ ሰራተኛ ምምሕዳር', ar: 'إدارة الموظفين' } },
      { key: 'staff.add_staff', group: 'staff', defaultValue: 'Add Staff', translations: { am: 'ሰራተኛ ያክሉ', om: 'Hojjetaa Dabali', ti: 'ሰራተኛ ወስኽ', ar: 'إضافة موظف' } },
      { key: 'staff.role', group: 'staff', defaultValue: 'Role', translations: { am: 'ሚና', om: 'Gahee', ti: 'ሓላፍነት', ar: 'الدور' } },
      { key: 'staff.permissions', group: 'staff', defaultValue: 'Permissions', translations: { am: 'ፈቃዶች', om: 'Seensa', ti: 'ፍቕዲታት', ar: 'الأذونات' } },
      { key: 'staff.additional_permissions', group: 'staff', defaultValue: 'Additional Permissions', translations: { am: 'ተጨማሪ ፈቃዶች', om: 'Seensa Dabalataa', ti: 'ተወሳኺ ፍቕዲታት', ar: 'أذونات إضافية' } },
      { key: 'staff.revoked_permissions', group: 'staff', defaultValue: 'Revoked Permissions', translations: { am: 'የተሰረዙ ፈቃዶች', om: 'Seensa Haafame', ti: 'ዝተሰረዙ ፍቕዲታት', ar: 'أذونات ملغاة' } },
      { key: 'staff.role_permissions', group: 'staff', defaultValue: 'Role Default Permissions', translations: { am: 'የሚና ነባሪ ፈቃዶች', om: 'Seensa Durtii Gahee', ti: 'ናይ ሓላፍነት ብሔራዊ ፍቕዲታት', ar: 'أذونات الدور الافتراضية' } },
      { key: 'staff.effective_permissions', group: 'staff', defaultValue: 'Effective Permissions', translations: { am: 'ውጤታማ ፈቃዶች', om: 'Seensa Hojii', ti: 'ውጽኢታዊ ፍቕዲታት', ar: 'الأذونات الفعالة' } },
      { key: 'staff.save_permissions', group: 'staff', defaultValue: 'Save Permissions', translations: { am: 'ፈቃዶች ያስቀምጡ', om: "Seensa Qindaa'i", ti: 'ፍቕዲታት ኣስቐምጽ', ar: 'حفظ الأذونات' } },
    ];

    let count = 0;
    for (const str of uiStrings) {
      const existing = await prisma.uIString.findUnique({ where: { key: str.key } });
      if (!existing) {
        await prisma.uIString.create({
          data: {
            key: str.key,
            group: str.group,
            defaultValue: str.defaultValue,
            translations: str.translations ? JSON.stringify(str.translations) : null,
          },
        });
        count++;
        console.log(`  ✅ Created: ${str.key}`);
      } else {
        // Update with any new translations that might be missing
        const existingTranslations = existing.translations ? (typeof existing.translations === 'string' ? JSON.parse(existing.translations) : existing.translations) : {};
        const newTranslations = str.translations || {};
        let updated = false;
        for (const [lang, value] of Object.entries(newTranslations)) {
          if (!existingTranslations[lang]) {
            existingTranslations[lang] = value;
            updated = true;
          }
        }
        if (updated) {
          await prisma.uIString.update({
            where: { key: str.key },
            data: { translations: JSON.stringify(existingTranslations) }
          });
          count++;
          console.log(`  🔄 Updated: ${str.key}`);
        } else {
          console.log(`  ⏭️  Skipped (exists): ${str.key}`);
        }
      }
    }

    console.log(`\n✨ Seeded/updated ${count} UI strings out of ${uiStrings.length} total.`);
    console.log(`   (${uiStrings.length - count} already up-to-date)\n`);
  } catch (error) {
    console.error('Error seeding i18n data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
