import { features, pricingPlans, knowledgeBase } from "../data/publicData.js";

const app = document.querySelector("#app");
const portal = document.querySelector("#portal");

const localeMessages = Object.fromEntries(await Promise.all(["ar", "en"].map(async (locale) => {
  const response = await fetch(`/app/locales/${locale}.json`);
  if (!response.ok) throw new Error(`Unable to load ${locale} locale`);
  return [locale, await response.json()];
})));

const operationalEnglishPhrases = {
  "فحص الجاهزية": "Readiness Check",
  "تشغيل اختبار شامل": "Run Comprehensive Test",
  "إعادة الفحص": "Run Again",
  "جاري فحص حالة المنصة...": "Checking platform status...",
  "قاعدة البيانات": "Database",
  "اتصال واتساب": "WhatsApp Connection",
  "متغيرات البيئة": "Environment Variables",
  "جاهز": "Ready",
  "غير جاهز": "Not Ready",
  "آخر فحص:": "Last check:",
  "الناقص:": "Missing:",
  "آخر نسخة احتياطية": "Last Backup",
  "لا توجد نسخة احتياطية مسجلة": "No backup has been recorded",
  "سجل المشاكل": "Issue Log",
  "تحديث السجل": "Refresh Log",
  "جاري تحميل سجل المشاكل...": "Loading issue log...",
  "لا توجد مشاكل تشغيلية مسجلة": "No operational issues recorded",
  "تم الحل": "Resolved",
  "مفتوحة": "Open",
  "المصدر:": "Source:",
  "الحل المقترح:": "Suggested solution:",
  "تم التجديد": "Renewed",
  "إرسال تذكير": "Send Reminder",
  "نسخ رابط التجديد": "Copy Renewal Link",
  "سجل التنبيهات": "Notification History",
  "تعديل الرقم": "Edit Number",
  "إيقاف التذكيرات": "Pause Reminders",
  "استئناف التذكيرات": "Resume Reminders",
  "حالة واتساب": "WhatsApp Status",
  "الإجراءات": "Actions",
  "يجب ربط واتساب أولًا": "Connect WhatsApp first",
  "الإرسال متوقف بسبب ارتفاع المخاطر": "Sending stopped due to high risk",
  "التذكيرات موقوفة لهذا العميل": "Reminders are paused for this customer",
  "جاري تحميل الاشتراكات من قاعدة البيانات...": "Loading subscriptions from the database...",
  "لا توجد اشتراكات في قاعدة البيانات": "No subscriptions in the database",
  "تعذر تحميل الاشتراكات": "Unable to load subscriptions",
  "إعادة المحاولة": "Try Again",
  "ممتاز": "Excellent",
  "جيد": "Good",
  "متوسط": "Medium",
  "خطر": "Danger",
  "تم إيقاف الإرسال التلقائي لأن درجة المخاطر أعلى من 70.": "Automatic sending is paused because the risk score is above 70.",
  "مراجعة المخاطر": "Review Risks",
  "حالة القناة": "Channel Status",
  "لا يوجد رقم": "No phone number",
  "ساعة": "hour",
  "يوم": "day",
  "جاري تحميل بيانات الحماية...": "Loading safety data...",
  "لا توجد قناة واتساب مرتبطة": "No WhatsApp channel is connected",
  "تعديل رقم واتساب": "Edit WhatsApp Number",
  "رقم واتساب بصيغة دولية": "WhatsApp number in international format",
  "حفظ الرقم": "Save Number",
  "مدة التجديد": "Renewal Duration",
  "شهر": "One month",
  "3 أشهر": "3 months",
  "6 أشهر": "6 months",
  "سنة": "One year",
  "تاريخ مخصص": "Custom Date",
  "التاريخ المخصص": "Custom Date",
  "إرسال إشعار بعد التجديد (اختياري)": "Send a notification after renewal (optional)",
  "لا توجد تنبيهات لهذا الاشتراك": "No notifications for this subscription",
  "تم تمديد الاشتراك وتسجيل العملية دون إرسال تلقائي.": "The subscription was extended and logged without automatic sending.",
  "تمت إضافة التذكير إلى قائمة الإرسال": "The reminder was added to the send queue",
  "تم تحديث رقم واتساب": "WhatsApp number updated",
  "تم تحديث حالة التذكيرات": "Reminder status updated",
  "الأجهزة المرتبطة": "Linked Devices",
  "ربط واتساب": "Connect WhatsApp",
  "إعادة إنشاء الباركود": "Regenerate QR Code",
  "لا يوجد باركود حقيقي متاح": "No real QR code is available",
  "لا يوجد باركود صالح": "No valid QR code is available",
  "أنشئ باركود ربط حقيقي.": "Generate a real WhatsApp linking QR code.",
  "غير متوفر": "Unavailable",
  "لا يظهر الرمز إلا بعد استلامه من خدمة الربط": "The code appears only after it is returned by the linking service",
  "لا يوجد رمز بعد": "No code yet",
  "رمز الاقتران غير مدعوم حاليا. استخدم الربط بالباركود.": "Pairing codes are not currently supported. Use QR linking.",
  "تم إيقاف الإرسال التلقائي": "Automatic sending paused"
};

Object.assign(operationalEnglishPhrases, {
  "✦ منصة متكاملة لإدارة الاشتراكات والتجديدات": "✦ An integrated subscription and renewal platform",
  "أدر اشتراكاتك وتجديدات عملائك بذكاء مع Renvix": "Manage customer subscriptions and renewals intelligently with Renvix",
  "Renvix منصة ذكية تساعدك على إدارة الاشتراكات، متابعة التجديدات، إرسال التنبيهات، وإنشاء روابط معلومات الطلب باحترافية.": "Renvix is a smart platform for subscriptions, renewals, notifications, and professional order information links.",
  "استكشف المميزات": "Explore features",
  "إدارة اشتراكات ذكية": "Smart subscription management",
  "أتمتة التجديدات والتنبيهات وتقليل الانقطاعات وزيادة رضا العملاء.": "Automate renewals and reminders, reduce interruptions, and improve customer satisfaction.",
  "تذكيرات متعددة القنوات": "Multi-channel reminders",
  "إرسال عبر واتساب وSMS والبريد الإلكتروني في الوقت المناسب.": "Send timely reminders through WhatsApp, SMS, and email.",
  "ربط الأجهزة بسهولة": "Easy device linking",
  "دعم الباركود ورمز الاقتران لأكثر من جهاز وقناة.": "Connect devices and channels using QR or pairing codes.",
  "تقارير وتحليلات متقدمة": "Advanced reports and analytics",
  "لوحات واضحة لاتخاذ قرارات أفضل وتنمية عملك.": "Clear dashboards for better decisions and sustainable growth.",
  "عميل نشط": "active customers",
  "اشتراك مدار": "managed subscriptions",
  "معدل تسليم الرسائل": "message delivery rate",
  "سنوات من التطوير والابتكار": "years of development and innovation",
  "كل ما تحتاجه لإدارة احترافية لنمو مستمر": "Everything you need for professional, sustainable growth",
  "أدوات مترابطة تعمل معًا من أول تنبيه حتى اكتمال التجديد.": "Connected tools that work together from the first reminder through renewal.",
  "كل ما تحتاجه لإدارة التجديدات والاشتراكات والعملاء بكفاءة واحترافية في منصة واحدة ذكية.": "Everything you need to manage renewals, subscriptions, and customers efficiently in one intelligent platform.",
  "ابدأ إدارة اشتراكاتك بطريقة ذكية اليوم": "Start managing subscriptions intelligently today",
  "جرّب Renvix مجانًا واستمتع بإدارة سلسة وفعالة دون تعقيد.": "Try Renvix free and manage renewals smoothly without complexity.",
  "إنشاء حساب مجاني": "Create a free account",
  "احجز عرضًا تجريبيًا": "Book a demo",
  "الباقات": "Plans",
  "اختر الباقة المناسبة لنمو أعمالك وتواصل بذكاء واحترافية.": "Choose the right plan for your growth and communicate intelligently.",
  "سنوي": "Yearly",
  "وفر حتى 20%": "Save up to 20%",
  "أسئلة شائعة": "Frequently asked questions",
  "هل يمكنني الترقية أو التبديل بين الباقات؟": "Can I upgrade or switch plans?",
  "هل الرسائل تشمل جميع القنوات؟": "Do message credits cover every channel?",
  "ما سياسة إلغاء الاشتراك؟": "What is the cancellation policy?",
  "كيف يتم احتساب الرسائل؟": "How are messages counted?",
  "نعم، يمكنك إدارة خطتك بمرونة من صفحة الفوترة، ويُحتسب الاستخدام وفق الرسائل المعالجة فعليًا.": "Yes. You can manage your plan from Billing, and usage is based on messages actually processed.",
  "شحن إضافي": "Additional credits",
  "هل تحتاج إلى المزيد من الرسائل؟ اشحن رصيدك الإضافي حسب احتياجك.": "Need more messages? Add credits whenever your business needs them.",
  "رسالة": "messages",
  "شحن الآن": "Add credits",
  "◎ الامتثال للمعايير العالمية": "◎ Global standards compliance",
  "◇ أمان على مستوى المؤسسات": "◇ Enterprise-grade security",
  "♙ دعم موثوق": "♙ Reliable support",
  "مستخدم واحد · 10,000 رسالة / شهر": "1 user · 10,000 messages / month",
  "5 مستخدمين · 50,000 رسالة / شهر": "5 users · 50,000 messages / month",
  "10 مستخدمين · 250,000 رسالة / شهر": "10 users · 250,000 messages / month",
  "◉ إلغاء في أي وقت": "◉ Cancel at any time",
  "✦ تحديثات مستمرة": "✦ Continuous updates",
  "♬ دعم موثوق": "♬ Reliable support",
  "المدونة": "Blog",
  "أحدث المقالات والنصائح حول تجديد الاشتراكات، الاحتفاظ بالعملاء، والأتمتة الذكية.": "The latest insights on subscription renewals, customer retention, and intelligent automation.",
  "ابحث في المقالات...": "Search articles...",
  "الكل": "All",
  "النصائح": "Guides",
  "التجديدات": "Renewals",
  "التقارير": "Reports",
  "الحماية": "Security",
  "مقال مميز": "Featured article",
  "اقرأ المقال ←": "Read article →",
  "أحدث المقالات": "Latest articles",
  "اشترك في نشرتنا": "Subscribe to our newsletter",
  "احصل على أحدث المقالات والنصائح مباشرة في بريدك.": "Get the latest articles and practical advice in your inbox.",
  "بريدك الإلكتروني": "Your email address",
  "اشترك الآن": "Subscribe now",
  "لا توجد مقالات مطابقة": "No matching articles",
  "جرّب البحث بكلمات أخرى أو اختر قسمًا مختلفًا.": "Try another search term or choose a different category.",
  "مركز الدعم": "Support center",
  "نحن هنا لمساعدتك على النجاح.": "We are here to help you succeed.",
  "مركز المساعدة": "Help center",
  "أدلة شاملة ومقالات لمساعدتك خطوة بخطوة.": "Clear guides and articles that help you step by step.",
  "تصفح المقالات": "Browse articles",
  "إجابات سريعة لأكثر الأسئلة شيوعًا.": "Quick answers to the most common questions.",
  "عرض الأسئلة": "View questions",
  "الأسئلة الشائعة": "Frequently asked questions",
  "الدردشة": "Live chat",
  "تحدث مباشرة مع فريق الدعم.": "Talk directly with our support team.",
  "ابدأ المحادثة": "Start a conversation",
  "راسلنا وسنرد عليك خلال 24 ساعة عمل.": "Email us and we will respond within one business day.",
  "راسلنا الآن": "Email us",
  "تعرف على التفاصيل والخطوات الأساسية.": "Learn the essentials and follow the required steps.",
  "ابحث في مقالات المساعدة": "Search help articles",
  "ابحث عن حلول ومقالات...": "Search solutions and articles...",
  "ما هو Renvix وكيف يعمل؟": "What is Renvix and how does it work?",
  "كيف يمكنني ربط حسابي في واتساب؟": "How do I connect my WhatsApp account?",
  "هل يمكنني إلغاء اشتراكي في أي وقت؟": "Can I cancel my subscription at any time?",
  "ما هي طرق الدفع المتاحة؟": "Which payment methods are available?",
  "كيف أتابع أداء حملاتي وتقاريري؟": "How do I monitor campaigns and reports?",
  "ستجد الخطوات داخل مركز المساعدة، ويمكن لفريق الدعم مساعدتك إذا احتجت إلى توجيه إضافي.": "You will find the steps in the Help Center, and our support team can guide you further.",
  "أرسل لنا طلب دعم": "Send a support request",
  "صف مشكلتك أو استفسارك وسنقوم بالرد عليك.": "Describe your question or issue and our team will respond.",
  "الاسم الكامل": "Full name",
  "الموضوع": "Subject",
  "اختر موضوع الطلب": "Choose a request topic",
  "مشكلة تقنية": "Technical issue",
  "الفوترة والباقات": "Billing and plans",
  "ربط الأجهزة": "Device linking",
  "تفاصيل الطلب": "Request details",
  "إرسال الطلب": "Send request",
  "▢ آمن وموثوق": "▢ Secure and reliable",
  "◇ خبراء المنتجات": "◇ Product specialists",
  "♬ دعم على مدار الساعة": "♬ Always-on support",
  "◷ متوسط الرد أقل من ساعتين": "◷ Average response under two hours",
  "العودة إلى الصفحة الرئيسية ←": "Back to home →",
  "العودة إلى الرئيسية ←": "Back to home →",
  "إنشاء حساب": "Create account",
  "أنشئ حسابك لبدء إدارة اشتراكاتك بذكاء واحترافية.": "Create your account and start managing subscriptions intelligently.",
  "مرحبًا بعودتك، يرجى إدخال بياناتك للوصول إلى حسابك.": "Welcome back. Enter your details to access your account.",
  "الخطة المختارة:": "Selected plan:",
  "اسم الشركة (اختياري)": "Company name (optional)",
  "أدخل بريدك الإلكتروني": "Enter your email address",
  "اختر كلمة مرور قوية": "Choose a strong password",
  "أدخل كلمة المرور": "Enter your password",
  "كلمة المرور": "Password",
  "تأكيد كلمة المرور": "Confirm password",
  "أوافق على": "I agree to the",
  "سياسة الاستخدام": "Terms of use",
  "سياسة الخصوصية": "Privacy policy",
  "تذكرني": "Remember me",
  "نسيت كلمة المرور؟": "Forgot password?",
  "لديك حساب بالفعل؟": "Already have an account?",
  "ليس لديك حساب؟": "Don't have an account?",
  "ابدأ رحلتك نحو إدارة اشتراكات أكثر ذكاءً": "Start your journey toward smarter subscription management",
  "منصة متكاملة لإدارة الاشتراكات والتجديدات": "An integrated subscription and renewal platform",
  "تتبّع اشتراكاتك، قلّل التكاليف، واتخذ قرارات أفضل لنمو عملك.": "Track subscriptions, reduce costs, and make better growth decisions.",
  "بسّط عملياتك، تابع اشتراكاتك، واتخذ قرارات ذكية للنمو المستدام.": "Simplify operations, track subscriptions, and make informed growth decisions.",
  "إدارة جميع اشتراكاتك في مكان واحد": "Manage every subscription in one place",
  "تنبيهات ذكية في الوقت المناسب": "Timely intelligent reminders",
  "آمن وموثوق": "Secure and reliable",
  "نسيت كلمة المرور": "Forgot password",
  "لا مشكلة، أدخل بريدك الإلكتروني المرتبط بحسابك وسنرسل لك رابطًا آمنًا لإعادة تعيين كلمة المرور.": "Enter your account email and we will send a secure password reset link.",
  "أدخل رمز التحقق الذي أرسلناه إلى بريدك ثم اختر كلمة مرور جديدة.": "Enter the verification code sent to your email, then choose a new password.",
  "يمكنك الآن العودة إلى حسابك.": "You can now return to your account.",
  "إرسال رابط الاستعادة": "Send reset link",
  "رمز التحقق": "Verification code",
  "كلمة المرور الجديدة": "New password",
  "تعيين كلمة المرور": "Set password",
  "تم تغيير كلمة المرور بنجاح.": "Your password was changed successfully.",
  "إذا كان البريد موجودًا فسيصلك رابط الاستعادة خلال دقائق.": "If the address exists, a reset link will arrive within a few minutes.",
  "تذكرت كلمة المرور؟ تسجيل الدخول": "Remembered your password? Sign in",
  "خطوة بسيطة لاستعادة الوصول": "A simple step to restore access",
  "سنرسل لك رابطًا آمنًا لإدارة كلمة المرور والعودة إلى اشتراكاتك بسهولة.": "We will send a secure link so you can return to managing subscriptions.",
  "روابط سريعة": "Quick links",
  "السياسات": "Policies",
  "تواصل معنا": "Contact us",
  "سياسة الاستبدال والاسترجاع": "Refund policy",
  "منصة ذكية لإدارة الاشتراكات والتجديدات والتواصل مع العملاء.": "An intelligent platform for subscriptions, renewals, and customer communication.",
  "جميع الحقوق محفوظة.": "All rights reserved.",
  "صُممت لإدارة التجديدات بوضوح وأمان.": "Built to manage renewals clearly and securely.",
  "أتمتة التجديدات الذكية": "Intelligent renewal automation",
  "أتمتة المواعيد وإرسال الإشعارات لتقليل الهدر وزيادة معدل التجديد.": "Automate schedules and reminders to reduce waste and improve renewal rates.",
  "إدارة العملاء": "Customer management",
  "حفظ وتنظيم بيانات العملاء وسجل المعاملات والتجديدات في مكان واحد.": "Organize customer data, transactions, and renewals in one place.",
  "ربط الأجهزة والباركود": "Device and QR linking",
  "ربط الأجهزة وتوليد الباركود ورمز الاقتران ومراقبة الاتصال.": "Link devices, generate QR and pairing codes, and monitor connectivity.",
  "التذكيرات عبر واتساب وSMS والبريد": "WhatsApp, SMS, and email reminders",
  "إرسال تذكيرات متعددة القنوات بقوالب مرنة ومخصصة.": "Send multi-channel reminders with flexible, personalized templates.",
  "التحليلات والتقارير": "Analytics and reports",
  "تقارير تفصيلية ولوحات تحكم ذكية لمراقبة الأداء واتخاذ قرارات دقيقة.": "Use detailed reports and intelligent dashboards to make informed decisions.",
  "القوالب الجاهزة": "Ready-to-use templates",
  "قوالب احترافية قابلة للتخصيص للتذكيرات والفواتير والإشعارات.": "Customize professional templates for reminders, invoices, and notifications.",
  "الحماية والإرسال الآمن": "Protection and safe sending",
  "قواعد إرسال آمن وحماية للبيانات ومراقبة صحة حساب واتساب.": "Protect data and WhatsApp account health with safe-sending rules.",
  "اللغتان العربية والإنجليزية": "Arabic and English",
  "واجهة ثنائية اللغة تسهّل استخدام المنصة لفريقك وعملائك.": "A bilingual interface for your team and customers.",
  "باقة ستارتر": "Starter plan",
  "باقة برو": "Pro plan",
  "باقة الأعمال": "Business plan",
  "لبدء المشاريع والفرق الصغيرة": "For small businesses and teams",
  "للشركات النامية": "For growing companies",
  "للشركات الكبيرة وفرق العمل": "For large companies and teams",
  "مستخدم واحد": "One user",
  "مستخدمين": "users",
  "رسالة / شهر": "messages / month",
  "تكاملات أساسية": "Core integrations",
  "تقارير أساسية": "Core reports",
  "قوالب رسائل محدودة": "Limited message templates",
  "دعم عبر البريد": "Email support",
  "تكاملات متقدمة": "Advanced integrations",
  "تقارير وتحليلات متقدمة": "Advanced reports and analytics",
  "قوالب رسائل جاهزة": "Ready-to-use message templates",
  "دعم فني أولوية": "Priority technical support",
  "تكاملات API وWebhooks": "API and webhook integrations",
  "تقارير مخصصة": "Custom reports",
  "مدير حساب مخصص": "Dedicated account manager",
  "دعم مميز على مدار الساعة": "Priority support around the clock",
  "الأكثر شعبية": "Most popular",
  "شهريًا": "month",
  "عن المنصة": "About the platform",
  "نحن هنا لمساعدتك": "We are here to help",
  "ابحث في مقالات المساعدة، تواصل مع فريق الدعم، أو أرسل طلبك وسنعود إليك بأقرب وقت.": "Search the help center, contact our support team, or send a request and we will get back to you promptly.",
  "تواصل عبر البريد": "Email support",
  "راسلنا وسنرد عليك خلال 24 ساعة عمل.": "Email us and we will reply within one business day.",
  "تعرف على التفاصيل والخطوات الأساسية.": "Learn the details and essential steps.",
  "صف مشكلتك أو استفسارك وسنقوم بالرد عليك.": "Describe your question or issue and our team will respond.",
  "▢ آمن وموثوق": "▢ Secure and reliable",
  "◇ خبراء المنتجات": "◇ Product specialists",
  "♬ دعم على مدار الساعة": "♬ Always-on support",
  "◷ متوسط الرد أقل من ساعتين": "◷ Average response under two hours",
  "خلاصة عملية": "Practical takeaways",
  "طبّق هذه الخطوات في Renvix": "Put these steps into practice with Renvix",
  "ابدأ بإدارة تجديداتك من لوحة موحدة وآمنة.": "Manage renewals from one clear and secure workspace.",
  "البدء السريع": "Quick start",
  "إدارة الاشتراكات": "Subscription management",
  "التكاملات والإعدادات": "Integrations and settings",
  "الفوترة والدفع": "Billing and payments",
  "التقارير والتحليلات": "Reports and analytics",
  "استكشاف الأخطاء": "Troubleshooting",
  "مشكلة تقنية": "Technical issue",
  "ربط الأجهزة": "Device linking",
  "تفاصيل الطلب": "Request details"
});

const storage = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

function readPreference(key, legacyKey, fallback) {
  const direct = localStorage.getItem(key);
  if (direct === "ar" || direct === "en" || direct === "light" || direct === "dark") return direct;
  const legacy = storage.get(legacyKey, fallback);
  localStorage.setItem(key, legacy);
  return legacy;
}

function getNestedValue(object, key) {
  return key.split(".").reduce((value, part) => value?.[part], object);
}

function t(key, variables = {}) {
  const value = getNestedValue(localeMessages[state?.language || "ar"], key) || getNestedValue(localeMessages.ar, key) || key;
  return Object.entries(variables).reduce((text, [name, replacement]) => text.replaceAll(`{{${name}}}`, replacement), value);
}

function translatedPhrase(value) {
  if (state.language !== "en") return value;
  const source = String(value || "");
  const trimmed = source.trim();
  if (!trimmed || !/[\u0600-\u06FF]/.test(trimmed)) return source;
  const prefix = trimmed.match(/^[^\u0600-\u06FF]*/)?.[0] || "";
  const core = trimmed.slice(prefix.length);
  const translated = operationalEnglishPhrases[trimmed] || operationalEnglishPhrases[core] || localeMessages.en.phrases?.[trimmed] || localeMessages.en.phrases?.[core];
  if (translated) return source.replace(trimmed, `${localeMessages.en.phrases?.[trimmed] ? "" : prefix}${translated}`);
  let composed = trimmed;
  for (const [arabic, english] of Object.entries(localeMessages.en.phrases || {}).sort((a, b) => b[0].length - a[0].length)) {
    if (composed.includes(arabic)) composed = composed.replaceAll(arabic, english);
  }
  if (!/[\u0600-\u06FF]/.test(composed)) return source.replace(trimmed, composed);
  // Keep the original copy when a phrase has not been translated yet. Replacing
  // it with a generic word made entire public sections read as "Content".
  return source;
}

function localizeElement(root) {
  if (!root || state.language !== "en") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest("script,style")) continue;
    node.nodeValue = translatedPhrase(node.nodeValue);
  }
  root.querySelectorAll("[placeholder],[title],[aria-label]").forEach((element) => {
    for (const attribute of ["placeholder", "title", "aria-label"]) {
      if (element.hasAttribute(attribute)) element.setAttribute(attribute, translatedPhrase(element.getAttribute(attribute)));
    }
  });
}

const defaultLinkedDevice = {
  status: "not_connected",
  linkMethod: "pairing",
  instanceId: "",
  instanceName: "",
  deviceName: "",
  phoneNumber: "",
  phoneInput: "",
  pairingCode: "",
  pairingSupported: true,
  qrLoading: false,
  qrImageLoaded: false,
  pairingLoading: false,
  qrError: "",
  pairingError: "",
  qrActive: false,
  qrExpiresAt: "",
  pairingExpiresAt: "",
  lastActivity: "",
  lastCheckAt: "",
  lastSendAt: "",
  messagesToday: 0,
  messagesMonth: 0,
  safetyScore: 0,
  queuedMessages: 0,
  alerts: [],
  activity: []
};

const state = {
  route: location.pathname,
  query: new URLSearchParams(location.search),
  navOpen: false,
  sidebarOpen: false,
  theme: readPreference("renewpilot_theme", "renewpilot.theme", "light"),
  language: readPreference("renewpilot_locale", "renewpilot.language", "ar"),
  profileOpen: false,
  resetStep: 1,
  resetEmail: "",
  billing: storage.get("renewpilot.billing", "monthly"),
  reportPeriod: "6",
  filter: "الكل",
  search: "",
  notificationDropdownOpen: false,
  notificationFilter: "all",
  subscriptionWindow: "7",
  settings: { whatsapp: false, email: false, sms: false, twoFactor: false, renewAuto: false },
  linkedDevice: { ...defaultLinkedDevice }
};

state.dbSubscriptions = null;
state.dbCustomers = null;
state.dashboardOverview = null;
state.notifications = null;
state.activities = null;
state.unsubscribes = null;
state.accountSettings = null;
state.readiness = null;
state.operationalIssues = null;
state.whatsappHealth = null;
state.securityScore = null;
state.notificationTemplate = null;
state.billingOverview = null;
state.messageUsage = null;
state.appsOverview = null;
state.sallaRuleDrafts = null;
state.sallaSettingsOpen = false;
state.orderLinkProfile = null;
state.orderLinkTemplates = null;
state.orderLinkSubscriptions = null;
state.orderLinks = null;
state.publicOrder = null;
state.publicOrderLoading = false;
state.publicOrderLookup = "";
state.publicOrderPresentation = null;
state.publicOrderPresentationLoading = false;
state.publicOrderPresentationKey = "";
state.orderLinkPreviewSlide = 0;
state.orderLinkCreating = false;
state.orderLinkDraft = {
  templateId: "",
  templateName: "",
  sourceMode: "existing",
  subscriptionId: "",
  customerId: "",
  manualOrderNumber: "",
  manualServiceName: "",
  manualPlanName: "",
  manualStartDate: todayDateInputValue(),
  manualStartDateEditable: false,
  manualEndDate: "",
  manualNotes: "",
  storeName: "",
  slug: "",
  style: "classic",
  themeColor: "#2563EB",
  headerText: "شكرًا لاختيارك خدماتنا",
  footerText: "Renvix",
  additionalNotes: [],
  visibleFields: {
    customerName: true, planName: true, startDate: true, endDate: true,
    remainingDays: true, status: true, storeName: true,
    additionalNotes: true, phoneNumber: false
  },
  expiresInDays: 30,
  isDefault: true
};
state.blogCategory = "الكل";
state.remoteLoading = {};

const routes = [
  ["/", "sidebar.home"],
  ["/features", "public.features"],
  ["/pricing", "public.pricing"],
  ["/blog", "المدونة"],
  ["/support", "public.support"]
];

const dashboardRoutes = [
  ["/dashboard", "الرئيسية", "home"],
  ["/dashboard/subscriptions", "الاشتراكات", "subscriptions"],
  ["/dashboard/customers", "العملاء", "customers"],
  ["/dashboard/renewal-template", "قالب رسالة التجديد", "template"],
  ["/dashboard/devices", "الأجهزة", "devices"],
  ["/dashboard/order-links", "إرسال معلومات الطلب", "orderLink"],
  ["/dashboard/apps", "تطبيقاتنا", "apps"],
  ["/dashboard/security", "الحماية والأمان", "security"],
  ["/dashboard/reports", "التقارير", "reports"],
  ["/dashboard/billing", "الفوترة والباقات", "billing"],
  ["/dashboard/settings", "الإعدادات", "settings"]
];

const dashboardAliases = {
  "/dashboard/renewals": "/dashboard/subscriptions",
  "/dashboard/connected-devices": "/dashboard/devices",
  "/dashboard/linked-devices": "/dashboard/devices",
  "/dashboard/whatsapp-safety": "/dashboard/security",
  "/dashboard/unsubscribe": "/dashboard/security",
  "/dashboard/warranty": "/dashboard/security",
  "/dashboard/activity": "/dashboard/reports",
  "/dashboard/notifications/template": "/dashboard/renewal-template",
  "/dashboard/readiness": "/dashboard/security",
  "/dashboard/issues": "/dashboard/security"
};

function applyPreferences() {
  const resolvedTheme = state.theme === "system"
    ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : state.theme;
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.lang = state.language;
  document.documentElement.dir = state.language === "ar" ? "rtl" : "ltr";
}

async function fetchJson(url, options = {}) {
  const { timeoutMessage, ...fetchOptions } = options;
  let response;
  try {
    response = await fetch(url, { credentials: "include", ...fetchOptions });
  } catch (error) {
    if (["AbortError", "TimeoutError"].includes(error?.name)) {
      const timeoutError = new Error(timeoutMessage || "استغرق الطلب وقتًا أطول من المتوقع. حاول مرة أخرى.");
      timeoutError.code = "EVOLUTION_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "Request failed");
    error.status = response.status;
    error.code = payload.code || payload.reason;
    error.payload = payload;
    error.usage = payload.usage || null;
    throw error;
  }
  return payload;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function isRealQrDataUri(value) {
  return typeof value === "string" && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]{1000,}$/.test(value);
}

async function loadRemotePage(key, url, target, options) {
  if (state.remoteLoading[key]) return;
  state.remoteLoading[key] = true;
  try {
    const payload = await fetchJson(url, options);
    state[target] = target === "orderLinks" || target === "notifications"
      ? payload
      : target === "orderLinkProfile"
        ? payload.profile
        : payload.items ?? payload.report ?? payload;
    if (target === "accountSettings" && payload.settings) {
      state.settings = {
        whatsapp: Boolean(payload.settings.notificationChannels?.whatsapp),
        email: Boolean(payload.settings.notificationChannels?.email),
        sms: Boolean(payload.settings.notificationChannels?.sms),
        twoFactor: Boolean(payload.settings.security?.twoFactor),
        renewAuto: Boolean(payload.settings.security?.renewAuto)
      };
    }
  } catch (error) {
    state[target] = { error: error.message || "تعذر تحميل البيانات" };
  } finally {
    state.remoteLoading[key] = false;
    render();
  }
}

function syncRouteData(force = false) {
  if (state.route.startsWith("/dashboard") && (force || state.dashboardOverview === null)) void loadRemotePage("overview", "/api/dashboard/overview", "dashboardOverview");
  if (state.route.startsWith("/dashboard") && (force || state.messageUsage === null)) void loadRemotePage("messageUsage", "/api/billing/message-usage", "messageUsage");
  if (state.route.startsWith("/dashboard") && (force || state.notifications === null)) {
    const notificationLimit = state.route === "/dashboard/notifications" ? 50 : 8;
    void loadRemotePage("notifications", `/api/notifications?limit=${notificationLimit}`, "notifications");
  }
  if (["/dashboard", "/dashboard/subscriptions"].includes(state.route) && (force || state.dbSubscriptions === null)) void loadRemotePage("subscriptions", "/api/subscriptions", "dbSubscriptions");
  if (state.route === "/dashboard/apps" && (force || state.appsOverview === null)) void loadRemotePage("appsOverview", "/api/apps", "appsOverview");
  if (["/dashboard", "/dashboard/subscriptions", "/dashboard/customers", "/dashboard/order-links"].includes(state.route) && (force || state.dbCustomers === null)) void loadRemotePage("customers", "/api/customers", "dbCustomers");
  if (state.route === "/dashboard/security" && (force || state.unsubscribes === null)) void loadRemotePage("unsubscribes", "/api/unsubscribes", "unsubscribes");
  if (state.route === "/dashboard/security" && (force || state.securityScore === null)) void loadRemotePage("securityScore", "/api/security/score", "securityScore");
  if (["/dashboard/security", "/dashboard/devices"].includes(state.route) && (force || state.whatsappHealth === null)) void loadRemotePage("whatsappHealth", "/api/whatsapp/health", "whatsappHealth");
  if (state.route === "/dashboard/renewal-template" && (force || state.notificationTemplate === null)) void loadRemotePage("renewalTemplate", "/api/templates/renewal", "notificationTemplate");
  if (state.route === "/dashboard/order-links") {
    if (force || state.orderLinkProfile === null) void loadRemotePage("orderLinkProfile", "/api/order-link/profile", "orderLinkProfile");
    if (force || state.orderLinkTemplates === null) void loadRemotePage("orderLinkTemplates", "/api/order-link/templates", "orderLinkTemplates");
    if (force || state.orderLinkSubscriptions === null) void loadRemotePage("orderLinkSubscriptions", "/api/order-link/subscriptions", "orderLinkSubscriptions");
    if (force || state.orderLinks === null) void loadRemotePage("orderLinks", "/api/order-link/list", "orderLinks");
  }
  if (state.route === "/dashboard/billing" && (force || state.billingOverview === null)) void loadRemotePage("billing", "/api/billing", "billingOverview");
  if (state.route === "/dashboard/settings" && (force || state.accountSettings === null)) void loadRemotePage("settings", "/api/settings", "accountSettings");
}

async function ensureLinkingInstance(options = {}) {
  if (state.linkedDevice.instanceId) return state.linkedDevice;
  const payload = await fetchJson("/api/whatsapp/instances/create", { method: "POST", ...options });
  state.linkedDevice = {
    ...state.linkedDevice,
    ...payload.instance,
    instanceId: payload.instance?.id,
    instanceName: payload.instance?.instanceName || "",
    qrBase64: payload.instance?.qrBase64 || ""
  };
  return state.linkedDevice;
}

async function syncLinkedDevice() {
  if (state.deviceSyncing) return;
  state.deviceSyncing = true;
  try {
    const response = await fetch("/api/whatsapp/instances/create");
    if (!response.ok) return;
    const payload = await response.json();
    if (payload.instance) {
      state.linkedDevice = { ...state.linkedDevice, ...payload.instance, instanceId: payload.instance.id };
      render();
    }
  } finally {
    state.deviceSyncing = false;
  }
}

async function browserSessionIsValid() {
  try {
    const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" });
    const payload = await response.json().catch(() => null);
    return response.ok && payload?.ok === true && Boolean(payload.user?.id);
  } catch {
    return false;
  }
}

async function navigate(to) {
  const url = new URL(to, location.origin);
  url.pathname = dashboardAliases[url.pathname] || url.pathname;
  if (url.pathname.startsWith("/dashboard")) {
    if (!await browserSessionIsValid()) {
      history.pushState({}, "", "/login");
      state.route = "/login";
      render();
      toast(t("auth.invalidCredentials"), "danger");
      return;
    }
  }
  history.pushState({}, "", url.pathname + url.search);
  state.route = url.pathname;
  state.query = url.searchParams;
  state.navOpen = false;
  state.sidebarOpen = false;
  state.profileOpen = false;
  state.notificationDropdownOpen = false;
  state.search = "";
  state.filter = "الكل";
  render();
  if (state.route === "/dashboard/devices") void syncLinkedDevice();
}

async function enterDashboardAfterSessionVerification() {
  if (!await browserSessionIsValid()) return false;
  history.pushState({}, "", "/dashboard");
  state.route = "/dashboard";
  state.query = new URLSearchParams();
  state.navOpen = false;
  state.sidebarOpen = false;
  state.profileOpen = false;
  state.search = "";
  render();
  return true;
}

function toneClass(value = "") {
  const normalized = String(value).toLowerCase();
  if (["نشط", "تم التجديد", "تم التسليم", "محلولة", "منخفض", "active", "renewed", "connected", "sent", "delivered", "read"].some((x) => normalized.includes(x))) return "success";
  if (["قريب", "انتظار", "مراجعة", "متوسطة", "pending", "expiring", "connecting"].some((x) => normalized.includes(x))) return "warning";
  if (["متأخر", "فشلت", "عالية", "مرتفع", "expired", "failed", "error", "risk"].some((x) => normalized.includes(x))) return "danger";
  if (["موقوف", "paused", "inactive", "disconnected", "cancelled"].some((x) => normalized.includes(x))) return "neutral";
  return "info";
}

function status(value) {
  const labels = state.language === "ar" ? {
    active: "نشط", inactive: "غير نشط", expiring_soon: "ينتهي قريبًا", expired: "منتهي",
    renewed: "تم التجديد", paused: "موقوف", cancelled: "ملغي", connected: "متصل",
    disconnected: "غير متصل", not_connected: "غير متصل", pending_qr: "بانتظار الباركود",
    pending_pairing: "بانتظار الاقتران", connecting: "جارٍ الاتصال", sent: "تم الإرسال",
    delivered: "تم التسليم", read: "تمت القراءة", failed: "فشل"
  } : {};
  const label = labels[value] || value || (state.language === "ar" ? "غير محدد" : "Unknown");
  return `<span class="status ${toneClass(value)}">${escapeHtml(label)}</span>`;
}

function icon(text, tone = "") {
  return `<span class="icon-bubble ${tone}">${text}</span>`;
}

function logo() {
  const destination = state.route.startsWith("/dashboard") ? "/dashboard" : "/";
  const appName = t("app.name") || "Renvix";
  return `<button class="brand btn-ghost" data-link="${destination}" aria-label="${escapeHtml(appName)}">
    <img class="brand-logo-image" src="/assets/renewpilot-logo-horizontal.png" alt="${escapeHtml(appName)}">
  </button>`;
}

function stackedLogo() {
  const appName = t("app.name") || "Renvix";
  return `<div class="brand-logo-stacked" role="img" aria-label="${escapeHtml(appName)}">
    <img class="brand-logo-image" src="/assets/renewpilot-logo-horizontal.png" alt="${escapeHtml(appName)}">
  </div>`;
}

function dashboardIcon(name) {
  const paths = {
    home: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    subscriptions: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M8 15h4"/>',
    customers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    devices: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    security: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    reports: '<path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/>',
    template: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    orderLink: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><rect x="8" y="8" width="8" height="8" rx="2"/>',
    apps: '<path d="M19 13h-2.5a1.5 1.5 0 0 0-1.5 1.5V17h-3v-2.5a1.5 1.5 0 0 0-1.5-1.5H8V10h2.5A1.5 1.5 0 0 0 12 8.5V6h3v2.5a1.5 1.5 0 0 0 1.5 1.5H19z"/><path d="M8 10V7a2 2 0 1 0-4 0v3H2v4h2v3a2 2 0 1 0 4 0v-4"/><path d="M19 10h1a2 2 0 1 0 0-4h-2V3h-4v3"/>',
    language: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3C9.6 5.5 8.4 8.5 8.4 12s1.2 6.5 3.6 9"/>',
    billing: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
    notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.61.65 1.05 1.27 1.05H21v4h-.08c-.63 0-1.16.44-1.52 1z"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
    "eye-off": '<path d="m3 3 18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.6 18.6 0 0 1-3.1 3.8M6.2 6.2C3.6 8 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 3.2-.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  };
  return `<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.home}</svg>`;
}

function ensurePasswordToggles() {
  for (const input of app.querySelectorAll('input[type="password"]')) {
    if (input.parentElement?.classList.contains("password-input-wrap")) continue;
    const wrapper = document.createElement("span");
    wrapper.className = "password-input-wrap";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "password-toggle";
    button.dataset.action = "toggle-password";
    button.setAttribute("aria-label", "إظهار كلمة المرور");
    button.innerHTML = dashboardIcon("eye");
    wrapper.appendChild(button);
  }
}

function publicNavbar() {
  const links = routes.map(([path, key]) => `<button class="nav-link ${state.route === path ? "active" : ""}" data-link="${path}">${t(key)}</button>`).join("");
  const themeIcon = state.theme === "dark" ? "☾" : "☼";
  return `<nav class="public-nav ${state.navOpen ? "open" : ""}">
    <div class="container nav-inner">
      ${logo()}
      <div class="nav-links">${links}</div>
      <div class="nav-actions">
        <button class="btn btn-ghost icon-btn public-theme" data-action="theme" title="${t("settings.theme")}">${themeIcon}</button>
        <button class="locale-link ${state.language === "ar" ? "active" : ""}" data-action="language" data-language="ar">AR</button>
        <span class="locale-divider">|</span>
        <button class="locale-link ${state.language === "en" ? "active" : ""}" data-action="language" data-language="en">EN</button>
        <button class="btn btn-primary" data-link="/register">${t("auth.createAccount")} ${dashboardIcon("customers")}</button>
        <button class="btn btn-secondary" data-link="/login">${t("auth.loginTitle")} ${dashboardIcon("customers")}</button>
      </div>
      <button class="btn btn-secondary icon-btn mobile-menu" data-action="toggle-public-nav" aria-label="القائمة">☰</button>
    </div>
  </nav>`;
}

function publicShell(content) {
  return `<div class="page-shell public-site">${publicNavbar()}${content}${publicFooter()}</div>`;
}

function publicFooter() {
  return `<footer class="public-footer"><div class="container public-footer-inner">
    <div class="footer-brand-mini">${logo()}<span>© 2026 Renvix. جميع الحقوق محفوظة.</span></div>
    <nav class="footer-links" aria-label="روابط سريعة"><button data-link="/about">عن المنصة</button><button data-link="/privacy">سياسة الخصوصية</button><button data-link="/terms">سياسة الاستخدام</button><button data-link="/refund-policy">سياسة الاستبدال والاسترجاع</button><button data-link="/support">الدعم</button><button data-link="/contact">تواصل معنا</button><button data-link="/blog">المدونة</button></nav>
    <div class="footer-social"><a href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">in</a><a href="https://www.youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube">▶</a><a href="https://x.com" target="_blank" rel="noreferrer" aria-label="X">X</a><a href="https://wa.me/" target="_blank" rel="noreferrer" aria-label="WhatsApp">◉</a></div>
  </div></footer>`;
}

function pageHero(title, lead, actions = "") {
  return `<section class="page-hero">
    <div class="container">
      <span class="eyebrow">Renvix</span>
      <h1>${title}</h1>
      <p class="lead">${lead}</p>
      ${actions ? `<div class="hero-actions center-actions">${actions}</div>` : ""}
    </div>
  </section>`;
}

function statGrid(items) {
  return `<div class="grid grid-5 dashboard-stat-grid">${items.map((item) => `<article class="card stat-card ${item.tone || "info"}">
    <div><span class="muted">${item.title}</span><strong>${item.value}</strong><small>${item.caption || item.change || ""}</small></div>
    <span class="stat-card-icon">${dashboardIcon(item.icon || "reports")}</span>
  </article>`).join("")}</div>`;
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString(state.language === "ar" ? "ar-SA" : "en-US", { maximumFractionDigits: 2 })} ${state.language === "ar" ? "ر.س" : "SAR"}`;
}

function overviewStats() {
  return state.dashboardOverview?.stats || {
    totalSubscriptions: 0, upcomingRenewals: 0, expiredSubscriptions: 0,
    totalCustomers: 0, activeCustomers: 0, activeToday: 0,
    connectedDevices: 0, pendingDevices: 0, monthlyRevenue: 0,
    totalMessages: 0, sentMessages: 0, deliveryRate: 0, successRate: 0,
    blockedNumbers: 0, safeRules: 0, renewedCustomers: 0
  };
}

function performanceChart(rows = []) {
  const values = rows.map((row) => Number(row.value || 0));
  const max = Math.max(...values, 0);
  if (!max) return emptyState("لا توجد بيانات أداء بعد", "ستظهر حركة الإيراد هنا بعد إضافة الاشتراكات.");
  return `<div class="performance-chart" aria-label="الأداء خلال ستة أشهر">${rows.map((row) => `<div class="performance-column"><span style="height:${Math.max(8, Math.round((Number(row.value || 0) / max) * 100))}%"></span><small>${escapeHtml(row.month)}</small></div>`).join("")}</div>`;
}

function dashboardPreview() {
  return `<article class="dashboard-reference"><img src="/assets/dashboard-preview.png" alt="معاينة لوحة تحكم Renvix"></article>`;
}

function featureGrid(limit = features.length) {
  return `<div class="grid grid-4">${features.slice(0, limit).map(([title, body, mark], index) => `<article class="card feature-card">
    ${icon(mark, index % 4 === 1 ? "purple" : index % 4 === 2 ? "green" : index % 4 === 3 ? "orange" : "")}
    <h3>${title}</h3>
    <p class="muted">${body}</p>
  </article>`).join("")}</div>`;
}

function pricingCards(short = false) {
  return `<div class="grid grid-3">${pricingPlans.map((plan) => {
    const price = state.billing === "yearly" ? plan.yearly : plan.monthly;
    return `<article class="card pricing-card ${plan.featured ? "featured" : ""}">
      ${plan.featured ? `<span class="badge">الأكثر شعبية</span>` : ""}
      <div><h3>${plan.name}</h3><p class="muted">${plan.caption}</p></div>
      <div class="price">${price} ر.س <small>/ شهريًا</small></div>
      <p class="muted">${plan.customers} · ${plan.alerts}</p>
      <ul class="check-list">${plan.features.slice(0, short ? 3 : plan.features.length).map((item) => `<li>${item}</li>`).join("")}</ul>
      <button class="btn btn-primary" data-action="select-plan" data-plan="${plan.id}">ابدأ الآن</button>
    </article>`;
  }).join("")}</div>`;
}

function homePage() {
  return publicShell(`<main>
    <section class="hero">
      <div class="container hero-grid">
        <div>
          <span class="eyebrow">منصة تجديدات ذكية</span>
          <h1>إدارة الاشتراكات والتجديدات بذكاء</h1>
          <p class="lead">منصة تساعدك على تتبع اشتراكات عملائك، إرسال تنبيهات التجديد تلقائيًا، وزيادة معدلات التجديد والإيرادات.</p>
          <div class="hero-actions">
            <button class="btn btn-primary" data-link="/login">ابدأ مجانًا</button>
            <button class="btn btn-secondary" data-link="/dashboard">شاهد لوحة التحكم</button>
          </div>
          <div class="trust-row">
            <div class="trust-item"><strong>99.9%</strong><span>وقت تشغيل</span></div>
            <div class="trust-item"><strong>+10,000</strong><span>عميل نشط</span></div>
            <div class="trust-item"><strong>+300%</strong><span>زيادة في التجديدات</span></div>
          </div>
        </div>
        ${dashboardPreview()}
      </div>
    </section>
    <section class="section"><div class="container">
      <div class="section-head"><div><h2>كل ما تحتاجه لإدارة دورة التجديد</h2><p class="muted">تنبيهات، عملاء، ضمان، وتحليلات من لوحة واحدة.</p></div><button class="btn btn-secondary" data-link="/features">عرض كل المميزات</button></div>
      ${featureGrid(4)}
    </div></section>
    <section class="section"><div class="container">
      <div class="section-head"><div><h2>باقات واضحة وقابلة للنمو</h2><p class="muted">ابدأ صغيرًا ثم وسع التشغيل بدون تعقيد.</p></div><button class="btn btn-secondary" data-link="/pricing">مقارنة الباقات</button></div>
      ${pricingCards(true)}
    </div></section>
    <section class="section"><div class="container">
      <div class="section-head"><div><h2>من التنبيه إلى التجديد في 3 خطوات ذكية</h2><p class="muted">سير عمل بسيط يحافظ على العميل قريبًا من قرار التجديد.</p></div></div>
      <div class="grid grid-3 steps">
        ${["تنبيه ذكي", "رابط تجديد آمن", "تجديد وتأكيد فوري"].map((item) => `<article class="card step-card"><h3>${item}</h3><p class="muted">خطوة منظمة قابلة للتتبع مع سجل كامل لكل عميل.</p></article>`).join("")}
      </div>
    </div></section>
    <section class="section"><div class="container">${cta()}</div></section>
  </main>`);
}

function cta() {
  return `<div class="cta-band"><div><h2>ابدأ بتحويل التجديدات إلى إيرادات متوقعة</h2><p>كل عميل، كل رسالة، وكل رابط تجديد في نظام واضح.</p></div><button class="btn btn-secondary" data-link="/login">ابدأ الآن</button></div>`;
}

function featuresPage() {
  return publicShell(`<main>
    ${pageHero("مميزات ذكية لإدارة الاشتراكات والتجديدات", "أدوات مترابطة تساعد فريقك على تقليل الفوات، تحسين التواصل، ورفع معدل التجديد.", `<button class="btn btn-primary" data-link="/login">ابدأ مجانًا</button><button class="btn btn-secondary" data-action="open-demo">احجز عرضًا توضيحيًا</button>`)}
    <section class="section"><div class="container">${featureGrid()}</div></section>
    <section class="section"><div class="container">
      <div class="section-head"><div><h2>من التنبيه إلى التجديد في 3 خطوات ذكية</h2><p class="muted">رسالة دقيقة، رابط واضح، وتأكيد فوري في سجل العميل.</p></div></div>
      <div class="grid grid-3 steps">
        ${["تنبيه ذكي", "رابط تجديد آمن", "تجديد وتأكيد فوري"].map((item) => `<article class="card step-card"><h3>${item}</h3><p class="muted">تجربة مبسطة تقلل المتابعة اليدوية وتزيد الوضوح للعميل.</p></article>`).join("")}
      </div>
    </div></section>
  </main>`);
}

function pricingPage() {
  return publicShell(`<main>
    ${pageHero("خطط أسعار مرنة تناسب جميع المتاجر", "اختر الباقة المناسبة الآن، ويمكنك ترقية الخطة عندما يكبر حجم الاشتراكات.", `<div class="pricing-toggle"><button class="toggle-pill ${state.billing === "monthly" ? "active" : ""}" data-action="billing" data-billing="monthly">شهري</button><button class="toggle-pill ${state.billing === "yearly" ? "active" : ""}" data-action="billing" data-billing="yearly">سنوي وفر 20%</button></div>`)}
    <section class="section"><div class="container">${pricingCards()}</div></section>
    <section class="section"><div class="container">
      <div class="section-head"><div><h2>مقارنة الباقات</h2><p class="muted">تفاصيل تساعدك على اختيار الخطة بدقة.</p></div></div>
      <div class="card compare"><table><thead><tr><th>الميزة</th><th>Starter</th><th>Pro</th><th>Business</th></tr></thead><tbody>
        ${["عدد العملاء", "عدد التنبيهات شهريًا", "تنبيهات واتساب", "بوابة العملاء", "التحليلات", "المركز الضماني", "الذكاء الاصطناعي", "API", "الفريق والصلاحيات"].map((row, i) => `<tr><td>${row}</td><td>${i < 2 ? (i ? "2,000" : "500") : i < 5 ? "أساسي" : "غير متاح"}</td><td>${i < 2 ? (i ? "20,000" : "5,000") : "متاح"}</td><td>${i < 2 ? "غير محدود" : "متقدم"}</td></tr>`).join("")}
      </tbody></table></div>
    </div></section>
    <section class="section"><div class="container"><div class="grid grid-4">
      ${["تجربة مجانية", "دعم فني", "أمان وخصوصية", "ضمان استعادة الأموال"].map((item, i) => `<article class="card feature-card">${icon(String(i + 1), i % 2 ? "green" : "")}<h3>${item}</h3><p class="muted">سياسة واضحة تساعدك على البدء بثقة.</p></article>`).join("")}
    </div></div></section>
  </main>`);
}

function supportPage() {
  return publicShell(`<main>
    ${pageHero("مركز الدعم والمساعدة", "فريق دعم متخصص جاهز لمساعدتك في كل خطوة.")}
    <section class="section section-tight"><div class="container">
      <div class="support-search search-wrap"><span class="search-icon">⌕</span><input class="input" data-action="support-search" placeholder="ابحث في المقالات والمساعدة..." value="${state.search}"></div>
      <div class="chips">${["ربط مزود البريد", "إنشاء أول اشتراك", "حل مشكلة التكامل", "تحديث طريقة الدفع"].map((item) => `<button class="chip" data-action="support-chip" data-term="${item}">${item}</button>`).join("")}</div>
    </div></section>
    <section class="section"><div class="container">
      <div class="grid grid-4">
        ${[
          ["فتح تذكرة دعم", "أرسل تفاصيل المشكلة وسنرتبها حسب الأولوية.", "فتح تذكرة جديدة", "open-ticket"],
          ["الدردشة المباشرة", "ابدأ محادثة فورية مع فريق الدعم.", "ابدأ الدردشة", "open-chat"],
          ["تواصل عبر البريد", "اكتب رسالة دعم مفصلة عبر البريد.", "إرسال بريد", "open-email"],
          ["تواصل عبر واتساب", "افتح محادثة واتساب مبدئية.", "بدء محادثة واتساب", "open-whatsapp"]
        ].map(([title, body, btn, action], i) => `<article class="card support-card">${icon(state.language === "en" ? "•" : title.slice(0, 1), i === 1 ? "green" : i === 2 ? "purple" : i === 3 ? "orange" : "")}<h3>${title}</h3><p class="muted">${body}</p><button class="btn btn-secondary" data-action="${action}">${btn}</button></article>`).join("")}
      </div>
    </div></section>
    <section class="section"><div class="container split">
      <article class="card table-card"><h2>قاعدة المعرفة</h2><div class="grid grid-3">${knowledgeBase.map((item) => `<button class="chip" data-action="knowledge" data-term="${item}">${item}</button>`).join("")}</div></article>
      <article class="card table-card"><h2>مساعد Renvix</h2><p class="muted">اكتب سؤالك وسنعرض ردًا مبدئيًا إلى حين ربط المساعد.</p><form data-submit="ai-question"><textarea class="textarea" name="question" required placeholder="اكتب سؤالك هنا"></textarea><br><button class="btn btn-primary">إرسال السؤال</button></form></article>
    </div></section>
    <section class="section"><div class="container"><article class="card table-card"><h2>حالة التذاكر</h2>${simpleTable(["رقم التذكرة", "الموضوع", "الحالة"], [["TK-108", "ربط مزود البريد", status("قيد الانتظار")], ["TK-104", "تحديث طريقة الدفع", status("محلولة")]])}</article></div></section>
  </main>`);
}

const localizedCopy = (arabic, english) => state.language === "en" ? english : arabic;
const localizedField = (value) => typeof value === "object" ? localizedCopy(value.ar, value.en) : value;

const publicBlogPosts = [
  {
    slug: "renewal-strategies",
    category: "التجديدات",
    image: "/assets/blog/renewal-strategies.png",
    title: { ar: "7 استراتيجيات مثبتة لزيادة معدلات تجديد الاشتراكات والاحتفاظ بالعملاء", en: "7 proven strategies to improve subscription renewals and retention" },
    excerpt: { ar: "خطوات عملية تقلل الإلغاءات وتحسن تجربة العميل في كل مرحلة من دورة التجديد.", en: "Practical steps that reduce cancellations and improve the customer experience throughout the renewal cycle." },
    date: { ar: "8 مايو 2026", en: "May 8, 2026" },
    minutes: { ar: "9 دقائق قراءة", en: "9 min read" },
    sections: [
      { heading: { ar: "ابدأ قبل تاريخ الانتهاء", en: "Start before the expiration date" }, body: { ar: "رحلة التجديد الفعالة لا تبدأ في اليوم الأخير. قسّم التنبيهات إلى مراحل واضحة قبل 30 يومًا و14 يومًا و7 أيام، ثم عدّل التوقيت حسب نوع الخدمة وسلوك العميل.", en: "An effective renewal journey does not begin on the final day. Schedule clear touchpoints 30, 14, and 7 days before expiry, then adjust timing to the service and customer behavior." } },
      { heading: { ar: "اجعل الرسالة واضحة وقابلة للتنفيذ", en: "Make every message clear and actionable" }, body: { ar: "اذكر الخدمة وتاريخ الانتهاء والخطوة التالية بوضوح، وأضف رابط تجديد مباشرًا وآمنًا. الرسالة القصيرة التي تجيب عن سؤال: ماذا أفعل الآن؟ تحقق استجابة أعلى.", en: "State the service, expiration date, and next step clearly, then include a direct and secure renewal link. A concise message that answers “What should I do now?” earns better responses." } },
      { heading: { ar: "استخدم القناة المناسبة", en: "Use the right channel" }, body: { ar: "واتساب مناسب للتنبيهات السريعة، والبريد أفضل للتفاصيل والفواتير. اجمع القنوات ضمن تسلسل واحد، وتوقف فور تفاعل العميل حتى لا يتلقى رسائل مكررة.", en: "WhatsApp works well for timely reminders, while email is better for details and invoices. Coordinate channels in one sequence and stop follow-ups as soon as the customer responds." } },
      { heading: { ar: "قِس وحسّن باستمرار", en: "Measure and improve continuously" }, body: { ar: "راقب معدل التسليم والاستجابة والتحويل ووقت التجديد. قارن النتائج بين الشرائح والرسائل، ثم حسّن النص والتوقيت بناءً على البيانات الفعلية لا الانطباعات.", en: "Track delivery, response, conversion, and time-to-renewal. Compare segments and messages, then improve copy and timing using real data rather than assumptions." } }
    ],
    takeaways: { ar: ["ابدأ التواصل مبكرًا دون إزعاج العميل.", "اجعل لكل رسالة هدفًا وخطوة تالية واحدة.", "أوقف التذكيرات فور اكتمال التجديد."], en: ["Start early without overwhelming the customer.", "Give every message one goal and one next step.", "Stop reminders immediately after renewal."] }
  },
  {
    slug: "renewal-guide", category: "التجديدات", image: "/assets/blog/renewal-guide.png",
    title: { ar: "دليل شامل لتجديد الاشتراكات بنجاح مستمر", en: "A complete guide to consistent subscription renewals" },
    excerpt: { ar: "منهج واضح لبناء رحلة تجديد سلسة ترفع الولاء على المدى الطويل.", en: "A clear framework for building a smooth renewal journey that strengthens long-term loyalty." },
    date: { ar: "6 مايو 2026", en: "May 6, 2026" }, minutes: { ar: "7 دقائق قراءة", en: "7 min read" },
    sections: [
      { heading: { ar: "وحّد بيانات الاشتراك", en: "Unify subscription data" }, body: { ar: "احفظ العميل والخدمة وتواريخ البداية والانتهاء وحالة الدفع في سجل واحد. البيانات المنظمة تمنع فقدان المواعيد وتمنح الفريق سياقًا كاملًا عند المتابعة.", en: "Keep the customer, service, start and end dates, and payment status in one record. Structured data prevents missed dates and gives the team complete context." } },
      { heading: { ar: "صمّم مسارًا قابلًا للتكرار", en: "Design a repeatable workflow" }, body: { ar: "حدد من يتلقى التنبيه ومتى وبأي قناة، وما الذي يحدث عند الرد أو التجديد أو فشل الإرسال. المسار الواضح يقلل العمل اليدوي ويمنع الاجتهادات المتعارضة.", en: "Define who receives each reminder, when, through which channel, and what happens after a reply, renewal, or delivery failure. A clear workflow reduces manual work and inconsistency." } },
      { heading: { ar: "أغلق الحلقة بعد التجديد", en: "Close the loop after renewal" }, body: { ar: "حدّث تاريخ الانتهاء والحالة وسجّل العملية ثم أوقف الرسائل المجدولة. أرسل تأكيدًا فقط عندما يختار الفريق ذلك، واحفظ كل خطوة في سجل النشاط.", en: "Update the end date and status, log the action, and stop scheduled messages. Send a confirmation only when selected by the team, and keep every step in the activity log." } }
    ],
    takeaways: { ar: ["مصدر بيانات واحد لكل اشتراك.", "قواعد واضحة للفشل والاستجابة.", "سجل نشاط كامل بعد التجديد."], en: ["One source of truth for every subscription.", "Clear rules for failures and responses.", "A complete activity trail after renewal."] }
  },
  {
    slug: "whatsapp-messages", category: "النصائح", image: "/assets/blog/whatsapp-messages.png",
    title: { ar: "أفضل ممارسات رسائل واتساب لتحسين الاستجابة", en: "WhatsApp messaging practices that improve response rates" },
    excerpt: { ar: "صياغات عملية وتوقيتات مناسبة تساعدك على رفع معدلات الرد والتجديد.", en: "Practical copy and timing choices that help improve replies and renewals." },
    date: { ar: "5 مايو 2026", en: "May 5, 2026" }, minutes: { ar: "6 دقائق قراءة", en: "6 min read" },
    sections: [
      { heading: { ar: "ابدأ بالسياق لا بالإعلان", en: "Lead with context, not promotion" }, body: { ar: "عرّف بالجهة والخدمة وسبب التواصل في أول سطر. تجنب الرسائل العامة، واستخدم اسم العميل والخدمة وتاريخ الانتهاء عندما تكون البيانات مؤكدة.", en: "Identify your business, the service, and the reason for contacting the customer in the first line. Avoid generic copy and personalize only with verified data." } },
      { heading: { ar: "احترم الوقت والتفضيلات", en: "Respect timing and preferences" }, body: { ar: "أرسل خلال ساعات العمل، واحترم قائمة إيقاف الرسائل، ولا تكرر نفس التنبيه. الرسائل الأقل والأوضح تحافظ على الثقة وجودة القناة.", en: "Send during business hours, honor opt-outs, and never repeat the same trigger. Fewer, clearer messages protect customer trust and channel quality." } },
      { heading: { ar: "راقب التسليم قبل زيادة الحجم", en: "Watch delivery before increasing volume" }, body: { ar: "ابدأ بحجم إرسال تدريجي، وراقب الفشل والحظر والاستجابة. إذا ارتفعت المخاطر أو انقطعت القناة، أوقف الإرسال التلقائي وعالج السبب أولًا.", en: "Increase sending volume gradually and monitor failures, blocks, and responses. If risk rises or the channel disconnects, pause automation and resolve the cause first." } }
    ],
    takeaways: { ar: ["رسالة قصيرة بسياق واضح.", "خيار إيقاف الرسائل متاح دائمًا.", "لا إرسال قبل اتصال القناة."], en: ["Short messages with clear context.", "Always provide and honor opt-out choices.", "Never send before the channel is connected."] }
  },
  {
    slug: "renewal-kpis", category: "التقارير", image: "/assets/blog/renewal-kpis.png",
    title: { ar: "مؤشرات الأداء الرئيسية في إدارة التجديدات", en: "The essential KPIs for renewal management" },
    excerpt: { ar: "تعرف على أهم المؤشرات وكيفية تحليلها لاتخاذ قرارات أفضل.", en: "Understand the most useful metrics and how to interpret them for better decisions." },
    date: { ar: "29 أبريل 2026", en: "April 29, 2026" }, minutes: { ar: "8 دقائق قراءة", en: "8 min read" },
    sections: [
      { heading: { ar: "معدل التجديد", en: "Renewal rate" }, body: { ar: "قس عدد الاشتراكات التي جُددت من إجمالي الاشتراكات المستحقة خلال الفترة نفسها. افصل النتائج حسب الخطة والخدمة وشريحة العميل حتى تظهر فرص التحسين الحقيقية.", en: "Measure renewed subscriptions against all subscriptions due in the same period. Segment by plan, service, and customer group to reveal real improvement opportunities." } },
      { heading: { ar: "معدل التسليم والاستجابة", en: "Delivery and response rates" }, body: { ar: "معدل التسليم يوضح صحة القنوات، بينما يكشف معدل الاستجابة جودة الرسالة والتوقيت. لا تخلط بينهما عند تقييم أداء الحملة.", en: "Delivery rate reflects channel health, while response rate reveals message and timing quality. Keep them separate when evaluating campaign performance." } },
      { heading: { ar: "الوقت حتى التجديد", en: "Time to renewal" }, body: { ar: "احسب المدة بين أول تنبيه واكتمال التجديد. انخفاضها مع ثبات رضا العملاء يعني أن المسار أصبح أوضح وأسهل.", en: "Measure the time from the first reminder to completed renewal. A shorter cycle with stable customer satisfaction indicates a clearer, easier journey." } }
    ],
    takeaways: { ar: ["حلّل المؤشرات حسب الشريحة.", "افصل صحة القناة عن جودة الرسالة.", "راجع الاتجاه لا الرقم المنفرد."], en: ["Analyze metrics by segment.", "Separate channel health from message quality.", "Review trends, not isolated numbers."] }
  },
  {
    slug: "safe-whatsapp", category: "الحماية", image: "/assets/blog/safe-whatsapp.png",
    title: { ar: "كيف تضمن رسائل آمنة ومتوافقة عبر واتساب؟", en: "How to keep WhatsApp messages safe and compliant" },
    excerpt: { ar: "دليل شامل للامتثال وحماية الحساب من الحظر وتحسين جودة الإرسال.", en: "A practical guide to compliance, account protection, and healthy message delivery." },
    date: { ar: "25 أبريل 2026", en: "April 25, 2026" }, minutes: { ar: "8 دقائق قراءة", en: "8 min read" },
    sections: [
      { heading: { ar: "أرسل بموافقة واضحة", en: "Send with clear consent" }, body: { ar: "احتفظ بمصدر الموافقة وسبب التواصل، ولا تستخدم رقمًا حصلت عليه لغرض مختلف. اجعل إيقاف الرسائل بسيطًا وطبّقه فورًا على جميع الحملات.", en: "Keep a record of consent and the communication purpose. Do not reuse numbers collected for another reason, and apply opt-outs immediately across all campaigns." } },
      { heading: { ar: "فعّل ضوابط الإرسال الآمن", en: "Use safe-sending controls" }, body: { ar: "ضع حدودًا يومية وساعية، وساعات هدوء، ومنعًا للتكرار، وفحصًا لحالة القناة قبل الإرسال. سجّل سبب أي منع حتى يستطيع الفريق المراجعة.", en: "Set hourly and daily limits, quiet hours, duplicate prevention, and a channel health check before sending. Log every block reason so the team can review it." } },
      { heading: { ar: "تعامل مع المخاطر مبكرًا", en: "Respond to risk early" }, body: { ar: "إذا ارتفعت نسبة الفشل أو انخفض التفاعل أو زادت طلبات الإيقاف، خفّض الحجم وراجع القوائم والقوالب. لا تستأنف الأتمتة حتى يعود المؤشر إلى مستوى آمن.", en: "If failures rise, engagement falls, or opt-outs increase, reduce volume and review lists and templates. Do not resume automation until risk returns to a safe level." } }
    ],
    takeaways: { ar: ["موافقة موثقة قبل الإرسال.", "حدود وساعات هدوء ومنع تكرار.", "إيقاف تلقائي عند ارتفاع المخاطر."], en: ["Documented consent before sending.", "Limits, quiet hours, and duplicate prevention.", "Automatic pause when risk becomes high."] }
  }
];

function marketingHomePage() {
  const highlights = [
    ["إدارة اشتراكات ذكية", "أتمتة التجديدات والتنبيهات وتقليل الانقطاعات وزيادة رضا العملاء.", "subscriptions"],
    ["تذكيرات متعددة القنوات", "إرسال عبر واتساب وSMS والبريد الإلكتروني في الوقت المناسب.", "template"],
    ["ربط الأجهزة بسهولة", "دعم الباركود ورمز الاقتران لأكثر من جهاز وقناة.", "devices"],
    ["تقارير وتحليلات متقدمة", "لوحات واضحة لاتخاذ قرارات أفضل وتنمية عملك.", "reports"]
  ];
  return publicShell(`<main>
    <section class="marketing-hero"><div class="container marketing-hero-grid">
      <div class="marketing-copy"><span class="hero-trust-pill"><img src="/assets/renvix-mark.png" alt=""><span>${localizedCopy("اشتراكات منظمة، تجديدات في وقتها", "Organized subscriptions, renewals on time")}</span><i aria-hidden="true"></i></span><h1>${localizedCopy("أدر اشتراكاتك وتجديدات عملائك بذكاء مع", "Manage customer subscriptions and renewals intelligently with")} <span>Renvix</span></h1><p class="lead">Renvix منصة ذكية تساعدك على إدارة الاشتراكات، متابعة التجديدات، إرسال التنبيهات، وإنشاء روابط معلومات الطلب باحترافية.</p><div class="hero-actions"><button class="btn btn-primary" data-link="/register">ابدأ الآن</button><button class="btn btn-secondary" data-link="/features">استكشف المميزات</button></div></div>
      <div class="hero-product-preview">${dashboardPreview()}</div>
    </div></section>
    <section class="marketing-strip"><div class="container grid grid-4">${highlights.map(([title, body, mark]) => `<article class="marketing-mini">${dashboardIcon(mark)}<div><h3>${title}</h3><p>${body}</p></div></article>`).join("")}</div></section>
    <section class="marketing-metrics"><div class="container">${[["+10,000", "عميل نشط", "customers"], ["+250,000", "اشتراك مدار", "subscriptions"], ["98.6%", "معدل تسليم الرسائل", "template"], ["+3", "سنوات من التطوير والابتكار", "security"]].map(([value, label, mark]) => `<div>${dashboardIcon(mark)}<strong>${value}</strong><span>${label}</span></div>`).join("")}</div></section>
    <section class="section public-benefits"><div class="container"><div class="section-head centered"><div><h2>كل ما تحتاجه لإدارة احترافية لنمو مستمر</h2><p class="muted">أدوات مترابطة تعمل معًا من أول تنبيه حتى اكتمال التجديد.</p></div></div><div class="grid grid-5">${features.slice(0, 5).map(([title, body], index) => `<article>${dashboardIcon(["subscriptions", "devices", "security", "reports", "customers"][index])}<h3>${title}</h3><p>${body}</p></article>`).join("")}</div></div></section>
  </main>`);
}

function marketingFeaturesPage() {
  return publicShell(`<main><section class="public-heading"><div class="container"><h1>المميزات</h1><p>كل ما تحتاجه لإدارة التجديدات والاشتراكات والعملاء بكفاءة واحترافية في منصة واحدة ذكية.</p></div></section>
    <section class="section features-section"><div class="container feature-showcase-grid"><div class="feature-visual-column"><div class="feature-preview-card">${dashboardPreview()}</div><div class="feature-lower-grid">${features.slice(6).map(([title, body], index) => `<article class="card feature-wide">${dashboardIcon(index ? "customers" : "security")}<div><h2>${title}</h2><p>${body}</p></div></article>`).join("")}</div></div><div class="public-feature-grid">${features.slice(0, 6).map(([title, body], index) => `<article class="card public-feature-card">${dashboardIcon(["subscriptions", "customers", "devices", "template", "reports", "template"][index])}<h2>${title}</h2><p>${body}</p></article>`).join("")}</div></div></section>
    <section class="section section-tight"><div class="container"><div class="card public-cta"><div class="cta-logo">${logo()}</div><div><h2>ابدأ إدارة اشتراكاتك بطريقة ذكية اليوم</h2><p>جرّب Renvix مجانًا واستمتع بإدارة سلسة وفعالة دون تعقيد.</p></div><div class="hero-actions"><button class="btn btn-primary" data-link="/register">إنشاء حساب مجاني</button><button class="btn btn-secondary" data-action="open-demo">احجز عرضًا تجريبيًا</button></div></div></div></section></main>`);
}

function marketingPricingPage() {
  const topups = [["10,000", "39"], ["25,000", "89"], ["50,000", "169"], ["100,000", "299"]];
  return publicShell(`<main><section class="public-heading pricing-heading"><div class="container"><h1>الباقات</h1><p>اختر الباقة المناسبة لنمو أعمالك وتواصل بذكاء واحترافية.</p><div class="pricing-toggle"><button class="toggle-pill ${state.billing === "monthly" ? "active" : ""}" data-action="billing" data-billing="monthly">شهري</button><button class="toggle-pill ${state.billing === "yearly" ? "active" : ""}" data-action="billing" data-billing="yearly">سنوي</button><span>وفر حتى 20%</span></div></div></section>
    <section class="section pricing-section"><div class="container pricing-public-grid">${pricingCards()}</div></section>
    <section class="section section-tight"><div class="container pricing-assurance"><span>◉ إلغاء في أي وقت</span><span>◇ أمان وخصوصية</span><span>✦ تحديثات مستمرة</span><span>♬ دعم موثوق</span></div></section>
    <section class="section section-tight"><div class="container pricing-extras"><article class="card faq-card faq-compact"><h2>أسئلة شائعة</h2>${["هل يمكنني الترقية أو التبديل بين الباقات؟", "هل الرسائل تشمل جميع القنوات؟", "ما سياسة إلغاء الاشتراك؟", "كيف يتم احتساب الرسائل؟"].map((q) => `<details><summary>${q}</summary><p>نعم، يمكنك إدارة خطتك بمرونة من صفحة الفوترة، ويُحتسب الاستخدام وفق الرسائل المعالجة فعليًا.</p></details>`).join("")}</article><article class="card topup-card pricing-extra-card"><div><h2>شحن إضافي</h2><p>هل تحتاج إلى المزيد من الرسائل؟ اشحن رصيدك الإضافي حسب احتياجك.</p></div><div class="credit-grid">${topups.map(([messages, price]) => `<div class="credit-option"><span>${messages} رسالة</span><strong>${price} ر.س</strong><button class="btn btn-secondary" data-link="/register?topup=${messages.replace(",", "")}">شحن الآن</button></div>`).join("")}</div></article></div></section>
    <section class="section section-tight"><div class="container trust-band"><span>◎ الامتثال للمعايير العالمية</span><span>◇ أمان على مستوى المؤسسات</span><span>♙ دعم موثوق</span><span>+10,000 عميل نشط</span></div></section></main>`);
}

function blogPage() {
  const query = state.search.trim().toLowerCase();
  const posts = publicBlogPosts.filter((post) => (state.blogCategory === "الكل" || post.category === state.blogCategory) && (!query || `${localizedField(post.title)} ${localizedField(post.excerpt)}`.toLowerCase().includes(query)));
  const featured = posts[0];
  return publicShell(`<main><section class="public-heading"><div class="container"><h1>المدونة</h1><p>أحدث المقالات والنصائح حول تجديد الاشتراكات، الاحتفاظ بالعملاء، والأتمتة الذكية.</p></div></section><section class="section section-tight"><div class="container blog-toolbar"><div class="search-wrap"><span class="search-icon">⌕</span><input class="input" data-action="support-search" value="${escapeHtml(state.search)}" placeholder="ابحث في المقالات..."></div><div class="chips">${["الكل", "النصائح", "التجديدات", "التقارير", "الحماية"].map((item) => `<button class="chip ${state.blogCategory === item ? "active" : ""}" data-action="blog-category" data-category="${item}">${item}</button>`).join("")}</div></div></section>
    <section class="section blog-section"><div class="container blog-layout"><div>${featured ? `<article class="card featured-post"><div class="blog-art"><img src="${featured.image}" alt="${escapeHtml(localizedField(featured.title))}"></div><div><span class="badge">مقال مميز</span><h2>${localizedField(featured.title)}</h2><p>${localizedField(featured.excerpt)}</p><small>${localizedField(featured.date)} · ${localizedField(featured.minutes)}</small><button class="link-button" data-link="/blog/${featured.slug}">اقرأ المقال ←</button></div></article><div class="blog-grid">${posts.slice(1).map((post) => blogCard(post)).join("")}</div>` : emptyState("لا توجد مقالات مطابقة", "جرّب البحث بكلمات أخرى أو اختر قسمًا مختلفًا.")}</div><aside class="blog-aside"><article class="card"><h3>أحدث المقالات</h3>${publicBlogPosts.slice(0, 4).map((post) => `<button data-link="/blog/${post.slug}"><img src="${post.image}" alt=""><strong>${localizedField(post.title)}</strong><small>${localizedField(post.date)}</small></button>`).join("")}</article><article class="card newsletter"><h3>اشترك في نشرتنا</h3><p>احصل على أحدث المقالات والنصائح مباشرة في بريدك.</p><form data-submit="newsletter"><input class="input" type="email" name="email" placeholder="بريدك الإلكتروني" required><button class="btn btn-primary">اشترك الآن</button></form></article></aside></div></section></main>`);
}

function blogCard(post) {
  return `<article class="card blog-card"><div class="blog-art"><img src="${post.image}" alt="${escapeHtml(localizedField(post.title))}"></div><span class="badge">${post.category}</span><h3>${localizedField(post.title)}</h3><p>${localizedField(post.excerpt)}</p><small>${localizedField(post.date)} · ${localizedField(post.minutes)}</small><button class="link-button" data-link="/blog/${post.slug}">اقرأ المقال ←</button></article>`;
}

function articlePage() {
  const post = publicBlogPosts.find((item) => `/blog/${item.slug}` === state.route);
  if (!post) return blogPage();
  const takeaways = localizedField(post.takeaways);
  return publicShell(`<main class="article-page"><section class="article-hero"><div class="container"><span class="badge">${post.category}</span><h1>${localizedField(post.title)}</h1><p>${localizedField(post.excerpt)}</p><small>${localizedField(post.date)} · ${localizedField(post.minutes)}</small></div></section><article class="container article-body"><img class="article-cover" src="${post.image}" alt="${escapeHtml(localizedField(post.title))}"><div class="article-content"><p class="article-lead">${localizedCopy("في هذا الدليل ستجد خطوات عملية يمكنك تطبيقها مباشرة لبناء تجربة تجديد أوضح وأكثر أمانًا وقابلية للقياس.", "This guide gives you practical steps you can apply immediately to build a clearer, safer, and more measurable renewal experience.")}</p>${post.sections.map((section, index) => `<section><span>${String(index + 1).padStart(2, "0")}</span><div><h2>${localizedField(section.heading)}</h2><p>${localizedField(section.body)}</p></div></section>`).join("")}<aside class="article-takeaways"><h2>${localizedCopy("خلاصة عملية", "Practical takeaways")}</h2><ul>${takeaways.map((item) => `<li>${item}</li>`).join("")}</ul></aside></div><div class="public-cta"><div><h2>${localizedCopy("طبّق هذه الخطوات في Renvix", "Put these steps into practice with Renvix")}</h2><p>${localizedCopy("ابدأ بإدارة تجديداتك من لوحة موحدة وآمنة.", "Manage renewals from one clear and secure workspace.")}</p></div><button class="btn btn-primary" data-link="/register">${localizedCopy("ابدأ الآن", "Get started")}</button></div></article></main>`);
}

function marketingSupportPage() {
  const cards = [["مركز المساعدة", "أدلة شاملة ومقالات لمساعدتك خطوة بخطوة.", "تصفح المقالات", "#help-center", "template"], ["الأسئلة الشائعة", "إجابات سريعة لأكثر الأسئلة شيوعًا.", "عرض الأسئلة", "#faq", "security"], ["الدردشة", "تحدث مباشرة مع فريق الدعم.", "ابدأ المحادثة", "open-chat", "customers"], ["تواصل عبر البريد", "راسلنا وسنرد عليك خلال 24 ساعة عمل.", "راسلنا الآن", "open-email", "template"]];
  return publicShell(`<main class="support-page"><section class="section support-hero"><div class="container support-intro-row"><div class="support-intro-copy"><span class="eyebrow">نحن هنا لمساعدتك</span><h1>مركز الدعم</h1><p>ابحث في مقالات المساعدة، تواصل مع فريق الدعم، أو أرسل طلبك وسنعود إليك بأقرب وقت.</p></div><div class="support-cards">${cards.map(([title, body, label, action, mark]) => `<article class="card">${dashboardIcon(mark)}<h2>${title}</h2><p>${body}</p>${action.startsWith("#") ? `<a class="btn btn-secondary" href="/support${action}">${label}</a>` : `<button class="btn btn-secondary" data-action="${action}">${label}</button>`}</article>`).join("")}</div></div></section>
    <section class="section support-body"><div class="container support-layout"><article class="card help-center" id="help-center"><h2>مركز المساعدة</h2>${knowledgeBase.slice(0, 5).map((item) => `<button data-action="knowledge" data-term="${item}">${dashboardIcon("template")}<span><strong>${item}</strong><small>تعرف على التفاصيل والخطوات الأساسية.</small></span><b>‹</b></button>`).join("")}</article><article class="card faq-panel" id="faq"><h2>ابحث في مقالات المساعدة</h2><input class="input" data-action="support-search" placeholder="ابحث عن حلول ومقالات..."><h2>الأسئلة الشائعة</h2>${["ما هو Renvix وكيف يعمل؟", "كيف يمكنني ربط حسابي في واتساب؟", "هل يمكنني إلغاء اشتراكي في أي وقت؟", "ما هي طرق الدفع المتاحة؟", "كيف أتابع أداء حملاتي وتقاريري؟"].map((q) => `<details><summary>${q}</summary><p>ستجد الخطوات داخل مركز المساعدة، ويمكن لفريق الدعم مساعدتك إذا احتجت إلى توجيه إضافي.</p></details>`).join("")}</article><article class="card support-form-card"><h2>أرسل لنا طلب دعم</h2><p>صف مشكلتك أو استفسارك وسنقوم بالرد عليك.</p><form data-submit="support-request" class="grid"><label class="field"><span>الاسم الكامل</span><input class="input" name="name" required></label><label class="field"><span>البريد الإلكتروني</span><input class="input" type="email" name="email" required></label><label class="field"><span>الموضوع</span><select class="select" name="subject" required><option value="">اختر موضوع الطلب</option><option>مشكلة تقنية</option><option>الفوترة والباقات</option><option>ربط الأجهزة</option></select></label><label class="field"><span>تفاصيل الطلب</span><textarea class="textarea" name="details" required></textarea></label><button class="btn btn-primary">إرسال الطلب</button></form></article></div></section><section class="section section-tight"><div class="container trust-band"><span>▢ آمن وموثوق</span><span>◇ خبراء المنتجات</span><span>♬ دعم على مدار الساعة</span><span>◷ متوسط الرد أقل من ساعتين</span></div></section></main>`);
}

function aboutPage() {
  const values = [
    ["وضوح كامل", "Complete clarity", "سجل موحد لكل عميل واشتراك وتنبيه، مع مؤشرات تعتمد على البيانات الفعلية.", "One record for every customer, subscription, and reminder, with metrics based on real data.", "subscriptions"],
    ["أتمتة مسؤولة", "Responsible automation", "تنبيهات في الوقت المناسب مع ضوابط إرسال آمن تمنع التكرار والإزعاج.", "Timely reminders with safe-sending controls that prevent repetition and unwanted messages.", "template"],
    ["خصوصية وأمان", "Privacy and security", "عزل بيانات المؤسسات، صلاحيات واضحة، وعدم كشف مفاتيح الخدمات للمتصفح.", "Tenant-isolated data, clear permissions, and service credentials that never reach the browser.", "security"],
    ["قرارات قابلة للقياس", "Measurable decisions", "تقارير تساعدك على فهم التسليم والتجديد والإيرادات وتحسين الأداء باستمرار.", "Reports that explain delivery, renewals, and revenue so performance can improve continuously.", "reports"]
  ];
  const principles = [
    ["بياناتك أولًا", "Your data comes first", "لا نستخدم بيانات تجريبية داخل حسابات الإنتاج.", "We never create demo records inside production accounts."],
    ["التشغيل الآمن", "Safe operation", "لا يبدأ الإرسال قبل اكتمال المتطلبات واتصال القناة.", "Sending cannot begin until requirements are complete and the channel is connected."],
    ["دعم مستمر", "Ongoing support", "مركز مساعدة وقنوات تواصل واضحة عند الحاجة.", "A clear help center and support channels are available whenever needed."]
  ];
  return publicShell(`<main class="about-page"><section class="about-hero"><div class="container about-hero-grid"><div><span class="eyebrow">${localizedCopy("عن Renvix", "About Renvix")}</span><h1>${localizedCopy("منصة سعودية لإدارة الاشتراكات والتجديدات باحترافية", "A Saudi platform for professional subscription and renewal management")}</h1><p>${localizedCopy("نجمع بيانات العملاء والاشتراكات والتنبيهات والأجهزة والتقارير في مساحة عمل واحدة، حتى تتمكن فرق الأعمال من متابعة التجديدات واتخاذ قرارات أوضح دون عمليات يدوية مشتتة.", "We bring customers, subscriptions, reminders, devices, and reports into one workspace so teams can manage renewals and make clearer decisions without fragmented manual work.")}</p><div class="hero-actions"><button class="btn btn-primary" data-link="/register">${localizedCopy("إنشاء حساب", "Create account")}</button><button class="btn btn-secondary" data-link="/features">${localizedCopy("استكشف المميزات", "Explore features")}</button></div></div><div class="about-brand-visual">${stackedLogo()}<strong>${localizedCopy("إدارة أوضح. تواصل أذكى. نمو مستمر.", "Clearer management. Smarter communication. Sustainable growth.")}</strong></div></div></section>
    <section class="section about-story"><div class="container"><div class="section-head"><div><span class="eyebrow">${localizedCopy("رؤيتنا", "Our vision")}</span><h2>${localizedCopy("نبني تجربة تجعل التجديد جزءًا من رحلة العميل", "We make renewal a natural part of the customer journey")}</h2><p>${localizedCopy("صُممت Renvix للشركات التي تريد تقليل الاشتراكات المنتهية، تنظيم التواصل، وحماية سمعة قنواتها أثناء النمو.", "Renvix is built for companies that want fewer expired subscriptions, organized communication, and healthier channels as they grow.")}</p></div></div><div class="about-value-grid">${values.map(([arTitle, enTitle, arBody, enBody, mark]) => `<article><span>${dashboardIcon(mark)}</span><h3>${localizedCopy(arTitle, enTitle)}</h3><p>${localizedCopy(arBody, enBody)}</p></article>`).join("")}</div></div></section>
    <section class="section about-principles"><div class="container about-principles-grid"><div><span class="eyebrow">${localizedCopy("كيف نعمل", "How we work")}</span><h2>${localizedCopy("منتج عملي يركز على النتائج", "A practical product focused on outcomes")}</h2><p>${localizedCopy("نطوّر المنصة حول احتياجات فرق الاشتراكات وخدمة العملاء: إعداد بسيط، واجهة عربية واضحة، تكاملات قابلة للمراقبة، وسجل نشاط يحفظ سياق كل عملية.", "We build around the needs of subscription and customer teams: simple setup, a clear bilingual interface, observable integrations, and an activity trail for every action.")}</p></div><div class="about-points">${principles.map(([arTitle, enTitle, arBody, enBody], index) => `<div><b>${String(index + 1).padStart(2, "0")}</b><span><strong>${localizedCopy(arTitle, enTitle)}</strong><small>${localizedCopy(arBody, enBody)}</small></span></div>`).join("")}</div></div></section><section class="section"><div class="container"><div class="public-cta"><div><h2>${localizedCopy("ابدأ إدارة تجديداتك من مكان واحد", "Manage renewals from one workspace")}</h2><p>${localizedCopy("أنشئ مساحة عملك وابدأ بإضافة عملائك واشتراكاتك دون بيانات افتراضية.", "Create your workspace and add customers and subscriptions without demo data.")}</p></div><button class="btn btn-primary" data-link="/register">${localizedCopy("ابدأ الآن", "Get started")}</button></div></div></section></main>`);
}

function policyPage() {
  const policies = {
    "/privacy": { title: "سياسة الخصوصية", intro: "توضح هذه السياسة كيف تجمع Renvix البيانات اللازمة لتقديم الخدمة، وكيف نحميها ونمنحك التحكم فيها.", sections: [["البيانات التي نجمعها", "نجمع بيانات الحساب ومساحة العمل والعملاء والاشتراكات وسجلات التشغيل التي تدخلها أو تنشئها أثناء استخدام المنصة. كما نسجل معلومات تقنية محدودة لازمة للأمان وتشخيص الأعطال."], ["كيف نستخدم البيانات", "نستخدم البيانات لتشغيل خصائص المنصة، إرسال التنبيهات التي يطلبها المستخدم، تحسين الاعتمادية، منع إساءة الاستخدام، وتقديم الدعم. لا نبيع بيانات العملاء ولا نستخدمها لإعلانات خارجية."], ["الحماية والعزل", "تُعزل بيانات كل مؤسسة بواسطة معرّف مساحة العمل، وتُطبق ضوابط وصول على الواجهات البرمجية وقاعدة البيانات. تُحفظ الأسرار في بيئة الخادم ولا تُرسل إلى المتصفح."], ["مقدمو الخدمات", "قد نعتمد على مزودين موثوقين للبنية التحتية والبريد والرسائل وقواعد البيانات. يقتصر وصولهم على ما يلزم لتقديم الخدمة وفق شروطهم واتفاقياتهم الأمنية."], ["الاحتفاظ والحذف", "نحتفظ بالبيانات طوال مدة الحساب أو حسب الحاجة النظامية والتشغيلية. يمكنك طلب تصحيح بياناتك أو تصديرها أو حذفها عبر مركز الدعم، مع مراعاة السجلات التي يجب الاحتفاظ بها نظاميًا."], ["حقوقك وخياراتك", "يمكنك إدارة إعدادات الإشعارات، تحديث الملف الشخصي، مراجعة الجلسات، وإيقاف الرسائل لعملاء محددين. للاستفسارات المتعلقة بالخصوصية تواصل معنا عبر قناة الدعم الرسمية."]] },
    "/terms": { title: "سياسة الاستخدام والشروط", intro: "تنظم هذه الشروط استخدام Renvix وتحدد مسؤوليات صاحب الحساب والمستخدمين المخولين.", sections: [["قبول الشروط", "بإنشاء حساب أو استخدام المنصة فإنك توافق على هذه الشروط والسياسات المرتبطة بها، وتؤكد أن لديك الصلاحية لإدارة مساحة العمل والبيانات المضافة إليها."], ["الحساب والصلاحيات", "أنت مسؤول عن دقة بيانات الحساب، حماية كلمة المرور، ومراجعة المستخدمين المخولين. يجب إبلاغنا فورًا عن أي استخدام غير مصرح به أو نشاط مشبوه."], ["الاستخدام المقبول", "يُمنع استخدام المنصة لإرسال رسائل غير مرغوبة، انتحال الهوية، انتهاك الخصوصية، أو مخالفة أنظمة الاتصالات والتجارة الإلكترونية. يجب الحصول على الموافقات اللازمة من المستلمين."], ["القنوات والتكاملات", "تخضع خدمات واتساب والبريد والتكاملات الخارجية لتوفر مزوديها وشروطهم. يتحمل صاحب الحساب مسؤولية صحة الإعدادات والأرقام والقوالب المستخدمة."], ["الاشتراكات والفوترة", "تُعرض الأسعار والحدود قبل اختيار الخطة. قد تتغير المزايا والأسعار مستقبلًا بعد إشعار مناسب، وتستمر الفواتير المستحقة عن الفترات التي تم فيها استخدام الخدمة."], ["التعليق والإنهاء", "يجوز تعليق الحساب لحماية المنصة أو المستلمين عند وجود إساءة استخدام أو خطر أمني. يمكن لصاحب الحساب إلغاء الخدمة وفق إعدادات الخطة وسياسة الاسترجاع المعتمدة."]] },
    "/refund-policy": { title: "سياسة الاستبدال والاسترجاع", intro: "نهدف إلى معالجة طلبات الفوترة بعدالة ووضوح وفق نوع الخطة، تاريخ العملية، والاستخدام الفعلي للخدمة.", sections: [["أهلية طلب الاسترجاع", "يمكن تقديم طلب مراجعة خلال المدة الموضحة عند الشراء إذا حدث خصم مكرر، خطأ تقني موثق، أو تعذر جوهري في تقديم الخدمة المدفوعة."], ["الحالات غير المؤهلة", "لا يشمل الاسترجاع عادةً الأرصدة أو الرسائل المستخدمة، الفترات المستهلكة، مخالفة سياسة الاستخدام، أو توقف خدمة خارجية لا تتحكم بها Renvix."], ["طريقة تقديم الطلب", "أرسل طلبًا من مركز الدعم يتضمن بريد الحساب ورقم الفاتورة ووصف المشكلة. لا ترسل بيانات بطاقتك أو كلمات المرور داخل الطلب."], ["المراجعة والمعالجة", "يراجع الفريق السجلات والفاتورة والاستخدام، ثم يرسل القرار عبر البريد المسجل. تعتمد مدة ظهور المبلغ على بوابة الدفع والبنك المصدر."], ["تغيير الخطة", "يمكن ترقية الخطة في أي وقت. أما التخفيض فيُطبق عادةً من دورة الفوترة التالية حتى لا تتأثر المزايا المدفوعة خلال الدورة الحالية."], ["الأسئلة المتعلقة بالفوترة", "لأي استفسار أو اعتراض استخدم نموذج الدعم واختر قسم الفوترة والباقات، وسيتواصل الفريق معك بالمعلومات المطلوبة دون طلب بيانات حساسة."]] },
    "/contact": { title: "تواصل معنا", intro: "اختر القناة المناسبة وسنوجه طلبك إلى الفريق المختص بأسرع وقت ممكن.", sections: [["الدعم الفني", "لأخطاء الحساب، ربط الأجهزة، الجلسات، أو التكاملات استخدم نموذج مركز الدعم وأرفق وصفًا واضحًا ووقت حدوث المشكلة دون مشاركة أي مفتاح سري."], ["المبيعات والباقات", "للاستفسار عن الخطط وحدود الاستخدام واحتياجات المؤسسات، أرسل طلبًا بعنوان المبيعات والباقات مع حجم الفريق وعدد العملاء المتوقع."], ["الفوترة", "للفواتير أو المدفوعات اذكر رقم الفاتورة والبريد المسجل فقط. لن يطلب فريقنا كلمة المرور أو رمز التحقق أو بيانات البطاقة الكاملة."], ["الأمان والخصوصية", "للإبلاغ عن مشكلة أمنية أو طلب متعلق ببياناتك، استخدم قناة الدعم واكتب بوضوح أن الطلب متعلق بالأمان أو الخصوصية ليتم تصعيده للفريق المختص."], ["أوقات الاستجابة", "نراجع الطلبات حسب الأولوية والتأثير. تظهر الحالات الحرجة المتعلقة بتعطل الخدمة أو الأمان في مقدمة قائمة المعالجة."], ["البريد الرسمي", "يمكن مراسلتنا عبر support@renewpilot.ai، أو استخدام مركز الدعم للحصول على رقم مرجعي ومتابعة حالة الطلب."]] }
  };
  const englishPolicies = {
    "/privacy": { title: "Privacy Policy", intro: "This policy explains which data Renvix needs to provide the service, how it is protected, and the controls available to you.", sections: [["Data we collect", "We collect account, workspace, customer, subscription, and operational data that you enter or create while using the platform. Limited technical information is recorded for security and troubleshooting."], ["How we use data", "We use data to operate platform features, send reminders requested by users, improve reliability, prevent abuse, and provide support. We do not sell customer data or use it for external advertising."], ["Protection and isolation", "Each organization is isolated by its tenant identifier, with access controls enforced across APIs and the database. Service credentials remain on the server and are never sent to the browser."], ["Service providers", "Trusted infrastructure, email, messaging, and database providers may process only the information necessary to deliver their services under their own security terms."], ["Retention and deletion", "Data is retained while the account is active or where operational and legal requirements apply. You can request correction, export, or deletion through the support center."], ["Your rights and choices", "You can manage notifications, update your profile, review sessions, and stop messages for selected customers. Privacy questions can be submitted through the official support channel."]] },
    "/terms": { title: "Terms of Use", intro: "These terms govern the use of Renvix and explain the responsibilities of account owners and authorized users.", sections: [["Accepting the terms", "By creating an account or using the platform, you agree to these terms and related policies and confirm that you are authorized to manage the workspace and its data."], ["Accounts and permissions", "You are responsible for accurate account information, password protection, and reviewing authorized users. Report unauthorized access or suspicious activity immediately."], ["Acceptable use", "The platform must not be used for unsolicited messaging, impersonation, privacy violations, or conduct that breaches communications and commerce regulations. Required recipient consent must be obtained."], ["Channels and integrations", "WhatsApp, email, and third-party integrations are subject to provider availability and terms. The account owner is responsible for the numbers, templates, and settings used."], ["Subscriptions and billing", "Prices and limits are shown before a plan is selected. Features and prices may change with appropriate notice, while charges remain due for periods in which the service was used."], ["Suspension and termination", "Accounts may be suspended to protect the platform or recipients when abuse or security risk is detected. Owners may cancel according to plan settings and the applicable refund policy."]] },
    "/refund-policy": { title: "Refund Policy", intro: "We review billing requests fairly and transparently according to the plan, transaction date, and actual service usage.", sections: [["Refund eligibility", "A review may be requested within the period shown at purchase when there is a duplicate charge, a documented technical error, or a material failure to deliver the paid service."], ["Non-eligible cases", "Refunds generally exclude used credits or messages, consumed billing periods, policy violations, and third-party outages outside Renvix's control."], ["Submitting a request", "Send a support request with the account email, invoice number, and a description of the issue. Never include card details or passwords."], ["Review and processing", "The team reviews logs, the invoice, and usage before sending a decision to the registered email. Bank and payment gateway processing times may vary."], ["Changing plans", "Plans can be upgraded at any time. Downgrades usually apply from the next billing cycle so current paid features remain available until the cycle ends."], ["Billing questions", "Select Billing and Plans in the support form for any question or dispute. The team will request only the information needed and never sensitive credentials."]] },
    "/contact": { title: "Contact Us", intro: "Choose the right channel and we will route your request to the appropriate team as quickly as possible.", sections: [["Technical support", "For account errors, device linking, sessions, or integrations, use the support form and include a clear description and time of occurrence without sharing secrets."], ["Sales and plans", "For plans, limits, and enterprise requirements, submit a Sales and Plans request with the expected team size and customer volume."], ["Billing", "For invoices or payments, provide only the invoice number and registered email. Our team will never ask for your password, verification code, or full card details."], ["Security and privacy", "Clearly mark security or privacy requests in the support channel so they can be escalated to the appropriate specialist."], ["Response times", "Requests are reviewed by priority and impact. Critical service availability and security issues are moved to the front of the queue."], ["Official email", "You can email support@renewpilot.ai or use the support center to receive a reference number and track your request."]] }
  };
  const selectedPolicies = state.language === "en" ? englishPolicies : policies;
  const content = selectedPolicies[state.route] || selectedPolicies["/privacy"];
  return publicShell(`<main class="policy-page"><section class="policy-hero"><div class="container"><span class="eyebrow">${localizedCopy("معلومات قانونية وتشغيلية", "Legal and operational information")}</span><h1>${content.title}</h1><p>${content.intro}</p><small>${localizedCopy("آخر تحديث: يوليو 2026", "Last updated: July 2026")}</small></div></section><section class="section policy-section"><div class="container policy-layout"><aside class="policy-summary"><h2>${localizedCopy("في هذه الصفحة", "On this page")}</h2>${content.sections.map(([title], index) => `<a href="#policy-${index + 1}"><span>${String(index + 1).padStart(2, "0")}</span>${title}</a>`).join("")}<button class="btn btn-primary" data-link="/support">${localizedCopy("تواصل مع الدعم", "Contact support")}</button></aside><article class="policy-content">${content.sections.map(([title, body], index) => `<section id="policy-${index + 1}"><span>${String(index + 1).padStart(2, "0")}</span><div><h2>${title}</h2><p>${body}</p></div></section>`).join("")}<div class="policy-contact"><strong>${localizedCopy("هل تحتاج إلى توضيح إضافي؟", "Need more information?")}</strong><p>${localizedCopy("راسلنا عبر support@renewpilot.ai أو افتح طلبًا من مركز الدعم.", "Email support@renewpilot.ai or open a request in the Support Center.")}</p><button class="btn btn-secondary" data-link="/support">${localizedCopy("الانتقال إلى مركز الدعم", "Go to Support Center")}</button></div></article></div></section></main>`);
}

function authPublicPage() {
  const isRegister = state.route === "/register";
  return `<main class="auth-light-page"><header class="auth-light-header">${logo()}<button class="link-button" data-link="/">العودة إلى الصفحة الرئيسية ←</button></header><section class="auth-light-shell ${isRegister ? "register" : "login"}">
    <article class="card auth-light-panel"><h1>${isRegister ? "إنشاء حساب" : "تسجيل الدخول"}</h1><p>${isRegister ? "أنشئ حسابك لبدء إدارة اشتراكاتك بذكاء واحترافية." : "مرحبًا بعودتك، يرجى إدخال بياناتك للوصول إلى حسابك."}</p>${state.query.get("plan") ? `<span class="badge">الخطة المختارة: ${escapeHtml(state.query.get("plan"))}</span>` : ""}<form data-submit="${isRegister ? "register" : "login"}" class="grid auth-form" novalidate>
      ${isRegister ? `<label class="field"><span>الاسم الكامل</span><input class="input" name="name" autocomplete="name" required></label><label class="field"><span>اسم الشركة (اختياري)</span><input class="input" name="companyName" autocomplete="organization"></label>` : ""}
      <label class="field"><span>البريد الإلكتروني</span><input class="input" type="email" name="email" autocomplete="email" placeholder="أدخل بريدك الإلكتروني" required></label><label class="field"><span>كلمة المرور</span><input class="input" type="password" name="password" autocomplete="${isRegister ? "new-password" : "current-password"}" placeholder="${isRegister ? "اختر كلمة مرور قوية" : "أدخل كلمة المرور"}" required></label>
      ${isRegister ? `<label class="field"><span>تأكيد كلمة المرور</span><input class="input" type="password" name="confirmPassword" autocomplete="new-password" required></label><label class="policy-check"><input type="checkbox" name="acceptPolicies"> أوافق على <button type="button" data-link="/terms">سياسة الاستخدام</button> و<button type="button" data-link="/privacy">سياسة الخصوصية</button></label>` : `<div class="inline-actions split-between"><label class="remember"><input type="checkbox" name="remember"> تذكرني</label><button type="button" class="link-button" data-link="/forgot-password">نسيت كلمة المرور؟</button></div>`}
      <button class="btn btn-primary auth-submit">${isRegister ? "إنشاء حساب" : state.language === "en" ? "Sign in →" : "تسجيل الدخول ←"}</button><p class="auth-switch">${isRegister ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"} <button type="button" class="link-button" data-link="${isRegister ? "/login" : "/register"}">${isRegister ? "تسجيل الدخول" : "إنشاء حساب"}</button></p></form></article>
    <aside class="card auth-light-visual"><div class="auth-logo-large">${stackedLogo()}</div><h2>${isRegister ? "ابدأ رحلتك نحو إدارة اشتراكات أكثر ذكاءً" : "منصة متكاملة لإدارة الاشتراكات والتجديدات"}</h2><p>${isRegister ? "تتبّع اشتراكاتك، قلّل التكاليف، واتخذ قرارات أفضل لنمو عملك." : "بسّط عملياتك، تابع اشتراكاتك، واتخذ قرارات ذكية للنمو المستدام."}</p><div class="auth-benefits">${[["إدارة جميع اشتراكاتك في مكان واحد", "subscriptions"], ["تنبيهات ذكية في الوقت المناسب", "template"], ["تقارير وتحليلات متقدمة", "reports"], ["آمن وموثوق", "security"]].map(([label, mark]) => `<div>${dashboardIcon(mark)}<span>${label}</span></div>`).join("")}</div></aside>
  </section>${publicFooter()}</main>`;
}

function forgotPublicPage() {
  const step = state.resetStep;
  const content = step === 1 ? `<form data-submit="forgot" class="grid auth-form"><label class="field"><span>البريد الإلكتروني</span><input class="input" type="email" name="email" value="${escapeHtml(state.resetEmail)}" required></label><button class="btn btn-primary auth-submit">إرسال رابط الاستعادة</button></form>` : step === 2 ? `<form data-submit="reset-password" class="grid auth-form"><label class="field"><span>رمز التحقق</span><input class="input code-input" name="code" inputmode="numeric" maxlength="6" required></label><label class="field"><span>كلمة المرور الجديدة</span><input class="input" type="password" name="password" required></label><label class="field"><span>تأكيد كلمة المرور</span><input class="input" type="password" name="confirmPassword" required></label><button class="btn btn-primary auth-submit">تعيين كلمة المرور</button></form>` : `<div class="auth-success"><span class="success-mark">✓</span><p>تم تغيير كلمة المرور بنجاح.</p><button class="btn btn-primary" data-link="/login">تسجيل الدخول</button></div>`;
  return `<main class="auth-light-page"><header class="auth-light-header">${logo()}<button class="link-button" data-link="/">العودة إلى الرئيسية ←</button></header><section class="reset-light-shell"><article class="card reset-light-panel"><span class="reset-lock">▢</span><h1>نسيت كلمة المرور</h1><p>${step === 1 ? "لا مشكلة، أدخل بريدك الإلكتروني المرتبط بحسابك وسنرسل لك رابطًا آمنًا لإعادة تعيين كلمة المرور." : step === 2 ? "أدخل رمز التحقق الذي أرسلناه إلى بريدك ثم اختر كلمة مرور جديدة." : "يمكنك الآن العودة إلى حسابك."}</p>${content}<p class="muted">إذا كان البريد موجودًا فسيصلك رابط الاستعادة خلال دقائق.</p><button class="link-button" data-link="/login">تذكرت كلمة المرور؟ تسجيل الدخول</button></article><aside class="card reset-light-visual"><div class="mail-visual">${stackedLogo()}</div><h2>خطوة بسيطة لاستعادة الوصول</h2><p>سنرسل لك رابطًا آمنًا لإدارة كلمة المرور والعودة إلى اشتراكاتك بسهولة.</p></aside></section>${publicFooter()}</main>`;
}

function loginPage() {
  const isRegister = state.route === "/register";
  return `<main class="auth-page ${isRegister ? "register-mode" : "login-mode"}">
    <div class="auth-brand">${logo()}</div>
    <div class="auth-top-actions">
      <button class="btn btn-ghost icon-btn" data-action="theme" title="${t("settings.theme")}">${state.theme === "dark" ? "☾" : "☀"}</button>
      <button class="btn btn-secondary" data-action="language">${state.language === "ar" ? "EN" : "AR"}</button>
    </div>
    <section class="auth-shell">
      <article class="card auth-panel">
        <span class="eyebrow">Renvix</span>
        <h1>${t(isRegister ? "auth.registerTitle" : "auth.loginTitle")}</h1>
        <p class="lead">${t(isRegister ? "auth.registerSubtitle" : "auth.loginSubtitle")}</p>
        ${state.query.get("plan") ? `<p class="badge">الخطة المختارة: ${state.query.get("plan")}</p>` : ""}
        <form data-submit="${isRegister ? "register" : "login"}" class="grid auth-form" novalidate>
          ${isRegister ? `<label class="field"><span>${t("auth.name")}</span><input class="input" type="text" name="name" autocomplete="name" required></label>` : ""}
          <label class="field"><span>${t("auth.email")}</span><input class="input" type="email" name="email" placeholder="you@example.com" autocomplete="email" required></label>
          <label class="field"><span>${t("auth.password")}</span><input class="input" type="password" name="password" autocomplete="${isRegister ? "new-password" : "current-password"}" required></label>
          ${isRegister ? `<label class="field"><span>${t("auth.confirmPassword")}</span><input class="input" type="password" name="confirmPassword" autocomplete="new-password" required></label>` : `<div class="inline-actions split-between"><label class="remember"><input type="checkbox" name="remember" checked> ${t("auth.remember")}</label><button type="button" class="btn btn-ghost" data-link="/forgot-password">${t("auth.forgotPassword")}</button></div>`}
          <button class="btn btn-primary auth-submit">${t(isRegister ? "auth.register" : "auth.login")} <span>→</span></button>
          <p class="auth-switch">${t(isRegister ? "auth.hasAccount" : "auth.noAccount")} <button type="button" class="link-button" data-link="${isRegister ? "/login" : "/register"}">${t(isRegister ? "auth.loginLink" : "auth.createAccount")}</button></p>
        </form>
      </article>
      <aside class="auth-visual">
        <div class="auth-hero-logo">${stackedLogo()}</div>
        <p>${state.language === "ar" ? "الطريقة الذكية لإدارة التجديدات بثقة وأمان." : "The intelligent way to manage renewals. Track. Automate. Renew with confidence."}</p>
        <div class="auth-dashboard-art">
          <div class="art-top"><strong>${t("dashboard.title")}</strong><span></span></div>
          <div class="art-stats">${Array.from({ length: 4 }, () => `<span class="art-skeleton"><small></small><strong></strong></span>`).join("")}</div>
          <div class="art-table">${Array.from({ length: 4 }, () => `<div class="art-skeleton-row"><span></span><b></b></div>`).join("")}</div>
        </div>
        <div class="auth-feature-row">
          <span>🔔 ${state.language === "ar" ? "تنبيهات ذكية" : "Smart Reminders"}</span><span>↻ ${state.language === "ar" ? "تتبع التجديد" : "Renewal Tracking"}</span><span>👥 ${state.language === "ar" ? "بوابة العملاء" : "Customer Portal"}</span>
        </div>
        <div class="auth-security-note">${state.language === "ar" ? "مصمم للأمان والثقة." : "Built for security. Designed for trust."}</div>
      </aside>
    </section>
  </main>`;
}

function forgotPasswordPage() {
  const step = state.resetStep;
  const content = step === 1
    ? `<form data-submit="forgot" class="grid auth-form" novalidate><label class="field"><span>${t("auth.email")}</span><input class="input" type="email" name="email" value="${state.resetEmail}" autocomplete="email"></label><button class="btn btn-primary auth-submit">${t("auth.sendCode")}</button></form>`
    : step === 2
      ? `<form data-submit="reset-password" class="grid auth-form" novalidate><label class="field"><span>${t("auth.code")}</span><input class="input code-input" name="code" inputmode="numeric" maxlength="6"></label><label class="field"><span>${t("auth.newPassword")}</span><input class="input" type="password" name="password" autocomplete="new-password"></label><label class="field"><span>${t("auth.confirmPassword")}</span><input class="input" type="password" name="confirmPassword" autocomplete="new-password"></label><button class="btn btn-primary auth-submit">${t("auth.resetPassword")}</button></form>`
      : `<div class="auth-success"><span class="success-mark">✓</span><p>${t("auth.passwordChanged")}</p><button class="btn btn-primary" data-link="/login">${t("auth.loginTitle")}</button></div>`;
  return `<main class="auth-page reset-mode"><div class="auth-brand">${logo()}</div><div class="auth-top-actions"><button class="btn btn-ghost icon-btn" data-action="theme">${state.theme === "dark" ? "☾" : "☀"}</button><button class="btn btn-secondary" data-action="language">${state.language === "ar" ? "EN" : "AR"}</button></div><section class="auth-shell single-auth"><article class="card auth-panel"><span class="eyebrow">Renvix</span><h1>${t("auth.forgotTitle")}</h1><p class="lead">${step === 1 ? t("auth.forgotSubtitle") : step === 2 ? t("auth.codeSent") : t("auth.passwordChanged")}</p>${content}<button class="btn btn-ghost" data-link="/login">${t("auth.loginLink")}</button></article></section></main>`;
}

function notificationLabel(type) {
  const labels = {
    subscription_due: "استحقاق اشتراك",
    subscription_expired: "اشتراك منتهٍ",
    message_scheduled: "تمت جدولة رسالة",
    message_sent: "تم إرسال الرسالة",
    message_delivered: "تم تسليم الرسالة",
    message_failed: "فشل إرسال الرسالة",
    security: "تنبيه أمني"
  };
  return labels[type] || "إشعار";
}

function notificationRelativeTime(value) {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

function notificationItems() {
  return Array.isArray(state.notifications?.items) ? state.notifications.items : [];
}

function notificationDropdownMarkup() {
  const items = notificationItems().slice(0, 4);
  const unread = Number(state.notifications?.summary?.unread || 0);
  return `<div class="notification-dropdown">
    <div class="notification-dropdown-head"><strong>الإشعارات</strong><span class="badge">${unread}</span></div>
    <div class="notification-dropdown-list">${items.length ? items.map((item) => `<button class="notification-item ${item.isRead ? "" : "unread"}" data-action="notification-open" data-id="${escapeHtml(item.id)}" data-url="${escapeHtml(item.actionUrl || "")}">
      <span class="notification-item-icon">${dashboardIcon(item.type?.includes("message") ? "template" : item.type?.includes("security") ? "security" : "subscriptions")}</span>
      <span><strong>${escapeHtml(item.title || notificationLabel(item.type))}</strong><small>${escapeHtml(item.message || "")}</small><em>${notificationRelativeTime(item.createdAt)}</em></span>
    </button>`).join("") : `<div class="notification-empty"><strong>لا توجد إشعارات جديدة</strong><span>ستظهر هنا تنبيهات الاشتراكات وحالة الرسائل.</span></div>`}</div>
    <div class="notification-dropdown-actions"><button class="btn btn-ghost" data-action="notification-mark-all" ${unread ? "" : "disabled"}>تحديد الكل كمقروء</button><button class="btn btn-secondary" data-link="/dashboard/notifications">عرض كل الإشعارات</button></div>
  </div>`;
}

function notificationsPage() {
  const payload = state.notifications;
  const items = notificationItems();
  const filtered = items.filter((item) => {
    if (state.notificationFilter === "unread" && item.isRead) return false;
    if (state.notificationFilter === "subscriptions" && item.type?.includes("subscription") !== true) return false;
    if (state.notificationFilter === "messages" && item.type?.includes("message") !== true) return false;
    const query = state.search.trim().toLowerCase();
    return !query || `${item.title || ""} ${item.message || ""}`.toLowerCase().includes(query);
  });
  const body = payload?.error
    ? emptyState("تعذر تحميل الإشعارات", payload.error, "إعادة المحاولة", "reload-notifications")
    : payload === null
      ? `<div class="loading-state">جارٍ تحميل الإشعارات...</div>`
      : filtered.length
        ? `<div class="notification-list-page">${filtered.map((item) => `<article class="notification-row ${item.isRead ? "" : "unread"}">
          <span class="notification-item-icon">${dashboardIcon(item.type?.includes("message") ? "template" : item.type?.includes("security") ? "security" : "subscriptions")}</span>
          <div class="notification-row-content"><div class="notification-row-title"><strong>${escapeHtml(item.title || notificationLabel(item.type))}</strong>${status(item.isRead ? "read" : "pending")}</div><p>${escapeHtml(item.message || "")}</p><small>${notificationRelativeTime(item.createdAt)}${item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString("ar-SA")}` : ""}</small></div>
          <div class="inline-actions">${item.actionUrl ? `<button class="btn btn-secondary" data-action="notification-open" data-id="${escapeHtml(item.id)}" data-url="${escapeHtml(item.actionUrl)}">فتح</button>` : ""}<button class="btn btn-ghost icon-only danger-text" data-action="notification-delete" data-id="${escapeHtml(item.id)}" title="حذف">${dashboardIcon("close")}</button></div>
        </article>`).join("")}</div>`
        : emptyState("لا توجد إشعارات", "ستظهر هنا إشعارات الاشتراكات والرسائل عند حدوثها.");
  return dashboardShell(`${pageTitle("الإشعارات", `<button class="btn btn-secondary" data-action="notification-mark-all" ${Number(payload?.summary?.unread || 0) ? "" : "disabled"}>تحديد الكل كمقروء</button>`)}
    <section class="notification-summary-grid">${statGrid([
      { title: "غير مقروءة", value: Number(payload?.summary?.unread || 0), caption: "تحتاج مراجعة", tone: "warning", icon: "notifications" },
      { title: "اليوم", value: Number(payload?.summary?.today || 0), caption: "إشعار اليوم", tone: "info", icon: "reports" },
      { title: "هذا الأسبوع", value: Number(payload?.summary?.week || 0), caption: "آخر 7 أيام", tone: "success", icon: "subscriptions" },
      { title: "الإجمالي", value: Number(payload?.summary?.total || 0), caption: "كل الإشعارات", tone: "purple", icon: "template" }
    ])}</section>
    <section class="card notification-page-card">
      <div class="toolbar notification-toolbar"><div class="search-wrap"><span class="search-icon">⌕</span><input class="input" data-action="notification-search" placeholder="ابحث في الإشعارات..." value="${escapeHtml(state.search)}"></div>
      <select class="select" data-action="notification-filter"><option value="all" ${state.notificationFilter === "all" ? "selected" : ""}>الكل</option><option value="unread" ${state.notificationFilter === "unread" ? "selected" : ""}>غير مقروءة</option><option value="subscriptions" ${state.notificationFilter === "subscriptions" ? "selected" : ""}>الاشتراكات</option><option value="messages" ${state.notificationFilter === "messages" ? "selected" : ""}>الرسائل</option></select></div>
      ${body}
    </section>`);
}

function dashboardShell(content) {
  const englishLabels = { "الرئيسية": "Dashboard", "الاشتراكات": "Subscriptions", "العملاء": "Customers", "قالب رسالة التجديد": "Renewal Template", "الأجهزة": "Devices", "إرسال معلومات الطلب": "Order Information", "تطبيقاتنا": "Our Apps", "الحماية والأمان": "Security & Safety", "التقارير": "Reports", "الفوترة والباقات": "Billing & Plans", "الإعدادات": "Settings" };
  const links = dashboardRoutes.map(([path, label, mark]) => `<button class="side-link ${state.route === path ? "active" : ""}" data-link="${path}">${dashboardIcon(mark)}<span>${state.language === "ar" ? label : englishLabels[label]}</span></button>`).join("");
  const themeIcon = state.theme === "dark" ? "☾" : "☀";
  const profile = state.dashboardOverview?.profile || {};
  const profileName = profile.name || (state.language === "ar" ? "المستخدم" : "User");
  const profileInitial = profileName.trim().slice(0, 1) || "R";
  const profileAvatar = profile.image
    ? `<img class="avatar avatar-image" src="${escapeHtml(profile.image)}" alt="${escapeHtml(profileName)}">`
    : `<span class="avatar">${escapeHtml(profileInitial)}</span>`;
  const unreadNotifications = Number(state.notifications?.summary?.unread || 0);
  return `<div class="dashboard-shell">
    <aside class="sidebar ${state.sidebarOpen ? "open" : ""}">
      <div class="sidebar-brand">${logo()}</div>
      <nav class="side-links">${links}</nav>
    </aside>
    <main class="dashboard-main">
      <header class="topbar">
        <div class="topbar-tools">
          <button class="btn btn-secondary icon-btn mobile-side-toggle" data-action="toggle-sidebar">☰</button>
          <div class="search-wrap dashboard-search"><span class="search-icon">⌕</span><input class="input" data-action="global-search" placeholder="${state.language === "ar" ? "بحث سريع..." : "Quick search..."}" value="${state.search}"></div>
        </div>
        <div class="topbar-tools topbar-account-tools">
          <button class="profile-trigger compact-profile-trigger" data-action="profile-menu">${profileAvatar}<span><strong>${escapeHtml(profileName)}</strong></span><span class="profile-caret">⌄</span></button>
          ${state.profileOpen ? `<div class="profile-menu"><button data-link="/dashboard/settings">${t("dashboard.profile")}</button><button data-link="/dashboard/settings">${t("dashboard.settings")}</button><button class="danger-text" data-action="logout-confirm">${t("auth.logout")}</button></div>` : ""}
          <button class="btn btn-secondary language-topbar-button" data-action="language" title="${state.language === "ar" ? "اللغة" : "Language"}">${dashboardIcon("language")}<span>${state.language === "ar" ? "AR" : "EN"}</span></button>
          <button class="btn btn-ghost icon-btn theme-topbar-button" data-action="theme" title="${state.language === "ar" ? "تغيير المظهر" : "Change theme"}">${themeIcon}</button>
          <div class="notification-trigger-wrap">
            <button class="btn btn-ghost icon-btn notification-trigger" data-action="notifications" title="${state.language === "ar" ? "الإشعارات" : "Notifications"}">${dashboardIcon("notifications")}${unreadNotifications ? `<span class="notification-badge">${unreadNotifications > 99 ? "99+" : unreadNotifications}</span>` : ""}</button>
            ${state.notificationDropdownOpen ? notificationDropdownMarkup() : ""}
          </div>
        </div>
      </header>
      <div class="content">${content}</div>
    </main>
  </div>`;
}

function messageUsageTone(usage = {}) {
  if (usage.isLimitReached || Number(usage.percentage) >= 100) return "reached";
  if (Number(usage.percentage) >= 90) return "critical";
  if (Number(usage.percentage) >= 70) return "near";
  return "normal";
}

function messageUsageCard(usage, compact = false) {
  if (usage === null) return `<article class="card message-usage-card loading"><div class="loading-state">جاري تحميل استخدام الرسائل...</div></article>`;
  if (usage?.error) return `<article class="card message-usage-card error">${emptyState("تعذر تحميل استخدام الرسائل", escapeHtml(usage.error))}</article>`;
  const unlimited = usage.unlimited === true || Number(usage.limit) === -1;
  const used = Number(usage.used || 0);
  const reserved = Number(usage.reserved || 0);
  const consumed = used + reserved;
  const limit = Number(usage.limit || 0);
  const remaining = unlimited ? -1 : Math.max(0, Number(usage.remaining || 0));
  const percentage = unlimited ? 0 : Math.min(100, Math.max(0, Number(usage.percentage || 0)));
  const tone = messageUsageTone(usage);
  const statusText = tone === "reached" ? "تم استهلاك حد الرسائل" : tone === "critical" ? "أوشكت الرسائل على النفاد" : tone === "near" ? "اقتربت من حد الرسائل" : "استخدام طبيعي";
  return `<article class="card message-usage-card ${tone} ${compact ? "compact" : ""}">
    <div class="message-usage-head"><span class="message-usage-icon">${dashboardIcon("reports")}</span><div><h2>استخدام الرسائل</h2><p>${escapeHtml(usage.planName || "الباقة الحالية")} · هذه الدورة</p></div><span class="status ${tone === "reached" ? "danger" : tone === "normal" ? "info" : "warning"}">${statusText}</span></div>
    <div class="message-usage-numbers"><strong>${consumed.toLocaleString("ar-SA")} / ${unlimited ? "غير محدود" : limit.toLocaleString("ar-SA")}</strong><span>${unlimited ? "إرسال غير محدود" : `متبقي ${remaining.toLocaleString("ar-SA")} رسالة`}</span></div>
    <div class="message-usage-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}"><i style="width:${unlimited ? 100 : percentage}%"></i></div>
    <div class="message-usage-meta"><span>مرسلة: ${used.toLocaleString("ar-SA")}</span><span>محجوزة: ${reserved.toLocaleString("ar-SA")}</span>${unlimited ? "" : `<span>${percentage.toLocaleString("ar-SA")}%</span>`}${!compact && usage.periodEnd ? `<span>إعادة التعيين: ${new Date(usage.periodEnd).toLocaleDateString("ar-SA")}</span>` : ""}</div>
    ${tone === "reached" ? `<div class="message-limit-alert"><div><strong>استهلكت جميع رسائل باقتك لهذه الدورة.</strong><p>قم بترقية الباقة للاستمرار في الإرسال.</p></div><button class="btn btn-danger" data-link="/dashboard/billing">عرض الباقات</button></div>` : ""}
  </article>`;
}

function showMessageQuotaLimit(usage = null) {
  const limit = Number(usage?.limit || state.messageUsage?.limit || 0);
  const limitText = limit === -1 ? "غير محدود" : `${limit.toLocaleString("ar-SA")} رسالة`;
  openModal("وصلت إلى حد الرسائل", `<div class="quota-limit-modal">${dashboardIcon("reports")}<p>وصلت إلى الحد الشهري لرسائل باقتك.</p><p>باقتك الحالية تسمح بـ <strong>${limitText}</strong> في كل دورة. قم بترقية الباقة أو انتظر بداية الدورة القادمة.</p><button class="btn btn-danger" data-link="/dashboard/billing">الانتقال إلى الفوترة والباقات</button></div>`);
}

function invalidateMessageUsage() {
  state.messageUsage = null;
  state.billingOverview = null;
  syncRouteData(true);
}

function dashboardHome() {
  const stats = overviewStats();
  const latest = Array.isArray(state.dbSubscriptions) ? state.dbSubscriptions.slice(0, 5) : [];
  const latestContent = state.dbSubscriptions?.error
    ? emptyState("تعذر تحميل الاشتراكات", escapeHtml(state.dbSubscriptions.error))
    : state.dbSubscriptions === null
      ? `<div class="loading-state">جاري تحميل الاشتراكات من قاعدة البيانات...</div>`
      : latest.length ? subscriptionsTable(latest, true) : emptyState("لا توجد اشتراكات بعد", "ابدأ بإضافة أول اشتراك لإدارة التجديدات والتنبيهات.", "إضافة اشتراك", "add-subscription");
  const activities = (state.dashboardOverview?.activities || []).filter((item) => !String(item.type || "").startsWith("auth."));
  const hasBusinessData = stats.totalSubscriptions > 0 || stats.totalCustomers > 0 || stats.connectedDevices > 0;
  const alertDisabled = stats.connectedDevices > 0 ? "" : "disabled";
  return dashboardShell(`${pageTitle("الرئيسية", `<button class="btn btn-primary" data-action="add-subscription">إضافة اشتراك</button>`)}
    ${!hasBusinessData ? `<section class="welcome-panel"><div><span class="welcome-kicker">Renvix</span><h2>مرحبًا بك في Renvix</h2><p>ابدأ بإضافة أول عميل أو ربط جهازك. لن تظهر هنا أي بيانات ما لم تضفها أنت.</p></div><div class="welcome-actions"><button class="btn btn-primary" data-action="add-customer">إضافة أول عميل</button><button class="btn btn-secondary" data-link="/dashboard/devices">ربط جهاز</button></div></section>` : ""}
    ${statGrid([
      { title: "إجمالي الاشتراكات", value: stats.totalSubscriptions, caption: "اشتراك", tone: "info", icon: "subscriptions" },
      { title: "التجديدات القادمة", value: stats.upcomingRenewals, caption: "خلال 7 أيام", tone: "warning", icon: "reports" },
      { title: "العملاء النشطون", value: stats.activeCustomers, caption: "عميل", tone: "success", icon: "customers" },
      { title: "حالة واتساب", value: stats.connectedDevices > 0 ? "متصل" : "غير متصل", caption: `${stats.connectedDevices} جهاز`, tone: stats.connectedDevices > 0 ? "success" : "neutral", icon: "devices" },
      { title: "معدل التسليم", value: `${stats.deliveryRate || 0}%`, caption: `${stats.totalMessages || 0} رسالة`, tone: "purple", icon: "reports" }
    ])}
    <section class="section">${messageUsageCard(state.messageUsage, true)}</section>
    <section class="quick-actions section"><div class="section-head"><div><h2>إجراءات سريعة</h2><p class="muted">ابدأ المهمة مباشرة من هنا.</p></div></div><div class="quick-action-grid">
      <button class="quick-action" data-action="add-subscription">${dashboardIcon("subscriptions")}<span>إضافة اشتراك جديد</span></button>
      <button class="quick-action" data-action="add-customer">${dashboardIcon("customers")}<span>إضافة عميل</span></button>
      <button class="quick-action" data-link="/dashboard/devices">${dashboardIcon("devices")}<span>ربط جهاز جديد</span></button>
      <button class="quick-action" data-action="send-message" ${alertDisabled} title="${alertDisabled ? "اربط جهازًا أولًا حتى تتمكن من إرسال التنبيهات." : "إرسال تنبيه"}">${dashboardIcon("reports")}<span>إرسال تنبيه</span></button>
      <button class="quick-action" data-link="/dashboard/security">${dashboardIcon("security")}<span>قائمة إيقاف الرسائل</span></button>
    </div></section>
    <div class="section dashboard-two-column">
      <article class="card table-card"><div class="section-head"><div><h2>أحدث الاشتراكات</h2><p class="muted">بيانات حقيقية تخص مساحة عملك فقط.</p></div><button class="text-button" data-link="/dashboard/subscriptions">عرض الكل</button></div>${latestContent}</article>
      <article class="card chart-card"><div class="section-head"><div><h2>أداء الإيرادات</h2><p class="muted">آخر 6 أشهر</p></div></div>${performanceChart(state.dashboardOverview?.monthlyPerformance || [])}</article>
    </div>
    <article class="card table-card section"><div class="section-head"><div><h2>أحدث النشاطات</h2><p class="muted">العمليات الفعلية داخل الحساب.</p></div><button class="text-button" data-link="/dashboard/reports">سجل النشاط</button></div>${activities.length ? activityList(activities) : emptyState("لا توجد نشاطات بعد", "ستظهر العمليات التي تنفذها داخل المنصة هنا.")}</article>`);
}

function pageTitle(title, actions = "") {
  const descriptions = {
    "الرئيسية": "ملخص أعمالك الحقيقي من قاعدة البيانات.",
    "إدارة الاشتراكات": "تابع الاشتراكات والتجديدات في مكان واحد.",
    "العملاء": "أدر عملاءك وتنبيهاتهم دون بيانات تجريبية.",
    "الأجهزة": "اربط واتساب وتحقق من حالة الاتصال الفعلية.",
    "إرسال معلومات الطلب": "صمم قالبًا واحدًا برابط ثابت وأضف إليه طلبات عملائك.",
    "تطبيقاتنا": "اربط متجرك بالتطبيقات الخارجية وشغّل المزامنة والأتمتة بأمان.",
    "الحماية": "قواعد الإرسال الآمن وقائمة إيقاف الرسائل.",
    "التقارير": "المؤشرات وسجل النشاط والفوترة.",
    "الإعدادات": "إدارة الحساب واللغة والمظهر والأمان."
  };
  return `<div class="page-title"><div><h1>${title}</h1><p class="muted">${descriptions[title] || "Renvix"}</p></div><div class="toolbar">${actions}</div></div>`;
}

function activityList(items = []) {
  return `<div class="activity-list">${items.map((item) => `<div class="activity-item"><span class="activity-dot"></span><div><strong>${escapeHtml(item.title || item.type || "نشاط")}</strong><p class="muted">${escapeHtml(item.createdAt ? new Date(item.createdAt).toLocaleString(state.language === "ar" ? "ar-SA" : "en-US") : "")}</p></div></div>`).join("")}</div>`;
}

function barsChart(values) {
  return `<div class="bars">${values.map((v, i) => `<div class="bar" style="height:${v}%"><span>${["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس"][i]}</span></div>`).join("")}</div>`;
}

function readinessPage() {
  const report = state.readiness;
  if (report === null) return dashboardShell(`${pageTitle("فحص الجاهزية", `<button class="btn btn-primary" data-action="run-readiness">تشغيل اختبار شامل</button>`)}<div class="loading-state">جاري فحص حالة المنصة...</div>`);
  if (report?.error) return dashboardShell(`${pageTitle("فحص الجاهزية", `<button class="btn btn-primary" data-action="run-readiness">إعادة الفحص</button>`)}${emptyState(escapeHtml(report.error))}`);
  const labels = { database: "قاعدة البيانات", evolution: "خدمة الربط", whatsapp: "اتصال واتساب", resend: "خدمة البريد", cron: "المهام المجدولة", https: "HTTPS", environment: "متغيرات البيئة" };
  const cards = Object.entries(report.statuses || {}).map(([key, value]) => `<article class="card readiness-card"><div class="section-head"><h3>${labels[key] || key}</h3><span class="status ${value.ok ? "success" : "danger"}">${value.ok ? "جاهز" : "غير جاهز"}</span></div><strong>${escapeHtml(value.label || "")}</strong>${value.error ? `<p class="danger-text">${escapeHtml(value.error)}</p>` : ""}${value.missing?.length ? `<p class="muted">الناقص: ${value.missing.map(escapeHtml).join("، ")}</p>` : ""}</article>`).join("");
  return dashboardShell(`${pageTitle("فحص الجاهزية", `<button class="btn btn-primary" data-action="run-readiness">تشغيل اختبار شامل</button>`)}
    <div class="readiness-result ${report.result === "ready" ? "ready" : "not-ready"}"><strong>${report.result === "ready" ? "Ready" : "Not Ready"}</strong><span>آخر فحص: ${escapeHtml(report.checkedAt || "")}</span></div>
    <div class="grid grid-3">${cards}</div>
    <div class="grid grid-2 section"><article class="card table-card"><h3>آخر Webhook</h3>${report.lastWebhook ? `<strong>${escapeHtml(report.lastWebhook.title)}</strong><p class="muted">${escapeHtml(report.lastWebhook.createdAt)}</p>` : `<p class="muted">لا يوجد Webhook مسجل</p>`}</article><article class="card table-card"><h3>آخر نسخة احتياطية</h3>${report.lastBackup ? `<strong>${escapeHtml(report.lastBackup.title)}</strong><p class="muted">${escapeHtml(report.lastBackup.createdAt)}</p>` : `<p class="muted">لا توجد نسخة احتياطية مسجلة</p>`}</article></div>`);
}

function issuesPage() {
  const issues = state.operationalIssues;
  const content = issues === null ? `<div class="loading-state">جاري تحميل سجل المشاكل...</div>` : issues?.error ? emptyState(escapeHtml(issues.error)) : !issues.length ? emptyState("لا توجد مشاكل تشغيلية مسجلة") : `<div class="issue-list">${issues.map((issue) => `<article class="card issue-row"><div class="section-head"><div><span class="status ${issue.severity === "critical" || issue.severity === "error" ? "danger" : "warning"}">${escapeHtml(issue.category)}</span><h3>${escapeHtml(issue.message)}</h3></div><span class="status ${issue.status === "resolved" ? "success" : "danger"}">${issue.status === "resolved" ? "تم الحل" : "مفتوحة"}</span></div><p><strong>المصدر:</strong> ${escapeHtml(issue.source)}</p><p class="muted"><strong>الحل المقترح:</strong> ${escapeHtml(issue.suggestedSolution)}</p><small>${escapeHtml(issue.createdAt)}</small></article>`).join("")}</div>`;
  return dashboardShell(`${pageTitle("سجل المشاكل", `<button class="btn btn-secondary" data-action="reload-issues">تحديث السجل</button>`)}${content}`);
}

function appsPage() {
  const data = state.appsOverview;
  if (data === null) return dashboardShell(`${pageTitle("تطبيقاتنا")}<div class="loading-state">جاري تحميل التطبيقات...</div>`);
  if (data?.error) return dashboardShell(`${pageTitle("تطبيقاتنا")} ${emptyState("تعذر تحميل التطبيقات", escapeHtml(data.error), "إعادة المحاولة", "reload-apps")}`);
  const connection = data?.connection || null;
  const connected = connection?.status === "connected";
  const stats = data?.stats || {};
  const templates = Array.isArray(data?.templates) ? data.templates : [];
  const logs = Array.isArray(data?.logs) ? data.logs : [];
  const settings = connection || {};
  const rules = Array.isArray(state.sallaRuleDrafts)
    ? state.sallaRuleDrafts
    : Array.isArray(settings.subscriptionRules) ? settings.subscriptionRules : [];
  const selectedTemplate = templates.find((item) => item.id === settings.defaultTemplateId) || templates[0] || null;
  const previewColor = settings.defaultThemeColor || selectedTemplate?.themeColor || "#22C55E";
  const previewStyle = settings.defaultTemplateStyle || selectedTemplate?.style || "classic";
  const statusLabel = connected ? "مرتبط" : connection?.status === "expired" ? "انتهت الصلاحية" : connection?.status === "error" ? "خطأ في الربط" : "غير مرتبط";
  const callbackResult = state.query.get("salla");
  if (callbackResult && !state.sallaCallbackHandled) {
    state.sallaCallbackHandled = true;
    queueMicrotask(() => {
      toast(callbackResult === "connected" ? "تم ربط متجر سلة بنجاح" : callbackResult === "invalid_state" ? "انتهت جلسة الربط، حاول مرة أخرى." : "تعذر ربط متجر سلة.", callbackResult === "connected" ? "success" : "danger");
      history.replaceState({}, "", "/dashboard/apps");
    });
  }
  const toggles = [
    ["autoSyncCustomers", "تخزين العملاء تلقائيًا", "يتم إنشاء العميل أو تحديثه عند وصول طلب جديد من سلة."],
    ["autoSyncOrders", "تخزين الطلبات تلقائيًا", "تحفظ الطلبات القادمة في Renvix وتربطها بالعملاء."],
    ["autoCreateSubscriptions", "إنشاء اشتراكات تلقائيًا", "يحول منتجات الاشتراك إلى اشتراكات وفق المدة المحددة."],
    ["autoCreateOrderLinks", "إنشاء رابط معلومات الطلب", "ينشئ رابط المتجر الثابت ويضيف إليه الطلب تلقائيًا."],
    ["syncOrderStatus", "مزامنة حالة الطلب", "يحدث حالة الطلب عند تغيرها في سلة."],
    ["notifyCustomerAfterLinkCreated", "إرسال الرابط للعميل", "يضيف الرسالة للطابور فقط عند وجود جهاز واتساب متصل."],
    ["syncPaidOrdersOnly", "الطلبات المدفوعة فقط", "يتجاهل الطلبات غير المدفوعة أثناء المزامنة."],
    ["syncCompletedOrdersOnly", "الطلبات المكتملة فقط", "يقصر الإنشاء على الطلبات المكتملة."],
  ];
  const settingsPanel = connected && state.sallaSettingsOpen ? `<section class="card salla-settings-workspace">
    <div class="section-head"><div><h2>إعدادات ربط سلة</h2><p class="muted">اضبط المزامنة وقالب معلومات الطلب.</p></div><button class="btn btn-ghost icon-btn" data-action="close-salla-settings">×</button></div>
    <div class="apps-settings-layout"><div class="salla-settings-form">
      <div class="form-grid"><label class="field"><span>اسم المتجر داخل القالب</span><input class="input" data-salla-setting="storeDisplayName" value="${escapeHtml(settings.storeDisplayName || settings.storeName || "")}"></label><label class="field"><span>Slug رابط المتجر</span><input class="input" dir="ltr" data-salla-setting="orderLinkSlug" value="${escapeHtml(settings.orderLinkSlug || "")}" placeholder="smart-store"></label>
      <label class="field"><span>قالب معلومات الطلب</span><select class="select" data-salla-setting="defaultTemplateId">${templates.map((item) => `<option value="${item.id}" ${item.id === settings.defaultTemplateId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label><label class="field"><span>نمط القالب</span><select class="select" data-salla-setting="defaultTemplateStyle">${[["classic","كلاسيكي"],["modern","حديث"],["professional","احترافي"],["minimal","بسيط"],["premium","فاخر"],["colorful","ملون"]].map(([value,label]) => `<option value="${value}" ${previewStyle === value ? "selected" : ""}>${label}</option>`).join("")}</select></label></div>
      <div class="salla-color-row"><strong>لون القالب</strong>${["#2563EB","#06B6D4","#8B5CF6","#22C55E","#F97316","#EF4444","#64748B","#0F172A"].map((color) => `<label class="color-choice" style="--choice:${color}"><input type="radio" name="sallaThemeColor" value="${color}" data-salla-setting="defaultThemeColor" ${previewColor === color ? "checked" : ""}><span></span></label>`).join("")}</div>
      <div class="apps-toggle-list">${toggles.map(([key,title,description]) => `<label class="salla-setting-panel"><span><h3>${title}</h3><p>${description}</p></span><input type="checkbox" data-salla-setting="${key}" ${settings[key] ? "checked" : ""}></label>`).join("")}</div>
      <div class="salla-duration-line"><label class="field"><span>المدة الافتراضية عند عدم التطابق</span><input class="input" type="number" min="1" max="3650" data-salla-setting="defaultSubscriptionDurationDays" value="${Number(settings.defaultSubscriptionDurationDays || 30)}"></label><label class="field"><span>طريقة الإرسال</span><select class="select" data-salla-setting="sendMethod"><option value="manual">يدوي</option><option value="whatsapp" ${settings.sendMethod === "whatsapp" ? "selected" : ""}>واتساب</option><option value="email" ${settings.sendMethod === "email" ? "selected" : ""}>بريد إلكتروني</option><option value="copy_only" ${settings.sendMethod === "copy_only" ? "selected" : ""}>نسخ فقط</option></select></label></div>
      <div class="salla-rules-panel"><div class="salla-rules-head"><div><h3>أنواع الاشتراكات ومددها</h3><p>أضف مثل Grok أو Gemini والمدة؛ وسيتعرف Renvix عليها من اسم المنتج.</p></div><button class="btn btn-secondary" data-action="add-salla-rule">+‏ إضافة نوع</button></div><div class="salla-rule-list">${rules.length ? rules.map((rule,index) => `<div class="salla-rule-row" data-salla-rule-row data-rule-id="${escapeHtml(rule.id || "")}"><label><span>نوع الاشتراك</span><input class="input" data-salla-rule-field="name" data-rule-index="${index}" value="${escapeHtml(rule.name)}" placeholder="Grok"></label><label><span>المدة بالأيام</span><input class="input" type="number" min="1" max="3650" data-salla-rule-field="durationDays" data-rule-index="${index}" value="${Number(rule.durationDays || 30)}"></label><button class="btn btn-ghost icon-only danger-text" data-action="remove-salla-rule" data-rule-index="${index}">×</button></div>`).join("") : `<div class="salla-rules-empty"><strong>لا توجد أنواع محددة</strong><span>ستستخدم المدة الافتراضية.</span></div>`}</div></div>
      <div class="salla-rules-actions"><button class="btn btn-primary" data-action="save-salla-settings">حفظ الإعدادات</button><button class="btn btn-secondary" data-action="close-salla-settings">إلغاء</button></div>
    </div><aside class="salla-live-preview" style="--salla-preview:${previewColor}"><span class="preview-label">معاينة مباشرة</span><img src="/assets/salla-logo.svg" alt="سلة"><h3>${escapeHtml(settings.storeDisplayName || settings.storeName || "متجرك")}</h3><div class="preview-order"><span>طلب حقيقي بعد المزامنة</span><strong>رقم الطلب</strong><small>القالب: ${escapeHtml(selectedTemplate?.name || "قالب سلة الافتراضي")}</small></div><p>المعاينة للشكل فقط؛ البيانات الفعلية تأتي من سلة.</p></aside></div>
  </section>` : "";
  if (!connected) {
    const statCards = [
      { title: "التطبيقات المتاحة", value: stats.availableApps || 0, caption: "يمكن ربطها بحسابك", tone: "success", icon: "apps" },
      { title: "التطبيقات المرتبطة", value: stats.connectedApps || 0, caption: "لا يوجد تطبيق مرتبط", tone: "purple", icon: "customers" },
      { title: "آخر مزامنة", value: "—", caption: "لا توجد مزامنة حتى الآن", tone: "warning", icon: "reports" },
      { title: "الرسائل المرسلة", value: 0, caption: "لم يتم إرسال أي رسالة", tone: "info", icon: "notifications" }
    ];
    const benefits = [
      ["subscriptions", "مزامنة الطلبات", "زامن الطلبات الجديدة والمحدثة تلقائيًا"],
      ["customers", "إنشاء العملاء تلقائيًا", "أنشئ ملف العميل في النظام تلقائيًا"],
      ["apps", "ربط المنتج بالباقة", "اربط المنتجات بخطط الاشتراك والتجديد"],
      ["template", "إرسال رابط معلومات الطلب", "أرسل رابطًا آمنًا يحتوي على معلومات العميل والطلب"]
    ];
    return dashboardShell(`${pageTitle("تطبيقاتنا")}
      <section class="apps-overview-stats" aria-label="ملخص التطبيقات">${statCards.map((item) => `<article class="apps-overview-stat ${item.tone}"><span class="apps-stat-icon">${dashboardIcon(item.icon)}</span><div><strong>${item.title}</strong><b>${item.value}</b><small>${item.caption}</small></div></article>`).join("")}</section>
      <section class="apps-catalog" aria-label="التطبيقات المتاحة للربط">
        <article class="integration-card integration-card--featured">
          <div class="integration-card-head"><span class="integration-logo integration-logo--salla"><img src="/assets/salla-logo.svg" alt="شعار سلة"></span><span class="recommended-badge">الأكثر تكاملًا</span></div>
          <h2>سلة</h2><p class="integration-subtitle">منصة التجارة الإلكترونية السعودية</p>
          <p class="integration-description">اربط متجرك على سلة لمزامنة الطلبات والعملاء والاشتراكات تلقائيًا.</p>
          <span class="integration-status disconnected"><i></i> غير مربوط</span>
          <ul class="integration-features"><li>مزامنة الطلبات تلقائيًا</li><li>إنشاء العملاء تلقائيًا</li><li>ربط المنتج بالباقة</li><li>إرسال رابط معلومات الطلب</li></ul>
          <button class="btn btn-primary integration-action" data-action="connect-salla" ${data.configured ? "" : "disabled"}>ربط سلة</button>
          ${!data.configured ? `<small class="integration-config-note">الربط بانتظار تهيئة بيانات سلة الآمنة على الخادم.</small>` : ""}
        </article>
        <article class="integration-card">
          <div class="integration-card-head"><span class="integration-logo integration-logo--zid" aria-hidden="true">زد</span></div>
          <h2>زد</h2><p class="integration-subtitle">منصة التجارة الإلكترونية زد</p>
          <p class="integration-description">اربط متجرك على زد لمزامنة الطلبات والعملاء والاشتراكات.</p>
          <span class="integration-status disconnected"><i></i> غير مربوط</span>
          <ul class="integration-features"><li>مزامنة الطلبات تلقائيًا</li><li>إنشاء العملاء تلقائيًا</li><li>ربط المنتج بالباقة</li><li>إرسال رابط معلومات الطلب</li></ul>
          <button class="btn btn-secondary integration-action" data-action="integration-coming-soon" data-integration="زد">ربط الآن</button>
        </article>
        <article class="integration-card">
          <div class="integration-card-head"><span class="integration-logo integration-logo--api" aria-hidden="true">&lt;/&gt;</span></div>
          <h2 dir="ltr">API / Webhook</h2><p class="integration-subtitle">تطبيق مخصص</p>
          <p class="integration-description">اربط نظامك الخاص عبر API أو Webhook لتحكم كامل في التكامل.</p>
          <span class="integration-status disconnected"><i></i> غير مربوط</span>
          <ul class="integration-features"><li>تكامل مخصص عبر API</li><li>إمكانية Webhooks</li><li>إرسال واستقبال البيانات</li><li>توثيق شامل ومرن</li></ul>
          <button class="btn btn-secondary integration-action" data-action="integration-coming-soon" data-integration="API / Webhook">إعداد الربط</button>
        </article>
        <article class="integration-empty-card">
          <div class="integration-empty-art" aria-hidden="true"><span>◇</span><i></i><i></i><i></i></div>
          <h2>لم تربط أي تطبيق بعد</h2>
          <p>اربط تطبيقاتك لبدء أتمتة الطلبات وإدارة اشتراكات عملائك بكفاءة أعلى.</p>
          <div><button class="btn btn-secondary" data-action="integration-guide">عرض دليل الربط</button><button class="btn btn-primary" data-action="connect-salla">ربط سلة</button></div>
          <small>تحتاج مساعدة في الربط؟ <button data-link="/support">تواصل مع الدعم</button></small>
        </article>
      </section>
      <section class="apps-benefits card"><div class="apps-benefits-title"><span>☆</span><div><h2>مزايا ربط التطبيقات</h2><p>اربط تطبيقاتك واستمتع بأتمتة كاملة لعملياتك وتقليل الجهد اليدوي.</p></div></div><div class="apps-benefits-grid">${benefits.map(([icon,title,description]) => `<article><span>${dashboardIcon(icon)}</span><div><strong>${title}</strong><small>${description}</small></div></article>`).join("")}</div></section>`);
  }
  return dashboardShell(`${pageTitle("تطبيقاتنا")}
    ${statGrid([{ title: "التطبيقات المتاحة", value: stats.availableApps || 0, caption: "تطبيق", icon: "apps" }, { title: "التطبيقات المرتبطة", value: stats.connectedApps || 0, caption: "اتصال", tone: "success", icon: "apps" }, { title: "آخر مزامنة", value: stats.lastSyncAt ? new Date(stats.lastSyncAt).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }) : "لا يوجد", caption: "تحديث البيانات", tone: "warning", icon: "reports" }, { title: "طلبات تمت مزامنتها", value: stats.syncedOrders || 0, caption: "طلب حقيقي", tone: "purple", icon: "subscriptions" }])}
    <section class="card salla-app-card section"><div class="salla-card-head"><div class="salla-brand"><span class="salla-logo-shell"><img class="salla-logo" src="/assets/salla-logo.svg" alt="سلة"></span><div><h2>سلة</h2><p>منصة التجارة الإلكترونية السعودية</p></div></div><span class="status ${connected ? "success" : connection?.status === "error" || connection?.status === "expired" ? "danger" : "neutral"}">${statusLabel}</span></div><p class="salla-app-description">اربط متجر سلة عبر OAuth لمزامنة الطلبات والعملاء والاشتراكات دون نسخ التوكنات إلى المتصفح.</p>${connected ? `<div class="salla-connected-meta"><div><span>المتجر</span><strong>${escapeHtml(connection.storeName || "-")}</strong></div><div><span>آخر مزامنة</span><strong>${connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString("ar-SA") : "لم تتم المزامنة"}</strong></div></div><div class="salla-header-actions"><button class="btn btn-primary" data-action="open-salla-settings">إعدادات الربط</button><button class="btn btn-secondary" data-action="sync-salla-now">مزامنة الآن</button><button class="btn btn-secondary" data-action="show-salla-logs">عرض السجلات</button><button class="btn btn-ghost danger-text" data-action="disconnect-salla">فصل الربط</button></div>` : `<div class="salla-header-actions"><button class="btn btn-primary" data-action="connect-salla" ${data.configured ? "" : "disabled"} title="${data.configured ? "ربط سلة" : "إعدادات OAuth لسلة غير مكتملة على الخادم"}">ربط سلة</button></div>${!data.configured ? `<p class="inline-notice warning">تكامل سلة بانتظار إضافة بيانات OAuth الآمنة في الخادم.</p>` : ""}`}</section>
    ${settingsPanel}
    <section class="card table-card section" id="salla-sync-logs"><div class="section-head"><div><h2>سجل المزامنة</h2><p class="muted">النتائج الفعلية المسجلة لهذا المتجر.</p></div></div>${logs.length ? simpleTable(["الوقت", "التطبيق", "الحدث", "الحالة", "الرسالة"], logs.map((item) => [new Date(item.createdAt).toLocaleString("ar-SA"), "سلة", escapeHtml(item.eventType || "-"), status(item.status), escapeHtml(item.message || "-")])) : emptyState("لا توجد سجلات مزامنة", "ستظهر هنا الأحداث بعد ربط متجر سلة.")}</section>`);
}

function subscriptionRemainingDays(row) {
  if (!row?.endDate) return null;
  const end = new Date(`${String(row.endDate).slice(0, 10)}T23:59:59`);
  if (!Number.isFinite(end.getTime())) return null;
  return Math.ceil((end.getTime() - Date.now()) / 86400000);
}

function subscriptionFilterRows(rows) {
  const query = state.search.trim().toLowerCase();
  const selected = state.filter === "الكل" ? "all" : state.filter;
  const windowDays = Number(state.subscriptionWindow || 7);
  return rows.filter((row) => {
    const haystack = ["orderNumber", "customerName", "planName", "serviceName", "status"]
      .map((key) => String(row[key] || "").toLowerCase())
      .join(" ");
    if (query && !haystack.includes(query)) return false;
    const remaining = subscriptionRemainingDays(row);
    const expired = remaining !== null ? remaining < 0 : row.status === "expired";
    const active = !expired && !["paused", "cancelled"].includes(String(row.status || "").toLowerCase());
    const expiring = active && remaining !== null && remaining >= 0 && remaining <= windowDays;
    const attention = !row.canSend || row.remindersPaused || Number(row.riskScore || 0) > 70 || (remaining !== null && remaining <= 3);
    return selected === "all"
      || (selected === "active" && active)
      || (selected === "expiring" && expiring)
      || (selected === "expired" && expired)
      || (selected === "attention" && attention);
  });
}

function subscriptionToolbar() {
  const selected = state.filter === "الكل" ? "all" : state.filter;
  return `<div class="toolbar mb-toolbar subscription-toolbar">
    <div class="search-wrap"><span class="search-icon">⌕</span><input class="input" data-action="dashboard-search" placeholder="بحث في الاشتراكات..." value="${escapeHtml(state.search)}"></div>
    <select class="select" data-action="dashboard-filter">
      <option value="all" ${selected === "all" ? "selected" : ""}>الكل</option>
      <option value="active" ${selected === "active" ? "selected" : ""}>نشطة</option>
      <option value="expiring" ${selected === "expiring" ? "selected" : ""}>تنتهي قريبًا</option>
      <option value="expired" ${selected === "expired" ? "selected" : ""}>منتهية</option>
      <option value="attention" ${selected === "attention" ? "selected" : ""}>تحتاج متابعة</option>
    </select>
    <label class="field compact-field"><span>نافذة التجديد</span><select class="select" data-action="subscription-window"><option value="3" ${state.subscriptionWindow === "3" ? "selected" : ""}>3 أيام</option><option value="7" ${state.subscriptionWindow === "7" ? "selected" : ""}>7 أيام</option><option value="14" ${state.subscriptionWindow === "14" ? "selected" : ""}>14 يومًا</option></select></label>
  </div>`;
}

function subscriptionsPage() {
  const stats = overviewStats();
  const source = Array.isArray(state.dbSubscriptions) ? state.dbSubscriptions : [];
  const rows = subscriptionFilterRows(source);
  const content = state.dbSubscriptions?.error
    ? `<div class="empty-state"><strong>تعذر تحميل الاشتراكات</strong><p class="muted">${escapeHtml(state.dbSubscriptions.error)}</p><button class="btn btn-secondary" data-action="reload-subscriptions">إعادة المحاولة</button></div>`
    : state.dbSubscriptions === null
      ? `<div class="loading-state">جاري تحميل الاشتراكات من قاعدة البيانات...</div>`
      : rows.length ? subscriptionsTable(rows) : emptyState("لا توجد اشتراكات بعد", "ابدأ بإضافة أول اشتراك لإدارة التجديدات والتنبيهات.", "إضافة اشتراك", "add-subscription");
  return dashboardShell(`${pageTitle("إدارة الاشتراكات", `<button class="btn btn-primary" data-action="add-subscription">إضافة اشتراك</button><button class="btn btn-secondary" data-action="export-subscriptions">تصدير CSV</button>`)}
    ${statGrid([
      { title: "إجمالي الاشتراكات", value: stats.totalSubscriptions, caption: "اشتراك", tone: "info", icon: "subscriptions" },
      { title: "التجديدات خلال 7 أيام", value: stats.upcomingRenewals, caption: "قادم", tone: "warning", icon: "reports" },
      { title: "الاشتراكات المنتهية", value: stats.expiredSubscriptions, caption: "منتهي", tone: "danger", icon: "security" },
      { title: "الإيراد الشهري", value: formatMoney(stats.monthlyRevenue), caption: "من الاشتراكات", tone: "success", icon: "reports" }
    ])}
    ${subscriptionToolbar()}
    <article class="card table-card">${content}</article>`);
}

function subscriptionsTable(rows, compact = false) {
  const head = compact ? ["رقم الطلب", "العميل", "الباقة", "تاريخ الانتهاء", "الحالة"] : ["رقم الطلب", "العميل", "الباقة / الخدمة", "تاريخ البداية", "تاريخ الانتهاء", "الحالة", "الإجراء"];
  const body = rows.map((row) => {
    const disabled = row.canSend ? "" : "disabled";
    const reason = row.remindersPaused
      ? "التذكيرات موقوفة لهذا العميل"
      : row.reminderChannel === "email" && !row.email
        ? "أضف بريد العميل أولًا"
        : row.reminderChannel !== "email" && row.whatsappStatus !== "connected"
          ? "يجب ربط واتساب أولًا"
          : row.reminderChannel !== "email" && Number(row.riskScore) > 70
            ? "الإرسال متوقف بسبب ارتفاع المخاطر"
            : "";
    const deliveryLabel = `${row.reminderChannel === "email" ? "البريد الإلكتروني" : "واتساب"} · ${row.reminderMode === "automatic" ? `تلقائي قبل ${Number(row.reminderDaysBefore || 0)} يوم` : "يدوي"}`;
    const actions = `<div class="subscription-actions">
      <button class="btn btn-primary" data-action="mark-renewed" data-id="${row.id}">تم التجديد</button>
      <button class="btn btn-secondary" data-action="send-subscription-reminder" data-id="${row.id}" ${disabled} title="${escapeHtml(reason)}">إرسال تذكير</button>
      <button class="btn btn-ghost icon-only" data-action="subscription-edit-db" data-id="${row.id}" title="تعديل">${dashboardIcon("settings")}</button>
      <button class="btn btn-ghost icon-only danger-text" data-action="subscription-delete-db" data-id="${row.id}" title="حذف">×</button>
    </div>`;
    if (compact) return `<tr><td>${escapeHtml(row.orderNumber)}</td><td>${escapeHtml(row.customerName)}</td><td>${escapeHtml(row.planName)}</td><td>${escapeHtml(String(row.endDate).slice(0, 10))}</td><td>${status(row.status)}</td></tr>`;
    return `<tr><td>${escapeHtml(row.orderNumber)}</td><td>${escapeHtml(row.customerName)}</td><td><strong>${escapeHtml(row.planName)}</strong><small>${escapeHtml(row.serviceName)}</small><span class="delivery-preference-pill ${row.reminderMode === "automatic" ? "automatic" : "manual"}">${escapeHtml(deliveryLabel)}</span></td><td>${escapeHtml(String(row.startDate).slice(0, 10))}</td><td>${escapeHtml(String(row.endDate).slice(0, 10))}</td><td>${status(row.status)}</td><td>${actions}</td></tr>`;
  }).join("");
  return `<div class="compare"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function rowActions(type, key) {
  return `<div class="inline-actions">
    <button class="btn btn-secondary" data-action="${type}-details" data-key="${key}">عرض</button>
    <button class="btn btn-ghost" data-action="${type}-edit" data-key="${key}">تعديل</button>
    <button class="btn btn-danger" data-action="${type}-delete" data-key="${key}">حذف</button>
  </div>`;
}

function tableToolbar(filters) {
  return `<div class="toolbar mb-toolbar">
    <div class="search-wrap"><span class="search-icon">⌕</span><input class="input" data-action="dashboard-search" placeholder="بحث في البيانات..." value="${state.search}"></div>
    <select class="select" data-action="dashboard-filter">${filters.map((item) => `<option ${state.filter === item ? "selected" : ""}>${item}</option>`).join("")}</select>
    <button class="btn btn-secondary" data-action="apply-filter">تصفية</button>
  </div>`;
}

function filterRows(rows, keys) {
  const q = state.search.trim();
  return rows.filter((row) => {
    const matchFilter = state.filter === "الكل" || Object.values(row).includes(state.filter);
    const matchSearch = !q || keys.some((key) => String(row[key] || "").includes(q));
    return matchFilter && matchSearch;
  });
}

function customersPage() {
  const stats = overviewStats();
  const source = Array.isArray(state.dbCustomers) ? state.dbCustomers : [];
  const rows = filterRows(source, ["name", "email", "phone", "serviceName", "status"]);
  const recentNotifications = state.dashboardOverview?.recentNotifications || [];
  const content = state.dbCustomers?.error ? emptyState("تعذر تحميل العملاء", escapeHtml(state.dbCustomers.error)) : state.dbCustomers === null ? `<div class="loading-state">جاري تحميل العملاء...</div>` : rows.length ? customersTable(rows) : emptyState("لا يوجد عملاء بعد", "أضف أول عميل لبدء إدارة الاشتراكات والتنبيهات.", "إضافة عميل", "add-customer");
  const sendDisabled = stats.connectedDevices > 0 ? "" : "disabled";
  return dashboardShell(`${pageTitle("العملاء", `<button class="btn btn-primary" data-action="add-customer">إضافة عميل</button><button class="btn btn-secondary" data-action="import-customers">استيراد CSV</button><button class="btn btn-secondary" data-action="export-customers">تصدير CSV</button>`)}
    ${statGrid([
      { title: "إجمالي العملاء", value: stats.totalCustomers, caption: "عميل", tone: "info", icon: "customers" },
      { title: "النشطون اليوم", value: stats.activeToday, caption: "اليوم", tone: "success", icon: "customers" },
      { title: "العملاء المميزون", value: 0, caption: "حسب التصنيف", tone: "purple", icon: "customers" },
      { title: "معدل الاستجابة", value: `${stats.deliveryRate || 0}%`, caption: "من التنبيهات", tone: "warning", icon: "reports" }
    ])}
    ${tableToolbar(["الكل", "active", "inactive"])}
    <article class="card table-card">${content}</article>
    <article class="card table-card section"><div class="section-head"><div><h2>أحدث التنبيهات</h2><p class="muted">رسائل العملاء المسجلة فعليًا.</p></div><button class="btn btn-secondary" data-action="send-message" ${sendDisabled} title="${sendDisabled ? "اربط جهازًا أولًا حتى تتمكن من إرسال التنبيهات." : "إرسال تنبيه"}">إرسال تنبيه</button></div>${recentNotifications.length ? `<div class="notification-list">${recentNotifications.map((item) => `<div class="activity-item"><span class="activity-dot"></span><div><strong>${escapeHtml(item.customerName || item.toNumber || "تنبيه")}</strong><p class="muted">${escapeHtml(item.channel)} · ${escapeHtml(item.createdAt ? new Date(item.createdAt).toLocaleString("ar-SA") : "")}</p></div>${status(item.status)}</div>`).join("")}</div>` : emptyState("لا توجد تنبيهات بعد", "ستظهر سجلات التنبيهات بعد أول عملية إرسال.")}</article>`);
}

function customersTable(rows) {
  if (!rows.length) return emptyState("لا يوجد عملاء مطابقون", "غيّر البحث أو الفلترة.");
  const body = rows.map((row) => `<tr><td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.email || "")}</small></td><td>${escapeHtml(row.phone || "غير مضاف")}</td><td>${escapeHtml(row.serviceName || "لا توجد خدمة")}</td><td>${escapeHtml(row.lastRenewal ? String(row.lastRenewal).slice(0, 10) : "-")}</td><td>${status(row.status)}</td><td>${escapeHtml((row.tags || []).join("، ") || "-")}</td><td><div class="inline-actions"><button class="btn btn-secondary" data-action="customer-details-db" data-id="${row.id}">عرض</button><button class="btn btn-ghost icon-only" data-action="customer-edit-db" data-id="${row.id}" title="تعديل">${dashboardIcon("settings")}</button><button class="btn btn-ghost icon-only danger-text" data-action="customer-delete-db" data-id="${row.id}" title="حذف">×</button></div></td></tr>`).join("");
  return `<div class="compare"><table><thead><tr>${["الاسم", "الهاتف", "الخدمة", "آخر تجديد", "الحالة", "الملاحظات", "الإجراء"].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function reportsPage() {
  const stats = overviewStats();
  const activities = (state.dashboardOverview?.activities || []).filter((item) => !String(item.type || "").startsWith("auth."));
  const profile = state.dashboardOverview?.profile || {};
  const reportRows = (state.dashboardOverview?.monthlyPerformance || []).slice(-Number(state.reportPeriod || 6));
  return dashboardShell(`${pageTitle("التقارير", `<select class="select report-period" data-action="report-period"><option value="6" ${state.reportPeriod === "6" ? "selected" : ""}>آخر 6 أشهر</option><option value="3" ${state.reportPeriod === "3" ? "selected" : ""}>آخر 3 أشهر</option><option value="1" ${state.reportPeriod === "1" ? "selected" : ""}>هذا الشهر</option></select><button class="btn btn-primary" data-action="export-report">تصدير التقرير</button>`)}
    ${statGrid([
      { title: "الإيراد الشهري", value: formatMoney(stats.monthlyRevenue), caption: "حالي", tone: "success", icon: "reports" },
      { title: "الرسائل المرسلة", value: stats.sentMessages, caption: "رسالة", tone: "info", icon: "subscriptions" },
      { title: "نسبة النجاح", value: `${stats.successRate || 0}%`, caption: "من إجمالي الرسائل", tone: "purple", icon: "reports" },
      { title: "العملاء المتجددون", value: stats.renewedCustomers, caption: "عميل", tone: "warning", icon: "customers" }
    ])}
    <article class="card chart-card section"><div class="section-head"><div><h2>رسم الأداء</h2><p class="muted">بيانات الاشتراكات للفترة المحددة.</p></div></div>${performanceChart(reportRows)}</article>
    <div class="section dashboard-two-column">
      <article class="card table-card"><div class="section-head"><div><h2>سجل النشاط</h2><p class="muted">آخر العمليات داخل مساحة العمل.</p></div></div>${activities.length ? activityList(activities) : emptyState("لا توجد نشاطات بعد", "ستظهر العمليات الفعلية هنا بعد استخدام المنصة.")}</article>
      <article class="card table-card"><div class="section-head"><div><h2>الفوترة والباقات</h2><p class="muted">الخطة الحالية والفواتير.</p></div><span class="plan-badge">${escapeHtml(profile.planName || "Free Trial")}</span></div>${emptyState("لا توجد فواتير بعد", "ستظهر الفواتير هنا عند إصدار أول فاتورة.", "عرض خطط الأسعار", "/pricing")}</article>
    </div>`);
}

function securityScoreTone(score, configured = true) {
  if (!configured || score === null || score === undefined) return "unconfigured";
  if (score < 30) return "danger";
  if (score < 50) return "weak";
  if (score < 70) return "warning";
  if (score < 85) return "good";
  if (score < 95) return "strong";
  return "excellent";
}

function securityFactorsMarkup(factors = []) {
  return factors.map((item) => {
    const symbol = item.state === "passed" ? "✓" : item.state === "critical" ? "×" : "!";
    return `<li class="security-factor ${escapeHtml(item.state || "review")}"><span>${symbol}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail || "")}</small></div><b>${Number(item.points || 0)}/${Number(item.maxPoints || 0)}</b></li>`;
  }).join("");
}

function securityRecommendationsMarkup(recommendations = []) {
  if (!recommendations.length) return `<div class="security-all-clear">لا توجد توصيات عاجلة الآن. استمر في مراجعة الحماية دوريًا.</div>`;
  return recommendations.slice(0, 6).map((item) => `<article class="security-recommendation ${escapeHtml(item.priority)}"><span>${item.priority === "critical" ? "حرجة" : item.priority === "high" ? "عالية" : "متوسطة"}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description)}</p><small>التأثير المتوقع: حتى +${Number(item.scoreImpact || 0)} نقطة</small></div><button class="btn btn-secondary" data-link="${escapeHtml(item.actionUrl || "/dashboard/security")}">تنفيذ</button></article>`).join("");
}

function securityMetricValue(metric = {}, risk = false) {
  if (metric.score === null || metric.score === undefined || metric.status === "not_configured" || metric.status === "insufficient_data" || metric.status === "unavailable") {
    return `<strong class="security-metric-state">${escapeHtml(metric.label || "تعذر التحقق")}</strong><small>${metric.status === "not_configured" ? "لم يتم إعداد المصدر" : metric.status === "insufficient_data" ? "يلزم توفر بيانات فعلية أكثر" : "لا تتوفر نتيجة موثوقة الآن"}</small>`;
  }
  return `<strong>${Number(metric.score)}%</strong><span class="security-mini-status ${risk ? `risk-${securityRiskTone(metric.score)}` : securityScoreTone(metric.score)}">${escapeHtml(metric.label || "")}</span>`;
}

function securityRiskTone(score) {
  if (score === null || score === undefined) return "unavailable";
  if (score < 20) return "low";
  if (score < 40) return "limited";
  if (score < 60) return "medium";
  if (score < 80) return "high";
  return "critical";
}

function securityMetricCard(title, metric, icon, description, risk = false) {
  const tone = risk ? `risk-${securityRiskTone(metric?.score)}` : securityScoreTone(metric?.score, metric?.status !== "not_configured");
  return `<article class="card security-mini-card ${tone}"><div class="security-mini-head">${dashboardIcon(icon)}<span>${escapeHtml(title)}</span></div><div class="security-mini-value">${securityMetricValue(metric, risk)}</div><p>${escapeHtml(description)}</p>${metric?.coverage !== undefined && !risk ? `<small>تغطية البيانات ${Number(metric.coverage)}%</small>` : ""}</article>`;
}

function securityTime(value) {
  if (!value) return "غير متوفر";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير متوفر";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  return date.toLocaleDateString("ar-SA");
}

function securityEventsTable(events = []) {
  if (!events.length) return `<div class="security-empty-row">لا توجد أحداث أمنية مسجلة.</div>`;
  return `<div class="compare security-events-table"><table><thead><tr><th>نوع الحدث</th><th>المستوى</th><th>الوقت</th><th>الحالة</th><th>التفاصيل</th></tr></thead><tbody>${events.map((item) => `<tr><td><strong>${escapeHtml(item.type)}</strong></td><td><span class="security-severity ${escapeHtml(item.severity || "low")}">${item.severity === "critical" ? "حرج" : item.severity === "error" ? "عالٍ" : item.severity === "warning" ? "متوسط" : "منخفض"}</span></td><td>${escapeHtml(securityTime(item.occurredAt))}</td><td><span class="security-event-status">${escapeHtml(item.status || "مسجل")}</span></td><td>${escapeHtml(item.detail || "-")}</td></tr>`).join("")}</tbody></table></div>`;
}

function securityPage() {
  const list = Array.isArray(state.unsubscribes) ? state.unsubscribes : [];
  const score = state.securityScore?.overall ? state.securityScore : null;
  const listContent = state.unsubscribes?.error
    ? emptyState("تعذر تحميل قائمة الإيقاف", escapeHtml(state.unsubscribes.error))
    : state.unsubscribes === null
      ? `<div class="loading-state">جاري تحميل قائمة الإيقاف...</div>`
      : list.length
        ? simpleTable(["الرقم", "السبب", "المصدر", "التاريخ", "الإجراء"], list.map((item) => [escapeHtml(item.phoneNumber), escapeHtml(item.reason || "-"), escapeHtml(item.source || "يدوي"), escapeHtml(item.unsubscribedAt ? new Date(item.unsubscribedAt).toLocaleDateString("ar-SA") : "-"), `<button class="btn btn-ghost danger-text" data-action="remove-unsubscribe" data-id="${item.id}">حذف</button>`]))
        : emptyState("لا توجد أرقام محظورة", "لم تتم إضافة أي رقم إلى قائمة إيقاف الرسائل.", "إضافة رقم", "add-unsubscribe");
  const loading = state.securityScore === null;
  const error = state.securityScore?.error;
  const checkedLabel = score?.calculatedAt ? securityTime(score.calculatedAt) : "لم يتم الفحص";
  const overall = score?.overall || { score: null, label: "لم يتم الفحص", coverage: 0, status: "unavailable" };
  const platform = score?.platform || { score: null, label: "لم يتم الفحص", coverage: 0 };
  const accounts = score?.accounts || score?.account || { score: null, label: "لم يتم الفحص", coverage: 0 };
  const sessions = score?.sessions || { score: null, label: "لم يتم الفحص", activeSessions: 0, items: [] };
  const whatsapp = score?.whatsapp || { score: null, healthScore: null, riskScore: null, label: "غير مهيأ", status: "not_configured", coverage: 0 };
  const sending = score?.sending || { score: null, label: "لم يتم الفحص", policies: [] };
  const currentRisk = score?.risk || { score: null, label: "غير متاح", issues: 0 };
  const scoreContent = loading
    ? `<div class="loading-state">جاري حساب مستوى الحماية من البيانات الفعلية...</div>`
    : error
      ? emptyState("تعذر حساب مستوى الحماية", "لم يتم استبدال النتيجة بقيمة افتراضية. حاول إعادة الفحص.", "إعادة الفحص", "recalculate-security")
      : `<section class="security-center-overview">
          <article class="card security-overall-card ${securityScoreTone(overall.score)}">
            <div class="security-overall-ring ${overall.score === null ? "empty" : ""}" style="--security-progress:${Number(overall.score || 0) * 3.6}deg"><div>${overall.score === null ? `<strong>—</strong>` : `<strong>${Number(overall.score)}%</strong>`}<span>${escapeHtml(overall.label)}</span>${dashboardIcon("security")}</div></div>
            <div><h2>مؤشر الحماية العام</h2><p>تم حساب النتيجة من حماية المنصة والحساب والجلسات وقنوات الإرسال.</p><span class="security-live-dot">نتيجة حقيقية</span><small>آخر فحص: ${escapeHtml(checkedLabel)} · التغطية ${Number(overall.coverage || 0)}%</small></div>
          </article>
          <div class="security-metrics-grid">
            ${securityMetricCard("حماية المنصة", platform, "security", "المسارات والأسرار وقاعدة البيانات")}
            ${securityMetricCard("حماية الحساب", accounts, "customers", "كلمة المرور والدخول والاسترداد")}
            ${securityMetricCard("أمان الجلسات", sessions, "devices", "الجلسات الفعلية وخصائص Cookie")}
            ${securityMetricCard("صحة واتساب", { ...whatsapp, score: whatsapp.healthScore }, "devices", "الاتصال والرسائل والـQueue")}
            ${securityMetricCard("أمان الإرسال", sending, "template", "الفاصل والحدود والإيقاف الوقائي")}
            ${securityMetricCard("الخطر الحالي", currentRisk, "reports", `${Number(currentRisk.issues || 0)} أحداث تحتاج المراجعة`, true)}
          </div>
        </section>
        <section class="security-center-middle">
          <article class="card security-policy-card"><div class="security-panel-title">${dashboardIcon("security")}<div><h2>سياسة الإرسال الآمن</h2><p>تساعد على تقليل الضغط والمخاطر، ولا تضمن عدم تقييد القناة من مقدم الخدمة.</p></div></div><div class="security-policy-body"><div class="security-shield-art">${dashboardIcon("security")}<span>حماية تلقائية</span></div><div class="security-policy-list">${(sending.policies || []).length ? sending.policies.map((item) => `<div><span class="policy-indicator ${item.active ? "active" : "inactive"}">${item.active ? "نشط" : "يحتاج ضبط"}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div>`).join("") : `<div class="security-empty-row">لم يتم إعداد سياسة الإرسال بعد.</div>`}</div></div><button class="security-safe-action" data-action="preview-safe-settings">تطبيق الإعدادات الآمنة الموصى بها</button></article>
          <div class="security-activity-column">
            <article class="card security-compact-panel"><div class="security-panel-title">${dashboardIcon("devices")}<h2>الجلسات النشطة</h2></div><div class="security-panel-summary"><strong>${Number(sessions.activeSessions || 0)}</strong><span>جلسة حالية فعلية</span></div>${(sessions.items || []).length ? sessions.items.slice(0, 2).map((item) => `<div class="security-activity-line"><span>✓</span><div><strong>${escapeHtml(item.device)}</strong><small>${escapeHtml(item.location)} · ${escapeHtml(securityTime(item.lastActivityAt))}</small></div></div>`).join("") : `<div class="security-empty-row">لا توجد جلسات سارية.</div>`}<button class="security-panel-link" data-action="manage-sessions">عرض جميع الجلسات</button></article>
            <article class="card security-compact-panel"><div class="security-panel-title">${dashboardIcon("customers")}<h2>محاولات الدخول</h2></div><div class="security-panel-summary"><strong>${Number(score.login?.failed24h || 0)}</strong><span>محاولة فاشلة خلال 24 ساعة</span></div>${(score.login?.recent || []).length ? score.login.recent.slice(0, 2).map((item) => `<div class="security-activity-line ${item.success ? "success" : "warning"}"><span>${item.success ? "✓" : "!"}</span><div><strong>${item.success ? "تسجيل دخول ناجح" : "محاولة غير ناجحة"}</strong><small>${escapeHtml(item.device)} · ${escapeHtml(securityTime(item.occurredAt))}</small></div></div>`).join("") : `<div class="security-empty-row">لا توجد محاولات دخول مسجلة.</div>`}</article>
          </div>
          <article class="card security-alerts-card"><div class="security-panel-title">${dashboardIcon("notifications")}<div><h2>تنبيهات الحماية</h2><p>نتائج فعلية تحتاج انتباهك.</p></div></div>${(score.criticalIssues || []).length ? score.criticalIssues.map((item) => `<div class="security-alert-line ${escapeHtml(item.severity || "warning")}"><span>!</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description || "راجع تفاصيل الحدث.")}</small></div></div>`).join("") : `<div class="security-empty-row success">لا توجد تنبيهات حماية مفتوحة.</div>`}${(score.recommendations || []).slice(0, 2).map((item) => `<div class="security-alert-line recommendation"><span>i</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small></div></div>`).join("")}</article>
        </section>
        <article class="card security-events-card"><div class="section-head"><div class="security-panel-title">${dashboardIcon("reports")}<div><h2>سجل الأحداث الأمنية</h2><p>محاولات الدخول ومشكلات التشغيل وسجل الحساب الفعلي.</p></div></div><span class="security-last-check">آخر فحص ${escapeHtml(checkedLabel)}</span></div>${securityEventsTable(score.events || [])}</article>`;
  return dashboardShell(`${pageTitle("الحماية والأمان", `<button class="btn btn-secondary" data-action="recalculate-security">إعادة الفحص</button>`)}
    <p class="security-page-subtitle">إدارة سياسات الحماية ومراقبة سلامة الحساب وقنوات الإرسال من مصادر فعلية.</p>
    ${scoreContent}
    <article class="card table-card section security-optout-card"><div class="section-head"><div><h2>قائمة إيقاف الرسائل</h2><p class="muted">الأرقام الفعلية التي يمنع النظام الإرسال إليها قبل إدراج أي رسالة.</p></div><div class="inline-actions"><button class="btn btn-primary" data-action="add-unsubscribe">إضافة رقم</button><button class="btn btn-secondary" data-action="import-unsubscribes">استيراد قائمة</button></div></div>${listContent}</article>`);
}

function connectedDevicesCenterPage() {
  const device = { ...defaultLinkedDevice, ...state.linkedDevice };
  const stats = overviewStats();
  const health = state.whatsappHealth?.health || null;
  const isConnected = device.status === "connected";
  const hasRealQr = isRealQrDataUri(device.qrBase64);
  const hasQrSession = ["pending_qr", "connecting"].includes(device.status);
  const isPendingQr = hasQrSession && hasRealQr && device.qrImageLoaded;
  const isQrRendering = hasQrSession && hasRealQr && !device.qrImageLoaded;
  const isQrExpired = hasQrSession && !hasRealQr;
  const isPendingPairing = device.status === "pending_pairing" && Boolean(device.pairingCode);
  const method = device.linkMethod || "qr";
  const statusText = isConnected ? "متصل الآن" : isPendingQr ? "بانتظار مسح الباركود" : isQrRendering ? "جاري عرض الباركود" : isQrExpired ? "انتهت صلاحية الباركود" : isPendingPairing ? "بانتظار إدخال رمز الاقتران" : device.status === "disconnected" ? "غير متصل" : "غير مربوط";
  const statusTone = isConnected ? "success" : isPendingQr || isQrRendering || isQrExpired || isPendingPairing ? "warning" : "danger";
  const qrImage = hasRealQr
    ? `<img class="qr-real" src="${device.qrBase64}" alt="باركود ربط واتساب">`
    : `<div class="qr-empty"><strong>لا يوجد باركود صالح</strong><p class="muted">أنشئ باركود ربط حقيقي.</p></div>`;
  const activity = device.activity?.length ? device.activity : [];
  const connectedTable = simpleTable(["الجهاز", "رقم واتساب", "الحالة", "آخر فحص", "آخر إرسال", "الإجراءات"], [[device.deviceName || "غير متوفر", device.phoneNumber || "غير متوفر", status("نشط"), device.lastCheckAt || "لم يتم الفحص", device.lastSendAt || "لم يتم الإرسال", `<button class="btn btn-secondary" data-action="check-device-connection">فحص</button>`]]);

  return dashboardShell(`${pageTitle("الأجهزة", `<button class="btn btn-primary" data-action="create-device-qr" ${device.qrLoading ? "disabled" : ""}>${device.qrLoading ? "جاري إنشاء الباركود..." : "إنشاء/تحديث باركود"}</button>`)}
    ${statGrid([
      { title: "الأجهزة المتصلة", value: stats.connectedDevices, caption: "جهاز", tone: isConnected ? "success" : "neutral", icon: "devices" },
      { title: "بانتظار الربط", value: stats.pendingDevices, caption: "جلسة", tone: "warning", icon: "devices" },
      { title: "جودة الاتصال", value: isConnected ? "100%" : "0%", caption: statusText, tone: isConnected ? "success" : "neutral", icon: "reports" },
      { title: "آخر فحص", value: device.lastCheckAt || "لم يتم", caption: "فحص الاتصال", tone: "info", icon: "security" }
    ])}
    <p class="linked-subtitle">قم بربط واتساب وإدارة أجهزتك المرتبطة بأمان لتواصل فعال مع عملائك.</p>
    <section class="linked-layout" data-device-status="${device.status}" data-link-method="${method}">
      <article class="card linked-main-card">
        <div class="device-art" aria-hidden="true">
          <div class="phone-frame"><span class="wa-logo">☎</span></div>
          <div class="wa-check ${isConnected ? "show" : ""}">✓</div>
          <div class="qr-float">${hasRealQr ? qrImage : `<div class="qr-unavailable">QR</div>`}</div>
        </div>
        <div class="link-panel">
          <div class="section-head compact-head">
            <div><h2>ربط واتساب</h2><p class="muted">${isConnected ? "تم ربط حساب واتساب وجاهز لإرسال تنبيهات وتجديدات العملاء." : "اربط حساب واتساب لإدارة المحادثات والرد على العملاء مباشرة من المنصة."}</p><p class="muted lock-line">🔒 آمن، خاص، ومتوافق مع سياسات واتساب.</p></div>
            <span class="status ${statusTone}">${statusText}</span>
          </div>
          <div class="tabs tabs-row link-tabs">
            <button class="tab ${method === "qr" ? "active" : ""}" data-action="device-link-method" data-method="qr">الربط بالباركود QR</button>
            <button class="tab ${method === "pairing" ? "active" : ""}" data-action="device-link-method" data-method="pairing">الربط برمز الاقتران${device.pairingSupported === false ? " · غير مدعوم حاليًا" : ""}</button>
          </div>
          ${method === "qr" ? `<div class="link-box-grid">
            <div class="qr-box ${isPendingQr ? "active" : ""}" data-action="show-device-qr">
              ${qrImage}
              <strong>${device.qrLoading ? "جاري طلب الباركود من خدمة الربط..." : hasRealQr && !device.qrImageLoaded ? "جاري التحقق من صورة الباركود..." : isPendingQr ? "الباركود جاهز للمسح" : isConnected ? "الجهاز متصل" : "لا يوجد باركود صالح"}</strong>
              <small class="muted">${isPendingQr ? `ينتهي خلال 60 ثانية - صالح حتى ${device.qrExpiresAt}` : hasRealQr ? "يتم تحميل الصورة والتحقق منها داخل المتصفح." : device.qrError ? escapeHtml(device.qrError) : "اضغط إنشاء باركود جديد."}</small>
            </div>
            <div class="pair-code">
              <span class="muted">رمز الاقتران</span>
              <strong>${device.pairingCode || "غير متوفر"}</strong>
              <small class="muted">لا يظهر الرمز إلا بعد استلامه من خدمة الربط</small>
              <button class="btn btn-primary" data-action="create-device-qr" ${device.qrLoading ? "disabled" : ""}>${device.qrLoading ? "جاري التحميل..." : "إنشاء/تحديث باركود"}</button>
              <button class="btn btn-secondary" data-action="copy-pairing">نسخ رمز الاقتران</button>
              <button class="btn btn-secondary" data-action="check-device-connection" ${!isPendingQr && !isConnected ? "disabled" : ""}>فحص الاتصال</button>
            </div>
          </div>` : device.pairingSupported === false ? `<div class="pairing-unsupported">
            <p class="status warning">رمز الاقتران غير مدعوم حاليًا. يمكنك استخدام الربط بالباركود.</p>
            <button class="btn btn-primary" data-action="device-link-method" data-method="qr">استخدام الباركود بدلًا من ذلك</button>
          </div>` : `<div class="link-box-grid pairing-layout">
            <div class="pairing-form">
              <label class="field"><span>رقم واتساب</span><input class="input" data-action="pairing-phone-input" value="${device.phoneInput || ""}" placeholder="9665XXXXXXXX" inputmode="numeric"></label>
              <small class="muted">اكتب الرقم بصيغة دولية بدون + أو مسافات، مثال: 9665XXXXXXXX.</small>
              <button class="btn btn-primary" data-action="create-pairing-code" ${device.pairingLoading ? "disabled" : ""}>${device.pairingLoading ? "جاري إنشاء رمز الاقتران..." : "إنشاء رمز الاقتران"}</button>
              ${device.pairingError ? `<p class="status danger" data-pairing-error>${escapeHtml(device.pairingError)}</p>` : ""}
            </div>
            <div class="pair-code pairing-result">
              <span class="muted">رمز الاقتران</span>
              <strong>${isPendingPairing ? device.pairingCode : "لا يوجد رمز بعد"}</strong>
              <small class="muted">${isPendingPairing ? `ينتهي خلال 60 ثانية - صالح حتى ${device.pairingExpiresAt}` : "سيظهر الرمز بعد إدخال رقم صحيح"}</small>
              <button class="btn btn-secondary" data-action="copy-pairing" ${!isPendingPairing ? "disabled" : ""}>نسخ الرمز</button>
              <button class="btn btn-secondary" data-action="check-device-connection" ${!isPendingPairing && !isConnected ? "disabled" : ""}>فحص الاتصال</button>
              <ul class="check-list"><li>اختر الربط برقم الهاتف في واتساب إذا ظهر لك.</li><li>أدخل رمز الاقتران الظاهر هنا.</li><li>انتظر حتى تصبح الحالة متصل.</li></ul>
            </div>
          </div>`}
          ${isConnected ? `<div class="inline-actions"><button class="btn btn-secondary" data-action="send-device-test">إرسال رسالة اختبار</button><button class="btn btn-danger" data-action="disconnect-device">فصل الجهاز</button><button class="btn btn-ghost" data-action="delete-device">حذف الجهاز</button></div>` : ""}
        </div>
      </article>
      <aside class="card link-steps-card">
        ${isConnected ? `<div class="success-device-state"><span>✓</span><h2>حساب واتساب متصل بنجاح</h2><p class="muted">حسابك جاهز لإرسال تنبيهات وتجديدات العملاء.</p><ul class="check-list"><li>جاهز لإرسال الرسائل</li><li>استقبال وإدارة الردود</li><li>مزامنة جهات الاتصال</li><li>تتبع نشاط المحادثات</li></ul></div>` : `<h2>طريقة الربط</h2>${[["1", "افتح واتساب على هاتفك", "افتح تطبيق واتساب على هاتفك الذكي."], ["2", "الأجهزة المرتبطة", "اذهب إلى الإعدادات ثم اختر الأجهزة المرتبطة."], ["3", "امسح الباركود أو أدخل رمز الاقتران", "اربط الجهاز ثم انتظر اكتمال الاتصال."]].map(([num, title, body]) => `<div class="step-row"><span>${num}</span><strong>${title}</strong><p class="muted">${body}</p></div>`).join("")}`}
        <div class="secure-note">تأكد من إبقاء واتساب مفتوحًا أثناء عملية الربط حتى تكتمل بنجاح.</div>
      </aside>
    </section>
    <section class="linked-bottom-grid">
      <article class="card usage-card"><span class="mini-icon">${dashboardIcon("devices")}</span><h3>استخدام الأجهزة المرتبطة</h3><strong class="usage-count">${stats.connectedDevices} جهاز متصل</strong><div class="usage-bar"><span style="width:${isConnected ? 100 : 0}%"></span></div><p class="${isConnected ? "success-text" : "muted"}">${isConnected ? "تم ربط جهاز واتساب بنجاح" : "لم يتم ربط أي جهاز بعد"}</p></article>
      <article class="card table-card security-card"><span class="mini-icon">🛡</span><h3>ملاحظات الأمان</h3><ul class="check-list">${["الاتصال مشفر بالكامل بين منصتك وواتساب.", "لا يتم تخزين أو عرض أي رموز أو توكنات.", "عند انتهاء الجلسة، سيتم طلب إعادة الربط.", "أوقف أي جهاز غير معروف من إعدادات واتساب."].map((item) => `<li>${item}</li>`).join("")}</ul></article>
      <article class="card table-card linked-table-card"><h3>الأجهزة المرتبطة الأخيرة</h3>${isConnected ? connectedTable : `<div class="empty-device"><div class="empty-icon">🔗</div><strong>لا توجد أجهزة مرتبطة حتى الآن</strong><p class="muted">قم بربط واتساب لعرض الأجهزة المرتبطة وسجل النشاط.</p></div>`}</article>
      <article class="card table-card activity-card"><h3>النشاط الأخير</h3>${activity.length ? `<div class="activity-list">${activity.map((item) => `<div class="activity-item"><span class="activity-dot"></span><div><strong>${escapeHtml(item)}</strong><p class="muted">تم التحديث الآن</p></div></div>`).join("")}</div>` : emptyState("لا توجد نشاطات بعد", "ستظهر عمليات الربط والفحص هنا.")}</article>
    </section>
    <section class="section section-tight health-and-safety"><article class="card table-card number-health-card"><div class="section-head"><div><h3>${t("linkedDevices.health")}</h3><p class="muted">${t("linkedDevices.safeSending")}</p></div><span class="health-score">${health ? 100 - Number(health.risk || 0) : 0}/100</span></div>${health ? `<div class="health-metrics"><span><small>${t("linkedDevices.messagesToday")}</small><strong>${health.messagesToday || 0}</strong></span><span><small>${t("linkedDevices.messagesHour")}</small><strong>${health.messagesHour || 0}</strong></span><span><small>${t("linkedDevices.failureRate")}</small><strong>${health.failureRate || 0}%</strong></span><span><small>${t("linkedDevices.unsubscribeCount")}</small><strong>${health.unsubscribeCount || 0}</strong></span><span><small>${t("linkedDevices.riskScore")}</small><strong>${health.risk || 0}/100</strong></span></div><div class="secure-note"><strong>${t("linkedDevices.smartAdvice")}:</strong> ${escapeHtml(health.advice || "")}</div>` : emptyState("لا توجد نتيجة فحص بعد", "اربط الجهاز وافحص الاتصال لعرض مؤشرات الصحة.")}</article><article class="card table-card safe-mode-card"><h3>وضع الإرسال الآمن</h3>${stats.safeRules > 0 ? `<p><strong>${stats.safeRules}</strong> قواعد نشطة من قاعدة البيانات.</p><button class="btn btn-secondary" data-link="/dashboard/security">إدارة القواعد</button>` : emptyState("لا توجد قواعد إرسال آمن", "أضف قواعدك من صفحة الحماية.", "فتح الحماية", "/dashboard/security")}</article></section>`);
}

function devicesWorkspacePage() {
  const device = { ...defaultLinkedDevice, ...state.linkedDevice };
  const stats = overviewStats();
  const isConnected = device.status === "connected";
  const isPending = ["pending_pairing", "pending_qr", "connecting"].includes(device.status);
  const method = device.linkMethod || "pairing";
  const hasQr = isRealQrDataUri(device.qrBase64);
  const hasPairing = device.status === "pending_pairing" && Boolean(device.pairingCode);
  const lastCheck = device.lastCheckAt || (stats.lastDeviceCheck ? new Date(stats.lastDeviceCheck).toLocaleString("ar-SA") : "لم يتم الفحص بعد");
  const quality = isConnected ? "ممتاز" : "غير متاح";
  const deviceRows = isConnected || isPending ? [[
    `<strong>${escapeHtml(device.deviceName || (isConnected ? "جهاز واتساب متصل" : "جلسة ربط جديدة"))}</strong><small>جلسة ربط آمنة</small>`,
    escapeHtml(device.phoneNumber || device.phoneInput || "غير متوفر"), status(device.status), isConnected ? "ممتاز" : "بانتظار الربط", escapeHtml(lastCheck),
    `<div class="row-actions"><button class="icon-action" data-action="check-device-connection" title="فحص الاتصال">${dashboardIcon("reports")}</button>${isConnected ? `<button class="icon-action danger-text" data-action="disconnect-device" title="فصل الجهاز">×</button>` : ""}<button class="icon-action danger-text" data-action="delete-device" title="حذف الجهاز">⋮</button></div>`
  ]] : [];
  const qrPanel = `<div class="device-method-panel qr-method-panel">${hasQr ? `<button class="qr-display" data-action="show-device-qr"><img class="qr-real" src="${device.qrBase64}" alt="باركود ربط واتساب الحقيقي"><span>اضغط لتكبير الباركود</span></button>` : `<div class="device-empty-visual">${dashboardIcon("devices")}<strong>لا يوجد باركود جاهز</strong><p>${escapeHtml(device.qrError || "أنشئ باركودًا جديدًا للبدء.")}</p></div>`}<button class="btn btn-primary" data-action="create-device-qr" ${device.qrLoading ? "disabled" : ""}>${device.qrLoading ? "جاري إنشاء الباركود..." : "إنشاء/تحديث الباركود"}</button>${hasQr ? `<small>صالح حتى ${escapeHtml(device.qrExpiresAt || "وقت قصير")}</small>` : ""}</div>`;
  const pairingPanel = `<div class="device-method-panel pairing-method-panel"><label class="field"><span>رقم واتساب</span><input class="input" data-action="pairing-phone-input" value="${escapeHtml(device.phoneInput || "")}" placeholder="0551234567 أو 9665XXXXXXXX" inputmode="tel"></label><small>سيتم تحويل الرقم السعودي المحلي تلقائيًا إلى الصيغة الدولية.</small><button class="btn btn-primary" data-action="create-pairing-code" ${device.pairingLoading ? "disabled" : ""}>${device.pairingLoading ? "جاري إنشاء الرمز..." : "إنشاء رمز الاقتران"}</button>${device.pairingError ? `<p class="status danger">${escapeHtml(device.pairingError)}</p>` : ""}${hasPairing ? `<div class="pairing-success"><span class="status success">تم الإنشاء بنجاح</span><div class="pairing-code-row"><strong>${escapeHtml(device.pairingCode)}</strong><button class="btn btn-secondary" data-action="copy-pairing">نسخ</button></div><small>صالح حتى ${escapeHtml(device.pairingExpiresAt || "وقت قصير")}</small><p>افتح واتساب ← الإعدادات ← الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف، ثم أدخل الرمز.</p></div>` : `<div class="device-empty-visual compact">${dashboardIcon("template")}<strong>سيظهر رمز الاقتران الحقيقي هنا</strong><p>لن تعرض المنصة أي رمز غير صالح أو مُنشأ محليًا.</p></div>`}</div>`;
  return dashboardShell(`${pageTitle("الأجهزة المرتبطة", `<button class="btn btn-secondary" data-action="check-device-connection" ${!device.instanceId ? "disabled" : ""}>${dashboardIcon("reports")} فحص الاتصال</button>`)}
    <p class="page-kicker">إدارة أجهزة واتساب المرتبطة بحسابك ومراقبة حالة الاتصال في الوقت الفعلي.</p>
    ${statGrid([
      { title: "الأجهزة المتصلة", value: stats.connectedDevices, caption: "أجهزة متصلة الآن", tone: isConnected ? "success" : "neutral", icon: "devices" },
      { title: "بانتظار الربط", value: stats.pendingDevices, caption: "جلسات فعلية", tone: "warning", icon: "template" },
      { title: "جودة الاتصال", value: quality, caption: isConnected ? "واتساب متصل" : "اربط جهازًا للقياس", tone: isConnected ? "success" : "neutral", icon: "reports" },
      { title: "آخر فحص", value: lastCheck, caption: "حالة القناة الحالية", tone: "info", icon: "security" }
    ])}
    <section class="section devices-workspace"><article class="card devices-table-card"><div class="section-head"><div><h2>الأجهزة المرتبطة</h2><p>تظهر هنا القناة الفعلية الخاصة بمساحة عملك فقط.</p></div><button class="btn btn-secondary" data-action="check-device-connection" ${!device.instanceId ? "disabled" : ""}>فحص الاتصال</button></div>${deviceRows.length ? simpleTable(["اسم النسخة", "رقم الهاتف", "الحالة", "جودة الاتصال", "آخر مزامنة", "الإجراء"], deviceRows) : emptyState("لا توجد أجهزة مرتبطة", "ابدأ بإنشاء رمز اقتران أو باركود من اللوحة المجاورة.")}</article>
      <aside class="card device-link-card"><div class="section-head"><div><h2>ربط جهاز جديد</h2><p>اختر طريقة الربط المناسبة لك.</p></div>${dashboardIcon("devices")}</div><span class="field-label">طريقة الربط</span><div class="segmented device-method-tabs"><button class="${method === "pairing" ? "active" : ""}" data-action="device-link-method" data-method="pairing">${dashboardIcon("template")} الربط عبر رمز الاقتران</button><button class="${method === "qr" ? "active" : ""}" data-action="device-link-method" data-method="qr">${dashboardIcon("devices")} الربط عبر الباركود</button></div>${method === "pairing" ? pairingPanel : qrPanel}<div class="device-card-actions">${isConnected ? `<button class="btn btn-secondary" data-action="send-device-test">إرسال رسالة اختبار</button><button class="btn btn-danger" data-action="disconnect-device">فصل الجهاز</button>` : `<button class="btn btn-secondary" data-action="check-device-connection" ${!isPending ? "disabled" : ""}>فحص حالة الربط</button>`}</div></aside>
    </section>`);
}

const localDefaultEmailTemplate = {
  name: "تذكير بتجديد الاشتراك",
  channel: "email",
  storeName: "متجر النجاح",
  title: "تذكير بتجديد اشتراكك في {{اسم_الخدمة}}",
  themeColor: "#0EA5A8",
  body: "مرحبًا {{اسم_العميل}}،\n\nنود تذكيرك بأن اشتراكك في {{اسم_الخدمة}} سينتهي بتاريخ {{تاريخ_الانتهاء}}.\n\nلضمان استمرار الخدمة دون انقطاع، يرجى تجديد اشتراكك الآن.",
  buttonLabel: "جدد اشتراكك الآن",
  footerText: "شكرًا لثقتك بنا"
};

function safeEmailTheme(value) {
  return /^#[0-9A-F]{6}$/i.test(String(value || "")) ? String(value).toUpperCase() : "#0EA5A8";
}

function sampleEmailValue(value) {
  const samples = {
    اسم_العميل: "أحمد محمد",
    اسم_الخدمة: "الباقة الاحترافية",
    تاريخ_الانتهاء: new Intl.DateTimeFormat("ar-SA").format(new Date(Date.now() + 7 * 86400000)),
    الأيام_المتبقية: "7",
    رابط_التجديد: "https://renvix.app/renew/test",
    رقم_الطلب: "RVX-1024",
    اسم_المتجر: "متجر النجاح"
  };
  return String(value || "").replace(/{{\s*([^{}]+?)\s*}}/g, (match, name) => samples[name] ?? match);
}

function emailTemplatePreview(template) {
  const theme = safeEmailTheme(template.themeColor);
  const storeName = sampleEmailValue(template.storeName || localDefaultEmailTemplate.storeName);
  const subject = sampleEmailValue(template.title || localDefaultEmailTemplate.title);
  const content = sampleEmailValue(template.body || localDefaultEmailTemplate.body);
  const buttonLabel = sampleEmailValue(template.buttonLabel || localDefaultEmailTemplate.buttonLabel);
  const footerText = sampleEmailValue(template.footerText || localDefaultEmailTemplate.footerText);
  const paragraphs = content.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean).map((item) => `<p>${escapeHtml(item).replaceAll("\n", "<br>")}</p>`).join("");
  return `<div class="email-envelope" style="--email-theme:${theme}">
    <div class="email-preview-brand"><span class="email-store-icon">⌑</span><strong>${escapeHtml(storeName)}</strong><small>حلول رقمية متكاملة</small></div>
    <div class="email-preview-body"><h3>${escapeHtml(subject)}</h3>${paragraphs}<a href="#" tabindex="-1">${escapeHtml(buttonLabel)}</a><div class="email-trust-note">♢ بياناتك محمية وتُستخدم لاستمرارية الخدمة والدعم الكامل.</div><p class="email-thanks">${escapeHtml(footerText)} ♡</p></div>
    <div class="email-preview-footer">© ${new Date().getFullYear()} ${escapeHtml(storeName)}. جميع الحقوق محفوظة.</div>
  </div>`;
}

function readEmailTemplateForm(form = document.querySelector("form[data-submit='renewal-template']")) {
  if (!form) return { ...localDefaultEmailTemplate };
  const data = Object.fromEntries(new FormData(form));
  return {
    name: data.name || "",
    channel: "email",
    storeName: data.storeName || "",
    title: data.title || "",
    themeColor: safeEmailTheme(data.themeColor),
    body: data.body || "",
    buttonLabel: data.buttonLabel || "",
    footerText: data.footerText || "",
    daysOffset: Number(data.daysOffset || 7),
    isActive: data.isActive === "on"
  };
}

function refreshEmailTemplatePreview() {
  const preview = document.querySelector("[data-email-preview]");
  if (preview) preview.innerHTML = emailTemplatePreview(readEmailTemplateForm());
}

function renewalTemplatePage() {
  const payload = state.notificationTemplate || {};
  const templates = Array.isArray(payload.templates) ? payload.templates : (payload.template ? [payload.template] : []);
  const rules = Array.isArray(payload.rules) ? payload.rules : (payload.rule ? [payload.rule] : []);
  const channel = state.templateChannel || payload.template?.channel || "whatsapp";
  const defaults = { ...localDefaultEmailTemplate, ...(payload.defaultEmailTemplate || {}) };
  const storedTemplate = templates.find((item) => item.channel === channel);
  const template = channel === "email" ? { ...defaults, ...(storedTemplate || {}) } : (storedTemplate || {});
  const rule = rules.find((item) => item.templateId === template.id || item.channel === channel) || {};
  const body = template.body || "";
  const isWhatsappReady = overviewStats().connectedDevices > 0;
  const channelSelect = `<label class="field"><span>قناة الإرسال</span><select class="select" name="channel" data-action="template-channel"><option value="whatsapp" ${channel === "whatsapp" ? "selected" : ""}>واتساب</option><option value="email" ${channel === "email" ? "selected" : ""}>البريد الإلكتروني</option><option value="sms" disabled>الرسائل النصية SMS — قريبًا</option></select></label>`;

  if (channel === "whatsapp") {
    const preview = body ? escapeHtml(body).replaceAll("\n", "<br>") : `<div class="template-empty"><strong>لا يوجد محتوى محفوظ بعد</strong><p>اكتب رسالة التجديد ثم احفظ القالب لتظهر المعاينة هنا.</p></div>`;
    return dashboardShell(`${pageTitle("قالب رسالة التجديد")}
      <p class="page-kicker">أنشئ وخصص رسالة التجديد التي سيتم إرسالها للعملاء قبل انتهاء اشتراكاتهم.</p>
      <section class="template-workspace"><article class="card template-editor-card"><div class="section-head"><div><h2>محتوى الرسالة</h2><p>محرر محتوى الرسالة باستخدام المتغيرات الذكية.</p></div>${dashboardIcon("template")}</div><form data-submit="renewal-template" class="grid">
        <div class="template-meta-grid"><label class="field"><span>اسم القالب</span><input class="input" name="name" value="${escapeHtml(template.name || "")}" placeholder="مثال: تذكير قبل التجديد"></label>${channelSelect}</div>
        <div class="editor-toolbar"><button type="button" title="تراجع">↶</button><button type="button" title="إعادة">↷</button><button type="button"><b>B</b></button><button type="button"><i>I</i></button><button type="button"><u>U</u></button><span>النص</span></div><textarea class="textarea template-editor" name="body" data-action="template-body" placeholder="اكتب رسالة التجديد هنا...">${escapeHtml(body)}</textarea><div class="variables-row"><span>المتغيرات المتاحة</span>${["{{customer_name}}", "{{service_name}}", "{{end_date}}", "{{renewal_link}}"].map((item) => `<button type="button" class="chip" data-action="insert-template-variable" data-variable="${item}">${item}</button>`).join("")}</div>
        <div class="template-settings"><label class="field"><span>موعد الإرسال</span><select class="select" name="daysOffset"><option value="7" ${Number(rule.daysOffset || 7) === 7 ? "selected" : ""}>قبل انتهاء الاشتراك بـ7 أيام</option><option value="3" ${Number(rule.daysOffset) === 3 ? "selected" : ""}>قبل انتهاء الاشتراك بـ3 أيام</option><option value="1" ${Number(rule.daysOffset) === 1 ? "selected" : ""}>قبل انتهاء الاشتراك بيوم</option></select></label><label class="setting-row setting-toggle"><span>تفعيل القالب</span><input type="checkbox" name="isActive" ${template.isActive !== false ? "checked" : ""}></label></div>
        <div class="template-actions"><button class="btn btn-primary">حفظ القالب</button><button type="button" class="btn btn-secondary" data-action="test-template" ${!isWhatsappReady ? "disabled title=\"اربط جهازًا أولًا حتى تتمكن من إرسال رسالة تجريبية.\"" : ""}>إرسال رسالة تجريبية</button></div></form></article>
        <aside class="template-side"><article class="card template-preview-card"><div class="section-head"><h2>معاينة الرسالة</h2>${dashboardIcon("reports")}</div><div class="whatsapp-preview"><span class="preview-day">اليوم</span><div class="message-bubble">${preview}<small>10:30 ✓✓</small></div></div><p class="preview-note">هذه معاينة تقريبية، وقد يختلف مظهر الرسالة حسب قناة الإرسال.</p></article><article class="card"><h2>إعدادات الإرسال</h2><p>القناة الحالية: <strong>واتساب</strong></p><p class="muted">لن ترسل المنصة أي رسالة تلقائيًا ما لم يكن القالب مفعلاً والقناة جاهزة.</p></article></aside>
      </section>`);
  }

  const colors = ["#0EA5A8", "#2563EB", "#7C3AED", "#22C55E", "#F97316", "#64748B"];
  const variables = ["{{اسم_العميل}}", "{{اسم_الخدمة}}", "{{تاريخ_الانتهاء}}", "{{الأيام_المتبقية}}", "{{رابط_التجديد}}", "{{رقم_الطلب}}", "{{اسم_المتجر}}"];
  return dashboardShell(`${pageTitle("قالب رسالة التجديد")}
    <p class="page-kicker">خصص رسالة البريد التي ستصل للعميل قبل انتهاء اشتراكه، من داخل صفحة القالب الحالية.</p>
    <section class="email-template-layout">
      <article class="card template-editor-card email-template-editor"><div class="section-head"><div><h2>محتوى الرسالة</h2><p>محرر بريد آمن مع متغيرات معتمدة ومعاينة مطابقة للقالب المرسل.</p></div>${dashboardIcon("template")}</div>
        <form data-submit="renewal-template" class="grid">
          <div class="email-template-meta"><label class="field"><span>اسم القالب</span><input class="input" name="name" value="${escapeHtml(template.name)}" required></label><label class="field"><span>اسم المتجر</span><input class="input" name="storeName" data-email-field value="${escapeHtml(template.storeName)}" required></label>${channelSelect}</div>
          <label class="field"><span>عنوان البريد</span><input class="input" name="title" data-email-field value="${escapeHtml(template.title)}" required></label>
          <div class="email-theme-row"><span>لون القالب</span><input type="hidden" name="themeColor" value="${safeEmailTheme(template.themeColor)}">${colors.map((color) => `<button type="button" class="email-color ${safeEmailTheme(template.themeColor) === color ? "active" : ""}" style="--swatch:${color}" data-action="template-theme" data-color="${color}" aria-label="اختيار اللون ${color}"></button>`).join("")}<label class="email-custom-color" title="لون مخصص">✎<input type="color" value="${safeEmailTheme(template.themeColor)}" data-action="template-custom-theme"></label></div>
          <div class="editor-toolbar"><button type="button" title="تراجع">↶</button><button type="button" title="إعادة">↷</button><button type="button"><b>B</b></button><button type="button"><i>I</i></button><button type="button"><u>U</u></button><span>نص آمن</span></div>
          <textarea class="textarea template-editor email-content-editor" name="body" data-email-field placeholder="اكتب محتوى رسالة التجديد..." required>${escapeHtml(template.body)}</textarea>
          <div class="variables-row email-variables"><span>المتغيرات المتاحة</span>${variables.map((item) => `<button type="button" class="chip" data-action="insert-template-variable" data-variable="${item}">${item}</button>`).join("")}</div>
          <div class="template-meta-grid"><label class="field"><span>نص زر التجديد</span><input class="input" name="buttonLabel" data-email-field value="${escapeHtml(template.buttonLabel)}" required></label><label class="field"><span>النص الختامي</span><input class="input" name="footerText" data-email-field value="${escapeHtml(template.footerText)}" required></label></div>
          <div class="template-settings"><label class="field"><span>موعد الإرسال</span><select class="select" name="daysOffset"><option value="7" ${Number(rule.daysOffset || 7) === 7 ? "selected" : ""}>قبل انتهاء الاشتراك بـ7 أيام</option><option value="3" ${Number(rule.daysOffset) === 3 ? "selected" : ""}>قبل انتهاء الاشتراك بـ3 أيام</option><option value="1" ${Number(rule.daysOffset) === 1 ? "selected" : ""}>قبل انتهاء الاشتراك بيوم</option></select></label><label class="setting-row setting-toggle"><span>تفعيل القالب</span><input type="checkbox" name="isActive" ${template.isActive !== false ? "checked" : ""}></label></div>
          <div class="email-template-actions"><button class="btn btn-primary">حفظ القالب ✓</button><button type="button" class="btn btn-secondary" data-action="test-template">إرسال رسالة تجريبية</button><button type="button" class="btn btn-secondary" data-action="preview-email-template">معاينة</button><button type="button" class="btn btn-ghost" data-action="restore-email-template">استعادة الافتراضي</button></div>
        </form>
      </article>
      <aside class="template-side email-preview-side"><article class="card template-preview-card"><div class="section-head"><div><h2>معاينة القالب</h2><p>هذه معاينة تقريبية لما سيصل إلى البريد الإلكتروني.</p></div>${dashboardIcon("reports")}</div><div class="email-header-preview"><span>من: <b>Renvix &lt;noreply@notify.renvix.app&gt;</b></span><span>الرد إلى: <b>support@renvix.app</b></span></div><div data-email-preview>${emailTemplatePreview(template)}</div></article><article class="card email-safety-card"><strong>إرسال آمن وموثوق</strong><p>يُثبّت عنوان المرسل والرد من الخادم، ويُمنع HTML والسكربتات والروابط غير الآمنة.</p></article></aside>
    </section>`);
}

const orderLinkStyleOptions = [
  ["classic", "كلاسيكي"], ["modern", "حديث"], ["professional", "احترافي"],
  ["minimal", "بسيط"], ["premium", "فاخر"], ["colorful", "ملون"]
];
const orderLinkColorOptions = [
  ["#2563EB", "أزرق"], ["#06B6D4", "تركواز"], ["#8B5CF6", "بنفسجي"], ["#22C55E", "أخضر"],
  ["#F97316", "برتقالي"], ["#EF4444", "أحمر"], ["#64748B", "رمادي"], ["#0F172A", "كحلي"]
];

function safeOrderLinkColor(value) {
  return /^#[0-9A-F]{6}$/i.test(String(value || "")) ? String(value).toUpperCase() : "#2563EB";
}

function todayDateInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function hydrateOrderLinkDraft() {
  const profile = state.orderLinkProfile;
  if (!profile || profile.error || state.orderLinkDraft.hydrated) return;
  const templates = Array.isArray(state.orderLinkTemplates) ? state.orderLinkTemplates : [];
  const defaultTemplate = templates.find((item) => item.isDefault) || templates[0];
  state.orderLinkDraft = {
    ...state.orderLinkDraft,
    hydrated: true,
    storeName: defaultTemplate?.storeName || profile.storeName || "",
    slug: profile.slug || "",
    style: defaultTemplate?.style || profile.defaultTemplateStyle || "classic",
    themeColor: safeOrderLinkColor(defaultTemplate?.themeColor || profile.defaultThemeColor),
    templateId: defaultTemplate?.id || "",
    templateName: defaultTemplate?.name || "",
    publicUrl: defaultTemplate?.publicUrl || "",
    templateLinkId: defaultTemplate?.templateLinkId || "",
    manualStartDate: state.orderLinkDraft.manualStartDate || todayDateInputValue(),
    headerText: defaultTemplate?.headerText || "شكرًا لاختيارك خدماتنا",
    footerText: defaultTemplate?.footerText || "Renvix",
    additionalNotes: Array.isArray(defaultTemplate?.additionalNotes) ? [...defaultTemplate.additionalNotes] : [],
    visibleFields: { ...state.orderLinkDraft.visibleFields, ...(defaultTemplate?.visibleFields || {}) },
    isDefault: defaultTemplate?.isDefault ?? true
  };
}

function clientRemaining(endDate) {
  if (!endDate) return { days: 0, state: "expired", label: "غير متوفر" };
  const end = new Date(`${String(endDate).slice(0, 10)}T23:59:59`);
  const now = new Date();
  const days = Math.ceil((end - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  if (days < 0) return { days, state: "expired", label: "انتهى الاشتراك" };
  if (days === 0) return { days: 0, state: "today", label: "ينتهي اليوم" };
  return { days, state: "remaining", label: `باقي ${days} يومًا` };
}

function inferredSubscriptionStatus(startDate, endDate) {
  if (!startDate || !endDate) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
  const end = new Date(`${String(endDate).slice(0, 10)}T23:59:59`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return "";
  if (end < today) return "expired";
  const remaining = Math.ceil((end - today) / 86400000);
  return remaining <= 7 ? "expiring_soon" : "active";
}

function orderLinkPreviewOrder(subscriptions = [], customers = []) {
  const draft = state.orderLinkDraft;
  const selected = subscriptions.find((item) => item.id === draft.subscriptionId);
  if (selected) return selected;
  if (draft.sourceMode === "manual") {
    const customer = customers.find((item) => item.id === draft.customerId);
    if (customer || draft.manualPlanName || draft.manualStartDate || draft.manualEndDate) {
      return {
        orderNumber: draft.manualOrderNumber || "سيُنشأ تلقائيًا",
        customerName: customer?.name || "اسم العميل",
        planName: draft.manualPlanName || "اسم الباقة",
        serviceName: draft.manualServiceName || "اسم الخدمة",
        startDate: draft.manualStartDate,
        endDate: draft.manualEndDate,
        status: inferredSubscriptionStatus(draft.manualStartDate, draft.manualEndDate) || "غير مكتمل",
        isDraftPreview: true
      };
    }
  }
  return {
    orderNumber: "رقم الطلب",
    customerName: "اسم العميل",
    planName: "اسم الباقة",
    serviceName: "اسم الخدمة",
    status: "معاينة",
    isPlaceholder: true
  };
}

function orderInfoPreviewCard(subscription, draft, publicData = null) {
  const order = publicData?.order || subscription;
  const store = publicData?.store || { name: draft.storeName };
  const template = publicData?.template || draft;
  if (!order) return emptyState("لا توجد معاينة بعد", "اختر اشتراكًا أو أدخل معلومات الطلب يدويًا.");
  const remaining = publicData?.order?.remaining || clientRemaining(order.endDate);
  const themeColor = safeOrderLinkColor(template.themeColor);
  const visible = template.visibleFields || draft.visibleFields || {};
  const notes = Array.isArray(template.additionalNotes) ? template.additionalNotes : [];
  const orderNumber = order.orderNumber || "";
  const customerName = order.customerName || "";
  const planName = order.planName || "";
  const startDate = order.startDate ? new Date(order.startDate).toLocaleDateString("ar-SA") : "";
  const endDate = order.endDate ? new Date(order.endDate).toLocaleDateString("ar-SA") : "";
  const subscriptionStatus = order.status === "active" ? "نشط" : order.status === "expiring_soon" ? "ينتهي قريبًا" : order.status === "expired" ? "منتهي" : order.status || "غير محدد";
  return `<article class="order-customer-card order-style-${escapeHtml(template.style || "classic")} ${order.isPlaceholder ? "is-placeholder" : ""}" style="--order-theme:${themeColor}">
    <div class="order-card-accent"></div>
    <div class="order-card-brand"><span class="order-bag">${dashboardIcon("orderLink")}</span><div><h2>${escapeHtml(store.name || draft.storeName || "المتجر")}</h2><p>${escapeHtml(template.headerText || "معلومات طلبك")}</p></div></div>
    <div class="order-number-row"><span>رقم الطلب</span><strong>#${escapeHtml(orderNumber)}</strong>${status(subscriptionStatus)}</div>
    <div class="order-information-grid">
      ${visible.customerName !== false ? `<div>${dashboardIcon("customers")}<span>اسم العميل</span><strong>${escapeHtml(customerName)}</strong></div>` : ""}
      ${visible.status !== false ? `<div>${dashboardIcon("security")}<span>حالة الاشتراك</span><strong>${escapeHtml(subscriptionStatus)}</strong></div>` : ""}
      ${visible.remainingDays !== false ? `<div class="remaining-field">${dashboardIcon("template")}<span>المدة المتبقية</span><strong>${escapeHtml(remaining.label || (remaining.state === "today" ? "ينتهي اليوم" : remaining.state === "expired" ? "انتهى الاشتراك" : `باقي ${remaining.days} يومًا`))}</strong></div>` : ""}
      ${visible.startDate !== false ? `<div>${dashboardIcon("template")}<span>تاريخ البداية</span><strong>${escapeHtml(startDate)}</strong></div>` : ""}
      ${visible.endDate !== false ? `<div>${dashboardIcon("template")}<span>تاريخ النهاية</span><strong>${escapeHtml(endDate)}</strong></div>` : ""}
      ${visible.planName !== false ? `<div>${dashboardIcon("subscriptions")}<span>اسم الخطة</span><strong>${escapeHtml(planName)}</strong></div>` : ""}
      ${visible.storeName !== false ? `<div>${dashboardIcon("home")}<span>اسم المتجر</span><strong>${escapeHtml(store.name || "")}</strong></div>` : ""}
      ${order.maskedPhone ? `<div>${dashboardIcon("devices")}<span>رقم التواصل</span><strong dir="ltr">${escapeHtml(order.maskedPhone)}</strong></div>` : ""}
    </div>
    ${visible.additionalNotes !== false && notes.length ? `<div class="order-notes"><h3>${dashboardIcon("template")} ملاحظات إضافية</h3><ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul></div>` : ""}
    ${template.footerText ? `<p class="order-card-footer">${escapeHtml(template.footerText)}</p>` : ""}
  </article>`;
}

function orderLookupPreviewCard(draft) {
  const themeColor = safeOrderLinkColor(draft.themeColor);
  const storeName = draft.storeName?.trim() || "اسم متجرك";
  return `<article class="order-lookup-preview order-style-${escapeHtml(draft.style || "classic")}" style="--order-theme:${themeColor}">
    <div class="order-lookup-accent"></div>
    <div class="order-lookup-brand"><span class="order-bag">${dashboardIcon("orderLink")}</span><div><h2>${escapeHtml(storeName)}</h2><p>مرحبًا بك في صفحة متابعة طلبك</p></div></div>
    <div class="order-lookup-content">
      <span class="order-lookup-icon">${dashboardIcon("subscriptions")}</span>
      <h3>أدخل رقم الطلب</h3>
      <p>اكتب رقم طلبك لعرض حالة الاشتراك ومدته ومعلومات الباقة.</p>
      <label><span>رقم الطلب</span><div class="order-lookup-input"><input value="" placeholder="مثال: 54981" readonly aria-label="معاينة حقل رقم الطلب">${dashboardIcon("orderLink")}</div></label>
      <button class="btn btn-primary order-themed-action" type="button" data-action="order-preview-show-result">عرض معلومات الطلب ${dashboardIcon("reports")}</button>
      <small>${dashboardIcon("security")} بياناتك آمنة ولا تظهر إلا عبر رابط المتجر الخاص.</small>
    </div>
    <p class="order-card-footer">${escapeHtml(draft.footerText || "Renvix")}</p>
  </article>`;
}

function publicOrderLookupCard(presentation, orderNumber = "") {
  const store = presentation?.store || {};
  const template = presentation?.template || {};
  const themeColor = safeOrderLinkColor(template.themeColor);
  return `<article class="order-lookup-preview public-order-lookup-card order-style-${escapeHtml(template.style || "classic")}" style="--order-theme:${themeColor}">
    <div class="order-lookup-accent"></div>
    <div class="order-lookup-brand"><span class="order-bag">${dashboardIcon("orderLink")}</span><div><h2>${escapeHtml(store.name || "معلومات الطلب")}</h2><p>${escapeHtml(template.headerText || "مرحبًا بك في صفحة متابعة طلبك")}</p></div></div>
    <form class="order-lookup-content" data-submit="public-order-search">
      <span class="order-lookup-icon">${dashboardIcon("subscriptions")}</span>
      <h3>أدخل رقم الطلب</h3>
      <p>اكتب رقم طلبك لعرض حالة الاشتراك ومدته ومعلومات الباقة.</p>
      <label><span>رقم الطلب</span><div class="order-lookup-input"><input name="orderNumber" value="${escapeHtml(orderNumber)}" placeholder="مثال: 54981" inputmode="text" autocomplete="off" required>${dashboardIcon("orderLink")}</div></label>
      <button class="btn btn-primary order-themed-action" type="submit">عرض معلومات الطلب ${dashboardIcon("reports")}</button>
      <small>${dashboardIcon("security")} بياناتك آمنة ولا تظهر إلا عبر رابط المتجر الخاص.</small>
    </form>
    <p class="order-card-footer">${escapeHtml(template.footerText || "Renvix")}</p>
  </article>`;
}

function orderLinkPreviewSlides(subscription, draft) {
  const activeSlide = Number(state.orderLinkPreviewSlide || 0) === 1 ? 1 : 0;
  return `<div class="order-preview-carousel" data-active-slide="${activeSlide}">
    <div class="order-preview-toolbar" aria-label="التنقل بين المعاينات">
      <button type="button" class="order-preview-arrow" data-action="order-preview-step" data-direction="-1" ${activeSlide === 0 ? "disabled" : ""} title="المعاينة السابقة">‹</button>
      <div class="order-preview-tabs" role="tablist">
        <button type="button" class="${activeSlide === 0 ? "active" : ""}" data-action="order-preview-slide" data-value="0"><b>1</b><span>صفحة إدخال الطلب</span></button>
        <button type="button" class="${activeSlide === 1 ? "active" : ""}" data-action="order-preview-slide" data-value="1"><b>2</b><span>معلومات الطلب</span></button>
      </div>
      <button type="button" class="order-preview-arrow" data-action="order-preview-step" data-direction="1" ${activeSlide === 1 ? "disabled" : ""} title="المعاينة التالية">›</button>
    </div>
    <div class="order-preview-viewport">
      <section class="order-preview-slide ${activeSlide === 0 ? "active" : ""}" aria-hidden="${activeSlide !== 0}">${orderLookupPreviewCard(draft)}</section>
      <section class="order-preview-slide ${activeSlide === 1 ? "active" : ""}" aria-hidden="${activeSlide !== 1}">${orderInfoPreviewCard(subscription, draft)}</section>
    </div>
  </div>`;
}

function orderLinksWorkspacePage() {
  hydrateOrderLinkDraft();
  const profile = state.orderLinkProfile || {};
  const templates = Array.isArray(state.orderLinkTemplates) ? state.orderLinkTemplates : [];
  const subscriptions = Array.isArray(state.orderLinkSubscriptions) ? state.orderLinkSubscriptions : [];
  const customers = Array.isArray(state.dbCustomers) ? state.dbCustomers : [];
  const linksPayload = state.orderLinks && !Array.isArray(state.orderLinks) ? state.orderLinks : {};
  const links = Array.isArray(linksPayload.items) ? linksPayload.items : [];
  const stats = linksPayload.stats || { activeTemplates: 0, sentLinks: 0, openedLinks: 0, todayRequests: 0, openRate: 0 };
  const draft = state.orderLinkDraft;
  const selected = orderLinkPreviewOrder(subscriptions, customers);
  const selectedCustomerSubscriptions = draft.customerId ? subscriptions.filter((item) => item.customerId === draft.customerId) : subscriptions;
  const manualDatesValid = Boolean(
    draft.customerId && draft.manualServiceName?.trim() && draft.manualPlanName?.trim() &&
    draft.manualStartDate && draft.manualEndDate && inferredSubscriptionStatus(draft.manualStartDate, draft.manualEndDate)
  );
  const canCreate = draft.sourceMode === "manual" ? manualDatesValid : Boolean(subscriptions.find((item) => item.id === draft.subscriptionId));
  const publicUrl = draft.publicUrl || templates.find((item) => item.id === draft.templateId)?.publicUrl || "";
  const templateRows = templates.map((item) => [
    `<strong>${escapeHtml(item.name)}</strong>`,
    escapeHtml(orderLinkStyleOptions.find(([value]) => value === item.style)?.[1] || item.style),
    `<span class="color-dot" style="background:${safeOrderLinkColor(item.themeColor)}"></span>`,
    escapeHtml(item.storeName),
    item.isDefault ? status("نشط") : "—",
    escapeHtml(item.updatedAt ? new Date(item.updatedAt).toLocaleString("ar-SA") : "—"),
    `<div class="row-actions"><button class="btn btn-ghost" data-action="load-order-template" data-id="${item.id}">تعديل</button><button class="btn btn-ghost" data-action="duplicate-order-template" data-id="${item.id}">نسخ</button><button class="btn btn-ghost danger-text" data-action="delete-order-template" data-id="${item.id}">حذف</button></div>`
  ]);
  const linkRows = links.map((item) => [
    `<button class="order-number-copy" data-action="copy-order-number" data-value="${escapeHtml(item.orderNumber)}" title="نسخ رقم الطلب"><strong>#${escapeHtml(item.orderNumber)}</strong>${dashboardIcon("orderLink")}</button>`,
    escapeHtml(item.customerName || "—"),
    escapeHtml(item.templateName || "بدون قالب"),
    `<span class="color-dot" style="background:${safeOrderLinkColor(item.themeColor)}"></span>`,
    escapeHtml(item.sendMethod || "copy"),
    status(item.status),
    Number(item.openedCount || 0),
    escapeHtml(item.lastOpenedAt ? new Date(item.lastOpenedAt).toLocaleString("ar-SA") : "—"),
    escapeHtml(item.createdAt ? new Date(item.createdAt).toLocaleString("ar-SA") : "—"),
    `<div class="row-actions"><button class="icon-action" data-action="copy-order-link" data-id="${item.id}" data-url="${escapeHtml(item.publicUrl)}" title="نسخ">⧉</button><button class="icon-action" data-action="preview-order-link" data-url="${escapeHtml(item.publicUrl)}" title="معاينة">◉</button><button class="icon-action" data-action="send-order-link" data-id="${item.id}" title="إرسال">↗</button><button class="icon-action" data-action="archive-order-link" data-id="${item.id}" title="أرشفة">□</button><button class="icon-action danger-text" data-action="disable-order-link" data-id="${item.id}" title="تعطيل">×</button><button class="icon-action danger-text" data-action="delete-order-link" data-id="${item.id}" title="حذف">⌫</button></div>`
  ]);
  return dashboardShell(`${pageTitle("إرسال معلومات الطلب")}
    ${statGrid([
      { title: "القوالب النشطة", value: stats.activeTemplates || 0, caption: "قالب", tone: "purple", icon: "template" },
      { title: "روابط القوالب", value: stats.sentLinks || 0, caption: "رابط ثابت", tone: "info", icon: "orderLink" },
      { title: "القوالب المفتوحة", value: stats.openedLinks || 0, caption: "قالب", tone: "success", icon: "reports" },
      { title: "طلبات اليوم", value: stats.todayRequests || 0, caption: "استعلام", tone: "warning", icon: "template" },
      { title: "نسبة الفتح", value: `${stats.openRate || 0}%`, caption: "من الروابط", tone: "info", icon: "reports" }
    ])}
    <section class="order-link-workspace section">
      <article class="card order-link-builder">
        <div class="section-head"><div><h2>إعداد القالب والرابط</h2><p>اختر طلبًا حقيقيًا وخصص صفحة المعلومات التي يراها العميل.</p></div>${dashboardIcon("orderLink")}</div>
        <form data-submit="order-link-template" class="order-link-form">
          <div class="order-source-picker" role="tablist" aria-label="مصدر معلومات الطلب">
            <button type="button" class="${draft.sourceMode === "existing" ? "active" : ""}" data-action="order-source-mode" data-value="existing">اشتراك موجود</button>
            <button type="button" class="${draft.sourceMode === "customer" ? "active" : ""}" data-action="order-source-mode" data-value="customer">اختيار حسب العميل</button>
            <button type="button" class="${draft.sourceMode === "manual" ? "active" : ""}" data-action="order-source-mode" data-value="manual">إضافة يدوية</button>
          </div>
          <div class="order-profile-grid">
            <label class="field"><span>اسم القالب</span><input class="input" name="templateName" data-order-field="templateName" value="${escapeHtml(draft.templateName)}" placeholder="قالب معلومات الطلب"></label>
            <label class="field"><span>اسم المتجر</span><input class="input" name="storeName" data-order-field="storeName" value="${escapeHtml(draft.storeName)}" required></label>
            <label class="field"><span>رابط المتجر المخصص</span><div class="slug-input"><span>/o/</span><input class="input" name="slug" data-order-field="slug" value="${escapeHtml(draft.slug || profile.slug || "")}" pattern="[a-z0-9-]+"></div><small>حروف إنجليزية صغيرة وأرقام وشرطات فقط.</small></label>
            ${draft.sourceMode === "existing" ? `<label class="field"><span>اختيار الطلب / الاشتراك</span><select class="select" name="subscriptionId" data-order-field="subscriptionId"><option value="">اختر اشتراكًا حقيقيًا</option>${subscriptions.map((item) => `<option value="${item.id}" ${item.id === draft.subscriptionId ? "selected" : ""}>#${escapeHtml(item.orderNumber)} · ${escapeHtml(item.customerName)} · ${escapeHtml(item.planName)}</option>`).join("")}</select></label>` : ""}
            ${draft.sourceMode !== "existing" ? `<label class="field"><span>اختيار العميل</span><select class="select" name="customerId" data-order-field="customerId"><option value="">اختر عميلًا من قاعدة البيانات</option>${customers.map((item) => `<option value="${item.id}" ${item.id === draft.customerId ? "selected" : ""}>${escapeHtml(item.name)}${item.phone ? ` · ${escapeHtml(item.phone)}` : ""}</option>`).join("")}</select><small>${customers.length ? "اختر العميل الذي سيظهر في صفحة الطلب." : "لا يوجد عملاء بعد. أضف العميل أولًا ثم أكمل."}</small></label>` : ""}
            ${draft.sourceMode === "customer" ? `<label class="field"><span>اشتراكات العميل</span><select class="select" name="subscriptionId" data-order-field="subscriptionId" ${draft.customerId ? "" : "disabled"}><option value="">اختر اشتراك العميل</option>${selectedCustomerSubscriptions.map((item) => `<option value="${item.id}" ${item.id === draft.subscriptionId ? "selected" : ""}>#${escapeHtml(item.orderNumber)} · ${escapeHtml(item.planName)}</option>`).join("")}</select><small>${draft.customerId && !selectedCustomerSubscriptions.length ? "لا يملك هذا العميل اشتراكًا. استخدم الإضافة اليدوية لإنشاء طلبه." : ""}</small></label>` : ""}
          </div>
          ${draft.sourceMode !== "existing" && !customers.length ? `<div class="order-inline-notice"><span>أضف العميل الحقيقي أولًا ليتم ربط الطلب به.</span><button type="button" class="btn btn-secondary" data-action="add-customer">إضافة عميل</button></div>` : ""}
          ${draft.sourceMode === "customer" && draft.customerId && !selectedCustomerSubscriptions.length ? `<div class="order-inline-notice"><span>لا توجد اشتراكات لهذا العميل.</span><button type="button" class="btn btn-primary" data-action="order-source-mode" data-value="manual">إضافة طلب يدوي لهذا العميل</button></div>` : ""}
          ${draft.sourceMode === "manual" ? `<div class="manual-order-panel">
            <div class="section-head"><div><h3>معلومات الطلب اليدوي</h3><p>سيُحفظ هذا الطلب كاشتراك حقيقي ثم يُنشأ له الرابط.</p></div>${dashboardIcon("subscriptions")}</div>
            <div class="order-profile-grid">
              <label class="field"><span>رقم الطلب (اختياري)</span><input class="input" name="manualOrderNumber" data-order-field="manualOrderNumber" value="${escapeHtml(draft.manualOrderNumber)}" placeholder="يُنشأ تلقائيًا عند تركه فارغًا"></label>
              <label class="field"><span>اسم الخدمة</span><input class="input" name="manualServiceName" data-order-field="manualServiceName" value="${escapeHtml(draft.manualServiceName)}"></label>
              <label class="field"><span>اسم الباقة</span><input class="input" name="manualPlanName" data-order-field="manualPlanName" value="${escapeHtml(draft.manualPlanName)}"></label>
              <div class="field manual-start-date-field"><span class="field-heading">تاريخ البداية <button type="button" class="field-edit-button" data-action="toggle-manual-start-date">${draft.manualStartDateEditable ? "قفل" : "تعديل"}</button></span><input class="input ${draft.manualStartDateEditable ? "" : "is-locked"}" type="date" name="manualStartDate" data-order-field="manualStartDate" value="${escapeHtml(draft.manualStartDate || todayDateInputValue())}" ${draft.manualStartDateEditable ? "" : "readonly aria-readonly=\"true\""}><small>${draft.manualStartDateEditable ? "يمكنك الآن اختيار تاريخ بداية مختلف." : "يبدأ الطلب من اليوم تلقائيًا. اضغط تعديل لتغييره."}</small></div>
              <label class="field"><span>تاريخ النهاية</span><input class="input" type="date" name="manualEndDate" data-order-field="manualEndDate" value="${escapeHtml(draft.manualEndDate)}"></label>
              <label class="field"><span>ملاحظات داخلية (اختياري)</span><input class="input" name="manualNotes" data-order-field="manualNotes" value="${escapeHtml(draft.manualNotes)}"></label>
            </div>
            <div class="manual-order-result">${draft.manualStartDate && draft.manualEndDate ? inferredSubscriptionStatus(draft.manualStartDate, draft.manualEndDate) ? `<strong>الحالة المحسوبة: ${inferredSubscriptionStatus(draft.manualStartDate, draft.manualEndDate) === "expired" ? "منتهي" : inferredSubscriptionStatus(draft.manualStartDate, draft.manualEndDate) === "expiring_soon" ? "ينتهي قريبًا" : "نشط"}</strong><span>${escapeHtml(clientRemaining(draft.manualEndDate).label)}</span>` : `<strong class="danger-text">تاريخ النهاية يجب أن يكون بعد تاريخ البداية.</strong>` : `<span>أدخل تاريخي البداية والنهاية ليحسب النظام الحالة والمدة تلقائيًا.</span>`}</div>
          </div>` : ""}
          <div class="builder-step"><h3><b>1</b> اختر نمط القالب</h3><div class="order-style-picker">${orderLinkStyleOptions.map(([value, label]) => `<button type="button" class="${draft.style === value ? "active" : ""}" data-action="order-style" data-value="${value}"><span class="style-mini style-${value}"><i></i><i></i><i></i></span><strong>${label}</strong></button>`).join("")}</div></div>
          <div class="builder-step"><h3><b>2</b> اختر لون القالب</h3><div class="order-color-picker">${orderLinkColorOptions.map(([value, label]) => `<button type="button" class="${safeOrderLinkColor(draft.themeColor) === value ? "active" : ""}" style="--swatch:${value}" data-action="order-color" data-value="${value}" title="${label}"><span></span><small>${label}</small></button>`).join("")}</div></div>
          <div class="order-profile-grid">
            <label class="field"><span>نص ترحيبي اختياري</span><input class="input" name="headerText" data-order-field="headerText" value="${escapeHtml(draft.headerText)}"></label>
            <label class="field"><span>تذييل الصفحة</span><input class="input" name="footerText" data-order-field="footerText" value="${escapeHtml(draft.footerText)}"></label>
            <label class="field"><span>مدة صلاحية الرابط</span><select class="select" name="expiresInDays" data-order-field="expiresInDays">${[7, 14, 30, 60, 90].map((days) => `<option value="${days}" ${Number(draft.expiresInDays) === days ? "selected" : ""}>${days} يومًا</option>`).join("")}</select></label>
            <label class="check-row"><input type="checkbox" name="isDefault" data-order-field="isDefault" ${draft.isDefault ? "checked" : ""}><span>تعيين كقالب افتراضي</span></label>
          </div>
          <div class="builder-step"><div class="section-head"><div><h3><b>3</b> النصوص الإضافية</h3><p>أضف مقاطع قصيرة تظهر للعميل بالترتيب.</p></div><button type="button" class="btn btn-secondary" data-action="add-order-note">إضافة مقطع نصي +</button></div><div class="order-note-editor">${draft.additionalNotes.length ? draft.additionalNotes.map((note, index) => `<div><textarea class="textarea" data-order-note="${index}">${escapeHtml(note)}</textarea><span class="note-actions"><button type="button" data-action="move-order-note" data-index="${index}" data-direction="-1" title="أعلى">↑</button><button type="button" data-action="move-order-note" data-index="${index}" data-direction="1" title="أسفل">↓</button><button type="button" data-action="remove-order-note" data-index="${index}" title="حذف">×</button></span></div>`).join("") : `<p class="muted">لا توجد نصوص إضافية. يمكنك إضافتها عند الحاجة.</p>`}</div></div>
          <div class="builder-step"><h3><b>4</b> الحقول الظاهرة للعميل</h3><div class="visible-fields">${[
            ["customerName", "اسم العميل"], ["planName", "اسم الباقة"], ["startDate", "تاريخ البداية"],
            ["endDate", "تاريخ النهاية"], ["remainingDays", "المدة المتبقية"], ["status", "الحالة"],
            ["storeName", "اسم المتجر"], ["additionalNotes", "الملاحظات"], ["phoneNumber", "الهاتف المخفي"]
          ].map(([key, label]) => `<label class="setting-toggle"><span>${label}</span><input type="checkbox" data-order-visible="${key}" ${draft.visibleFields[key] ? "checked" : ""}></label>`).join("")}</div></div>
          <div class="order-builder-actions"><button class="btn btn-primary" type="submit">حفظ القالب والرابط</button><button class="btn btn-success" type="button" data-action="create-order-link" ${canCreate ? "" : `disabled title="${draft.sourceMode === "manual" ? "اختر العميل وأكمل معلومات الطلب والتواريخ." : "اختر اشتراكًا حقيقيًا أولًا."}"`}>إضافة الطلب للقالب</button><button class="btn btn-success" type="button" data-action="send-created-order-link" title="يحفظ الطلب المختار في القالب ثم يرسل الرابط الثابت">إرسال للعميل</button><button class="btn btn-secondary" type="button" data-action="copy-created-order-link" title="ينسخ الرابط الثابت لهذا القالب">نسخ رابط القالب</button><button class="btn btn-secondary" type="button" data-action="preview-created-order-link" title="يفتح صفحة إدخال رقم الطلب للقالب">معاينة الصفحة</button></div>
          ${publicUrl ? `<div class="created-link-box"><span>الرابط الثابت للقالب ولكل طلباته</span><input class="input" readonly value="${escapeHtml(publicUrl)}"><button type="button" class="btn btn-secondary" data-action="copy-created-order-link">نسخ</button></div>` : ""}
        </form>
      </article>
      <aside class="card order-link-preview-panel"><div class="section-head"><div><h2>معاينة صفحة العميل</h2><p>تنقل بين صفحة إدخال رقم الطلب وصفحة معلوماته.</p></div>${dashboardIcon("reports")}</div><div id="order-live-preview">${orderLinkPreviewSlides(selected, draft)}</div><p class="preview-note">هذه معاينة تقريبية، وسيعرض الرابط الحقيقي بيانات العميل الآمنة من قاعدة البيانات.</p></aside>
    </section>
    <article class="card table-card section order-links-table-card order-links-table-card--links"><div class="section-head"><div><h2>الطلبات المحفوظة في القوالب</h2><p>كل الطلبات تستخدم الرابط الثابت للقالب، ويبحث العميل بينها برقم الطلب.</p></div></div>${links.length ? simpleTable(["رقم الطلب", "العميل", "القالب", "اللون", "طريقة الإرسال", "الحالة", "الفتحات", "آخر فتح", "الإنشاء", "الإجراءات"], linkRows) : emptyState("لا توجد طلبات محفوظة بعد", "أضف أول طلب إلى قالبك الثابت ليتمكن العميل من البحث عنه.")}</article>
    <article class="card table-card section order-links-table-card order-links-table-card--templates"><div class="section-head"><div><h2>القوالب المحفوظة</h2><p>احفظ أكثر من هوية للرسائل وصفحات الطلب.</p></div></div>${templates.length ? simpleTable(["اسم القالب", "النمط", "اللون", "اسم المتجر", "افتراضي", "آخر تحديث", "الإجراءات"], templateRows) : emptyState("لا توجد قوالب محفوظة", "خصص القالب أعلاه ثم اضغط حفظ القالب.")}</article>`);
}

async function loadPublicOrderPresentation() {
  const parts = location.pathname.split("/").filter(Boolean);
  const storeSlug = parts[1] || "";
  const token = state.query.get("t") || "";
  const key = `${storeSlug}:${token}`;
  if (!storeSlug || !token || state.publicOrderPresentationLoading || state.publicOrderPresentationKey === key) return;
  state.publicOrderPresentation = null;
  state.publicOrderPresentationLoading = true;
  state.publicOrderPresentationKey = key;
  try {
    const payload = await fetchJson(`/api/public/order-link/${encodeURIComponent(storeSlug)}?t=${encodeURIComponent(token)}`);
    state.publicOrderPresentation = payload.presentation;
  } catch (error) {
    state.publicOrderPresentation = { error: error.message || "لم يتم العثور على الرابط أو أنه غير صالح.", reason: error.code };
  } finally {
    state.publicOrderPresentationLoading = false;
    render();
  }
}

async function loadPublicOrder({ checked = false, orderNumber } = {}) {
  const parts = location.pathname.split("/").filter(Boolean);
  const storeSlug = parts[1] || "";
  const number = orderNumber || state.publicOrderLookup || parts[2] || "";
  const token = state.query.get("t") || "";
  const key = `${storeSlug}:${number}:${token}:${checked}`;
  if (!storeSlug || !number || !token || state.publicOrderLoading || state.publicOrderKey === key) return;
  state.publicOrderLoading = true;
  state.publicOrderKey = key;
  try {
    const payload = await fetchJson(`/api/public/order-link/${encodeURIComponent(storeSlug)}?orderNumber=${encodeURIComponent(number)}&t=${encodeURIComponent(token)}${checked ? "&checked=1" : ""}`);
    state.publicOrder = payload.data;
  } catch (error) {
    state.publicOrder = { error: error.message || "لم يتم العثور على الطلب أو الرابط غير صالح.", reason: error.code };
  } finally {
    state.publicOrderLoading = false;
    render();
  }
}

function publicOrderPage() {
  const parts = state.route.split("/").filter(Boolean);
  const storeSlug = parts[1] || "";
  const legacyOrderNumber = parts[2] || "";
  const token = state.query.get("t") || "";
  const orderNumber = state.publicOrderLookup || legacyOrderNumber;
  const presentationKey = `${storeSlug}:${token}`;
  const orderKeyPrefix = `${storeSlug}:${orderNumber}:${token}:`;
  const currentOrder = state.publicOrderKey?.startsWith(orderKeyPrefix) ? state.publicOrder : null;
  const currentPresentation = state.publicOrderPresentationKey === presentationKey ? state.publicOrderPresentation : null;
  const data = currentOrder && !currentOrder.error ? currentOrder : null;
  const savedPresentation = currentPresentation && !currentPresentation.error ? currentPresentation : null;
  const presentation = data || savedPresentation;
  if (token && state.publicOrderPresentationKey !== presentationKey && !state.publicOrderPresentationLoading) queueMicrotask(() => loadPublicOrderPresentation());
  if (legacyOrderNumber && token && !data && !state.publicOrderLoading) queueMicrotask(() => loadPublicOrder({ orderNumber: legacyOrderNumber }));
  const storeName = presentation?.store?.name || "معلومات الطلب";
  const themeColor = safeOrderLinkColor(presentation?.template?.themeColor);
  return `<div class="public-order-page" style="--order-theme:${themeColor}">
    <header class="public-order-header"><div>${logo()}<span>منصة إدارة الاشتراكات الذكية</span></div><div><span class="order-bag">${dashboardIcon("orderLink")}</span><strong>${escapeHtml(storeName)}</strong><small>أهلًا بك في صفحة تتبع طلبك</small></div></header>
    <main class="public-order-main">
      ${state.publicOrderPresentationLoading && !presentation ? `<div class="loading-state">جاري تجهيز صفحة المتجر...</div>` : currentPresentation?.error && !presentation ? `<section class="public-order-error">${dashboardIcon("security")}<h2>${escapeHtml(currentPresentation.error)}</h2><p>تواصل مع المتجر للحصول على رابط جديد.</p></section>` : !data && presentation ? `<section class="public-order-entry">${publicOrderLookupCard(presentation, orderNumber)}</section>` : ""}
      ${state.publicOrderLoading ? `<div class="loading-state">جاري التحقق من الرابط والطلب...</div>` : currentOrder?.error ? `<section class="public-order-error">${dashboardIcon("security")}<h2>${escapeHtml(currentOrder.error)}</h2><p>تحقق من رقم الطلب أو تواصل مع المتجر للحصول على رابط جديد.</p><button class="btn btn-secondary" data-action="clear-public-order-error">المحاولة مرة أخرى</button></section>` : data ? `<section class="public-order-result">${orderInfoPreviewCard(null, state.orderLinkDraft, data)}<div class="public-order-actions">${data.store.supportPhone ? `<a class="btn order-themed-action" href="https://wa.me/${String(data.store.supportPhone).replace(/\D/g, "")}" target="_blank" rel="noreferrer">تواصل مع المتجر ${dashboardIcon("template")}</a>` : ""}<button class="btn btn-secondary" data-action="copy-public-order-number" data-value="${escapeHtml(data.order.orderNumber)}">نسخ رقم الطلب ${dashboardIcon("orderLink")}</button></div></section>` : ""}
    </main>
    <footer class="public-order-footer"><span>سياسة الخصوصية</span><span>الشروط والأحكام</span><span>الدعم الفني</span><span>تواصل معنا</span><small>© 2026 Renvix. جميع الحقوق محفوظة.</small></footer>
  </div>`;
}

function billingWorkspacePage() {
  const data = state.billingOverview || {};
  const current = data.current || {};
  const plans = data.plans || [];
  const usage = state.messageUsage && !state.messageUsage.error ? state.messageUsage : data.usage || null;
  const storage = data.storage || { usedMb: 0, limitMb: 100, percent: 0 };
  const days = current.currentPeriodEnd ? Math.max(0, Math.ceil((new Date(current.currentPeriodEnd) - Date.now()) / 86400000)) : 0;
  const invoices = data.invoices || [];
  return dashboardShell(`${pageTitle("الفوترة والباقات")}
    <p class="page-kicker">إدارة خطة الاشتراك والاستخدام والفواتير بكل سهولة وشفافية.</p>${statGrid([
      { title: "مساحة التخزين", value: `${storage.usedMb} / ${storage.limitMb} MB`, caption: `${storage.percent}% مستخدم`, tone: "info", icon: "billing" },
      { title: "الأيام المتبقية", value: days, caption: current.currentPeriodEnd ? `حتى ${new Date(current.currentPeriodEnd).toLocaleDateString("ar-SA")}` : "لا توجد دورة نشطة", tone: "purple", icon: "template" },
      { title: "الخطة الحالية", value: current.planName || "تجربة مجانية", caption: current.status || "trial", tone: "success", icon: "subscriptions" },
      { title: "استخدام الرسائل", value: usage ? `${Number(usage.used || 0) + Number(usage.reserved || 0)} / ${Number(usage.limit || 0) === -1 ? "∞" : Number(usage.limit || 0).toLocaleString("ar-SA")}` : "—", caption: usage ? `متبقي ${Number(usage.remaining || 0) === -1 ? "غير محدود" : Number(usage.remaining || 0).toLocaleString("ar-SA")}` : "جاري التحميل", tone: messageUsageTone(usage || {}) === "reached" ? "danger" : messageUsageTone(usage || {}) === "normal" ? "info" : "warning", icon: "reports" }
    ])}
    <section class="section billing-message-usage">${messageUsageCard(usage)}</section>
    <section class="section billing-workspace"><article class="card plan-catalog"><div class="section-head"><div><h2>اختر الباقة المناسبة لاحتياجاتك</h2><p>الباقات المتاحة فعليًا في منصة Renvix.</p></div></div>${plans.length ? `<div class="dashboard-plan-grid">${plans.map((plan) => `<article class="dashboard-plan ${plan.slug === current.planSlug ? "current" : ""}"><span class="status ${plan.slug === current.planSlug ? "success" : "info"}">${plan.slug === current.planSlug ? "خطتك الحالية" : "متاحة"}</span><h3>${escapeHtml(plan.name)}</h3><p class="plan-price">${formatMoney(state.billing === "yearly" ? plan.yearlyPriceSar : plan.monthlyPriceSar)} <small>/ ${state.billing === "yearly" ? "سنة" : "شهر"}</small></p><ul class="check-list"><li>${Number(plan.messageLimit || 0).toLocaleString("ar-SA")} رسالة</li><li>${Number(plan.customersLimit || 0).toLocaleString("ar-SA")} عميل</li><li>${Number(plan.whatsappChannelsLimit || 0).toLocaleString("ar-SA")} جهاز واتساب</li><li>${Number(plan.storageLimitMb || 100).toLocaleString("ar-SA")} MB تخزين</li></ul><button class="btn ${plan.slug === current.planSlug ? "btn-secondary" : "btn-primary"}" data-link="/pricing">${plan.slug === current.planSlug ? "عرض تفاصيل الخطة" : "اختيار الباقة"}</button></article>`).join("")}</div>` : emptyState("لا توجد باقات مفعلة", "يرجى التواصل مع الدعم لتهيئة باقات المنصة.", "مركز الدعم", "/support")}</article>
      <aside class="billing-side"><article class="card wallet-card"><h2>شحن المحفظة</h2><p>الدفع الإلكتروني غير مفعّل في هذه البيئة حاليًا.</p><button class="btn btn-primary" data-link="/support">طلب مساعدة في الشحن</button></article><article class="card invoice-summary"><h2>ملخص الفاتورة</h2><div><span>الخطة الحالية</span><strong>${escapeHtml(current.planName || "تجربة مجانية")}</strong></div><div><span>دورة الفاتورة</span><strong>${escapeHtml(current.billingCycle || "monthly")}</strong></div><div><span>تاريخ التجديد القادم</span><strong>${current.currentPeriodEnd ? new Date(current.currentPeriodEnd).toLocaleDateString("ar-SA") : "غير متوفر"}</strong></div></article></aside></section>
    <article class="card table-card section"><div class="section-head"><div><h2>آخر الفواتير</h2><p>لا تظهر إلا الفواتير المسجلة فعليًا.</p></div></div>${invoices.length ? simpleTable(["رقم الفاتورة", "التاريخ", "الوصف", "المبلغ", "الحالة"], invoices.map((invoice) => [invoice.number, invoice.date, invoice.description, formatMoney(invoice.amount), status(invoice.status)])) : emptyState("لا توجد فواتير بعد", "ستظهر الفواتير هنا بعد ربط مزود الدفع وإصدار أول فاتورة.")}</article>`);
}

function settingsPage() {
  const remote = state.accountSettings?.settings || state.dashboardOverview?.profile || {};
  const storage = state.accountSettings?.storage || { usedMb: 0, limitMb: 100, percent: 0, breakdown: [] };
  const notifications = remote.notifications || {};
  const avatarUrl = remote.avatarUrl || remote.image;
  const fullName = remote.fullName || remote.name || "";
  const avatar = avatarUrl
    ? `<img class="settings-avatar-image" src="${escapeHtml(avatarUrl)}" alt="صورة الحساب">`
    : `<span class="settings-avatar-fallback">${escapeHtml(fullName.trim().charAt(0) || "م")}</span>`;
  const canEditStore = ["owner", "admin"].includes(String(remote.role || ""));
  return dashboardShell(`${pageTitle("الإعدادات")}
    <p class="page-kicker">إدارة معلومات الحساب والأمان وتفضيلات الواجهة.</p>
    <div class="settings-layout">
      <article class="card settings-panel account-photo-panel settings-account-card"><div class="settings-panel-head">${dashboardIcon("customers")}<div><h2>إعدادات الحساب</h2><p class="muted">تحديث معلومات حسابك الشخصية وبيانات التواصل.</p></div></div><div class="avatar-editor">${avatar}<div><input type="file" accept="image/png,image/jpeg,image/webp" data-action="avatar-file" hidden><button class="avatar-camera-button" data-action="choose-avatar" title="تغيير الصورة">${dashboardIcon("reports")}</button>${avatarUrl ? `<button class="btn btn-ghost danger-text" data-action="remove-avatar">حذف الصورة</button>` : ""}<small>PNG أو JPG أو WebP، بحد أقصى 2 ميجابايت.</small></div></div><form data-submit="profile-settings" class="settings-profile-form" data-original-name="${escapeHtml(fullName)}" data-original-store="${escapeHtml(remote.storeName || "")}" data-original-phone="${escapeHtml(remote.phone || "")}"><label class="field"><span>الاسم الكامل</span><input class="input" name="fullName" value="${escapeHtml(fullName)}" required></label><label class="field"><span>اسم المتجر</span><input class="input" name="storeName" value="${escapeHtml(remote.storeName || "")}" ${canEditStore ? "" : "disabled title=\"لا تملك صلاحية تعديل اسم المتجر\""}></label><label class="field"><span>البريد الإلكتروني</span><input class="input" value="${escapeHtml(remote.email || "")}" readonly title="لتغيير البريد، استخدم إجراء التحقق المخصص."></label><label class="field"><span>رقم الهاتف</span><input class="input" name="phone" dir="ltr" placeholder="+9665XXXXXXXX" value="${escapeHtml(remote.phone || "")}"></label><button class="btn btn-primary profile-save-button" disabled>حفظ التغييرات</button><button type="button" class="btn btn-danger settings-logout-button" data-action="logout-confirm">تسجيل الخروج</button></form></article>
      <article class="card settings-panel settings-security-card"><div class="settings-panel-head">${dashboardIcon("security")}<div><h2>الأمان</h2><p class="muted">حافظ على أمان حسابك بتحديث كلمة المرور وإعدادات الحماية.</p></div></div><form data-submit="password" class="security-password-form"><label class="field"><span>كلمة المرور الحالية</span><input class="input" name="currentPassword" type="password" autocomplete="current-password" required></label><label class="field"><span>كلمة المرور الجديدة</span><input class="input" name="newPassword" type="password" autocomplete="new-password" minlength="10" required></label><label class="field"><span>تأكيد كلمة المرور</span><input class="input" name="confirmPassword" type="password" autocomplete="new-password" minlength="10" required></label><button class="btn btn-primary">تحديث كلمة المرور</button></form><div class="setting-row"><div><strong>المصادقة الثنائية</strong><p class="muted">طبقة حماية إضافية لحسابك</p></div><label class="switch-control"><input type="checkbox" data-action="mfa-toggle" ${remote.mfaEnabled ? "checked" : ""}><span></span></label></div><button class="btn btn-secondary sessions-button" data-action="manage-sessions">إدارة الجلسات النشطة</button></article>
      <article class="card settings-panel settings-interface-card"><div class="settings-panel-head">${dashboardIcon("settings")}<div><h2>الواجهة واللغة</h2><p class="muted">تخصيص مظهر وكثافة ولغة الواجهة.</p></div></div><div class="settings-select-grid"><label class="field"><span>اللغة</span><select class="select" data-action="preference-select" data-preference="language"><option value="ar" ${state.language === "ar" ? "selected" : ""}>◉ العربية</option><option value="en" ${state.language === "en" ? "selected" : ""}>◉ English</option></select></label><label class="field"><span>المظهر</span><select class="select theme-preference-select" data-action="preference-select" data-preference="theme"><option value="light" ${state.theme === "light" ? "selected" : ""}>☀ شمسي (فاتح)</option><option value="dark" ${state.theme === "dark" ? "selected" : ""}>☾ قمري (داكن)</option><option value="system" ${remote.theme === "system" ? "selected" : ""}>النظام</option></select></label><label class="field"><span>كثافة الواجهة</span><select class="select" data-action="preference-select" data-preference="interfaceDensity"><option value="comfortable" ${remote.interfaceDensity === "comfortable" ? "selected" : ""}>مريحة</option><option value="medium" ${remote.interfaceDensity === "medium" ? "selected" : ""}>متوسطة</option><option value="compact" ${remote.interfaceDensity === "compact" ? "selected" : ""}>مضغوطة</option></select></label></div></article>
      <article class="card settings-panel settings-notifications-card"><div class="settings-panel-head">${dashboardIcon("notifications")}<div><h2>الإشعارات</h2><p class="muted">اختر الإشعارات التي ترغب في استلامها.</p></div></div>${notificationSettingToggle("renewalBillingNotifications", "إشعارات التجديد والفواتير", Boolean(notifications.renewalBillingNotifications))}${notificationSettingToggle("securityNotifications", "التنبيهات الأمنية الأساسية", true, true)}${notificationSettingToggle("productUpdates", "تقارير النظام والتحديثات", Boolean(notifications.productUpdates))}${notificationSettingToggle("messageFailureNotifications", "تنبيهات فشل الرسائل", Boolean(notifications.messageFailureNotifications))}<small class="security-always-note">التنبيهات الأمنية الأساسية مفعلة دائمًا لحماية حسابك.</small></article>
      <article class="card settings-panel storage-panel"><div class="settings-panel-head">${dashboardIcon("billing")}<div><h2>مساحة الحساب</h2><p class="muted">المساحة الفعلية لبيانات عملائك واشتراكاتك وروابطك وسجلاتك.</p></div></div><div class="storage-summary"><strong>${storage.usedMb} MB</strong><span>من ${storage.limitMb} MB</span></div><div class="storage-progress"><i style="width:${Math.min(100, Number(storage.percent || 0))}%"></i></div><small>${storage.percent}% مستخدم من حد الباقة الحالية</small><div class="storage-breakdown">${storage.breakdown?.length ? storage.breakdown.map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${item.mb} MB</strong></div>`).join("") : `<p class="muted">لا توجد بيانات مخزنة حتى الآن.</p>`}</div><button class="btn btn-secondary" data-link="/dashboard/billing">عرض حدود الباقات</button></article>
    </div>`);
}

function notificationSettingToggle(key, label, checked, disabled = false) {
  return `<label class="setting-row"><span>${label}</span><span class="switch-control"><input type="checkbox" data-action="notification-preference" data-key="${key}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}><span></span></span></label>`;
}

function simpleTable(headers, rows) {
  return `<div class="compare"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function emptyState(title, description = "ابدأ بإضافة أول عنصر لتظهر البيانات هنا.", actionLabel = "", action = "") {
  return `<div class="empty-state"><span class="empty-state-icon">${dashboardIcon("reports")}</span><strong>${title}</strong><p>${description}</p>${actionLabel ? `<button class="btn btn-primary" ${action.startsWith("/") ? `data-link="${action}"` : `data-action="${action}"`}>${actionLabel}</button>` : ""}</div>`;
}

function openModal(title, body, foot = "") {
  portal.innerHTML = `<div class="modal-overlay" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" tabindex="-1">
    <header class="modal-head"><h2>${title}</h2><button class="btn btn-ghost icon-btn" data-action="close-modal">×</button></header>
    <div class="modal-body">${body}</div>
    ${foot ? `<footer class="modal-foot">${foot}</footer>` : ""}
  </section></div>`;
  localizeElement(portal);
  portal.querySelector(".modal")?.focus();
}

function openDrawer(title, body) {
  portal.innerHTML = `<div class="drawer-overlay" data-action="close-modal"><aside class="drawer">
    <header class="modal-head"><h2>${title}</h2><button class="btn btn-ghost icon-btn" data-action="close-modal">×</button></header>
    <div class="modal-body">${body}</div>
  </aside></div>`;
  localizeElement(portal);
}

function closePortal() {
  portal.innerHTML = "";
}

function toastIcon(type) {
  const paths = {
    success: '<path d="m7 12 3 3 7-7"/><circle cx="12" cy="12" r="9"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
    warning: '<path d="M10.3 3.6 2.4 17.2A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.8L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    loading: '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>'
  };
  return `<svg class="toast-icon-svg ${type === "loading" ? "spinning" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[type] || paths.info}</svg>`;
}

function toast(message, type = "success", options = {}) {
  const normalizedType = type === "danger" ? "error" : ["success", "error", "warning", "info", "loading"].includes(type) ? type : "info";
  const title = String(message || "").trim() || "تم تنفيذ العملية";
  const id = String(options.id || `${normalizedType}:${title}`);
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.setAttribute("aria-label", "تنبيهات النظام");
    document.body.appendChild(stack);
  }
  const existing = [...stack.children].find((node) => node.dataset.toastId === id);
  if (existing) existing.remove();
  while (stack.children.length >= 3) stack.firstElementChild?.remove();
  const item = document.createElement("div");
  item.className = `toast ${normalizedType}`;
  item.dataset.toastId = id;
  item.setAttribute("role", ["error", "warning"].includes(normalizedType) ? "alert" : "status");
  item.setAttribute("aria-live", ["error", "warning"].includes(normalizedType) ? "assertive" : "polite");
  item.innerHTML = `<span class="toast-icon">${toastIcon(normalizedType)}</span><span class="toast-copy"><strong>${escapeHtml(title)}</strong>${options.description ? `<small>${escapeHtml(options.description)}</small>` : ""}</span><button class="toast-close" type="button" aria-label="إغلاق التنبيه">×</button><i class="toast-progress"></i>`;
  item.querySelector(".toast-close")?.addEventListener("click", () => item.remove());
  stack.appendChild(item);
  const duration = options.duration ?? (normalizedType === "success" ? 3800 : normalizedType === "info" ? 4300 : normalizedType === "warning" ? 5200 : normalizedType === "error" ? 6000 : Infinity);
  if (Number.isFinite(duration)) {
    item.style.setProperty("--toast-duration", `${duration}ms`);
    setTimeout(() => { item.classList.add("leaving"); setTimeout(() => item.remove(), 180); }, duration);
  } else {
    item.classList.add("persistent");
  }
  return id;
}

const appToast = {
  success: (title, options) => toast(title, "success", options),
  error: (title, options) => toast(title, "error", options),
  warning: (title, options) => toast(title, "warning", options),
  info: (title, options) => toast(title, "info", options),
  loading: (title, options) => toast(title, "loading", { ...options, duration: Infinity }),
  dismiss(id) {
    const item = [...document.querySelectorAll(".toast")].find((node) => !id || node.dataset.toastId === String(id));
    item?.remove();
  }
};

function clearFormErrors(form) {
  form?.querySelectorAll(".field-error").forEach((node) => node.remove());
  form?.querySelectorAll("[aria-invalid='true']").forEach((node) => node.removeAttribute("aria-invalid"));
}

function setFormError(form, name, message) {
  const input = form?.elements?.namedItem(name);
  if (!input || !message) return;
  input.setAttribute("aria-invalid", "true");
  const error = document.createElement("small");
  error.className = "field-error";
  error.textContent = message;
  input.closest(".field")?.appendChild(error);
}

function setSubmitBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  button.innerHTML = busy ? `<span class="button-spinner" aria-hidden="true"></span><span>${escapeHtml(label)}</span>` : escapeHtml(label);
}

function demoForm() {
  return `<form data-submit="demo" class="form-grid">
    ${field("الاسم", "name", "text")}${field("البريد", "email", "email")}${field("رقم الجوال", "phone", "tel")}
    <label class="field full-span"><span>ملاحظة</span><textarea class="textarea" name="note"></textarea></label>
    <button class="btn btn-primary">إرسال</button><button type="button" class="btn btn-secondary" data-action="close-modal">إلغاء</button>
  </form>`;
}

function field(label, name, type = "text", value = "", required = true) {
  return `<label class="field"><span>${label}</span><input class="input" type="${type}" name="${name}" value="${value}" ${required ? "required" : ""}></label>`;
}

function subscriptionForm(row = {}, editId = "") {
  const customers = Array.isArray(state.dbCustomers) ? state.dbCustomers : [];
  if (!customers.length) return emptyState("أضف عميلًا أولًا", "يجب اختيار عميل حقيقي قبل إنشاء الاشتراك.", "إضافة عميل", "add-customer");
  const reminderChannel = row.reminderChannel === "email" ? "email" : "whatsapp";
  const reminderMode = row.reminderMode === "automatic" ? "automatic" : "manual";
  const reminderDaysBefore = Number.isInteger(Number(row.reminderDaysBefore)) ? Number(row.reminderDaysBefore) : 7;
  return `<form data-submit="subscription" data-id="${editId}" class="form-grid">
    <label class="field"><span>العميل</span><select class="select" name="customerId" ${editId ? "disabled" : ""} required>${customers.map((customer) => `<option value="${customer.id}" ${row.customerId === customer.id ? "selected" : ""}>${escapeHtml(customer.name)}</option>`).join("")}</select></label>
    ${field("رقم الطلب (اختياري)", "orderNumber", "text", row.orderNumber || "", false)}
    ${field("نوع الخدمة", "serviceName", "text", row.serviceName || "")}
    ${field("الباقة", "planName", "text", row.planName || "")}
    ${field("تاريخ البداية", "startDate", "date", row.startDate ? String(row.startDate).slice(0, 10) : "")}
    ${field("تاريخ النهاية", "endDate", "date", row.endDate ? String(row.endDate).slice(0, 10) : "")}
    ${field("رابط التجديد", "renewalUrl", "url", row.renewalUrl || "", false)}
    ${field("القيمة (ر.س)", "price", "number", row.price || "0", false)}
    <label class="field"><span>الحالة</span><select class="select" name="status">${[["active", "نشط"], ["expiring_soon", "ينتهي قريبًا"], ["expired", "منتهي"], ["paused", "موقوف"], ["renewed", "تم التجديد"]].map(([value, label]) => `<option value="${value}" ${row.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    <section class="subscription-delivery-settings full-span" aria-labelledby="subscription-delivery-title">
      <div class="subscription-delivery-heading">
        <div><strong id="subscription-delivery-title">إعدادات إرسال تذكير التجديد</strong><small>حدد القناة وطريقة التشغيل والموعد المناسب لهذا الاشتراك.</small></div>
        <span class="delivery-secure-badge">إرسال آمن</span>
      </div>
      <div class="subscription-delivery-grid">
        <label class="field"><span>قناة الإرسال</span><select class="select" name="reminderChannel">
          <option value="whatsapp" ${reminderChannel === "whatsapp" ? "selected" : ""}>واتساب</option>
          <option value="email" ${reminderChannel === "email" ? "selected" : ""}>البريد الإلكتروني</option>
        </select><small>تُستخدم القناة نفسها عند الإرسال اليدوي أو التلقائي.</small></label>
        <fieldset class="field delivery-mode-field"><legend>أوامر الإرسال</legend><div class="delivery-mode-switch">
          <label><input type="radio" name="reminderMode" value="manual" ${reminderMode === "manual" ? "checked" : ""}><span>يدوي</span></label>
          <label><input type="radio" name="reminderMode" value="automatic" ${reminderMode === "automatic" ? "checked" : ""}><span>تلقائي</span></label>
        </div><small>اليدوي ينتظر ضغط زر «إرسال تذكير»، والتلقائي يجدوله في الموعد.</small></fieldset>
        <label class="field"><span>متى يتم الإرسال؟</span><select class="select" name="reminderDaysBefore">
          ${[[0, "يوم انتهاء الاشتراك"], [1, "قبل يوم واحد"], [2, "قبل يومين"], [3, "قبل 3 أيام"], [4, "قبل 4 أيام"], [5, "قبل 5 أيام"], [7, "قبل 7 أيام"], [14, "قبل 14 يومًا"], [30, "قبل 30 يومًا"]].map(([value, label]) => `<option value="${value}" ${reminderDaysBefore === value ? "selected" : ""}>${label}</option>`).join("")}
        </select><small>يعمل الموعد عند اختيار الإرسال التلقائي.</small></label>
      </div>
    </section>
    <label class="field full-span"><span>ملاحظات</span><textarea class="textarea" name="notes">${escapeHtml(row.notes || "")}</textarea></label>
    <div class="inline-actions"><button class="btn btn-primary">حفظ</button><button type="button" class="btn btn-secondary" data-action="close-modal">إلغاء</button></div>
  </form>`;
}

function customerForm(row = {}, editId = "") {
  return `<form data-submit="customer" data-id="${editId}" class="form-grid">
    ${field("اسم العميل", "name", "text", row.name || "", false)}
    ${field("البريد الإلكتروني (اختياري)", "email", "email", row.email || "", false)}
    ${field("رقم الجوال", "phone", "tel", row.phone || "", false)}
    <label class="field"><span>الحالة</span><select class="select" name="status"><option value="active" ${row.status === "active" ? "selected" : ""}>نشط</option><option value="inactive" ${row.status === "inactive" ? "selected" : ""}>غير نشط</option></select></label>
    <label class="field full-span"><span>ملاحظات / تصنيفات</span><input class="input" name="tags" value="${escapeHtml(Array.isArray(row.tags) ? row.tags.join("، ") : "")}" placeholder="مثال: عميل مميز، متجر"></label>
    <div class="inline-actions"><button class="btn btn-primary">حفظ</button><button type="button" class="btn btn-secondary" data-action="close-modal">إلغاء</button></div>
  </form>`;
}

function exportCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("تم تصدير الملف بنجاح");
}

async function copyText(text, message = "تم نسخ رابط التجديد") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  toast(message);
}

function refreshOrderLinkPreview() {
  const preview = document.querySelector("#order-live-preview");
  if (!preview) return;
  const subscriptions = Array.isArray(state.orderLinkSubscriptions) ? state.orderLinkSubscriptions : [];
  const customers = Array.isArray(state.dbCustomers) ? state.dbCustomers : [];
  const selected = orderLinkPreviewOrder(subscriptions, customers);
  preview.innerHTML = orderLinkPreviewSlides(selected, state.orderLinkDraft);
  const manualResult = document.querySelector(".manual-order-result");
  if (manualResult) {
    const draft = state.orderLinkDraft;
    const inferred = inferredSubscriptionStatus(draft.manualStartDate, draft.manualEndDate);
    manualResult.innerHTML = draft.manualStartDate && draft.manualEndDate
      ? inferred
        ? `<strong>الحالة المحسوبة: ${inferred === "expired" ? "منتهي" : inferred === "expiring_soon" ? "ينتهي قريبًا" : "نشط"}</strong><span>${escapeHtml(clientRemaining(draft.manualEndDate).label)}</span>`
        : `<strong class="danger-text">تاريخ النهاية يجب أن يكون بعد تاريخ البداية.</strong>`
      : `<span>أدخل تاريخي البداية والنهاية ليحسب النظام الحالة والمدة تلقائيًا.</span>`;
  }
  const createButton = document.querySelector("[data-action='create-order-link']");
  if (createButton) {
    const draft = state.orderLinkDraft;
    const manualReady = Boolean(
      draft.customerId && draft.manualServiceName?.trim() && draft.manualPlanName?.trim() &&
      draft.manualStartDate && draft.manualEndDate && inferredSubscriptionStatus(draft.manualStartDate, draft.manualEndDate)
    );
    const existingReady = Boolean(subscriptions.find((item) => item.id === draft.subscriptionId));
    createButton.disabled = draft.sourceMode === "manual" ? !manualReady : !existingReady;
  }
}

function updateOrderLinkDraftFromForm(form = document.querySelector("[data-submit='order-link-template']")) {
  if (!form) return;
  for (const element of form.querySelectorAll("[data-order-field]")) {
    const key = element.dataset.orderField;
    state.orderLinkDraft[key] = element.type === "checkbox" ? element.checked : element.value;
  }
  for (const element of form.querySelectorAll("[data-order-note]")) {
    state.orderLinkDraft.additionalNotes[Number(element.dataset.orderNote)] = element.value;
  }
  for (const element of form.querySelectorAll("[data-order-visible]")) {
    state.orderLinkDraft.visibleFields[element.dataset.orderVisible] = element.checked;
  }
  refreshOrderLinkPreview();
}

async function persistOrderLinkDraft() {
  updateOrderLinkDraftFromForm();
  const draft = state.orderLinkDraft;
  if (!draft.storeName?.trim()) throw new Error("اكتب اسم المتجر.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(draft.slug || ""))) throw new Error("اكتب slug صحيحًا بحروف إنجليزية صغيرة وأرقام وشرطات فقط.");
  const profilePayload = await fetchJson("/api/order-link/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeName: draft.storeName,
      slug: draft.slug,
      defaultTemplateStyle: draft.style,
      defaultThemeColor: draft.themeColor,
      isActive: true
    })
  });
  state.orderLinkProfile = profilePayload.profile;
  const body = {
    name: draft.templateName?.trim() || "قالب معلومات الطلب",
    storeName: draft.storeName,
    style: draft.style,
    themeColor: draft.themeColor,
    headerText: draft.headerText,
    footerText: draft.footerText,
    additionalNotes: draft.additionalNotes.filter((item) => String(item || "").trim()),
    visibleFields: draft.visibleFields,
    isDefault: Boolean(draft.isDefault),
    isActive: true
  };
  const templatePayload = await fetchJson(draft.templateId ? `/api/order-link/templates/${draft.templateId}` : "/api/order-link/templates", {
    method: draft.templateId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  state.orderLinkDraft = {
    ...state.orderLinkDraft,
    templateId: templatePayload.item.id,
    templateName: templatePayload.item.name,
    templateLinkId: templatePayload.item.templateLinkId || state.orderLinkDraft.templateLinkId || "",
    publicUrl: templatePayload.item.publicUrl || state.orderLinkDraft.publicUrl || ""
  };
  state.orderLinkTemplates = null;
  state.orderLinks = null;
  syncRouteData(true);
  return templatePayload.item;
}

function orderLinkDraftValidationMessage(draft) {
  if (draft.sourceMode !== "manual" && !draft.subscriptionId) return "اختر طلبًا أو اشتراكًا حقيقيًا أولًا.";
  if (draft.sourceMode === "manual" && !draft.customerId) return "اختر العميل الذي يخصه الطلب أولًا.";
  if (draft.sourceMode === "manual" && (!draft.manualServiceName?.trim() || !draft.manualPlanName?.trim() || !draft.manualStartDate || !draft.manualEndDate)) {
    return "أكمل اسم الخدمة والباقة وتاريخي البداية والنهاية.";
  }
  if (draft.sourceMode === "manual" && !inferredSubscriptionStatus(draft.manualStartDate, draft.manualEndDate)) {
    return "تاريخ النهاية يجب أن يكون بعد تاريخ البداية.";
  }
  return "";
}

async function createCurrentOrderLink(trigger) {
  updateOrderLinkDraftFromForm();
  const draft = state.orderLinkDraft;
  const validationMessage = orderLinkDraftValidationMessage(draft);
  if (validationMessage) {
    toast(validationMessage, "warning");
    return null;
  }
  if (state.orderLinkCreating) {
    toast("جاري إنشاء الرابط، انتظر لحظة.", "info");
    return null;
  }
  state.orderLinkCreating = true;
  if (trigger) {
    trigger.disabled = true;
    trigger.setAttribute("aria-busy", "true");
  }
  try {
    const template = await persistOrderLinkDraft();
    let subscriptionId = draft.subscriptionId;
    let orderNumber = "";
    let customerName = "";
    if (draft.sourceMode === "manual") {
      const customer = (state.dbCustomers || []).find((item) => item.id === draft.customerId);
      const subscriptionPayload = await fetchJson("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: draft.customerId,
          orderNumber: draft.manualOrderNumber?.trim() || undefined,
          serviceName: draft.manualServiceName.trim(),
          planName: draft.manualPlanName.trim(),
          startDate: draft.manualStartDate,
          endDate: draft.manualEndDate,
          status: inferredSubscriptionStatus(draft.manualStartDate, draft.manualEndDate),
          notes: draft.manualNotes?.trim() || undefined
        })
      });
      subscriptionId = subscriptionPayload.item.id;
      orderNumber = subscriptionPayload.item.orderNumber || draft.manualOrderNumber || "";
      customerName = customer?.name || "";
      state.orderLinkDraft.subscriptionId = subscriptionId;
      state.dbSubscriptions = null;
      state.orderLinkSubscriptions = null;
    } else {
      const subscription = (state.orderLinkSubscriptions || []).find((item) => item.id === subscriptionId);
      orderNumber = subscription?.orderNumber || "";
      customerName = subscription?.customerName || "";
    }
    const payload = await fetchJson("/api/order-link/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriptionId,
        templateId: template.id,
        expiresInDays: Number(state.orderLinkDraft.expiresInDays || 30),
        sendMethod: "copy"
      })
    });
    const created = {
      id: payload.id,
      publicUrl: payload.publicUrl,
      orderNumber: payload.orderNumber || orderNumber,
      customerName
    };
    state.orderLinkDraft = {
      ...state.orderLinkDraft,
      publicUrl: created.publicUrl,
      linkId: created.id,
      createdOrderNumber: created.orderNumber,
      createdCustomerName: created.customerName
    };
    state.orderLinks = null;
    syncRouteData(true);
    toast(draft.sourceMode === "manual" ? "تم حفظ الطلب داخل القالب والرابط الثابت جاهز" : "تمت إضافة الطلب إلى رابط القالب الثابت");
    render();
    return created;
  } catch (error) {
    const messages = { slug_exists: "هذا الرابط المخصص مستخدم من متجر آخر.", reserved_slug: "هذا الرابط محجوز للنظام.", subscription_not_found: "الاشتراك المحدد غير موجود." };
    toast(messages[error.code] || error.message || "تعذر إنشاء الرابط", "danger");
    return null;
  } finally {
    state.orderLinkCreating = false;
    if (trigger?.isConnected) {
      trigger.disabled = false;
      trigger.removeAttribute("aria-busy");
    }
  }
}

async function ensureCurrentTemplateLink(trigger) {
  if (state.orderLinkDraft.publicUrl && state.orderLinkDraft.templateId) {
    return {
      id: state.orderLinkDraft.templateLinkId || "",
      publicUrl: state.orderLinkDraft.publicUrl
    };
  }
  try {
    if (trigger) {
      trigger.disabled = true;
      trigger.setAttribute("aria-busy", "true");
    }
    const template = await persistOrderLinkDraft();
    render();
    return { id: template.templateLinkId || "", publicUrl: template.publicUrl || "" };
  } catch (error) {
    toast(error.message || "تعذر تجهيز رابط القالب", "danger");
    return null;
  } finally {
    if (trigger?.isConnected) {
      trigger.disabled = false;
      trigger.removeAttribute("aria-busy");
    }
  }
}

function openOrderLinkSendModal(item) {
  if (!item?.id) return;
  openModal("إرسال رابط معلومات الطلب", `<form data-submit="order-link-send" data-id="${item.id}" class="grid"><div class="order-send-summary"><strong>${escapeHtml(item.customerName || "العميل")}</strong><span>#${escapeHtml(item.orderNumber || "")}</span></div><label class="field"><span>طريقة الإرسال</span><select class="select" name="method"><option value="whatsapp">واتساب</option><option value="email">البريد الإلكتروني</option><option value="copy">نسخ فقط</option></select></label><button class="btn btn-primary">إرسال الرابط</button></form>`);
}

async function saveProfileSettings(data, form) {
  const button = form?.querySelector(".profile-save-button");
  if (button) { button.disabled = true; button.textContent = "جارٍ الحفظ..."; }
  try {
    await fetchJson("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: String(data.fullName || "").trim(),
        storeName: data.storeName === undefined ? undefined : String(data.storeName || "").trim() || null,
        phone: String(data.phone || "").trim() || null
      })
    });
    state.accountSettings = null;
    state.dashboardOverview = null;
    await syncRouteData(true);
    toast("تم حفظ إعدادات الحساب بنجاح");
  } catch (error) {
    if (button) { button.disabled = false; button.textContent = "حفظ التغييرات"; }
    const firstError = Object.values(error.payload?.errors || {}).flat()[0];
    toast(firstError || error.message || "تعذر حفظ التغييرات. حاول مرة أخرى.", "danger");
  }
}

async function saveInterfacePreferences(overrides = {}) {
  const remote = state.accountSettings?.settings || {};
  const language = overrides.language || state.language;
  const theme = overrides.theme || state.theme;
  const interfaceDensity = overrides.interfaceDensity || remote.interfaceDensity || "comfortable";
  await fetchJson("/api/settings/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, theme, interfaceDensity })
  });
  state.language = language;
  state.theme = theme;
  localStorage.setItem("renewpilot_locale", language);
  localStorage.setItem("renewpilot_theme", theme);
  applyPreferences();
  state.accountSettings = null;
  await syncRouteData(true);
}

async function saveNotificationPreference(key, checked) {
  const remote = state.accountSettings?.settings || {};
  const current = { ...(remote.notifications || {}), [key]: checked };
  await fetchJson("/api/settings/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      renewalBillingNotifications: Boolean(current.renewalBillingNotifications),
      productUpdates: Boolean(current.productUpdates),
      messageFailureNotifications: Boolean(current.messageFailureNotifications)
    })
  });
  state.accountSettings = null;
  await syncRouteData(true);
  toast("تم حفظ تفضيلات الإشعارات");
}

async function showSessionsDrawer() {
  openDrawer("إدارة الجلسات النشطة", `<div class="loading-state">جارٍ تحميل الجلسات...</div>`);
  try {
    const payload = await fetchJson("/api/settings/security/sessions");
    const rows = payload.sessions || [];
    openDrawer("إدارة الجلسات النشطة", `<div class="session-list">${rows.map((item) => `<div class="setting-row session-settings-row"><div><strong>${escapeHtml(item.device)}</strong><p class="muted">${escapeHtml(item.location)} · آخر نشاط ${new Date(item.lastActivityAt).toLocaleString("ar-SA")}</p></div>${item.current ? `<span class="status success">الجلسة الحالية</span>` : `<button class="btn btn-danger" data-action="revoke-session" data-id="${escapeHtml(item.id)}">إنهاء الجلسة</button>`}</div>`).join("") || `<p class="muted">لا توجد جلسات نشطة.</p>`}<button class="btn btn-secondary" data-action="revoke-other-sessions">إنهاء جميع الجلسات الأخرى</button></div>`);
  } catch (error) { openDrawer("إدارة الجلسات النشطة", `<div class="empty-state"><strong>تعذر تحميل الجلسات</strong><p>${escapeHtml(error.message)}</p></div>`); }
}

async function startMfaSetup() {
  try {
    const payload = await fetchJson("/api/settings/security/mfa/setup", { method: "POST" });
    openModal("تفعيل المصادقة الثنائية", `<form data-submit="mfa-verify" class="grid"><p>امسح الرمز عبر تطبيق المصادقة، ثم أدخل الرمز المكوّن من 6 أرقام.</p><img class="mfa-qr" src="${escapeHtml(payload.qrCode)}" alt="رمز إعداد المصادقة الثنائية"><code class="mfa-secret">${escapeHtml(payload.secret)}</code><label class="field"><span>رمز التطبيق</span><input class="input code-input" name="code" inputmode="numeric" maxlength="6" required></label><button class="btn btn-primary">تأكيد التفعيل</button></form>`);
  } catch (error) { toast(error.message || "تعذر بدء إعداد المصادقة الثنائية", "danger"); render(); }
}

async function saveSallaSettings() {
  try {
    const body = readSallaSettings();
    const payload = await fetchJson("/api/apps/salla/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    state.appsOverview = payload;
    state.sallaRuleDrafts = null;
    toast("تم حفظ إعدادات سلة");
    render();
  } catch (error) { toast(error.message || "تعذر حفظ إعدادات سلة", "danger"); }
}

function readSallaSettings() {
  const current = state.appsOverview?.connection || {};
  const value = (key) => document.querySelector(`[data-salla-setting="${key}"]`);
  const checked = (key) => Boolean(value(key)?.checked);
  return {
    storeDisplayName: value("storeDisplayName")?.value?.trim() || current.storeDisplayName || current.storeName || "",
    orderLinkSlug: value("orderLinkSlug")?.value?.trim() || "",
    defaultTemplateId: value("defaultTemplateId")?.value || current.defaultTemplateId || "",
    defaultTemplateStyle: value("defaultTemplateStyle")?.value || "classic",
    defaultThemeColor: document.querySelector('[data-salla-setting="defaultThemeColor"]:checked')?.value || "#22C55E",
    defaultSubscriptionDurationDays: Number(value("defaultSubscriptionDurationDays")?.value || 30),
    sendMethod: value("sendMethod")?.value || "manual",
    autoSyncCustomers: checked("autoSyncCustomers"), autoSyncOrders: checked("autoSyncOrders"),
    autoCreateSubscriptions: checked("autoCreateSubscriptions"), autoCreateOrderLinks: checked("autoCreateOrderLinks"),
    syncOrderStatus: checked("syncOrderStatus"), notifyCustomerAfterLinkCreated: checked("notifyCustomerAfterLinkCreated"),
    syncPaidOrdersOnly: checked("syncPaidOrdersOnly"), syncCompletedOrdersOnly: checked("syncCompletedOrdersOnly"),
    subscriptionRules: readSallaRuleDrafts()
  };
}

function readSallaRuleDrafts() {
  const rows = [...document.querySelectorAll("[data-salla-rule-row]")];
  if (rows.length) return rows.map((row) => ({
    id: row.dataset.ruleId || `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: row.querySelector('[data-salla-rule-field="name"]')?.value?.trim() || "",
    durationDays: Number(row.querySelector('[data-salla-rule-field="durationDays"]')?.value || 30)
  }));
  const saved = state.appsOverview?.connection?.subscriptionRules;
  return Array.isArray(state.sallaRuleDrafts) ? state.sallaRuleDrafts.map((rule) => ({ ...rule })) : Array.isArray(saved) ? saved.map((rule) => ({ ...rule })) : [];
}

async function handleAction(target) {
  const action = target.dataset.action;
  if (!action) return;
  if (action === "toggle-password") {
    const input = target.closest(".password-input-wrap")?.querySelector("input");
    if (input) {
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      target.innerHTML = dashboardIcon(visible ? "eye-off" : "eye");
      target.setAttribute("aria-label", visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
    }
    return;
  }
  if (action === "notifications") {
    state.notificationDropdownOpen = !state.notificationDropdownOpen;
    render();
    return;
  }
  if (action === "notification-mark-all") {
    try {
      await fetchJson("/api/notifications/mark-all-read", { method: "POST" });
      state.notifications = null;
      await syncRouteData(true);
    } catch (error) {
      toast(error.message || "تعذر تحديث الإشعارات", "danger");
    }
    return;
  }
  if (action === "notification-open") {
    try {
      if (target.dataset.id) {
        await fetchJson("/api/notifications/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: target.dataset.id })
        });
      }
    } catch (error) {
      toast(error.message || "تعذر تحديث الإشعار", "danger");
    }
    state.notifications = null;
    if (target.dataset.url) navigate(target.dataset.url);
    else await syncRouteData(true);
    return;
  }
  if (action === "notification-delete") {
    try {
      await fetchJson("/api/notifications/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.dataset.id })
      });
      state.notifications = null;
      await syncRouteData(true);
    } catch (error) {
      toast(error.message || "تعذر حذف الإشعار", "danger");
    }
    return;
  }
  if (action === "reload-notifications") {
    state.notifications = null;
    await syncRouteData(true);
    return;
  }
  if (action === "notification-filter") {
    state.notificationFilter = target.value;
    render();
    return;
  }
  if (action === "toggle-public-nav") { state.navOpen = !state.navOpen; render(); }
  if (action === "toggle-sidebar") { state.sidebarOpen = !state.sidebarOpen; render(); }
  if (action === "close-modal") closePortal();
  if (action === "copy-order-number") await copyText(target.dataset.value, "تم نسخ رقم الطلب");
  if (action === "choose-avatar") document.querySelector('[data-action="avatar-file"]')?.click();
  if (action === "remove-avatar") {
    return openModal("حذف صورة الحساب", "<p>ستعود أيقونة الحساب إلى الحرف الأول من اسمك.</p>", '<button class="btn btn-danger" data-action="confirm-remove-avatar">حذف الصورة</button><button class="btn btn-secondary" data-action="close-modal">إلغاء</button>');
  }
  if (action === "confirm-remove-avatar") {
    try {
      await fetchJson("/api/settings/profile/avatar", { method: "DELETE" });
      closePortal();
      state.accountSettings = null; state.dashboardOverview = null;
      await syncRouteData(true);
      appToast.success("تم حذف صورة الحساب", { description: "تمت استعادة أيقونة الحرف الأول.", id: "avatar-removed" });
    } catch { appToast.error("تعذر حذف الصورة", { description: "حاول مرة أخرى بعد قليل.", id: "avatar-remove-error" }); }
  }
  if (action === "reload-apps") { state.appsOverview = null; syncRouteData(true); }
  if (action === "connect-salla") window.location.href = "/api/apps/salla/connect";
  if (action === "integration-coming-soon") toast(`تكامل ${target.dataset.integration || "هذا التطبيق"} قيد التجهيز وسيُتاح قريبًا.`, "info");
  if (action === "integration-guide") openModal("دليل ربط التطبيقات", `<div class="integration-guide"><p>اختر التطبيق المطلوب ثم اضغط زر الربط. عند اختيار سلة ستنتقل إلى صفحة التفويض الآمنة، وبعد الموافقة تعود تلقائيًا إلى Renvix وتبدأ المزامنة.</p><ol><li>تأكد أن حساب المتجر يملك صلاحية إدارة التطبيقات.</li><li>اضغط «ربط سلة» وأكمل الموافقة داخل سلة.</li><li>ارجع إلى هذه الصفحة واضبط خيارات المزامنة.</li></ol></div>`, `<button class="btn btn-primary" data-action="connect-salla">ربط سلة</button><button class="btn btn-secondary" data-action="close-modal">إغلاق</button>`);
  if (action === "open-salla-settings") { state.sallaSettingsOpen = true; state.sallaRuleDrafts = null; render(); }
  if (action === "close-salla-settings") { state.sallaSettingsOpen = false; state.sallaRuleDrafts = null; render(); }
  if (action === "add-salla-rule") {
    const drafts = readSallaRuleDrafts();
    drafts.push({ id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: "", durationDays: 30 });
    state.sallaRuleDrafts = drafts;
    render();
  }
  if (action === "remove-salla-rule") {
    const drafts = readSallaRuleDrafts();
    drafts.splice(Number(target.dataset.ruleIndex), 1);
    state.sallaRuleDrafts = drafts;
    render();
  }
  if (action === "save-salla-settings") await saveSallaSettings();
  if (action === "show-salla-logs") document.querySelector("#salla-sync-logs")?.scrollIntoView({ behavior: "smooth" });
  if (action === "sync-salla-now") {
    target.disabled = true;
    try {
      const payload = await fetchJson("/api/apps/salla/sync-now", { method: "POST" });
      state.appsOverview = null; await syncRouteData(true);
      toast(`تمت المزامنة بنجاح (${Number(payload.synced || 0)} طلب)`);
    } catch (error) { toast(error.message || "تعذرت المزامنة", "danger"); }
    finally { target.disabled = false; }
  }
  if (action === "disconnect-salla") {
    return openModal("فصل متجر سلة", "<p>سيتم إيقاف المزامنة التلقائية حتى تعيد ربط المتجر.</p>", '<button class="btn btn-danger" data-action="confirm-disconnect-salla">فصل المتجر</button><button class="btn btn-secondary" data-action="close-modal">إلغاء</button>');
  }
  if (action === "confirm-disconnect-salla") {
    try {
      await fetchJson("/api/apps/salla/disconnect", { method: "POST" });
      closePortal();
      state.appsOverview = null;
      await syncRouteData(true);
      appToast.info("تم فصل متجر سلة", { description: "توقفت المزامنة التلقائية ويمكنك إعادة الربط لاحقًا.", id: "salla-disconnected" });
    } catch { appToast.error("تعذر فصل متجر سلة", { description: "حاول مرة أخرى بعد قليل.", id: "salla-disconnect-error" }); }
  }
  if (action === "theme") {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("renewpilot_theme", state.theme);
    applyPreferences();
    toast(state.theme === "dark" ? "تم تفعيل الوضع الليلي" : "تم تفعيل الوضع الشمسي");
    render();
    void saveInterfacePreferences({ theme: state.theme }).catch(() => null);
  }
  if (action === "language") {
    state.language = target.dataset.language || (state.language === "ar" ? "en" : "ar");
    localStorage.setItem("renewpilot_locale", state.language);
    applyPreferences();
    toast(state.language === "ar" ? "تم تفعيل الواجهة العربية" : "English interface enabled");
    render();
    void saveInterfacePreferences({ language: state.language }).catch(() => null);
  }
  if (action === "profile-menu") { state.profileOpen = !state.profileOpen; render(); }
  if (action === "logout-confirm") openModal(t("auth.logoutConfirmTitle"), `<p>${t("auth.logoutConfirmMessage")}</p>`, `<button class="btn btn-danger" data-action="logout">${t("auth.logout")}</button><button class="btn btn-secondary" data-action="close-modal">${t("common.cancel")}</button>`);
  if (action === "logout") {
    const finishLogout = () => {
      closePortal();
      appToast.info("تم تسجيل الخروج", { description: "تم إنهاء جلستك بأمان.", id: "logout-success" });
      navigate("/login");
    };
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(finishLogout);
  }
  if (action === "recalculate-security") {
    target.disabled = true;
    const toastId = appToast.loading("جارٍ إعادة فحص الحماية", { description: "نراجع بيانات الحساب والقنوات الفعلية.", id: "security-recalculate" });
    try {
      const payload = await fetchJson("/api/security/recalculate", { method: "POST" });
      state.securityScore = payload;
      appToast.dismiss(toastId);
      appToast.success("تم تحديث تقييم الحماية", { description: "حُسبت النتيجة من أحدث البيانات المتاحة.", id: "security-updated" });
      render();
    } catch {
      appToast.dismiss(toastId);
      appToast.error("تعذر تحديث تقييم الحماية", { description: "تم الاحتفاظ بآخر نتيجة موثوقة. حاول مرة أخرى لاحقًا.", id: "security-update-error" });
      target.disabled = false;
    }
  }
  if (action === "preview-safe-settings") {
    openModal("تطبيق الإعدادات الآمنة الموصى بها", `<div class="safe-settings-preview"><p>سيتم تطبيق التغييرات غير الحساسة التالية فقط:</p><ul><li>فاصل تلقائي لا يقل عن 300 ثانية.</li><li>Jitter بين 20 و90 ثانية.</li><li>تفعيل Warm-up والإيقاف التلقائي عند الخطر.</li><li>التأكد من وجود حدود يومية وساعية.</li><li>فحص قائمة الإيقاف قبل الإرسال.</li></ul><div class="secure-note">لن يتم تفعيل MFA أو ربط/فصل جهاز أو تغيير كلمة المرور أو حذف جلسة.</div></div>`, '<button class="btn btn-primary" data-action="apply-safe-settings">تأكيد التطبيق</button><button class="btn btn-secondary" data-action="close-modal">إلغاء</button>');
  }
  if (action === "apply-safe-settings") {
    target.disabled = true;
    try {
      await fetchJson("/api/security/apply-recommended", { method: "POST" });
      closePortal();
      const payload = await fetchJson("/api/security/recalculate", { method: "POST" });
      state.securityScore = payload;
      appToast.success("تم تطبيق الإعدادات الآمنة", { description: "حُدّث الفاصل والحدود والتدرج والإيقاف التلقائي.", id: "safe-settings-applied" });
      render();
    } catch {
      target.disabled = false;
      appToast.error("تعذر حفظ إعدادات الحماية", { description: "لم تُطبّق تغييرات حساسة. حاول مرة أخرى.", id: "safe-settings-error" });
    }
  }
  if (action === "order-style") {
    state.orderLinkDraft.style = target.dataset.value;
    render();
  }
  if (action === "order-source-mode") {
    updateOrderLinkDraftFromForm();
    state.orderLinkDraft.sourceMode = target.dataset.value;
    if (target.dataset.value === "existing") state.orderLinkDraft.customerId = "";
    if (target.dataset.value === "manual") {
      state.orderLinkDraft.subscriptionId = "";
      state.orderLinkDraft.manualStartDate ||= todayDateInputValue();
      state.orderLinkDraft.manualStartDateEditable = false;
    }
    render();
  }
  if (action === "toggle-manual-start-date") {
    updateOrderLinkDraftFromForm();
    state.orderLinkDraft.manualStartDate ||= todayDateInputValue();
    state.orderLinkDraft.manualStartDateEditable = !state.orderLinkDraft.manualStartDateEditable;
    render();
    if (state.orderLinkDraft.manualStartDateEditable) {
      queueMicrotask(() => document.querySelector("[data-order-field='manualStartDate']")?.focus());
    }
  }
  if (action === "order-color") {
    state.orderLinkDraft.themeColor = safeOrderLinkColor(target.dataset.value);
    render();
  }
  if (action === "order-preview-slide") {
    state.orderLinkPreviewSlide = Number(target.dataset.value) === 1 ? 1 : 0;
    refreshOrderLinkPreview();
  }
  if (action === "order-preview-step") {
    state.orderLinkPreviewSlide = Math.max(0, Math.min(1, Number(state.orderLinkPreviewSlide || 0) + Number(target.dataset.direction || 0)));
    refreshOrderLinkPreview();
  }
  if (action === "order-preview-show-result") {
    state.orderLinkPreviewSlide = 1;
    refreshOrderLinkPreview();
  }
  if (action === "add-order-note") {
    updateOrderLinkDraftFromForm();
    if (state.orderLinkDraft.additionalNotes.length >= 8) return toast("يمكن إضافة 8 مقاطع نصية كحد أقصى.", "warning");
    state.orderLinkDraft.additionalNotes.push("");
    render();
  }
  if (action === "remove-order-note") {
    updateOrderLinkDraftFromForm();
    state.orderLinkDraft.additionalNotes.splice(Number(target.dataset.index), 1);
    render();
  }
  if (action === "move-order-note") {
    updateOrderLinkDraftFromForm();
    const index = Number(target.dataset.index);
    const next = index + Number(target.dataset.direction);
    if (next < 0 || next >= state.orderLinkDraft.additionalNotes.length) return;
    [state.orderLinkDraft.additionalNotes[index], state.orderLinkDraft.additionalNotes[next]] = [state.orderLinkDraft.additionalNotes[next], state.orderLinkDraft.additionalNotes[index]];
    render();
  }
  if (action === "load-order-template" || action === "duplicate-order-template") {
    const item = (state.orderLinkTemplates || []).find((template) => template.id === target.dataset.id);
    if (!item) return;
    state.orderLinkDraft = {
      ...state.orderLinkDraft,
      templateId: action === "duplicate-order-template" ? "" : item.id,
      templateName: action === "duplicate-order-template" ? `${item.name} - نسخة` : item.name,
      storeName: item.storeName,
      style: item.style,
      themeColor: safeOrderLinkColor(item.themeColor),
      headerText: item.headerText || "",
      footerText: item.footerText || "",
      additionalNotes: [...(item.additionalNotes || [])],
      visibleFields: { ...state.orderLinkDraft.visibleFields, ...(item.visibleFields || {}) },
      isDefault: action === "duplicate-order-template" ? false : Boolean(item.isDefault),
      publicUrl: action === "duplicate-order-template" ? "" : (item.publicUrl || ""),
      templateLinkId: action === "duplicate-order-template" ? "" : (item.templateLinkId || ""),
      linkId: ""
    };
    render();
    toast(action === "duplicate-order-template" ? "تم تجهيز نسخة جديدة من القالب" : "تم تحميل القالب للتعديل");
  }
  if (action === "delete-order-template") {
    return openModal("حذف قالب معلومات الطلب", "<p>سيتوقف الرابط العام وستُحذف الطلبات المحفوظة داخل القالب.</p>", `<button class="btn btn-danger" data-action="confirm-delete-order-template" data-id="${escapeHtml(target.dataset.id)}">حذف القالب</button><button class="btn btn-secondary" data-action="close-modal">إلغاء</button>`);
  }
  if (action === "confirm-delete-order-template") {
    try {
      await fetchJson(`/api/order-link/templates/${target.dataset.id}`, { method: "DELETE" });
      closePortal();
      if (state.orderLinkDraft.templateId === target.dataset.id) state.orderLinkDraft.templateId = "";
      state.orderLinkTemplates = null; state.orderLinks = null; syncRouteData(true);
      toast("تم حذف القالب");
    } catch (error) { toast(error.message || "تعذر حذف القالب", "danger"); }
  }
  if (action === "create-order-link") {
    await createCurrentOrderLink(target);
  }
  if (action === "copy-created-order-link") {
    const templateLink = await ensureCurrentTemplateLink(target);
    if (!templateLink?.publicUrl) return;
    await copyText(templateLink.publicUrl, "تم نسخ رابط القالب الثابت بنجاح");
  }
  if (action === "preview-created-order-link") {
    const templateLink = await ensureCurrentTemplateLink(target);
    if (templateLink?.publicUrl) window.open(templateLink.publicUrl, "_blank", "noopener,noreferrer");
  }
  if (action === "send-created-order-link") {
    const created = await createCurrentOrderLink(target);
    if (!created?.publicUrl) return;
    const selected = (state.orderLinkSubscriptions || []).find((item) => item.id === state.orderLinkDraft.subscriptionId);
    openOrderLinkSendModal({
      id: created.id,
      publicUrl: created.publicUrl,
      orderNumber: created.orderNumber || selected?.orderNumber,
      customerName: created.customerName || selected?.customerName
    });
  }
  if (action === "copy-order-link") {
    await fetchJson(`/api/order-link/${target.dataset.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "copy" }) }).catch(() => null);
    await copyText(target.dataset.url, "تم نسخ الرابط بنجاح");
  }
  if (action === "preview-order-link") window.open(target.dataset.url, "_blank", "noopener,noreferrer");
  if (action === "send-order-link") {
    const item = state.orderLinks?.items?.find((link) => link.id === target.dataset.id);
    openOrderLinkSendModal(item);
  }
  if (action === "disable-order-link" || action === "archive-order-link") {
    const endpoint = action === "disable-order-link" ? "disable" : "archive";
    const verb = action === "disable-order-link" ? "تعطيل" : "أرشفة";
    return openModal(`${verb} الرابط`, `<p>هل تريد ${verb} هذا الرابط؟</p>`, `<button class="btn btn-danger" data-action="confirm-order-link-state" data-endpoint="${endpoint}" data-verb="${verb}" data-id="${escapeHtml(target.dataset.id)}">تأكيد ${verb}</button><button class="btn btn-secondary" data-action="close-modal">إلغاء</button>`);
  }
  if (action === "confirm-order-link-state") {
    const endpoint = target.dataset.endpoint;
    const verb = target.dataset.verb;
    try {
      await fetchJson(`/api/order-link/${target.dataset.id}/${endpoint}`, { method: "PATCH" });
      closePortal();
      state.orderLinks = null; syncRouteData(true); toast(`تم ${verb} الرابط`);
    } catch (error) { toast(error.message || `تعذر ${verb} الرابط`, "danger"); }
  }
  if (action === "delete-order-link") {
    return openModal("حذف الرابط نهائيًا", "<p>لن يعود الرابط متاحًا بعد الحذف.</p>", `<button class="btn btn-danger" data-action="confirm-delete-order-link" data-id="${escapeHtml(target.dataset.id)}">حذف نهائي</button><button class="btn btn-secondary" data-action="close-modal">إلغاء</button>`);
  }
  if (action === "confirm-delete-order-link") {
    try {
      await fetchJson(`/api/order-link/${target.dataset.id}`, { method: "DELETE" });
      closePortal();
      if (state.orderLinkDraft.linkId === target.dataset.id) {
        state.orderLinkDraft = { ...state.orderLinkDraft, linkId: "", publicUrl: "" };
      }
      state.orderLinks = null;
      syncRouteData(true);
      toast("تم حذف الرابط");
    } catch (error) { toast(error.message || "تعذر حذف الرابط", "danger"); }
  }
  if (action === "copy-public-order-number") await copyText(target.dataset.value, "تم نسخ رقم الطلب");
  if (action === "clear-public-order-error") {
    state.publicOrder = null;
    state.publicOrderKey = "";
    render();
  }
  if (action === "public-order-style" && state.publicOrder?.template) {
    state.publicOrder.template.style = target.dataset.value;
    render();
  }
  if (action === "device-link-method") {
    state.linkedDevice = { ...state.linkedDevice, linkMethod: target.dataset.method };
    render();
  }
  if (action === "create-pairing-code") {
    let phone = String(state.linkedDevice.phoneInput || "").replace(/\D/g, "");
    if (/^05\d{8}$/.test(phone)) phone = `966${phone.slice(1)}`;
    if (!phone) return toast("يرجى إدخال رقم واتساب.", "danger");
    if (!/^[1-9]\d{9,14}$/.test(phone)) return toast("اكتب الرقم بصيغة دولية بدون + أو مسافات.", "danger");
    state.linkedDevice = { ...state.linkedDevice, phoneInput: phone, pairingLoading: true, pairingError: "", pairingCode: "" };
    render();
    const requestSignal = AbortSignal.timeout(20_000);
    try {
      const instance = await ensureLinkingInstance({ signal: requestSignal, timeoutMessage: "استغرقت خدمة الربط وقتًا أطول من المتوقع. حاول مرة أخرى." });
      const payload = await fetchJson(`/api/whatsapp/instances/${instance.instanceId}/pairing-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone }),
        signal: requestSignal,
        timeoutMessage: "استغرقت خدمة الربط وقتًا أطول من المتوقع. حاول مرة أخرى."
      });
      if (payload.type === "connected" || payload.status === "connected") {
        state.linkedDevice = { ...state.linkedDevice, status: "connected", pairingError: "", pairingCode: "", qrActive: false, qrBase64: "" };
        toast(payload.message || "الجهاز متصل بالفعل.", "success");
        return;
      }
      if (!payload.pairingCode) throw new Error("لم ترجع خدمة الربط رمز اقتران صالحًا لهذه المحاولة. حاول مرة أخرى أو استخدم الباركود.");
      state.linkedDevice = { ...state.linkedDevice, status: "pending_pairing", linkMethod: "pairing", pairingSupported: true, phoneNumber: `+${phone}`, pairingCode: payload.pairingCode, pairingError: "", pairingExpiresAt: new Date(Date.now() + (payload.expiresIn || 60) * 1000).toLocaleTimeString("ar-SA"), activity: ["تم إنشاء رمز اقتران جديد", ...(state.linkedDevice.activity || []).slice(0, 4)] };
      toast("تم إنشاء رمز الاقتران");
    } catch (error) {
      const message = error.message || "تعذر إنشاء رمز الاقتران، حاول استخدام الباركود.";
      if (error.code === "INSTANCE_ALREADY_CONNECTED") {
        state.linkedDevice = { ...state.linkedDevice, status: "connected", pairingError: "", pairingCode: "", qrActive: false, qrBase64: "" };
        toast(message, "success");
        return;
      }
      state.linkedDevice = { ...state.linkedDevice, pairingSupported: error.status === 501 ? false : state.linkedDevice.pairingSupported, pairingError: message, pairingCode: "" };
      toast(message, "danger");
    } finally {
      state.linkedDevice.pairingLoading = false;
      render();
    }
  }
  if (action === "create-device-qr") {
    state.linkedDevice = { ...state.linkedDevice, qrLoading: true, qrImageLoaded: false, qrError: "", qrBase64: "", qrActive: false };
    render();
    const requestSignal = AbortSignal.timeout(20_000);
    try {
      const instance = await ensureLinkingInstance({ signal: requestSignal, timeoutMessage: "استغرقت خدمة الربط وقتًا أطول من المتوقع. حاول مرة أخرى." });
      if (!instance?.id) throw new Error("تعذر إنشاء جلسة الربط.");
      state.linkedDevice = { ...state.linkedDevice, ...instance, instanceId: instance.id, instanceName: instance.instanceName || "", qrBase64: "" };
      const payload = await fetchJson(`/api/whatsapp/instances/${instance.id}/qr`, { signal: requestSignal, timeoutMessage: "استغرقت خدمة الربط وقتًا أطول من المتوقع. حاول مرة أخرى." });
      if (payload.type === "connected" || payload.status === "connected") {
        state.linkedDevice = { ...state.linkedDevice, status: "connected", qrActive: false, qrImageLoaded: false, qrError: "", qrBase64: "" };
        toast(payload.message || "الجهاز متصل بالفعل.", "success");
        return;
      }
      const qrDataUri = payload.qrDataUri || payload.qrBase64;
      if (!isRealQrDataUri(qrDataUri)) throw new Error("لم ترجع خدمة الربط باركودًا صالحًا لهذه المحاولة.");
      state.linkedDevice = { ...state.linkedDevice, status: "pending_qr", linkMethod: "qr", qrActive: true, qrImageLoaded: false, qrError: "", qrBase64: qrDataUri, qrExpiresAt: new Date(Date.now() + (payload.expiresIn || 60) * 1000).toLocaleTimeString("ar-SA"), activity: ["تم إنشاء جلسة ربط جديدة", "تم تجهيز باركود مؤقت", ...(state.linkedDevice.activity || []).slice(0, 3)] };
      toast("تم إنشاء باركود جديد");
      closePortal();
    } catch (error) {
      const message = error.message || "تعذر إنشاء الباركود من خدمة الربط. يرجى المحاولة مرة أخرى.";
      state.linkedDevice = { ...state.linkedDevice, status: "error", qrActive: false, qrImageLoaded: false, qrBase64: "", qrError: message };
      toast(message, "danger");
    } finally {
      state.linkedDevice.qrLoading = false;
      render();
    }
  }
  if (action === "show-device-qr") {
    const hasRealQr = isRealQrDataUri(state.linkedDevice.qrBase64);
    const realQr = hasRealQr ? `<img class="qr-real" src="${state.linkedDevice.qrBase64}" alt="باركود ربط واتساب">` : `<div class="qr-empty"><strong>لا يوجد باركود صالح</strong><p class="muted">${escapeHtml(state.linkedDevice.qrError || "اضغط إنشاء باركود جديد.")}</p></div>`;
    openModal("باركود ربط واتساب", `<div class="qr-box ${hasRealQr ? "active" : ""} modal-qr">${realQr}<strong>${hasRealQr ? "امسح الباركود من واتساب" : "لا يوجد باركود جاهز للمسح"}</strong><p class="muted">تتم عملية الربط بأمان من الخادم ولا تظهر مفاتيح الخدمة في المتصفح.</p></div>`, `<button class="btn btn-primary" data-action="create-device-qr">إنشاء باركود جديد</button><button class="btn btn-secondary" data-action="close-modal">إغلاق</button>`);
  }
  if (action === "copy-pairing") state.linkedDevice.pairingCode ? copyText(state.linkedDevice.pairingCode, "تم نسخ رمز الاقتران") : toast("لا يوجد رمز اقتران صالح للنسخ", "warning");
  if (action === "check-device-connection") {
    if (!["pending_qr", "pending_pairing", "connected"].includes(state.linkedDevice.status)) return toast("أنشئ جلسة ربط أولا", "warning");
    try {
      const payload = await fetchJson(`/api/whatsapp/instances/${state.linkedDevice.instanceId}/check`, { method: "POST", signal: AbortSignal.timeout(15_000), timeoutMessage: "استغرق فحص الاتصال وقتًا أطول من المتوقع." });
      state.linkedDevice = { ...state.linkedDevice, status: payload.status, phoneNumber: payload.phoneNumber || state.linkedDevice.phoneNumber, qrActive: payload.status !== "connected", qrImageLoaded: payload.status === "connected" ? false : state.linkedDevice.qrImageLoaded, qrBase64: payload.status === "connected" ? "" : state.linkedDevice.qrBase64, lastActivity: "الآن", lastCheckAt: "الآن", activity: [payload.status === "connected" ? "تم فحص الاتصال بنجاح" : "لا يزال الربط بانتظار واتساب", ...(state.linkedDevice.activity || []).slice(0, 4)] };
      toast(payload.status === "connected" ? "الاتصال يعمل بنجاح" : "لم يكتمل الربط بعد", payload.status === "connected" ? "success" : "warning");
      render();
    } catch (error) {
      toast(error.message || "تعذر فحص الاتصال", "danger");
    }
  }
  if (action === "send-device-test") {
    if (state.linkedDevice.status !== "connected") return toast("لا يمكن الإرسال قبل ربط الجهاز", "danger");
    return openModal("إرسال رسالة اختبار", `<form data-submit="send-device-test" class="grid"><label class="field"><span>رقم المستلم التجريبي</span><input class="input" name="to" inputmode="numeric" placeholder="9665XXXXXXXX" required></label><label class="field"><span>الرسالة</span><textarea class="textarea" name="message" required>مرحبًا {{name}}، هذه رسالة اختبار من Renvix. أرسل إيقاف لإلغاء الرسائل.</textarea></label><button class="btn btn-primary" type="submit">إرسال الاختبار</button></form>`);
  }
  if (action === "disconnect-device") {
    try {
      await fetchJson(`/api/whatsapp/instances/${state.linkedDevice.instanceId}/disconnect`, { method: "POST" });
      state.linkedDevice = { ...state.linkedDevice, status: "disconnected", qrActive: false, qrImageLoaded: false, qrBase64: "", activity: ["تم فصل الجهاز", ...(state.linkedDevice.activity || []).slice(0, 4)] };
      toast("تم فصل الجهاز");
      render();
    } catch (error) {
      toast(error.message || "تعذر فصل الجهاز", "danger");
    }
  }
  if (action === "delete-device") {
    try {
      await fetchJson(`/api/whatsapp/instances/${state.linkedDevice.instanceId}`, { method: "DELETE" });
      state.linkedDevice = { ...defaultLinkedDevice };
      toast("تم حذف الجهاز المرتبط");
      render();
    } catch (error) {
      toast(error.message || "تعذر حذف الجهاز", "danger");
    }
  }
  if (action === "notifications") toast((state.dashboardOverview?.recentNotifications || []).length ? "تم فتح أحدث التنبيهات المسجلة" : "لا توجد تنبيهات جديدة", "info");
  if (action === "open-demo") openModal("احجز عرضًا توضيحيًا", demoForm());
  if (action === "billing") { state.billing = target.dataset.billing; storage.set("renewpilot.billing", state.billing); render(); }
  if (action === "select-plan") navigate(`/register?plan=${target.dataset.plan}`);
  if (action === "forgot-password") navigate("/forgot-password");
  if (action === "google-login") toast("سيتم ربط تسجيل الدخول عبر Google لاحقًا", "warning");
  if (action === "open-ticket") openModal("فتح تذكرة دعم", `<form data-submit="ticket" class="grid">${field("الموضوع", "subject")}${field("البريد", "email", "email")}<textarea class="textarea" name="body" required placeholder="وصف المشكلة"></textarea><button class="btn btn-primary">إرسال التذكرة</button></form>`);
  if (action === "open-chat") openDrawer("الدردشة المباشرة", `<div class="activity-list"><div class="activity-item">${icon("د")}<div><strong>فريق الدعم</strong><p class="muted">مرحبًا، كيف يمكننا مساعدتك؟</p></div></div></div><form data-submit="chat"><input class="input" name="message" required placeholder="اكتب رسالتك"><br><br><button class="btn btn-primary">إرسال</button></form>`);
  if (action === "open-email") location.href = "mailto:support@renewpilot.ai?subject=طلب دعم Renvix";
  if (action === "open-whatsapp") window.open("https://wa.me/966500000000?text=مرحبًا، أحتاج دعم Renvix", "_blank");
  if (action === "knowledge") toast(`تم فتح قسم ${target.dataset.term}`);
  if (action === "support-chip") { state.search = target.dataset.term; render(); }
  if (action === "blog-category") { state.blogCategory = target.dataset.category; render(); }
  if (action === "insert-template-variable") {
    const textarea = document.querySelector("textarea[name='body']");
    if (!textarea) return;
    const value = target.dataset.variable || "";
    const start = textarea.selectionStart ?? textarea.value.length;
    textarea.value = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(textarea.selectionEnd ?? start)}`;
    textarea.focus();
    textarea.setSelectionRange(start + value.length, start + value.length);
    refreshEmailTemplatePreview();
  }
  if (action === "template-theme") {
    const form = target.closest("form");
    const color = safeEmailTheme(target.dataset.color);
    const hidden = form?.querySelector("input[name='themeColor']");
    const custom = form?.querySelector("input[type='color']");
    if (hidden) hidden.value = color;
    if (custom) custom.value = color;
    form?.querySelectorAll(".email-color").forEach((button) => button.classList.toggle("active", button.dataset.color === color));
    refreshEmailTemplatePreview();
  }
  if (action === "preview-email-template") {
    refreshEmailTemplatePreview();
    document.querySelector("[data-email-preview]")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (action === "restore-email-template") {
    const form = target.closest("form");
    const defaults = { ...localDefaultEmailTemplate, ...(state.notificationTemplate?.defaultEmailTemplate || {}) };
    for (const [name, value] of Object.entries(defaults)) {
      const input = form?.elements?.namedItem(name);
      if (input && name !== "channel") input.value = value;
    }
    form?.querySelectorAll(".email-color").forEach((button) => button.classList.toggle("active", button.dataset.color === safeEmailTheme(defaults.themeColor)));
    const custom = form?.querySelector("input[type='color']");
    if (custom) custom.value = safeEmailTheme(defaults.themeColor);
    refreshEmailTemplatePreview();
    toast("تمت استعادة القالب الافتراضي. احفظ لتثبيت التغييرات.", "info");
  }
  if (action === "test-template") {
    const channel = document.querySelector("select[name='channel']")?.value || state.templateChannel || state.notificationTemplate?.template?.channel || "whatsapp";
    if (channel === "email") {
      state.emailTemplateTestDraft = readEmailTemplateForm();
      return openModal("إرسال رسالة بريد تجريبية", `<form data-submit="email-template-test" class="grid"><p class="muted">سيصل الاختبار من Renvix &lt;noreply@notify.renvix.app&gt;، وبحد أقصى 5 اختبارات كل 10 دقائق.</p><label class="field"><span>البريد المستلم</span><input class="input" name="to" type="email" autocomplete="email" placeholder="name@example.com" required></label><button class="btn btn-primary">إرسال الاختبار</button></form>`);
    }
    if (state.linkedDevice.status !== "connected" && overviewStats().connectedDevices < 1) return toast("اربط جهاز واتساب أولًا حتى تتمكن من إرسال رسالة تجريبية.", "warning");
    return openModal("إرسال رسالة تجريبية", `<form data-submit="send-device-test" class="grid"><label class="field"><span>رقم المستلم التجريبي</span><input class="input" name="to" inputmode="numeric" placeholder="9665XXXXXXXX" required></label><label class="field"><span>الرسالة</span><textarea class="textarea" name="message" required>${escapeHtml(document.querySelector("textarea[name='body']")?.value || state.notificationTemplate?.template?.body || "")}</textarea></label><button class="btn btn-primary">إرسال الاختبار</button></form>`);
  }
  if (action === "add-subscription") openModal("إضافة اشتراك جديد", subscriptionForm());
  if (action === "bulk-import") openModal(state.language === "ar" ? "استيراد اشتراكات من Excel" : "Import subscriptions from Excel", `<form data-submit="import-preview" class="grid"><label class="field"><span>${state.language === "ar" ? "الصق الجدول هنا" : "Paste the spreadsheet here"}</span><textarea class="textarea spreadsheet-input" name="text" required placeholder="رقم الطلب\tاسم العميل\tرقم الجوال\tالخدمة\tتاريخ البداية\tتاريخ الانتهاء\tرابط التجديد"></textarea></label><button class="btn btn-primary">${state.language === "ar" ? "معاينة قبل الحفظ" : "Preview before saving"}</button></form><div id="import-preview"></div>`);
  if (action === "mark-renewed") openModal(state.language === "ar" ? "تم التجديد" : "Mark as renewed", `<form data-submit="quick-renew" data-id="${target.dataset.id}" class="grid"><label class="field"><span>${state.language === "ar" ? "مدة التجديد" : "Renewal duration"}</span><select class="select" name="duration"><option value="month">${state.language === "ar" ? "شهر" : "One month"}</option><option value="three_months">${state.language === "ar" ? "3 أشهر" : "3 months"}</option><option value="six_months">${state.language === "ar" ? "6 أشهر" : "6 months"}</option><option value="year">${state.language === "ar" ? "سنة" : "One year"}</option><option value="custom">${state.language === "ar" ? "تاريخ مخصص" : "Custom date"}</option></select></label><label class="field"><span>${state.language === "ar" ? "التاريخ المخصص" : "Custom date"}</span><input class="input" type="date" name="customDate"></label><label class="check-row"><input type="checkbox" name="sendNotification" value="true"><span>إرسال إشعار بعد التجديد (اختياري)</span></label><button class="btn btn-primary">${t("common.confirm")}</button><button type="button" class="btn btn-secondary" data-action="close-modal">${t("common.cancel")}</button></form>`);
  if (action === "run-readiness") { state.readiness = null; syncRouteData(true); render(); }
  if (action === "reload-issues") { state.operationalIssues = null; syncRouteData(true); render(); }
  if (action === "reload-subscriptions") { state.dbSubscriptions = null; syncRouteData(true); render(); }
  if (action === "send-subscription-reminder") {
    try {
      await fetchJson(`/api/subscriptions/${target.dataset.id}/remind`, { method: "POST" });
      invalidateMessageUsage();
      toast("تمت إضافة التذكير إلى قائمة الإرسال");
    } catch (error) {
      if (error.code === "PLAN_MESSAGE_LIMIT_REACHED") showMessageQuotaLimit(error.usage);
      else toast(error.message || "تعذر إرسال التذكير", "danger");
    }
  }
  if (action === "subscription-notifications") {
    try {
      const payload = await fetchJson(`/api/subscriptions/${target.dataset.id}/notifications`);
      const content = payload.items.length ? payload.items.map((item) => `<div class="activity-item"><div><strong>${escapeHtml(item.status)} · ${escapeHtml(item.channel)}</strong><p class="muted">${escapeHtml(item.createdAt)} ${item.errorMessage ? `· ${escapeHtml(item.errorMessage)}` : ""}</p></div></div>`).join("") : `<p class="muted">لا توجد تنبيهات لهذا الاشتراك</p>`;
      openDrawer("سجل التنبيهات", `<div class="activity-list">${content}</div>`);
    } catch (error) { toast(error.message, "danger"); }
  }
  if (action === "edit-customer-phone") openModal("تعديل رقم واتساب", `<form data-submit="edit-customer-phone" data-id="${target.dataset.customerId}" class="grid"><label class="field"><span>رقم واتساب بصيغة دولية</span><input class="input" name="phoneNumber" value="${escapeHtml(target.dataset.phone || "")}" placeholder="9665XXXXXXXX" required></label><button class="btn btn-primary">حفظ الرقم</button></form>`);
  if (action === "toggle-customer-reminders") {
    try {
      await fetchJson(`/api/customers/${target.dataset.customerId}/reminders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused: target.dataset.paused !== "true" }) });
      state.dbSubscriptions = null; syncRouteData(true); toast("تم تحديث حالة التذكيرات");
    } catch (error) { toast(error.message, "danger"); }
  }
  if (action === "customer-timeline") {
    try {
      const payload = await fetchJson(`/api/customers/${target.dataset.customerId}/timeline`);
      const content = payload.items.length ? payload.items.map((item) => `<div class="timeline-item"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.createdAt)}</small></div>`).join("") : `<p class="muted">لا يوجد نشاط مسجل</p>`;
      openDrawer("Timeline العميل", `<div class="timeline">${content}</div>`);
    } catch (error) { toast(error.message, "danger"); }
  }
  if (action === "add-unsubscribe") openModal(t("sidebar.unsubscribe"), `<form data-submit="unsubscribe" class="grid">${field(state.language === "ar" ? "رقم واتساب" : "WhatsApp number", "phoneNumber", "tel")}${field(state.language === "ar" ? "السبب" : "Reason", "reason")}<button class="btn btn-primary">${t("common.save")}</button></form>`);
  if (action === "import-save") {
    const text = state.importText || "";
    try {
      const payload = await fetchJson("/api/subscriptions/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      closePortal();
      state.dbSubscriptions = null;
      state.dbCustomers = null;
      state.dashboardOverview = null;
      await syncRouteData(true);
      toast(`${state.language === "ar" ? "تم استيراد" : "Imported"} ${payload.saved || 0}`);
    } catch (error) { toast(error.message || t("common.serverError"), "danger"); }
  }
  if (action === "add-customer") openModal("إضافة عميل", customerForm());
  if (action === "import-customers") openModal("استيراد العملاء", `<form data-submit="customer-import" class="grid"><label class="field"><span>ألصق CSV: الاسم، البريد، الهاتف</span><textarea class="textarea spreadsheet-input" name="text" required placeholder="الاسم,البريد,الهاتف"></textarea></label><button class="btn btn-primary">استيراد</button></form>`);
  if (action === "columns") toast("تم تثبيت أعمدة الجدول الحالية");
  if (action === "apply-filter") toast("تم تطبيق الفلترة");
  if (action === "export-subscriptions") {
    const rows = Array.isArray(state.dbSubscriptions) ? state.dbSubscriptions : [];
    if (!rows.length) return toast("لا توجد بيانات لتصديرها", "warning");
    exportCsv("subscriptions.csv", [["رقم الطلب", "العميل", "الخدمة", "الباقة", "البداية", "النهاية", "الحالة"], ...rows.map((r) => [r.orderNumber, r.customerName, r.serviceName, r.planName, String(r.startDate).slice(0, 10), String(r.endDate).slice(0, 10), r.status])]);
  }
  if (action === "export-customers") {
    const rows = Array.isArray(state.dbCustomers) ? state.dbCustomers : [];
    if (!rows.length) return toast("لا توجد بيانات لتصديرها", "warning");
    exportCsv("customers.csv", [["الاسم", "البريد", "الهاتف", "الحالة", "عدد الاشتراكات"], ...rows.map((r) => [r.name, r.email || "", r.phone || "", r.status, r.subscriptionCount || 0])]);
  }
  if (action === "export-report") {
    const stats = overviewStats();
    exportCsv("renewpilot-report.csv", [["المؤشر", "القيمة"], ["الإيراد الشهري", stats.monthlyRevenue], ["الرسائل المرسلة", stats.sentMessages], ["نسبة النجاح", `${stats.successRate}%`], ["العملاء المتجددون", stats.renewedCustomers]]);
  }
  if (action === "copy-renewal") copyText(target.dataset.linkValue);
  if (action === "renew-now") openModal("تأكيد التجديد", `<p>هل تريد فتح عملية التجديد الآن؟</p>`, `<button class="btn btn-primary" data-action="confirm-renew">تجديد الآن</button><button class="btn btn-secondary" data-action="close-modal">إلغاء</button>`);
  if (action === "confirm-renew") { closePortal(); toast("تم تجهيز رابط التجديد"); }
  if (action === "subscription-edit-db") {
    const row = (state.dbSubscriptions || []).find((item) => item.id === target.dataset.id);
    if (row) openModal("تعديل الاشتراك", subscriptionForm(row, row.id));
  }
  if (action === "subscription-delete-db") {
    return openModal("حذف الاشتراك", "<p>سيتم حذف سجل الاشتراك المرتبط نهائيًا.</p>", `<button class="btn btn-danger" data-action="confirm-subscription-delete" data-id="${escapeHtml(target.dataset.id)}">حذف الاشتراك</button><button class="btn btn-secondary" data-action="close-modal">إلغاء</button>`);
  }
  if (action === "confirm-subscription-delete") {
    try {
      await fetchJson(`/api/subscriptions/${target.dataset.id}`, { method: "DELETE" });
      closePortal();
      state.dbSubscriptions = null; state.dashboardOverview = null;
      await syncRouteData(true); toast("تم حذف الاشتراك");
    } catch (error) { toast(error.message || "تعذر حذف الاشتراك", "danger"); }
  }
  if (action === "customer-details-db") {
    const row = (state.dbCustomers || []).find((item) => item.id === target.dataset.id);
    if (row) openDrawer("تفاصيل العميل", `<div class="customer-detail"><h3>${escapeHtml(row.name)}</h3><p>${escapeHtml(row.email || "لا يوجد بريد")}</p><p>${escapeHtml(row.phone || "لا يوجد رقم")}</p><div class="grid grid-2"><div class="mini-stat"><span>الاشتراكات</span><strong>${row.subscriptionCount || 0}</strong></div><div class="mini-stat"><span>القيمة</span><strong>${formatMoney(row.totalValue || 0)}</strong></div></div><button class="btn btn-secondary" data-action="customer-timeline" data-customer-id="${row.id}">عرض Timeline</button></div>`);
  }
  if (action === "customer-edit-db") {
    const row = (state.dbCustomers || []).find((item) => item.id === target.dataset.id);
    if (row) openModal("تعديل عميل", customerForm(row, row.id));
  }
  if (action === "customer-delete-db") {
    return openModal("حذف العميل", "<p>سيتم حذف العميل والبيانات التابعة له حسب سياسة الاحتفاظ.</p>", `<button class="btn btn-danger" data-action="confirm-customer-delete" data-id="${escapeHtml(target.dataset.id)}">حذف العميل</button><button class="btn btn-secondary" data-action="close-modal">إلغاء</button>`);
  }
  if (action === "confirm-customer-delete") {
    try {
      await fetchJson(`/api/customers/${target.dataset.id}`, { method: "DELETE" });
      closePortal();
      state.dbCustomers = null; state.dbSubscriptions = null; state.dashboardOverview = null;
      await syncRouteData(true); toast("تم حذف العميل");
    } catch (error) { toast(error.message || "تعذر حذف العميل", "danger"); }
  }
  if (action === "send-message") {
    if (!overviewStats().connectedDevices) return toast("اربط جهازًا أولًا حتى تتمكن من إرسال التنبيهات.", "warning");
    await navigate("/dashboard/devices");
    toast("استخدم زر إرسال رسالة اختبار من الجهاز المتصل.", "info");
  }
  if (action === "import-unsubscribes") openModal("استيراد قائمة الإيقاف", `<form data-submit="unsubscribe-import" class="grid"><label class="field"><span>رقم في كل سطر</span><textarea class="textarea spreadsheet-input" name="text" required placeholder="9665XXXXXXXX"></textarea></label><button class="btn btn-primary">استيراد القائمة</button></form>`);
  if (action === "policy-details" || action === "review-risks") {
    const health = state.whatsappHealth?.health;
    openDrawer("سياسة الإرسال الآمن", health ? `<div class="grid"><div class="risk-summary"><strong>${Number(health.risk || 0)}</strong><span>/100</span></div><p>${escapeHtml(health.advice || "")}</p><p class="muted">عدد قواعد الإرسال النشطة: ${overviewStats().safeRules}</p></div>` : emptyState("لا توجد نتيجة فحص بعد", "اربط جهازًا أولًا لعرض تفاصيل السياسة."));
  }
  if (action === "manage-sessions") await showSessionsDrawer();
  if (action === "revoke-session") {
    try { await fetchJson(`/api/settings/security/sessions/${encodeURIComponent(target.dataset.id)}`, { method: "DELETE" }); toast("تم إنهاء الجلسة"); await showSessionsDrawer(); }
    catch (error) { toast(error.message || "تعذر إنهاء الجلسة", "danger"); }
  }
  if (action === "revoke-other-sessions") {
    try { await fetchJson("/api/settings/security/sessions/revoke-others", { method: "POST" }); toast("تم إنهاء الجلسات الأخرى"); await showSessionsDrawer(); }
    catch (error) { toast(error.message || "تعذر إنهاء الجلسات", "danger"); }
  }
  if (action === "mfa-toggle") {
    if (target.checked) await startMfaSetup();
    else openModal("إيقاف المصادقة الثنائية", `<form data-submit="mfa-disable" class="grid"><p>أكد هويتك بكلمة المرور أو رمز تطبيق المصادقة.</p><label class="field"><span>كلمة المرور</span><input class="input" name="password" type="password"></label><label class="field"><span>رمز التطبيق</span><input class="input code-input" name="code" inputmode="numeric" maxlength="6"></label><button class="btn btn-danger">إيقاف المصادقة الثنائية</button></form>`);
  }
  if (action === "remove-unsubscribe") {
    try { await fetchJson(`/api/unsubscribes?id=${encodeURIComponent(target.dataset.id)}`, { method: "DELETE" }); state.unsubscribes = null; state.dashboardOverview = null; await syncRouteData(true); toast("تم حذف الرقم"); }
    catch (error) { toast(error.message || "تعذر حذف الرقم", "danger"); }
  }
  if (action === "export-unsubscribes") {
    const rows = Array.isArray(state.unsubscribes) ? state.unsubscribes : [];
    if (!rows.length) return toast("لا توجد بيانات لتصديرها", "warning");
    exportCsv("unsubscribe-list.csv", [["الرقم", "السبب", "التاريخ"], ...rows.map((row) => [row.phoneNumber, row.reason || "", row.unsubscribedAt || ""])]);
  }
}

function subscriptionDetails(row) {
  return `<div class="grid"><p><strong>${row.order}</strong> · ${row.customer}</p><p>${row.service} · ${row.plan}</p><p>من ${row.start} إلى ${row.end}</p>${status(row.status)}<button class="btn btn-primary" data-action="copy-renewal" data-link-value="${row.renewal}">نسخ رابط التجديد</button></div>`;
}

function customerDetails(row) {
  return `<div class="grid">
    <p><strong>${row.name}</strong></p><p class="muted">${row.email} · ${row.phone}</p>
    <div class="grid grid-3"><div class="mini-stat"><span>الباقة</span><strong>${row.plan}</strong></div><div class="mini-stat"><span>التجديد</span><strong>${row.renewal}</strong></div><div class="mini-stat"><span>الخطر</span><strong>${row.risk}</strong></div></div>
    <h3>سجل الرسائل</h3>${activityList()}
    <button class="btn btn-primary" data-action="send-message">إرسال رسالة</button>
    <button class="btn btn-secondary" data-link="/dashboard/subscriptions">عرض الاشتراكات</button>
  </div>`;
}

async function handleSubmit(form, event) {
  event.preventDefault();
  const type = form.dataset.submit;
  const data = Object.fromEntries(new FormData(form));
  if (type === "order-link-template") {
    const button = form.querySelector("button[type='submit']");
    if (button) button.disabled = true;
    try {
      await persistOrderLinkDraft();
      toast("تم حفظ قالب معلومات الطلب بنجاح");
    } catch (error) {
      if (button) button.disabled = false;
      const messages = { slug_exists: "هذا الرابط المخصص مستخدم من متجر آخر.", reserved_slug: "هذا الرابط محجوز للنظام.", invalid_slug: "صيغة الرابط المخصص غير صحيحة." };
      toast(messages[error.code] || error.message || "تعذر حفظ القالب", "danger");
    }
    return;
  }
  if (type === "order-link-send") {
    const button = form.querySelector("button");
    if (button) { button.disabled = true; button.textContent = "جاري الإرسال..."; }
    try {
      const payload = await fetchJson(`/api/order-link/${form.dataset.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: data.method })
      });
      const link = state.orderLinks?.items?.find((item) => item.id === form.dataset.id);
      if (data.method === "copy" && link?.publicUrl) await copyText(link.publicUrl, "تم نسخ الرابط بنجاح");
      closePortal();
      state.orderLinks = null;
      syncRouteData(true);
      if (data.method !== "copy") invalidateMessageUsage();
      toast(data.method === "whatsapp" ? "تم إرسال الرابط عبر واتساب" : data.method === "email" ? "تم إرسال الرابط عبر البريد" : "تم نسخ الرابط بنجاح");
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = "إرسال الرابط"; }
      if (error.code === "PLAN_MESSAGE_LIMIT_REACHED") return showMessageQuotaLimit(error.usage);
      const messages = {
        whatsapp_not_connected: "اربط جهازًا أولًا حتى تتمكن من إرسال الرابط عبر واتساب.",
        customer_phone_missing: "لا يوجد رقم واتساب صالح لهذا العميل.",
        customer_email_missing: "لا يوجد بريد إلكتروني لهذا العميل. أضف بريدًا أو اختر الإرسال عبر واتساب/نسخ الرابط.",
        email_not_configured: "خدمة البريد غير مفعلة حاليًا."
      };
      toast(messages[error.code] || error.message || "تعذر إرسال الرابط", "danger");
    }
    return;
  }
  if (type === "public-order-search") {
    const number = String(data.orderNumber || "").trim().replace(/^#/, "");
    if (!number) return toast("اكتب رقم الطلب.", "warning");
    state.publicOrderLookup = number;
    state.publicOrder = null;
    state.publicOrderKey = "";
    render();
    await loadPublicOrder({ checked: true, orderNumber: number });
    return;
  }
  if (type === "send-device-test") {
    const button = form.querySelector("button[type='submit']");
    if (button) { button.disabled = true; button.textContent = t("common.loading"); }
    try {
      const payload = await fetchJson(`/api/whatsapp/instances/${state.linkedDevice.instanceId}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(60_000),
        timeoutMessage: "تم إرسال الطلب إلى واتساب، جارٍ التحقق من حالة الإرسال."
      });
      if (payload.status === "pending_verification") {
        closePortal();
        toast(payload.message || "تم إرسال الطلب إلى واتساب، جارٍ التحقق من حالة الإرسال.", "warning");
        render();
        return;
      }
      state.linkedDevice.messagesToday = (state.linkedDevice.messagesToday || 0) + 1;
      state.linkedDevice.messagesMonth = (state.linkedDevice.messagesMonth || 0) + 1;
      state.linkedDevice.lastSendAt = "الآن";
      state.linkedDevice.activity = ["تم إرسال رسالة اختبار بنجاح", ...(state.linkedDevice.activity || []).slice(0, 4)];
      closePortal();
      invalidateMessageUsage();
      toast(payload.message || "تم إرسال رسالة الاختبار بنجاح.");
      render();
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = "إرسال الاختبار"; }
      if (error.code === "PLAN_MESSAGE_LIMIT_REACHED") return showMessageQuotaLimit(error.usage);
      toast(error.message || "تعذر إرسال رسالة الاختبار. تحقق من اتصال واتساب.", error.code === "EVOLUTION_TIMEOUT" ? "warning" : "danger");
    }
    return;
  }
  if (type === "email-template-test") {
    const button = form.querySelector("button[type='submit']");
    if (button) { button.disabled = true; button.textContent = "جاري الإرسال..."; }
    try {
      await fetchJson("/api/templates/renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(state.emailTemplateTestDraft || {}), to: data.to })
      });
      closePortal();
      invalidateMessageUsage();
      toast("تم إرسال رسالة البريد التجريبية بنجاح.");
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = "إرسال الاختبار"; }
      if (error.code === "PLAN_MESSAGE_LIMIT_REACHED") return showMessageQuotaLimit(error.usage);
      toast(error.message || "تعذر إرسال الرسالة التجريبية.", "danger");
    }
    return;
  }
  if (type === "login") {
    clearFormErrors(form);
    if (!data.email && !data.password) {
      setFormError(form, "email", "يرجى إدخال البريد الإلكتروني.");
      setFormError(form, "password", "يرجى إدخال كلمة المرور.");
      return appToast.warning("أكمل البيانات المطلوبة", { description: "أدخل البريد الإلكتروني وكلمة المرور.", id: "login-validation" });
    }
    if (!data.email) {
      setFormError(form, "email", "يرجى إدخال البريد الإلكتروني.");
      return appToast.warning("يرجى إدخال البريد الإلكتروني", { description: "أدخل البريد المرتبط بحسابك.", id: "login-email-required" });
    }
    if (!data.password) {
      setFormError(form, "password", "يرجى إدخال كلمة المرور.");
      return appToast.warning("يرجى إدخال كلمة المرور", { description: "أدخل كلمة مرور حسابك لإكمال تسجيل الدخول.", id: "login-password-required" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      setFormError(form, "email", "البريد الإلكتروني غير صحيح.");
      return appToast.error("البريد الإلكتروني غير صحيح", { description: "تحقق من صيغة البريد ثم حاول مرة أخرى.", id: "login-email-invalid" });
    }
    const button = form.querySelector("button[type='submit'], button:not([type])");
    setSubmitBusy(button, true, "جارٍ تسجيل الدخول...");
    let loginAccepted = false;
    let failureReason = "";
    let networkFailed = false;
    try {
      const response = await fetch("/api/auth/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const payload = await response.json().catch(() => null);
      loginAccepted = response.ok && payload?.ok === true && Boolean(payload.user?.id);
      failureReason = payload?.reason || "";
    } catch {
      networkFailed = true;
    }
    if (!loginAccepted) {
      setSubmitBusy(button, false, state.language === "en" ? "Sign in" : "تسجيل الدخول");
      if (networkFailed) return appToast.error("تعذر الاتصال بالخادم", { description: "تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.", id: "login-network" });
      if (failureReason === "rate_limited") return appToast.warning("محاولات تسجيل دخول كثيرة", { description: "انتظر قليلًا قبل المحاولة مرة أخرى.", id: "login-rate-limit" });
      return appToast.error("تعذر تسجيل الدخول", { description: "البريد الإلكتروني أو كلمة المرور غير صحيحة.", id: "login-error" });
    }
    if (!await browserSessionIsValid()) {
      setSubmitBusy(button, false, state.language === "en" ? "Sign in" : "تسجيل الدخول");
      return appToast.error("تعذر إكمال تسجيل الدخول", { description: "حدث خطأ غير متوقع. حاول مرة أخرى بعد قليل.", id: "login-session-error" });
    }
    appToast.success("تم تسجيل الدخول بنجاح", { description: "مرحبًا بك في Renvix، جاري تحويلك إلى لوحة التحكم.", id: "login-success", duration: 1800 });
    setTimeout(() => { void enterDashboardAfterSessionVerification(); }, 650);
    return;
  }
  if (type === "register") {
    if (!data.name || data.name.trim().length < 3) return toast(state.language === "ar" ? "يرجى إدخال الاسم الكامل." : "Please enter your full name.", "danger");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")) return toast(t("auth.invalidEmail"), "danger");
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(data.password || "")) return toast(t("auth.passwordMin"), "danger");
    if (data.password !== data.confirmPassword) return toast(t("auth.passwordMismatch"), "danger");
    if (!data.acceptPolicies) return toast("يجب الموافقة على سياسة الاستخدام وسياسة الخصوصية.", "danger");
    try {
      const response = await fetch("/api/auth/register", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const messages = state.language === "ar" ? {
          email_exists: "البريد الإلكتروني مستخدم مسبقًا.",
          invalid_email: "صيغة البريد الإلكتروني غير صحيحة.",
          weak_password: "كلمة المرور لا تحقق شروط الأمان.",
          database_unavailable: "تعذر الاتصال بقاعدة البيانات، حاول لاحقًا.",
          database_schema_missing: "تعذر إنشاء مساحة العمل، حاول لاحقًا."
        } : {
          email_exists: "This email is already in use.",
          invalid_email: "The email address is invalid.",
          weak_password: "The password does not meet the security requirements.",
          database_unavailable: "The database is currently unavailable. Please try again later.",
          database_schema_missing: "The workspace could not be created. Please try again later."
        };
        return toast(messages[payload?.reason] || t("common.serverError"), "danger");
      }
      if (!payload?.ok || !payload.user?.id || !await enterDashboardAfterSessionVerification()) {
        return toast(state.language === "ar" ? "تعذر إنشاء الجلسة، حاول تسجيل الدخول." : "The session could not be created. Please sign in.", "danger");
      }
    } catch {
      return toast(t("common.serverError"), "danger");
    }
    toast(t("auth.registerSuccess"));
    return;
  }
  if (type === "renewal-template") {
    if (!data.name?.trim()) return toast("اكتب اسمًا للقالب.", "danger");
    if (!data.body?.trim()) return toast("اكتب محتوى رسالة التجديد.", "danger");
    if (data.channel === "email" && (!data.storeName?.trim() || !data.title?.trim() || !data.buttonLabel?.trim() || !data.footerText?.trim())) {
      return toast("أكمل جميع حقول قالب البريد الإلكتروني.", "danger");
    }
    try {
      const requestBody = data.channel === "email" ? readEmailTemplateForm(form) : {
        name: data.name,
        channel: data.channel,
        body: data.body,
        daysOffset: Number(data.daysOffset || 7),
        isActive: data.isActive === "on"
      };
      const payload = await fetchJson("/api/templates/renewal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      const current = state.notificationTemplate || {};
      const templates = (Array.isArray(current.templates) ? current.templates : []).filter((item) => item.channel !== payload.template.channel);
      const rules = (Array.isArray(current.rules) ? current.rules : []).filter((item) => item.channel !== payload.rule.channel);
      state.notificationTemplate = { ...current, template: payload.template, rule: payload.rule, templates: [...templates, payload.template], rules: [...rules, payload.rule] };
      toast("تم حفظ قالب رسالة التجديد بنجاح");
      render();
    } catch (error) { toast(error.message || "تعذر حفظ القالب", "danger"); }
    return;
  }
  if (type === "support-request") {
    if (!data.name?.trim() || !data.email?.trim() || !data.subject || !data.details?.trim()) return toast("يرجى تعبئة جميع حقول طلب الدعم.", "danger");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return toast("صيغة البريد الإلكتروني غير صحيحة.", "danger");
    form.reset();
    toast("تم إرسال طلب الدعم بنجاح");
    return;
  }
  if (type === "newsletter") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")) return toast("أدخل بريدًا إلكترونيًا صحيحًا.", "danger");
    form.reset();
    toast("تم الاشتراك في النشرة بنجاح");
    return;
  }
  if (type === "subscription") {
    const id = form.dataset.id;
    try {
      await fetchJson(id ? `/api/subscriptions/${id}` : "/api/subscriptions", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, customerId: data.customerId || form.querySelector("[name='customerId']")?.value, price: Number(data.price || 0), reminderDaysBefore: Number(data.reminderDaysBefore || 0) })
      });
      closePortal();
      state.dbSubscriptions = null; state.dashboardOverview = null;
      await syncRouteData(true);
      toast(id ? "تم تحديث الاشتراك بنجاح" : "تمت إضافة الاشتراك بنجاح");
    } catch (error) { toast(error.message || "تعذر حفظ الاشتراك", "danger"); }
    return;
  }
  if (type === "customer") {
    const id = form.dataset.id;
    if (!String(data.name || "").trim() && !String(data.phone || "").trim()) return toast("أدخل اسم العميل أو رقم الجوال.", "danger");
    if (String(data.email || "").trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) {
      return toast("يرجى إدخال بريد إلكتروني صحيح أو ترك الحقل فارغًا.", "danger");
    }
    const tags = String(data.tags || "").split(/[،,]/).map((item) => item.trim()).filter(Boolean);
    try {
      await fetchJson(id ? `/api/customers/${id}` : "/api/customers", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, tags })
      });
      closePortal();
      state.dbCustomers = null; state.dbSubscriptions = null; state.dashboardOverview = null;
      await syncRouteData(true);
      toast(id ? "تم تحديث العميل بنجاح" : "تمت إضافة العميل بنجاح");
    } catch (error) { toast(error.message || "تعذر حفظ العميل", "danger"); }
    return;
  }
  if (type === "forgot") {
    clearFormErrors(form);
    if (!data.email) {
      setFormError(form, "email", "يرجى إدخال البريد الإلكتروني.");
      return appToast.warning("يرجى إدخال البريد الإلكتروني", { description: "سنرسل رمز إعادة التعيين إلى بريد حسابك.", id: "forgot-email-required" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      setFormError(form, "email", "البريد الإلكتروني غير صحيح.");
      return appToast.error("البريد الإلكتروني غير صحيح", { description: "أدخل بريدًا إلكترونيًا بصيغة صحيحة.", id: "forgot-email-invalid" });
    }
    const button = form.querySelector("button");
    setSubmitBusy(button, true, "جارٍ إرسال الطلب...");
    try {
      const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.email, locale: state.language }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSubmitBusy(button, false, "إرسال رابط الاستعادة");
        if (response.status === 429) return appToast.warning("انتظر قبل إعادة الإرسال", { description: "يمكنك طلب رمز جديد بعد قليل.", id: "forgot-rate-limit" });
        return appToast.error("تعذر إرسال الطلب", { description: "حدث خطأ غير متوقع. حاول مرة أخرى بعد قليل.", id: "forgot-error" });
      }
      state.resetEmail = data.email;
      state.resetStep = 2;
      appToast.success("تم استلام طلبك", { description: "إذا كان البريد مسجلًا لدينا، فسيصلك رمز إعادة تعيين كلمة المرور.", id: "forgot-success" });
      render();
    } catch {
      setSubmitBusy(button, false, "إرسال رابط الاستعادة");
      appToast.error("تعذر الاتصال بالخادم", { description: "تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.", id: "forgot-network" });
    }
  }
  if (type === "reset-password") {
    clearFormErrors(form);
    if (!/^\d{6}$/.test(String(data.code || ""))) {
      setFormError(form, "code", "أدخل رمز التحقق كاملًا.");
      return appToast.warning("أدخل رمز التحقق كاملًا", { description: "يتكون رمز التحقق من 6 أرقام.", id: "reset-code-required" });
    }
    if (data.password !== data.confirmPassword) {
      setFormError(form, "confirmPassword", "كلمتا المرور غير متطابقتين.");
      return appToast.error("كلمتا المرور غير متطابقتين", { description: "أعد كتابة كلمة المرور الجديدة بشكل مطابق.", id: "reset-password-mismatch" });
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{10,}$/.test(data.password || "")) {
      setFormError(form, "password", "استخدم 10 أحرف على الأقل مع أرقام وحروف.");
      return appToast.warning("كلمة المرور غير قوية", { description: "استخدم 10 أحرف على الأقل مع أرقام وحروف.", id: "reset-password-weak" });
    }
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: state.resetEmail, code: data.code, password: data.password }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.reason === "expired") return appToast.warning("انتهت صلاحية الرمز", { description: "اطلب رمزًا جديدًا لإكمال إعادة تعيين كلمة المرور.", id: "reset-code-expired" });
        if (payload.reason === "invalid") return appToast.error("رمز التحقق غير صحيح", { description: "تحقق من الرمز المرسل إلى بريدك وحاول مرة أخرى.", id: "reset-code-invalid" });
        return appToast.error("تعذر تغيير كلمة المرور", { description: "جلسة إعادة التعيين غير صالحة. ابدأ العملية من جديد.", id: "reset-error" });
      }
      state.resetStep = 3;
      appToast.success("تم تغيير كلمة المرور بنجاح", { description: "يمكنك الآن تسجيل الدخول باستخدام كلمة المرور الجديدة.", id: "reset-success" });
      render();
    } catch { appToast.error("تعذر الاتصال بالخادم", { description: "تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.", id: "reset-network" }); }
  }
  if (type === "import-preview") {
    state.importText = data.text;
    const lines = String(data.text || "").trim().split(/\r?\n/);
    const rows = lines.slice(1);
    const duplicatePhones = new Set();
    const seen = new Set();
    let invalid = 0;
    rows.forEach((line) => { const cells = line.split("\t"); const phone = (cells[2] || "").replace(/\D/g, ""); if (seen.has(phone)) duplicatePhones.add(phone); seen.add(phone); if (cells.length < 7 || !/^\d{4}-\d{2}-\d{2}$/.test(cells[5] || "")) invalid++; });
    const preview = portal.querySelector("#import-preview");
    if (preview) preview.innerHTML = `<div class="import-summary"><span class="status success">${rows.length - invalid} ${state.language === "ar" ? "صف صحيح" : "valid rows"}</span><span class="status danger">${invalid} ${state.language === "ar" ? "صفوف فيها أخطاء" : "invalid rows"}</span><span class="status warning">${duplicatePhones.size} ${state.language === "ar" ? "أرقام مكررة" : "duplicate numbers"}</span></div><button class="btn btn-primary" data-action="import-save">${state.language === "ar" ? "حفظ الصفوف الصحيحة" : "Save valid rows"}</button>`;
  }
  if (type === "quick-renew") {
    try {
      await fetchJson(`/api/subscriptions/${form.dataset.id}/renew`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ duration: data.duration, customDate: data.customDate || null }) });
      closePortal();
      state.dbSubscriptions = null;
      syncRouteData(true);
      toast(state.language === "ar" ? "تم تمديد الاشتراك وتسجيل العملية دون إرسال تلقائي." : "Subscription renewed without automatic sending.");
      if (data.sendNotification === "true") toast("تم التجديد. استخدم زر إرسال تذكير بعد التأكد من اتصال واتساب.", "warning");
    } catch (error) { toast(error.message || t("common.serverError"), "danger"); }
    return;
  }
  if (type === "edit-customer-phone") {
    try {
      await fetchJson(`/api/customers/${form.dataset.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: data.phoneNumber }) });
      closePortal();
      state.dbSubscriptions = null;
      syncRouteData(true);
      toast("تم تحديث رقم واتساب");
    } catch (error) { toast(error.message || "تعذر تحديث الرقم", "danger"); }
    return;
  }
  if (type === "unsubscribe") {
    try {
      await fetchJson("/api/unsubscribes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      closePortal(); state.unsubscribes = null; state.dashboardOverview = null; await syncRouteData(true);
      toast(state.language === "ar" ? "تمت إضافة الرقم إلى قائمة الإيقاف." : "The number was added to the unsubscribe list.");
    } catch (error) { toast(error.message || "تعذر إضافة الرقم", "danger"); }
    return;
  }
  if (type === "unsubscribe-import") {
    const numbers = String(data.text || "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (!numbers.length) return toast("لا توجد أرقام للاستيراد", "warning");
    let saved = 0;
    for (const phoneNumber of numbers) {
      try {
        await fetchJson("/api/unsubscribes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber, reason: "استيراد يدوي" }) });
        saved += 1;
      } catch {}
    }
    closePortal(); state.unsubscribes = null; state.dashboardOverview = null; await syncRouteData(true);
    toast(`تم استيراد ${saved} رقم`);
    return;
  }
  if (type === "password") {
    clearFormErrors(form);
    if (String(data.newPassword || "").length < 10 || !/[A-Za-z]/.test(data.newPassword || "") || !/\d/.test(data.newPassword || "")) {
      setFormError(form, "newPassword", "استخدم 10 أحرف على الأقل مع أرقام وحروف.");
      return appToast.warning("كلمة المرور غير قوية", { description: "استخدم 10 أحرف على الأقل مع أرقام وحروف.", id: "password-weak" });
    }
    if (data.newPassword !== data.confirmPassword) {
      setFormError(form, "confirmPassword", "كلمتا المرور غير متطابقتين.");
      return appToast.error("كلمتا المرور غير متطابقتين", { description: "أعد كتابة كلمة المرور الجديدة بشكل مطابق.", id: "password-mismatch" });
    }
    if (data.newPassword === data.currentPassword) return appToast.warning("اختر كلمة مرور مختلفة", { description: "يجب ألا تطابق كلمة المرور الجديدة كلمة المرور السابقة.", id: "password-same" });
    const button = form.querySelector("button[type='submit'], button:not([type])");
    if (button) { button.disabled = true; button.textContent = "جارٍ التحديث..."; }
    try {
      await fetchJson("/api/settings/security/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      form.reset();
      state.securityScore = null;
      appToast.success("تم تغيير كلمة المرور بنجاح", { description: "تم إنهاء الجلسات الأخرى وتحديث بيانات الحماية.", id: "password-changed" });
      if (button) { button.disabled = false; button.textContent = "تحديث كلمة المرور"; }
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = "تحديث كلمة المرور"; }
      const firstError = Object.values(error.payload?.errors || {}).flat()[0];
      if (error.code === "invalid_current_password") appToast.error("تعذر تغيير كلمة المرور", { description: "كلمة المرور الحالية غير صحيحة.", id: "password-current-invalid" });
      else appToast.error("تعذر تغيير كلمة المرور", { description: firstError || "راجع البيانات المدخلة ثم حاول مرة أخرى.", id: "password-change-error" });
    }
    return;
  }
  if (type === "profile-settings") {
    await saveProfileSettings(data, form);
    return;
  }
  if (type === "mfa-verify") {
    try {
      const payload = await fetchJson("/api/settings/security/mfa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: data.code }) });
      openModal("رموز الاسترداد", `<div class="grid"><p>احفظ هذه الرموز في مكان آمن. لن تظهر مرة أخرى.</p><div class="recovery-code-grid">${payload.recoveryCodes.map((code) => `<code>${escapeHtml(code)}</code>`).join("")}</div><button class="btn btn-primary" data-action="close-modal">حفظت الرموز</button></div>`);
      state.accountSettings = null; state.securityScore = null; await syncRouteData(true);
      appToast.success("تم التحقق من هويتك", { description: "تم تفعيل المصادقة الثنائية ورفع حماية حسابك.", id: "mfa-enabled" });
    } catch { appToast.error("رمز المصادقة غير صحيح", { description: "تحقق من الرمز الحالي في تطبيق المصادقة.", id: "mfa-invalid" }); }
    return;
  }
  if (type === "mfa-disable") {
    try {
      await fetchJson("/api/settings/security/mfa/disable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: data.password || "", code: data.code || "" }) });
      closePortal(); state.accountSettings = null; await syncRouteData(true); toast("تم إيقاف المصادقة الثنائية");
    } catch (error) { toast(error.message || "تعذر إيقاف المصادقة الثنائية", "danger"); }
    return;
  }
  if (type === "customer-import") {
    const lines = String(data.text || "").trim().split(/\r?\n/).filter(Boolean);
    const rows = lines.slice(1).map((line) => {
      const [name, email, phone] = line.split(",").map((value) => value?.trim());
      return { name, email, phone };
    }).filter((row) => row.name);
    if (!rows.length) return toast("لا توجد صفوف صالحة للاستيراد", "warning");
    let saved = 0;
    for (const row of rows) {
      try {
        await fetchJson("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(row) });
        saved += 1;
      } catch {}
    }
    closePortal(); state.dbCustomers = null; state.dashboardOverview = null; await syncRouteData(true);
    toast(`تم استيراد ${saved} عميل`);
    return;
  }
  if (["demo", "ticket", "chat", "message", "template", "ai-question"].includes(type)) {
    closePortal();
    toast(type === "ai-question" ? "تم استلام سؤالك، سيتم ربط المساعد الذكي لاحقًا." : "تم حفظ البيانات بنجاح");
  }
}

function render() {
  applyPreferences();
  const requestedRoute = location.pathname;
  const normalizedRoute = dashboardAliases[requestedRoute] || requestedRoute;
  if (normalizedRoute !== requestedRoute) history.replaceState({}, "", normalizedRoute + location.search);
  state.route = normalizedRoute;
  state.query = new URLSearchParams(location.search);
  if (state.route.startsWith("/dashboard")) {
    const pages = {
      "/dashboard": dashboardHome,
      "/dashboard/subscriptions": subscriptionsPage,
      "/dashboard/customers": customersPage,
      "/dashboard/renewal-template": renewalTemplatePage,
      "/dashboard/devices": devicesWorkspacePage,
      "/dashboard/order-links": orderLinksWorkspacePage,
      "/dashboard/apps": appsPage,
      "/dashboard/notifications": notificationsPage,
      "/dashboard/security": securityPage,
      "/dashboard/reports": reportsPage,
      "/dashboard/billing": billingWorkspacePage,
      "/dashboard/settings": settingsPage
    };
    app.innerHTML = (pages[state.route] || dashboardHome)();
    localizeElement(app);
    ensurePasswordToggles();
    bindQrImageState();
    syncRouteData();
    return;
  }
  const pages = {
    "/": marketingHomePage,
    "/features": marketingFeaturesPage,
    "/pricing": marketingPricingPage,
    "/blog": blogPage,
    "/support": marketingSupportPage,
    "/about": aboutPage,
    "/login": authPublicPage,
    "/register": authPublicPage,
    "/forgot-password": forgotPublicPage,
    "/reset-password": forgotPublicPage,
    "/privacy": policyPage,
    "/terms": policyPage,
    "/refund-policy": policyPage,
    "/contact": policyPage
  };
  const page = state.route.startsWith("/blog/") ? articlePage : state.route.startsWith("/o/") ? publicOrderPage : pages[state.route] || marketingHomePage;
  app.innerHTML = page();
  localizeElement(app);
  ensurePasswordToggles();
}

function bindQrImageState() {
  const images = [...app.querySelectorAll("img.qr-real")];
  if (!images.length) return;

  const markFailed = () => {
    if (!state.linkedDevice.qrBase64) return;
    const message = "تعذر عرض الباركود في المتصفح. يرجى إعادة إنشاء الباركود.";
    state.linkedDevice = { ...state.linkedDevice, status: "error", qrActive: false, qrImageLoaded: false, qrBase64: "", qrError: message };
    toast(message, "danger");
    render();
  };
  const markLoaded = () => {
    if (!images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)) return;
    if (state.linkedDevice.qrImageLoaded) return;
    state.linkedDevice = { ...state.linkedDevice, qrImageLoaded: true };
    render();
  };

  images.forEach((image) => {
    image.addEventListener("load", markLoaded, { once: true });
    image.addEventListener("error", markFailed, { once: true });
  });
  markLoaded();
  requestAnimationFrame(markLoaded);
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-link]");
  if (link) {
    event.preventDefault();
    navigate(link.dataset.link);
    return;
  }
  const action = event.target.closest("[data-action]");
  if (action) {
    if ((action.classList.contains("modal-overlay") || action.classList.contains("drawer-overlay")) && event.target !== action) return;
    handleAction(action);
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-submit]");
  if (form) handleSubmit(form, event);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && portal.innerHTML) closePortal();
});

document.addEventListener("input", (event) => {
  const target = event.target;
  const profileForm = target.closest?.('[data-submit="profile-settings"]');
  if (profileForm) {
    const nameChanged = String(profileForm.elements.fullName?.value || "").trim() !== String(profileForm.dataset.originalName || "");
    const storeChanged = profileForm.elements.storeName && !profileForm.elements.storeName.disabled && String(profileForm.elements.storeName.value || "").trim() !== String(profileForm.dataset.originalStore || "");
    const phoneChanged = String(profileForm.elements.phone?.value || "").trim() !== String(profileForm.dataset.originalPhone || "");
    const button = profileForm.querySelector(".profile-save-button");
    if (button) button.disabled = !(nameChanged || storeChanged || phoneChanged);
  }
  if (target.dataset.emailField !== undefined) refreshEmailTemplatePreview();
  if (target.dataset.sallaRuleField) {
    const index = Number(target.dataset.ruleIndex);
    const drafts = readSallaRuleDrafts();
    if (drafts[index]) drafts[index][target.dataset.sallaRuleField] = target.dataset.sallaRuleField === "durationDays" ? Number(target.value) : target.value;
    state.sallaRuleDrafts = drafts;
  }
  if (target.dataset.action === "dashboard-search" || target.dataset.action === "global-search" || target.dataset.action === "support-search" || target.dataset.action === "notification-search") {
    state.search = target.value;
    if (target.dataset.action !== "global-search") render();
  }
  if (target.dataset.action === "pairing-phone-input") {
    state.linkedDevice.phoneInput = target.value;
  }
  if (target.dataset.orderField) {
    state.orderLinkDraft[target.dataset.orderField] = target.type === "checkbox" ? target.checked : target.value;
    refreshOrderLinkPreview();
  }
  if (target.dataset.orderNote !== undefined) {
    state.orderLinkDraft.additionalNotes[Number(target.dataset.orderNote)] = target.value;
    refreshOrderLinkPreview();
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.action === "avatar-file" && target.files?.[0]) {
    void (async () => {
      try {
        const file = target.files[0];
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("اختر صورة PNG أو JPG أو WebP.");
        if (file.size > 2 * 1024 * 1024) throw new Error("يجب ألا يتجاوز حجم الصورة 2 ميجابايت.");
        const formData = new FormData();
        formData.append("file", file);
        await fetchJson("/api/settings/profile/avatar", { method: "POST", body: formData });
        state.accountSettings = null; state.dashboardOverview = null;
        await syncRouteData(true);
        toast("تم تحديث الصورة الشخصية بنجاح.");
      } catch (error) { toast(error.message || "تعذر رفع الصورة", "danger"); }
    })();
  }
  if (target.dataset.sallaSetting && state.sallaSettingsOpen) {
    const current = state.appsOverview?.connection || {};
    if (target.type === "checkbox") current[target.dataset.sallaSetting] = target.checked;
    else current[target.dataset.sallaSetting] = target.value;
    state.appsOverview.connection = current;
    render();
  }
  if (target.dataset.action === "dashboard-filter") {
    state.filter = target.value;
    render();
  }
  if (target.dataset.action === "notification-filter") {
    state.notificationFilter = target.value;
    render();
  }
  if (target.dataset.action === "subscription-window") {
    state.subscriptionWindow = target.value;
    render();
  }
  if (target.dataset.action === "preference-select") {
    const value = target.value;
    const key = target.dataset.preference;
    if (key === "language") state.language = value === "en" ? "en" : "ar";
    if (key === "theme") state.theme = ["light", "dark", "system"].includes(value) ? value : "light";
    localStorage.setItem("renewpilot_locale", state.language);
    localStorage.setItem("renewpilot_theme", state.theme);
    applyPreferences();
    void saveInterfacePreferences({ [key]: value }).then(() => toast("تم حفظ تفضيلات الواجهة")).catch((error) => toast(error.message || "تعذر حفظ التفضيلات", "danger"));
  }
  if (target.dataset.action === "notification-preference") {
    void saveNotificationPreference(target.dataset.key, target.checked).catch((error) => { target.checked = !target.checked; toast(error.message || "تعذر حفظ الإشعارات", "danger"); });
  }
  if (target.dataset.action === "report-period") {
    state.reportPeriod = target.value;
    render();
  }
  if (target.dataset.action === "template-channel") {
    state.templateChannel = target.value === "email" ? "email" : "whatsapp";
    render();
  }
  if (target.dataset.action === "template-custom-theme") {
    const form = target.closest("form");
    const color = safeEmailTheme(target.value);
    const hidden = form?.querySelector("input[name='themeColor']");
    if (hidden) hidden.value = color;
    form?.querySelectorAll(".email-color").forEach((button) => button.classList.toggle("active", button.dataset.color === color));
    refreshEmailTemplatePreview();
  }
  if (target.dataset.orderField) {
    state.orderLinkDraft[target.dataset.orderField] = target.type === "checkbox" ? target.checked : target.value;
    if (target.dataset.orderField === "customerId") {
      const subscriptions = Array.isArray(state.orderLinkSubscriptions) ? state.orderLinkSubscriptions : [];
      if (!subscriptions.some((item) => item.id === state.orderLinkDraft.subscriptionId && item.customerId === target.value)) {
        state.orderLinkDraft.subscriptionId = "";
      }
      render();
    } else if (target.dataset.orderField === "subscriptionId") render();
    else refreshOrderLinkPreview();
  }
  if (target.dataset.orderVisible) {
    state.orderLinkDraft.visibleFields[target.dataset.orderVisible] = target.checked;
    refreshOrderLinkPreview();
  }
});

window.addEventListener("popstate", render);
render();
if (state.route === "/dashboard/devices") void syncLinkedDevice();
