// ============================================================
// Yene QR — i18n Seed API
// POST /api/i18n/seed — Seeds default languages and UI strings
// ============================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DEFAULT_LANGUAGES, CUISINE_TYPES_I18N, serializeI18nJson } from '@/lib/i18n'

export async function POST() {
  try {
    let languagesSeeded = 0
    let stringsSeeded = 0

    // 1. Seed languages
    for (const lang of DEFAULT_LANGUAGES) {
      const existing = await db.language.findUnique({ where: { code: lang.code } })
      if (!existing) {
        await db.language.create({
          data: {
            code: lang.code,
            name: lang.name,
            nameLocal: lang.nameLocal,
            direction: lang.direction,
            fontFamily: lang.fontFamily,
            flagEmoji: lang.flagEmoji,
            sortOrder: lang.sortOrder,
            isActive: true,
          },
        })
        languagesSeeded++
      }
    }

    // 2. Seed default UI strings
    const defaultStrings = getDefaultUIStrings()
    for (const str of defaultStrings) {
      const existing = await db.uIString.findUnique({ where: { key: str.key } })
      if (!existing) {
        await db.uIString.create({
          data: {
            key: str.key,
            group: str.group,
            defaultValue: str.defaultValue,
            description: str.description,
            translations: serializeI18nJson(str.translations),
            isActive: true,
          },
        })
        stringsSeeded++
      }
    }

    return NextResponse.json({
      success: true,
      languagesSeeded,
      stringsSeeded,
    })
  } catch (error) {
    console.error('[I18N_SEED_ERROR]', error)
    return NextResponse.json({ error: 'Failed to seed i18n data' }, { status: 500 })
  }
}

function getDefaultUIStrings() {
  return [
    // ─── Common ───
    { key: 'common.save', group: 'common', defaultValue: 'Save', description: 'Save button', translations: { am: 'አስቀምጥ', om: 'Olkaa', ti: 'ኣስቀምጥ', ar: 'حفظ', it: 'Salva', zh: '保存' } },
    { key: 'common.cancel', group: 'common', defaultValue: 'Cancel', description: 'Cancel button', translations: { am: 'ሰርዝ', om: 'Dhiisi', ti: 'ሰርዝ', ar: 'إلغاء', it: 'Annulla', zh: '取消' } },
    { key: 'common.delete', group: 'common', defaultValue: 'Delete', description: 'Delete button', translations: { am: 'ሰርዝ', om: 'Haqi', ti: 'ሰርዝ', ar: 'حذف', it: 'Elimina', zh: '删除' } },
    { key: 'common.edit', group: 'common', defaultValue: 'Edit', description: 'Edit button', translations: { am: 'አስተካክል', om: 'Gulaali', ti: 'ኣስተካኽል', ar: 'تعديل', it: 'Modifica', zh: '编辑' } },
    { key: 'common.close', group: 'common', defaultValue: 'Close', description: 'Close button', translations: { am: 'ዝጋ', om: 'Cufi', ti: 'ዕጸው', ar: 'إغلاق', it: 'Chiudi', zh: '关闭' } },
    { key: 'common.back', group: 'common', defaultValue: 'Back', description: 'Back navigation', translations: { am: 'ተመለስ', om: 'Deebi\'i', ti: 'ተመለስ', ar: 'رجوع', it: 'Indietro', zh: '返回' } },
    { key: 'common.loading', group: 'common', defaultValue: 'Loading...', description: 'Loading state', translations: { am: 'እየጫነ ነው...', om: 'Kenna jira...', ti: 'እዩ ጸዓኒ...', ar: 'جاري التحميل...', it: 'Caricamento...', zh: '加载中...' } },
    { key: 'common.search', group: 'common', defaultValue: 'Search', description: 'Search label', translations: { am: 'ፈልግ', om: 'Barbaadi', ti: 'ፈልግ', ar: 'بحث', it: 'Cerca', zh: '搜索' } },
    { key: 'common.yes', group: 'common', defaultValue: 'Yes', description: 'Confirmation', translations: { am: 'አዎ', om: 'Eeyyee', ti: 'እወ', ar: 'نعم', it: 'Sì', zh: '是' } },
    { key: 'common.no', group: 'common', defaultValue: 'No', description: 'Denial', translations: { am: 'አይ', om: 'Lakki', ti: 'ኣይ', ar: 'لا', it: 'No', zh: '否' } },

    // ─── Menu ───
    { key: 'menu.search_placeholder', group: 'menu', defaultValue: 'Search menu...', description: 'Search box placeholder', translations: { am: 'ምናሌ ፈልግ...', om: 'Makala barbaadi...', ti: 'ምናሌ ፈልግ...', ar: 'ابحث في القائمة...', it: 'Cerca nel menu...', zh: '搜索菜单...' } },
    { key: 'menu.sold_out', group: 'menu', defaultValue: 'Sold Out', description: 'Item availability badge', translations: { am: 'ተሸጧል', om: 'Gurmeessame', ti: 'ተሸጸ', ar: 'نفذ', it: 'Esaurito', zh: '已售完' } },
    { key: 'menu.vegetarian', group: 'menu', defaultValue: 'Vegetarian', description: 'Vegetarian badge', translations: { am: 'አትክልት', om: 'Biqiltootaa', ti: 'ኣትክልት', ar: 'نباتي', it: 'Vegetariano', zh: '素食' } },
    { key: 'menu.spicy', group: 'menu', defaultValue: 'Spicy', description: 'Spicy badge', translations: { am: 'ቅመም', om: 'Qamadhii', ti: 'ቅመም', ar: 'حار', it: 'Piccante', zh: '辣' } },
    { key: 'menu.combo', group: 'menu', defaultValue: 'Combo', description: 'Combo badge', translations: { am: 'ኮምቦ', om: 'Komboo', ti: 'ኮምቦ', ar: 'كومبو', it: 'Combo', zh: '套餐' } },
    { key: 'menu.includes', group: 'menu', defaultValue: 'Includes', description: 'Combo items label', translations: { am: 'ያካትታል', om: 'Hammatama', ti: 'ያካትታል', ar: 'يتضمن', it: 'Include', zh: '包含' } },
    { key: 'menu.no_items', group: 'menu', defaultValue: 'No items found', description: 'Empty state', translations: { am: 'ዕቃ አልተገኘም', om: 'Wanti hin jiru', ti: 'ዕቃ ኣይተረኽበን', ar: 'لا توجد عناصر', it: 'Nessun elemento', zh: '未找到项目' } },

    // ─── Cart ───
    { key: 'cart.title', group: 'cart', defaultValue: 'Your Cart', description: 'Cart heading', translations: { am: 'የእርስዎ ጋሪ', om: 'Kartaa keessan', ti: 'ካርትኩም', ar: 'سلة التسوق', it: 'Il tuo carrello', zh: '购物车' } },
    { key: 'cart.empty', group: 'cart', defaultValue: 'Your cart is empty', description: 'Empty cart message', translations: { am: 'ጋሪዎ ባዶ ነው', om: 'Kartaan keessan duwwaa dha', ti: 'ካርትኩም ዑፁይ እዩ', ar: 'سلة التسوق فارغة', it: 'Il carrello è vuoto', zh: '购物车为空' } },
    { key: 'cart.add', group: 'cart', defaultValue: 'Add to Cart', description: 'Add button', translations: { am: 'ወደ ጋሪ ጨምር', om: 'Kartaatti iddii', ti: 'ናብ ካርት ወስኽ', ar: 'أضف للسلة', it: 'Aggiungi al carrello', zh: '加入购物车' } },
    { key: 'cart.added', group: 'cart', defaultValue: 'Added!', description: 'Added feedback', translations: { am: 'ታክሏል!', om: 'Iddameera!', ti: 'ተወሰኺዑ!', ar: 'تمت الإضافة!', it: 'Aggiunto!', zh: '已添加！' } },
    { key: 'cart.item', group: 'cart', defaultValue: 'item', description: 'Singular item', translations: { am: 'ዕቃ', om: 'Wantii', ti: 'ዕቃ', ar: 'عنصر', it: 'elemento', zh: '项目' } },
    { key: 'cart.items', group: 'cart', defaultValue: 'items', description: 'Plural items', translations: { am: 'ዕቃዎች', om: 'Wantee', ti: 'ዕቓታት', ar: 'عناصر', it: 'elementi', zh: '项目' } },
    { key: 'cart.total', group: 'cart', defaultValue: 'Total', description: 'Cart total', translations: { am: 'ጠቅላላ', om: 'Walumaagalatti', ti: 'ጠቓላዒ', ar: 'المجموع', it: 'Totale', zh: '合计' } },

    // ─── Order ───
    { key: 'order.start', group: 'order', defaultValue: 'Start Ordering', description: 'Start ordering button', translations: { am: 'ትዕዛዝ ጀምር', om: 'Ajajaa jalqabi', ti: 'ትዕዛዝ ጀምር', ar: 'ابدأ الطلب', it: 'Inizia a ordinare', zh: '开始点餐' } },
    { key: 'order.place', group: 'order', defaultValue: 'Place Order', description: 'Submit order button', translations: { am: 'ትዕዛዝ ላክ', om: 'Ajajaa ergaa', ti: 'ትዕዛዝ ስደድ', ar: 'إرسال الطلب', it: 'Invia ordine', zh: '下单' } },
    { key: 'order.placing', group: 'order', defaultValue: 'Placing order...', description: 'Loading state', translations: { am: 'ትዕዛዝ እየላከ ነው...', om: 'Ajajaa ergaa jira...', ti: 'ትዕዛዝ እዩ ኣቕሪቡ...', ar: 'جاري إرسال الطلب...', it: 'Invio ordine...', zh: '正在下单...' } },
    { key: 'order.number', group: 'order', defaultValue: 'Order #{number}', description: 'Order number display', translations: { am: 'ትዕዛዝ #{number}', om: 'Ajajaa #{number}', ti: 'ትዕዛዝ #{number}', ar: 'طلب #{number}', it: 'Ordine #{number}', zh: '订单 #{number}' } },
    { key: 'order.status.pending', group: 'order', defaultValue: 'Pending', description: 'Order status', translations: { am: 'በመጠባበት ላይ', om: 'Eegaa', ti: 'ኣብ ምጽባይ', ar: 'قيد الانتظار', it: 'In attesa', zh: '待处理' } },
    { key: 'order.status.preparing', group: 'order', defaultValue: 'Preparing', description: 'Order status', translations: { am: 'እያዘገገ ነው', om: 'Qophaa\'aa jira', ti: 'እዩ ኣቀሪቡ', ar: 'قيد التحضير', it: 'In preparazione', zh: '准备中' } },
    { key: 'order.status.ready', group: 'order', defaultValue: 'Ready', description: 'Order status', translations: { am: 'ዝግጁ ነው', om: 'Qophaa\'eera', ti: 'ድሕሪ እዩ', ar: 'جاهز', it: 'Pronto', zh: '已就绪' } },
    { key: 'order.status.served', group: 'order', defaultValue: 'Served', description: 'Order status', translations: { am: 'ቀርቧል', om: 'Dhiyaateera', ti: 'ቀሪቡ እዩ', ar: 'تم التقديم', it: 'Servito', zh: '已上菜' } },

    // ─── Payment ───
    { key: 'payment.title', group: 'payment', defaultValue: 'Payment', description: 'Payment heading', translations: { am: 'ክፍያ', om: 'Kaffaltii', ti: 'ክፍሊት', ar: 'الدفع', it: 'Pagamento', zh: '付款' } },
    { key: 'payment.cash', group: 'payment', defaultValue: 'Cash', description: 'Cash payment', translations: { am: 'ጥሬ ገንዘብ', om: 'Qabeenya qofa', ti: 'ጸጋም ገንዘብ', ar: 'نقداً', it: 'Contanti', zh: '现金' } },
    { key: 'payment.processing', group: 'payment', defaultValue: 'Processing payment...', description: 'Payment loading', translations: { am: 'ክፍያ እየተከናወነ ነው...', om: 'Kaffaltii hojjetee jira...', ti: 'ክፍሊት እዩ ኣቀሪቡ...', ar: 'جاري معالجة الدفع...', it: 'Elaborazione pagamento...', zh: '正在处理付款...' } },
    { key: 'payment.success', group: 'payment', defaultValue: 'Payment successful!', description: 'Payment success', translations: { am: 'ክፍያ ተሰርቷል!', om: 'Kaffaltiin milkaa\'eera!', ti: 'ክፍሊት ተኸናወነ!', ar: 'تم الدفع بنجاح!', it: 'Pagamento riuscito!', zh: '付款成功！' } },
    { key: 'payment.failed', group: 'payment', defaultValue: 'Payment failed', description: 'Payment failure', translations: { am: 'ክፍያ አልተሰራም', om: 'Kaffaltiin hin milkoofne', ti: 'ክፍሊት ኣይተኸናወነን', ar: 'فشل الدفع', it: 'Pagamento fallito', zh: '付款失败' } },

    // ─── Auth ───
    { key: 'auth.login', group: 'auth', defaultValue: 'Sign In', description: 'Login button', translations: { am: 'ግባ', om: 'Seeni', ti: 'እቶ', ar: 'تسجيل الدخول', it: 'Accedi', zh: '登录' } },
    { key: 'auth.register', group: 'auth', defaultValue: 'Register', description: 'Register button', translations: { am: 'ተመዝገብ', om: 'Galmeessi', ti: 'ምዝገባ', ar: 'تسجيل', it: 'Registrati', zh: '注册' } },
    { key: 'auth.logout', group: 'auth', defaultValue: 'Log out', description: 'Logout button', translations: { am: 'ውጣ', om: 'Ba\'i', ti: 'ውጻእ', ar: 'تسجيل الخروج', it: 'Esci', zh: '退出' } },
    { key: 'auth.email', group: 'auth', defaultValue: 'Email', description: 'Email label', translations: { am: 'ኢሜይል', om: 'Imeelii', ti: 'ኢሜል', ar: 'البريد الإلكتروني', it: 'Email', zh: '邮箱' } },
    { key: 'auth.password', group: 'auth', defaultValue: 'Password', description: 'Password label', translations: { am: 'የይለፍ ቃል', om: 'Jecha icciitii', ti: 'መሐለቅ ቃል', ar: 'كلمة المرور', it: 'Password', zh: '密码' } },

    // ─── Welcome ───
    { key: 'welcome.table', group: 'welcome', defaultValue: 'Table', description: 'Table number label', translations: { am: 'ጠረጴዛ', om: 'Meecha', ti: 'ጠረዴዛ', ar: 'طاولة', it: 'Tavolo', zh: '桌号' } },
    { key: 'welcome.scan_hint', group: 'welcome', defaultValue: 'Order directly from your table', description: 'QR scan hint', translations: { am: 'ከጠረጴዛዎ ቀጥታ ይዋቅሩ', om: 'Meecha irraa tole ajajaa', ti: 'ካብ ጠረዴዛኹም ቀጥታ ኣዘዝዩ', ar: 'اطلب مباشرة من طاولتك', it: 'Ordina direttamente dal tuo tavolo', zh: '直接从桌位点餐' } },
    { key: 'welcome.view_menu', group: 'welcome', defaultValue: 'View Menu', description: 'View menu button', translations: { am: 'ምናሌ ይመልከቱ', om: 'Makala ilaalaa', ti: 'ምናሌ ርአዩ', ar: 'عرض القائمة', it: 'Vedi menu', zh: '查看菜单' } },

    // ─── Modifiers ───
    { key: 'modifier.required', group: 'modifier', defaultValue: 'Required', description: 'Required modifier badge', translations: { am: 'አስፈላጊ', om: 'Barbaachisaa', ti: 'ኣስፈላጊ', ar: 'مطلوب', it: 'Obbligatorio', zh: '必选' } },
    { key: 'modifier.choose_one', group: 'modifier', defaultValue: 'Choose 1', description: 'Single select hint', translations: { am: '1 ምረጥ', om: 'Tokko filadhu', ti: '1 ምረጽ', ar: 'اختر واحد', it: 'Scegli 1', zh: '选1项' } },
    { key: 'modifier.add_ons', group: 'modifier', defaultValue: 'Add-ons', description: 'Addons section title', translations: { am: 'ተጨማሪ', om: 'Dabalataa', ti: 'ተጨማሪ', ar: 'إضافات', it: 'Extra', zh: '加料' } },
    { key: 'modifier.special_instructions', group: 'modifier', defaultValue: 'Special Instructions', description: 'Instructions label', translations: { am: 'ልዩ መመሪያ', om: 'Qajeelfama addaa', ti: 'ፍሉይ መምርሒ', ar: 'تعليمات خاصة', it: 'Istruzioni speciali', zh: '特殊要求' } },

    // ─── Errors ───
    { key: 'error.network', group: 'error', defaultValue: 'Network error. Please try again.', description: 'Network error', translations: { am: 'የኔትወርክ ስህተት። እባክዎ እንደገና ይሞክሩ።', om: 'Dogoggora sasaaessaa. Irra deebiin yaalaa.', ti: 'ስሕተት ኔትዎርክ። እባክኹም ከምጽባዩ ፈትኑ።', ar: 'خطأ في الشبكة. يرجى المحاولة مرة أخرى.', it: 'Errore di rete. Riprova.', zh: '网络错误，请重试。' } },
    { key: 'error.generic', group: 'error', defaultValue: 'Something went wrong', description: 'Generic error', translations: { am: 'የሆነ ችግር ተፈጥሯል', om: 'Dogoggorri uumameera', ti: 'ጸቕጢ ተፈጢሩ', ar: 'حدث خطأ ما', it: 'Qualcosa è andato storto', zh: '出了点问题' } },

    // ─── Auth Extended ───
    { key: 'auth.sign_in', group: 'auth', defaultValue: 'Sign In', description: 'Sign in button', translations: { am: 'ግባ', om: 'Seeni', ti: 'እቶ', ar: 'تسجيل الدخول', it: 'Accedi', zh: '登录' } },
    { key: 'auth.forgot_password', group: 'auth', defaultValue: 'Forgot Password?', description: 'Forgot password heading', translations: { am: 'የይለፍ ቃልዎን ረሱ?', om: 'Jecha icciitii irraatteetti?', ti: 'መሐለቅ ቃልኹም ረሲዕኩም?', ar: 'نسيت كلمة المرور؟', it: 'Password dimenticata?', zh: '忘记密码？' } },
    { key: 'auth.reset_password', group: 'auth', defaultValue: 'Reset Password', description: 'Reset password button', translations: { am: 'የይለፍ ቃል ዳግም አስቀምጥ', om: 'Jecha icciitii haqi', ti: 'መሐለቅ ቃል ኣስቀምጥ', ar: 'إعادة تعيين كلمة المرور', it: 'Reimposta password', zh: '重置密码' } },
    { key: 'auth.confirm_password', group: 'auth', defaultValue: 'Confirm Password', description: 'Confirm password label', translations: { am: 'የይለፍ ቃል አረጋግጥ', om: 'Jecha icciitii mirkanaa\'i', ti: 'መሐለቅ ቃል ኣረጋግጥ', ar: 'تأكيد كلمة المرور', it: 'Conferma password', zh: '确认密码' } },
    { key: 'auth.new_password', group: 'auth', defaultValue: 'New Password', description: 'New password label', translations: { am: 'አዲስ የይለፍ ቃል', om: 'Jecha icciitii haaraa', ti: 'ሓድሽ መሐለቅ ቃል', ar: 'كلمة مرور جديدة', it: 'Nuova password', zh: '新密码' } },
    { key: 'auth.email_address', group: 'auth', defaultValue: 'Email Address', description: 'Email address label', translations: { am: 'የኢሜይል አድራሻ', om: 'Teessoo imeelii', ti: 'ናይ ኢሜል ኣድራሻ', ar: 'عنوان البريد الإلكتروني', it: 'Indirizzo email', zh: '邮箱地址' } },
    { key: 'auth.enter_password', group: 'auth', defaultValue: 'Enter your password', description: 'Password placeholder', translations: { am: 'የይለፍ ቃልዎን ያስገቡ', om: 'Jecha icciitii keessan galchaa', ti: 'መሐለቅ ቃልኹም ኣእትዉ', ar: 'أدخل كلمة المرور', it: 'Inserisci la password', zh: '输入密码' } },
    { key: 'auth.re_enter_password', group: 'auth', defaultValue: 'Re-enter your password', description: 'Confirm password placeholder', translations: { am: 'የይለፍ ቃልዎን እንደገና ያስገቡ', om: 'Jecha icciitii irra deebi\'i galchaa', ti: 'መሐለቅ ቃልኹም ከምጽባዩ ኣእትዉ', ar: 'أعد إدخال كلمة المرور', it: 'Reinserisci la password', zh: '再次输入密码' } },
    { key: 'auth.min_8_chars', group: 'auth', defaultValue: 'Min 8 characters', description: 'Password min length hint', translations: { am: 'ዝበዝሐ ከ8 ፊደሎች', om: 'Qubee 8 ol', ti: 'ካብ 8 ፊደላት ንላዕሊ', ar: '8 أحرف على الأقل', it: 'Min 8 caratteri', zh: '至少8个字符' } },
    { key: 'auth.password_mismatch', group: 'auth', defaultValue: 'Passwords do not match', description: 'Password mismatch error', translations: { am: 'የይለፍ ቃሎች አይመሳሰሉም', om: 'Jechoota icciitii hin walsimsiisu', ti: 'መሐለቅ ቃላት ኣይመሳሰሉን', ar: 'كلمات المرور غير متطابقة', it: 'Le password non corrispondono', zh: '密码不匹配' } },
    { key: 'auth.invalid_credentials', group: 'auth', defaultValue: 'Invalid credentials', description: 'Login error', translations: { am: 'ልክው ያልሆኑ መረጃዎች', om: 'Beeksisa hin qabu', ti: 'ሓቂ ዘይኮነ ሓበሬታ', ar: 'بيانات غير صالحة', it: 'Credenziali non valide', zh: '无效凭证' } },
    { key: 'auth.welcome_back', group: 'auth', defaultValue: 'Welcome back!', description: 'Login success toast', translations: { am: 'እንኳዕ ደሓረው!', om: 'Baga nagaan dhuftan!', ti: 'እንቋዕ ተመለስኩም!', ar: 'مرحباً بعودتك!', it: 'Bentornato!', zh: '欢迎回来！' } },
    { key: 'auth.back_to_login', group: 'auth', defaultValue: 'Back to login', description: 'Navigation link', translations: { am: 'ወደ መግቢያ ተመለስ', om: 'Seensii deebi\'i', ti: 'ናብ ምእታው ተመለስ', ar: 'العودة لتسجيل الدخول', it: 'Torna al login', zh: '返回登录' } },
    { key: 'auth.back_to_home', group: 'auth', defaultValue: 'Back to home', description: 'Navigation link', translations: { am: 'ወደ መነሻ ተመለስ', om: 'Wiirtuu deebi\'i', ti: 'ናብ መበገሲ ተመለስ', ar: 'العودة للرئيسية', it: 'Torna alla home', zh: '返回首页' } },
    { key: 'auth.admin_login', group: 'auth', defaultValue: 'Admin Login', description: 'Admin login title', translations: { am: 'አስተዳዳሪ መግቢያ', om: 'Seensii bulchiinsaa', ti: 'መግቢያ ኣስተዳዳሪ', ar: 'تسجيل دخول المسؤول', it: 'Login amministratore', zh: '管理员登录' } },
    { key: 'auth.admin_panel_desc', group: 'auth', defaultValue: 'Sign in to the platform administration panel', description: 'Admin login description', translations: { am: 'ወደ መድረክ አስተዳደር ግባ', om: 'Gabaasa bulchiinsaatiin seeni', ti: 'ናብ ፕላትፎርም ኣስተዳዳሪ ኣእቱ', ar: 'تسجيل الدخول إلى لوحة الإدارة', it: 'Accedi al pannello di amministrazione', zh: '登录管理面板' } },
    { key: 'auth.platform_admin', group: 'auth', defaultValue: 'Platform Administration', description: 'Platform admin label', translations: { am: 'መድረክ አስተዳደር', om: 'Bulchiinsa gabaasaa', ti: 'ፕላትፎርም ኣስተዳዳሪ', ar: 'إدارة المنصة', it: 'Amministrazione piattaforma', zh: '平台管理' } },
    { key: 'auth.super_admin', group: 'auth', defaultValue: 'Super Admin', description: 'Super admin role', translations: { am: 'ዋና አስተዳዳሪ', om: 'Bulchiisa guddaa', ti: 'ዓቢ ኣስተዳዳሪ', ar: 'مدير عام', it: 'Super amministratore', zh: '超级管理员' } },
    { key: 'auth.quick_demo', group: 'auth', defaultValue: 'Quick Demo', translations: { am: 'ፈጣን ማሳያ', om: 'Agarsiisa saffisaa', ti: 'ቅልጡፍ ማሳያ', ar: 'عرض سريع', it: 'Demo rapida', zh: '快速演示' } },
    { key: 'auth.quick_demo_fill', group: 'auth', defaultValue: 'Quick Demo — click to fill', translations: { am: 'ፈጣን ማሳያ — ለመሙላት ጠቅ ያድርጉ', om: 'Agarsiisa saffisaa — tuqi guutuu', ti: 'ቅልጡፍ ማሳያ — ንምሙላት ጠውቑ', ar: 'عرض سريع — انقر للتعبئة', it: 'Demo rapida — clicca per compilare', zh: '快速演示 - 点击填写' } },
    { key: 'auth.two_factor_auth', group: 'auth', defaultValue: 'Two-Factor Authentication', translations: { am: 'ሁለት-ደረጃ ማረጋገጫ', om: 'Morkartii lamaan', ti: 'ክልተ-ደረጃ ምርግጋጽ', ar: 'المصادقة الثنائية', it: 'Autenticazione a due fattori', zh: '双因素认证' } },
    { key: 'auth.verification_code', group: 'auth', defaultValue: 'Verification Code', translations: { am: 'ማረጋገጫ ኮድ', om: 'Koodii mirkanaa\'e', ti: 'ኮድ ምርግጋጽ', ar: 'رمز التحقق', it: 'Codice di verifica', zh: '验证码' } },
    { key: 'auth.backup_code', group: 'auth', defaultValue: 'Backup Code', translations: { am: 'ምትኬ ኮድ', om: 'Koodii dabalataa', ti: 'ኮድ ምትኽልቲ', ar: 'رمز الاحتياط', it: 'Codice di backup', zh: '备用码' } },
    { key: 'auth.enter_6_digit', group: 'auth', defaultValue: 'Enter the 6-digit code from your authenticator app', translations: { am: 'ከማረጋገጫ መተግበሪያዎ የ6-አሃዝ ኮድ ያስገቡ', om: 'Koodii diijitii-6 appii keessan galchaa', ti: 'ካብ ኣፕሊኬሽን ምርግጋጽኹም ኮድ 6-ኣሃዝ ኣእትዉ', ar: 'أدخل الرمز المكون من 6 أرقام', it: 'Inserisci il codice a 6 cifre', zh: '输入验证器应用的6位码' } },
    { key: 'auth.enter_backup_code', group: 'auth', defaultValue: 'Enter one of your backup recovery codes', translations: { am: 'ከምትኬ መልሶ ኮዶችዎ አንዱን ያስገቡ', om: 'Koodii deebii dabalataa keessan tokko galchaa', ti: 'ሓደ ካብ ኮድ ምትኽልቲኹም ኣእትዉ', ar: 'أدخل أحد رموز الاسترداد الاحتياطية', it: 'Inserisci uno dei codici di backup', zh: '输入一个备用恢复码' } },
    { key: 'auth.use_backup', group: 'auth', defaultValue: 'Use a backup code instead', translations: { am: 'ምትኬ ኮድ ይጠቀሙ', om: 'Koodii dabalataa fayadami', ti: 'ኮድ ምትኽልቲ ተጠቀሙ', ar: 'استخدم رمز الاحتياط بدلاً من ذلك', it: 'Usa un codice di backup', zh: '改用备用码' } },
    { key: 'auth.use_authenticator', group: 'auth', defaultValue: 'Use authenticator code instead', translations: { am: 'ማረጋገጫ ኮድ ይጠቀሙ', om: 'Koodii mirkanaa\'e fayadami', ti: 'ኮድ ምርግጋጽ ተጠቀሙ', ar: 'استخدم رمز المصادقة بدلاً من ذلك', it: "Usa il codice dell'autenticatore", zh: '改用验证器码' } },
    { key: 'auth.verify', group: 'auth', defaultValue: 'Verify', translations: { am: 'አረጋግጥ', om: 'Mirkanaa\'i', ti: 'ኣረጋግጥ', ar: 'تحقق', it: 'Verifica', zh: '验证' } },
    { key: 'auth.already_have_account', group: 'auth', defaultValue: 'Already have an account?', translations: { am: 'መለያ አለዎት?', om: 'Akkaawuntii qabattuu?', ti: 'ኣካውንት ኣለኩም?', ar: 'لديك حساب بالفعل؟', it: 'Hai già un account?', zh: '已有账号？' } },
    { key: 'auth.register_restaurant', group: 'auth', defaultValue: 'Register Your Restaurant', translations: { am: 'ሬስቶራንትዎን ያስመዝግቡ', om: 'Restoraantii keessan galmeessaa', ti: 'ሬስቶራንትኹም ኣስመዝግቡ', ar: 'سجل مطعمك', it: 'Registra il tuo ristorante', zh: '注册您的餐厅' } },
    { key: 'auth.register_desc', group: 'auth', defaultValue: 'Get started with Yene QR in minutes. 14-day free trial included.', translations: { am: 'በከተማው ቁጥር Yene QR ይጀምሩ። 14-ቀን ነፃ ሙከራ ይካተታል።', om: 'Daqiiqaa keessatti Yene QR jalqabaa. Yaalii bilchaatae guyyaa 14.', ti: 'ኣብ ደቒቕ Yene QR ንቐጽሉ። 14-መዓልቲ ብነጻ ፈተና ይሓቕፍ።', ar: 'ابدأ مع Yene QR في دقائق. تجربة مجانية 14 يوماً.', it: 'Inizia con Yene QR in minuti. Prova gratuita 14 giorni.', zh: '几分钟内开始使用Yene QR。含14天免费试用。' } },
    { key: 'auth.create_account', group: 'auth', defaultValue: 'Create Account & Start Free Trial', translations: { am: 'መለያ ፍጠር እና ነፃ ሙከራ ጀምር', om: 'Akkaawuntii uumiifi yaalii bilchaataa jalqabi', ti: 'ኣካውንት ፍጠርን ብነጻ ፈተና ንቀጽልን', ar: 'أنشئ حساباً وابدأ التجربة المجانية', it: 'Crea account e inizia la prova gratuita', zh: '创建账号并开始免费试用' } },
    { key: 'auth.terms_of_service', group: 'auth', defaultValue: 'Terms of Service', translations: { am: 'የአገልግሎት ውል', om: 'Waliigaltee tajaajilaa', ti: 'ውዕል ኣገልግሎት', ar: 'شروط الخدمة', it: 'Termini di servizio', zh: '服务条款' } },
    { key: 'auth.privacy_policy', group: 'auth', defaultValue: 'Privacy Policy', translations: { am: 'የግላዊነት ፖሊሲ', om: 'Imaammata dhuunfaa', ti: 'ፖሊሲ ብሕትውና', ar: 'سياسة الخصوصية', it: 'Informativa sulla privacy', zh: '隐私政策' } },
    { key: 'auth.and', group: 'auth', defaultValue: 'and', translations: { am: 'እና', om: 'fi', ti: 'ን', ar: 'و', it: 'e', zh: '和' } },
    { key: 'auth.check_email', group: 'auth', defaultValue: 'Check Your Email', translations: { am: 'ኢሜይልዎን ይመልከቱ', om: 'Imeelii keessan ilaalaa', ti: 'ኢሜልኹም ርአዩ', ar: 'تحقق من بريدك الإلكتروني', it: 'Controlla la tua email', zh: '查看您的邮箱' } },
    { key: 'auth.forgot_desc', group: 'auth', defaultValue: "Enter your email and we'll send you a reset link.", translations: { am: 'ኢሜይልዎን ያስገቡ እና የዳግም አስቀማጫ ማገናኛ እንልክልዎታለን።', om: 'Imeelii keessan galchaa fi linkii deebii isini ergina.', ti: 'ኢሜልኹም ኣእትዩ ሊንክ ኣስቀሚጥ ነመልከተልኩም።', ar: 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين.', it: "Inserisci la tua email e ti invieremo un link di reset.", zh: '输入您的邮箱，我们将发送重置链接。' } },
    { key: 'auth.reset_sent', group: 'auth', defaultValue: 'If an account exists with this email, a reset link has been sent.', translations: { am: 'በዚህ ኢሜይል መለያ ካለ የዳግም አስቀማጫ ማገናኛ ተልኳል።', om: 'Yoo akkaawuntiin imeelii kanaan jiraate, linkiin deebii ergameera.', ti: 'ኣካውንት ብዚ ኢሜል እንተሎ ሊንክ ኣስቀሚጥ ተለኣኸ።', ar: 'إذا كان هناك حساب بهذا البريد، تم إرسال رابط إعادة التعيين.', it: "Se esiste un account con questa email, è stato inviato un link di reset.", zh: '如果此邮箱有账号，重置链接已发送。' } },
    { key: 'auth.try_different_email', group: 'auth', defaultValue: 'Try a different email', translations: { am: 'ሌላ ኢሜይል ይሞክሩ', om: 'Imeelii kan biroo yaalaa', ti: 'ኻልእ ኢሜል ፈትኑ', ar: 'جرب بريداً إلكترونياً مختلفاً', it: "Prova un'email diversa", zh: '尝试其他邮箱' } },
    { key: 'auth.send_reset_link', group: 'auth', defaultValue: 'Send Reset Link', translations: { am: 'የዳግም አስቀማጫ ማገናኛ ላክ', om: 'Linkii deebii ergaa', ti: 'ሊንክ ኣስቀሚጥ ስደድ', ar: 'إرسال رابط إعادة التعيين', it: 'Invia link di reset', zh: '发送重置链接' } },
    { key: 'auth.password_reset', group: 'auth', defaultValue: 'Password Reset!', translations: { am: 'የይለፍ ቃል ተቀምጧል!', om: 'Jecha icciitii haqameera!', ti: 'መሐለቅ ቃል ተሓዲሱ!', ar: 'تم إعادة تعيين كلمة المرور!', it: 'Password reimpostata!', zh: '密码已重置！' } },
    { key: 'auth.reset_your_password', group: 'auth', defaultValue: 'Reset Your Password', translations: { am: 'የይለፍ ቃልዎን ዳግም አስቀምጡ', om: 'Jecha icciitii keessan haqi', ti: 'መሐለቅ ቃልኹም ኣስቀምጡ', ar: 'أعد تعيين كلمة مرورك', it: 'Reimposta la tua password', zh: '重置您的密码' } },
    { key: 'auth.reset_success', group: 'auth', defaultValue: 'Your password has been successfully reset. Redirecting to login...', translations: { am: 'የይለፍ ቃልዎ በተሳካ ሁኔታ ተቀምጧል። ወደ መግቢያ እየመራ ነው...', om: 'Jecha icciitii keessan milkaa\'uun haqameera. Seensiitti kan siifa...', ti: 'መሐለቅ ቃልኹም ብዓወት ተሓዲሱ። ናብ ምእታው እዩ ኣቕሪቡ...', ar: 'تم إعادة تعيين كلمة المرور بنجاح. جاري التحويل...', it: 'Password reimpostata con successo. Reindirizzamento al login...', zh: '密码重置成功。正在跳转到登录...' } },
    { key: 'auth.enter_new_password', group: 'auth', defaultValue: 'Enter your new password below.', translations: { am: 'አዲሱን የይለፍ ቃልዎን ከታች ያስገቡ።', om: 'Jecha icciitii haaraa isin gadii galchaa.', ti: 'ሓድሽ መሐለቅ ቃልኹም ካብ ታሕቲ ኣእትዩ።', ar: 'أدخل كلمة مرورك الجديدة أدناه.', it: 'Inserisci la nuova password qui sotto.', zh: '请在下方输入新密码。' } },
    { key: 'auth.sign_in_new_password', group: 'auth', defaultValue: 'You can now sign in with your new password.', translations: { am: 'አሁን በአዲሱ የይለፍ ቃል መግባት ይችላሉ።', om: 'Amma jecha icciitii haaraatiin seenuu dandeessu.', ti: 'ሕጂ ብሓድሽ መሐለቅ ቃልኹም ክኣቱ ትኽእሉ።', ar: 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.', it: 'Ora puoi accedere con la nuova password.', zh: '您现在可以使用新密码登录。' } },
    { key: 'auth.invalid_link', group: 'auth', defaultValue: 'Invalid Link', translations: { am: 'ልክው ያልሆነ ማገናኛ', om: 'Linkii hin qabu', ti: 'ልክዕ ዘይኮነ ሊንክ', ar: 'رابط غير صالح', it: 'Link non valido', zh: '无效链接' } },
    { key: 'auth.link_expired', group: 'auth', defaultValue: 'This password reset link is invalid or has expired.', translations: { am: 'ይህ የይለፍ ቃል ዳግም አስቀማጫ ማገናኛ ልክው ያልሆነ ወይም ጊዜው ያለፈ ነው።', om: 'Linkiin deebii kanaa hin qabu ykn yeroo dabaleera.', ti: 'እዚ ሊንክ ኣስቀሚጥ መሐለቅ ቃል ልክዕ ዘይኮነ ወይ ዕድሚኡ ሓሊፉ እዩ።', ar: 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية.', it: 'Questo link di reset non è valido o è scaduto.', zh: '此重置链接无效或已过期。' } },
    { key: 'auth.request_new_link', group: 'auth', defaultValue: 'Please request a new password reset link.', translations: { am: 'እባክዎ አዲስ የይለፍ ቃል ዳግም አስቀማጫ ማገናኛ ይጠይቁ።', om: 'Linkii deebii haaraa gaafaa.', ti: 'እባክኹም ሓድሽ ሊንክ ኣስቀሚጥ መሐለቅ ቃል ሕተቱ።', ar: 'يرجى طلب رابط إعادة تعيين جديد.', it: 'Richiedi un nuovo link di reset.', zh: '请申请新的重置链接。' } },
    { key: 'auth.request_new', group: 'auth', defaultValue: 'Request New Link', translations: { am: 'አዲስ ማገናኛ ጠይቅ', om: 'Linkii haaraa gaafaa', ti: 'ሓድሽ ሊንክ ሕተት', ar: 'طلب رابط جديد', it: 'Richiedi nuovo link', zh: '申请新链接' } },
    { key: 'auth.restaurant_not_found', group: 'auth', defaultValue: 'Restaurant Not Found', translations: { am: 'ሬስቶራንት አልተገኘም', om: 'Restoraantiin hin argamne', ti: 'ሬስቶራንት ኣይተረኽበን', ar: 'المطعم غير موجود', it: 'Ristorante non trovato', zh: '未找到餐厅' } },
    { key: 'auth.go_to_home', group: 'auth', defaultValue: 'Go to Platform Home', translations: { am: 'ወደ መድረክ መነሻ ሂድ', om: 'Wiirtuu gabaasaa deemi', ti: 'ናብ መበገሲ ፕላትፎርም ኣትዩ', ar: 'الذهاب للرئيسية', it: 'Vai alla home', zh: '前往平台首页' } },
    { key: 'auth.staff_login', group: 'auth', defaultValue: 'Staff Login', translations: { am: 'ሠራተኛ መግቢያ', om: 'Seensii hojjettootaa', ti: 'ሰራተኛ ምእታው', ar: 'تسجيل دخول الموظفين', it: 'Accesso staff', zh: '员工登录' } },
    { key: 'auth.restaurant_dashboard', group: 'auth', defaultValue: 'Sign in to your restaurant dashboard', translations: { am: 'ወደ ሬስቶራንት ዳሽቦርድዎ ግባ', om: 'Daashboordii restoraantii keessan seeni', ti: 'ናብ ዳሽቦርድ ሬስቶራንትኹም ኣእቱ', ar: 'تسجيل الدخول إلى لوحة المطعم', it: 'Accedi alla dashboard del ristorante', zh: '登录您的餐厅仪表板' } },
    { key: 'auth.restaurant_name', group: 'auth', defaultValue: 'Restaurant Name', translations: { am: 'የሬስቶራንት ስም', om: 'Maqaa restoraantii', ti: 'ስም ሬስቶራንት', ar: 'اسم المطعم', it: 'Nome ristorante', zh: '餐厅名称' } },
    { key: 'auth.name_amharic', group: 'auth', defaultValue: 'Name (Amharic)', translations: { am: 'ስም (አማርኛ)', om: 'Maqaa (Afaan Oromoo)', ti: 'ስም (ትግርኛ)', ar: 'الاسم (الأمهرية)', it: 'Nome (Amarico)', zh: '名称（阿姆哈拉语）' } },
    { key: 'auth.url_slug', group: 'auth', defaultValue: 'URL Slug', translations: { am: 'URL ስም', om: 'Maqaa URL', ti: 'URL ስም', ar: 'رابط URL', it: 'Slug URL', zh: 'URL标识' } },
    { key: 'auth.slug_already_taken', group: 'auth', defaultValue: 'Slug already taken', translations: { am: 'ይህ ስም ቀድሞውኑ ተወስዷል', om: 'Maqaan kun dabalataa fudhateera', ti: 'እዚ ስም ድሮ ወሲዱ እዩ', ar: 'الرابط مأخوذ بالفعل', it: 'Slug già preso', zh: '标识已被占用' } },
    { key: 'auth.available', group: 'auth', defaultValue: 'Available', translations: { am: 'ያለ', om: 'Jira', ti: 'ሎም', ar: 'متاح', it: 'Disponibile', zh: '可用' } },
    { key: 'auth.cuisine_type', group: 'auth', defaultValue: 'Cuisine Type', translations: { am: 'የምግብ አይነት', om: 'Gosa nyaataa', ti: 'ዓይነት ምግቢ', ar: 'نوع المطبخ', it: 'Tipo di cucina', zh: '菜系类型' } },
    { key: 'auth.city', group: 'auth', defaultValue: 'City', translations: { am: 'ከተማ', om: 'Magaalaa', ti: 'ከተማ', ar: 'المدينة', it: 'Città', zh: '城市' } },
    { key: 'auth.address', group: 'auth', defaultValue: 'Address', translations: { am: 'አድራሻ', om: 'Teessoo', ti: 'ኣድራሻ', ar: 'العنوان', it: 'Indirizzo', zh: '地址' } },
    { key: 'auth.owner_account', group: 'auth', defaultValue: 'Owner Account', translations: { am: 'ባለቤት መለያ', om: 'Akkaawuntii abbaa', ti: 'ኣካውንት ባለቤት', ar: 'حساب المالك', it: 'Account proprietario', zh: '所有者账号' } },
    { key: 'auth.full_name', group: 'auth', defaultValue: 'Full Name', translations: { am: 'ሙሉ ስም', om: 'Maqaa guutuu', ti: 'ምሉእ ስም', ar: 'الاسم الكامل', it: 'Nome completo', zh: '全名' } },
    { key: 'auth.phone', group: 'auth', defaultValue: 'Phone', translations: { am: 'ስልክ', om: 'Bilbila', ti: 'ስልኪ', ar: 'الهاتف', it: 'Telefono', zh: '电话' } },
    { key: 'auth.restaurant_details', group: 'auth', defaultValue: 'Restaurant Details', translations: { am: 'የሬስቶራንት ዝርዝሮች', om: 'Bal\'ina restoraantii', ti: 'ዝርዝራት ሬስቶራንት', ar: 'تفاصيل المطعم', it: 'Dettagli ristorante', zh: '餐厅详情' } },
    { key: 'auth.strength', group: 'auth', defaultValue: 'Strength', translations: { am: 'ጥንካሬ', om: 'Cimina', ti: 'ሓይሊ', ar: 'القوة', it: 'Forza', zh: '强度' } },
    { key: 'auth.strength_weak', group: 'auth', defaultValue: 'Weak', translations: { am: 'ደካማ', om: 'Laafaa', ti: 'ደኻይም', ar: 'ضعيف', it: 'Debole', zh: '弱' } },
    { key: 'auth.strength_fair', group: 'auth', defaultValue: 'Fair', translations: { am: 'መካከለኛ', om: 'Giddugala', ti: 'ማእከላይ', ar: 'مقبول', it: 'Discreta', zh: '一般' } },
    { key: 'auth.strength_good', group: 'auth', defaultValue: 'Good', translations: { am: 'ጥሩ', om: 'Gaarii', ti: 'ጽቡቕ', ar: 'جيد', it: 'Buona', zh: '好' } },
    { key: 'auth.strength_strong', group: 'auth', defaultValue: 'Strong', translations: { am: 'ጠንካራ', om: 'Cimaa', ti: 'ሓያል', ar: 'قوي', it: 'Forte', zh: '强' } },
    { key: 'auth.strength_very_strong', group: 'auth', defaultValue: 'Very Strong', translations: { am: 'በጣም ጠንካራ', om: 'Baay\'ee cimaa', ti: 'ብጣዕሚ ሓያል', ar: 'قوي جداً', it: 'Molto forte', zh: '非常强' } },

    // ─── Dashboard Extended ───
    { key: 'dashboard.today_orders', group: 'dashboard', defaultValue: "Today's Orders", translations: { am: 'የዛሬ ትዕዛዞች', om: 'Ajajilee har\'aa', ti: 'ትዕዛዛት ሎሚ', ar: 'طلبات اليوم', it: 'Ordini di oggi', zh: '今日订单' } },
    { key: 'dashboard.revenue', group: 'dashboard', defaultValue: 'Revenue', translations: { am: 'ገቢ', om: 'Galii', ti: 'እታወ', ar: 'الإيرادات', it: 'Ricavi', zh: '收入' } },
    { key: 'dashboard.active_tables', group: 'dashboard', defaultValue: 'Active Tables', translations: { am: 'ንቁ ጠረጴዛዎች', om: 'Meechaalee socho\'aa', ti: 'ንቑ ጠረዴዛታት', ar: 'الطاولات النشطة', it: 'Tavoli attivi', zh: '活跃桌位' } },
    { key: 'dashboard.pending_orders', group: 'dashboard', defaultValue: 'Pending Orders', translations: { am: 'በመጠባበት ላይ ያሉ ትዕዛዞች', om: 'Ajajilee eegaa', ti: 'ትዕዛዛት ኣብ ምጽባይ', ar: 'الطلبات المعلقة', it: 'Ordini in attesa', zh: '待处理订单' } },
    { key: 'dashboard.live_data', group: 'dashboard', defaultValue: 'Live data', translations: { am: 'ቀጥታ ውሂብ', om: 'Daataa kallattii', ti: 'ቀጥታ ዳታ', ar: 'بيانات مباشرة', it: 'Dati live', zh: '实时数据' } },
    { key: 'dashboard.completed_orders', group: 'dashboard', defaultValue: 'completed orders', translations: { am: 'የተጠናቀቁ ትዕዛዞች', om: 'Ajajilee xumurame', ti: 'ዝተዛዘሙ ትዕዛዛት', ar: 'طلبات مكتملة', it: 'ordini completati', zh: '已完成订单' } },
    { key: 'dashboard.preparing', group: 'dashboard', defaultValue: 'preparing', translations: { am: 'እያዘገገ', om: 'Qophaa\'aa', ti: 'ኣቀሪቡ', ar: 'قيد التحضير', it: 'in preparazione', zh: '准备中' } },
    { key: 'dashboard.ready_count', group: 'dashboard', defaultValue: 'ready', translations: { am: 'ዝግጁ', om: 'Qophaa\'e', ti: 'ድሕሪ', ar: 'جاهز', it: 'pronto', zh: '已就绪' } },
    { key: 'dashboard.quick_actions', group: 'dashboard', defaultValue: 'Quick Actions', translations: { am: 'ፈጣን ተግባራት', om: 'Tarkaanfii saffisaa', ti: 'ቅልጡፍ ተግባራት', ar: 'إجراءات سريعة', it: 'Azioni rapide', zh: '快捷操作' } },
    { key: 'dashboard.new_order', group: 'dashboard', defaultValue: 'New Order', translations: { am: 'አዲስ ትዕዛዝ', om: 'Ajajaa haaraa', ti: 'ሓድሽ ትዕዛዝ', ar: 'طلب جديد', it: 'Nuovo ordine', zh: '新订单' } },
    { key: 'dashboard.manage_menu', group: 'dashboard', defaultValue: 'Manage Menu', translations: { am: 'ምናሌ ያስተዳድሩ', om: 'Makala too\'aa', ti: 'ምናሌ ኣስተዳድሩ', ar: 'إدارة القائمة', it: 'Gestisci menu', zh: '管理菜单' } },
    { key: 'dashboard.recent_orders', group: 'dashboard', defaultValue: 'Recent Orders', translations: { am: 'ቅርብ ትዕዛዞች', om: 'Ajajilee dhiyoo', ti: 'ቀረባ ትዕዛዛት', ar: 'الطلبات الأخيرة', it: 'Ordini recenti', zh: '最近订单' } },
    { key: 'dashboard.view_all', group: 'dashboard', defaultValue: 'View All', translations: { am: 'ሁሉንም ይመልከቱ', om: 'Hunda ilaalaa', ti: 'ኩሉ ርአዩ', ar: 'عرض الكل', it: 'Vedi tutto', zh: '查看全部' } },
    { key: 'dashboard.no_orders', group: 'dashboard', defaultValue: 'No orders yet', translations: { am: 'እስካሁን ትዕዛዝ የለም', om: 'Ajajlii hin jiru', ti: 'ትዕዛዝ የለን', ar: 'لا طلبات بعد', it: 'Nessun ordine ancora', zh: '暂无订单' } },
    { key: 'dashboard.order_status', group: 'dashboard', defaultValue: 'Order Status', translations: { am: 'የትዕዛዝ ሁኔታ', om: 'Haala ajajaa', ti: 'ኩነታት ትዕዛዝ', ar: 'حالة الطلب', it: 'Stato ordine', zh: '订单状态' } },
    { key: 'dashboard.loading_dashboard', group: 'dashboard', defaultValue: 'Loading dashboard...', translations: { am: 'ዳሽቦርድ እየጫነ ነው...', om: 'Daashboordii kenna jira...', ti: 'ዳሽቦርድ እዩ ጸዓኒ...', ar: 'جاري تحميل لوحة التحكم...', it: 'Caricamento dashboard...', zh: '加载仪表板...' } },
    { key: 'dashboard.loading_orders', group: 'dashboard', defaultValue: 'Loading orders...', translations: { am: 'ትዕዛዞች እየጫኑ ነው...', om: 'Ajajilee kenna jira...', ti: 'ትዕዛዛት እዮም ጸዓኒ...', ar: 'جاري تحميل الطلبات...', it: 'Caricamento ordini...', zh: '加载订单...' } },
    { key: 'dashboard.loading_menu', group: 'dashboard', defaultValue: 'Loading menu...', translations: { am: 'ምናሌ እየጫነ ነው...', om: 'Makala kenna jira...', ti: 'ምናሌ እዩ ጸዓኒ...', ar: 'جاري تحميل القائمة...', it: 'Caricamento menu...', zh: '加载菜单...' } },
    { key: 'dashboard.loading_settings', group: 'dashboard', defaultValue: 'Loading settings...', translations: { am: 'ቅንብሮች እየጫኑ ነው...', om: 'Qindaa\'ina kenna jira...', ti: 'ቅጥዕታት እዮም ጸዓኒ...', ar: 'جاري تحميل الإعدادات...', it: 'Caricamento impostazioni...', zh: '加载设置...' } },
    { key: 'dashboard.no_orders_found', group: 'dashboard', defaultValue: 'No orders found', translations: { am: 'ትዕዛዝ አልተገኘም', om: 'Ajajlii hin argamne', ti: 'ትዕዛዝ ኣይተረኽበን', ar: 'لا توجد طلبات', it: 'Nessun ordine trovato', zh: '未找到订单' } },
    { key: 'dashboard.all', group: 'dashboard', defaultValue: 'All', translations: { am: 'ሁሉም', om: 'Hundi', ti: 'ኩሉ', ar: 'الكل', it: 'Tutti', zh: '全部' } },
    { key: 'dashboard.restaurant_manager', group: 'dashboard', defaultValue: 'Restaurant Manager', translations: { am: 'የሬስቶራንት አስተዳዳሪ', om: 'Bulchiisa restoraantii', ti: 'ኣስተዳዳሪ ሬስቶራንት', ar: 'مدير المطعم', it: 'Gestore ristorante', zh: '餐厅管理器' } },
    { key: 'dashboard.select_branch', group: 'dashboard', defaultValue: 'Select Branch', translations: { am: 'ቅርንጫፍ ይምረጡ', om: 'Laqa filadhu', ti: 'ቅርንጫፍ ምረጹ', ar: 'اختر فرع', it: 'Seleziona filiale', zh: '选择分店' } },
    { key: 'dashboard.branch', group: 'dashboard', defaultValue: 'Branch', translations: { am: 'ቅርንጫፍ', om: 'Laqa', ti: 'ቅርንጫፍ', ar: 'فرع', it: 'Filiale', zh: '分店' } },
    { key: 'dashboard.main', group: 'dashboard', defaultValue: 'Main', translations: { am: 'ዋና', om: 'Kan guddaa', ti: 'ዓቢ', ar: 'رئيسي', it: 'Principale', zh: '主店' } },
    { key: 'dashboard.walk_in', group: 'dashboard', defaultValue: 'Walk-in', translations: { am: 'ቀጥታ', om: 'Kallattii', ti: 'ቀጥታ', ar: 'زيارة مباشرة', it: 'Walk-in', zh: '散客' } },
    { key: 'dashboard.subtotalCents', group: 'dashboard', defaultValue: 'Subtotal', translations: { am: 'ንዑስ ድምር', om: 'Gatii xiqqaa', ti: 'ንእሽተይ ድምር', ar: 'المجموع الفرعي', it: 'Subtotale', zh: '小计' } },
    { key: 'dashboard.tax', group: 'dashboard', defaultValue: 'Tax', translations: { am: 'ግብር', om: 'Balbala', ti: 'ግብሪ', ar: 'الضريبة', it: 'Tassa', zh: '税' } },
    { key: 'dashboard.service_charge', group: 'dashboard', defaultValue: 'Service Charge', translations: { am: 'አገልግሎት ክፍያ', om: 'Kaffaltii tajaajilaa', ti: 'ክፍሊት ኣገልግሎት', ar: 'رسوم الخدمة', it: 'Servizio', zh: '服务费' } },
    { key: 'dashboard.discount', group: 'dashboard', defaultValue: 'Discount', translations: { am: 'ቅናሽ', om: 'Gatii laafaa', ti: 'ምኽሪ', ar: 'خصم', it: 'Sconto', zh: '折扣' } },
    { key: 'dashboard.total', group: 'dashboard', defaultValue: 'Total', translations: { am: 'ጠቅላላ', om: 'Walumaagalatti', ti: 'ጠቓላዒ', ar: 'المجموع', it: 'Totale', zh: '合计' } },
    { key: 'dashboard.split_bill', group: 'dashboard', defaultValue: 'Split Bill', translations: { am: 'ክፍል ክፍል', om: 'Qooddachiisi', ti: 'ምክፋል', ar: 'تقسيم الفاتورة', it: 'Dividi conto', zh: '分账' } },
    { key: 'dashboard.refresh', group: 'dashboard', defaultValue: 'Refresh', translations: { am: 'አድስ', om: 'Haaraa', ti: 'ሓድስ', ar: 'تحديث', it: 'Aggiorna', zh: '刷新' } },
    { key: 'dashboard.cancel_order', group: 'dashboard', defaultValue: 'Cancel Order', translations: { am: 'ትዕዛዝ ሰርዝ', om: 'Ajajaa dhiisi', ti: 'ትዕዛዝ ሰርዝ', ar: 'إلغاء الطلب', it: 'Annulla ordine', zh: '取消订单' } },
    { key: 'dashboard.mark_as', group: 'dashboard', defaultValue: 'Mark as', translations: { am: 'እንደ ምልክት አድርግ', om: 'Akka mallattoo godhi', ti: 'ከም ምልክት ግበር', ar: 'وضع علامة كـ', it: 'Segna come', zh: '标记为' } },
    { key: 'dashboard.notes', group: 'dashboard', defaultValue: 'Notes', translations: { am: 'ማስታወሻዎች', om: 'Yaadannoowwan', ti: 'ኣስታውሾ', ar: 'ملاحظات', it: 'Note', zh: '备注' } },
    { key: 'dashboard.items_count', group: 'dashboard', defaultValue: 'Items', translations: { am: 'ዕቃዎች', om: 'Wantee', ti: 'ዕቓታት', ar: 'عناصر', it: 'Elementi', zh: '项目' } },
    { key: 'dashboard.table_label', group: 'dashboard', defaultValue: 'Table', translations: { am: 'ጠረጴዛ', om: 'Meecha', ti: 'ጠረዴዛ', ar: 'طاولة', it: 'Tavolo', zh: '桌号' } },
    { key: 'dashboard.customer', group: 'dashboard', defaultValue: 'Customer', translations: { am: 'ደንበኛ', om: 'Maatii', ti: 'ደሓንበኛ', ar: 'العميل', it: 'Cliente', zh: '客户' } },
    { key: 'dashboard.type', group: 'dashboard', defaultValue: 'Type', translations: { am: 'አይነት', om: 'Gosa', ti: 'ዓይነት', ar: 'النوع', it: 'Tipo', zh: '类型' } },
    { key: 'dashboard.time', group: 'dashboard', defaultValue: 'Time', translations: { am: 'ሰዓት', om: 'Sa\'aatii', ti: 'ሰዓት', ar: 'الوقت', it: 'Ora', zh: '时间' } },

    // ─── Common Extended ───
    { key: 'common.qr_codes', group: 'common', defaultValue: 'QR Codes', translations: { am: 'QR ኮዶች', om: 'Koodiiwwan QR', ti: 'QR ኮዳት', ar: 'رموز QR', it: 'Codici QR', zh: '二维码' } },
    { key: 'common.notifications', group: 'common', defaultValue: 'Notifications', translations: { am: 'ማሳወቂያዎች', om: 'Beeksisa', ti: 'ምልክታት', ar: 'الإشعارات', it: 'Notifiche', zh: '通知' } },
    { key: 'common.kitchen', group: 'common', defaultValue: 'Kitchen', translations: { am: 'ምድብ', om: 'Kishinaa', ti: 'ምድቢ', ar: 'المطبخ', it: 'Cucina', zh: '厨房' } },
    { key: 'common.name', group: 'common', defaultValue: 'Name', translations: { am: 'ስም', om: 'Maqaa', ti: 'ስም', ar: 'الاسم', it: 'Nome', zh: '名称' } },
    { key: 'common.reservations', group: 'common', defaultValue: 'Reservations', translations: { am: 'ቦታ ማስያዎች', om: 'Eegumsa', ti: 'ምቕራጽ', ar: 'الحجوزات', it: 'Prenotazioni', zh: '预订' } },

    // ─── Settings ───
    { key: 'settings.restaurant_profile', group: 'settings', defaultValue: 'Restaurant Profile', translations: { am: 'የሬስቶራንት መገለጫ', om: 'Profaayilii restoraantii', ti: 'ፕሮፋይል ሬስቶራንት', ar: 'ملف المطعم', it: 'Profilo ristorante', zh: '餐厅资料' } },
    { key: 'settings.working_hours', group: 'settings', defaultValue: 'Working Hours', translations: { am: 'የስራ ሰዓታት', om: 'Sa\'aatii hojii', ti: 'ሰዓታት ስራሕ', ar: 'ساعات العمل', it: 'Orari di lavoro', zh: '营业时间' } },
    { key: 'settings.tax_service', group: 'settings', defaultValue: 'Tax & Service', translations: { am: 'ግብር እና አገልግሎት', om: 'Balbala fi tajaajila', ti: 'ግብሪን ኣገልግሎትን', ar: 'الضريبة والخدمة', it: 'Tassa e servizio', zh: '税费与服务' } },
    { key: 'settings.payment_methods', group: 'settings', defaultValue: 'Payment Methods', translations: { am: 'የክፍያ ዘዴዎች', om: 'Haala kaffaltii', ti: 'ኣገላልባ ክፍሊት', ar: 'طرق الدفع', it: 'Metodi di pagamento', zh: '支付方式' } },
    { key: 'settings.security', group: 'settings', defaultValue: 'Security', translations: { am: 'ደህንነት', om: 'Nageenya', ti: 'ድሕንነት', ar: 'الأمان', it: 'Sicurezza', zh: '安全' } },
    { key: 'settings.save_changes', group: 'settings', defaultValue: 'Save Changes', translations: { am: 'ለውጦች አስቀምጥ', om: 'Jijjiirama olkaa', ti: 'ለውጥታት ኣስቀምጥ', ar: 'حفظ التغييرات', it: 'Salva modifiche', zh: '保存更改' } },
    { key: 'settings.closed', group: 'settings', defaultValue: 'Closed', translations: { am: 'ዝግ', om: 'Cufameera', ti: 'ዕጸው', ar: 'مغلق', it: 'Chiuso', zh: '休息' } },
    { key: 'settings.save_hours', group: 'settings', defaultValue: 'Save Hours', translations: { am: 'ሰዓታት አስቀምጥ', om: 'Sa\'aatii olkaa', ti: 'ሰዓታት ኣስቀምጥ', ar: 'حفظ الساعات', it: 'Salva orari', zh: '保存时间' } },
    { key: 'settings.save_settings', group: 'settings', defaultValue: 'Save Settings', translations: { am: 'ቅንብሮች አስቀምጥ', om: 'Qindaa\'ina olkaa', ti: 'ቅጥዕታት ኣስቀምጥ', ar: 'حفظ الإعدادات', it: 'Salva impostazioni', zh: '保存设置' } },
    { key: 'settings.save_payment', group: 'settings', defaultValue: 'Save Payment Settings', translations: { am: 'የክፍያ ቅንብሮች አስቀምጥ', om: 'Qindaa\'ina kaffaltii olkaa', ti: 'ቅጥዕታት ክፍሊት ኣስቀምጥ', ar: 'حفظ إعدادات الدفع', it: 'Salva impostazioni pagamento', zh: '保存支付设置' } },
    { key: 'settings.currency', group: 'settings', defaultValue: 'Currency', translations: { am: 'ገንዘብ', om: 'Qabeenya', ti: 'ገንዘብ', ar: 'العملة', it: 'Valuta', zh: '货币' } },
    { key: 'settings.default_language', group: 'settings', defaultValue: 'Default Language', translations: { am: 'ነባሪ ቋንቋ', om: 'Afaan durtii', ti: 'ቋንቋ ነባሪ', ar: 'اللغة الافتراضية', it: 'Lingua predefinita', zh: '默认语言' } },
    { key: 'settings.tax_rate', group: 'settings', defaultValue: 'Tax Rate (%)', translations: { am: 'የግብር መጠን (%)', om: 'Safartuu balbalaa (%)', ti: 'መጠን ግብሪ (%)', ar: 'نسبة الضريبة (%)', it: 'Aliquota tassa (%)', zh: '税率 (%)' } },
    { key: 'settings.service_charge_pct', group: 'settings', defaultValue: 'Service Charge (%)', translations: { am: 'የአገልግሎት ክፍያ (%)', om: 'Kaffaltii tajaajilaa (%)', ti: 'ክፍሊት ኣገልግሎት (%)', ar: 'رسوم الخدمة (%)', it: 'Servizio (%)', zh: '服务费 (%)' } },
    { key: 'settings.to', group: 'settings', defaultValue: 'to', description: 'Time range separator', translations: { am: 'እስከ', om: 'gabaa', ti: 'ክሳብ', ar: 'إلى', it: 'a', zh: '至' } },
    { key: 'settings.restaurant_name_en', group: 'settings', defaultValue: 'Restaurant Name (English)', description: 'Restaurant name English label', translations: { am: 'የሬስቶራንት ስም (እንግሊዝኛ)', om: 'Maqaa restoraantii (Afaan Ingiliffaa)', ti: 'ስም ሬስቶራንት (እንግሊዝኛ)', ar: 'اسم المطعم (إنجليزي)', it: 'Nome ristorante (Inglese)', zh: '餐厅名称（英语）' } },
    { key: 'settings.restaurant_name_am', group: 'settings', defaultValue: 'Restaurant Name (Amharic)', description: 'Restaurant name Amharic label', translations: { am: 'የሬስቶራንት ስም (አማርኛ)', om: 'Maqaa restoraantii (Afaan Oromoo)', ti: 'ስም ሬስቶራንት (ትግርኛ)', ar: 'اسم المطعم (أمهري)', it: 'Nome ristorante (Amarico)', zh: '餐厅名称（阿姆哈拉语）' } },
    { key: 'settings.monday', group: 'settings', defaultValue: 'Monday', description: 'Day of week', translations: { am: 'ሰኞ', om: 'Wiixata', ti: 'ሰኑይ', ar: 'الاثنين', it: 'Lunedì', zh: '周一' } },
    { key: 'settings.tuesday', group: 'settings', defaultValue: 'Tuesday', description: 'Day of week', translations: { am: 'ማክሰኞ', om: 'Qibxata', ti: 'ሰሉስ', ar: 'الثلاثاء', it: 'Martedì', zh: '周二' } },
    { key: 'settings.wednesday', group: 'settings', defaultValue: 'Wednesday', description: 'Day of week', translations: { am: 'ረቡዕ', om: 'Roobii', ti: 'ረቡዕ', ar: 'الأربعاء', it: 'Mercoledì', zh: '周三' } },
    { key: 'settings.thursday', group: 'settings', defaultValue: 'Thursday', description: 'Day of week', translations: { am: 'ሐሙስ', om: 'Kamiisa', ti: 'ሓሙስ', ar: 'الخميس', it: 'Giovedì', zh: '周四' } },
    { key: 'settings.friday', group: 'settings', defaultValue: 'Friday', description: 'Day of week', translations: { am: 'ዓርብ', om: 'Jimaata', ti: 'ዓርቢ', ar: 'الجمعة', it: 'Venerdì', zh: '周五' } },
    { key: 'settings.saturday', group: 'settings', defaultValue: 'Saturday', description: 'Day of week', translations: { am: 'ቅዳሜ', om: 'Sanbata', ti: 'ቀዳም', ar: 'السبت', it: 'Sabato', zh: '周六' } },
    { key: 'settings.sunday', group: 'settings', defaultValue: 'Sunday', description: 'Day of week', translations: { am: 'እሁድ', om: 'Dilbata', ti: 'ሰንበት', ar: 'الأحد', it: 'Domenica', zh: '周日' } },

    // ─── Restaurant Landing ───
    { key: 'restaurant.loading', group: 'restaurant', defaultValue: 'Loading restaurant...', translations: { am: 'ሬስቶራንት እየጫነ ነው...', om: 'Restoraantii kenna jira...', ti: 'ሬስቶራንት እዩ ጸዓኒ...', ar: 'جاري تحميل المطعم...', it: 'Caricamento ristorante...', zh: '加载餐厅...' } },
    { key: 'restaurant.not_found', group: 'restaurant', defaultValue: 'Restaurant Not Found', translations: { am: 'ሬስቶራንት አልተገኘም', om: 'Restoraantiin hin argamne', ti: 'ሬስቶራንት ኣይተረኽበን', ar: 'المطعم غير موجود', it: 'Ristorante non trovato', zh: '未找到餐厅' } },
    { key: 'restaurant.not_found_desc', group: 'restaurant', defaultValue: 'This restaurant URL does not exist.', translations: { am: 'ይህ የሬስቶራንት URL የለም።', om: 'URL restoraantii kanaa hin jiru.', ti: 'እዚ URL ሬስቶራንት የለን።', ar: 'رابط المطعم هذا غير موجود.', it: 'Questo URL del ristorante non esiste.', zh: '此餐厅URL不存在。' } },
    { key: 'restaurant.go_home', group: 'restaurant', defaultValue: 'Go to Yene QR Home', translations: { am: 'ወደ Yene QR መነሻ ሂድ', om: 'Wiirtuu Yene QR deemi', ti: 'ናብ Yene QR መበገሲ ኣትዩ', ar: 'الذهاب لرئيسية Yene QR', it: 'Vai alla home Yene QR', zh: '前往Yene QR首页' } },
    { key: 'restaurant.scanned_qr', group: 'restaurant', defaultValue: "Scanned a QR code? You'll be taken directly to the menu.", translations: { am: 'QR ኮድ አስቀምጠዋል? ቀጥታ ወደ ምናሌ ይወስድዎታል።', om: 'Koodii QR scan gootanii? Makalaatti kallattii siifanna.', ti: 'QR ኮድ ስካን ገይርኩም? ቀጥታ ናብ ምናሌ ክስቕለኩም እዩ።', ar: 'مسحت رمز QR؟ سيتم نقلك مباشرة للقائمة.', it: 'Scansionato un QR? Sarai portato direttamente al menu.', zh: '扫了二维码？您将被直接带到菜单。' } },
    { key: 'restaurant.all_rights', group: 'restaurant', defaultValue: 'All rights reserved.', translations: { am: 'መብቱ በሕግ የተጠበቀ ነው።', om: 'Haqni haqaama', ti: 'መስርሕ ብሕጂ ተጠቒሱ እዩ።', ar: 'جميع الحقوق محفوظة.', it: 'Tutti i diritti riservati.', zh: '版权所有。' } },
    { key: 'restaurant.powered_by', group: 'restaurant', defaultValue: 'Powered by Repux Technologies PLC', translations: { am: 'በ Repux Technologies PLC የተሰራ', om: 'Repux Technologies PLC tiin hojjetame', ti: 'ብ Repux Technologies PLC ዝተሰርሐ', ar: 'مدعوم من Repux Technologies PLC', it: 'Powered by Repux Technologies PLC', zh: '由Repux Technologies PLC提供支持' } },
  ]
}
