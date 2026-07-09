// ============================================================
// Yene QR — Master i18n Seed Script
// Seeds ALL UI string keys with complete translations in 5 languages
// This is the definitive source of truth for all i18n keys.
// Languages: en, am, om, ti, ar
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
  console.error('  DATABASE_URL="file:./yeneqr.db" node scripts/seed-i18n-master.js');
  process.exit(1);
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌐 Seeding MASTER i18n keys (all 5 languages)...\n');

    const uiStrings = [
      // ══════════════════════════════════════════════════════════
      // ── Common Group (common.*) ───────────────────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'common.save', group: 'common', defaultValue: 'Save', translations: { am: 'አስቀምጥ', om: 'Qusaa', ti: 'ሓቚፅ', ar: 'حفظ' } },
      { key: 'common.cancel', group: 'common', defaultValue: 'Cancel', translations: { am: 'ሰርዝ', om: 'Dhiisi', ti: 'ስርዝ', ar: 'إلغاء' } },
      { key: 'common.delete', group: 'common', defaultValue: 'Delete', translations: { am: 'ሰርዝ', om: 'Haqi', ti: 'ስርዝ', ar: 'حذف' } },
      { key: 'common.edit', group: 'common', defaultValue: 'Edit', translations: { am: 'አስተካክል', om: 'Gulaali', ti: 'ኣስተካክል', ar: 'تعديل' } },
      { key: 'common.close', group: 'common', defaultValue: 'Close', translations: { am: 'ዝጋ', om: 'Cufi', ti: 'ዕጸው', ar: 'إغلاق' } },
      { key: 'common.confirm', group: 'common', defaultValue: 'Confirm', translations: { am: 'አረጋግጥ', om: 'Mirkanaasi', ti: 'ኣረጋግጽ', ar: 'تأكيد' } },
      { key: 'common.loading', group: 'common', defaultValue: 'Loading...', translations: { am: 'እየጫነ ነው...', om: 'Kenna jira...', ti: 'እያቕረበ ኣሎ...', ar: 'جاري التحميل...' } },
      { key: 'common.error', group: 'common', defaultValue: 'Error', translations: { am: 'ስህተት', om: 'Dogoggora', ti: 'ግዕደት', ar: 'خطأ' } },
      { key: 'common.success', group: 'common', defaultValue: 'Success', translations: { am: 'ስኬት', om: 'Milkaa\'ina', ti: 'ዓወት', ar: 'نجاح' } },
      { key: 'common.search', group: 'common', defaultValue: 'Search', translations: { am: 'ፈልግ', om: 'Barbaadi', ti: 'ርኸብ', ar: 'بحث' } },
      { key: 'common.add', group: 'common', defaultValue: 'Add', translations: { am: 'ጨምር', om: 'Dabali', ti: 'ወስኽ', ar: 'إضافة' } },
      { key: 'common.back', group: 'common', defaultValue: 'Back', translations: { am: 'ተመለስ', om: 'Deebi\'i', ti: 'ተመለስ', ar: 'رجوع' } },
      { key: 'common.next', group: 'common', defaultValue: 'Next', translations: { am: 'ቀጥል', om: 'Itti fufi', ti: 'ቀጽል', ar: 'التالي' } },
      { key: 'common.yes', group: 'common', defaultValue: 'Yes', translations: { am: 'አዎ', om: 'Eeyyee', ti: 'እወ', ar: 'نعم' } },
      { key: 'common.no', group: 'common', defaultValue: 'No', translations: { am: 'አይ', om: 'Lakki', ti: 'ኣይ', ar: 'لا' } },
      { key: 'common.status', group: 'common', defaultValue: 'Status', translations: { am: 'ሁኔታ', om: 'Haala', ti: 'ኩነታት', ar: 'الحالة' } },
      { key: 'common.name', group: 'common', defaultValue: 'Name', translations: { am: 'ስም', om: 'Maqaa', ti: 'ስም', ar: 'الاسم' } },
      { key: 'common.email', group: 'common', defaultValue: 'Email', translations: { am: 'ኢሜል', om: 'Imeelee', ti: 'ኢመይል', ar: 'البريد الإلكتروني' } },
      { key: 'common.phone', group: 'common', defaultValue: 'Phone', translations: { am: 'ስልክ', om: 'Bilbila', ti: 'ስልኪ', ar: 'الهاتف' } },
      { key: 'common.actions', group: 'common', defaultValue: 'Actions', translations: { am: 'ተግባራት', om: 'Tarkaanfii', ti: 'ተግባራት', ar: 'الإجراءات' } },
      { key: 'common.active', group: 'common', defaultValue: 'Active', translations: { am: 'ንቁ', om: 'Socho\'aa', ti: 'ንቁ', ar: 'نشط' } },
      { key: 'common.inactive', group: 'common', defaultValue: 'Inactive', translations: { am: 'የለም', om: 'Socho\'aa hin jiru', ti: 'ዘይንቁ', ar: 'غير نشط' } },
      { key: 'common.kitchen', group: 'common', defaultValue: 'Kitchen Display', translations: { am: 'የምግብ ቤት ማሳያ', om: 'Qishinaa Agarsiisaa', ti: 'ናይ ምግቢ ቤት ምርኣይ', ar: 'شاشة المطبخ' } },
      { key: 'common.qr_codes', group: 'common', defaultValue: 'QR Codes', translations: { am: 'QR ኮዶች', om: 'Koodii QR', ti: 'QR ኮዳት', ar: 'رموز QR' } },
      { key: 'common.notifications', group: 'common', defaultValue: 'Notifications', translations: { am: 'ማሳወቂያዎች', om: 'Beeksisa', ti: 'ምልክታት', ar: 'الإشعارات' } },
      { key: 'common.reservations', group: 'common', defaultValue: 'Reservations', translations: { am: 'ቦታ ማስያዎች', om: 'Eegumsa', ti: 'ምዕጻው', ar: 'الحجوزات' } },
      { key: 'common.off', group: 'common', defaultValue: 'off', translations: { am: 'ጠፍቷል', om: 'Dhufamaa', ti: 'ዕጸዩ', ar: 'إيقاف' } },

      // ══════════════════════════════════════════════════════════
      // ── Order Status Group (order.*) ──────────────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'order.status.pending', group: 'order', defaultValue: 'Pending', translations: { am: 'በመጠባበቅ ላይ', om: 'Eegaa', ti: 'ኣብ መጠቕለሊ', ar: 'معلق' } },
      { key: 'order.status.accepted', group: 'order', defaultValue: 'Confirmed', translations: { am: 'ተረጋግጧል', om: 'Mirkanaaʼeera', ti: 'ተረጋገጸ', ar: 'مؤكد' } },
      { key: 'order.status.preparing', group: 'order', defaultValue: 'Preparing', translations: { am: 'እያዘጋጀ ነው', om: "Qophaa'aa jira", ti: 'እያዘጋጀ ኣሎ', ar: 'قيد التحضير' } },
      { key: 'order.status.ready', group: 'order', defaultValue: 'Ready', translations: { am: 'ዝግጁ', om: "Qophaa'eera", ti: 'ድሉይ', ar: 'جاهز' } },
      { key: 'order.status.picked_up', group: 'order', defaultValue: 'Picked Up', translations: { am: 'ተወስዷል', om: 'Fudhateera', ti: 'ተረክቡ', ar: 'تم الاستلام' } },
      { key: 'order.status.served', group: 'order', defaultValue: 'Served', translations: { am: 'የቀረበ', om: 'Dhiyaateera', ti: 'ቀሪቡ', ar: 'تم التقديم' } },
      { key: 'order.status.paid', group: 'order', defaultValue: 'Paid', translations: { am: 'ተከፍሏል', om: 'Kaffalameera', ti: 'ተከፊሉ', ar: 'مدفوع' } },
      { key: 'order.status.completed', group: 'order', defaultValue: 'Completed', translations: { am: 'ተጠናቀቀ', om: 'Xumurameera', ti: 'ተዛዚሙ', ar: 'مكتمل' } },
      { key: 'order.status.cancelled', group: 'order', defaultValue: 'Cancelled', translations: { am: 'ተሰርዟል', om: 'Dhiifameera', ti: 'ተሰሪዙ', ar: 'ملغي' } },
      { key: 'order.accept_order', group: 'order', defaultValue: 'Confirm Order', translations: { am: 'ትዕዛዝ አረጋግጥ', om: 'Ajajaa Mirkanaasi', ti: 'ትዕዛዝ ኣረጋግጽ', ar: 'تأكيد الطلب' } },
      { key: 'order.reject_order', group: 'order', defaultValue: 'Reject Order', translations: { am: 'ትዕዛዝ ውድቅ', om: 'Ajajaa Dhiisi', ti: 'ትዕዛዝ ኣስወግዝ', ar: 'رفض الطلب' } },
      { key: 'dashboard.latest_orders_desc', group: 'dashboard', defaultValue: 'Latest orders across all branches', translations: { am: 'የቅርብ ጊዜ ትዕዛዞች በሁሉም ቅርንጫቶች', om: 'Ajajilee dhiyoo lafoo hunda irratti', ti: 'ናይ ቀረባ ግዜ ትዕዛዛት ኣብ ኩሉ ቅርንጫዓት', ar: 'أحدث الطلبات في جميع الفروع' } },
      { key: 'dashboard.order_distribution_desc', group: 'dashboard', defaultValue: 'Current order distribution', translations: { am: 'የአሁን ትዕዛዝ ስርጭት', om: 'Qabiyyee ajajaa ammaa', ti: 'ናይ ሕጂ ትዕዛዝ ስርጭት', ar: 'توزيع الطلبات الحالي' } },
      { key: 'order.start_preparing', group: 'order', defaultValue: 'Start Preparing', translations: { am: 'ማዘጋጀት ጀምር', om: "Qophaa'uu Jalqabi", ti: 'ምድላው ጀምር', ar: 'بدء التحضير' } },
      { key: 'order.mark_ready', group: 'order', defaultValue: 'Mark Ready', translations: { am: 'ዝግጁ ምልክት አድርግ', om: "Qophaa'eera Mallattoo", ti: 'ድሉይ ምልክት ኣድርግ', ar: 'وضع علامة جاهز' } },
      { key: 'order.pick_up', group: 'order', defaultValue: 'Pick Up', translations: { am: 'ውሰድ', om: 'Fudhu', ti: 'ሓዝ', ar: 'استلم' } },
      { key: 'order.mark_served', group: 'order', defaultValue: 'Mark Served', translations: { am: 'የቀረበ ምልክት አድርግ', om: 'Dhiyaateera Mallattoo', ti: 'ቀሪቡ ምልክት ኣድርግ', ar: 'وضع علامة تم التقديم' } },
      { key: 'order.cancel_title', group: 'order', defaultValue: 'Cancel Order', translations: { am: 'ትዕዛዝ ሰርዝ', om: 'Ajajaa Dhiisi', ti: 'ትዕዛዝ ስርዝ', ar: 'إلغاء الطلب' } },
      { key: 'order.cancel_reason', group: 'order', defaultValue: 'Reason for cancellation', translations: { am: 'የሰርዛት ምክንያት', om: 'Sababa dhiisuu', ti: 'ናይ ስርዛት ምኽንያት', ar: 'سبب الإلغاء' } },
      { key: 'order.cancel_reason_placeholder', group: 'order', defaultValue: 'Enter reason...', translations: { am: 'ምክንያት ያስገቡ...', om: 'Sababa galchi...', ti: 'ምኽንያት ኣእትዉ...', ar: 'أدخل السبب...' } },
      { key: 'order.confirm_cancel', group: 'order', defaultValue: 'Confirm Cancel', translations: { am: 'ሰርዛት አረጋግጥ', om: 'Dhiisuu Mirkanaasi', ti: 'ስርዛት ኣረጋግጽ', ar: 'تأكيد الإلغاء' } },
      { key: 'order.print_receipt', group: 'order', defaultValue: 'Print Receipt', translations: { am: 'ደረሰኝ አትም', om: 'Qabiyyee Pressi', ti: 'ደረሰኝ ኣትም', ar: 'طباعة الإيصال' } },
      { key: 'order.order_number', group: 'order', defaultValue: 'Order', translations: { am: 'ትዕዛዝ', om: 'Ajajaa', ti: 'ትዕዛዝ', ar: 'طلب' } },
      { key: 'order.table', group: 'order', defaultValue: 'Table', translations: { am: 'ጠረጴዛ', om: 'Meecha', ti: 'ጠረጴዛ', ar: 'طاولة' } },
      { key: 'order.customer', group: 'order', defaultValue: 'Customer', translations: { am: 'ደንበኛ', om: 'Maatii', ti: 'ደላላ', ar: 'عميل' } },
      { key: 'order.walk_in', group: 'order', defaultValue: 'Walk-in', translations: { am: 'ቀጥታ', om: 'Kallattii', ti: 'ቀጥታ', ar: 'زيارة مباشرة' } },
      { key: 'order.type', group: 'order', defaultValue: 'Type', translations: { am: 'አይነት', om: 'Gosa', ti: 'ዓይነት', ar: 'النوع' } },
      { key: 'order.time', group: 'order', defaultValue: 'Time', translations: { am: 'ሰዓት', om: "Sa'aatii", ti: 'ሰዓት', ar: 'الوقت' } },
      { key: 'order.items_count', group: 'order', defaultValue: 'items', translations: { am: 'ዕቃዎች', om: 'wantoota', ti: 'ኣቕሓታት', ar: 'عناصر' } },
      { key: 'order.subtotal', group: 'order', defaultValue: 'Subtotal', translations: { am: 'ንዑስ ድምር', om: 'Walitti Qabamee', ti: 'ንኡስ ድምር', ar: 'المجموع الفرعي' } },
      { key: 'order.tax', group: 'order', defaultValue: 'Tax', translations: { am: 'ግብር', om: 'Belaa', ti: 'ግብሪ', ar: 'الضريبة' } },
      { key: 'order.service_charge', group: 'order', defaultValue: 'Service Charge', translations: { am: 'የአገልግሎት ክፍያ', om: 'Kaffaltii Tajaajilaa', ti: 'ናይ ኣገልግሎት ክፍያ', ar: 'رسوم الخدمة' } },
      { key: 'order.total', group: 'order', defaultValue: 'Total', translations: { am: 'ጠቅላላ', om: 'Walumaagalatti', ti: 'ጠቓል', ar: 'الإجمالي' } },
      { key: 'order.discount', group: 'order', defaultValue: 'Discount', translations: { am: 'ቅናሽ', om: 'Gatiin Laafaa', ti: 'ቅናሽ', ar: 'خصم' } },
      { key: 'order.notes', group: 'order', defaultValue: 'Notes', translations: { am: 'ማስታወሻዎች', om: 'Yaada', ti: 'ማስታወሻ', ar: 'ملاحظات' } },
      { key: 'order.mark_as', group: 'order', defaultValue: 'Mark as', translations: { am: 'ምልክት አድርግ', om: 'Mallattoo gochi', ti: 'ምልክት ኣድርግ', ar: 'وضع علامة' } },
      { key: 'order.all', group: 'order', defaultValue: 'All', translations: { am: 'ሁሉም', om: 'Hunda', ti: 'ኩሉ', ar: 'الكل' } },
      { key: 'order.dine_in', group: 'order', defaultValue: 'Dine In', translations: { am: 'ውስጥ መብላት', om: 'Keessaa Nyaachuu', ti: 'ኣብዚ ብላዕ', ar: 'تناول داخل المطعم' } },
      { key: 'order.takeaway', group: 'order', defaultValue: 'Takeaway', translations: { am: 'መውሰድ', om: 'Fudhachuu', ti: 'ምውሳድ', ar: 'سفري' } },
      { key: 'order.new_order', group: 'order', defaultValue: 'New Order', translations: { am: 'አዲስ ትዕዛዝ', om: 'Ajajaa Haaraa', ti: 'ሓድሽ ትዕዛዝ', ar: 'طلب جديد' } },
      { key: 'order.no_orders', group: 'order', defaultValue: 'No orders found', translations: { am: 'ትዕዛዞች አልተገኙም', om: 'Ajajileen hin argamne', ti: 'ትዕዛዛት ኣይተረኽቡን', ar: 'لم يتم العثور على طلبات' } },
      { key: 'order.pending_orders', group: 'order', defaultValue: 'Pending Orders', translations: { am: 'በመጠባበቅ ላይ ትዕዛዞች', om: 'Ajajilee Eegaa', ti: 'ኣብ መጠቕለሊ ዘለዉ ትዕዛዛት', ar: 'طلبات معلقة' } },
      { key: 'order.split_bill', group: 'order', defaultValue: 'Split Bill', translations: { am: 'ወጪ ይከፍሉ', om: 'Kaffaltii Qoodaa', ti: 'ዋጋ ምምቃም', ar: 'تقسيم الفاتورة' } },
      { key: 'order.complete_order', group: 'order', defaultValue: 'Complete Order', translations: { am: 'ትዕዛዝ ጨርስ', om: 'Ajajaa Xumuri', ti: 'ትዕዛዝ ዛዚም', ar: 'إكمال الطلب' } },
      { key: 'order.order_details', group: 'order', defaultValue: 'Order Details', translations: { am: 'የትዕዛዝ ዝርዝሮች', om: 'Bal\'ina Ajajaa', ti: 'ናይ ትዕዛዝ ዝርዝራት', ar: 'تفاصيل الطلب' } },

      // ══════════════════════════════════════════════════════════
      // ── Dashboard Group (dashboard.*) ─────────────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'dashboard.title', group: 'dashboard', defaultValue: 'Dashboard', translations: { am: 'ዳሽቦርድ', om: 'Daashboordii', ti: 'ዳሽቦርድ', ar: 'لوحة التحكم' } },
      { key: 'dashboard.restaurant_manager', group: 'dashboard', defaultValue: 'Restaurant Manager', translations: { am: 'የምግብ ቤት አስተዳዳሪ', om: 'Bulchiinsa Makalaa', ti: 'ምግቢ ቤት መሪ', ar: 'مدير المطعم' } },
      { key: 'dashboard.order', group: 'dashboard', defaultValue: 'Order', translations: { am: 'ትዕዛዝ', om: 'Ajajaa', ti: 'ትዕዛዝ', ar: 'طلب' } },
      { key: 'dashboard.table_label', group: 'dashboard', defaultValue: 'Table', translations: { am: 'ጠረጴዛ', om: 'Meecha', ti: 'ጠረጴዛ', ar: 'طاولة' } },
      { key: 'dashboard.customer', group: 'dashboard', defaultValue: 'Customer', translations: { am: 'ደንበኛ', om: 'Maatii', ti: 'ደላላ', ar: 'عميل' } },
      { key: 'dashboard.walk_in', group: 'dashboard', defaultValue: 'Walk-in', translations: { am: 'ቀጥታ', om: 'Kallattii', ti: 'ቀጥታ', ar: 'زيارة مباشرة' } },
      { key: 'dashboard.type', group: 'dashboard', defaultValue: 'Type', translations: { am: 'አይነት', om: 'Gosa', ti: 'ዓይነት', ar: 'النوع' } },
      { key: 'dashboard.time', group: 'dashboard', defaultValue: 'Time', translations: { am: 'ሰዓት', om: "Sa'aatii", ti: 'ሰዓት', ar: 'الوقت' } },
      { key: 'dashboard.notes', group: 'dashboard', defaultValue: 'Notes', translations: { am: 'ማስታወሻዎች', om: 'Yaada', ti: 'ማስታወሻ', ar: 'ملاحظات' } },
      { key: 'dashboard.items_count', group: 'dashboard', defaultValue: 'items', translations: { am: 'ዕቃዎች', om: 'wantoota', ti: 'ኣቕሓታት', ar: 'عناصر' } },
      { key: 'dashboard.mark_as', group: 'dashboard', defaultValue: 'Mark as', translations: { am: 'ምልክት አድርግ', om: 'Mallattoo gochi', ti: 'ምልክት ኣድርግ', ar: 'وضع علامة' } },
      { key: 'dashboard.all', group: 'dashboard', defaultValue: 'All', translations: { am: 'ሁሉም', om: 'Hunda', ti: 'ኩሉ', ar: 'الكل' } },
      { key: 'dashboard.subtotal', group: 'dashboard', defaultValue: 'Subtotal', translations: { am: 'ንዑስ ድምር', om: 'Walitti Qabamee', ti: 'ንኡስ ድምር', ar: 'المجموع الفرعي' } },
      { key: 'dashboard.tax', group: 'dashboard', defaultValue: 'Tax', translations: { am: 'ግብር', om: 'Belaa', ti: 'ግብሪ', ar: 'الضريبة' } },
      { key: 'dashboard.service_charge', group: 'dashboard', defaultValue: 'Service Charge', translations: { am: 'የአገልግሎት ክፍያ', om: 'Kaffaltii Tajaajilaa', ti: 'ናይ ኣገልግሎት ክፍያ', ar: 'رسوم الخدمة' } },
      { key: 'dashboard.total', group: 'dashboard', defaultValue: 'Total', translations: { am: 'ጠቅላላ', om: 'Walumaagalatti', ti: 'ጠቓል', ar: 'الإجمالي' } },
      { key: 'dashboard.discount', group: 'dashboard', defaultValue: 'Discount', translations: { am: 'ቅናሽ', om: 'Gatiin Laafaa', ti: 'ቅናሽ', ar: 'خصم' } },
      { key: 'dashboard.completed_orders', group: 'dashboard', defaultValue: 'Completed', translations: { am: 'የተጠናቀቁ', om: 'Xumuramaniiru', ti: 'ዝተዛዘሙ', ar: 'مكتمل' } },
      { key: 'dashboard.preparing', group: 'dashboard', defaultValue: 'Preparing', translations: { am: 'እያዘጋጀ ነው', om: "Qophaa'aa", ti: 'እያዘጋጀ ኣሎ', ar: 'قيد التحضير' } },
      { key: 'dashboard.ready_count', group: 'dashboard', defaultValue: 'Ready', translations: { am: 'ዝግጁ', om: "Qophaa'eera", ti: 'ድሉይ', ar: 'جاهز' } },
      { key: 'dashboard.no_orders', group: 'dashboard', defaultValue: 'No orders yet', translations: { am: 'እስካሁን ትዕዛዞች የሉም', om: 'Ajajilee hin jiru', ti: 'ትዕዛዛት የለን', ar: 'لا توجد طلبات بعد' } },
      { key: 'dashboard.no_orders_found', group: 'dashboard', defaultValue: 'No orders found', translations: { am: 'ትዕዛዞች አልተገኙም', om: 'Ajajileen hin argamne', ti: 'ትዕዛዛት ኣይተረኽቡን', ar: 'لم يتم العثور على طلبات' } },
      { key: 'dashboard.refresh', group: 'dashboard', defaultValue: 'Refresh', translations: { am: 'አድስ', om: 'Haaraa', ti: 'ኣድስ', ar: 'تحديث' } },
      { key: 'dashboard.today_orders', group: 'dashboard', defaultValue: "Today's Orders", translations: { am: 'የዛሬ ትዕዛዞች', om: "Ajajilee Har'aa", ti: 'ናይ ሎሚ ትዕዛዛት', ar: 'طلبات اليوم' } },
      { key: 'dashboard.live_data', group: 'dashboard', defaultValue: 'Live Data', translations: { am: 'ቀጥታ ውሂብ', om: 'Daataa Kallattii', ti: 'ቀጥታ ዳታ', ar: 'بيانات مباشرة' } },
      { key: 'dashboard.revenue', group: 'dashboard', defaultValue: 'Revenue', translations: { am: 'ገቢ', om: 'Galaana', ti: 'ኣታዊ', ar: 'الإيرادات' } },
      { key: 'dashboard.active_tables', group: 'dashboard', defaultValue: 'Active Tables', translations: { am: 'ንቁ ጠረጴዛዎች', om: 'Meechaalee Hojii', ti: 'ንቁ ጠረጴዛታት', ar: 'طاولات نشطة' } },
      { key: 'dashboard.pending_orders', group: 'dashboard', defaultValue: 'Pending Orders', translations: { am: 'በመጠባበቅ ላይ ትዕዛዞች', om: 'Ajajilee Eegaa', ti: 'ኣብ መጠቕለሊ ዘለዉ ትዕዛዛት', ar: 'طلبات معلقة' } },
      { key: 'dashboard.quick_actions', group: 'dashboard', defaultValue: 'Quick Actions', translations: { am: 'ፈጣን ተግባራት', om: 'Tarkaanfii Ariifataa', ti: 'ቅልጡፍ ተግባራት', ar: 'إجراءات سريعة' } },
      { key: 'dashboard.new_order', group: 'dashboard', defaultValue: 'New Order', translations: { am: 'አዲስ ትዕዛዝ', om: 'Ajajaa Haaraa', ti: 'ሓድሽ ትዕዛዝ', ar: 'طلب جديد' } },
      { key: 'dashboard.manage_menu', group: 'dashboard', defaultValue: 'Manage Menu', translations: { am: 'ምናዝ ያስተዳድሩ', om: 'Makala Bulchaa', ti: 'ሜኑ ኣስተዳድር', ar: 'إدارة القائمة' } },
      { key: 'dashboard.recent_orders', group: 'dashboard', defaultValue: 'Recent Orders', translations: { am: 'የቅርብ ጊዜ ትዕዛዞች', om: 'Ajajilee Dhiyoo', ti: 'ናይ ቀረባ ግዜ ትዕዛዛት', ar: 'طلبات حديثة' } },
      { key: 'dashboard.view_all', group: 'dashboard', defaultValue: 'View All', translations: { am: 'ሁሉንም ይመልከቱ', om: 'Hunda Ilaalaa', ti: 'ኩሉ ርአ', ar: 'عرض الكل' } },
      { key: 'dashboard.order_status', group: 'dashboard', defaultValue: 'Order Status', translations: { am: 'የትዕዛዝ ሁኔታ', om: 'Haala Ajajaa', ti: 'ናይ ትዕዛዝ ኩነታት', ar: 'حالة الطلب' } },
      { key: 'dashboard.analytics', group: 'dashboard', defaultValue: 'Analytics', translations: { am: 'ትንተና', om: 'Qorannoo', ti: 'ትንተና', ar: 'التحليلات' } },
      { key: 'dashboard.localization', group: 'dashboard', defaultValue: 'Localization', translations: { am: 'ቋንቋ', om: 'Afaan', ti: 'ቋንቋ', ar: 'التوطين' } },
      { key: 'dashboard.split_bill', group: 'dashboard', defaultValue: 'Split Bill', translations: { am: 'ወጪ ይከፍሉ', om: 'Kaffaltii Qoodaa', ti: 'ዋጋ ምምቃም', ar: 'تقسيم الفاتورة' } },
      { key: 'dashboard.select_branch', group: 'dashboard', defaultValue: 'Select Branch', translations: { am: 'ቅርንጫት ይምረጡ', om: 'Lafoo Filadhu', ti: 'ቅርንጫዕ ምረጽ', ar: 'اختر الفرع' } },
      { key: 'dashboard.branch', group: 'dashboard', defaultValue: 'Branch', translations: { am: 'ቅርንጫት', om: 'Lafoo', ti: 'ቅርንጫዕ', ar: 'فرع' } },
      { key: 'dashboard.main', group: 'dashboard', defaultValue: 'Main', translations: { am: 'ዋና', om: 'Ijoo', ti: 'ቀንዲ', ar: 'رئيسي' } },
      { key: 'dashboard.loading_menu', group: 'dashboard', defaultValue: 'Loading menu...', translations: { am: 'ምናዝ እየጫነ ነው...', om: 'Makala kenna jira...', ti: 'ሜኑ እያጸዓነ ኣሎ...', ar: 'جاري تحميل القائمة...' } },
      { key: 'dashboard.loading_orders', group: 'dashboard', defaultValue: 'Loading orders...', translations: { am: 'ትዕዛዞች እየጫኑ ነው...', om: 'Ajajilee kenna jira...', ti: 'ትዕዛዛት እያቕረቡ ኣለዉ...', ar: 'جاري تحميل الطلبات...' } },
      { key: 'dashboard.loading_settings', group: 'dashboard', defaultValue: 'Loading settings...', translations: { am: 'ቅንብሮች እየጫኑ ነው...', om: "Qindaa'ina kenna jira...", ti: 'ቅጥዒታት እያቕረቡ ኣለዉ...', ar: 'جاري تحميل الإعدادات...' } },
      { key: 'dashboard.loading_dashboard', group: 'dashboard', defaultValue: 'Loading dashboard...', translations: { am: 'ዳሽቦርድ እየጫነ ነው...', om: 'Daashboordii kenna jira...', ti: 'ዳሽቦርድ እያጸዓነ ኣሎ...', ar: 'جاري تحميل لوحة التحكم...' } },

      // ══════════════════════════════════════════════════════════
      // ── Kitchen Group (kitchen.*) ─────────────────────────────
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
      { key: 'waiter.accepted', group: 'waiter', defaultValue: 'Confirmed', translations: { am: 'ተረጋግጧል', om: 'Mirkanaaʼeera', ti: 'ተረጋገጸ', ar: 'مؤكد' } },
      { key: 'waiter.new_order_alert', group: 'waiter', defaultValue: 'New Order!', translations: { am: 'አዲስ ትዕዛዝ!', om: 'Ajajaa Haaraa!', ti: 'ሓድሽ ትዕዛዝ!', ar: 'طلب جديد!' } },
      { key: 'waiter.accept_and_send', group: 'waiter', defaultValue: 'Confirm & Send to Kitchen', translations: { am: 'አረጋግጥ እና ወደ ምግብ ቤት ላክ', om: 'Mirkanaasi fi Qishinaatti Ergi', ti: 'ኣረጋግጽን ናብ ምግቢ ቤት ስደድን', ar: 'تأكيد وإرسال إلى المطبخ' } },

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

      // ══════════════════════════════════════════════════════════
      // ── Settings Group (settings.*) ───────────────────────────
      // ══════════════════════════════════════════════════════════
      { key: 'settings.save_changes', group: 'settings', defaultValue: 'Save Changes', translations: { am: 'ለውጦች ያስቀምጡ', om: "Jijjiirama Qindaa'i", ti: 'ለውጥታት ኣስቐምጽ', ar: 'حفظ التغييرات' } },
      { key: 'settings.to', group: 'settings', defaultValue: 'to', translations: { am: 'እስከ', om: 'gabba', ti: 'ክሳብ', ar: 'إلى' } },
      { key: 'settings.closed', group: 'settings', defaultValue: 'Closed', translations: { am: 'ዝግ ነው', om: 'Cufameera', ti: 'ዕጸወ', ar: 'مغلق' } },
      { key: 'settings.save_hours', group: 'settings', defaultValue: 'Save Hours', translations: { am: 'ሰዓታት ያስቀምጡ', om: "Sa'aatii Qindaa'i", ti: 'ሰዓታት ኣስቐምጽ', ar: 'حفظ الساعات' } },
      { key: 'settings.tax_rate', group: 'settings', defaultValue: 'Tax Rate', translations: { am: 'የግብር መጠን', om: 'Qabxaa Belaa', ti: 'ናይ ግብሪ መጠን', ar: 'نسبة الضريبة' } },
      { key: 'settings.service_charge_pct', group: 'settings', defaultValue: 'Service Charge %', translations: { am: 'የአገልግሎት ክፍያ %', om: 'Kaffaltii Tajaajilaa %', ti: 'ናይ ኣገልግሎት ክፍያ %', ar: 'رسوم الخدمة %' } },
      { key: 'settings.currency', group: 'settings', defaultValue: 'Currency', translations: { am: 'ገንዘብ', om: 'Maallaqaa', ti: 'ገንዘብ', ar: 'العملة' } },
      { key: 'settings.default_language', group: 'settings', defaultValue: 'Default Language', translations: { am: 'ነባሪ ቋንቋ', om: 'Afaan Durtii', ti: 'ብሔራዊ ቋንቋ', ar: 'اللغة الافتراضية' } },
      { key: 'settings.save_settings', group: 'settings', defaultValue: 'Save Settings', translations: { am: 'ቅንብሮች ያስቀምጡ', om: "Qindaa'ina Qindaa'i", ti: 'ቅጥዒታት ኣስቐምጽ', ar: 'حفظ الإعدادات' } },
      { key: 'settings.save_payment', group: 'settings', defaultValue: 'Save Payment', translations: { am: 'ክፍያ ያስቀምጡ', om: "Kaffaltii Qindaa'i", ti: 'ክፍያ ኣስቐምጽ', ar: 'حفظ الدفع' } },
      { key: 'settings.restaurant_profile', group: 'settings', defaultValue: 'Restaurant Profile', translations: { am: 'የምግብ ቤት መገለጫ', om: 'Piroofilii Makalaa', ti: 'ምግቢ ቤት መገለጫ', ar: 'ملف المطعم' } },
      { key: 'settings.working_hours', group: 'settings', defaultValue: 'Working Hours', translations: { am: 'የስራ ሰዓታት', om: "Sa'aatii Hojii", ti: 'ናይ ስራሕ ሰዓታት', ar: 'ساعات العمل' } },
      { key: 'settings.tax_service', group: 'settings', defaultValue: 'Tax & Service', translations: { am: 'ግብር እና አገልግሎት', om: 'Belaa fi Tajaajila', ti: 'ግብሪን ኣገልግሎትን', ar: 'الضريبة والخدمة' } },
      { key: 'settings.payment_methods', group: 'settings', defaultValue: 'Payment Methods', translations: { am: 'የክፍያ ዘዴዎች', om: 'Qabiyyee Kaffaltii', ti: 'ናይ ክፍያ መንገድታት', ar: 'طرق الدفع' } },
      { key: 'settings.security', group: 'settings', defaultValue: 'Security', translations: { am: 'ደህንነት', om: 'Nageenya', ti: 'ድሕንነት', ar: 'الأمان' } },
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

    console.log(`\n✨ MASTER SEED COMPLETE:`);
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
