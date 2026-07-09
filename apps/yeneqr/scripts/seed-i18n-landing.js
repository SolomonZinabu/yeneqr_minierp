// ============================================================
// Yene QR — Landing Page, Auth, Restaurant & Welcome i18n Seed
// Seeds ALL landing, auth, restaurant, welcome UI string keys
// with complete translations in 5 languages: en, am, om, ti, ar
// Uses upsert pattern: creates new keys, fills missing translations
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
  console.error('  DATABASE_URL="file:./yeneqr.db" node scripts/seed-i18n-landing.js');
  process.exit(1);
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌐 Seeding LANDING/AUTH/RESTAURANT/WELCOME i18n keys (all 5 languages)...\n');

    const uiStrings = [
      // ══════════════════════════════════════════════════════════
      // ── Landing Navigation (landing.nav.*) ────────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'landing.nav.restaurant_login', group: 'landing', defaultValue: 'Restaurant Login', translations: { am: 'የምግብ ቤት መግቢያ', om: 'Seensa Makalaa', ti: 'ናይ ምግቢ ቤት እቶ', ar: 'تسجيل دخول المطعم' } },
      { key: 'landing.nav.login', group: 'landing', defaultValue: 'Login', translations: { am: 'ግባ', om: 'Seeni', ti: 'እቶ', ar: 'تسجيل الدخول' } },
      { key: 'landing.nav.admin', group: 'landing', defaultValue: 'Admin', translations: { am: 'አስተዳዳሪ', om: 'Bulcha', ti: 'መሪ', ar: 'المسؤول' } },
      { key: 'landing.nav.get_started', group: 'landing', defaultValue: 'Get Started', translations: { am: 'ጀምር', om: 'Jalqabi', ti: 'ጀምር', ar: 'ابدأ' } },

      // ══════════════════════════════════════════════════════════
      // ── Landing Hero (landing.hero.*) ─────────────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'landing.hero.badge', group: 'landing', defaultValue: "Ethiopia's #1 QR Restaurant Platform", translations: { am: 'በኢትዮጵያ #1 QR የምግብ ቤት መድረክ', om: "Paletfaarmii QR Makalaa Itoophiyaa #1", ti: 'ናይ ኢትዮጵያ #1 QR ምግቢ ቤት መድረኽ', ar: 'منصة المطاعم QR رقم 1 في إثيوبيا' } },
      { key: 'landing.hero.title_scan', group: 'landing', defaultValue: 'Scan.', translations: { am: 'ይቃኙ.', om: 'Sagalee.', ti: 'ቃንሽ.', ar: 'امسح.' } },
      { key: 'landing.hero.title_order', group: 'landing', defaultValue: 'Order.', translations: { am: 'ይዘዙ.', om: 'Ajajaa.', ti: 'ትዕዛዝ.', ar: 'اطلب.' } },
      { key: 'landing.hero.title_enjoy', group: 'landing', defaultValue: 'Enjoy.', translations: { am: 'ይደሰቱ.', om: 'Gammadhu.', ti: 'ጽዒን.', ar: 'استمتع.' } },
      { key: 'landing.hero.description', group: 'landing', defaultValue: 'Transform your restaurant with QR-powered digital menus, seamless ordering, kitchen management, and Ethiopian payment integrations. Built for restaurants that want to deliver exceptional dining experiences.', translations: { am: 'ምግብ ቤትዎን በQR የሚሰራ ዲጂታል ምናዝ፣ ለስላሳ ትዕዛዝ፣ የምግብ ቤት አስተዳደር እና የኢትዮጵያ ክፍያ መዋሃዣዎች ይቀይሩ። ልዩ የአገልግሎት ልምድ ለማቅረብ ለሚፈልጉ ምግብ ቤቶች የተሰራ።', om: 'Makala keessanii fuula diijitaalaa hojii QRn, ajajaa sagalee, bulchiinsa qishinaa fi kaffaltii Itoophiyaa waliin jijjiiraa. Teejjii nyataa ol aanoo dhiyeessuu barbaaduufi hojjetameera.', ti: 'ምግቢ ቤትኩም ብቐጽታ QR ዝሰርሕ ዲጂታል ሜኑ፣ ቀልጢፍ ትዕዛዝ፣ ናይ ምግቢ ቤት ምምሕዳርን ናይ ኢትዮጵያ ክፍያ ምትእስሳልን ቀይሩ። ብልዑል ኣገልግሎት ልምዲ ንምቅራብ ዝደሊ ምግቢ ቤታት ዝተሰርሐ።', ar: 'حوّل مطعمك مع القوائم الرقمية المعززة بتقنية QR، والطلبات السلسة، وإدارة المطبخ، وتكامل المدفوعات الإثيوبية. مصمم للمطاعم التي تريد تقديم تجارب طعام استثنائية.' } },
      { key: 'landing.hero.free_trial', group: 'landing', defaultValue: '14-day free trial', translations: { am: '14-ቀን ነፃ ሙከራ', om: 'Yaalii qabamtaa guyyaa 14', ti: '14-መዓልቲ ነፃ ፈተና', ar: 'تجربة مجانية 14 يومًا' } },
      { key: 'landing.hero.no_card', group: 'landing', defaultValue: 'No credit card required', translations: { am: 'የክሬዲት ካርድ አያስፈልግም', om: 'Kaardii liqaa hin barbaachisu', ti: 'ናይ ክሬዲት ካርድ ኣየድልዮን', ar: 'لا حاجة لبطاقة ائتمان' } },
      { key: 'landing.hero.multilingual', group: 'landing', defaultValue: '13 languages supported', translations: { am: '13 ቋንቋዎች ይደገፋሉ', om: 'Afaalonni 13 ni deeggaramanu', ti: '13 ቋንቋታት ይድገፉ', ar: '13 لغة مدعومة' } },

      // ══════════════════════════════════════════════════════════
      // ── Landing Demo (landing.demo.*) ─────────────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'landing.demo.table_guests', group: 'landing', defaultValue: 'Table {number} · {count} guests', translations: { am: 'ጠረጴዛ {number} · {count} እንግዶች', om: 'Meecha {number} · {count} martii', ti: 'ጠረጴዛ {number} · {count} ሰባት', ar: 'طاولة {number} · {count} ضيوف' } },
      { key: 'landing.demo.total', group: 'landing', defaultValue: 'Total', translations: { am: 'ጠቅላላ', om: 'Walumaagalatti', ti: 'ጠቓል', ar: 'الإجمالي' } },
      { key: 'landing.demo.pay_telebirr', group: 'landing', defaultValue: 'Pay with Telebirr', translations: { am: 'በቴሌብር ይክፈሉ', om: 'Telebirriin Kaffalaa', ti: 'ብቴሌብር ክፍለሉ', ar: 'ادفع عبر تليبير' } },

      // ══════════════════════════════════════════════════════════
      // ── Landing Entry Points (landing.entry_points.*) ─────────
      // ══════════════════════════════════════════════════════════
      { key: 'landing.entry_points.title', group: 'landing', defaultValue: 'How Would You Like to Get Started?', translations: { am: 'እንዴት ልጀምሩ ይፈልጋሉ?', om: 'Akkamitti Jalqabuu Barbaadda?', ti: 'ብኸመይ ክጀምሩ ትደሊዩ?', ar: 'كيف تود أن تبدأ؟' } },
      { key: 'landing.entry_points.subtitle', group: 'landing', defaultValue: "Whether you manage restaurants, serve customers, or oversee the platform — we've got you covered.", translations: { am: 'ምግብ ቤቶችን ብትመሩ፣ ደንበኞችን ብትያገለግሉ፣ ወይም መድረኩን ብትቆጥቡ — እዚህ አለን።', om: "Makala yoo bulchattan, maatii yoo tajaajilattan, ykn paletfaarmii yoo to'attan — nuti isin fudhanna.", ti: 'ምግቢ ቤታት እንተመርኩም፣ ደላላታት እንተኣገልግሎምኩም፣ ወይ መድረኽ እንተቆጻጸርኩም — ሓደ ኣለና።', ar: 'سواء كنت تدير مطاعم، أو تخدم عملاء، أو تشرف على المنصة — نحن هنا من أجلك.' } },
      { key: 'landing.entry_points.restaurant_title', group: 'landing', defaultValue: 'Restaurant Owner', translations: { am: 'የምግብ ቤት ባለቤት', om: 'Abbaa Mooi Makalaa', ti: 'ናይ ምግቢ ቤት ባለቤት', ar: 'صاحب المطعم' } },
      { key: 'landing.entry_points.restaurant_desc', group: 'landing', defaultValue: 'Register your restaurant, create menus, generate QR codes, manage orders, and track analytics from your dashboard.', translations: { am: 'ምግብ ቤትዎን ያስገቡ፣ ምናዛት ይፍጠሩ፣ QR ኮዶችን ያመንጩ፣ ትዕዛዞችን ያስተዳድሩ እና ትንተና ከዳሽቦርድዎ ይከታተሉ።', om: 'Makala keessan galmeessaa, makala uumaa, koodii QR hojjeessaa, ajajilee bulchaa fi qorannoo daashboordii keessaniin hordoffaa.', ti: 'ምግቢ ቤትኩም ኣእቱ፣ ሜኑታት ፍጠሩ፣ QR ኮዳት ኣፍሪቑ፣ ትዕዛዛት ኣስተዳድሩን ትንተና ኻብ ዳሽቦርድኩም ተኸታተሉን።', ar: 'سجّل مطعمك، أنشئ القوائم، أنشئ رموز QR، أدِر الطلبات، وتتبع التحليلات من لوحة التحكم الخاصة بك.' } },
      { key: 'landing.entry_points.restaurant_cta', group: 'landing', defaultValue: 'Register Your Restaurant', translations: { am: 'ምግብ ቤትዎን ያስገቡ', om: 'Makala Keessan Galmeessaa', ti: 'ምግቢ ቤትኩም ኣእቱ', ar: 'سجّل مطعمك' } },
      { key: 'landing.entry_points.restaurant_existing', group: 'landing', defaultValue: 'Already registered?', translations: { am: 'ቀድሞውኑ ተመዝግቧል?', om: 'Dursa galmeessameeraa?', ti: 'ቀዳማይ ተመዝጊቡ ኣሎ?', ar: 'مسجّل بالفعل؟' } },
      { key: 'landing.entry_points.login_here', group: 'landing', defaultValue: 'Log in here', translations: { am: 'እዚህ ይግቡ', om: 'Asitti Seeni', ti: 'ኣብዚ እቶ', ar: 'سجّل الدخول هنا' } },
      { key: 'landing.entry_points.admin_title', group: 'landing', defaultValue: 'Platform Admin', translations: { am: 'የመድረክ አስተዳዳሪ', om: 'Bulcha Paletfaarmii', ti: 'ናይ መድረኽ መሪ', ar: 'مسؤول المنصة' } },
      { key: 'landing.entry_points.admin_desc', group: 'landing', defaultValue: 'Manage all restaurants, subscriptions, feature flags, support tickets, and platform-wide analytics from the admin panel.', translations: { am: 'ሁሉንም ምግብ ቤቶች፣ የድጋፍ እቅዶች፣ ባህሪ ባንዲራዎች፣ የድጋፍ ትኬቶች እና የመድረክ አጠቃላይ ትንተና ከአስተዳዳሪ ፓነሉ ያስተዳድሩ።', om: 'Makala hunda, waliigaltee, mallattoo amaloota, tikeetii deeggarsaa fi qorannoo paletfaarmii guutuu panaala bulchaatin bulchaa.', ti: 'ኩሉ ምግቢ ቤታት፣ ምዝገባታት፣ ባህሪ ባንዲራታት፣ ናይ ድጋፍ ትኬታትን ናይ መድረኽ ሓፈሻዊ ትንተናን ኻብ ሜና መሪ ኣስተዳድሩ።', ar: 'أدِر جميع المطاعم، والاشتراكات، وعلامات الميزات، وتذاكر الدعم، وتحليلات المنصة بالكامل من لوحة المسؤول.' } },
      { key: 'landing.entry_points.admin_cta', group: 'landing', defaultValue: 'Admin Login', translations: { am: 'አስተዳዳሪ መግቢያ', om: 'Seensa Bulchaa', ti: 'ናይ መሪ እቶ', ar: 'تسجيل دخول المسؤول' } },
      { key: 'landing.entry_points.admin_note', group: 'landing', defaultValue: 'Super admin & support staff only', translations: { am: 'ሱፐር አስተዳዳሪ እና የድጋፍ ሰራተኞች ብቻ', om: 'Bulcha ol aanaa fi hojjettoota deeggarsaa qofa', ti: 'ሱፐር መሪን ናይ ድጋፍ ሰራተኛታትን ጥራይ', ar: 'المسؤولون الرئيسيون وموظفو الدعم فقط' } },

      // ══════════════════════════════════════════════════════════
      // ── Landing Features (landing.features.*) ─────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'landing.features.title', group: 'landing', defaultValue: 'Everything Your Restaurant Needs', translations: { am: 'ምግብ ቤትዎ የሚፈልገው ሁሉም ነገር', om: 'Wanti Makala Keessan Barbaachisu Hunda', ti: 'ኩሉ ናይ ምግቢ ቤትኩም ዝደሊ', ar: 'كل ما يحتاجه مطعمك' } },
      { key: 'landing.features.description', group: 'landing', defaultValue: 'From QR code generation to kitchen management, Yene QR covers every aspect of modern restaurant operations.', translations: { am: 'ከQR ኮድ ማመንጫ እስከ የምግብ ቤት አስተዳደር፣ Yene QR ዘመናዊ የምግብ ቤት ኦፕሬሽን እያንዳንዱን ገጽ ይሸፍናል።', om: 'Irraa koodii QR hojjeessuu gara bulchiinsa qishinaatti, Yene QR qabiyyee hojii makalaa haaraa hunda ni qabata.', ti: 'ኻብ QR ኮድ ምፍራቕ ክሳብ ናይ ምግቢ ቤት ምምሕዳር፣ Yene QR ሓድሽ ናይ ምግቢ ቤት ስራሕ ኩሉ ገጽ ይሸፍን።', ar: 'من إنشاء رموز QR إلى إدارة المطبخ، يغطي Yene QR كل جانب من جوانب عمليات المطعم الحديثة.' } },

      // ══════════════════════════════════════════════════════════
      // ── Landing Individual Features (landing.feature.*) ───────
      // ══════════════════════════════════════════════════════════
      { key: 'landing.feature.qr_ordering.title', group: 'landing', defaultValue: 'QR-Powered Ordering', translations: { am: 'በQR የሚሰራ ትዕዛዝ', om: 'Ajajaa Hojii QRn', ti: 'ብQR ዝሰርሕ ትዕዛዝ', ar: 'طلبات مدعومة بتقنية QR' } },
      { key: 'landing.feature.qr_ordering.desc', group: 'landing', defaultValue: 'Generate unique QR codes per table. Customers scan, browse your menu, and order instantly — no app download needed.', translations: { am: 'ለእያንዳንዱ ጠረጴዛ ልዩ QR ኮዶችን ያመንጩ። ደንበኞች ያቃኙ፣ ምናዝዎን ያስሱ እና ፈጥነው ይዘዙ — መተግበሪያ ማውረድ አያስፈልግም።', om: 'Koodii QR addaa meechaatiin hojjeessaa. Matiin ni sagalee, makala keessanii ni ilaalu fi ariifatan ajajaa — appii buusuu hin barbaachisu.', ti: 'ንነፍሲ ወከፍ ጠረጴዛ ፍሉይ QR ኮዳት ኣፍሪቑ። ደላላታት ቃኑ፣ ሜኑኩም ደልዩን ቀልጢፍ ትዕዛዝ ሃቡን — ኣፕ ምውራድ ኣየድልዮን።', ar: 'أنشئ رموز QR فريدة لكل طاولة. يمسح العملاء الرمز، ويتصفحون القائمة، ويطلبون فورًا — بدون تحميل تطبيق.' } },
      { key: 'landing.feature.multilingual.title', group: 'landing', defaultValue: 'Multilingual Menus', translations: { am: 'ባለብዙ ቋንቋ ምናዛት', om: 'Makaloota Afaan Duggoo', ti: 'ባለብዙ ቋንቋ ሜኑታት', ar: 'قوائم متعددة اللغات' } },
      { key: 'landing.feature.multilingual.desc', group: 'landing', defaultValue: '13 languages supported with automatic detection. Your customers see the menu in their preferred language automatically.', translations: { am: '13 ቋንቋዎች በራስ-ሰር ማወቂያ ይደገፋሉ። ደንበኞችዎ ምናዙን በምርጫ ቋንቋቸው በራስ-ሰር ያያሉ።', om: 'Afaalonni 13 argannoo ofiin argachuu ni deeggaramu. Matiin keessanii makala afaan filattanii ofiin ni argatu.', ti: '13 ቋንቋታት ብኣውቶማቲክ ምፍላጥ ይድገፉ። ደላላታትኩም ሜኑ ብዝመረጹዎ ቋንቋ ብኣውቶማቲክ ይርእዩ።', ar: '13 لغة مدعومة مع الكشف التلقائي. يرى عملاؤك القائمة بلغتهم المفضلة تلقائيًا.' } },
      { key: 'landing.feature.kitchen.title', group: 'landing', defaultValue: 'Kitchen Display System', translations: { am: 'የምግብ ቤት ማሳያ ስርዓት', om: 'Sirna Agarsiisaa Qishinaa', ti: 'ናይ ምግቢ ቤት ምርኣይ ስርዓት', ar: 'نظام شاشة المطبخ' } },
      { key: 'landing.feature.kitchen.desc', group: 'landing', defaultValue: 'Real-time kitchen display with station filtering, preparation timers, and automatic order routing to the right station.', translations: { am: 'የቀጥታ ምግብ ቤት ማሳያ ከጣቢያ ማጣሪያ፣ የማዘጋጀት ሰዓታት እና ትዕዛዝን ወደትክክለኛው ጣቢያ በራስ-ሰር መላኪያ ጋር።', om: "Agarsiisaa qishinaa sa'aatii dhugaa qabuu, filannoo bakka, sa'aatii qophaaʼuu fi tamsaasa ajajaa bakka sirriitti ofiin erguu.", ti: 'ናይ ቀጥታ ምግቢ ቤት ምርኣይ ምስ ቦታ ምጽላል፣ ናይ ምድላው ሰዓታትን ትዕዛዝ ናብ ቅኑዕ ቦታ ኣውቶማቲክ ምስፍሕፍሕን።', ar: 'شاشة مطبخ مباشرة مع تصفية المحطات، ومؤقتات التحضير، وتوجيه الطلبات تلقائيًا إلى المحطة الصحيحة.' } },
      { key: 'landing.feature.payments.title', group: 'landing', defaultValue: 'Ethiopian Payments', translations: { am: 'የኢትዮጵያ ክፍያዎች', om: 'Kaffaltii Itoophiyaa', ti: 'ናይ ኢትዮጵያ ክፍያታት', ar: 'مدفوعات إثيوبية' } },
      { key: 'landing.feature.payments.desc', group: 'landing', defaultValue: 'Accept Telebirr, Chapa, CBE Birr, and cash. Provider-agnostic architecture means adding new payment methods is seamless.', translations: { am: 'ቴሌብር፣ ቻፓ፣ CBE ብር እና ጥሬ ገንዘብ ይቀበሉ። የአቅራቢ-ፈታዊ አርክቴክቸር አዲስ የክፍያ ዘዴዎችን ለመጨመር ያስቻላል።', om: 'Telebirr, Chapa, CBE Birr fi maallaqa dhugaa qabattanii. Caasaa kennituu hin taane kanaanis qabiyyee kaffaltii haaraa dabaluu sagalee ta\'a.', ti: 'ቴሌብር፣ ቻፓ፣ CBE ብርን ጥሬ ገንዘብን ቐበሉ። ናይ ኣቅራቢ-ፈታዊ ኣርኪቴክቸር ሓድሽ ናይ ክፍያ መንገድታት ምውሳኽ ዝስለል ይገብር።', ar: 'اقبل تليبير، وتشابا، وCBE بير، والنقد. البنية المعمارية المحايدة تعني أن إضافة طرق دفع جديدة تتم بسلاسة.' } },
      { key: 'landing.feature.analytics.title', group: 'landing', defaultValue: 'Smart Analytics', translations: { am: 'ስልታዊ ትንተና', om: 'Qorannoo Ogeettii', ti: 'ስልታዊ ትንተና', ar: 'تحليلات ذكية' } },
      { key: 'landing.feature.analytics.desc', group: 'landing', defaultValue: 'Track sales, popular items, peak hours, table turnover, and average order value. Make data-driven decisions for your restaurant.', translations: { am: 'ሽያጮች፣ ታዋቂ ዕቃዎች፣ የከፍተኛ ሰዓታት፣ የጠረጴዛ ለውጥ እና አማካይ የትዕዛዝ ዋጋ ይከታተሉ። ለምግብ ቤትዎ በውሂብ የሚመራ ውሳኔ ያድርጉ።', om: 'Gurgurtaa, wantoota beekamoo, sa\'aatii guddaa, jijjiirama meechaa fi gatii ajajaa giddugala hordoffaa. Murtoon daataa qaamessaa makala keessaniif godhaa.', ti: 'ሽያጻት፣ ፍሉያት ኣቕሓታት፣ ናይ ለይቲ ሰዓታት፣ ናይ ጠረጴዛ ለውጢን ማእከላይ ናይ ትዕዛዝ ዋጋን ተኸታተሉ። ንምግቢ ቤትኩም ብዳታ ዝምራጽ ውሳኔ ግበሩ።', ar: 'تتبع المبيعات، والعناصر الشائعة، وساعات الذروة، ودوران الطاولات، ومتوسط قيمة الطلب. اتخذ قرارات مبنية على البيانات لمطعمك.' } },
      { key: 'landing.feature.engagement.title', group: 'landing', defaultValue: 'Customer Engagement', translations: { am: 'የደንበኛ ተሳትፎ', om: 'Hirmaanna Maatii', ti: 'ናይ ደላላ ተሳትፎ', ar: 'مشاركة العملاء' } },
      { key: 'landing.feature.engagement.desc', group: 'landing', defaultValue: 'Loyalty points, promotions, happy hour deals, and post-order feedback. Keep your customers coming back.', translations: { am: 'የታማኝነት ነጥቦች፣ ማስተዋወቂያዎች፣ የደስታ ሰዓት ውልቆች እና ከትዕዛዝ በኋላ ግብረ መልስ። ደንበኞችዎ እንደገና እንዲመጡ ያድርጉ።', om: 'Qabxii amanamummaa, morksaa, mooshannaa sa\'aatii gammachuu fi yaada ajajaa booda. Matiin keessanii deebi\'uu ni danda\'u.', ti: 'ናይ ታማኝነት ነጥቢታት፣ ምምሕዳሳት፣ ናይ ሓጎስ ሰዓት ውድባትን ኻብ ትዕዛዝ ድሕሪኡ ርእይቶን። ደላላታትኩም ክመጹ ኣድርጉ።', ar: 'نقاط الولاء، والعروض الترويجية، وعروض السعادة، والتعليقات بعد الطلب. اجعل عملاءك يعودون مرة أخرى.' } },

      // ══════════════════════════════════════════════════════════
      // ── Landing Pricing (landing.pricing.*) ───────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'landing.pricing.title', group: 'landing', defaultValue: 'Simple, Transparent Pricing', translations: { am: 'ቀላል፣ ግልፅ የዋጋ አቀማመጥ', om: 'Gatii Salphaa, Ifaa', ti: 'ቐሊል፣ ግልጽ ናይ ዋጋ ምቕራጽ', ar: 'تسعير بسيط وشفاف' } },
      { key: 'landing.pricing.subtitle', group: 'landing', defaultValue: 'Start free. Upgrade when you\'re ready.', translations: { am: 'ነፃ ይጀምሩ። ዝግጁ ሲሆኑ ያሻሽሉ።', om: 'Qabamtaatin jalqabaa. Yoo qophaattan ol kaa\'aa.', ti: 'ነፃ ጀምሩ። ምስ ድሉይ ኣሻሽሉ።', ar: 'ابدأ مجانًا. قم بالترقية عندما تكون مستعدًا.' } },
      { key: 'landing.pricing.most_popular', group: 'landing', defaultValue: 'Most Popular', translations: { am: 'በጣም ታዋቂ', om: 'Baay\'ee Beekamaa', ti: 'ብዙሕ ፍሉይ', ar: 'الأكثر شعبية' } },
      { key: 'landing.pricing.free', group: 'landing', defaultValue: 'Free', translations: { am: 'ነፃ', om: 'Qabamtaa', ti: 'ነፃ', ar: 'مجاني' } },
      { key: 'landing.pricing.per_month', group: 'landing', defaultValue: 'ETB/mo', translations: { am: 'ብር/ወር', om: 'ETB/ji\'a', ti: 'ብር/ወርሒ', ar: 'بير/شهر' } },
      { key: 'landing.pricing.basic', group: 'landing', defaultValue: 'Basic', translations: { am: 'መሰረታዊ', om: 'Bu\'uuraa', ti: 'መሰረታዊ', ar: 'أساسي' } },
      { key: 'landing.pricing.basic_desc', group: 'landing', defaultValue: 'Perfect for getting started', translations: { am: 'ለመጀመሪያ ፍፁም', om: 'Jalqabuuf milkaa\'a', ti: 'ንምጀማር ፍፁም', ar: 'مثالي للبداية' } },
      { key: 'landing.pricing.pro', group: 'landing', defaultValue: 'Professional', translations: { am: 'ሙያዊ', om: 'Ogeettii', ti: 'ሙያዊ', ar: 'احترافي' } },
      { key: 'landing.pricing.pro_desc', group: 'landing', defaultValue: 'For growing restaurants', translations: { am: 'ለሚያድጉ ምግብ ቤቶች', om: 'Makala guddatuuf', ti: 'ንዝዓቢ ምግቢ ቤታት', ar: 'للمطاعم النامية' } },
      { key: 'landing.pricing.premium', group: 'landing', defaultValue: 'Premium', translations: { am: 'ፕሪሚየም', om: 'Priimiyem', ti: 'ፕሪሚየም', ar: 'متميز' } },
      { key: 'landing.pricing.premium_desc', group: 'landing', defaultValue: 'For restaurant chains', translations: { am: 'ለምግብ ቤት ሰንሰለቶች', om: 'Caancalaa makalaatiif', ti: 'ንሰንሰለት ምግቢ ቤታት', ar: 'لسلاسل المطاعم' } },
      { key: 'landing.pricing.start_free', group: 'landing', defaultValue: 'Start Free', translations: { am: 'ነፃ ይጀምሩ', om: 'Qabamtaatin Jalqabi', ti: 'ነፃ ጀምር', ar: 'ابدأ مجانًا' } },
      { key: 'landing.pricing.start_trial', group: 'landing', defaultValue: 'Start Trial', translations: { am: 'ሙከራ ይጀምሩ', om: 'Yaalii Jalqabi', ti: 'ፈተና ጀምር', ar: 'ابدأ التجربة' } },
      { key: 'landing.pricing.contact_sales', group: 'landing', defaultValue: 'Contact Sales', translations: { am: 'ሽያጭ ያግኙ', om: 'Gurgurtaan Quunnamuu', ti: 'ሽያጭ ርኸብ', ar: 'اتصل بالمبيعات' } },

      // ══════════════════════════════════════════════════════════
      // ── Landing Dropdown (landing.dropdown.*) ─────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'landing.dropdown.loading', group: 'landing', defaultValue: 'Loading restaurants...', translations: { am: 'ምግብ ቤቶች እየጫኑ ነው...', om: 'Makalileen kenna jiru...', ti: 'ምግቢ ቤታት እያቕረቡ ኣለዉ...', ar: 'جاري تحميل المطاعم...' } },
      { key: 'landing.dropdown.placeholder', group: 'landing', defaultValue: 'Select a restaurant...', translations: { am: 'ምግብ ቤት ይምረጡ...', om: 'Makala Filadhu...', ti: 'ምግቢ ቤት ምረጽ...', ar: 'اختر مطعمًا...' } },
      { key: 'landing.dropdown.no_restaurants', group: 'landing', defaultValue: 'No restaurants available yet.', translations: { am: 'እስካሁን ምግብ ቤቶች የሉም።', om: 'Makalileen amma hin jiran.', ti: 'ምግቢ ቤታት ክሳብ ሕጂ የለን።', ar: 'لا توجد مطاعم متاحة بعد.' } },
      { key: 'landing.dropdown.staff_hint', group: 'landing', defaultValue: 'Select your restaurant to log in to the dashboard.', translations: { am: 'ወደ ዳሽቦርድ ለመግባት ምግብ ቤትዎን ይምረጡ።', om: 'Daashboordii seeniuf makala keessan filadhu.', ti: 'ናብ ዳሽቦርድ ንምእታው ምግቢ ቤትኩም ምረጹ።', ar: 'اختر مطعمك لتسجيل الدخول إلى لوحة التحكم.' } },
      { key: 'landing.dropdown.admin_login', group: 'landing', defaultValue: 'Log in here', translations: { am: 'እዚህ ይግቡ', om: 'Asitti Seeni', ti: 'ኣብዚ እቶ', ar: 'سجّل الدخول هنا' } },

      // ══════════════════════════════════════════════════════════
      // ── Landing UAT (landing.uat.*) ───────────────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'landing.uat.customer_title', group: 'landing', defaultValue: 'Customer Testing (UAT)', translations: { am: 'የደንበኛ ሙከራ (UAT)', om: 'Yaalii Maatii (UAT)', ti: 'ናይ ደላላ ፈተና (UAT)', ar: 'اختبار العميل (UAT)' } },
      { key: 'landing.uat.customer_desc', group: 'landing', defaultValue: 'Simulate the customer experience by scanning QR codes for any restaurant. Test the full ordering flow end-to-end.', translations: { am: 'ለማንኛውም ምግብ ቤት QR ኮዶችን በማቃኘት የደንበኛ ልምዱን ያስመስሉ። ሙሉ የትዕዛዝ ፍሰትን መጨረሻ-መጨረሻ ይሞክሩ።', om: 'Sagalee koodii QR makala kamiifuu ilaalchisee fi qaama maatii akka fakkaattu gochaa. Yaalii ajajaa guutuu dhuma-dhumaatti gochaa.', ti: 'ንዝኾነ ምግቢ ቤት QR ኮዳት ብምቅናስ ናይ ደላላ ልምዲ ኣስመስሉ። ምሉእ ናይ ትዕዛዝ ፍሰት ደርቆ-ደርቆ ፈትኑ።', ar: 'قم بمحاكاة تجربة العميل عن طريق مسح رموز QR لأي مطعم. اختبر تدفق الطلب بالكامل من البداية إلى النهاية.' } },
      { key: 'landing.uat.collapse', group: 'landing', defaultValue: 'Collapse UAT Environment', translations: { am: 'UAT አካባቢ ሰብስብ', om: 'Haala UAT Gadi Qabadhu', ti: 'UAT ስፍሓት ኣሳኽብ', ar: 'طي بيئة الاختبار' } },
      { key: 'landing.uat.expand', group: 'landing', defaultValue: 'Open UAT Environment', translations: { am: 'UAT አካባቢ ክፈት', om: 'Haala UAT Bani', ti: 'UAT ስፍሓት ክፈት', ar: 'فتح بيئة الاختبار' } },

      // ══════════════════════════════════════════════════════════
      // ── Auth Group (auth.*) ───────────────────────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'auth.login', group: 'auth', defaultValue: 'Staff Login', translations: { am: 'የሰራተኛ መግቢያ', om: 'Seensa Hojjettootaa', ti: 'ናይ ሰራተኛ እቶ', ar: 'تسجيل دخول الموظفين' } },
      { key: 'auth.logout', group: 'auth', defaultValue: 'Logout', translations: { am: 'ውጣ', om: 'Ba\'i', ti: 'ውጻእ', ar: 'تسجيل الخروج' } },
      { key: 'auth.sign_in', group: 'auth', defaultValue: 'Sign In', translations: { am: 'ግባ', om: 'Seeni', ti: 'እቶ', ar: 'تسجيل الدخول' } },
      { key: 'auth.welcome_back', group: 'auth', defaultValue: 'Welcome back!', translations: { am: 'እንኳድ ደህና መጡ!', om: 'Baga nagaan dhuftan!', ti: 'እኳዕ ብደሓን መጻእኩም!', ar: 'مرحبًا بعودتك!' } },
      { key: 'auth.invalid_credentials', group: 'auth', defaultValue: 'Invalid email or password', translations: { am: 'ልክ ያልሆነ ኢሜል ወይም የይለፍ ቃል', om: 'Imeelee ykn jecha darbii dogoggoraa', ti: 'ልክ ዘይኮነ ኢመይል ወይ ቃል ሓለዋ', ar: 'بريد إلكتروني أو كلمة مرور غير صالحة' } },
      { key: 'auth.forgot_password', group: 'auth', defaultValue: 'Forgot password?', translations: { am: 'የይለፍ ቃል ረሱ?', om: 'Jecha darbii irraanfattaa?', ti: 'ቃል ሓለዋ ረሲዑዎ?', ar: 'نسيت كلمة المرور؟' } },
      { key: 'auth.enter_password', group: 'auth', defaultValue: 'Enter your password', translations: { am: 'የይለፍ ቃልዎን ያስገቡ', om: 'Jecha darbii keessanii galchaa', ti: 'ቃል ሓለዋኩም ኣእቱ', ar: 'أدخل كلمة المرور الخاصة بك' } },
      { key: 'auth.restaurant_dashboard', group: 'auth', defaultValue: 'Restaurant Dashboard', translations: { am: 'የምግብ ቤት ዳሽቦርድ', om: 'Daashboordii Makalaa', ti: 'ናይ ምግቢ ቤት ዳሽቦርድ', ar: 'لوحة تحكم المطعم' } },
      { key: 'auth.platform_admin', group: 'auth', defaultValue: 'Platform Admin', translations: { am: 'የመድረክ አስተዳዳሪ', om: 'Bulcha Paletfaarmii', ti: 'ናይ መድረኽ መሪ', ar: 'مسؤول المنصة' } },
      { key: 'auth.admin_login', group: 'auth', defaultValue: 'Admin Login', translations: { am: 'አስተዳዳሪ መግቢያ', om: 'Seensa Bulchaa', ti: 'ናይ መሪ እቶ', ar: 'تسجيل دخول المسؤول' } },
      { key: 'auth.restaurant_inactive', group: 'auth', defaultValue: 'This restaurant is currently inactive. Please contact the restaurant owner.', translations: { am: 'ይህ ምግብ ቤት በአሁኑ ጊዜ የለም። እባክዎ የምግብ ቤት ባለቤቱን ያግኙ።', om: 'Makala kun amma socho\'aa hin jiru. Maaloo abbaa mooi makalaa quunnamaa.', ti: 'እዚ ምግቢ ቤት ኣብ ሕጂ ዘይንቁ እዩ። በጃኹም ናይ ምግቢ ቤት ባለቤት ርኸቡ።', ar: 'هذا المطعم غير نشط حاليًا. يرجى التواصل مع صاحب المطعم.' } },
      { key: 'auth.restaurant_suspended', group: 'auth', defaultValue: 'This restaurant has been suspended. Please contact support.', translations: { am: 'ይህ ምግብ ቤት ተቋርጧል። እባክዎ ድጋፍ ያግኙ።', om: 'Makala kun dhaabameera. Maaloo deeggarsaa quunnamaa.', ti: 'እዚ ምግቢ ቤት ተሰሪዙ ኣሎ። በጃኹም ድጋፍ ርኸቡ።', ar: 'تم تعليق هذا المطعم. يرجى التواصل مع الدعم.' } },
      { key: 'auth.restaurant_not_found', group: 'auth', defaultValue: 'Restaurant not found. Please check the link and try again.', translations: { am: 'ምግብ ቤት አልተገኘም። እባክዎ ማገናኛውን ያረጋግጡ እና እንደገና ይሞክሩ።', om: 'Makala hin argamne. Maaloo kallattii mirkaneessaa fi irra deebi\'aa yaalaa.', ti: 'ምግቢ ቤት ኣይተረኽበን። በጃኹም ሊንክ ኣረጋግጹን ኣብ ድጋም ፈትኑን።', ar: 'المطعم غير موجود. يرجى التحقق من الرابط والمحاولة مرة أخرى.' } },
      { key: 'auth.go_to_home', group: 'auth', defaultValue: 'Go to Home', translations: { am: 'ወደ መነሻ ይሂዡ', om: 'Uummamaa Deemi', ti: 'ናብ መበገሲ ኣትዩ', ar: 'الذهاب إلى الصفحة الرئيسية' } },
      { key: 'auth.quick_demo_fill', group: 'auth', defaultValue: 'Quick Demo Fill', translations: { am: 'ፈጣን ሙከራ ሙሌት', om: 'Guutessuu Yaalii Ariifataa', ti: 'ቅልጡፍ ፈተና ምልዓል', ar: 'ملء تجريبي سريع' } },
      { key: 'auth.min_8_chars', group: 'auth', defaultValue: 'Minimum 8 characters', translations: { am: 'ዝበዛ 8 ቁምፊዎች', om: 'Qubeewwan 8 gadii', ti: 'ዝበዛ 8 ፊደላት', ar: '8 أحرف كحد أدنى' } },
      { key: 'auth.password_mismatch', group: 'auth', defaultValue: 'Passwords do not match', translations: { am: 'የይለፍ ቃላት አይዛመዱም', om: 'Jechoota darbii hin walsimsiisu', ti: 'ቃላት ሓለዋ ኣይሰማማዕን', ar: 'كلمات المرور غير متطابقة' } },
      { key: 'auth.password_reset', group: 'auth', defaultValue: 'Password Reset', translations: { am: 'የይለፍ ቃል ዳግም አስጀምር', om: 'Jecha Darbii Haaraa', ti: 'ቃል ሓለዋ ኣድሽ', ar: 'إعادة تعيين كلمة المرور' } },
      { key: 'auth.invalid_link', group: 'auth', defaultValue: 'Invalid Link', translations: { am: 'ልክ ያልሆነ ማገናኛ', om: 'Kallattii Dogoggoraa', ti: 'ልክ ዘይኮነ ሊንክ', ar: 'رابط غير صالح' } },
      { key: 'auth.link_expired', group: 'auth', defaultValue: 'This password reset link has expired or is invalid.', translations: { am: 'ይህ የይለፍ ቃል ዳግም ማስጀመሪያ ማገናኛ ጊዜው አልፎታል ወይም ልክ ያልሆነ ነው።', om: 'Kallattii jecha darbii haaraa kana yeroon dabaleera ykn dogoggoraa ta\'eera.', ti: 'እዚ ናይ ቃል ሓለዋ ምምሃዛ ሊንክ ግዜኡ ሓሊፉ ወይ ልክ ዘይኮነ እዩ።', ar: 'انتهت صلاحية رابط إعادة تعيين كلمة المرور هذا أو أنه غير صالح.' } },
      { key: 'auth.request_new_link', group: 'auth', defaultValue: 'Please request a new one.', translations: { am: 'እባክዎ አዲስ ይጠይቁ።', om: 'Maaloo haaraa gaafadhaa.', ti: 'በጃኹም ሓድሽ ሓትዩ።', ar: 'يرجى طلب رابط جديد.' } },
      { key: 'auth.request_new', group: 'auth', defaultValue: 'Request New Link', translations: { am: 'አዲስ ማገናኛ ይጠይቁ', om: 'Kallattii Haaraa Gaafadhu', ti: 'ሓድሽ ሊንክ ሓትው', ar: 'طلب رابط جديد' } },
      { key: 'auth.back_to_login', group: 'auth', defaultValue: 'Back to Login', translations: { am: 'ወደ መግቢያ ተመለስ', om: 'Gara Seenaa Deebi\'i', ti: 'ናብ እቶ ተመለስ', ar: 'العودة لتسجيل الدخول' } },
      { key: 'auth.reset_your_password', group: 'auth', defaultValue: 'Reset Your Password', translations: { am: 'የይለፍ ቃልዎን ያድስ', om: 'Jecha Darbii Keessanii Haaraa', ti: 'ቃል ሓለዋኩም ኣድሽ', ar: 'إعادة تعيين كلمة المرور الخاصة بك' } },
      { key: 'auth.reset_success', group: 'auth', defaultValue: 'Your password has been reset successfully!', translations: { am: 'የይለፍ ቃልዎ በተሳካ ሁኔታ ዳግም ተጀምሯል!', om: 'Jecha darbii keessanii milkaa\'uun haaraameera!', ti: 'ቃል ሓለዋኩም ብዓወት ተደሊዩ!', ar: 'تم إعادة تعيين كلمة المرور الخاصة بك بنجاح!' } },
      { key: 'auth.enter_new_password', group: 'auth', defaultValue: 'Enter your new password below.', translations: { am: 'አዲስ የይለፍ ቃልዎን ከታች ያስገቡ።', om: 'Jecha darbii haaraa keessanii gadii galchaa.', ti: 'ሓድሽ ቃል ሓለዋኩም ኣብ ታሕቲ ኣእቱ።', ar: 'أدخل كلمة المرور الجديدة أدناه.' } },
      { key: 'auth.sign_in_new_password', group: 'auth', defaultValue: 'Sign in with your new password', translations: { am: 'በአዲስ የይለፍ ቃልዎ ይግቡ', om: 'Jecha darbii haaraa keessaniin seenaa', ti: 'ብሓድሽ ቃል ሓለዋኩም እቶ', ar: 'تسجيل الدخول بكلمة المرور الجديدة' } },
      { key: 'auth.new_password', group: 'auth', defaultValue: 'New Password', translations: { am: 'አዲስ የይለፍ ቃል', om: 'Jecha Darbii Haaraa', ti: 'ሓድሽ ቃል ሓለዋ', ar: 'كلمة المرور الجديدة' } },
      { key: 'auth.confirm_password', group: 'auth', defaultValue: 'Confirm Password', translations: { am: 'የይለፍ ቃል አረጋግጥ', om: 'Jecha Darbii Mirkanaasi', ti: 'ቃል ሓለዋ ኣረጋግጽ', ar: 'تأكيد كلمة المرور' } },
      { key: 'auth.re_enter_password', group: 'auth', defaultValue: 'Re-enter password', translations: { am: 'የይለፍ ቃል እንደገና ያስገቡ', om: 'Jecha darbii irra deebi\'ii galchaa', ti: 'ቃል ሓለዋ ኣብ ድጋም ኣእቱ', ar: 'أعد إدخال كلمة المرور' } },
      { key: 'auth.reset_password', group: 'auth', defaultValue: 'Reset Password', translations: { am: 'የይለፍ ቃል ያድስ', om: 'Jecha Darbii Haaraa', ti: 'ቃል ሓለዋ ኣድሽ', ar: 'إعادة تعيين كلمة المرور' } },
      { key: 'auth.cuisine_type', group: 'auth', defaultValue: 'Cuisine Type', translations: { am: 'የምግብ አይነት', om: 'Gosa Nyaataa', ti: 'ዓይነት ምግቢ', ar: 'نوع المطبخ' } },
      { key: 'auth.phone', group: 'auth', defaultValue: 'Phone', translations: { am: 'ስልክ', om: 'Bilbila', ti: 'ስልኪ', ar: 'الهاتف' } },
      { key: 'auth.email', group: 'auth', defaultValue: 'Email', translations: { am: 'ኢሜል', om: 'Imeelee', ti: 'ኢመይል', ar: 'البريد الإلكتروني' } },
      { key: 'auth.address', group: 'auth', defaultValue: 'Address', translations: { am: 'አድራሻ', om: 'Teessoo', ti: 'ኣድራሻ', ar: 'العنوان' } },

      // ══════════════════════════════════════════════════════════
      // ── Restaurant Group (restaurant.*) ───────────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'restaurant.not_found', group: 'restaurant', defaultValue: 'Restaurant Not Found', translations: { am: 'ምግብ ቤት አልተገኘም', om: 'Makala Hin Argamne', ti: 'ምግቢ ቤት ኣይተረኽበን', ar: 'المطعم غير موجود' } },
      { key: 'restaurant.not_found_desc', group: 'restaurant', defaultValue: 'The restaurant you are looking for could not be found.', translations: { am: 'የፈለጉት ምግብ ቤት ሊገኝ አልቻለም።', om: 'Makala isin barbaaddan hin arganne.', ti: 'እቲ ዝደሊዩዎ ምግቢ ቤት ክረኽብ ኣይከኣለን።', ar: 'لم يتم العثور على المطعم الذي تبحث عنه.' } },
      { key: 'restaurant.loading', group: 'restaurant', defaultValue: 'Loading...', translations: { am: 'እየጫነ ነው...', om: 'Kenna jira...', ti: 'እያቕረበ ኣሎ...', ar: 'جاري التحميل...' } },
      { key: 'restaurant.go_home', group: 'restaurant', defaultValue: 'Go Home', translations: { am: 'ወደ መነሻ ሂድ', om: 'Uummamaa Deemi', ti: 'ናብ መበገሲ ኣትዩ', ar: 'الذهاب للرئيسية' } },
      { key: 'restaurant.scanned_qr', group: 'restaurant', defaultValue: 'You scanned the QR code', translations: { am: 'QR ኮዱን ቀንተዋል', om: 'Koodii QR sagaleessani', ti: 'QR ኮድ ቀንስኩም', ar: 'لقد مسحت رمز QR' } },
      { key: 'restaurant.all_rights', group: 'restaurant', defaultValue: 'All rights reserved.', translations: { am: 'ሁሉም መብቶች የተጠበቁ ናቸው።', om: 'Haqa hunda eegameera.', ti: 'ኩሉ መሰላት ተዓቲቡ ኣሎ።', ar: 'جميع الحقوق محفوظة.' } },
      { key: 'restaurant.powered_by', group: 'restaurant', defaultValue: 'Powered by Yene QR', translations: { am: 'በYene QR የሰራ', om: 'Hojiirra Yene QRn', ti: 'ብYene QR ዝሰርሐ', ar: 'مدعوم بواسطة Yene QR' } },

      // ══════════════════════════════════════════════════════════
      // ── Welcome Group (welcome.*) ─────────────────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'welcome.view_menu', group: 'welcome', defaultValue: 'View Menu', translations: { am: 'ምናዝ ይመልከቱ', om: 'Makala Ilaali', ti: 'ሜኑ ርአ', ar: 'عرض القائمة' } },
    ];

    let created = 0;
    let updated = 0;
    let skipped = 0;

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
        created++;
        console.log(`  ✅ Created: ${str.key}`);
      } else {
        // Fill in any missing translations
        const existingTranslations = existing.translations ? (typeof existing.translations === 'string' ? JSON.parse(existing.translations) : existing.translations) : {};
        const newTranslations = str.translations || {};
        let wasUpdated = false;
        for (const [lang, value] of Object.entries(newTranslations)) {
          if (!existingTranslations[lang]) {
            existingTranslations[lang] = value;
            wasUpdated = true;
          }
        }
        if (wasUpdated) {
          await prisma.uIString.update({
            where: { key: str.key },
            data: { translations: JSON.stringify(existingTranslations) },
          });
          updated++;
          console.log(`  🔄 Updated: ${str.key} (added missing translations)`);
        } else {
          skipped++;
        }
      }
    }

    console.log(`\n✨ LANDING/AUTH/RESTAURANT/WELCOME SEED COMPLETE:`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated} (added missing translations)`);
    console.log(`   Skipped: ${skipped} (already complete)`);
    console.log(`   Total:   ${uiStrings.length}\n`);
  } catch (error) {
    console.error('Error seeding i18n data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
