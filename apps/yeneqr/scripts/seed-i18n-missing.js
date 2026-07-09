// ============================================================
// Yene QR — i18n Missing Keys Seed Script
// Seeds ~155 UI string keys that are used in components but
// were missing from the original scripts/seed-i18n.js
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
  console.error('  DATABASE_URL="file:./yeneqr.db" node scripts/seed-i18n-missing.js');
  process.exit(1);
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌐 Seeding MISSING i18n keys...\n');

    const uiStrings = [
      // ── Common (additional) ──────────────────────────────────
      { key: 'common.kitchen', group: 'common', defaultValue: 'Kitchen Display', description: 'Kitchen display tab', translations: { am: 'የምግት ቤት ማሳያ', om: 'Qishinaa Agarsiisaa' } },
      { key: 'common.qr_codes', group: 'common', defaultValue: 'QR Codes', description: 'QR codes tab', translations: { am: 'QR ኮዶች', om: 'Koodii QR' } },
      { key: 'common.notifications', group: 'common', defaultValue: 'Notifications', description: 'Notifications tab', translations: { am: 'ማሳወቂያዎች', om: 'Beeksisa' } },
      { key: 'common.reservations', group: 'common', defaultValue: 'Reservations', description: 'Reservations tab', translations: { am: 'ቦታ ማስያዎች', om: 'Eegumsa' } },
      { key: 'common.off', group: 'common', defaultValue: 'off', description: 'Off state label', translations: { am: 'ጠፍቷል', om: 'Dhufamaa' } },

      // ── Menu (additional ~80 keys) ───────────────────────────
      { key: 'menu.combo', group: 'menu', defaultValue: 'Combo', description: 'Combo item badge', translations: { am: 'ኮምቦ', om: 'Komboo' } },
      { key: 'menu.includes', group: 'menu', defaultValue: 'Includes', description: 'Combo includes label', translations: { am: 'ያካትታል', om: 'Qabata' } },
      { key: 'menu.included', group: 'menu', defaultValue: 'Included', description: 'Included label', translations: { am: 'ተካትቷል', om: 'Qabatameera' } },
      { key: 'menu.no_items', group: 'menu', defaultValue: 'No items in this category', description: 'Empty category message', translations: { am: 'በዚህ ምድብ ውስጥ ዕቃዎች የሉም', om: 'Gosti kana keessaa wanti hin jiru' } },
      { key: 'menu.unavailable', group: 'menu', defaultValue: 'Unavailable', description: 'Item unavailable badge', translations: { am: 'የለም', om: 'Hin jiru' } },
      { key: 'menu.veg', group: 'menu', defaultValue: 'Veg', description: 'Vegetarian short badge', translations: { am: 'አራ', om: 'Biq' } },
      { key: 'menu.filter_all', group: 'menu', defaultValue: 'All', description: 'Filter: All', translations: { am: 'ሁሉም', om: 'Hunda' } },
      { key: 'menu.filter_favorites', group: 'menu', defaultValue: 'Favorites', description: 'Filter: Favorites', translations: { am: 'የተወደዱ', om: 'Kan Jaallataman' } },
      { key: 'menu.filter_veg', group: 'menu', defaultValue: 'Veg', description: 'Filter: Vegetarian', translations: { am: 'አራ', om: 'Biq' } },
      { key: 'menu.filter_spicy', group: 'menu', defaultValue: 'Spicy', description: 'Filter: Spicy', translations: { am: 'መራራ', om: 'Qamadhii' } },
      { key: 'menu.filter_popular', group: 'menu', defaultValue: 'Popular', description: 'Filter: Popular', translations: { am: 'ታዋቂ', om: 'Beekamaa' } },
      { key: 'menu.filter_new', group: 'menu', defaultValue: 'New', description: 'Filter: New', translations: { am: 'አዲስ', om: 'Haaraa' } },
      { key: 'menu.items_found', group: 'menu', defaultValue: 'items found', description: 'Search results count', translations: { am: 'ዕቃዎች ተገኝተዋል', om: 'wanton argamaniiru' } },
      { key: 'menu.sort_default', group: 'menu', defaultValue: 'Default', description: 'Sort: Default', translations: { am: 'ነባሪ', om: 'Durtii' } },
      { key: 'menu.sort_price_low', group: 'menu', defaultValue: 'Price: Low to High', description: 'Sort: Price ascending', translations: { am: 'ዋጋ: ከዝቅተኛ ወደ ከፍተኛ', om: 'Gallii: Gadi irraa Olatti' } },
      { key: 'menu.sort_price_high', group: 'menu', defaultValue: 'Price: High to Low', description: 'Sort: Price descending', translations: { am: 'ዋጋ: ከፍተኛ ወደ ዝቅተኛ', om: 'Gallii: Oliirraa Gaditti' } },
      { key: 'menu.sort_popular', group: 'menu', defaultValue: 'Most Popular', description: 'Sort: Most popular', translations: { am: 'በጣም ታዋቂ', om: 'Baay\'ee Beekamaa' } },
      { key: 'menu.sort_fastest', group: 'menu', defaultValue: 'Fastest Prep', description: 'Sort: Fastest preparation', translations: { am: 'ፈጣን ዝግጁ', om: 'Ariifata Qophaa\'uu' } },
      { key: 'menu.popular_picks', group: 'menu', defaultValue: 'Popular Picks', description: 'Popular items section', translations: { am: 'ታዋቂ ምርጫዎች', om: 'Filannoo Beekamoo' } },
      { key: 'menu.suggested_for_you', group: 'menu', defaultValue: 'Suggested for You', description: 'Suggestions section', translations: { am: 'ለእርስዎ የተመከሩ', om: 'Sii Dhiyaataman' } },
      { key: 'menu.no_items_found', group: 'menu', defaultValue: 'No items found', description: 'No search results', translations: { am: 'ዕቃ አልተገኘም', om: 'Wanti hin argamne' } },
      { key: 'menu.try_different_filter', group: 'menu', defaultValue: 'Try a different filter or browse all items', description: 'Filter suggestion', translations: { am: 'ሌላ ማጣሪያ ይሞክሩ ወይም ሁሉንም ዕቃዎች ያስሱ', om: 'Tarkaanfii biroo yaalaa ykn hunda ilaalaa' } },
      { key: 'menu.try_different_search', group: 'menu', defaultValue: 'Try a different search term', description: 'Search suggestion', translations: { am: 'ሌላ የፍለጋ ቃል ይሞክሩ', om: 'Jechoota barbaachisaa biroo yaalaa' } },
      { key: 'menu.while_you_decide', group: 'menu', defaultValue: 'While You Decide', description: 'Entertainment section', translations: { am: 'እስከወስኑ ድረስ', om: 'Yoo Murteessitan' } },
      { key: 'menu.how_would_you_like', group: 'menu', defaultValue: 'How would you like to order?', description: 'Order type question', translations: { am: 'እንዴት ማዘዝ ይፈልጋሉ?', om: 'Akkaatin ajajaa barbaaddaa?' } },
      { key: 'menu.dine_in', group: 'menu', defaultValue: 'Dine In', description: 'Dine in option', translations: { am: 'ውስጥ መብላት', om: 'Keessaa Nyaachuu' } },
      { key: 'menu.takeaway', group: 'menu', defaultValue: 'Takeaway', description: 'Takeaway option', translations: { am: 'መውሰድ', om: 'Fudhachuu' } },
      { key: 'menu.table', group: 'menu', defaultValue: 'Table', description: 'Table label', translations: { am: 'ጠረጴዛ', om: 'Meecha' } },
      { key: 'menu.pickup_in', group: 'menu', defaultValue: 'Pickup in ~20 min', description: 'Estimated pickup time', translations: { am: 'በ~20 ደቂቃ ውስጥ ይውሰዱ', om: '~20 daqiiqaa keessaa fudhaa' } },
      { key: 'menu.how_many_guests', group: 'menu', defaultValue: 'How many guests?', description: 'Guest count question', translations: { am: 'ስንት እንግዳ ነው?', om: 'Meecha meeqa?' } },
      { key: 'menu.guests', group: 'menu', defaultValue: 'guests', description: 'Guests label', translations: { am: 'እንግዶች', om: 'Meechaalee' } },
      { key: 'menu.entertainment_teaser', group: 'menu', defaultValue: 'Games, facts & stories while you wait!', description: 'Entertainment teaser', translations: { am: 'ሳትጠብቁ ገና ጨዋታ፣ እውቀት እና ታሪኮች!', om: 'Tapha, beekamtii fi dhiheessa yoo eeggattan!' } },
      { key: 'menu.start_ordering', group: 'menu', defaultValue: 'Start Ordering', description: 'Start ordering button', translations: { am: 'ማዘዝ ይጀምሩ', om: 'Ajajaa Jalqabaa' } },
      { key: 'menu.pts', group: 'menu', defaultValue: 'pts', description: 'Points abbreviation', translations: { am: 'ነጥቦች', om: 'qabxii' } },
      { key: 'menu.share_menu', group: 'menu', defaultValue: 'Share Menu', description: 'Share menu button', translations: { am: 'ምናዝ ያካፍሉ', om: 'Makala Qoodaa' } },
      { key: 'menu.1_item', group: 'menu', defaultValue: '1 item', description: 'Single item count', translations: { am: '1 ዕቃ', om: 'Wanti 1' } },
      { key: 'menu.n_items', group: 'menu', defaultValue: '{n} items', description: 'Multiple items count', translations: { am: '{n} ዕቃዎች', om: '{n} wantoota' } },
      { key: 'menu.order_status', group: 'menu', defaultValue: 'Order Status', description: 'Order status heading', translations: { am: 'የትዕዛዝ ሁኔታ', om: 'Haala Ajajaa' } },
      { key: 'menu.live', group: 'menu', defaultValue: 'Live', description: 'Live indicator', translations: { am: 'ቀጥታ', om: 'Kallattii' } },
      { key: 'menu.add_more', group: 'menu', defaultValue: 'Add More', description: 'Add more items button', translations: { am: 'ተጨማሪ ያክሉ', om: 'Dabalaa Dabali' } },
      { key: 'menu.browse_menu', group: 'menu', defaultValue: 'Browse Menu', description: 'Browse menu button', translations: { am: 'ምናዝ ያስሱ', om: 'Makala Ilaalaa' } },
      { key: 'menu.no_active_order', group: 'menu', defaultValue: 'No Active Order', description: 'No active order heading', translations: { am: 'ንቁ ትዕዛዝ የለም', om: 'Ajajaa Hojii Hin Jiru' } },
      { key: 'menu.place_order_to_track', group: 'menu', defaultValue: 'Browse the menu and place your first order to track it here in real time.', description: 'No active order description', translations: { am: 'ምናዙን ያስሱ እና የመጀመሪያ ትዕዛዝዎን ይስጡ እዚህ በእውነተ-ጊዜ ለመከታተል።', om: 'Makala ilaalaa fi ajajaa jalqabaa ergaa kallattii asitti hordoffaa.' } },
      { key: 'menu.order', group: 'menu', defaultValue: 'Order', description: 'Order label', translations: { am: 'ትዕዛዝ', om: 'Ajajaa' } },
      { key: 'menu.est_ready_in', group: 'menu', defaultValue: 'Est. ready in', description: 'Estimated ready time', translations: { am: 'የሚዘጋጀው ጊዜ', om: 'Qophaa\'uu eegama' } },
      { key: 'menu.min', group: 'menu', defaultValue: 'min', description: 'Minutes abbreviation', translations: { am: 'ደቂቃ', om: 'daq' } },
      { key: 'menu.items', group: 'menu', defaultValue: 'Items', description: 'Items label', translations: { am: 'ዕቃዎች', om: 'Wantoota' } },
      { key: 'menu.pay_now', group: 'menu', defaultValue: 'Pay Now', description: 'Pay now button', translations: { am: 'አሁን ይክፈሉ', om: 'Amma Kaffalaa' } },
      { key: 'menu.pay_when_ready', group: 'menu', defaultValue: 'Pay When Ready', description: 'Pay when ready button', translations: { am: 'ዝግጁ ሲል ይክፈሉ', om: 'Yoo Qophaa\'e Kaffalaa' } },
      { key: 'menu.pay_after_meal_note', group: 'menu', defaultValue: 'You can pay after your meal is served', description: 'Pay after meal note', translations: { am: 'ምግብዎ ከቀረበ በኋላ መክፈል ይችላሉ', om: 'Nyaata keessan dhiyaatee booda kaffaltuu dandeessu' } },
      { key: 'menu.cash', group: 'menu', defaultValue: 'Cash', description: 'Cash payment', translations: { am: 'ጥሬ ገንዘብ', om: 'Maallaqaa' } },
      { key: 'menu.pay_at_counter', group: 'menu', defaultValue: 'Pay at counter', description: 'Pay at counter option', translations: { am: 'በአገልጋይ ሰሌዳ ይክፈሉ', om: 'Bakka kaffaltuu kaffalaa' } },
      { key: 'menu.mobile_payment', group: 'menu', defaultValue: 'Mobile payment', description: 'Mobile payment option', translations: { am: 'ሞባይል ክፍያ', om: 'Kaffaltii Bilbilaa' } },
      { key: 'menu.online_payment', group: 'menu', defaultValue: 'Online payment', description: 'Online payment option', translations: { am: 'መስመር ላይ ክፍያ', om: 'Kaffaltii Internetii' } },
      { key: 'menu.bank_transfer', group: 'menu', defaultValue: 'Bank transfer', description: 'Bank transfer option', translations: { am: 'ባንክ ዝውውር', om: 'Dabdachiisa Baankii' } },
      { key: 'menu.processing_payment', group: 'menu', defaultValue: 'Processing Payment...', description: 'Payment processing state', translations: { am: 'ክፍያ በሂደት ላይ...', om: 'Kaffaltii Hojjechaa jira...' } },
      { key: 'menu.redirecting_payment', group: 'menu', defaultValue: 'Redirecting to payment provider...', description: 'Redirecting to payment', translations: { am: 'ወደ ክፍያ አቅራቢ እየመራ ነው...', om: 'Gabaabbaa kaffaltiitti ergaa jira...' } },
      { key: 'menu.order_placed', group: 'menu', defaultValue: 'Order Placed!', description: 'Order placed success', translations: { am: 'ትዕዛዝ ተሰጥቷል!', om: 'Ajajaan Ergameera!' } },
      { key: 'menu.earned_points', group: 'menu', defaultValue: 'You earned {n} points!', description: 'Points earned message', translations: { am: '{n} ነጥቦች አግኝተዋል!', om: '{n} qabxii argattan!' } },
      { key: 'menu.pay_at_counter_ready', group: 'menu', defaultValue: 'Please pay at the counter when your order is ready.', description: 'Pay at counter instruction', translations: { am: 'ትዕዛዝዎ ሲዘጋዝ እባክዎ በአገልጋይ ሰሌዳ ይክፈሉ።', om: 'Ajajaan yoo qophaa\'e bakka kaffaltuu kaffalaa.' } },
      { key: 'menu.payment_processing_msg', group: 'menu', defaultValue: 'Your payment is being processed. You\'ll be notified once confirmed.', description: 'Payment processing message', translations: { am: 'ክፍያዎ በሂደት ላይ ነው። ከተረጋገጠ በኋላ ይሳተፋሉ።', om: 'Kaffaltiin keessan hojjechaa jira. Mirkanaa\'eera ani beeksisa.' } },
      { key: 'menu.payment_failed', group: 'menu', defaultValue: 'Payment Failed', description: 'Payment failed heading', translations: { am: 'ክፍያ አልተሳካም', om: 'Kaffaltiin Hin Milkoofne' } },
      { key: 'menu.payment_failed_msg', group: 'menu', defaultValue: 'Your order was placed but payment could not be processed.', description: 'Payment failed message', translations: { am: 'ትዕዛዝዎ ተሰጥቷል ግን ክፍያው አልተሳካም።', om: 'Ajajaan ergameera garuu kaffaltiin hin hojjenne.' } },
      { key: 'menu.back_to_menu', group: 'menu', defaultValue: 'Back to Menu', description: 'Back to menu button', translations: { am: 'ወደ ምናዝ ይመለሱ', om: 'Makalaatti Deebii' } },
      { key: 'menu.payment', group: 'menu', defaultValue: 'Payment', description: 'Payment heading', translations: { am: 'ክፍያ', om: 'Kaffaltii' } },
      { key: 'menu.choose_how_to_pay', group: 'menu', defaultValue: 'Choose how to pay', description: 'Payment method selection', translations: { am: 'እንዴት እንደሚከፍሉ ይምረጡ', om: 'Akkaatin kaffattu filadhu' } },
      { key: 'menu.order_summary', group: 'menu', defaultValue: 'Order Summary', description: 'Order summary heading', translations: { am: 'የትዕዛዝ ማጠቃለያ', om: 'Cuunfa Ajajaa' } },
      { key: 'menu.subtotal', group: 'menu', defaultValue: 'Subtotal', description: 'Subtotal label', translations: { am: 'ንዑስ ድምር', om: 'Walitti Qabamee' } },
      { key: 'menu.discount', group: 'menu', defaultValue: 'Discount', description: 'Discount label', translations: { am: 'ቅናሽ', om: 'Gatiin Laafaa' } },
      { key: 'menu.coupon', group: 'menu', defaultValue: 'Coupon', description: 'Coupon label', translations: { am: 'ኩፖን', om: 'Kuupoonii' } },
      { key: 'menu.loyalty_points', group: 'menu', defaultValue: 'Loyalty Points', description: 'Loyalty points label', translations: { am: 'የታማኝነት ነጥቦች', om: 'Qabxii Aango' } },
      { key: 'menu.tax', group: 'menu', defaultValue: 'Tax', description: 'Tax label', translations: { am: 'ግብር', om: 'Belaa' } },
      { key: 'menu.service', group: 'menu', defaultValue: 'Service', description: 'Service charge label', translations: { am: 'አገልግሎት', om: 'Tajaajila' } },
      { key: 'menu.total', group: 'menu', defaultValue: 'Total', description: 'Total label', translations: { am: 'ጠቅላላ', om: 'Walumaagalatti' } },
      { key: 'menu.payment_method', group: 'menu', defaultValue: 'Payment Method', description: 'Payment method label', translations: { am: 'የክፍያ ዘዴ', om: 'Qabiyyee Kaffaltii' } },
      { key: 'menu.placing_order', group: 'menu', defaultValue: 'Placing Order...', description: 'Placing order state', translations: { am: 'ትዕዛዝ በሂደት ላይ...', om: 'Ajajaa Ergaa jira...' } },
      { key: 'menu.place_order', group: 'menu', defaultValue: 'Place Order', description: 'Place order button', translations: { am: 'ትዕዛዝ ይስጡ', om: 'Ajajaa Ergaa' } },
      { key: 'menu.proceed_to_payment', group: 'menu', defaultValue: 'Proceed to Payment', description: 'Proceed to payment button', translations: { am: 'ወደ ክፍያ ይሂዱ', om: 'Kaffaltiitti Fufaa' } },
      { key: 'menu.call_waiter', group: 'menu', defaultValue: 'Call Waiter', description: 'Call waiter button', translations: { am: 'አገልጋዩን ይጥሩ', om: 'Tajaajilaa Waamichaa' } },
      { key: 'menu.how_can_we_help', group: 'menu', defaultValue: 'How can we help you?', description: 'Help question', translations: { am: 'እንዴት ልረዳዎ እንችላለን?', om: 'Maal isin gargaaru?' } },
      { key: 'menu.send', group: 'menu', defaultValue: 'Send', description: 'Send button', translations: { am: 'ላክ', om: 'Ergi' } },
      { key: 'menu.thank_you_feedback', group: 'menu', defaultValue: 'Thank you for your feedback!', description: 'Feedback thanks', translations: { am: 'ለአስተያየትዎ እናመሰግናለን!', om: 'Wabii keessaniif galatoomaa!' } },
      { key: 'menu.how_was_experience', group: 'menu', defaultValue: 'How was your experience?', description: 'Experience question', translations: { am: 'ልምድዎ እንዴት ነበር?', om: 'Qabiyyee keessan akkam ture?' } },
      { key: 'menu.skip', group: 'menu', defaultValue: 'Skip', description: 'Skip button', translations: { am: 'ዝለል', om: 'Daangi' } },
      { key: 'menu.share_thoughts', group: 'menu', defaultValue: 'Share your thoughts (optional)...', description: 'Feedback placeholder', translations: { am: 'አስተያየትዎን ያካፍሉ (አማራጭ)...', om: 'Yaada keessan qoodaa (filannoo)...' } },
      { key: 'menu.submit_review', group: 'menu', defaultValue: 'Submit Review', description: 'Submit review button', translations: { am: 'ግምገማ ያስገቡ', om: 'Qorannoo Ergaa' } },
      { key: 'menu.select_at_least', group: 'menu', defaultValue: 'Please select at least {n} option(s)', description: 'Min selection error', translations: { am: 'እባክዎ ቢያንስ {n} አማራጭ ይምረጡ', om: 'Filannoo {n} filadhaa' } },
      { key: 'menu.share_item', group: 'menu', defaultValue: 'Share item', description: 'Share item button', translations: { am: 'ዕቃ ያካፍሉ', om: 'Wanti Qoodaa' } },
      { key: 'menu.item', group: 'menu', defaultValue: 'Item', description: 'Item label', translations: { am: 'ዕቃ', om: 'Wanta' } },
      { key: 'menu.each', group: 'menu', defaultValue: 'each', description: 'Each label', translations: { am: 'እያንዳንዱ', om: 'Tokkoon tokkoon' } },
      { key: 'menu.you_save', group: 'menu', defaultValue: 'You save', description: 'Savings label', translations: { am: 'ይቆጥባሉ', om: 'Ati Qusattaa' } },
      { key: 'menu.ingredients', group: 'menu', defaultValue: 'Ingredients', description: 'Ingredients heading', translations: { am: 'ንጥረ ነገሮች', om: 'Addii' } },
      { key: 'menu.removed', group: 'menu', defaultValue: 'removed', description: 'Ingredient removed', translations: { am: 'የተወገደ', om: 'Haafame' } },
      { key: 'menu.tap_to_remove', group: 'menu', defaultValue: 'Tap an ingredient to remove it from your dish', description: 'Remove ingredient instruction', translations: { am: 'ከዕቃዎ ለማስወገድ ንጥረ ነገሩን ይጫኑ', om: 'Addii nyaaftuu keessaa haquuf tuqaa' } },
      { key: 'menu.choose_1', group: 'menu', defaultValue: 'Choose 1', description: 'Select one option', translations: { am: '1 ይምረጡ', om: '1 Filadhu' } },
      { key: 'menu.choose_up_to', group: 'menu', defaultValue: 'Choose up to {n}', description: 'Select up to n options', translations: { am: 'እስከ {n} ይምረጡ', om: '{n} gudi filadhu' } },
      { key: 'menu.required', group: 'menu', defaultValue: 'Required', description: 'Required label', translations: { am: 'ያስፈልጋል', om: 'Barbaachisaa' } },
      { key: 'menu.add_note', group: 'menu', defaultValue: 'Add a note', description: 'Add note button', translations: { am: 'ማስታወሻ ያክሉ', om: 'Yaada Dabali' } },
      { key: 'menu.allergies_preferences', group: 'menu', defaultValue: 'Any allergies or preferences...', description: 'Allergies placeholder', translations: { am: 'ለአለርጂ ወይም ምርጫ...', om: 'Dhukkubbii ykn filannoo...' } },
      { key: 'menu.note_added', group: 'menu', defaultValue: 'Note added', description: 'Note added confirmation', translations: { am: 'ማስታወሻ ታክሏል', om: 'Yaadni Dabaleera' } },
      { key: 'menu.currently_unavailable', group: 'menu', defaultValue: 'Currently Unavailable', description: 'Item unavailable', translations: { am: 'በአሁኑ ጊዜ የለም', om: 'Amma Hin Jiru' } },
      { key: 'menu.added', group: 'menu', defaultValue: 'Added!', description: 'Item added confirmation', translations: { am: 'ታክሏል!', om: 'Dabaleera!' } },
      { key: 'menu.add_to_cart', group: 'menu', defaultValue: 'Add to Cart', description: 'Add to cart button', translations: { am: 'ወደ ጋሪ ያክሉ', om: 'Kartaatti Dabali' } },
      { key: 'menu.your_cart', group: 'menu', defaultValue: 'Your Cart', description: 'Cart heading', translations: { am: 'የእርስዎ ጋሪ', om: 'Kartaa Keessan' } },
      { key: 'menu.cart_empty', group: 'menu', defaultValue: 'Your cart is empty', description: 'Empty cart message', translations: { am: 'ጋሪዎ ባዶ ነው', om: 'Kartaan keessan duwwaa dha' } },
      { key: 'menu.have_coupon', group: 'menu', defaultValue: 'Have a coupon code?', description: 'Coupon prompt', translations: { am: 'የኩፖን ኮድ አሎት?', om: 'Koodii kuupoonii qabattaa?' } },
      { key: 'menu.enter_code', group: 'menu', defaultValue: 'Enter code', description: 'Coupon code placeholder', translations: { am: 'ኮድ ያስገቡ', om: 'Koodii galchi' } },
      { key: 'menu.apply', group: 'menu', defaultValue: 'Apply', description: 'Apply coupon button', translations: { am: 'ተግብር', om: 'Hojechii' } },
      { key: 'menu.using_pts', group: 'menu', defaultValue: 'Using {n} pts', description: 'Using points label', translations: { am: '{n} ነጥቦች በመጠቀም', om: '{n} qabxii fayyadamaa' } },
      { key: 'menu.use_pts', group: 'menu', defaultValue: 'Use {n} pts', description: 'Use points button', translations: { am: '{n} ነጥቦች ይጠቀሙ', om: '{n} qabxii fayyadami' } },
      { key: 'menu.save_amount', group: 'menu', defaultValue: 'Save {amount}', description: 'Save amount label', translations: { am: '{amount} ይቆጥቡ', om: '{amount} qusattaa' } },
      { key: 'menu.save_up_to', group: 'menu', defaultValue: 'Save up to {amount}', description: 'Save up to amount', translations: { am: 'እስከ {amount} ይቆጥቡ', om: '{amount} qusattaa' } },
      { key: 'menu.remove', group: 'menu', defaultValue: 'Remove', description: 'Remove button', translations: { am: 'አስወግድ', om: 'Haqi' } },
      { key: 'menu.invalid_coupon', group: 'menu', defaultValue: 'Invalid coupon code', description: 'Invalid coupon error', translations: { am: 'ልክ ያልሆነ ኩፖን ኮድ', om: 'Koodii kuupoonii dogoggoraa' } },
      { key: 'menu.minimum_order', group: 'menu', defaultValue: 'Minimum order {amount}', description: 'Minimum order amount', translations: { am: 'ዝቅተኛ ትዕዛዝ {amount}', om: 'Ajajaa xiqqaa {amount}' } },
      { key: 'menu.toast_accepted', group: 'menu', defaultValue: 'Your order has been confirmed!', description: 'Order confirmed toast', translations: { am: 'ትዕዛዝዎ ተረጋግጧል!', om: 'Ajajaan keessan mirkanaaʼeera!', ti: 'ትዕዛዝኩም ተረጋገጸ!', ar: 'تم تأكيد طلبك!' } },
      { key: 'menu.toast_preparing', group: 'menu', defaultValue: 'Kitchen is preparing your order', description: 'Order preparing toast', translations: { am: 'ምግት ቤት ትዕዛዝዎን እያዘጋጀ ነው', om: 'Qishinaan ajajaa keessan qophaa\'aa jira' } },
      { key: 'menu.toast_ready', group: 'menu', defaultValue: 'Your food is ready for pickup!', description: 'Order ready toast', translations: { am: 'ምግብዎ ለመውሰድ ዝግጁ ነው!', om: 'Nyaata keessan fudhachuuuf qophaa\'eera!' } },
      { key: 'menu.toast_picked_up', group: 'menu', defaultValue: 'Your waiter is on the way!', description: 'Order picked up toast', translations: { am: 'አገልጋዩ በመምጣት ላይ ነው!', om: 'Tajaajilaan dhufaa jira!' } },
      { key: 'menu.toast_served', group: 'menu', defaultValue: 'Your order has been served!', description: 'Order served toast', translations: { am: 'ትዕዛዝዎ ቀርቧል!', om: 'Ajajaan keessan dhiyaateera!' } },
      { key: 'menu.toast_completed', group: 'menu', defaultValue: 'Order completed. Thank you!', description: 'Order completed toast', translations: { am: 'ትዕዛዝ ተጠናቀቀ። እናመሰግናለን!', om: 'Ajajaan Xumurameera. Galatoomaa!' } },
      { key: 'menu.link_copied', group: 'menu', defaultValue: 'Link copied to clipboard!', description: 'Link copied toast', translations: { am: 'ማገናኛ ተገልቷል!', om: 'Linkii walitti qabameera!' } },
      { key: 'menu.share_failed', group: 'menu', defaultValue: 'Could not copy link', description: 'Share failed error', translations: { am: 'ማገናኛ መገልበት አልተሳካም', om: 'Linkii hin walitti qabanne' } },

      // ── Order Status (additional keys) ──────────────────────
      { key: 'order.status.accepted', group: 'order', defaultValue: 'Confirmed', description: 'Order confirmed status (waiter confirmed)', translations: { am: 'ተረጋግጧል', om: 'Mirkanaaʼeera', ti: 'ተረጋገጸ', ar: 'مؤكد' } },
      { key: 'order.status.picked_up', group: 'order', defaultValue: 'Picked Up', description: 'Order picked up status', translations: { am: 'ተወስዷል', om: "Fudhateera", ti: 'ተረክቡ', ar: 'تم الاستلام' } },
      { key: 'order.status.completed', group: 'order', defaultValue: 'Completed', description: 'Order completed status', translations: { am: 'ተጠናቀቀ', om: 'Xumurameera', ti: 'ተዛዚሙ', ar: 'مكتمل' } },
      { key: 'order.status.cancelled', group: 'order', defaultValue: 'Cancelled', description: 'Order cancelled status', translations: { am: 'ተሰርዟል', om: 'Dhiifameera', ti: 'ተሰሪዙ', ar: 'ملغي' } },
      { key: 'order.cancel_title', group: 'order', defaultValue: 'Cancel Order', description: 'Cancel order dialog title', translations: { am: 'ትዕዛዝ ሰርዝ', om: 'Ajajaa Dhiisi', ti: 'ትዕዛዝ ስርዝ', ar: 'إلغاء الطلب' } },
      { key: 'order.cancel_reason', group: 'order', defaultValue: 'Reason for cancellation', description: 'Cancel reason label', translations: { am: 'የሰርዛት ምክንያት', om: 'Sababa dhiisuu', ti: 'ናይ ስርዛት ምኽንያት', ar: 'سبب الإلغاء' } },
      { key: 'order.cancel_reason_placeholder', group: 'order', defaultValue: 'Enter reason...', description: 'Cancel reason placeholder', translations: { am: 'ምክንያት ያስገቡ...', om: 'Sababa galchi...', ti: 'ምኽንያት ኣእትዉ...', ar: 'أدخل السبب...' } },
      { key: 'order.confirm_cancel', group: 'order', defaultValue: 'Confirm Cancel', description: 'Confirm cancel button', translations: { am: 'ሰርዛት አረጋግጥ', om: 'Dhiisuu Mirkanaasi', ti: 'ስርዛት ኣረጋግጽ', ar: 'تأكيد الإلغاء' } },

      // ── Dashboard (additional ~40 keys) ──────────────────────
      { key: 'dashboard.restaurant_manager', group: 'dashboard', defaultValue: 'Restaurant Manager', description: 'Restaurant manager heading', translations: { am: 'የምግት ቤት አስተዳዳሪ', om: 'Bulchiinsa Makalaa', ti: 'ምግቢ ቤት መሪ', ar: 'مدير المطعم' } },
      { key: 'dashboard.loading_menu', group: 'dashboard', defaultValue: 'Loading menu...', description: 'Menu loading state', translations: { am: 'ምናዝ እየጫነ ነው...', om: 'Makala kenna jira...', ti: 'ሜኑ እየጸዓነ ኣሎ...', ar: 'جاري تحميل القائمة...' } },
      { key: 'dashboard.loading_orders', group: 'dashboard', defaultValue: 'Loading orders...', description: 'Orders loading state', translations: { am: 'ትዕዛዞች እየጫኑ ነው...', om: 'Ajajilee kenna jira...', ti: 'ትዕዛዛት እያቕረቡ ኣለዉ...', ar: 'جاري تحميل الطلبات...' } },
      { key: 'dashboard.loading_settings', group: 'dashboard', defaultValue: 'Loading settings...', description: 'Settings loading state', translations: { am: 'ቅንብሮች እየጫኑ ነው...', om: "Qindaa'ina kenna jira...", ti: 'ቅጥዒታት እያቕረቡ ኣለዉ...', ar: 'جاري تحميل الإعدادات...' } },
      { key: 'dashboard.loading_dashboard', group: 'dashboard', defaultValue: 'Loading dashboard...', description: 'Dashboard loading state', translations: { am: 'ዳሽቦርድ እየጫነ ነው...', om: 'Daashboordii kenna jira...', ti: 'ዳሽቦርድ እየጸዓነ ኣሎ...', ar: 'جاري تحميل لوحة التحكم...' } },
      { key: 'dashboard.split_bill', group: 'dashboard', defaultValue: 'Split Bill', description: 'Split bill button', translations: { am: 'ወጪ ይከፍሉ', om: 'Kaffaltii Qoodaa', ti: 'ዋጋ ምምቃም', ar: 'تقسيم الفاتورة' } },
      { key: 'dashboard.total', group: 'dashboard', defaultValue: 'Total', description: 'Total label', translations: { am: 'ጠቅላላ', om: 'Walumaagalatti', ti: 'ጠቓል', ar: 'الإجمالي' } },
      { key: 'dashboard.subtotal', group: 'dashboard', defaultValue: 'Subtotal', description: 'Subtotal label', translations: { am: 'ንዑስ ድምር', om: 'Walitti Qabamee', ti: 'ንኡስ ድምር', ar: 'المجموع الفرعي' } },
      { key: 'dashboard.tax', group: 'dashboard', defaultValue: 'Tax', description: 'Tax label', translations: { am: 'ግብር', om: 'Belaa', ti: 'ግብሪ', ar: 'الضريبة' } },
      { key: 'dashboard.service_charge', group: 'dashboard', defaultValue: 'Service Charge', description: 'Service charge label', translations: { am: 'የአገልግሎት ክፍያ', om: 'Kaffaltii Tajaajilaa', ti: 'ናይ ኣገልግሎት ክፍያ', ar: 'رسوم الخدمة' } },
      { key: 'dashboard.discount', group: 'dashboard', defaultValue: 'Discount', description: 'Discount label', translations: { am: 'ቅናሽ', om: 'Gatiin Laafaa', ti: 'ቅናሽ', ar: 'خصم' } },
      { key: 'dashboard.all', group: 'dashboard', defaultValue: 'All', description: 'All filter', translations: { am: 'ሁሉም', om: 'Hunda', ti: 'ኩሉ', ar: 'الكل' } },
      { key: 'dashboard.completed_orders', group: 'dashboard', defaultValue: 'Completed', description: 'Completed orders tab', translations: { am: 'የተጠናቀቁ', om: 'Xumuramaniiru', ti: 'ዝተዛዘሙ', ar: 'مكتمل' } },
      { key: 'dashboard.order', group: 'dashboard', defaultValue: 'Order', description: 'Order label', translations: { am: 'ትዕዛዝ', om: 'Ajajaa', ti: 'ትዕዛዝ', ar: 'طلب' } },
      { key: 'dashboard.table_label', group: 'dashboard', defaultValue: 'Table', description: 'Table label', translations: { am: 'ጠረጴዛ', om: 'Meecha', ti: 'ጠረጴዛ', ar: 'طاولة' } },
      { key: 'dashboard.customer', group: 'dashboard', defaultValue: 'Customer', description: 'Customer label', translations: { am: 'ደንበኛ', om: 'Maatii', ti: 'ደላላ', ar: 'عميل' } },
      { key: 'dashboard.walk_in', group: 'dashboard', defaultValue: 'Walk-in', description: 'Walk-in customer type', translations: { am: 'ቀጥታ', om: 'Kallattii', ti: 'ቀጥታ', ar: 'زيارة مباشرة' } },
      { key: 'dashboard.type', group: 'dashboard', defaultValue: 'Type', description: 'Type label', translations: { am: 'አይነት', om: 'Gosa', ti: 'ዓይነት', ar: 'النوع' } },
      { key: 'dashboard.time', group: 'dashboard', defaultValue: 'Time', description: 'Time label', translations: { am: 'ሰዓት', om: "Sa'aatii", ti: 'ሰዓት', ar: 'الوقت' } },
      { key: 'dashboard.notes', group: 'dashboard', defaultValue: 'Notes', description: 'Notes label', translations: { am: 'ማስታወሻዎች', om: 'Yaada', ti: 'ማስታወሻ', ar: 'ملاحظات' } },
      { key: 'dashboard.items_count', group: 'dashboard', defaultValue: 'items', description: 'Items count label', translations: { am: 'ዕቃዎች', om: 'wantoota', ti: 'ኣቕሓታት', ar: 'عناصر' } },
      { key: 'dashboard.mark_as', group: 'dashboard', defaultValue: 'Mark as', description: 'Mark as label', translations: { am: 'ምልክት አድርግ', om: 'Mallattoo gochi', ti: 'ምልክት ኣድርግ', ar: 'وضع علامة' } },
      { key: 'dashboard.no_orders_found', group: 'dashboard', defaultValue: 'No orders found', description: 'No orders message', translations: { am: 'ትዕዛዞች አልተገኙም', om: 'Ajajileen hin argamne', ti: 'ትዕዛዛት ኣይተረኽቡን', ar: 'لم يتم العثور على طلبات' } },
      { key: 'dashboard.refresh', group: 'dashboard', defaultValue: 'Refresh', description: 'Refresh button', translations: { am: 'አድስ', om: 'Haaraa', ti: 'ኣድስ', ar: 'تحديث' } },
      { key: 'dashboard.today_orders', group: 'dashboard', defaultValue: "Today's Orders", description: 'Today orders heading', translations: { am: 'የዛሬ ትዕዛዞች', om: "Ajajilee Har'aa", ti: 'ናይ ሎሚ ትዕዛዛት', ar: 'طلبات اليوم' } },
      { key: 'dashboard.live_data', group: 'dashboard', defaultValue: 'Live Data', description: 'Live data indicator', translations: { am: 'ቀጥታ ውሂብ', om: 'Daataa Kallattii', ti: 'ቀጥታ ዳታ', ar: 'بيانات مباشرة' } },
      { key: 'dashboard.revenue', group: 'dashboard', defaultValue: 'Revenue', description: 'Revenue metric', translations: { am: 'ገቢ', om: 'Galaana', ti: 'ኣታዊ', ar: 'الإيرادات' } },
      { key: 'dashboard.active_tables', group: 'dashboard', defaultValue: 'Active Tables', description: 'Active tables metric', translations: { am: 'ንቁ ጠረጴዛዎች', om: 'Meechaalee Hojii', ti: 'ንቁ ጠረጴዛታት', ar: 'طاولات نشطة' } },
      { key: 'dashboard.pending_orders', group: 'dashboard', defaultValue: 'Pending Orders', description: 'Pending orders metric', translations: { am: 'በመጠባበቅ ላይ ትዕዛዞች', om: 'Ajajilee Eegaa', ti: 'ኣብ መጠቕለሊ ዘለዉ ትዕዛዛት', ar: 'طلبات معلقة' } },
      { key: 'dashboard.preparing', group: 'dashboard', defaultValue: 'Preparing', description: 'Preparing status', translations: { am: 'እያዘጋጀ ነው', om: "Qophaa'aa", ti: 'እያዘጋጀ ኣሎ', ar: 'قيد التحضير' } },
      { key: 'dashboard.ready_count', group: 'dashboard', defaultValue: 'Ready', description: 'Ready status count', translations: { am: 'ዝግጁ', om: "Qophaa'eera", ti: 'ድሉይ', ar: 'جاهز' } },
      { key: 'dashboard.quick_actions', group: 'dashboard', defaultValue: 'Quick Actions', description: 'Quick actions section', translations: { am: 'ፈጣን ተግባራት', om: 'Tarkaanfii Ariifataa', ti: 'ቅልጡፍ ተግባራት', ar: 'إجراءات سريعة' } },
      { key: 'dashboard.new_order', group: 'dashboard', defaultValue: 'New Order', description: 'New order button', translations: { am: 'አዲስ ትዕዛዝ', om: 'Ajajaa Haaraa', ti: 'ሓድሽ ትዕዛዝ', ar: 'طلب جديد' } },
      { key: 'dashboard.manage_menu', group: 'dashboard', defaultValue: 'Manage Menu', description: 'Manage menu button', translations: { am: 'ምናዝ ያስተዳድሩ', om: 'Makala Bulchaa', ti: 'ሜኑ ኣስተዳድር', ar: 'إدارة القائمة' } },
      { key: 'dashboard.recent_orders', group: 'dashboard', defaultValue: 'Recent Orders', description: 'Recent orders section', translations: { am: 'የቅርብ ጊዜ ትዕዛዞች', om: 'Ajajilee Dhiyoo', ti: 'ናይ ቀረባ ግዜ ትዕዛዛት', ar: 'طلبات حديثة' } },
      { key: 'dashboard.view_all', group: 'dashboard', defaultValue: 'View All', description: 'View all button', translations: { am: 'ሁሉንም ይመልከቱ', om: 'Hunda Ilaalaa', ti: 'ኩሉ ርአ', ar: 'عرض الكل' } },
      { key: 'dashboard.no_orders', group: 'dashboard', defaultValue: 'No orders yet', description: 'No orders message', translations: { am: 'እስካሁን ትዕዛዞች የሉም', om: 'Ajajilee hin jiru', ti: 'ትዕዛዛት የለን', ar: 'لا توجد طلبات بعد' } },
      { key: 'dashboard.order_status', group: 'dashboard', defaultValue: 'Order Status', description: 'Order status heading', translations: { am: 'የትዕዛዝ ሁኔታ', om: 'Haala Ajajaa', ti: 'ናይ ትዕዛዝ ኩነታት', ar: 'حالة الطلب' } },
      { key: 'dashboard.analytics', group: 'dashboard', defaultValue: 'Analytics', description: 'Analytics tab', translations: { am: 'ትንተና', om: 'Qorannoo', ti: 'ትንተና', ar: 'التحليلات' } },
      { key: 'dashboard.localization', group: 'dashboard', defaultValue: 'Localization', description: 'Localization tab', translations: { am: 'ቋንቋ', om: 'Afaan', ti: 'ቋንቋ', ar: 'التوطين' } },
      { key: 'dashboard.select_branch', group: 'dashboard', defaultValue: 'Select Branch', description: 'Branch selector', translations: { am: 'ቅርንጫት ይምረጡ', om: 'Lafoo Filadhu', ti: 'ቅርንጫዕ ምረጽ', ar: 'اختر الفرع' } },
      { key: 'dashboard.branch', group: 'dashboard', defaultValue: 'Branch', description: 'Branch label', translations: { am: 'ቅርንጫት', om: 'Lafoo', ti: 'ቅርንጫዕ', ar: 'فرع' } },
      { key: 'dashboard.main', group: 'dashboard', defaultValue: 'Main', description: 'Main branch label', translations: { am: 'ዋና', om: 'Ijoo', ti: 'ቀንዲ', ar: 'رئيسي' } },

      // ── Settings (15 keys) ──────────────────────────────────
      { key: 'settings.save_changes', group: 'settings', defaultValue: 'Save Changes', description: 'Save changes button', translations: { am: 'ለውጦች ያስቀምጡ', om: "Jijjiirama Qindaa'i" } },
      { key: 'settings.to', group: 'settings', defaultValue: 'to', description: 'Time range connector', translations: { am: 'እስከ', om: 'gabba' } },
      { key: 'settings.closed', group: 'settings', defaultValue: 'Closed', description: 'Closed status', translations: { am: 'ዝግ ነው', om: 'Cufameera' } },
      { key: 'settings.save_hours', group: 'settings', defaultValue: 'Save Hours', description: 'Save hours button', translations: { am: 'ሰዓታት ያስቀምጡ', om: "Sa'aatii Qindaa'i" } },
      { key: 'settings.tax_rate', group: 'settings', defaultValue: 'Tax Rate', description: 'Tax rate label', translations: { am: 'የግብር መጠን', om: 'Qabxaa Belaa' } },
      { key: 'settings.service_charge_pct', group: 'settings', defaultValue: 'Service Charge %', description: 'Service charge percent', translations: { am: 'የአገልግሎት ክፍያ %', om: 'Kaffaltii Tajaajilaa %' } },
      { key: 'settings.currency', group: 'settings', defaultValue: 'Currency', description: 'Currency label', translations: { am: 'ገንዘብ', om: 'Maallaqaa' } },
      { key: 'settings.default_language', group: 'settings', defaultValue: 'Default Language', description: 'Default language label', translations: { am: 'ነባሪ ቋንቋ', om: 'Afaan Durtii' } },
      { key: 'settings.save_settings', group: 'settings', defaultValue: 'Save Settings', description: 'Save settings button', translations: { am: 'ቅንብሮች ያስቀምጡ', om: "Qindaa'ina Qindaa'i" } },
      { key: 'settings.save_payment', group: 'settings', defaultValue: 'Save Payment', description: 'Save payment button', translations: { am: 'ክፍያ ያስቀምጡ', om: "Kaffaltii Qindaa'i" } },
      { key: 'settings.restaurant_profile', group: 'settings', defaultValue: 'Restaurant Profile', description: 'Profile section', translations: { am: 'የምግት ቤት መገለጫ', om: 'Piroofilii Makalaa' } },
      { key: 'settings.working_hours', group: 'settings', defaultValue: 'Working Hours', description: 'Working hours section', translations: { am: 'የስራ ሰዓታት', om: "Sa'aatii Hojii" } },
      { key: 'settings.tax_service', group: 'settings', defaultValue: 'Tax & Service', description: 'Tax and service section', translations: { am: 'ግብር እና አገልግሎት', om: 'Belaa fi Tajaajila' } },
      { key: 'settings.payment_methods', group: 'settings', defaultValue: 'Payment Methods', description: 'Payment methods section', translations: { am: 'የክፍያ ዘዴዎች', om: 'Qabiyyee Kaffaltii' } },
      { key: 'settings.security', group: 'settings', defaultValue: 'Security', description: 'Security section', translations: { am: 'ደህንነት', om: 'Nageenya' } },

      // ── Reservation (30 keys) ────────────────────────────────
      { key: 'reservation.title', group: 'reservation', defaultValue: 'Reserve a Table', description: 'Reservation title', translations: { am: 'ጠረጴዛ ያስይዙ', om: 'Meecha Eegaa' } },
      { key: 'reservation.desc', group: 'reservation', defaultValue: 'Book a table at {name}', description: 'Reservation description', translations: { am: 'በ{name} ጠረጴዛ ያስይዙ', om: '{name} irratti meecha eegaa' } },
      { key: 'reservation.success_desc', group: 'reservation', defaultValue: 'Your reservation request has been submitted!', description: 'Reservation success description', translations: { am: 'የቦታ ማስያ ጥያቄዎ ተልኳል!', om: 'Gaaffiin eegumsa keessan ergameera!' } },
      { key: 'reservation.success_title', group: 'reservation', defaultValue: 'Reservation Submitted!', description: 'Reservation success title', translations: { am: 'ቦታ ማስያ ተልኳል!', om: 'Eegumsi Ergameera!' } },
      { key: 'reservation.success_message', group: 'reservation', defaultValue: "We'll confirm your reservation shortly.", description: 'Reservation success message', translations: { am: 'ቦታ ማስያዎን በቅርበት እናረጋግጣለን።', om: 'Eegumsa keessaniif dhihaatu mirkanaa\'na.' } },
      { key: 'reservation.guest', group: 'reservation', defaultValue: 'guest', description: 'Single guest label', translations: { am: 'እንግዳ', om: 'Meecha' } },
      { key: 'reservation.guests', group: 'reservation', defaultValue: 'guests', description: 'Multiple guests label', translations: { am: 'እንግዶች', om: 'Meechaalee' } },
      { key: 'reservation.done', group: 'reservation', defaultValue: 'Done', description: 'Done button', translations: { am: 'ተከናወነ', om: 'Xumurameera' } },
      { key: 'reservation.error_title', group: 'reservation', defaultValue: 'Reservation Failed', description: 'Reservation error title', translations: { am: 'ቦታ ማስያ አልተሳካም', om: 'Eegumsi Hin Milkoofne' } },
      { key: 'reservation.error_default', group: 'reservation', defaultValue: 'Failed to create reservation.', description: 'Reservation error message', translations: { am: 'ቦታ ማስያ መፍጠር አልተሳካም።', om: 'Eegumsi uumuu hin dandeessine.' } },
      { key: 'reservation.error_network', group: 'reservation', defaultValue: 'Network error.', description: 'Network error message', translations: { am: 'የአውታረ መረብ ስህተት።', om: 'Dogoggorri sasaabaa.' } },
      { key: 'reservation.close', group: 'reservation', defaultValue: 'Close', description: 'Close button', translations: { am: 'ዝጋ', om: 'Cufi' } },
      { key: 'reservation.try_again', group: 'reservation', defaultValue: 'Try Again', description: 'Try again button', translations: { am: 'እንደገና ይሞክሩ', om: 'Irri deebi\'i Yaali' } },
      { key: 'reservation.date', group: 'reservation', defaultValue: 'Date', description: 'Date label', translations: { am: 'ቀን', om: 'Guyyaa' } },
      { key: 'reservation.date_past', group: 'reservation', defaultValue: 'Please select a future date', description: 'Past date error', translations: { am: 'እባክዎ የወደፊት ቀን ይምረጡ', om: 'Guyyaa dhiyoo filadhaa' } },
      { key: 'reservation.time', group: 'reservation', defaultValue: 'Time', description: 'Time label', translations: { am: 'ሰዓት', om: 'Sa\'aatii' } },
      { key: 'reservation.no_slots', group: 'reservation', defaultValue: 'No available time slots', description: 'No time slots message', translations: { am: 'የሰዓት ክፍል የለም', om: 'Sa\'aatii dhangala hin jiru' } },
      { key: 'reservation.select_date_first', group: 'reservation', defaultValue: 'Please select a date first', description: 'Select date first message', translations: { am: 'እባክዎ መጀመሪያ ቀን ይምረጡ', om: 'Guyyaa jalqaba filadhaa' } },
      { key: 'reservation.party_size', group: 'reservation', defaultValue: 'Party Size', description: 'Party size label', translations: { am: 'የቡድን መጠን', om: 'Gosoota Baay\'ee' } },
      { key: 'reservation.name', group: 'reservation', defaultValue: 'Your Name', description: 'Name label', translations: { am: 'የእርስዎ ስም', om: 'Maqaa Keessan' } },
      { key: 'reservation.name_placeholder', group: 'reservation', defaultValue: 'e.g. Abebe Kebede', description: 'Name placeholder', translations: { am: 'ለምሳሌ አበበ ከበደ', om: 'fkn. Abebe Kebede' } },
      { key: 'reservation.phone', group: 'reservation', defaultValue: 'Phone Number', description: 'Phone label', translations: { am: 'የስልክ ቁጥር', om: 'Lakkoofsa Bilbilaa' } },
      { key: 'reservation.phone_placeholder', group: 'reservation', defaultValue: 'e.g. +251 912 345 678', description: 'Phone placeholder', translations: { am: 'ለምሳሌ +251 912 345 678', om: 'fkn. +251 912 345 678' } },
      { key: 'reservation.email', group: 'reservation', defaultValue: 'Email', description: 'Email label', translations: { am: 'ኢሜይል', om: 'Imeel' } },
      { key: 'reservation.optional', group: 'reservation', defaultValue: 'optional', description: 'Optional label', translations: { am: 'አማራጭ', om: 'filannoo' } },
      { key: 'reservation.email_placeholder', group: 'reservation', defaultValue: 'e.g. abebe@email.com', description: 'Email placeholder', translations: { am: 'ለምሳሌ abebe@email.com', om: 'fkn. abebe@email.com' } },
      { key: 'reservation.special_requests', group: 'reservation', defaultValue: 'Special Requests', description: 'Special requests label', translations: { am: 'ልዩ ጥያቄዎች', om: 'Gaaffii Addaa' } },
      { key: 'reservation.special_requests_placeholder', group: 'reservation', defaultValue: 'e.g. High chair needed...', description: 'Special requests placeholder', translations: { am: 'ለምሳሌ ከፍተኛ ወንበር ያስፈልጋል...', om: "fkn. Mo'oo ol'aanaa barbaachisa..." } },
      { key: 'reservation.submitting', group: 'reservation', defaultValue: 'Submitting...', description: 'Submitting state', translations: { am: 'እያስገባ ነው...', om: 'Ergaa jira...' } },
      { key: 'reservation.submit', group: 'reservation', defaultValue: 'Reserve Table', description: 'Reserve table button', translations: { am: 'ጠረጴዛ ያስይዙ', om: 'Meecha Eegaa' } },
      { key: 'reservation.disclaimer', group: 'reservation', defaultValue: 'Reservation is subject to confirmation.', description: 'Reservation disclaimer', translations: { am: 'ቦታ ማስያ ማረጋገጫን ይጠይቃል።', om: 'Eegumsi mirkanaa\'uu gaafata.' } },
      { key: 'reservation.reserve_table', group: 'reservation', defaultValue: 'Reserve a Table', description: 'Reserve table heading', translations: { am: 'ጠረጴዛ ያስይዙ', om: 'Meecha Eegaa' } },

      // ── Welcome (1 key) ─────────────────────────────────────
      { key: 'welcome.view_menu', group: 'welcome', defaultValue: 'View Menu', description: 'View menu button', translations: { am: 'ምናዝ ይመልከቱ', om: 'Makala Ilaalaa' } },

      // ── Restaurant (additional) ──────────────────────────────
      { key: 'restaurant.scanned_qr', group: 'restaurant', defaultValue: 'You scanned the QR code', description: 'QR scanned message', translations: { am: 'QR ኮዱን አስተነትተዋል', om: 'Koodii QR scanneessitan' } },

      // ── Auth (additional) ────────────────────────────────────
      { key: 'auth.restaurant_inactive', group: 'auth', defaultValue: 'This restaurant is currently inactive.', description: 'Restaurant inactive error', translations: { am: 'ይህ ምግት ቤት በአሁኑ ጊዜ ንቁ አይደለም።', om: 'Makala kun amma hojii hin jiru.' } },
      { key: 'auth.restaurant_suspended', group: 'auth', defaultValue: 'This restaurant has been suspended.', description: 'Restaurant suspended error', translations: { am: 'ይህ ምግት ቤት ተከልክሏል።', om: 'Makala kun dhorkameera.' } },

      // ── Landing (additional) ─────────────────────────────────
      { key: 'landing.hero_title', group: 'landing', defaultValue: 'QR-Powered Restaurant Management', description: 'Landing hero title', translations: { am: 'በQR የሚሰራ የምግት ቤት አስተዳደር', om: 'Bulchiinsa Makalaa QR-n Hojjetu' } },
      { key: 'landing.hero_subtitle', group: 'landing', defaultValue: 'Scan, Order, Enjoy — The Future of Dining', description: 'Landing hero subtitle', translations: { am: 'ይይቁ፣ ያዝዙ፣ ያጫውቱ — የምግብ አግስት የወደፊት', om: 'Scannee, Ajajaa, Fayyadadhaa — Tuulama Nyaataa' } },
      { key: 'landing.cta_start', group: 'landing', defaultValue: 'Get Started Free', description: 'CTA get started button', translations: { am: 'ከክፍያ ነፃ ይጀምሩ', om: 'Bilchaataa Jalqabaa' } },
      { key: 'landing.cta_demo', group: 'landing', defaultValue: 'See Demo', description: 'CTA demo button', translations: { am: 'ማሳያ ይመልከቱ', om: 'Agiinaa Ilaalaa' } },
      { key: 'landing.feature_qr', group: 'landing', defaultValue: 'QR Code Ordering', description: 'QR feature title', translations: { am: 'QR ኮድ ማዘዝ', om: 'Ajajaa Koodii QR' } },
      { key: 'landing.feature_qr_desc', group: 'landing', defaultValue: 'Customers scan a QR code at their table to browse the menu and place orders instantly.', description: 'QR feature description', translations: { am: 'ደንበኞች በጠረጴዛቸው QR ኮድ በማስተንትን ምናዙን ለማሰስ እና ፈጣን ትዕዛዝ ለመስጠት።', om: 'Meechaalee koodii QR scanneessanii makala ilaaluu fi ajajaa ariifataa erguu.' } },
      { key: 'landing.feature_kitchen', group: 'landing', defaultValue: 'Kitchen Display System', description: 'Kitchen feature title', translations: { am: 'የምግት ቤት ማሳያ ስርዓት', om: 'Sisteemii Agarsiisaa Qishinaa' } },
      { key: 'landing.feature_kitchen_desc', group: 'landing', defaultValue: 'Real-time kitchen display with multi-station support for efficient order preparation.', description: 'Kitchen feature description', translations: { am: 'በእውነተ-ጊዜ የምግት ቤት ማሳያ ብዙ ጣቢያ ድጋፍ ለብቃት ያለ ትዕዛዝ ዝግጁነት።', om: "Agarsiisa qishinaa kallattii deeggarsa bu'aa dabalataa qabu qophaa'uu ajajaa hundumtiif." } },
      { key: 'landing.feature_multilingual', group: 'landing', defaultValue: 'Multilingual Menu', description: 'Multilingual feature title', translations: { am: 'ባለብዙ-ቋንቋ ምናዝ', om: 'Makala Afaan Dabalataa' } },
      { key: 'landing.feature_multilingual_desc', group: 'landing', defaultValue: 'Serve your menu in Amharic, Oromo, English, Arabic, and more — auto-translated with AI.', description: 'Multilingual feature description', translations: { am: 'ምናዝዎን በአማርኛ፣ ኦሮምኛ፣ እንግሊዝኛ፣ አረብኛ እና ሌሎች ያቅርቡ — በAI ራስ-ሰር ትርጉም።', om: 'Makala keessan Afaan Oromoo, Amariffaa, Ingiliffaa, Arabiffaa fi kan biroo - AI-n jaalqabi.' } },
      { key: 'landing.feature_analytics', group: 'landing', defaultValue: 'Analytics & Insights', description: 'Analytics feature title', translations: { am: 'ትንተና እና ግንዛቤዎች', om: 'Qorannoo fi Hubannoo' } },
      { key: 'landing.feature_analytics_desc', group: 'landing', defaultValue: 'Track revenue, popular items, peak hours, and customer behavior in real time.', description: 'Analytics feature description', translations: { am: 'ገቢ፣ ታዋቂ ዕቃዎች፣ የከፍተኛ ሰዓታት እና የደንበኛ ባህሪ በእውነተ-ጊዜ ይከታተሉ።', om: 'Galaana, wantoota beekamoo, sa\'aatii ol aanaa fi dhangii maatii kallattii hordoffaa.' } },
      { key: 'landing.feature_payments', group: 'landing', defaultValue: 'Integrated Payments', description: 'Payments feature title', translations: { am: 'የተቀናጀ ክፍያ', om: 'Kaffaltii Walitti Qabatame' } },
      { key: 'landing.feature_payments_desc', group: 'landing', defaultValue: 'Accept Telebirr, Chapa, CBE Birr, and cash — all tracked and reconciled automatically.', description: 'Payments feature description', translations: { am: 'ቴሌብር፣ ቻፓ፣ ሲቢኢ ብር እና ጥሬ ገንዘብ ይቀበሉ — ሁሉም በራስ-ሰር ይከታተላል እና ይስማማል።', om: 'Telebirr, Chapa, CBE Birr fi maallaqaa fudhaa - hundi isaa ofiin hordoffama.' } },
      { key: 'landing.pricing.free', group: 'landing', defaultValue: 'Free', description: 'Free plan name', translations: { am: 'ነፃ', om: 'Bilchaata' } },
      { key: 'landing.pricing.per_month', group: 'landing', defaultValue: '/month', description: 'Per month label', translations: { am: '/ወር', om: "/ji'a" } },
      { key: 'landing.pricing.pro_price', group: 'landing', defaultValue: '49 ETB', description: 'Pro plan price', translations: { am: '49 ብር', om: '49 ETB' } },
      { key: 'landing.pricing.premium_price', group: 'landing', defaultValue: '99 ETB', description: 'Premium plan price', translations: { am: '99 ብር', om: '99 ETB' } },
      { key: 'landing.pricing.pro_features', group: 'landing', defaultValue: '5 branches, 50 tables, advanced analytics, multilingual, AI assistant', description: 'Pro plan features', translations: { am: '5 ቅርንጫቶች፣ 50 ጠረጴዛዎች፣ የላቀ ትንተና፣ ባለብዙ-ቋንቋ፣ AI ረዳት', om: "Lafoo 5, meechaalee 50, qorannoo olaanaa, afaan dabalataa, gargaarsa AI" } },
      { key: 'landing.pricing.premium_features', group: 'landing', defaultValue: 'Unlimited branches, unlimited tables, priority support, custom branding, API access', description: 'Premium plan features', translations: { am: 'ያልተገደቡ ቅርንጫቶች፣ ያልተገደቡ ጠረጴዛዎች፣ ቅድሚያ ድጋፍ፣ ብጁ ስም፣ API ተደራሽነት', om: 'Lafoo hin dagatamne, meechaalee hin dagatamne, deeggarsa furtuu, maqaa dhuunfaa, argannoo API' } },
    ];

    // Upsert all missing UI strings
    let createdCount = 0;
    let updatedCount = 0;

    for (const str of uiStrings) {
      const result = await prisma.uIString.upsert({
        where: { key: str.key },
        update: {
          group: str.group,
          defaultValue: str.defaultValue,
          description: str.description,
          translations: JSON.stringify(str.translations),
        },
        create: {
          key: str.key,
          group: str.group,
          defaultValue: str.defaultValue,
          description: str.description,
          translations: JSON.stringify(str.translations),
          isActive: true,
        },
      });
      // Check if it was created or updated by counting
      const existed = await prisma.uIString.findUnique({
        where: { key: str.key },
        select: { createdAt: true, updatedAt: true },
      });
      if (existed && existed.createdAt.getTime() === existed.updatedAt.getTime()) {
        createdCount++;
      } else {
        createdCount++; // For upsert, we count as seeded
      }
    }

    // Simpler counting: just count all upserts
    createdCount = uiStrings.length;

    console.log(`\n✅ Missing i18n keys seeded: ${createdCount}`);
    console.log(`   Groups covered: common, menu, dashboard, settings, reservation, welcome, restaurant, auth, landing`);
    console.log(`   Languages included: en (default), am, om`);

    // Summary by group
    const groupCounts = {};
    for (const str of uiStrings) {
      groupCounts[str.group] = (groupCounts[str.group] || 0) + 1;
    }
    console.log('\n   Breakdown by group:');
    for (const [group, count] of Object.entries(groupCounts).sort()) {
      console.log(`     ${group}: ${count} keys`);
    }

    console.log('\n🌐 Missing i18n seed complete!');

  } catch (error) {
    console.error('Seed error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
