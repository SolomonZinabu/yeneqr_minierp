// ============================================================
// Yene QR — i18n Seed Script (Direct DB)
// Seeds languages, UI strings, restaurant languages, and i18n data
// ============================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌐 Seeding i18n data...\n');

    // 1. Seed Languages
    const languages = [
      { code: 'en', name: 'English', nameLocal: 'English', direction: 'ltr', fontFamily: null, flagEmoji: null, sortOrder: 0, isActive: true },
      { code: 'am', name: 'Amharic', nameLocal: '\u12A0\u121B\u122A\u12AD', direction: 'ltr', fontFamily: 'Noto Sans Ethiopic', flagEmoji: null, sortOrder: 1, isActive: true },
      { code: 'om', name: 'Oromo', nameLocal: 'Afaan Oromoo', direction: 'ltr', fontFamily: 'Noto Sans Ethiopic', flagEmoji: null, sortOrder: 2, isActive: true },
      { code: 'ti', name: 'Tigrinya', nameLocal: '\u1275\u130D\u122D\u12AB', direction: 'ltr', fontFamily: 'Noto Sans Ethiopic', flagEmoji: null, sortOrder: 3, isActive: true },
      { code: 'so', name: 'Somali', nameLocal: 'Soomaali', direction: 'ltr', fontFamily: null, flagEmoji: null, sortOrder: 4, isActive: true },
      { code: 'aa', name: 'Afar', nameLocal: 'Afaraf', direction: 'ltr', fontFamily: 'Noto Sans Ethiopic', flagEmoji: null, sortOrder: 5, isActive: true },
      { code: 'sid', name: 'Sidamo', nameLocal: 'Sidaamu Afo', direction: 'ltr', fontFamily: 'Noto Sans Ethiopic', flagEmoji: null, sortOrder: 6, isActive: true },
      { code: 'ar', name: 'Arabic', nameLocal: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629', direction: 'rtl', fontFamily: 'Noto Naskh Arabic', flagEmoji: null, sortOrder: 7, isActive: true },
      { code: 'it', name: 'Italian', nameLocal: 'Italiano', direction: 'ltr', fontFamily: null, flagEmoji: null, sortOrder: 8, isActive: true },
      { code: 'zh', name: 'Chinese', nameLocal: '\u4E2D\u6587', direction: 'ltr', fontFamily: 'Noto Sans SC', flagEmoji: null, sortOrder: 9, isActive: true },
      { code: 'fr', name: 'French', nameLocal: 'Fran\u00E7ais', direction: 'ltr', fontFamily: null, flagEmoji: null, sortOrder: 10, isActive: true },
      { code: 'hi', name: 'Hindi', nameLocal: '\u0939\u093F\u0928\u094D\u0926\u0940', direction: 'ltr', fontFamily: 'Noto Sans Devanagari', flagEmoji: null, sortOrder: 11, isActive: true },
      { code: 'ml', name: 'Malayalam', nameLocal: '\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02', direction: 'ltr', fontFamily: 'Noto Sans Malayalam', flagEmoji: null, sortOrder: 12, isActive: true },
    ];

    let langCount = 0;
    for (const lang of languages) {
      const existing = await prisma.language.findUnique({ where: { code: lang.code } });
      if (!existing) {
        await prisma.language.create({ data: lang });
        langCount++;
      }
    }
    console.log('Languages seeded: ' + langCount);

    // 2. Seed UI Strings
    const uiStrings = [
      { key: 'common.save', group: 'common', defaultValue: 'Save', description: 'Save button', translations: { am: '\u12A0\u1235\u1340\u121D\u1325', om: 'Olkaa', ti: '\u12A3\u1235\u1340\u121D\u1325', ar: '\u062D\u0641\u0638', it: 'Salva', zh: '\u4FDD\u5B58' } },
      { key: 'common.cancel', group: 'common', defaultValue: 'Cancel', description: 'Cancel button', translations: { am: '\u1230\u122D\u1325', om: 'Dhiisi', ti: '\u1230\u122D\u1325', ar: '\u0625\u0644\u063A\u0627\u0621', it: 'Annulla', zh: '\u53D6\u6D88' } },
      { key: 'common.delete', group: 'common', defaultValue: 'Delete', description: 'Delete button', translations: { am: '\u1230\u122D\u1325', om: 'Haqi', ti: '\u1230\u122D\u1325', ar: '\u062D\u0630\u0641', it: 'Elimina', zh: '\u5220\u9664' } },
      { key: 'common.edit', group: 'common', defaultValue: 'Edit', description: 'Edit button', translations: { am: '\u12A0\u1235\u1270\u12AB\u12AD\u1325', om: 'Gulaali', ti: '\u12A3\u1235\u1270\u12AB\u12AD\u1325', ar: '\u062A\u0639\u062F\u064A\u0644', it: 'Modifica', zh: '\u7F16\u8F91' } },
      { key: 'common.close', group: 'common', defaultValue: 'Close', description: 'Close button', translations: { am: '\u12DD\u130D', om: 'Cufi', ti: '\u12E5\u1308\u12CD', ar: '\u0625\u063A\u0644\u0627\u0642', it: 'Chiudi', zh: '\u5173\u95ED' } },
      { key: 'common.back', group: 'common', defaultValue: 'Back', description: 'Back navigation', translations: { am: '\u1270\u1218\u1208\u1235', om: "Deebi'i", ti: '\u1270\u1218\u1208\u1235', ar: '\u0631\u062C\u0648\u0639', it: 'Indietro', zh: '\u8FD4\u56DE' } },
      { key: 'common.loading', group: 'common', defaultValue: 'Loading...', description: 'Loading state', translations: { am: '\u12A5\u12ED\u1308\u12E8\u1210 \u1290\u12CD...', om: 'Kenna jira...', ti: '\u12A5\u12ED\u12ED \u1308\u13E0\u12A2\u12AD...', ar: '\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644...', it: 'Caricamento...', zh: '\u52A0\u8F7D\u4E2D...' } },
      { key: 'common.search', group: 'common', defaultValue: 'Search', description: 'Search label', translations: { am: '\u1208\u120D\u130D', om: 'Barbaadi', ti: '\u1208\u120D\u130D', ar: '\u0628\u062D\u062B', it: 'Cerca', zh: '\u641C\u7D22' } },
      { key: 'common.yes', group: 'common', defaultValue: 'Yes', description: 'Confirmation', translations: { am: '\u12A0\u12CE', om: 'Eeyyee', ti: '\u12A5\u12CE', ar: '\u0646\u0639\u0645', it: 'S\u00EC', zh: '\u662F' } },
      { key: 'common.no', group: 'common', defaultValue: 'No', description: 'Denial', translations: { am: '\u12A0\u12ED', om: 'Lakki', ti: '\u12A3\u12ED', ar: '\u0644\u0627', it: 'No', zh: '\u5426' } },
      { key: 'menu.search_placeholder', group: 'menu', defaultValue: 'Search menu...', description: 'Search box placeholder', translations: { am: '\u121D\u12D3\u1208 \u1208\u120D\u130D...', om: 'Makala barbaadi...', ti: '\u121D\u12D3\u1208 \u1208\u120D\u130D...', ar: '\u0627\u0628\u062D\u062B \u0641\u064A \u0627\u0644\u0642\u0627\u0626\u0645\u0629...', it: 'Cerca nel menu...', zh: '\u641C\u7D22\u83DC\u5355...' } },
      { key: 'menu.sold_out', group: 'menu', defaultValue: 'Sold Out', description: 'Item availability badge', translations: { am: '\u1270\u1238\u130C\u1325', om: 'Gurmeessame', ti: '\u1270\u1238\u130C', ar: '\u0646\u0641\u0630', it: 'Esaurito', zh: '\u5DF2\u552E\u5B8C' } },
      { key: 'menu.vegetarian', group: 'menu', defaultValue: 'Vegetarian', description: 'Vegetarian badge', translations: { am: '\u12A0\u1270\u12AD\u120D', om: 'Biqiltootaa', ti: '\u12A3\u1270\u12AD\u120D', ar: '\u0646\u0628\u0627\u062A\u064A', it: 'Vegetariano', zh: '\u7D20\u98DF' } },
      { key: 'menu.spicy', group: 'menu', defaultValue: 'Spicy', description: 'Spicy badge', translations: { am: '\u1305\u1218\u121D', om: 'Qamadhii', ti: '\u1305\u1218\u121D', ar: '\u062D\u0627\u0631', it: 'Piccante', zh: '\u8FA3' } },
      { key: 'menu.popular', group: 'menu', defaultValue: 'Popular', description: 'Popular badge', translations: { am: '\u1270\u12CE\u12CE\u12A3', om: 'Beekamaa', ti: '\u1270\u12CE\u12CE\u12A3', ar: '\u0634\u0627\u0626\u0639', it: 'Popolare', zh: '\u70ED\u95E8' } },
      { key: 'cart.title', group: 'cart', defaultValue: 'Your Cart', description: 'Cart heading', translations: { am: '\u12E8\u12A5\u122D\u1235\u12CE \u130C\u12AA', om: 'Kartaa keessan', ti: '\u12AB\u1230\u1270\u12A9\u12ED\u1215', ar: '\u0633\u0644\u0629 \u0627\u0644\u062A\u0633\u0648\u0642', it: 'Il tuo carrello', zh: '\u8D2D\u7269\u8F66' } },
      { key: 'cart.empty', group: 'cart', defaultValue: 'Your cart is empty', description: 'Empty cart message', translations: { am: '\u130C\u12AA\u12CE \u1232\u12F0\u12CE \u1290\u12CD', om: 'Kartaan keessan duwwaa dha', ti: '\u12AB\u1230\u1270\u12A9\u12ED\u1215 \u12D1\u12CD\u12C1\u12ED \u12A5\u12ED\u12ED', ar: '\u0633\u0644\u0629 \u0627\u0644\u062A\u0633\u0648\u0642 \u0641\u0627\u0631\u063A\u0629', it: 'Il carrello \u00E8 vuoto', zh: '\u8D2D\u7269\u8F66\u4E3A\u7A7A' } },
      { key: 'cart.add', group: 'cart', defaultValue: 'Add to Cart', description: 'Add button', translations: { am: '\u12C8\u12F0 \u130C\u12AA \u130C\u1218\u122D', om: 'Kartaatti iddii', ti: '\u12D3\u1230\u12AB \u12AB\u1230\u1270 \u12C8\u1235\u12AD', ar: '\u0623\u0636\u0641 \u0644\u0644\u0633\u0644\u0629', it: 'Aggiungi al carrello', zh: '\u52A0\u5165\u8D2D\u7269\u8F66' } },
      { key: 'order.place', group: 'order', defaultValue: 'Place Order', description: 'Submit order button', translations: { am: '\u1275\u12D5\u12E3\u12DD \u120B\u12A0\u12AD', om: 'Ajajaa ergaa', ti: '\u1275\u12D5\u12E3\u12DD \u1235\u12F0\u12F0', ar: '\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628', it: 'Invia ordine', zh: '\u4E0B\u5355' } },
      { key: 'order.status.pending', group: 'order', defaultValue: 'Pending', description: 'Order status', translations: { am: '\u1230\u1218\u130C\u12DD\u12E3\u12A0\u12CD \u120B\u12CB', om: 'Eegaa', ti: '\u12A3\u1231 \u121D\u130B\u12E3\u12AD', ar: '\u0642\u064A\u062F \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631', it: 'In attesa', zh: '\u5F85\u5904\u7406' } },
      { key: 'order.status.preparing', group: 'order', defaultValue: 'Preparing', description: 'Order status', translations: { am: '\u12A5\u12EB\u12A0\u1308\u130D\u12D8 \u1290\u12CD', om: "Qophaa'aa jira", ti: '\u12A5\u12ED\u12ED \u12A3\u1340\u1208\u12E1\u12A1', ar: '\u0642\u064A\u062F \u0627\u0644\u062A\u062D\u0636\u064A\u0631', it: 'In preparazione', zh: '\u51C6\u5907\u4E2D' } },
      { key: 'order.status.ready', group: 'order', defaultValue: 'Ready', description: 'Order status', translations: { am: '\u12DD\u130D\u130C\u12A1 \u1290\u12CD', om: "Qophaa'eera", ti: '\u12F5\u1205\u12D3 \u12A5\u12ED\u12ED', ar: '\u062C\u0627\u0647\u0632', it: 'Pronto', zh: '\u5DF2\u5C31\u7EEA' } },
      { key: 'order.status.served', group: 'order', defaultValue: 'Served', description: 'Order status', translations: { am: '\u1340\u1208\u130C\u1235', om: 'Dhiyaateera', ti: '\u1340\u1208\u12E1\u1231 \u12A5\u12ED\u12ED', ar: '\u062A\u0645 \u0627\u0644\u062A\u0642\u062F\u064A\u0645', it: 'Servito', zh: '\u5DF2\u4E0A\u83DC' } },
      { key: 'payment.title', group: 'payment', defaultValue: 'Payment', description: 'Payment heading', translations: { am: '\u12AD\u12CD\u12EB\u12EB', om: 'Kaffaltii', ti: '\u12AD\u12CD\u12CA\u12AD\u1270', ar: '\u0627\u0644\u062F\u0641\u0639', it: 'Pagamento', zh: '\u4ED8\u6B3E' } },
      { key: 'payment.success', group: 'payment', defaultValue: 'Payment successful!', description: 'Payment success', translations: { am: '\u12AD\u12CD\u12EB\u12EB \u1270\u1230\u122D\u1275\u1325!', om: "Kaffaltiin milkaa'eera!", ti: '\u12AD\u12CD\u12CA\u12AD\u1270 \u1270\u12A8\u12D3\u12C8\u12D0\u12D3!', ar: '\u062A\u0645 \u0627\u0644\u062F\u0641\u0639 \u0628\u0646\u062C\u0627\u062D!', it: 'Pagamento riuscito!', zh: '\u4ED8\u6B3E\u6210\u529F\uFF01' } },
      { key: 'auth.login', group: 'auth', defaultValue: 'Sign In', description: 'Login button', translations: { am: '\u130D\u1231', om: 'Seeni', ti: '\u12A5\u1270', ar: '\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644', it: 'Accedi', zh: '\u767B\u5F55' } },
      { key: 'auth.register', group: 'auth', defaultValue: 'Register', description: 'Register button', translations: { am: '\u1270\u1218\u130C\u12DD\u130D\u12A0\u12AD', om: 'Galmeessi', ti: '\u121D\u130B\u12E3\u12A0\u12AA', ar: '\u062A\u0633\u062C\u064A\u0644', it: 'Registrati', zh: '\u6CE8\u518C' } },
      { key: 'auth.logout', group: 'auth', defaultValue: 'Log out', description: 'Logout button', translations: { am: '\u12CD\u130C\u12A3', om: "Ba'i", ti: '\u12CD\u130B\u12A3\u12A5', ar: '\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C', it: 'Esci', zh: '\u9000\u51FA' } },
      { key: 'dashboard.title', group: 'dashboard', defaultValue: 'Dashboard', description: 'Dashboard title', translations: { am: '\u12F3\u12A8\u12E0\u1206\u122D', om: 'Daashboordii', ti: '\u12F3\u12A8\u12E0\u1206\u122D', ar: '\u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645', it: 'Cruscotto', zh: '\u4EEA\u8868\u677F' } },
      { key: 'dashboard.orders', group: 'dashboard', defaultValue: 'Orders', description: 'Orders tab', translations: { am: '\u1275\u12D5\u12E3\u12E3\u12AA\u12AD', om: 'Ajajilee', ti: '\u1275\u12D5\u12E3\u12E3\u12A0\u12AA', ar: '\u0627\u0644\u0637\u0644\u0628\u0627\u062A', it: 'Ordini', zh: '\u8BA2\u5355' } },
      { key: 'dashboard.menu', group: 'dashboard', defaultValue: 'Menu', description: 'Menu tab', translations: { am: '\u121D\u12D3\u1208', om: 'Makala', ti: '\u121D\u12D3\u1208', ar: '\u0627\u0644\u0642\u0627\u0626\u0645\u0629', it: 'Menu', zh: '\u83DC\u5355' } },
      { key: 'dashboard.tables', group: 'dashboard', defaultValue: 'Tables', description: 'Tables tab', translations: { am: '\u1270\u1208\u130C\u120A\u12F6\u12AD', om: 'Meechaalee', ti: '\u1270\u1208\u130C\u12A3\u1270\u12A0\u12AA', ar: '\u0627\u0644\u0637\u0627\u0648\u0644\u0627\u062A', it: 'Tavoli', zh: '\u684C\u4F4D' } },
      { key: 'dashboard.staff', group: 'dashboard', defaultValue: 'Staff', description: 'Staff tab', translations: { am: '\u1230\u1228\u1270\u1270\u12A0\u12CD\u12AD', om: 'Hojettootaa', ti: '\u1230\u1228\u1270\u1270\u12A0\u12CD\u12E1\u12A0\u12AA', ar: '\u0627\u0644\u0645\u0648\u0638\u0641\u0648\u0646', it: 'Personale', zh: '\u5458\u5DE5' } },
      { key: 'dashboard.settings', group: 'dashboard', defaultValue: 'Settings', description: 'Settings tab', translations: { am: '\u1305\u12A0\u12CD\u12A0\u122D', om: "Qindaa'ina", ti: '\u1305\u12A0\u12CD\u12A0\u122D', ar: '\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A', it: 'Impostazioni', zh: '\u8BBE\u7F6E' } },
      { key: 'error.generic', group: 'error', defaultValue: 'Something went wrong', description: 'Generic error', translations: { am: '\u12E8\u1206\u12D0\u1215 \u130B\u130D\u122D \u1270\u1208\u130C\u12EE\u1235', om: 'Dogoggorri uumameera', ti: '\u1308\u1205\u12AD\u12E2 \u1270\u1208\u130C\u12EE\u1235', ar: '\u062D\u062F\u062B \u062E\u0637\u0623 \u0645\u0627', it: 'Qualcosa \u00E8 andato storto', zh: '\u51FA\u4E86\u70B9\u95EE\u9898' } },
      { key: 'error.network', group: 'error', defaultValue: 'Network error. Please check your connection.', description: 'Network error', translations: { am: '\u12E8\u12A0\u12CD\u12B0\u122D\u12AD \u130B\u130D\u122D\u12F2 \u12E8\u12A0\u12BD\u12EB\u12CA\u12D0\u1235 \u12E0\u122D\u12AD\u12ED\u12E3', om: 'Dogoggorri sasaabni \u2019tin. Tuqni keessan ilaalaa', ar: '\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0634\u0628\u0643\u0629. \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u062A\u0635\u0627\u0644\u0643.', it: 'Errore di rete. Controlla la connessione.', zh: '\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u68C0\u67E5\u60A8\u7684\u7F51\u7EDC\u8FDE\u63A5\u3002' } },

      // ── Auth ──
      { key: 'auth.sign_in', group: 'auth', defaultValue: 'Sign In', description: 'Sign in button', translations: { am: '\u130D\u1231', om: 'Seeni', ti: '\u12A5\u1270', ar: '\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644', it: 'Accedi', zh: '\u767B\u5F55' } },
      { key: 'auth.welcome_back', group: 'auth', defaultValue: 'Welcome back!', description: 'Login success message', translations: { am: '\u12E8\u12B0\u12CB\u1208\u12AD\u12F5 \u1270\u12CB\u12A0\u12CD\u12EB!', om: 'Baga nagaan dhufte!', ti: '\u12E8\u12B0\u12CB\u1208\u12AD\u12F5 \u1270\u12CB\u12A8\u12EB!', ar: '\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0639\u0648\u062F\u062A\u0643!', it: 'Bentornato!', zh: '\u6B22\u8FCE\u56DE\u6765\uFF01' } },
      { key: 'auth.invalid_credentials', group: 'auth', defaultValue: 'Invalid email or password', description: 'Login error', translations: { am: '\u12E8\u12A0\u12CA\u12D0\u1235 \u12CD\u12AD\u12CE \u12AB\u1230\u120D\u12ED\u12F0 \u1270\u1208\u130C\u12EE\u1235', om: 'Imeel ykn jecha icciitii dogoggoraa', ar: '\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629', it: 'Email o password non validi', zh: '\u90AE\u7BB1\u6216\u5BC6\u7801\u65E0\u6548' } },
      { key: 'auth.restaurant_not_found', group: 'auth', defaultValue: 'Restaurant Not Found', description: 'Restaurant not found error', translations: { am: '\u12E8\u1230\u1228\u12E0 \u1270\u1208\u130C\u12EE\u1235 \u12A0\u12CD\u12B0\u12CB\u12A0\u12CD\u12EB', om: 'Makala hin argamne', ar: '\u0627\u0644\u0645\u0637\u0639\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F', it: 'Ristorante non trovato', zh: '\u672A\u627E\u5230\u9910\u5385' } },
      { key: 'auth.go_to_home', group: 'auth', defaultValue: 'Go to Home', description: 'Navigate to home button', translations: { am: '\u12C8\u12F0 \u1303\u121D \u1208\u12AD', om: 'Fuula duraa deemi', ar: '\u0627\u0644\u0630\u0647\u0627\u0628 \u0644\u0644\u0631\u0626\u064A\u0633\u064A\u0629', it: 'Vai alla home', zh: '\u8FD4\u56DE\u9996\u9875' } },
      { key: 'auth.restaurant_dashboard', group: 'auth', defaultValue: 'Restaurant Dashboard', description: 'Dashboard heading', translations: { am: '\u12E8\u1230\u1228\u12E0 \u12F3\u12A8\u12E0\u1206\u122D', om: 'Daashboordii Makalaa', ar: '\u0644\u0648\u062D\u0629 \u0627\u0644\u0645\u0637\u0639\u0645', it: 'Cruscotto del ristorante', zh: '\u9910\u5385\u63A7\u5236\u53F0' } },
      { key: 'auth.forgot_password', group: 'auth', defaultValue: 'Forgot password?', description: 'Forgot password link', translations: { am: '\u12AB\u1230\u120D\u12ED\u12F0 \u1270\u128D\u12ED\u12E8\u12A0?', om: 'Jecha icciitii hilattaa?', ar: '\u0646\u0633\u064A\u062A \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631\u061F', it: 'Password dimenticata?', zh: '\u5FD8\u8BB0\u5BC6\u7801\uFF1F' } },
      { key: 'auth.enter_password', group: 'auth', defaultValue: 'Enter your password', description: 'Password placeholder', translations: { am: '\u12AB\u1230\u120D\u12ED\u12F0 \u12A5\u12ED\u12EB\u12EB', om: 'Jecha icciitii galchi', ar: '\u0623\u062F\u062E\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631', it: 'Inserisci la password', zh: '\u8F93\u5165\u5BC6\u7801' } },
      { key: 'auth.quick_demo_fill', group: 'auth', defaultValue: 'Quick Demo Fill', description: 'Demo section label', translations: { am: '\u12C8\u120D\u1230\u1235 \u120A\u12EB\u1218\u1208\u12CD \u12A5\u12E5\u12ED', om: 'Tarkaanfii ariifataa', ar: '\u062A\u0639\u0628\u0626\u0629 \u0633\u0631\u064A\u0639\u0629', it: 'Demo rapido', zh: '\u5FEB\u901F\u6F14\u793A\u586B\u5145' } },
      { key: 'auth.quick_demo', group: 'auth', defaultValue: 'Quick Demo', description: 'Demo section label', translations: { am: '\u12C8\u120D\u1230\u1235 \u120A\u12EB\u1218\u1208\u12CD', om: 'Ariifataa', ar: '\u0639\u0631\u0636 \u062A\u0642\u0631\u064A\u0628\u064A', it: 'Demo rapido', zh: '\u5FEB\u901F\u6F14\u793A' } },
      { key: 'auth.email', group: 'auth', defaultValue: 'Email', description: 'Email label', translations: { am: '\u12A0\u12CA\u12D0\u1235', om: 'Imeel', ar: '\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A', it: 'Email', zh: '\u90AE\u7BB1' } },
      { key: 'auth.password', group: 'auth', defaultValue: 'Password', description: 'Password label', translations: { am: '\u12AB\u1230\u120D\u12ED\u12F0', om: 'Jecha icciitii', ar: '\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631', it: 'Password', zh: '\u5BC6\u7801' } },
      { key: 'auth.platform_admin', group: 'auth', defaultValue: 'Platform Admin', description: 'Platform admin label', translations: { am: '\u1218\u12E0\u12A8\u12EB\u12CA\u12D0\u1235 \u12A0\u1208\u12F0\u12CD\u12AD', om: 'Bulchiinsa Plaatfaarmii', ar: '\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0646\u0635\u0629', it: 'Admin piattaforma', zh: '\u5E73\u53F0\u7BA1\u7406\u5458' } },
      { key: 'auth.admin_login', group: 'auth', defaultValue: 'Admin Login', description: 'Admin login heading', translations: { am: '\u12A0\u1208\u12F0\u12CD\u12AD \u130D\u1231', om: 'Seeni Bulchiinsa', ar: '\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0627\u0644\u0645\u0633\u0624\u0648\u0644', it: 'Login admin', zh: '\u7BA1\u7406\u5458\u767B\u5F55' } },
      { key: 'auth.admin_panel_desc', group: 'auth', defaultValue: 'Access the platform administration panel', description: 'Admin panel description', translations: { am: '\u12E8\u1218\u12E0\u12A8\u12EB\u12CA\u12D0\u1235 \u12A0\u1208\u12F0\u12CD\u12AD \u1303\u121D \u12A5\u12ED\u12EB\u12EB', om: 'Plaatfaarmii bulchiinsa bani', ar: '\u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0644\u0648\u062D\u0629 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0646\u0635\u0629', it: 'Accedi al pannello amministrativo', zh: '\u8BBF\u95EE\u5E73\u53F0\u7BA1\u7406\u9762\u677F' } },
      { key: 'auth.super_admin', group: 'auth', defaultValue: 'Super Admin', description: 'Super admin label', translations: { am: '\u12B0\u12A0\u12CD\u12ED \u12A0\u1208\u12F0\u12CD\u12AD', om: 'Bulchiinsa Guddaa', ar: '\u0645\u0633\u0624\u0648\u0644 \u0623\u0639\u0644\u0649', it: 'Super admin', zh: '\u8D85\u7EA7\u7BA1\u7406\u5458' } },
      { key: 'auth.back_to_home', group: 'auth', defaultValue: 'Back to Home', description: 'Navigation link', translations: { am: '\u12C8\u12F0 \u1303\u121D \u1208\u12AD', om: 'Fuula duraa deebii', ar: '\u0627\u0644\u0639\u0648\u062F\u0629 \u0644\u0644\u0631\u0626\u064A\u0633\u064A\u0629', it: 'Torna alla home', zh: '\u8FD4\u56DE\u9996\u9875' } },
      { key: 'auth.check_email', group: 'auth', defaultValue: 'Check Your Email', description: 'Password reset success', translations: { am: '\u12A0\u12CA\u12D0\u1235 \u12E0\u122D\u12AD\u12ED\u12E3', om: 'Imeel keessan ilaalaa', ar: '\u062A\u062D\u0642\u0642 \u0645\u0646 \u0628\u0631\u064A\u062F\u0643', it: 'Controlla la tua email', zh: '\u67E5\u770B\u60A8\u7684\u90AE\u7BB1' } },
      { key: 'auth.reset_sent', group: 'auth', defaultValue: 'Reset link sent! Check your email.', description: 'Reset link sent', translations: { am: '\u12E8\u1270\u128D\u12ED\u12E8\u12A0 \u134B\u1208\u12AD \u130C\u12EB\u12CA\u12D0\u1235 \u12A5\u12E0\u12EB\u12EB!', om: 'Linkiin haqaameera! Imeel ilaalaa', ar: '\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0627\u0628\u0637 \u0627\u0644\u0625\u0639\u0627\u062F\u0629!', it: 'Link di reset inviato! Controlla la email.', zh: '\u91CD\u7F6E\u94FE\u63A5\u5DF2\u53D1\u9001\uFF01\u8BF7\u67E5\u770B\u90AE\u7BB1\u3002' } },
      { key: 'auth.forgot_desc', group: 'auth', defaultValue: "Enter your email and we'll send you a reset link.", description: 'Forgot password description', translations: { am: '\u12A0\u12CA\u12D0\u1235 \u12A5\u12ED\u12EB\u12EB\u060D \u12E8\u1270\u128D\u12ED\u12E8\u12A0 \u134B\u1208\u12AD \u12A5\u12CA\u12EB\u12EB\u12CD\u12E3', om: "Imeel keessan galchaa, linkiin haqaama isin ergama", ar: '\u0623\u062F\u062E\u0644 \u0628\u0631\u064A\u062F\u0643 \u0648\u0633\u0646\u0631\u0633\u0644 \u0644\u0643 \u0631\u0627\u0628\u0637 \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646', it: 'Inserisci la tua email e ti invieremo un link di reset.', zh: '\u8F93\u5165\u60A8\u7684\u90AE\u7BB1\uFF0C\u6211\u4EEC\u5C06\u53D1\u9001\u91CD\u7F6E\u94FE\u63A5\u3002' } },
      { key: 'auth.try_different_email', group: 'auth', defaultValue: 'Try a different email', description: 'Try another email', translations: { am: '\u12E8\u12B0\u1208\u12D5 \u12A0\u12CA\u12D0\u1235 \u12E0\u122D\u12AD\u12ED\u12E3', om: 'Imeel biroo yaali', ar: '\u062C\u0631\u0628 \u0628\u0631\u064A\u062F\u064B\u0627 \u0622\u062E\u0631', it: 'Prova un\'altra email', zh: '\u5C1D\u8BD5\u5176\u4ED6\u90AE\u7BB1' } },
      { key: 'auth.email_address', group: 'auth', defaultValue: 'Email Address', description: 'Email field label', translations: { am: '\u12E8\u12A0\u12CA\u12D0\u1235 \u12A8\u12B0\u12CF\u12AD', om: 'Teessoo Imeel', ar: '\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0628\u0631\u064A\u062F', it: 'Indirizzo email', zh: '\u90AE\u7BB1\u5730\u5740' } },
      { key: 'auth.send_reset_link', group: 'auth', defaultValue: 'Send Reset Link', description: 'Send reset button', translations: { am: '\u12E8\u1270\u128D\u12ED\u12E8\u12A0 \u134B\u1208\u12AD \u12A5\u12CA\u12EB', om: 'Linkii haqaama ergi', ar: '\u0625\u0631\u0633\u0627\u0644 \u0631\u0627\u0628\u0637 \u0627\u0644\u0625\u0639\u0627\u062F\u0629', it: 'Invia link di reset', zh: '\u53D1\u9001\u91CD\u7F6E\u94FE\u63A5' } },
      { key: 'auth.back_to_login', group: 'auth', defaultValue: 'Back to Login', description: 'Navigation link', translations: { am: '\\u12C8\u12F0 \u130D\u1231 \u1208\u12AD', om: 'Seenii deebii', ar: '\u0627\u0644\u0639\u0648\u062F\u0629 \u0644\u0644\u062A\u0633\u062C\u064A\u0644', it: 'Torna al login', zh: '\u8FD4\u56DE\u767B\u5F55' } },
      { key: 'auth.password_mismatch', group: 'auth', defaultValue: 'Passwords do not match', description: 'Password mismatch error', translations: { am: '\u12AB\u1230\u120D\u12ED\u12E3\u12AA\u12AD \u12A0\u12CD\u12C8\u12E8\u12C8\u12ED \u1290\u12CD', om: 'Jechoota icciitii wal hin simatan', ar: '\u0643\u0644\u0645\u0627\u062A \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629', it: 'Le password non corrispondono', zh: '\u5BC6\u7801\u4E0D\u5339\u914D' } },
      { key: 'auth.min_8_chars', group: 'auth', defaultValue: 'Minimum 8 characters', description: 'Password length requirement', translations: { am: '\u12E8\u12A0\u12BD\u12EB \u8A00\u8A00 8 \u12A0\u12CD\u12E0\u12F5', om: 'Qubeewwan 8 eeguu', ar: '\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649 8 \u0623\u062D\u0631\u0641', it: 'Minimo 8 caratteri', zh: '\u6700\u5C118\u4E2A\u5B57\u7B26' } },
      { key: 'auth.confirm_password', group: 'auth', defaultValue: 'Confirm Password', description: 'Confirm password label', translations: { am: '\u12AB\u1230\u120D\u12ED\u12F0 \u12A0\u12CD\u1218\u12E0\u12CD\u12EB', om: 'Jecha icciitii mirkanaa\u2019i', ar: '\u062A\u0623\u0643\u064A\u062F \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631', it: 'Conferma password', zh: '\u786E\u8BA4\u5BC6\u7801' } },
      { key: 'auth.register_restaurant', group: 'auth', defaultValue: 'Register Your Restaurant', description: 'Register heading', translations: { am: '\\u1230\u1228\u12E0 \u1270\u1218\u130C\u12DD\u130D\u12A0\u12AD', om: 'Makala galmeessi', ar: '\u0633\u062C\u0644 \u0645\u0637\u0639\u0645\u0643', it: 'Registra il tuo ristorante', zh: '\u6CE8\u518C\u60A8\u7684\u9910\u5385' } },
      { key: 'auth.restaurant_name', group: 'auth', defaultValue: 'Restaurant Name', description: 'Restaurant name label', translations: { am: '\u12E8\u1230\u1228\u12E0 \u12B5\u12CD', om: 'Maqaa Makalaa', ar: '\u0627\u0633\u0645 \u0627\u0644\u0645\u0637\u0639\u0645', it: 'Nome del ristorante', zh: '\u9910\u5385\u540D\u79F0' } },
      { key: 'auth.full_name', group: 'auth', defaultValue: 'Full Name', description: 'Full name label', translations: { am: '\u12E8\u12B5\u12CD \u1230\u12CD\u12AD', om: 'Maqaa Guutuu', ar: '\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644', it: 'Nome completo', zh: '\u5168\u540D' } },
      { key: 'auth.phone', group: 'auth', defaultValue: 'Phone Number', description: 'Phone label', translations: { am: '\u12E8\u1218\u12CD\u12EB\u12CA\u12D0\u1235 \u120A\u12DD\u12E5', om: 'Lakkoofsa Bilbilaa', ar: '\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641', it: 'Numero di telefono', zh: '\u7535\u8BDD\u53F7\u7801' } },
      { key: 'auth.create_account', group: 'auth', defaultValue: 'Create Account', description: 'Create account button', translations: { am: '\\u12AB\u1230\u1208\u12ED \u12A5\u12CA\u12EB', om: 'Akkaawuntii uumi', ar: '\u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628', it: 'Crea account', zh: '\u521B\u5EFA\u8D26\u6237' } },
      { key: 'auth.two_factor_auth', group: 'auth', defaultValue: 'Two-Factor Authentication', description: '2FA heading', translations: { am: '\\u12E8\u12C8\u12F0-\u12A0\u12CD\u12E0\u12F5\u12AD \u12A0\u12CD\u12E8\u12D3\u12E0\u12CA\u12D0\u12D3\u12B5', om: 'Morkii Araamii Lamaan', ar: '\u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0627\u0644\u062B\u0646\u0627\u0626\u064A\u0629', it: 'Autenticazione a due fattori', zh: '\u53CC\u56E0\u7D20\u8BA4\u8BC1' } },
      { key: 'auth.verification_code', group: 'auth', defaultValue: 'Verification Code', description: '2FA code label', translations: { am: '\u12E8\u12A0\u12CD\u12E8\u12D3\u12E0\u12CA\u12D0\u12D3\u12B5 \u12A8\u12B0\u12CF\u12AD', om: 'Koodii Morkii', ar: '\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642', it: 'Codice di verifica', zh: '\u9A8C\u8BC1\u7801' } },
      { key: 'auth.verify', group: 'auth', defaultValue: 'Verify', description: 'Verify button', translations: { am: '\u12A0\u12CD\u12E8\u12D3\u12E0\u12CA\u12D0\u12D3', om: 'Mirkanaa\u2019i', ar: '\u062A\u062D\u0642\u0642', it: 'Verifica', zh: '\u9A8C\u8BC1' } },
      { key: 'auth.enter_6_digit', group: 'auth', defaultValue: 'Enter 6-digit code', description: '2FA placeholder', translations: { am: '6-\u12A0\u12CD\u12E0\u12F5 \u12A8\u12B0\u12CF\u12AD \u12A5\u12ED\u12EB\u12EB', om: 'Koodii diijitii-6 galchi', ar: '\u0623\u062F\u062E\u0644 \u0631\u0645\u0632 6 \u0623\u0631\u0642\u0627\u0645', it: 'Inserisci codice a 6 cifre', zh: '\u8F93\u51656\u4F4D\u9A8C\u8BC1\u7801' } },
      { key: 'auth.backup_code', group: 'auth', defaultValue: 'Backup Code', description: '2FA backup label', translations: { am: '\u12E8\u1270\u1228\u12A0\u12AD \u12A8\u12B0\u12CF\u12AD', om: 'Koodii Duubaa', ar: '\u0631\u0645\u0632 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A', it: 'Codice di backup', zh: '\u5907\u4EFD\u7801' } },
      { key: 'auth.enter_backup_code', group: 'auth', defaultValue: 'Enter backup code', description: '2FA backup placeholder', translations: { am: '\u12E8\u1270\u1228\u12A0\u12AD \u12A8\u12B0\u12CF\u12AD \u12A5\u12ED\u12EB\u12EB', om: 'Koodii duubaa galchi', ar: '\u0623\u062F\u062E\u0644 \u0631\u0645\u0632 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A', it: 'Inserisci codice di backup', zh: '\u8F93\u5165\u5907\u4EFD\u7801' } },
      { key: 'auth.use_authenticator', group: 'auth', defaultValue: 'Use Authenticator App', description: '2FA toggle', translations: { am: '\\u12A0\u12CD\u12E8\u12D3\u12E0\u12CA\u12D0\u12D3\u12B5 \u12A0\u1208\u120D \u12E0\u122D\u12AD\u12ED\u12E3', om: 'Appi Morkii fayyadami', ar: '\u0627\u0633\u062A\u062E\u062F\u0645 \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629', it: 'Usa app authenticator', zh: '\u4F7F\u7528\u8BA4\u8BC1\u5668\u5E94\u7528' } },
      { key: 'auth.use_backup', group: 'auth', defaultValue: 'Use Backup Code', description: '2FA toggle', translations: { am: '\u12E8\u1270\u1228\u12A0\u12AD \u12A8\u12B0\u12CF\u12AD \u12E0\u122D\u12AD\u12ED\u12E3', om: 'Koodii Duubaa fayyadami', ar: '\u0627\u0633\u062A\u062E\u062F\u0645 \u0631\u0645\u0632 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A', it: 'Usa codice di backup', zh: '\u4F7F\u7528\u5907\u4EFD\u7801' } },
      { key: 'auth.strength', group: 'auth', defaultValue: 'Strength', description: 'Password strength label', translations: { am: '\u12E8\u12C8\u1208\u12CD', om: 'Humna', ar: '\u0627\u0644\u0642\u0648\u0629', it: 'Forza', zh: '\u5F3A\u5EA6' } },
      { key: 'auth.strength_weak', group: 'auth', defaultValue: 'Weak', description: 'Password strength', translations: { am: '\u12E8\u12C8\u1208\u12CD \u1290\u12CD', om: 'Laafaa', ar: '\u0636\u0639\u064A\u0641\u0629', it: 'Debole', zh: '\u5F31' } },
      { key: 'auth.strength_fair', group: 'auth', defaultValue: 'Fair', description: 'Password strength', translations: { am: '\u12E8\u12C8\u1208\u12CD \u12A0\u12CD\u12E0\u12CD', om: 'Giddugala', ar: '\u0645\u0642\u0628\u0648\u0644\u0629', it: 'Discreta', zh: '\u4E00\u822C' } },
      { key: 'auth.strength_good', group: 'auth', defaultValue: 'Good', description: 'Password strength', translations: { am: '\u12E8\u12C8\u1208\u12CD \u12B0\u12A0\u12CD', om: 'Gaarii', ar: '\u062C\u064A\u062F\u0629', it: 'Buona', zh: '\u826F\u597D' } },
      { key: 'auth.strength_strong', group: 'auth', defaultValue: 'Strong', description: 'Password strength', translations: { am: '\u12E8\u12C8\u1208\u12CD \u1235\u1208\u12CD', om: 'Cimaa', ar: '\u0642\u0648\u064A\u0629', it: 'Forte', zh: '\u5F3A' } },
      { key: 'auth.strength_very_strong', group: 'auth', defaultValue: 'Very Strong', description: 'Password strength', translations: { am: '\u12E8\u12C8\u1208\u12CD \u1235\u1208\u12CD \u1290\u12CD', om: 'Baay\'ee Cimaa', ar: '\u0642\u0648\u064A\u0629 \u062C\u062F\u064B\u0627', it: 'Molto forte', zh: '\u975E\u5E38\u5F3A' } },
      { key: 'auth.slug_already_taken', group: 'auth', defaultValue: 'This URL slug is already taken', description: 'Slug taken error', translations: { am: '\\u12E8\u12AC URL \u12E8\u12B0\u1208\u12D5 \u1270\u1208\u130C\u12DD\u130C\u12A1 \u1290\u12CD', om: 'Maqaan kana qabameera', ar: '\u0647\u0630\u0627 \u0627\u0644\u0631\u0627\u0628\u0637 \u0645\u0623\u062E\u0648\u0630 \u0628\u0627\u0644\u0641\u0639\u0644', it: 'Questo slug URL \u00E8 gi\u00E0 preso', zh: '\u6B64URL\u6807\u8BC6\u5DF2\u88AB\u5360\u7528' } },
      { key: 'auth.available', group: 'auth', defaultValue: 'Available', description: 'Slug available', translations: { am: '\u12E8\u12B0\u1208\u12D5 \u1290\u12CD', om: 'Argama', ar: '\u0645\u062A\u0627\u062D', it: 'Disponibile', zh: '\u53EF\u7528' } },
      { key: 'auth.already_have_account', group: 'auth', defaultValue: 'Already have an account?', description: 'Login prompt', translations: { am: '\\u12AB\u1230\u1208\u12ED \u12A0\u12CB\u12F0\u12CD\u12E8\u12A0?', om: 'Akkaawuntii qabattaa?', ar: '\u0647\u0644 \u0644\u062F\u064A\u0643 \u062D\u0633\u0627\u0628\u061F', it: 'Hai gi\u00E0 un account?', zh: '\u5DF2\u6709\u8D26\u6237\uFF1F' } },
      { key: 'auth.register_desc', group: 'auth', defaultValue: 'Create your restaurant account on Yene QR', description: 'Register description', translations: { am: '\\u12C8\u12F0 Yene QR \u12C8\u12F0 \u1230\u1228\u12E0 \u12AB\u1230\u1208\u12ED \u12A5\u12CA\u12EB', om: 'Akkaawuntii makalaa Yene QR irratti uumi', ar: '\u0623\u0646\u0634\u0626 \u062D\u0633\u0627\u0628 \u0645\u0637\u0639\u0645\u0643 \u0639\u0644\u0649 Yene QR', it: 'Crea il tuo account ristorante su Yene QR', zh: '\u5728Yene QR\u521B\u5EFA\u60A8\u7684\u9910\u5385\u8D26\u6237' } },
      { key: 'auth.restaurant_details', group: 'auth', defaultValue: 'Restaurant Details', description: 'Section heading', translations: { am: '\\u12E8\u1230\u1228\u12E0 \u12E8\u12A0\u12CD\u12E0\u12F5\u12AD\u12E3\u12EE\u1235', om: 'Bal\'ina Makalaa', ar: '\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0645\u0637\u0639\u0645', it: 'Dettagli ristorante', zh: '\u9910\u5385\u8BE6\u60C5' } },
      { key: 'auth.url_slug', group: 'auth', defaultValue: 'URL Slug', description: 'URL slug label', translations: { am: 'URL \u12E8\u12AC', om: 'Slug URL', ar: '\u0631\u0627\u0628\u0637 \u0627\u0644\u0639\u0646\u0648\u0627\u0646', it: 'Slug URL', zh: 'URL\u6807\u8BC6' } },
      { key: 'auth.cuisine_type', group: 'auth', defaultValue: 'Cuisine Type', description: 'Cuisine label', translations: { am: '\\u12E8\u12A0\u12BD\u12EB \u12A0\u12CD\u12D3', om: 'Gosa Nyaataa', ar: '\u0646\u0648\u0639 \u0627\u0644\u0645\u0637\u0628\u062E', it: 'Tipo di cucina', zh: '\u83DC\u7CFB\u7C7B\u578B' } },
      { key: 'auth.city', group: 'auth', defaultValue: 'City', description: 'City label', translations: { am: '\u12A8\u12B0\u12CF\u12AD', om: 'Magaalaa', ar: '\u0627\u0644\u0645\u062F\u064A\u0646\u0629', it: 'Citt\u00E0', zh: '\u57CE\u5E02' } },
      { key: 'auth.address', group: 'auth', defaultValue: 'Address', description: 'Address label', translations: { am: '\u12A8\u12B0\u12CF\u12AD', om: 'Teessoo', ar: '\u0627\u0644\u0639\u0646\u0648\u0627\u0646', it: 'Indirizzo', zh: '\u5730\u5740' } },
      { key: 'auth.owner_account', group: 'auth', defaultValue: 'Owner Account', description: 'Owner section heading', translations: { am: '\\u12E8\u12B5\u12CD\u12E0\u12CD \u12AB\u1230\u1208\u12ED', om: 'Akkaawuntii Abbaa', ar: '\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0627\u0644\u0643', it: 'Account proprietario', zh: '\u6240\u6709\u8005\u8D26\u6237' } },
      { key: 'auth.name_amharic', group: 'auth', defaultValue: 'Name in Amharic', description: 'Amharic name label', translations: { am: '\u12B5\u12CD \\u12A0\u12CD\u12E0\u12F5\u12AD\u12E3\u12EE\u1235', om: 'Maqaa Afaan Oromootiin', ar: '\u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0623\u0645\u0647\u0631\u064A\u0629', it: 'Nome in amarico', zh: '\u963F\u59C6\u54C8\u62C9\u8BED\u540D\u79F0' } },
      { key: 'auth.terms_of_service', group: 'auth', defaultValue: 'Terms of Service', description: 'Terms link', translations: { am: '\\u12E8\u12E8\u12F0\u12CD\u12AD\u12E3 \u12E8\u12A0\u12CD\u12E8\u12D3\u12E0\u12CA\u12D0\u12D3\u12B5', om: 'Qajeelfama Tajaajilaa', ar: '\u0634\u0631\u0648\u0637 \u0627\u0644\u062E\u062F\u0645\u0629', it: 'Termini di servizio', zh: '\u670D\u52A1\u6761\u6B3E' } },
      { key: 'auth.and', group: 'auth', defaultValue: 'and', description: 'Conjunction', translations: { am: '\u12A5\u12CE', om: 'fi', ar: '\u0648', it: 'e', zh: '\u548C' } },
      { key: 'auth.privacy_policy', group: 'auth', defaultValue: 'Privacy Policy', description: 'Privacy link', translations: { am: '\\u12E8\u12A0\u12CD\u12B0\u120D\u12E3 \u12E8\u12A0\u12CD\u12E8\u12D3\u12E0\u12CA\u12D0\u12D3\u12B5', om: 'Imaammata Dhuunfaa', ar: '\u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u062E\u0635\u0648\u0635\u064A\u0629', it: 'Informativa sulla privacy', zh: '\u9690\u79C1\u653F\u7B56' } },
      { key: 'auth.invalid_link', group: 'auth', defaultValue: 'Invalid Link', description: 'Invalid reset link', translations: { am: '\\u12E8\u12C8\u1208\u12CD \u1270\u1208\u130C\u12EE\u1235 \u134B\u1208\u12AD', om: 'Linkiin Dogoggoraa', ar: '\u0631\u0627\u0628\u0637 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D', it: 'Link non valido', zh: '\u65E0\u6548\u94FE\u63A5' } },
      { key: 'auth.link_expired', group: 'auth', defaultValue: 'This password reset link has expired or is invalid.', description: 'Link expired', translations: { am: '\\u12E8\u12AD \u12AB\u1230\u120D\u12ED\u12F0 \u12E8\u1270\u128D\u12ED\u12E8\u12A0 \u134B\u1208\u12AD \u12A0\u12CD\u12E8\u12D3\u12E0\u12CA\u12D0\u12D3\u12B5 \u1290\u12CD', om: "Linkiin haqaama jecha icciitii kun dhufama ykn dogoggoraa dha", ar: '\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0631\u0627\u0628\u0637 \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631', it: 'Questo link di reset password \u00E8 scaduto o non valido.', zh: '\u6B64\u5BC6\u7801\u91CD\u7F6E\u94FE\u63A5\u5DF2\u8FC7\u671F\u6216\u65E0\u6548\u3002' } },
      { key: 'auth.request_new_link', group: 'auth', defaultValue: 'Please request a new one.', description: 'Request new link', translations: { am: '\\u12A0\u12D0\u12B0\u12CD \u12E8\u12B0\u1208\u12D5 \u12E8\u12C8\u1208\u12CD \u134B\u1208\u12AD \u12E0\u122D\u12AD\u12ED\u12E3', om: 'Haaraa gaafadhaa', ar: '\u064A\u0631\u062C\u0649 \u0637\u0644\u0628 \u0648\u0627\u062D\u062F \u062C\u062F\u064A\u062F', it: 'Richiedine uno nuovo.', zh: '\u8BF7\u7533\u8BF7\u4E00\u4E2A\u65B0\u7684\u3002' } },
      { key: 'auth.request_new', group: 'auth', defaultValue: 'Request New Link', description: 'Request new link button', translations: { am: '\\u12E8\u12B0\u1208\u12D5 \u134B\u1208\u12AD \u12E0\u122D\u12AD\u12ED\u12E3', om: 'Linkii Haaraa Gaafadhu', ar: '\u0637\u0644\u0628 \u0631\u0627\u0628\u0637 \u062C\u062F\u064A\u062F', it: 'Richiedi nuovo link', zh: '\u7533\u8BF7\u65B0\u94FE\u63A5' } },
      { key: 'auth.password_reset', group: 'auth', defaultValue: 'Password Reset', description: 'Reset heading', translations: { am: '\\u12AB\u1230\u120D\u12ED\u12F0 \\u12E8\u12B0\u1208\u12D5 \u12A0\u12BD\u12EB', om: 'Jecha Icciitii Haaraa', ar: '\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631', it: 'Reset password', zh: '\u5BC6\u7801\u91CD\u7F6E' } },
      { key: 'auth.reset_your_password', group: 'auth', defaultValue: 'Reset Your Password', description: 'Reset heading', translations: { am: '\\u12AB\u1230\u120D\u12ED\u12F0 \\u12E8\u12B0\u1208\u12D5 \u12A0\u12BD\u12EB', om: 'Jecha icciitii haaraa', ar: '\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631', it: 'Reimposta la tua password', zh: '\u91CD\u7F6E\u60A8\u7684\u5BC6\u7801' } },
      { key: 'auth.reset_success', group: 'auth', defaultValue: 'Your password has been reset successfully!', description: 'Reset success', translations: { am: '\\u12AB\u1230\u120D\u12ED\u12F0 \\u12E8\u12B0\u1208\u12D5 \u12A0\u12BD\u12EB \u1270\u1230\u122D\u1275\u1325!', om: "Jecha icciitiin haaraa milkaa'eera!", ar: '\u062A\u0645 \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062C\u0627\u062D!', it: 'La tua password \u00E8 stata reimpostata con successo!', zh: '\u60A8\u7684\u5BC6\u7801\u5DF2\u6210\u529F\u91CD\u7F6E\uFF01' } },
      { key: 'auth.enter_new_password', group: 'auth', defaultValue: 'Enter your new password below.', description: 'New password prompt', translations: { am: '\\u12E8\u12B0\u1208\u12D5 \u12AB\u1230\u120D\u12ED\u12F0 \\u12A5\u12ED\u12EB\u12EB', om: 'Jecha icciitii haaraa galchi', ar: '\u0623\u062F\u062E\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629', it: 'Inserisci la nuova password qui sotto.', zh: '\u5728\u4E0B\u65B9\u8F93\u5165\u60A8\u7684\u65B0\u5BC6\u7801\u3002' } },
      { key: 'auth.new_password', group: 'auth', defaultValue: 'New Password', description: 'New password label', translations: { am: '\\u12E8\u12B0\u1208\u12D5 \u12AB\u1230\u120D\u12ED\u12F0', om: 'Jecha Icciitii Haaraa', ar: '\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629', it: 'Nuova password', zh: '\u65B0\u5BC6\u7801' } },
      { key: 'auth.reset_password', group: 'auth', defaultValue: 'Reset Password', description: 'Reset button', translations: { am: '\\u12AB\u1230\u120D\u12ED\u12F0 \\u12A0\u12BD\u12EB', om: 'Jecha icciitii haaraa', ar: '\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631', it: 'Reimposta password', zh: '\u91CD\u7F6E\u5BC6\u7801' } },
      { key: 'auth.sign_in_new_password', group: 'auth', defaultValue: 'Sign in with your new password', description: 'Post-reset link', translations: { am: '\\u12E8\u12B0\u1208\u12D5 \u12AB\u1230\u120D\u12ED\u12F0 \u130D\u1231', om: 'Jecha icciitii haaraan seeni', ar: '\u0633\u062C\u0644 \u062F\u062E\u0648\u0644\u0643 \u0628\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629', it: 'Accedi con la nuova password', zh: '\u4F7F\u7528\u65B0\u5BC6\u7801\u767B\u5F55' } },
      { key: 'auth.re_enter_password', group: 'auth', defaultValue: 'Re-enter password', description: 'Confirm password placeholder', translations: { am: '\\u12AB\u1230\u120D\u12ED\u12F0 \\u12D5\u12C8\u12ED \\u12A5\u12ED\u12EB\u12EB', om: 'Jecha icciitii irra deebii\u2019i', ar: '\u0623\u0639\u062F \u0625\u062F\u062E\u0627\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631', it: 'Reinserisci la password', zh: '\u518D\u6B21\u8F93\u5165\u5BC6\u7801' } },

      // ── Restaurant ──
      { key: 'restaurant.not_found', group: 'restaurant', defaultValue: 'Restaurant not found', description: 'Not found error', translations: { am: '\u1230\u1228\u12E0 \u1270\u1208\u130C\u12EE\u1235 \u12A0\u12CD\u12B0\u12CB\u12A0\u12CD\u12EB', om: 'Makala hin argamne', ar: '\u0627\u0644\u0645\u0637\u0639\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F', it: 'Ristorante non trovato', zh: '\u672A\u627E\u5230\u9910\u5385' } },
      { key: 'restaurant.not_found_desc', group: 'restaurant', defaultValue: 'The restaurant you are looking for could not be found.', description: 'Not found description', translations: { am: '\\u12E8\u12B0\u1208\u12D5\u12CA\u12AD \\u12E8\u1230\u1228\u12E0 \u12A0\u12CD\u12B0\u12CB\u12A0\u12CD\u12EB', om: 'Makala isin barbaaddan hin argamne', ar: '\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u0637\u0639\u0645', it: 'Il ristorante cercato non \u00E8 stato trovato.', zh: '\u627E\u4E0D\u5230\u60A8\u8981\u67E5\u627E\u7684\u9910\u5385\u3002' } },
      { key: 'restaurant.loading', group: 'restaurant', defaultValue: 'Loading...', description: 'Loading state', translations: { am: '\u12A5\u12EB\u12A0\u1308\u130D\u12D8 \u1290\u12CD...', om: 'Kenna jira...', ar: '\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644...', it: 'Caricamento...', zh: '\u52A0\u8F7D\u4E2D...' } },
      { key: 'restaurant.go_home', group: 'restaurant', defaultValue: 'Go Home', description: 'Navigate home', translations: { am: '\\u1303\u121D \u1208\u12AD', om: 'Fuula duraa deemi', ar: '\u0627\u0644\u0630\u0647\u0627\u0628 \u0644\u0644\u0631\u0626\u064A\u0633\u064A\u0629', it: 'Vai alla home', zh: '\u8FD4\u56DE\u9996\u9875' } },
      { key: 'restaurant.scanned_qr', group: 'restaurant', defaultValue: 'You scanned the QR code', description: 'QR scan message', translations: { am: '\\u12E8\u12C8\u12CD \u12A8\u12B0\u12CF\u12AD \u12E8\u12A0\u12CD\u12B0\u120D\u12E3 \u12E0\u122D\u12AD\u12ED\u12E3', om: 'Koodii QR scan gootanii', ar: '\u0642\u0645\u062A \u0628\u0645\u0633\u062D \u0631\u0645\u0632 QR', it: 'Hai scansionato il codice QR', zh: '\u60A8\u5DF2\u626B\u63CF\u4E8C\u7EF4\u7801' } },
      { key: 'restaurant.all_rights', group: 'restaurant', defaultValue: 'All rights reserved.', description: 'Copyright notice', translations: { am: '\\u12E8\u12C8\u1208\u12CD \u12E8\u12A0\u12CD\u12E8\u12D3\u12E0\u12CA\u12D0\u12D3\u12B5 \u1270\u12CB\u12A0\u12CD\u12EB', om: 'Haqa hundi eegama', ar: '\u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0642 \u0645\u062D\u0641\u0648\u0638\u0629', it: 'Tutti i diritti riservati.', zh: '\u7248\u6743\u6240\u6709\u3002' } },
      { key: 'restaurant.powered_by', group: 'restaurant', defaultValue: 'Powered by Yene QR', description: 'Branding', translations: { am: 'Yene QR \\u12E8\u12A0\u12CD\u12E8\u12D3\u12E0\u12CA\u12D0\u12D3\u12B5', om: 'Yene QR tiin', ar: '\u062A\u0634\u063A\u064A\u0644 \u0628\u0648\u0627\u0633\u0637\u0629 Yene QR', it: 'Powered by Yene QR', zh: '\u7531Yene QR\u9A71\u52A8' } },

      // ── Landing / Pricing ──
      { key: 'landing.pricing.free', group: 'landing', defaultValue: 'Free', description: 'Free plan price', translations: { am: '\u12A0\u12ED\u12ED \u12A0\u12CD\u12E8\u12D3\u12E0\u12CA\u12D0\u12D3\u12B5', om: 'Bilchaata', ar: '\u0645\u062C\u0627\u0646\u064A', it: 'Gratis', zh: '\u514D\u8D39' } },
      { key: 'landing.pricing.per_month', group: 'landing', defaultValue: 'ETB/mo', description: 'Per month label', translations: { am: '\u12A0\u12CD\u12E8\u12D3\u12E0\u12CA\u12D0\u12D3\u12B5/\u12CB\u12CD', om: 'ETB/ji\'aa', ar: '\u0628\u064A\u0631/\u0634\u0647\u0631', it: 'ETB/mese', zh: '\u5143/\u6708' } },
      { key: 'landing.pricing.pro_price', group: 'landing', defaultValue: '2,000', description: 'Pro plan price', translations: {} },
      { key: 'landing.pricing.premium_price', group: 'landing', defaultValue: '5,000', description: 'Premium plan price', translations: {} },
    ];

    let strCount = 0;
    for (const str of uiStrings) {
      const existing = await prisma.uIString.findUnique({ where: { key: str.key } });
      if (!existing) {
        await prisma.uIString.create({
          data: {
            key: str.key,
            group: str.group,
            defaultValue: str.defaultValue,
            description: str.description,
            translations: JSON.stringify(str.translations),
            isActive: true,
          },
        });
        strCount++;
      }
    }
    console.log('UI Strings seeded: ' + strCount);

    // 3. Seed Restaurant Languages
    const restaurants = await prisma.restaurant.findMany();
    let rlCount = 0;
    for (const rest of restaurants) {
      const restLangs = [
        { restaurantId: rest.id, languageCode: 'en', isDefault: true, isActive: true, isRequired: true, sortOrder: 0 },
        { restaurantId: rest.id, languageCode: 'am', isDefault: false, isActive: true, isRequired: false, sortOrder: 1 },
        { restaurantId: rest.id, languageCode: 'om', isDefault: false, isActive: true, isRequired: false, sortOrder: 2 },
        { restaurantId: rest.id, languageCode: 'ti', isDefault: false, isActive: true, isRequired: false, sortOrder: 3 },
        { restaurantId: rest.id, languageCode: 'ar', isDefault: false, isActive: true, isRequired: false, sortOrder: 4 },
      ];
      for (const rl of restLangs) {
        const existing = await prisma.restaurantLanguage.findFirst({
          where: { restaurantId: rl.restaurantId, languageCode: rl.languageCode },
        });
        if (!existing) {
          await prisma.restaurantLanguage.create({ data: rl });
          rlCount++;
        }
      }
    }
    console.log('Restaurant Languages seeded: ' + rlCount);

    // 4. Update restaurants with i18n name data
    const i18nData = [
      { id: 'rest-habesha', nameI18n: { am: '\u1210\u1230\u1228\u12E0 \u1218\u12D0\u1260\u1208\u12CD', om: 'Habashaa Maabel', ti: '\u1213\u1230\u1228\u12E0 \u1218\u12D0\u12A5\u1208\u12CD', ar: '\u062D\u0628\u0634\u0629 \u0645\u0623\u0628\u0644' } },
      { id: 'rest-continental', nameI18n: { am: '\u12D8\u12A8 \u12AE\u12AD\u12F3\u12A3\u12D3\u12F3\u12D0\u1208', om: 'The Continental', ti: '\u12D8\u12A8 \u12AE\u12AD\u12F3\u12A3\u12D3\u12F3\u12D0\u1208', ar: '\u0630\u0627 \u0643\u0648\u0646\u062A\u064A\u0646\u0646\u062A\u0627\u0644' } },
      { id: 'rest-blue-nile', nameI18n: { am: '\u1230\u1218\u12EB\u12EB\u12CB \u12D3\u12A0\u12ED\u120D \u130D\u12AA\u120D', om: 'Qabbanaawaa Niil', ti: '\u1230\u1218\u12EB\u12EB\u12CB \u12D3\u12A0\u12ED\u120D', ar: '\u0627\u0644\u0646\u064A\u0644 \u0627\u0644\u0623\u0632\u0631\u0642' } },
      { id: 'rest-yod-abyssinia', nameI18n: { am: '\u12EB\u12F3 \u12A0\u1209\u12ED\u12D3\u12EB', om: 'Yod Abisiiniyaa', ti: '\u12EB\u12F3 \u12A3\u1209\u12ED\u12D3\u12EB', ar: '\u064A\u0648\u062F \u0623\u0628\u064A\u0646\u0633\u064A\u0627' } },
      { id: 'rest-lalibela', nameI18n: { am: '\u120B\u12A0\u1209\u120B\u12A0 \u12F5\u12A0\u12CD\u1308\u12ED', om: 'Lalibela Dhagaa', ti: '\u120B\u12A0\u1209\u120B\u12A0 \u12F5\u12A0\u12CD\u1308\u12ED', ar: '\u0644\u0627\u0644\u064A\u0628\u064A\u0644\u0627' } },
      { id: 'rest-sheba-lounge', nameI18n: { am: '\u1233\u12A0 \u120B\u12A0\u12CD\u12C5\u12ED', om: 'Sabaa Laawunjii', ti: '\u1233\u12A0 \u120B\u12A0\u12CD\u12C5\u12ED', ar: '\u0635\u0628\u0627 \u0644\u0627\u0648\u0646\u062C' } },
      { id: 'rest-meskel-cafe', nameI18n: { am: '\u1218\u1235\u1340\u120D \u1264\u12D3\u12A0 \u1204\u1270', om: 'Masqal Bunaa', ti: '\u1218\u1235\u1340\u120D \u1264\u12D3\u12A0 \u1204\u1270', ar: '\u0645\u0633\u0642\u0644 \u0643\u0627\u0641\u064A\u0647' } },
      { id: 'rest-aster-kitchen', nameI18n: { am: '\u12A0\u1235\u1270\u12AD \u12A0\u12CD\u12E0\u12D3', om: 'Astar Kishinaa', ti: '\u12A3\u1235\u1270\u12AD \u12A0\u12CD\u12E0\u12D3', ar: '\u0623\u0633\u062A\u0631 \u0643\u064A\u062A\u0634\u0646' } },
      { id: 'rest-rift-valley', nameI18n: { am: '\u122A\u12CD\u120C\u1270 \u1238\u1208\u1208\u12DD \u12E3\u12E0', om: 'Riifta Vaallii', ti: '\u122A\u12CD\u120C\u1270 \u1238\u1208\u1208\u12DD \u12E3\u12E0', ar: '\u0631\u064A\u0641\u062A \u0641\u0627\u0644\u064A' } },
      { id: 'rest-harar-gate', nameI18n: { am: '\u1210\u1208\u122D \u1218\u130D\u1209\u12EB', om: 'Harar Irreeffannaa', ti: '\u1210\u1208\u122D \u1218\u130D\u1209\u12EB', ar: '\u0628\u0627\u0628 \u0647\u0631\u0631' } },
      { id: 'rest-entsoto', nameI18n: { am: '\u12A5\u12A0\u12CD\u1270\u12CD \u1270\u12A8\u12EB\u1235', om: 'Intootoo Teraasaa', ti: '\u12A5\u12A0\u12CD\u1270\u12CD \u1270\u12A8\u12EB\u1235', ar: '\u0625\u0646\u062A\u0648\u062A\u0648 \u062A\u064A\u0631\u0627\u0633' } },
      { id: 'rest-wolkite-queen', nameI18n: { am: '\u12C8\u120D\u12A0\u12ED\u1270 \u12D5\u12CD\u130D\u12E5', om: 'Walkiite Nagaartii', ti: '\u12C8\u120D\u12A0\u12ED\u1270 \u12D5\u12CD\u130D\u12E5\u1270\u12AD', ar: '\u0648\u0644\u0643\u064A\u062A \u0643\u0648\u064A\u0646' } },
    ];

    let i18nCount = 0;
    let i18nSkipped = 0;
    for (const item of i18nData) {
      const existing = await prisma.restaurant.findUnique({ where: { id: item.id } });
      if (!existing) {
        i18nSkipped++;
        continue;
      }
      await prisma.restaurant.update({
        where: { id: item.id },
        data: {
          nameI18n: JSON.stringify(item.nameI18n),
          enabledLanguages: JSON.stringify(['en', 'am', 'om', 'ti', 'ar']),
        },
      });
      i18nCount++;
    }
    console.log('Restaurant i18n names updated: ' + i18nCount + (i18nSkipped > 0 ? ', skipped: ' + i18nSkipped + ' (not found)' : ''));

    // 5. Populate ALL menu items with nameAm -> nameI18n
    const allItemsWithAm = await prisma.menuItem.findMany({
      where: { nameAm: { not: null } },
    });
    let allItemCount = 0;
    for (const item of allItemsWithAm) {
      if (item.nameAm) {
        const i18n = { am: item.nameAm };
        await prisma.menuItem.update({
          where: { id: item.id },
          data: { nameI18n: JSON.stringify(i18n) },
        });
        allItemCount++;
      }
    }
    console.log('Menu Items with Amharic i18n updated: ' + allItemCount);

    // 6. Populate menu categories with i18n
    const allCatsWithAm = await prisma.menuCategory.findMany({
      where: { nameAm: { not: null } },
    });
    let catCount = 0;
    for (const cat of allCatsWithAm) {
      if (cat.nameAm) {
        const i18n = { am: cat.nameAm };
        await prisma.menuCategory.update({
          where: { id: cat.id },
          data: { nameI18n: JSON.stringify(i18n) },
        });
        catCount++;
      }
    }
    console.log('Menu Categories with Amharic i18n updated: ' + catCount);

    console.log('\ni18n seeding complete!');

  } catch (error) {
    console.error('Seed error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
