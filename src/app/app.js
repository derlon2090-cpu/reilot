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
  "أنشئ باركود حقيقي من Evolution API.": "Generate a real QR code from Evolution API.",
  "غير متوفر": "Unavailable",
  "لا يظهر الرمز إلا بعد طلبه من Evolution API": "The code appears only after it is returned by Evolution API",
  "لا يوجد رمز بعد": "No code yet",
  "رمز الاقتران غير مدعوم حاليا في نسخة Evolution API المثبتة. استخدم الربط بالباركود.": "Pairing codes are not supported by the installed Evolution API version. Use QR linking.",
  "تم إيقاف الإرسال التلقائي": "Automatic sending paused"
};

Object.assign(operationalEnglishPhrases, {
  "✦ منصة متكاملة لإدارة الاشتراكات والتجديدات": "✦ An integrated subscription and renewal platform",
  "أدر تجديدات اشتراكاتك، تابع عملاءك،": "Manage subscription renewals and follow your customers,",
  "وفعّل التذكيرات": "and automate reminders",
  "بذكاء واحترافية": "intelligently and professionally",
  "RenewPilot AI يساعدك على أتمتة عمليات التجديد، متابعة العملاء، وإرسال التذكيرات بسهولة وأمان، مع تقارير ذكية تمنحك رؤية أوضح لنمو عملك.": "RenewPilot AI automates renewals, customer follow-up, and secure reminders, with smart reports that make growth clearer.",
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
  "جرّب RenewPilot AI مجانًا واستمتع بإدارة سلسة وفعالة دون تعقيد.": "Try RenewPilot AI free and manage renewals smoothly without complexity.",
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
  "ما هو RenewPilot AI وكيف يعمل؟": "What is RenewPilot AI and how does it work?",
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
  "طبّق هذه الخطوات في RenewPilot AI": "Put these steps into practice with RenewPilot AI",
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
  settings: { whatsapp: false, email: false, sms: false, twoFactor: false, renewAuto: false },
  linkedDevice: { ...defaultLinkedDevice }
};

state.dbSubscriptions = null;
state.dbCustomers = null;
state.dashboardOverview = null;
state.activities = null;
state.unsubscribes = null;
state.accountSettings = null;
state.readiness = null;
state.operationalIssues = null;
state.whatsappHealth = null;
state.notificationTemplate = null;
state.billingOverview = null;
state.orderLinkProfile = null;
state.orderLinkTemplates = null;
state.orderLinkSubscriptions = null;
state.orderLinks = null;
state.publicOrder = null;
state.publicOrderLoading = false;
state.publicOrderLookup = "";
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
  footerText: "RenewPilot AI",
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
  ["/dashboard/security", "الحماية", "security"],
  ["/dashboard/reports", "التقارير", "reports"],
  ["/dashboard/billing", "الفوترة والباقات", "billing"],
  ["/dashboard/settings", "الإعدادات", "settings"]
];

const dashboardAliases = {
  "/dashboard/renewals": "/dashboard/subscriptions",
  "/dashboard/notifications": "/dashboard/customers",
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
  document.documentElement.dataset.theme = state.theme;
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
    state[target] = target === "orderLinks"
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
  if (["/dashboard", "/dashboard/subscriptions"].includes(state.route) && (force || state.dbSubscriptions === null)) void loadRemotePage("subscriptions", "/api/subscriptions", "dbSubscriptions");
  if (["/dashboard", "/dashboard/subscriptions", "/dashboard/customers", "/dashboard/order-links"].includes(state.route) && (force || state.dbCustomers === null)) void loadRemotePage("customers", "/api/customers", "dbCustomers");
  if (state.route === "/dashboard/security" && (force || state.unsubscribes === null)) void loadRemotePage("unsubscribes", "/api/unsubscribes", "unsubscribes");
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

async function ensureEvolutionInstance(options = {}) {
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
  return `<button class="brand btn-ghost" data-link="${destination}" aria-label="RenewPilot AI">
    <img class="brand-logo" src="/assets/renewpilot-logo-horizontal.png" alt="RenewPilot AI">
  </button>`;
}

function stackedLogo() {
  return `<img class="brand-logo-stacked" src="/assets/renewpilot-logo-stacked.png" alt="RenewPilot AI">`;
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
    billing: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
    notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.61.65 1.05 1.27 1.05H21v4h-.08c-.63 0-1.16.44-1.52 1z"/>'
  };
  return `<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.home}</svg>`;
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
    <div class="footer-brand-mini">${logo()}<span>© 2026 RenewPilot AI. جميع الحقوق محفوظة.</span></div>
    <nav class="footer-links" aria-label="روابط سريعة"><button data-link="/about">عن المنصة</button><button data-link="/privacy">سياسة الخصوصية</button><button data-link="/terms">سياسة الاستخدام</button><button data-link="/refund-policy">سياسة الاستبدال والاسترجاع</button><button data-link="/support">الدعم</button><button data-link="/contact">تواصل معنا</button><button data-link="/blog">المدونة</button></nav>
    <div class="footer-social"><a href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">in</a><a href="https://www.youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube">▶</a><a href="https://x.com" target="_blank" rel="noreferrer" aria-label="X">X</a><a href="https://wa.me/" target="_blank" rel="noreferrer" aria-label="WhatsApp">◉</a></div>
  </div></footer>`;
}

function pageHero(title, lead, actions = "") {
  return `<section class="page-hero">
    <div class="container">
      <span class="eyebrow">RenewPilot AI</span>
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
  return `<article class="dashboard-reference"><img src="/assets/dashboard-preview.png" alt="معاينة لوحة تحكم RenewPilot AI"></article>`;
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
      <article class="card table-card"><h2>مساعد RenewPilot AI</h2><p class="muted">اكتب سؤالك وسنعرض ردًا مبدئيًا إلى حين ربط المساعد.</p><form data-submit="ai-question"><textarea class="textarea" name="question" required placeholder="اكتب سؤالك هنا"></textarea><br><button class="btn btn-primary">إرسال السؤال</button></form></article>
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
      <div class="marketing-copy"><span class="eyebrow">✦ منصة متكاملة لإدارة الاشتراكات والتجديدات</span><h1>أدر تجديدات اشتراكاتك، تابع عملاءك،<br>وفعّل التذكيرات <span>بذكاء واحترافية</span></h1><p class="lead">RenewPilot AI يساعدك على أتمتة عمليات التجديد، متابعة العملاء، وإرسال التذكيرات بسهولة وأمان، مع تقارير ذكية تمنحك رؤية أوضح لنمو عملك.</p><div class="hero-actions"><button class="btn btn-primary" data-link="/register">ابدأ الآن</button><button class="btn btn-secondary" data-link="/features">استكشف المميزات</button></div></div>
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
    <section class="section section-tight"><div class="container"><div class="card public-cta"><div class="cta-logo"><img src="/assets/renewpilot-logo-horizontal.png" alt="RenewPilot AI"></div><div><h2>ابدأ إدارة اشتراكاتك بطريقة ذكية اليوم</h2><p>جرّب RenewPilot AI مجانًا واستمتع بإدارة سلسة وفعالة دون تعقيد.</p></div><div class="hero-actions"><button class="btn btn-primary" data-link="/register">إنشاء حساب مجاني</button><button class="btn btn-secondary" data-action="open-demo">احجز عرضًا تجريبيًا</button></div></div></div></section></main>`);
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
  return publicShell(`<main class="article-page"><section class="article-hero"><div class="container"><span class="badge">${post.category}</span><h1>${localizedField(post.title)}</h1><p>${localizedField(post.excerpt)}</p><small>${localizedField(post.date)} · ${localizedField(post.minutes)}</small></div></section><article class="container article-body"><img class="article-cover" src="${post.image}" alt="${escapeHtml(localizedField(post.title))}"><div class="article-content"><p class="article-lead">${localizedCopy("في هذا الدليل ستجد خطوات عملية يمكنك تطبيقها مباشرة لبناء تجربة تجديد أوضح وأكثر أمانًا وقابلية للقياس.", "This guide gives you practical steps you can apply immediately to build a clearer, safer, and more measurable renewal experience.")}</p>${post.sections.map((section, index) => `<section><span>${String(index + 1).padStart(2, "0")}</span><div><h2>${localizedField(section.heading)}</h2><p>${localizedField(section.body)}</p></div></section>`).join("")}<aside class="article-takeaways"><h2>${localizedCopy("خلاصة عملية", "Practical takeaways")}</h2><ul>${takeaways.map((item) => `<li>${item}</li>`).join("")}</ul></aside></div><div class="public-cta"><div><h2>${localizedCopy("طبّق هذه الخطوات في RenewPilot AI", "Put these steps into practice with RenewPilot AI")}</h2><p>${localizedCopy("ابدأ بإدارة تجديداتك من لوحة موحدة وآمنة.", "Manage renewals from one clear and secure workspace.")}</p></div><button class="btn btn-primary" data-link="/register">${localizedCopy("ابدأ الآن", "Get started")}</button></div></article></main>`);
}

function marketingSupportPage() {
  const cards = [["مركز المساعدة", "أدلة شاملة ومقالات لمساعدتك خطوة بخطوة.", "تصفح المقالات", "#help-center", "template"], ["الأسئلة الشائعة", "إجابات سريعة لأكثر الأسئلة شيوعًا.", "عرض الأسئلة", "#faq", "security"], ["الدردشة", "تحدث مباشرة مع فريق الدعم.", "ابدأ المحادثة", "open-chat", "customers"], ["تواصل عبر البريد", "راسلنا وسنرد عليك خلال 24 ساعة عمل.", "راسلنا الآن", "open-email", "template"]];
  return publicShell(`<main class="support-page"><section class="section support-hero"><div class="container support-intro-row"><div class="support-intro-copy"><span class="eyebrow">نحن هنا لمساعدتك</span><h1>مركز الدعم</h1><p>ابحث في مقالات المساعدة، تواصل مع فريق الدعم، أو أرسل طلبك وسنعود إليك بأقرب وقت.</p></div><div class="support-cards">${cards.map(([title, body, label, action, mark]) => `<article class="card">${dashboardIcon(mark)}<h2>${title}</h2><p>${body}</p>${action.startsWith("#") ? `<a class="btn btn-secondary" href="/support${action}">${label}</a>` : `<button class="btn btn-secondary" data-action="${action}">${label}</button>`}</article>`).join("")}</div></div></section>
    <section class="section support-body"><div class="container support-layout"><article class="card help-center" id="help-center"><h2>مركز المساعدة</h2>${knowledgeBase.slice(0, 5).map((item) => `<button data-action="knowledge" data-term="${item}">${dashboardIcon("template")}<span><strong>${item}</strong><small>تعرف على التفاصيل والخطوات الأساسية.</small></span><b>‹</b></button>`).join("")}</article><article class="card faq-panel" id="faq"><h2>ابحث في مقالات المساعدة</h2><input class="input" data-action="support-search" placeholder="ابحث عن حلول ومقالات..."><h2>الأسئلة الشائعة</h2>${["ما هو RenewPilot AI وكيف يعمل؟", "كيف يمكنني ربط حسابي في واتساب؟", "هل يمكنني إلغاء اشتراكي في أي وقت؟", "ما هي طرق الدفع المتاحة؟", "كيف أتابع أداء حملاتي وتقاريري؟"].map((q) => `<details><summary>${q}</summary><p>ستجد الخطوات داخل مركز المساعدة، ويمكن لفريق الدعم مساعدتك إذا احتجت إلى توجيه إضافي.</p></details>`).join("")}</article><article class="card support-form-card"><h2>أرسل لنا طلب دعم</h2><p>صف مشكلتك أو استفسارك وسنقوم بالرد عليك.</p><form data-submit="support-request" class="grid"><label class="field"><span>الاسم الكامل</span><input class="input" name="name" required></label><label class="field"><span>البريد الإلكتروني</span><input class="input" type="email" name="email" required></label><label class="field"><span>الموضوع</span><select class="select" name="subject" required><option value="">اختر موضوع الطلب</option><option>مشكلة تقنية</option><option>الفوترة والباقات</option><option>ربط الأجهزة</option></select></label><label class="field"><span>تفاصيل الطلب</span><textarea class="textarea" name="details" required></textarea></label><button class="btn btn-primary">إرسال الطلب</button></form></article></div></section><section class="section section-tight"><div class="container trust-band"><span>▢ آمن وموثوق</span><span>◇ خبراء المنتجات</span><span>♬ دعم على مدار الساعة</span><span>◷ متوسط الرد أقل من ساعتين</span></div></section></main>`);
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
  return publicShell(`<main class="about-page"><section class="about-hero"><div class="container about-hero-grid"><div><span class="eyebrow">${localizedCopy("عن RenewPilot AI", "About RenewPilot AI")}</span><h1>${localizedCopy("منصة سعودية لإدارة الاشتراكات والتجديدات باحترافية", "A Saudi platform for professional subscription and renewal management")}</h1><p>${localizedCopy("نجمع بيانات العملاء والاشتراكات والتنبيهات والأجهزة والتقارير في مساحة عمل واحدة، حتى تتمكن فرق الأعمال من متابعة التجديدات واتخاذ قرارات أوضح دون عمليات يدوية مشتتة.", "We bring customers, subscriptions, reminders, devices, and reports into one workspace so teams can manage renewals and make clearer decisions without fragmented manual work.")}</p><div class="hero-actions"><button class="btn btn-primary" data-link="/register">${localizedCopy("إنشاء حساب", "Create account")}</button><button class="btn btn-secondary" data-link="/features">${localizedCopy("استكشف المميزات", "Explore features")}</button></div></div><div class="about-brand-visual">${stackedLogo()}<strong>${localizedCopy("إدارة أوضح. تواصل أذكى. نمو مستمر.", "Clearer management. Smarter communication. Sustainable growth.")}</strong></div></div></section>
    <section class="section about-story"><div class="container"><div class="section-head"><div><span class="eyebrow">${localizedCopy("رؤيتنا", "Our vision")}</span><h2>${localizedCopy("نبني تجربة تجعل التجديد جزءًا من رحلة العميل", "We make renewal a natural part of the customer journey")}</h2><p>${localizedCopy("صُممت RenewPilot AI للشركات التي تريد تقليل الاشتراكات المنتهية، تنظيم التواصل، وحماية سمعة قنواتها أثناء النمو.", "RenewPilot AI is built for companies that want fewer expired subscriptions, organized communication, and healthier channels as they grow.")}</p></div></div><div class="about-value-grid">${values.map(([arTitle, enTitle, arBody, enBody, mark]) => `<article><span>${dashboardIcon(mark)}</span><h3>${localizedCopy(arTitle, enTitle)}</h3><p>${localizedCopy(arBody, enBody)}</p></article>`).join("")}</div></div></section>
    <section class="section about-principles"><div class="container about-principles-grid"><div><span class="eyebrow">${localizedCopy("كيف نعمل", "How we work")}</span><h2>${localizedCopy("منتج عملي يركز على النتائج", "A practical product focused on outcomes")}</h2><p>${localizedCopy("نطوّر المنصة حول احتياجات فرق الاشتراكات وخدمة العملاء: إعداد بسيط، واجهة عربية واضحة، تكاملات قابلة للمراقبة، وسجل نشاط يحفظ سياق كل عملية.", "We build around the needs of subscription and customer teams: simple setup, a clear bilingual interface, observable integrations, and an activity trail for every action.")}</p></div><div class="about-points">${principles.map(([arTitle, enTitle, arBody, enBody], index) => `<div><b>${String(index + 1).padStart(2, "0")}</b><span><strong>${localizedCopy(arTitle, enTitle)}</strong><small>${localizedCopy(arBody, enBody)}</small></span></div>`).join("")}</div></div></section><section class="section"><div class="container"><div class="public-cta"><div><h2>${localizedCopy("ابدأ إدارة تجديداتك من مكان واحد", "Manage renewals from one workspace")}</h2><p>${localizedCopy("أنشئ مساحة عملك وابدأ بإضافة عملائك واشتراكاتك دون بيانات افتراضية.", "Create your workspace and add customers and subscriptions without demo data.")}</p></div><button class="btn btn-primary" data-link="/register">${localizedCopy("ابدأ الآن", "Get started")}</button></div></div></section></main>`);
}

function policyPage() {
  const policies = {
    "/privacy": { title: "سياسة الخصوصية", intro: "توضح هذه السياسة كيف تجمع RenewPilot AI البيانات اللازمة لتقديم الخدمة، وكيف نحميها ونمنحك التحكم فيها.", sections: [["البيانات التي نجمعها", "نجمع بيانات الحساب ومساحة العمل والعملاء والاشتراكات وسجلات التشغيل التي تدخلها أو تنشئها أثناء استخدام المنصة. كما نسجل معلومات تقنية محدودة لازمة للأمان وتشخيص الأعطال."], ["كيف نستخدم البيانات", "نستخدم البيانات لتشغيل خصائص المنصة، إرسال التنبيهات التي يطلبها المستخدم، تحسين الاعتمادية، منع إساءة الاستخدام، وتقديم الدعم. لا نبيع بيانات العملاء ولا نستخدمها لإعلانات خارجية."], ["الحماية والعزل", "تُعزل بيانات كل مؤسسة بواسطة معرّف مساحة العمل، وتُطبق ضوابط وصول على الواجهات البرمجية وقاعدة البيانات. تُحفظ الأسرار في بيئة الخادم ولا تُرسل إلى المتصفح."], ["مقدمو الخدمات", "قد نعتمد على مزودين موثوقين للبنية التحتية والبريد والرسائل وقواعد البيانات. يقتصر وصولهم على ما يلزم لتقديم الخدمة وفق شروطهم واتفاقياتهم الأمنية."], ["الاحتفاظ والحذف", "نحتفظ بالبيانات طوال مدة الحساب أو حسب الحاجة النظامية والتشغيلية. يمكنك طلب تصحيح بياناتك أو تصديرها أو حذفها عبر مركز الدعم، مع مراعاة السجلات التي يجب الاحتفاظ بها نظاميًا."], ["حقوقك وخياراتك", "يمكنك إدارة إعدادات الإشعارات، تحديث الملف الشخصي، مراجعة الجلسات، وإيقاف الرسائل لعملاء محددين. للاستفسارات المتعلقة بالخصوصية تواصل معنا عبر قناة الدعم الرسمية."]] },
    "/terms": { title: "سياسة الاستخدام والشروط", intro: "تنظم هذه الشروط استخدام RenewPilot AI وتحدد مسؤوليات صاحب الحساب والمستخدمين المخولين.", sections: [["قبول الشروط", "بإنشاء حساب أو استخدام المنصة فإنك توافق على هذه الشروط والسياسات المرتبطة بها، وتؤكد أن لديك الصلاحية لإدارة مساحة العمل والبيانات المضافة إليها."], ["الحساب والصلاحيات", "أنت مسؤول عن دقة بيانات الحساب، حماية كلمة المرور، ومراجعة المستخدمين المخولين. يجب إبلاغنا فورًا عن أي استخدام غير مصرح به أو نشاط مشبوه."], ["الاستخدام المقبول", "يُمنع استخدام المنصة لإرسال رسائل غير مرغوبة، انتحال الهوية، انتهاك الخصوصية، أو مخالفة أنظمة الاتصالات والتجارة الإلكترونية. يجب الحصول على الموافقات اللازمة من المستلمين."], ["القنوات والتكاملات", "تخضع خدمات واتساب والبريد والتكاملات الخارجية لتوفر مزوديها وشروطهم. يتحمل صاحب الحساب مسؤولية صحة الإعدادات والأرقام والقوالب المستخدمة."], ["الاشتراكات والفوترة", "تُعرض الأسعار والحدود قبل اختيار الخطة. قد تتغير المزايا والأسعار مستقبلًا بعد إشعار مناسب، وتستمر الفواتير المستحقة عن الفترات التي تم فيها استخدام الخدمة."], ["التعليق والإنهاء", "يجوز تعليق الحساب لحماية المنصة أو المستلمين عند وجود إساءة استخدام أو خطر أمني. يمكن لصاحب الحساب إلغاء الخدمة وفق إعدادات الخطة وسياسة الاسترجاع المعتمدة."]] },
    "/refund-policy": { title: "سياسة الاستبدال والاسترجاع", intro: "نهدف إلى معالجة طلبات الفوترة بعدالة ووضوح وفق نوع الخطة، تاريخ العملية، والاستخدام الفعلي للخدمة.", sections: [["أهلية طلب الاسترجاع", "يمكن تقديم طلب مراجعة خلال المدة الموضحة عند الشراء إذا حدث خصم مكرر، خطأ تقني موثق، أو تعذر جوهري في تقديم الخدمة المدفوعة."], ["الحالات غير المؤهلة", "لا يشمل الاسترجاع عادةً الأرصدة أو الرسائل المستخدمة، الفترات المستهلكة، مخالفة سياسة الاستخدام، أو توقف خدمة خارجية لا تتحكم بها RenewPilot AI."], ["طريقة تقديم الطلب", "أرسل طلبًا من مركز الدعم يتضمن بريد الحساب ورقم الفاتورة ووصف المشكلة. لا ترسل بيانات بطاقتك أو كلمات المرور داخل الطلب."], ["المراجعة والمعالجة", "يراجع الفريق السجلات والفاتورة والاستخدام، ثم يرسل القرار عبر البريد المسجل. تعتمد مدة ظهور المبلغ على بوابة الدفع والبنك المصدر."], ["تغيير الخطة", "يمكن ترقية الخطة في أي وقت. أما التخفيض فيُطبق عادةً من دورة الفوترة التالية حتى لا تتأثر المزايا المدفوعة خلال الدورة الحالية."], ["الأسئلة المتعلقة بالفوترة", "لأي استفسار أو اعتراض استخدم نموذج الدعم واختر قسم الفوترة والباقات، وسيتواصل الفريق معك بالمعلومات المطلوبة دون طلب بيانات حساسة."]] },
    "/contact": { title: "تواصل معنا", intro: "اختر القناة المناسبة وسنوجه طلبك إلى الفريق المختص بأسرع وقت ممكن.", sections: [["الدعم الفني", "لأخطاء الحساب، ربط الأجهزة، الجلسات، أو التكاملات استخدم نموذج مركز الدعم وأرفق وصفًا واضحًا ووقت حدوث المشكلة دون مشاركة أي مفتاح سري."], ["المبيعات والباقات", "للاستفسار عن الخطط وحدود الاستخدام واحتياجات المؤسسات، أرسل طلبًا بعنوان المبيعات والباقات مع حجم الفريق وعدد العملاء المتوقع."], ["الفوترة", "للفواتير أو المدفوعات اذكر رقم الفاتورة والبريد المسجل فقط. لن يطلب فريقنا كلمة المرور أو رمز التحقق أو بيانات البطاقة الكاملة."], ["الأمان والخصوصية", "للإبلاغ عن مشكلة أمنية أو طلب متعلق ببياناتك، استخدم قناة الدعم واكتب بوضوح أن الطلب متعلق بالأمان أو الخصوصية ليتم تصعيده للفريق المختص."], ["أوقات الاستجابة", "نراجع الطلبات حسب الأولوية والتأثير. تظهر الحالات الحرجة المتعلقة بتعطل الخدمة أو الأمان في مقدمة قائمة المعالجة."], ["البريد الرسمي", "يمكن مراسلتنا عبر support@renewpilot.ai، أو استخدام مركز الدعم للحصول على رقم مرجعي ومتابعة حالة الطلب."]] }
  };
  const englishPolicies = {
    "/privacy": { title: "Privacy Policy", intro: "This policy explains which data RenewPilot AI needs to provide the service, how it is protected, and the controls available to you.", sections: [["Data we collect", "We collect account, workspace, customer, subscription, and operational data that you enter or create while using the platform. Limited technical information is recorded for security and troubleshooting."], ["How we use data", "We use data to operate platform features, send reminders requested by users, improve reliability, prevent abuse, and provide support. We do not sell customer data or use it for external advertising."], ["Protection and isolation", "Each organization is isolated by its tenant identifier, with access controls enforced across APIs and the database. Service credentials remain on the server and are never sent to the browser."], ["Service providers", "Trusted infrastructure, email, messaging, and database providers may process only the information necessary to deliver their services under their own security terms."], ["Retention and deletion", "Data is retained while the account is active or where operational and legal requirements apply. You can request correction, export, or deletion through the support center."], ["Your rights and choices", "You can manage notifications, update your profile, review sessions, and stop messages for selected customers. Privacy questions can be submitted through the official support channel."]] },
    "/terms": { title: "Terms of Use", intro: "These terms govern the use of RenewPilot AI and explain the responsibilities of account owners and authorized users.", sections: [["Accepting the terms", "By creating an account or using the platform, you agree to these terms and related policies and confirm that you are authorized to manage the workspace and its data."], ["Accounts and permissions", "You are responsible for accurate account information, password protection, and reviewing authorized users. Report unauthorized access or suspicious activity immediately."], ["Acceptable use", "The platform must not be used for unsolicited messaging, impersonation, privacy violations, or conduct that breaches communications and commerce regulations. Required recipient consent must be obtained."], ["Channels and integrations", "WhatsApp, email, and third-party integrations are subject to provider availability and terms. The account owner is responsible for the numbers, templates, and settings used."], ["Subscriptions and billing", "Prices and limits are shown before a plan is selected. Features and prices may change with appropriate notice, while charges remain due for periods in which the service was used."], ["Suspension and termination", "Accounts may be suspended to protect the platform or recipients when abuse or security risk is detected. Owners may cancel according to plan settings and the applicable refund policy."]] },
    "/refund-policy": { title: "Refund Policy", intro: "We review billing requests fairly and transparently according to the plan, transaction date, and actual service usage.", sections: [["Refund eligibility", "A review may be requested within the period shown at purchase when there is a duplicate charge, a documented technical error, or a material failure to deliver the paid service."], ["Non-eligible cases", "Refunds generally exclude used credits or messages, consumed billing periods, policy violations, and third-party outages outside RenewPilot AI's control."], ["Submitting a request", "Send a support request with the account email, invoice number, and a description of the issue. Never include card details or passwords."], ["Review and processing", "The team reviews logs, the invoice, and usage before sending a decision to the registered email. Bank and payment gateway processing times may vary."], ["Changing plans", "Plans can be upgraded at any time. Downgrades usually apply from the next billing cycle so current paid features remain available until the cycle ends."], ["Billing questions", "Select Billing and Plans in the support form for any question or dispute. The team will request only the information needed and never sensitive credentials."]] },
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
  return `<main class="auth-light-page"><header class="auth-light-header">${logo()}<button class="link-button" data-link="/">العودة إلى الرئيسية ←</button></header><section class="reset-light-shell"><article class="card reset-light-panel"><span class="reset-lock">▢</span><h1>نسيت كلمة المرور</h1><p>${step === 1 ? "لا مشكلة، أدخل بريدك الإلكتروني المرتبط بحسابك وسنرسل لك رابطًا آمنًا لإعادة تعيين كلمة المرور." : step === 2 ? "أدخل رمز التحقق الذي أرسلناه إلى بريدك ثم اختر كلمة مرور جديدة." : "يمكنك الآن العودة إلى حسابك."}</p>${content}<p class="muted">إذا كان البريد موجودًا فسيصلك رابط الاستعادة خلال دقائق.</p><button class="link-button" data-link="/login">تذكرت كلمة المرور؟ تسجيل الدخول</button></article><aside class="card reset-light-visual"><div class="mail-visual"><img src="/assets/renewpilot-logo-horizontal.png" alt="RenewPilot AI"></div><h2>خطوة بسيطة لاستعادة الوصول</h2><p>سنرسل لك رابطًا آمنًا لإدارة كلمة المرور والعودة إلى اشتراكاتك بسهولة.</p></aside></section>${publicFooter()}</main>`;
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
        <span class="eyebrow">RenewPilot AI</span>
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
        <div class="auth-hero-logo"><span class="brand-mark">R</span><strong>RenewPilot <b>AI</b></strong></div>
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
  return `<main class="auth-page reset-mode"><div class="auth-brand">${logo()}</div><div class="auth-top-actions"><button class="btn btn-ghost icon-btn" data-action="theme">${state.theme === "dark" ? "☾" : "☀"}</button><button class="btn btn-secondary" data-action="language">${state.language === "ar" ? "EN" : "AR"}</button></div><section class="auth-shell single-auth"><article class="card auth-panel"><span class="eyebrow">RenewPilot AI</span><h1>${t("auth.forgotTitle")}</h1><p class="lead">${step === 1 ? t("auth.forgotSubtitle") : step === 2 ? t("auth.codeSent") : t("auth.passwordChanged")}</p>${content}<button class="btn btn-ghost" data-link="/login">${t("auth.loginLink")}</button></article></section></main>`;
}

function dashboardShell(content) {
  const englishLabels = { "الرئيسية": "Dashboard", "الاشتراكات": "Subscriptions", "العملاء": "Customers", "قالب رسالة التجديد": "Renewal Template", "الأجهزة": "Devices", "إرسال معلومات الطلب": "Order Information", "الحماية": "Security", "التقارير": "Reports", "الفوترة والباقات": "Billing & Plans", "الإعدادات": "Settings" };
  const links = dashboardRoutes.map(([path, label, mark]) => `<button class="side-link ${state.route === path ? "active" : ""}" data-link="${path}">${dashboardIcon(mark)}<span>${state.language === "ar" ? label : englishLabels[label]}</span></button>`).join("");
  const themeIcon = state.theme === "dark" ? "☾" : "☀";
  const profile = state.dashboardOverview?.profile || {};
  const profileName = profile.name || (state.language === "ar" ? "المستخدم" : "User");
  const profileInitial = profileName.trim().slice(0, 1) || "R";
  const planName = profile.planName || (state.language === "ar" ? "تجربة مجانية" : "Free Trial");
  return `<div class="dashboard-shell">
    <aside class="sidebar ${state.sidebarOpen ? "open" : ""}">
      <div class="sidebar-brand">${logo()}</div>
      <nav class="side-links">${links}</nav>
      <div class="sidebar-foot"><span class="sidebar-foot-icon">AI</span><div><strong>RenewPilot AI</strong><small>${state.language === "ar" ? "إدارة التجديدات بوضوح" : "Renewals, clearly managed"}</small></div></div>
    </aside>
    <main class="dashboard-main">
      <header class="topbar">
        <div class="topbar-tools">
          <button class="btn btn-secondary icon-btn mobile-side-toggle" data-action="toggle-sidebar">☰</button>
          <div class="search-wrap dashboard-search"><span class="search-icon">⌕</span><input class="input" data-action="global-search" placeholder="${state.language === "ar" ? "بحث سريع..." : "Quick search..."}" value="${state.search}"></div>
        </div>
        <div class="topbar-tools">
          <span class="plan-badge">${escapeHtml(planName)}</span>
          <button class="btn btn-ghost icon-btn" data-action="theme" title="${state.language === "ar" ? "تغيير المظهر" : "Change theme"}">${themeIcon}</button>
          <button class="btn btn-ghost icon-btn" data-action="notifications" title="${state.language === "ar" ? "التنبيهات" : "Notifications"}">${dashboardIcon("notifications")}</button>
          <button class="btn btn-secondary" data-action="language">${state.language === "ar" ? "EN" : "AR"}</button>
          <button class="profile-trigger" data-action="profile-menu"><span class="avatar">${escapeHtml(profileInitial)}</span><span><strong>${escapeHtml(profileName)}</strong><small>${escapeHtml(profile.email || "")}</small></span></button>
          ${state.profileOpen ? `<div class="profile-menu"><button data-link="/dashboard/settings">${t("dashboard.profile")}</button><button data-link="/dashboard/settings">${t("dashboard.settings")}</button><button class="danger-text" data-action="logout-confirm">${t("auth.logout")}</button></div>` : ""}
        </div>
      </header>
      <div class="content">${content}</div>
    </main>
  </div>`;
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
    ${!hasBusinessData ? `<section class="welcome-panel"><div><span class="welcome-kicker">RenewPilot AI</span><h2>مرحبًا بك في RenewPilot AI</h2><p>ابدأ بإضافة أول عميل أو ربط جهازك. لن تظهر هنا أي بيانات ما لم تضفها أنت.</p></div><div class="welcome-actions"><button class="btn btn-primary" data-action="add-customer">إضافة أول عميل</button><button class="btn btn-secondary" data-link="/dashboard/devices">ربط جهاز</button></div></section>` : ""}
    ${statGrid([
      { title: "إجمالي الاشتراكات", value: stats.totalSubscriptions, caption: "اشتراك", tone: "info", icon: "subscriptions" },
      { title: "التجديدات القادمة", value: stats.upcomingRenewals, caption: "خلال 7 أيام", tone: "warning", icon: "reports" },
      { title: "العملاء النشطون", value: stats.activeCustomers, caption: "عميل", tone: "success", icon: "customers" },
      { title: "حالة واتساب", value: stats.connectedDevices > 0 ? "متصل" : "غير متصل", caption: `${stats.connectedDevices} جهاز`, tone: stats.connectedDevices > 0 ? "success" : "neutral", icon: "devices" },
      { title: "معدل التسليم", value: `${stats.deliveryRate || 0}%`, caption: `${stats.totalMessages || 0} رسالة`, tone: "purple", icon: "reports" }
    ])}
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
    "إرسال معلومات الطلب": "صمم صفحة معلومات آمنة وأنشئ رابطًا مستقلًا لكل طلب.",
    "الحماية": "قواعد الإرسال الآمن وقائمة إيقاف الرسائل.",
    "التقارير": "المؤشرات وسجل النشاط والفوترة.",
    "الإعدادات": "إدارة الحساب واللغة والمظهر والأمان."
  };
  return `<div class="page-title"><div><h1>${title}</h1><p class="muted">${descriptions[title] || "RenewPilot AI"}</p></div><div class="toolbar">${actions}</div></div>`;
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
  const labels = { database: "قاعدة البيانات", evolution: "Evolution API", whatsapp: "اتصال واتساب", resend: "Resend", cron: "Cron", https: "HTTPS", environment: "متغيرات البيئة" };
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

function subscriptionsPage() {
  const stats = overviewStats();
  const source = Array.isArray(state.dbSubscriptions) ? state.dbSubscriptions : [];
  const rows = filterRows(source, ["orderNumber", "customerName", "planName", "status"]);
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
    ${tableToolbar(["الكل", "active", "expiring_soon", "expired", "paused", "renewed"])}
    <article class="card table-card">${content}</article>`);
}

function subscriptionsTable(rows, compact = false) {
  const head = compact ? ["رقم الطلب", "العميل", "الباقة", "تاريخ الانتهاء", "الحالة"] : ["رقم الطلب", "العميل", "الباقة / الخدمة", "تاريخ البداية", "تاريخ الانتهاء", "الحالة", "الإجراء"];
  const body = rows.map((row) => {
    const disabled = row.canSend ? "" : "disabled";
    const reason = row.whatsappStatus !== "connected" ? "يجب ربط واتساب أولًا" : Number(row.riskScore) > 70 ? "الإرسال متوقف بسبب ارتفاع المخاطر" : row.remindersPaused ? "التذكيرات موقوفة لهذا العميل" : "";
    const actions = `<div class="subscription-actions">
      <button class="btn btn-primary" data-action="mark-renewed" data-id="${row.id}">تم التجديد</button>
      <button class="btn btn-secondary" data-action="send-subscription-reminder" data-id="${row.id}" ${disabled} title="${escapeHtml(reason)}">إرسال تذكير</button>
      <button class="btn btn-ghost icon-only" data-action="subscription-edit-db" data-id="${row.id}" title="تعديل">${dashboardIcon("settings")}</button>
      <button class="btn btn-ghost icon-only danger-text" data-action="subscription-delete-db" data-id="${row.id}" title="حذف">×</button>
    </div>`;
    if (compact) return `<tr><td>${escapeHtml(row.orderNumber)}</td><td>${escapeHtml(row.customerName)}</td><td>${escapeHtml(row.planName)}</td><td>${escapeHtml(String(row.endDate).slice(0, 10))}</td><td>${status(row.status)}</td></tr>`;
    return `<tr><td>${escapeHtml(row.orderNumber)}</td><td>${escapeHtml(row.customerName)}</td><td><strong>${escapeHtml(row.planName)}</strong><small>${escapeHtml(row.serviceName)}</small></td><td>${escapeHtml(String(row.startDate).slice(0, 10))}</td><td>${escapeHtml(String(row.endDate).slice(0, 10))}</td><td>${status(row.status)}</td><td>${actions}</td></tr>`;
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

function securityPage() {
  const stats = overviewStats();
  const list = Array.isArray(state.unsubscribes) ? state.unsubscribes : [];
  const health = state.whatsappHealth?.health || null;
  const securityLevel = stats.safeRules > 0 ? 100 : 0;
  const listContent = state.unsubscribes?.error
    ? emptyState("تعذر تحميل قائمة الإيقاف", escapeHtml(state.unsubscribes.error))
    : state.unsubscribes === null
      ? `<div class="loading-state">جاري تحميل قائمة الإيقاف...</div>`
      : list.length
        ? simpleTable(["الرقم", "السبب", "المصدر", "التاريخ", "الإجراء"], list.map((item) => [escapeHtml(item.phoneNumber), escapeHtml(item.reason || "-"), escapeHtml(item.source || "يدوي"), escapeHtml(item.unsubscribedAt ? new Date(item.unsubscribedAt).toLocaleDateString("ar-SA") : "-"), `<button class="btn btn-ghost danger-text" data-action="remove-unsubscribe" data-id="${item.id}">حذف</button>`]))
        : emptyState("لا توجد أرقام محظورة", "لم تتم إضافة أي رقم إلى قائمة إيقاف الرسائل.", "إضافة رقم", "add-unsubscribe");
  const healthLabel = health ? ({ excellent: "ممتاز", good: "جيد", medium: "متوسط", danger: "خطر" }[health.status] || health.status) : "لم يتم الفحص بعد";
  return dashboardShell(`${pageTitle("الحماية", `<button class="btn btn-primary" data-action="add-unsubscribe">إضافة رقم</button><button class="btn btn-secondary" data-action="export-unsubscribes">تصدير</button>`)}
    ${statGrid([
      { title: "مستوى الأمان", value: `${securityLevel}%`, caption: securityLevel ? "مكتمل" : "غير مكتمل", tone: securityLevel ? "success" : "neutral", icon: "security" },
      { title: "الأرقام المحظورة", value: stats.blockedNumbers, caption: "رقم", tone: "danger", icon: "customers" },
      { title: "قواعد الإرسال الآمن", value: stats.safeRules, caption: "قاعدة نشطة", tone: "info", icon: "security" },
      { title: "حالة الفحص", value: healthLabel, caption: health?.lastDisconnect ? "تم الفحص" : "", tone: health ? "success" : "neutral", icon: "reports" }
    ])}
    <div class="section dashboard-two-column">
      <article class="card table-card"><div class="section-head"><div><h2>قائمة إيقاف الرسائل</h2><p class="muted">الأرقام التي لن تستقبل أي رسالة.</p></div><button class="btn btn-secondary" data-action="import-unsubscribes">استيراد قائمة</button></div>${listContent}</article>
      <article class="card table-card"><div class="section-head"><div><h2>مركز حماية واتساب</h2><p class="muted">النتيجة محسوبة من القناة الفعلية.</p></div></div>${health ? `<div class="risk-summary"><strong>${Number(health.risk || 0)}</strong><span>/100</span></div><p class="status ${Number(health.risk || 0) > 70 ? "danger" : Number(health.risk || 0) > 35 ? "warning" : "success"}">${healthLabel}</p><p>${escapeHtml(health.advice || "")}</p>${Number(health.risk || 0) > 70 ? `<button class="btn btn-danger" data-action="review-risks">مراجعة المخاطر</button>` : ""}` : emptyState("لم يتم الفحص بعد", "اربط جهاز واتساب أولًا لاحتساب مستوى المخاطر.", "الانتقال إلى الأجهزة", "/dashboard/devices")}</article>
    </div>
    <article class="card table-card section"><div class="section-head"><div><h2>مركز الضمان وسياسة الإرسال</h2><p class="muted">لا توجد حالات أو سياسات مخصصة حتى تضيفها من بياناتك.</p></div><button class="btn btn-secondary" data-action="policy-details">عرض تفاصيل السياسة</button></div>${emptyState("لا توجد حالات ضمان بعد", "ستظهر الحالات المسجلة فعليًا في هذا القسم.")}</article>`);
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
    : `<div class="qr-empty"><strong>لا يوجد باركود صالح</strong><p class="muted">أنشئ باركود حقيقي من Evolution API.</p></div>`;
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
              <strong>${device.qrLoading ? "جاري طلب الباركود من Evolution API..." : hasRealQr && !device.qrImageLoaded ? "جاري التحقق من صورة الباركود..." : isPendingQr ? "الباركود جاهز للمسح" : isConnected ? "الجهاز متصل" : "لا يوجد باركود صالح"}</strong>
              <small class="muted">${isPendingQr ? `ينتهي خلال 60 ثانية - صالح حتى ${device.qrExpiresAt}` : hasRealQr ? "يتم تحميل الصورة والتحقق منها داخل المتصفح." : device.qrError ? escapeHtml(device.qrError) : "اضغط إنشاء باركود جديد."}</small>
            </div>
            <div class="pair-code">
              <span class="muted">رمز الاقتران</span>
              <strong>${device.pairingCode || "غير متوفر"}</strong>
              <small class="muted">لا يظهر الرمز إلا بعد طلبه من Evolution API</small>
              <button class="btn btn-primary" data-action="create-device-qr" ${device.qrLoading ? "disabled" : ""}>${device.qrLoading ? "جاري التحميل..." : "إنشاء/تحديث باركود"}</button>
              <button class="btn btn-secondary" data-action="copy-pairing">نسخ رمز الاقتران</button>
              <button class="btn btn-secondary" data-action="check-device-connection" ${!isPendingQr && !isConnected ? "disabled" : ""}>فحص الاتصال</button>
            </div>
          </div>` : device.pairingSupported === false ? `<div class="pairing-unsupported">
            <p class="status warning">رمز الاقتران غير مدعوم حاليًا في نسخة Evolution API المثبتة. يمكنك استخدام الربط بالباركود.</p>
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
    `<strong>${escapeHtml(device.deviceName || (isConnected ? "جهاز واتساب متصل" : "جلسة ربط جديدة"))}</strong><small>${escapeHtml(device.instanceName ? `Evolution · ${device.instanceName.slice(0, 12)}…` : "Evolution API")}</small>`,
    escapeHtml(device.phoneNumber || device.phoneInput || "غير متوفر"), status(device.status), isConnected ? "ممتاز" : "بانتظار الربط", escapeHtml(lastCheck),
    `<div class="row-actions"><button class="icon-action" data-action="check-device-connection" title="فحص الاتصال">${dashboardIcon("reports")}</button>${isConnected ? `<button class="icon-action danger-text" data-action="disconnect-device" title="فصل الجهاز">×</button>` : ""}<button class="icon-action danger-text" data-action="delete-device" title="حذف الجهاز">⋮</button></div>`
  ]] : [];
  const qrPanel = `<div class="device-method-panel qr-method-panel">${hasQr ? `<button class="qr-display" data-action="show-device-qr"><img class="qr-real" src="${device.qrBase64}" alt="باركود ربط واتساب الحقيقي"><span>اضغط لتكبير الباركود</span></button>` : `<div class="device-empty-visual">${dashboardIcon("devices")}<strong>لا يوجد باركود جاهز</strong><p>${escapeHtml(device.qrError || "أنشئ باركودًا حقيقيًا من Evolution API للبدء.")}</p></div>`}<button class="btn btn-primary" data-action="create-device-qr" ${device.qrLoading ? "disabled" : ""}>${device.qrLoading ? "جاري إنشاء الباركود..." : "إنشاء/تحديث الباركود"}</button>${hasQr ? `<small>صالح حتى ${escapeHtml(device.qrExpiresAt || "وقت قصير")}</small>` : ""}</div>`;
  const pairingPanel = `<div class="device-method-panel pairing-method-panel"><label class="field"><span>رقم واتساب</span><input class="input" data-action="pairing-phone-input" value="${escapeHtml(device.phoneInput || "")}" placeholder="0551234567 أو 9665XXXXXXXX" inputmode="tel"></label><small>سيتم تحويل الرقم السعودي المحلي تلقائيًا إلى الصيغة الدولية.</small><button class="btn btn-primary" data-action="create-pairing-code" ${device.pairingLoading ? "disabled" : ""}>${device.pairingLoading ? "جاري إنشاء الرمز..." : "إنشاء رمز الاقتران"}</button>${device.pairingError ? `<p class="status danger">${escapeHtml(device.pairingError)}</p>` : ""}${hasPairing ? `<div class="pairing-success"><span class="status success">تم الإنشاء بنجاح</span><div class="pairing-code-row"><strong>${escapeHtml(device.pairingCode)}</strong><button class="btn btn-secondary" data-action="copy-pairing">نسخ</button></div><small>صالح حتى ${escapeHtml(device.pairingExpiresAt || "وقت قصير")}</small><p>افتح واتساب ← الإعدادات ← الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف، ثم أدخل الرمز.</p></div>` : `<div class="device-empty-visual compact">${dashboardIcon("template")}<strong>سيظهر رمز الاقتران الحقيقي هنا</strong><p>لن تعرض المنصة أي رمز لم يرجع مباشرة من Evolution API.</p></div>`}</div>`;
  return dashboardShell(`${pageTitle("الأجهزة المرتبطة", `<button class="btn btn-secondary" data-action="check-device-connection" ${!device.instanceId ? "disabled" : ""}>${dashboardIcon("reports")} فحص الاتصال</button>`)}
    <p class="page-kicker">إدارة أجهزة واتساب المرتبطة بحسابك ومراقبة حالة الاتصال في الوقت الفعلي.</p>
    ${statGrid([
      { title: "الأجهزة المتصلة", value: stats.connectedDevices, caption: "أجهزة متصلة الآن", tone: isConnected ? "success" : "neutral", icon: "devices" },
      { title: "بانتظار الربط", value: stats.pendingDevices, caption: "جلسات فعلية", tone: "warning", icon: "template" },
      { title: "جودة الاتصال", value: quality, caption: isConnected ? "Evolution متصل" : "اربط جهازًا للقياس", tone: isConnected ? "success" : "neutral", icon: "reports" },
      { title: "آخر فحص", value: lastCheck, caption: "حالة القناة الحالية", tone: "info", icon: "security" }
    ])}
    <section class="section devices-workspace"><article class="card devices-table-card"><div class="section-head"><div><h2>الأجهزة المرتبطة</h2><p>تظهر هنا القناة الفعلية الخاصة بمساحة عملك فقط.</p></div><button class="btn btn-secondary" data-action="check-device-connection" ${!device.instanceId ? "disabled" : ""}>فحص الاتصال</button></div>${deviceRows.length ? simpleTable(["اسم النسخة", "رقم الهاتف", "الحالة", "جودة الاتصال", "آخر مزامنة", "الإجراء"], deviceRows) : emptyState("لا توجد أجهزة مرتبطة", "ابدأ بإنشاء رمز اقتران أو باركود من اللوحة المجاورة.")}</article>
      <aside class="card device-link-card"><div class="section-head"><div><h2>ربط جهاز جديد</h2><p>اختر طريقة الربط المناسبة لك.</p></div>${dashboardIcon("devices")}</div><span class="field-label">طريقة الربط</span><div class="segmented device-method-tabs"><button class="${method === "pairing" ? "active" : ""}" data-action="device-link-method" data-method="pairing">${dashboardIcon("template")} الربط عبر رمز الاقتران</button><button class="${method === "qr" ? "active" : ""}" data-action="device-link-method" data-method="qr">${dashboardIcon("devices")} الربط عبر الباركود</button></div>${method === "pairing" ? pairingPanel : qrPanel}<div class="device-card-actions">${isConnected ? `<button class="btn btn-secondary" data-action="send-device-test">إرسال رسالة اختبار</button><button class="btn btn-danger" data-action="disconnect-device">فصل الجهاز</button>` : `<button class="btn btn-secondary" data-action="check-device-connection" ${!isPending ? "disabled" : ""}>فحص حالة الربط</button>`}</div></aside>
    </section>`);
}

function renewalTemplatePage() {
  const payload = state.notificationTemplate || {};
  const template = payload.template || {};
  const rule = payload.rule || {};
  const body = template.body || "";
  const channel = template.channel || "whatsapp";
  const isWhatsappReady = overviewStats().connectedDevices > 0;
  const preview = body ? escapeHtml(body).replaceAll("\n", "<br>") : `<div class="template-empty"><strong>لا يوجد محتوى محفوظ بعد</strong><p>اكتب رسالة التجديد ثم احفظ القالب لتظهر المعاينة هنا.</p></div>`;
  return dashboardShell(`${pageTitle("قالب رسالة التجديد")}
    <p class="page-kicker">أنشئ وخصص رسالة التجديد التي سيتم إرسالها للعملاء قبل انتهاء اشتراكاتهم.</p>
    <section class="template-workspace"><article class="card template-editor-card"><div class="section-head"><div><h2>محتوى الرسالة</h2><p>محرر محتوى الرسالة باستخدام المتغيرات الذكية.</p></div>${dashboardIcon("template")}</div><form data-submit="renewal-template" class="grid">
      <div class="template-meta-grid"><label class="field"><span>اسم القالب</span><input class="input" name="name" value="${escapeHtml(template.name || "")}" placeholder="مثال: تذكير قبل التجديد"></label><label class="field"><span>قناة الإرسال</span><select class="select" name="channel" data-action="template-channel"><option value="whatsapp" ${channel === "whatsapp" ? "selected" : ""}>واتساب</option><option value="email" ${channel === "email" ? "selected" : ""}>البريد الإلكتروني</option><option value="sms" ${channel === "sms" ? "selected" : ""}>الرسائل النصية SMS</option></select></label></div>
      <div class="editor-toolbar"><button type="button" title="تراجع">↶</button><button type="button" title="إعادة">↷</button><button type="button"><b>B</b></button><button type="button"><i>I</i></button><button type="button"><u>U</u></button><span>النص</span></div><textarea class="textarea template-editor" name="body" data-action="template-body" placeholder="اكتب رسالة التجديد هنا...">${escapeHtml(body)}</textarea><div class="variables-row"><span>المتغيرات المتاحة</span>${["{{customer_name}}", "{{service_name}}", "{{end_date}}", "{{renewal_link}}"].map((item) => `<button type="button" class="chip" data-action="insert-template-variable" data-variable="${item}">${item}</button>`).join("")}</div>
      <div class="template-settings"><label class="field"><span>موعد الإرسال</span><select class="select" name="daysOffset"><option value="7" ${Number(rule.daysOffset || 7) === 7 ? "selected" : ""}>قبل انتهاء الاشتراك بـ7 أيام</option><option value="3" ${Number(rule.daysOffset) === 3 ? "selected" : ""}>قبل انتهاء الاشتراك بـ3 أيام</option><option value="1" ${Number(rule.daysOffset) === 1 ? "selected" : ""}>قبل انتهاء الاشتراك بيوم</option></select></label><label class="setting-row setting-toggle"><span>تفعيل القالب</span><input type="checkbox" name="isActive" ${template.isActive !== false ? "checked" : ""}></label></div>
      <div class="template-actions"><button class="btn btn-primary">حفظ القالب</button><button type="button" class="btn btn-secondary" data-action="test-template" ${channel === "whatsapp" && !isWhatsappReady ? "disabled title=\"اربط جهازًا أولًا حتى تتمكن من إرسال رسالة تجريبية.\"" : ""}>إرسال رسالة تجريبية</button></div></form></article>
      <aside class="template-side"><article class="card template-preview-card"><div class="section-head"><h2>معاينة الرسالة</h2>${dashboardIcon("reports")}</div><div class="whatsapp-preview"><span class="preview-day">اليوم</span><div class="message-bubble">${preview}<small>10:30 ✓✓</small></div></div><p class="preview-note">هذه معاينة تقريبية، وقد يختلف مظهر الرسالة حسب قناة الإرسال.</p></article><article class="card"><h2>إعدادات الإرسال</h2><p>القناة الحالية: <strong>${channel === "whatsapp" ? "واتساب" : channel === "email" ? "البريد الإلكتروني" : "SMS"}</strong></p><p class="muted">لن ترسل المنصة أي رسالة تلقائيًا ما لم يكن القالب مفعلاً والقناة جاهزة.</p></article></aside>
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
    manualStartDate: state.orderLinkDraft.manualStartDate || todayDateInputValue(),
    headerText: defaultTemplate?.headerText || "شكرًا لاختيارك خدماتنا",
    footerText: defaultTemplate?.footerText || "RenewPilot AI",
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
  const publicUrl = draft.publicUrl || "";
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
    `<strong>#${escapeHtml(item.orderNumber)}</strong>`,
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
      { title: "الروابط المرسلة", value: stats.sentLinks || 0, caption: "رابط", tone: "info", icon: "orderLink" },
      { title: "الروابط المفتوحة", value: stats.openedLinks || 0, caption: "رابط فريد", tone: "success", icon: "reports" },
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
          <div class="order-builder-actions"><button class="btn btn-primary" type="submit">حفظ القالب</button><button class="btn btn-success" type="button" data-action="create-order-link" ${canCreate ? "" : `disabled title="${draft.sourceMode === "manual" ? "اختر العميل وأكمل معلومات الطلب والتواريخ." : "اختر اشتراكًا حقيقيًا أولًا."}"`}>إنشاء الرابط</button><button class="btn btn-success" type="button" data-action="send-created-order-link" ${publicUrl ? "" : "disabled"}>إرسال للعميل</button><button class="btn btn-secondary" type="button" data-action="copy-created-order-link" ${publicUrl ? "" : "disabled"}>نسخ الرابط</button><button class="btn btn-secondary" type="button" data-action="preview-created-order-link" ${publicUrl ? "" : "disabled"}>معاينة الصفحة</button></div>
          ${publicUrl ? `<div class="created-link-box"><span>الرابط الاحترافي للعميل</span><input class="input" readonly value="${escapeHtml(publicUrl)}"><button type="button" class="btn btn-secondary" data-action="copy-created-order-link">نسخ</button></div>` : ""}
        </form>
      </article>
      <aside class="card order-link-preview-panel"><div class="section-head"><div><h2>معاينة صفحة العميل</h2><p>تتحدث المعاينة مباشرة مع اختياراتك.</p></div>${dashboardIcon("reports")}</div><div id="order-live-preview">${orderInfoPreviewCard(selected, draft)}</div><p class="preview-note">هذه معاينة تقريبية، سيتم عرض البيانات الحقيقية للعميل من قاعدة البيانات.</p></aside>
    </section>
    <article class="card table-card section"><div class="section-head"><div><h2>الروابط السابقة</h2><p>روابط الطلبات المسجلة فعليًا لمساحة عملك.</p></div></div>${links.length ? simpleTable(["رقم الطلب", "العميل", "القالب", "اللون", "طريقة الإرسال", "الحالة", "الفتحات", "آخر فتح", "الإنشاء", "الإجراءات"], linkRows) : emptyState("لا توجد روابط مرسلة بعد", "أنشئ أول رابط لعرض معلومات الطلب للعميل.")}</article>
    <article class="card table-card section"><div class="section-head"><div><h2>القوالب المحفوظة</h2><p>احفظ أكثر من هوية للرسائل وصفحات الطلب.</p></div></div>${templates.length ? simpleTable(["اسم القالب", "النمط", "اللون", "اسم المتجر", "افتراضي", "آخر تحديث", "الإجراءات"], templateRows) : emptyState("لا توجد قوالب محفوظة", "خصص القالب أعلاه ثم اضغط حفظ القالب.")}</article>`);
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
  const orderNumber = state.publicOrderLookup || legacyOrderNumber;
  const data = state.publicOrder && !state.publicOrder.error ? state.publicOrder : null;
  if (legacyOrderNumber && state.query.get("t") && !state.publicOrder && !state.publicOrderLoading) queueMicrotask(() => loadPublicOrder({ orderNumber: legacyOrderNumber }));
  const storeName = data?.store?.name || "معلومات الطلب";
  const themeColor = safeOrderLinkColor(data?.template?.themeColor);
  return `<div class="public-order-page" style="--order-theme:${themeColor}">
    <header class="public-order-header"><div>${logo()}<span>منصة إدارة الاشتراكات الذكية</span></div><div><span class="order-bag">${dashboardIcon("orderLink")}</span><strong>${escapeHtml(storeName)}</strong><small>أهلًا بك في صفحة تتبع طلبك</small></div></header>
    <main class="public-order-main">
      <section class="public-order-search-card"><h1>أدخل رقم الطلب</h1><form data-submit="public-order-search"><div class="search-wrap"><span>${dashboardIcon("template")}</span><input class="input" name="orderNumber" value="${escapeHtml(orderNumber)}" placeholder="مثال: 54981" required></div><button class="btn btn-primary">عرض معلومات الطلب ${dashboardIcon("reports")}</button></form><p>${dashboardIcon("security")} البيانات آمنة ومحدودة ويتم عرضها من المتجر فقط</p></section>
      ${state.publicOrderLoading ? `<div class="loading-state">جاري التحقق من الرابط والطلب...</div>` : state.publicOrder?.error ? `<section class="public-order-error">${dashboardIcon("security")}<h2>${escapeHtml(state.publicOrder.error)}</h2><p>تحقق من رقم الطلب أو تواصل مع المتجر للحصول على رابط جديد.</p></section>` : data ? `<section class="public-order-result"><div class="public-order-style-switcher"><span>نمط العرض</span>${orderLinkStyleOptions.map(([style]) => `<button class="${data.template.style === style ? "active" : ""}" data-action="public-order-style" data-value="${style}" title="${style}"><i class="style-mini style-${style}"></i></button>`).join("")}</div>${orderInfoPreviewCard(null, state.orderLinkDraft, data)}<div class="public-order-actions">${data.store.supportPhone ? `<a class="btn btn-primary" href="https://wa.me/${String(data.store.supportPhone).replace(/\D/g, "")}" target="_blank" rel="noreferrer">تواصل مع المتجر ${dashboardIcon("template")}</a>` : ""}<button class="btn btn-secondary" data-action="copy-public-order-number" data-value="${escapeHtml(data.order.orderNumber)}">نسخ رقم الطلب ${dashboardIcon("orderLink")}</button></div></section>` : `<section class="public-order-welcome"><h2>معلومات طلبك في مكان واحد</h2><p>اكتب رقم الطلب الموجود في الرابط الآمن لعرض حالة الاشتراك ومدته.</p></section>`}
    </main>
    <footer class="public-order-footer"><span>سياسة الخصوصية</span><span>الشروط والأحكام</span><span>الدعم الفني</span><span>تواصل معنا</span><small>© 2026 RenewPilot AI. جميع الحقوق محفوظة.</small></footer>
  </div>`;
}

function billingWorkspacePage() {
  const data = state.billingOverview || {};
  const current = data.current || {};
  const plans = data.plans || [];
  const usage = data.usage || { usedMessages: 0, messageLimit: 0 };
  const days = current.currentPeriodEnd ? Math.max(0, Math.ceil((new Date(current.currentPeriodEnd) - Date.now()) / 86400000)) : 0;
  const invoices = data.invoices || [];
  return dashboardShell(`${pageTitle("الفوترة والباقات")}
    <p class="page-kicker">إدارة خطة الاشتراك والاستخدام والفواتير بكل سهولة وشفافية.</p>${statGrid([
      { title: "الرصيد المتاح", value: formatMoney(data.walletBalance || 0), caption: "لا يُعرض رصيد غير مسجل", tone: "info", icon: "billing" },
      { title: "الأيام المتبقية", value: days, caption: current.currentPeriodEnd ? `حتى ${new Date(current.currentPeriodEnd).toLocaleDateString("ar-SA")}` : "لا توجد دورة نشطة", tone: "purple", icon: "template" },
      { title: "الخطة الحالية", value: current.planName || "تجربة مجانية", caption: current.status || "trial", tone: "success", icon: "subscriptions" },
      { title: "استخدام الرسائل", value: `${Number(usage.usedMessages || 0).toLocaleString("ar-SA")} / ${Number(usage.messageLimit || 0).toLocaleString("ar-SA")}`, caption: "من قاعدة البيانات", tone: "info", icon: "reports" }
    ])}
    <section class="section billing-workspace"><article class="card plan-catalog"><div class="section-head"><div><h2>اختر الباقة المناسبة لاحتياجاتك</h2><p>الباقات المتاحة فعليًا في منصة RenewPilot.</p></div></div>${plans.length ? `<div class="dashboard-plan-grid">${plans.map((plan) => `<article class="dashboard-plan ${plan.slug === current.planSlug ? "current" : ""}"><span class="status ${plan.slug === current.planSlug ? "success" : "info"}">${plan.slug === current.planSlug ? "خطتك الحالية" : "متاحة"}</span><h3>${escapeHtml(plan.name)}</h3><p class="plan-price">${formatMoney(state.billing === "yearly" ? plan.yearlyPriceSar : plan.monthlyPriceSar)} <small>/ ${state.billing === "yearly" ? "سنة" : "شهر"}</small></p><ul class="check-list"><li>${Number(plan.messageLimit || 0).toLocaleString("ar-SA")} رسالة</li><li>${Number(plan.customersLimit || 0).toLocaleString("ar-SA")} عميل</li><li>${Number(plan.whatsappChannelsLimit || 0).toLocaleString("ar-SA")} جهاز واتساب</li></ul><button class="btn ${plan.slug === current.planSlug ? "btn-secondary" : "btn-primary"}" data-link="/pricing">${plan.slug === current.planSlug ? "عرض تفاصيل الخطة" : "اختيار الباقة"}</button></article>`).join("")}</div>` : emptyState("لا توجد باقات مفعلة", "يرجى التواصل مع الدعم لتهيئة باقات المنصة.", "مركز الدعم", "/support")}</article>
      <aside class="billing-side"><article class="card wallet-card"><h2>شحن المحفظة</h2><p>الدفع الإلكتروني غير مفعّل في هذه البيئة حاليًا.</p><button class="btn btn-primary" data-link="/support">طلب مساعدة في الشحن</button></article><article class="card invoice-summary"><h2>ملخص الفاتورة</h2><div><span>الخطة الحالية</span><strong>${escapeHtml(current.planName || "تجربة مجانية")}</strong></div><div><span>دورة الفاتورة</span><strong>${escapeHtml(current.billingCycle || "monthly")}</strong></div><div><span>تاريخ التجديد القادم</span><strong>${current.currentPeriodEnd ? new Date(current.currentPeriodEnd).toLocaleDateString("ar-SA") : "غير متوفر"}</strong></div></article></aside></section>
    <article class="card table-card section"><div class="section-head"><div><h2>آخر الفواتير</h2><p>لا تظهر إلا الفواتير المسجلة فعليًا.</p></div></div>${invoices.length ? simpleTable(["رقم الفاتورة", "التاريخ", "الوصف", "المبلغ", "الحالة"], invoices.map((invoice) => [invoice.number, invoice.date, invoice.description, formatMoney(invoice.amount), status(invoice.status)])) : emptyState("لا توجد فواتير بعد", "ستظهر الفواتير هنا بعد ربط مزود الدفع وإصدار أول فاتورة.")}</article>`);
}

function settingsPage() {
  const remote = state.accountSettings?.settings || state.dashboardOverview?.profile || {};
  const notifications = remote.notificationChannels || {};
  const security = remote.security || {};
  return dashboardShell(`${pageTitle("الإعدادات", `<button class="btn btn-primary" data-action="save-settings">حفظ التغييرات</button>`)}
    <div class="settings-layout">
      <article class="card settings-panel"><div class="settings-panel-head">${dashboardIcon("customers")}<div><h2>إعدادات الحساب</h2><p class="muted">بيانات المستخدم الحالي.</p></div></div><form data-submit="profile-settings" class="form-grid"><label class="field"><span>الاسم</span><input class="input" name="name" value="${escapeHtml(remote.name || "")}" required></label><label class="field"><span>البريد الإلكتروني</span><input class="input" value="${escapeHtml(remote.email || "")}" disabled></label><button class="btn btn-primary">حفظ الملف الشخصي</button></form></article>
      <article class="card settings-panel"><div class="settings-panel-head">${dashboardIcon("settings")}<div><h2>اللغة والمظهر</h2><p class="muted">تحفظ التفضيلات للحساب والمتصفح.</p></div></div><div class="setting-row"><span>اللغة</span><div class="segmented"><button class="${state.language === "ar" ? "active" : ""}" data-action="set-language" data-value="ar">AR</button><button class="${state.language === "en" ? "active" : ""}" data-action="set-language" data-value="en">EN</button></div></div><div class="setting-row"><span>المظهر</span><div class="segmented"><button class="${state.theme === "light" ? "active" : ""}" data-action="set-theme" data-value="light">شمسي</button><button class="${state.theme === "dark" ? "active" : ""}" data-action="set-theme" data-value="dark">ليلي</button></div></div></article>
      <article class="card settings-panel"><div class="settings-panel-head">${dashboardIcon("security")}<div><h2>الأمان</h2><p class="muted">كلمة المرور والمصادقة الثنائية.</p></div></div>${settingToggle("twoFactor", "المصادقة الثنائية (2FA)", Boolean(security.twoFactor))}<button class="btn btn-secondary" data-action="change-password">تغيير كلمة المرور</button><button class="btn btn-secondary" data-action="manage-sessions">إدارة الجلسات</button></article>
      <article class="card settings-panel"><div class="settings-panel-head">${dashboardIcon("subscriptions")}<div><h2>الإشعارات</h2><p class="muted">اختر القنوات التي تريد تفعيلها.</p></div></div>${settingToggle("whatsapp", "واتساب", Boolean(notifications.whatsapp))}${settingToggle("email", "البريد الإلكتروني", Boolean(notifications.email))}${settingToggle("sms", "الرسائل النصية", Boolean(notifications.sms))}</article>
      <article class="card settings-panel"><div class="settings-panel-head">${dashboardIcon("reports")}<div><h2>إعدادات النظام</h2><p class="muted">قواعد التشغيل الخاصة بالحساب.</p></div></div>${settingToggle("renewAuto", "التجديد التلقائي", Boolean(security.renewAuto))}<button class="btn btn-secondary" data-link="/dashboard/security">إدارة سياسة الإرسال</button></article>
      <article class="card settings-panel session-card"><div class="settings-panel-head">${dashboardIcon("settings")}<div><h2>الجلسة الحالية</h2><p class="muted">${escapeHtml(remote.email || "")}</p></div></div><span class="status success">نشطة</span><button class="btn btn-danger" data-action="logout-confirm">تسجيل الخروج</button></article>
    </div>`);
}

function settingToggle(key, label, checked = state.settings[key]) {
  return `<label class="setting-row setting-toggle"><span>${label}</span><input type="checkbox" data-action="setting-toggle" data-key="${key}" ${checked ? "checked" : ""}></label>`;
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

function toast(message, type = "success") {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  stack.appendChild(item);
  setTimeout(() => item.remove(), 3200);
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
    <label class="field full-span"><span>ملاحظات</span><textarea class="textarea" name="notes">${escapeHtml(row.notes || "")}</textarea></label>
    <div class="inline-actions"><button class="btn btn-primary">حفظ</button><button type="button" class="btn btn-secondary" data-action="close-modal">إلغاء</button></div>
  </form>`;
}

function customerForm(row = {}, editId = "") {
  return `<form data-submit="customer" data-id="${editId}" class="form-grid">
    ${field("اسم العميل", "name", "text", row.name || "")}
    ${field("البريد الإلكتروني", "email", "email", row.email || "", false)}
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
  preview.innerHTML = orderInfoPreviewCard(selected, state.orderLinkDraft);
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
  state.orderLinkDraft = { ...state.orderLinkDraft, templateId: templatePayload.item.id, templateName: templatePayload.item.name };
  state.orderLinkTemplates = null;
  state.orderLinks = null;
  syncRouteData(true);
  return templatePayload.item;
}

function openOrderLinkSendModal(item) {
  if (!item?.id) return;
  openModal("إرسال رابط معلومات الطلب", `<form data-submit="order-link-send" data-id="${item.id}" class="grid"><div class="order-send-summary"><strong>${escapeHtml(item.customerName || "العميل")}</strong><span>#${escapeHtml(item.orderNumber || "")}</span></div><label class="field"><span>طريقة الإرسال</span><select class="select" name="method"><option value="whatsapp">واتساب</option><option value="email">البريد الإلكتروني</option><option value="copy">نسخ فقط</option></select></label><button class="btn btn-primary">إرسال الرابط</button></form>`);
}

async function saveAccountSettings(overrides = {}) {
  const remote = state.accountSettings?.settings || state.dashboardOverview?.profile || {};
  const notificationChannels = { ...(remote.notificationChannels || {}) };
  const security = { ...(remote.security || {}) };
  for (const key of ["whatsapp", "email", "sms"]) {
    if (Object.hasOwn(state.settings, key)) notificationChannels[key] = Boolean(state.settings[key]);
  }
  for (const key of ["twoFactor", "renewAuto"]) {
    if (Object.hasOwn(state.settings, key)) security[key] = Boolean(state.settings[key]);
  }
  try {
    await fetchJson("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: overrides.name || remote.name || undefined,
        language: state.language,
        theme: state.theme,
        notificationChannels,
        security
      })
    });
    state.accountSettings = null;
    state.dashboardOverview = null;
    await syncRouteData(true);
    toast("تم حفظ التغييرات بنجاح");
  } catch (error) { toast(error.message || "تعذر حفظ الإعدادات", "danger"); }
}

async function handleAction(target) {
  const action = target.dataset.action;
  if (!action) return;
  if (action === "toggle-public-nav") { state.navOpen = !state.navOpen; render(); }
  if (action === "toggle-sidebar") { state.sidebarOpen = !state.sidebarOpen; render(); }
  if (action === "close-modal") closePortal();
  if (action === "theme") {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("renewpilot_theme", state.theme);
    applyPreferences();
    toast(state.theme === "dark" ? "تم تفعيل الوضع الليلي" : "تم تفعيل الوضع الشمسي");
    render();
  }
  if (action === "language") {
    state.language = target.dataset.language || (state.language === "ar" ? "en" : "ar");
    localStorage.setItem("renewpilot_locale", state.language);
    applyPreferences();
    toast(state.language === "ar" ? "تم تفعيل الواجهة العربية" : "English interface enabled");
    render();
  }
  if (action === "profile-menu") { state.profileOpen = !state.profileOpen; render(); }
  if (action === "logout-confirm") openModal(t("auth.logoutConfirmTitle"), `<p>${t("auth.logoutConfirmMessage")}</p>`, `<button class="btn btn-danger" data-action="logout">${t("auth.logout")}</button><button class="btn btn-secondary" data-action="close-modal">${t("common.cancel")}</button>`);
  if (action === "logout") {
    const finishLogout = () => {
      closePortal();
      toast(t("auth.logoutSuccess"));
      navigate("/login");
    };
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(finishLogout);
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
      publicUrl: "",
      linkId: ""
    };
    render();
    toast(action === "duplicate-order-template" ? "تم تجهيز نسخة جديدة من القالب" : "تم تحميل القالب للتعديل");
  }
  if (action === "delete-order-template") {
    if (!confirm("هل تريد حذف هذا القالب؟ ستبقى الروابط السابقة فعالة دون القالب المحذوف.")) return;
    try {
      await fetchJson(`/api/order-link/templates/${target.dataset.id}`, { method: "DELETE" });
      if (state.orderLinkDraft.templateId === target.dataset.id) state.orderLinkDraft.templateId = "";
      state.orderLinkTemplates = null; state.orderLinks = null; syncRouteData(true);
      toast("تم حذف القالب");
    } catch (error) { toast(error.message || "تعذر حذف القالب", "danger"); }
  }
  if (action === "create-order-link") {
    updateOrderLinkDraftFromForm();
    const draft = state.orderLinkDraft;
    if (draft.sourceMode !== "manual" && !draft.subscriptionId) return toast("اختر طلبًا أو اشتراكًا حقيقيًا أولًا.", "warning");
    if (draft.sourceMode === "manual" && !draft.customerId) return toast("اختر العميل الذي يخصه الطلب أولًا.", "warning");
    if (draft.sourceMode === "manual" && (!draft.manualServiceName?.trim() || !draft.manualPlanName?.trim() || !draft.manualStartDate || !draft.manualEndDate)) {
      return toast("أكمل اسم الخدمة والباقة وتاريخي البداية والنهاية.", "warning");
    }
    if (draft.sourceMode === "manual" && !inferredSubscriptionStatus(draft.manualStartDate, draft.manualEndDate)) {
      return toast("تاريخ النهاية يجب أن يكون بعد تاريخ البداية.", "warning");
    }
    target.disabled = true;
    try {
      const template = await persistOrderLinkDraft();
      let subscriptionId = draft.subscriptionId;
      if (draft.sourceMode === "manual") {
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
        state.orderLinkDraft.subscriptionId = subscriptionId;
        state.dbSubscriptions = null;
        state.orderLinkSubscriptions = null;
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
      state.orderLinkDraft = { ...state.orderLinkDraft, publicUrl: payload.publicUrl, linkId: payload.id };
      state.orderLinks = null;
      syncRouteData(true);
      toast(draft.sourceMode === "manual" ? "تم حفظ الطلب وإنشاء رابطه بنجاح" : "تم إنشاء رابط معلومات الطلب بنجاح");
      render();
    } catch (error) {
      target.disabled = false;
      const messages = { slug_exists: "هذا الرابط المخصص مستخدم من متجر آخر.", reserved_slug: "هذا الرابط محجوز للنظام.", subscription_not_found: "الاشتراك المحدد غير موجود." };
      toast(messages[error.code] || error.message || "تعذر إنشاء الرابط", "danger");
    }
  }
  if (action === "copy-created-order-link") {
    if (!state.orderLinkDraft.publicUrl) return;
    if (state.orderLinkDraft.linkId) {
      await fetchJson(`/api/order-link/${state.orderLinkDraft.linkId}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "copy" }) }).catch(() => null);
    }
    await copyText(state.orderLinkDraft.publicUrl, "تم نسخ الرابط بنجاح");
  }
  if (action === "preview-created-order-link") {
    if (state.orderLinkDraft.publicUrl) window.open(state.orderLinkDraft.publicUrl, "_blank", "noopener,noreferrer");
  }
  if (action === "send-created-order-link") {
    const selected = (state.orderLinkSubscriptions || []).find((item) => item.id === state.orderLinkDraft.subscriptionId);
    openOrderLinkSendModal({
      id: state.orderLinkDraft.linkId,
      orderNumber: selected?.orderNumber,
      customerName: selected?.customerName
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
    if (!confirm(`هل تريد ${verb} هذا الرابط؟`)) return;
    try {
      await fetchJson(`/api/order-link/${target.dataset.id}/${endpoint}`, { method: "PATCH" });
      state.orderLinks = null; syncRouteData(true); toast(`تم ${verb} الرابط`);
    } catch (error) { toast(error.message || `تعذر ${verb} الرابط`, "danger"); }
  }
  if (action === "delete-order-link") {
    if (!confirm("هل تريد حذف هذا الرابط نهائيًا؟")) return;
    try {
      await fetchJson(`/api/order-link/${target.dataset.id}`, { method: "DELETE" });
      if (state.orderLinkDraft.linkId === target.dataset.id) {
        state.orderLinkDraft = { ...state.orderLinkDraft, linkId: "", publicUrl: "" };
      }
      state.orderLinks = null;
      syncRouteData(true);
      toast("تم حذف الرابط");
    } catch (error) { toast(error.message || "تعذر حذف الرابط", "danger"); }
  }
  if (action === "copy-public-order-number") await copyText(target.dataset.value, "تم نسخ رقم الطلب");
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
      const instance = await ensureEvolutionInstance({ signal: requestSignal, timeoutMessage: "استغرق Evolution وقتًا أطول من المتوقع. حاول مرة أخرى." });
      const payload = await fetchJson(`/api/whatsapp/instances/${instance.instanceId}/pairing-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone }),
        signal: requestSignal,
        timeoutMessage: "استغرق Evolution وقتًا أطول من المتوقع. حاول مرة أخرى."
      });
      if (payload.type === "connected" || payload.status === "connected") {
        state.linkedDevice = { ...state.linkedDevice, status: "connected", pairingError: "", pairingCode: "", qrActive: false, qrBase64: "" };
        toast(payload.message || "الجهاز متصل بالفعل.", "success");
        return;
      }
      if (!payload.pairingCode) throw new Error("لم يرجع Evolution رمز اقتران لهذه المحاولة. حاول مرة أخرى أو استخدم الباركود.");
      state.linkedDevice = { ...state.linkedDevice, status: "pending_pairing", linkMethod: "pairing", pairingSupported: true, phoneNumber: `+${phone}`, pairingCode: payload.pairingCode, pairingError: "", pairingExpiresAt: new Date(Date.now() + (payload.expiresIn || 60) * 1000).toLocaleTimeString("ar-SA"), activity: ["تم إنشاء رمز الاقتران عبر Evolution API", ...(state.linkedDevice.activity || []).slice(0, 4)] };
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
      const instance = await ensureEvolutionInstance({ signal: requestSignal, timeoutMessage: "استغرق Evolution وقتًا أطول من المتوقع. حاول مرة أخرى." });
      if (!instance?.id) throw new Error("تعذر إنشاء جلسة Evolution API.");
      state.linkedDevice = { ...state.linkedDevice, ...instance, instanceId: instance.id, instanceName: instance.instanceName || "", qrBase64: "" };
      const payload = await fetchJson(`/api/whatsapp/instances/${instance.id}/qr`, { signal: requestSignal, timeoutMessage: "استغرق Evolution وقتًا أطول من المتوقع. حاول مرة أخرى." });
      if (payload.type === "connected" || payload.status === "connected") {
        state.linkedDevice = { ...state.linkedDevice, status: "connected", qrActive: false, qrImageLoaded: false, qrError: "", qrBase64: "" };
        toast(payload.message || "الجهاز متصل بالفعل.", "success");
        return;
      }
      const qrDataUri = payload.qrDataUri || payload.qrBase64;
      if (!isRealQrDataUri(qrDataUri)) throw new Error("لم يرجع Evolution باركود صالح لهذه المحاولة.");
      state.linkedDevice = { ...state.linkedDevice, status: "pending_qr", linkMethod: "qr", qrActive: true, qrImageLoaded: false, qrError: "", qrBase64: qrDataUri, qrExpiresAt: new Date(Date.now() + (payload.expiresIn || 60) * 1000).toLocaleTimeString("ar-SA"), activity: ["تم إنشاء جلسة Evolution API", "تم تجهيز QR مؤقت", ...(state.linkedDevice.activity || []).slice(0, 3)] };
      toast("تم إنشاء باركود جديد عبر Evolution API");
      closePortal();
    } catch (error) {
      const message = error.message || "تعذر إنشاء الباركود من Evolution API. يرجى المحاولة مرة أخرى.";
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
    openModal("باركود ربط واتساب", `<div class="qr-box ${hasRealQr ? "active" : ""} modal-qr">${realQr}<strong>${hasRealQr ? "امسح الباركود من واتساب" : "لا يوجد باركود جاهز للمسح"}</strong><p class="muted">تتم عملية الربط من الخادم ولا يتم كشف EVOLUTION_API_KEY.</p></div>`, `<button class="btn btn-primary" data-action="create-device-qr">إنشاء باركود جديد</button><button class="btn btn-secondary" data-action="close-modal">إغلاق</button>`);
  }
  if (action === "copy-pairing") state.linkedDevice.pairingCode ? copyText(state.linkedDevice.pairingCode, "تم نسخ رمز الاقتران") : toast("لا يوجد رمز اقتران صادر من Evolution API", "warning");
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
    return openModal("إرسال رسالة اختبار", `<form data-submit="send-device-test" class="grid"><label class="field"><span>رقم المستلم التجريبي</span><input class="input" name="to" inputmode="numeric" placeholder="9665XXXXXXXX" required></label><label class="field"><span>الرسالة</span><textarea class="textarea" name="message" required>مرحبًا {{name}}، هذه رسالة اختبار من RenewPilot AI. أرسل إيقاف لإلغاء الرسائل.</textarea></label><button class="btn btn-primary" type="submit">إرسال الاختبار</button></form>`);
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
  if (action === "open-email") location.href = "mailto:support@renewpilot.ai?subject=طلب دعم RenewPilot AI";
  if (action === "open-whatsapp") window.open("https://wa.me/966500000000?text=مرحبًا، أحتاج دعم RenewPilot AI", "_blank");
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
  }
  if (action === "test-template") {
    const channel = document.querySelector("select[name='channel']")?.value || state.notificationTemplate?.template?.channel || "whatsapp";
    if (channel !== "whatsapp") return toast("اختبار هذه القناة يتطلب تفعيل مزودها من الإعدادات أولًا.", "warning");
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
      toast("تمت إضافة التذكير إلى قائمة الإرسال");
    } catch (error) { toast(error.message || "تعذر إرسال التذكير", "danger"); }
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
    if (!confirm("هل تريد حذف هذا الاشتراك؟")) return;
    try {
      await fetchJson(`/api/subscriptions/${target.dataset.id}`, { method: "DELETE" });
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
    if (!confirm("هل تريد حذف هذا العميل؟")) return;
    try {
      await fetchJson(`/api/customers/${target.dataset.id}`, { method: "DELETE" });
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
  if (action === "set-language") { state.language = target.dataset.value === "en" ? "en" : "ar"; localStorage.setItem("renewpilot_locale", state.language); applyPreferences(); render(); }
  if (action === "set-theme") { state.theme = target.dataset.value === "dark" ? "dark" : "light"; localStorage.setItem("renewpilot_theme", state.theme); applyPreferences(); render(); }
  if (action === "save-settings") await saveAccountSettings();
  if (action === "change-password") openModal("تغيير كلمة المرور", `<form data-submit="password" class="grid">${field("كلمة المرور الحالية", "old", "password")}${field("كلمة المرور الجديدة", "new", "password")}<button class="btn btn-primary">حفظ</button></form>`);
  if (action === "manage-sessions") openDrawer("إدارة الجلسات", `<div class="session-list"><div class="setting-row"><div><strong>الجلسة الحالية</strong><p class="muted">${escapeHtml(state.dashboardOverview?.profile?.email || "")}</p></div><span class="status success">نشطة</span></div><button class="btn btn-danger" data-action="logout-confirm">تسجيل الخروج من الجلسة</button></div>`);
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
      toast(data.method === "whatsapp" ? "تم إرسال الرابط عبر واتساب" : data.method === "email" ? "تم إرسال الرابط عبر البريد" : "تم نسخ الرابط بنجاح");
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = "إرسال الرابط"; }
      const messages = {
        whatsapp_not_connected: "اربط جهازًا أولًا حتى تتمكن من إرسال الرابط عبر واتساب.",
        customer_phone_missing: "لا يوجد رقم واتساب صالح لهذا العميل.",
        customer_email_missing: "لا يوجد بريد إلكتروني لهذا العميل.",
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
      toast(payload.message || "تم إرسال رسالة الاختبار بنجاح.");
      render();
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = "إرسال الاختبار"; }
      toast(error.message || "تعذر إرسال رسالة الاختبار. تحقق من اتصال واتساب.", error.code === "EVOLUTION_TIMEOUT" ? "warning" : "danger");
    }
    return;
  }
  if (type === "login") {
    if (!data.email) return toast(t("auth.emailRequired"), "danger");
    if (!data.password) return toast(t("auth.passwordRequired"), "danger");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return toast(t("auth.invalidEmail"), "danger");
    const button = form.querySelector("button[type='submit'], button:not([type])");
    if (button) { button.disabled = true; button.textContent = t("common.loading"); }
    let loginAccepted = false;
    try {
      const response = await fetch("/api/auth/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const payload = await response.json().catch(() => null);
      loginAccepted = response.ok && payload?.ok === true && Boolean(payload.user?.id);
    } catch {
      loginAccepted = false;
    }
    if (!loginAccepted) { if (button) { button.disabled = false; button.textContent = t("auth.login"); } return toast(t("auth.invalidCredentials"), "danger"); }
    if (!await enterDashboardAfterSessionVerification()) { if (button) { button.disabled = false; button.textContent = t("auth.login"); } return toast("تعذر إنشاء الجلسة.", "danger"); }
    toast(t("auth.loginSuccess"));
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
    try {
      const payload = await fetchJson("/api/templates/renewal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, channel: data.channel, body: data.body, daysOffset: Number(data.daysOffset || 7), isActive: data.isActive === "on" })
      });
      state.notificationTemplate = payload;
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
        body: JSON.stringify({ ...data, customerId: data.customerId || form.querySelector("[name='customerId']")?.value, price: Number(data.price || 0) })
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
    if (!data.email) return toast(t("auth.emailRequired"), "danger");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return toast(t("auth.invalidEmail"), "danger");
    const button = form.querySelector("button");
    if (button) { button.disabled = true; button.textContent = t("common.loading"); }
    try {
      const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.email, locale: state.language }) });
      const body = await response.json();
      if (!response.ok) { if (button) button.disabled = false; return toast(body.message || t("common.serverError"), "danger"); }
      state.resetEmail = data.email;
      state.resetStep = 2;
      toast(body.message || t("auth.codeSent"));
      render();
    } catch {
      if (button) button.disabled = false;
      toast(t("common.serverError"), "danger");
    }
  }
  if (type === "reset-password") {
    if (data.password !== data.confirmPassword) return toast(t("auth.passwordMismatch"), "danger");
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(data.password || "")) return toast(t("auth.passwordMin"), "danger");
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: state.resetEmail, code: data.code, password: data.password }) });
      if (!response.ok) return toast(state.language === "ar" ? "الكود غير صحيح أو منتهي." : "The code is invalid or expired.", "danger");
      state.resetStep = 3;
      toast(t("auth.passwordChanged"));
      render();
    } catch { toast(t("common.serverError"), "danger"); }
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
    const password = data.new || "";
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) return toast("كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم ورمز خاص.", "danger");
    try {
      await fetchJson("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: data.old, newPassword: data.new }) });
      closePortal(); toast("تم تغيير كلمة المرور بنجاح.");
    } catch (error) { toast(error.message || "تعذر تغيير كلمة المرور", "danger"); }
    return;
  }
  if (type === "profile-settings") {
    await saveAccountSettings({ name: data.name });
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
      "/dashboard/security": securityPage,
      "/dashboard/reports": reportsPage,
      "/dashboard/billing": billingWorkspacePage,
      "/dashboard/settings": settingsPage
    };
    app.innerHTML = (pages[state.route] || dashboardHome)();
    localizeElement(app);
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
  if (target.dataset.action === "dashboard-search" || target.dataset.action === "global-search" || target.dataset.action === "support-search") {
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
  if (target.dataset.action === "dashboard-filter") {
    state.filter = target.value;
    render();
  }
  if (target.dataset.action === "report-period") {
    state.reportPeriod = target.value;
    render();
  }
  if (target.dataset.action === "setting-toggle") {
    state.settings[target.dataset.key] = target.checked;
    void saveAccountSettings();
  }
  if (target.dataset.action === "template-channel" && state.notificationTemplate) {
    state.notificationTemplate.template = { ...(state.notificationTemplate.template || {}), channel: target.value };
    render();
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
