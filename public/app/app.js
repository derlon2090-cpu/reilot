import { features, pricingPlans, knowledgeBase } from "../data/publicData.js?v=20260728-otp-pricing-api-v1";

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
  "تم إيقاف الإرسال التلقائي": "Automatic sending paused",
  "إدارة معلومات الحساب والأمان وتفضيلات الواجهة.": "Manage account information, security, and interface preferences.",
  "إعدادات الحساب": "Account settings",
  "تحديث معلومات حسابك الشخصية وبيانات التواصل.": "Update your personal account and contact information.",
  "الاسم الكامل": "Full name",
  "اسم المتجر": "Store name",
  "البريد الإلكتروني": "Email address",
  "رقم الهاتف": "Phone number",
  "لتغيير البريد، استخدم إجراء التحقق المخصص.": "Use the dedicated verification flow to change your email.",
  "لا تملك صلاحية تعديل اسم المتجر": "You do not have permission to edit the store name",
  "تغيير الصورة": "Change photo",
  "حذف الصورة": "Remove photo",
  "صورة الحساب": "Account photo",
  "PNG أو JPG أو WebP، بحد أقصى 2 ميجابايت.": "PNG, JPG, or WebP, up to 2 MB.",
  "حفظ التغييرات": "Save changes",
  "جارٍ الحفظ...": "Saving...",
  "تسجيل الخروج": "Sign out",
  "حافظ على أمان حسابك بتحديث كلمة المرور وإعدادات الحماية.": "Keep your account secure by updating your password and protection settings.",
  "كلمة المرور الحالية": "Current password",
  "كلمة المرور الجديدة": "New password",
  "تأكيد كلمة المرور": "Confirm password",
  "تحديث كلمة المرور": "Update password",
  "دخول الحساب OTP": "Account sign-in OTP",
  "طبقة حماية إضافية لحسابك": "An additional layer of account protection",
  "إدارة الجلسات النشطة": "Manage active sessions",
  "الواجهة واللغة": "Interface & language",
  "تخصيص مظهر وكثافة ولغة الواجهة.": "Customize the interface appearance, density, and language.",
  "اللغة": "Language",
  "العربية": "Arabic",
  "المظهر": "Appearance",
  "شمسي (فاتح)": "Light",
  "قمري (داكن)": "Dark",
  "النظام": "System",
  "كثافة الواجهة": "Interface density",
  "مريحة": "Comfortable",
  "متوسطة": "Balanced",
  "مضغوطة": "Compact",
  "اختر الإشعارات التي ترغب في استلامها.": "Choose the notifications you want to receive.",
  "الإشعارات": "Notifications",
  "إشعارات التجديد والفواتير": "Renewal and billing notifications",
  "التنبيهات الأمنية الأساسية": "Essential security alerts",
  "تقارير النظام والتحديثات": "System reports and updates",
  "تنبيهات فشل الرسائل": "Message failure alerts",
  "التنبيهات الأمنية الأساسية مفعلة دائمًا لحماية حسابك.": "Essential security alerts are always enabled to protect your account.",
  "مساحة الحساب": "Account storage",
  "المساحة الفعلية لبيانات عملائك واشتراكاتك وروابطك وسجلاتك.": "Actual storage used by customers, subscriptions, links, and logs.",
  "مستخدم من حد الباقة الحالية": "used of the current plan limit",
  "وصلت إلى حد مساحة الباقة": "You have reached your plan storage limit",
  "أوقفت المنصة العمليات الجديدة التي تحتاج مساحة. طوّر الباقة أو احذف بيانات لا تحتاجها.": "New operations that require storage are paused. Upgrade your plan or remove data you no longer need.",
  "لا توجد بيانات مخزنة حتى الآن.": "No stored data yet.",
  "ترقية الباقة": "Upgrade plan",
  "عرض حدود الباقات": "View plan limits",
  "العملاء والاشتراكات": "Customers and subscriptions",
  "روابط وقوالب الطلبات": "Order links and templates",
  "الرسائل والسجلات": "Messages and logs",
  "بيانات النظام": "System data",
  "تم حفظ تفضيلات الواجهة": "Interface preferences saved",
  "تعذر حفظ التفضيلات": "Unable to save preferences",
  "تم حفظ تفضيلات الإشعارات": "Notification preferences saved",
  "تعذر حفظ الإشعارات": "Unable to save notification preferences"
};

Object.assign(operationalEnglishPhrases, {
  "يرجى إدخال البريد الإلكتروني.": "Please enter your email address.",
  "يرجى إدخال البريد الإلكتروني": "Please enter your email address",
  "يرجى إدخال كلمة المرور.": "Please enter your password.",
  "يرجى إدخال كلمة المرور": "Please enter your password",
  "أكمل البيانات المطلوبة": "Complete the required fields",
  "أدخل البريد الإلكتروني وكلمة المرور.": "Enter your email address and password.",
  "✦ منصة متكاملة لإدارة الاشتراكات والتجديدات": "✦ An integrated subscription and renewal platform",
  "أدر اشتراكاتك وتجديدات عملائك بذكاء مع Renvix": "Manage customer subscriptions and renewals intelligently with Renvix",
  "Renvix منصة ذكية تساعدك على إدارة الاشتراكات، متابعة التجديدات، إرسال التنبيهات، وإنشاء روابط معلومات الطلب باحترافية.": "Renvix is a smart platform for subscriptions, renewals, notifications, and professional order information links.",
  "استكشف المميزات": "Explore features",
  "إدارة اشتراكات ذكية": "Smart subscription management",
  "أتمتة التجديدات والتنبيهات وتقليل الانقطاعات وزيادة رضا العملاء.": "Automate renewals and reminders, reduce interruptions, and improve customer satisfaction.",
  "تذكيرات متعددة القنوات": "Multi-channel reminders",
  "إرسال عبر واتساب والبريد الإلكتروني في الوقت المناسب.": "Send timely reminders through WhatsApp and email.",
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
  "هل البريد وواتساب ضمن حد واحد؟": "Do email and WhatsApp share one usage limit?",
  "ما سياسة إلغاء الاشتراك؟": "What is the cancellation policy?",
  "كيف يتم احتساب الرسائل؟": "How are messages counted?",
  "نعم، يمكنك إدارة خطتك بمرونة من صفحة الفوترة، ويُحتسب الاستخدام وفق الرسائل المعالجة فعليًا.": "Yes. You can manage your plan from Billing, and usage is based on messages actually processed.",
  "شحن إضافي": "Additional credits",
  "هل تحتاج إلى المزيد من الرسائل؟ اشحن رصيدك الإضافي حسب احتياجك.": "Need more messages? Add credits whenever your business needs them.",
  "رسالة": "messages",
  "شحن الآن": "Add credits",
  "شحن رصيد رسائل البريد": "Add email message credit",
  "اطلب زيادة رصيد البريد عند حاجتك دون التأثير على ربط واتساب الرسمي.": "Request additional email credit without affecting your official WhatsApp connection.",
  "نعم، يمكنك إدارة خطتك بمرونة من صفحة الفوترة، ويُحتسب استخدام البريد وواتساب كلٌ على حدة وفق الرسائل الناجحة فعليًا.": "Yes. You can manage your plan from Billing; email and WhatsApp usage are counted separately and only after successful delivery.",
  "التجربة المجانية": "Free trial",
  "لاختبار المنصة قبل الترقية": "Test the platform before upgrading",
  "لبدء المشاريع والفرق الصغيرة": "For new projects and small teams",
  "للشركات النامية": "For growing companies",
  "للشركات ذات التشغيل المتقدم": "For advanced operations",
  "عميل واحد": "1 customer",
  "20 عميلًا": "20 customers",
  "100 عميل": "100 customers",
  "250 عميلًا": "250 customers",
  "50 رسالة بريد": "50 email messages",
  "500 رسالة بريد": "500 email messages",
  "2,000 رسالة بريد": "2,000 email messages",
  "10,000 رسالة بريد": "10,000 email messages",
  "قناة واتساب رسمية واحدة": "1 official WhatsApp channel",
  "قناتا واتساب رسميتان": "2 official WhatsApp channels",
  "قنوات واتساب متعددة": "Multiple WhatsApp channels",
  "واتساب حسب الاستخدام": "WhatsApp pay as you go",
  "100 MB تخزين": "100 MB storage",
  "1 GB تخزين": "1 GB storage",
  "10 GB تخزين": "10 GB storage",
  "50 GB تخزين": "50 GB storage",
  "تقارير أساسية": "Basic reports",
  "تقارير متقدمة": "Advanced reports",
  "حملات وأتمتة": "Campaigns and automation",
  "◎ الامتثال للمعايير العالمية": "◎ Global standards compliance",
  "◇ أمان على مستوى المؤسسات": "◇ Enterprise-grade security",
  "♙ دعم موثوق": "♙ Reliable support",
  "20 عميلًا · 500 رسالة بريد": "20 customers · 500 email messages",
  "100 عميل · 2,000 رسالة بريد": "100 customers · 2,000 email messages",
  "250 عميلًا · 10,000 رسالة بريد": "250 customers · 10,000 email messages",
  "عميل واحد · 50 رسالة بريد": "1 customer · 50 email messages",
  "◉ إلغاء في أي وقت": "◉ Cancel at any time",
  "✦ تحديثات مستمرة": "✦ Continuous updates",
  "♬ دعم موثوق": "♬ Reliable support",
  "اختر الباقة المناسبة لاحتياجك، مع حدود واضحة للبريد وواتساب ومزايا كل خطة.": "Choose the plan that fits your needs, with clear email and WhatsApp limits for every tier.",
  "محدودة": "Limited",
  "المجانية": "Free",
  "الأساسية": "Starter",
  "الاحترافية": "Professional",
  "الأعمال": "Business",
  "الأكثر شعبية": "Most popular",
  "مخصص": "Custom",
  "ريال / شهريًا": "SAR / month",
  "تواصل معنا للحصول على عرض سعر": "Contact us for a tailored quote",
  "ابدأ مجانًا": "Start free",
  "ابدأ الآن": "Get started",
  "اختر الاحترافية أو ابدأ الآن": "Choose Professional",
  "تواصل معنا": "Contact us",
  "مساحة تخزين 1 MB": "1 MB storage",
  "50 رسالة بريد شهريًا فقط": "50 email messages per month",
  "ربط API متاح": "API access included",
  "قسم الحملات مغلق": "Campaigns are unavailable",
  "لا يوجد واتساب رسمي": "Official WhatsApp is unavailable",
  "لا تشمل إرسال معلومات الطلب": "Order information delivery is unavailable",
  "ميزات محدودة": "Limited features",
  "100 MB تخزين قاعدة البيانات": "100 MB database storage",
  "500 رسالة بريد شهريًا": "500 email messages per month",
  "جهاز واتساب رسمي واحد": "One official WhatsApp device",
  "السلات المتروكة": "Abandoned carts",
  "حالات الطلب": "Order statuses",
  "100 رابط خاص للفاتورة أو تم التنفيذ": "100 secure invoice or completion links",
  "إرسال معلومات الطلب": "Order information delivery",
  "1 GB تخزين قاعدة البيانات": "1 GB database storage",
  "2500 رسالة بريد شهريًا": "2,500 email messages per month",
  "حتى 4 أجهزة / أرقام واتساب رسمية": "Up to 4 official WhatsApp devices or numbers",
  "الحملات": "Campaigns",
  "الأتمتة": "Automation",
  "إعادة استهداف العملاء": "Customer retargeting",
  "1000 رابط خاص للفاتورة أو تم التنفيذ": "1,000 secure invoice or completion links",
  "دعم فني مخصص": "Dedicated technical support",
  "إعدادات مخصصة وصلاحيات فريق": "Custom settings and team permissions",
  "5 GB تخزين قاعدة البيانات": "5 GB database storage",
  "رسائل بريد حسب الاستخدام": "Usage-based email messages",
  "ربط API و Webhooks مخصص": "Custom API and Webhooks",
  "أجهزة / أرقام واتساب رسمية متعددة": "Multiple official WhatsApp devices or numbers",
  "يمكنك إدارة خطتك بمرونة، ويُحتسب البريد وواتساب كلٌ على حدة وفق الرسائل الناجحة فعليًا.": "You can manage your plan flexibly; email and WhatsApp are counted separately after successful delivery.",
  "شحن رصيد البريد": "Add email credit",
  "اشحن رصيدًا لاستخدام رسائل البريد حسب احتياجك.": "Add email credit whenever your usage requires it.",
  "رصيد بريد": "Email credit",
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
  "التذكيرات عبر واتساب والبريد": "WhatsApp and email reminders",
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

Object.assign(operationalEnglishPhrases, {
  "ابحث في الأدلة والأسئلة، أو أنشئ طلب دعم حقيقي يصل إلى فريق Renvix وتابع الرد عبر بريدك الإلكتروني.": "Browse guides and questions, or create a real support request that reaches the Renvix team and receive the reply by email.",
  "أدلة عملية تساعدك خطوة بخطوة.": "Practical step-by-step guides.",
  "إجابات واضحة لأكثر الأسئلة شيوعًا.": "Clear answers to the most common questions.",
  "محادثة الدعم": "Support conversation",
  "أرسل رسالة منظمة وتابع الرد عبر بريدك.": "Send a structured request and receive the reply by email.",
  "طلب عبر البريد": "Email request",
  "أنشئ تذكرة دعم تصل مباشرة إلى الفريق.": "Create a support ticket that goes directly to the team.",
  "جهّز حسابك وأول اشتراك وتذكير بخطوات واضحة.": "Set up your account, first subscription, and reminder with clear steps.",
  "أنشئ الاشتراكات وتابع التجديدات وحالة الإرسال.": "Create subscriptions and track renewals and delivery status.",
  "اربط القنوات والتطبيقات وتحقق من جاهزيتها بأمان.": "Connect channels and apps and verify their readiness securely.",
  "تعرّف على الباقات والفواتير والاستهلاك والتجديد.": "Understand plans, invoices, usage, and renewal.",
  "راقب التجديد والتسليم والأداء من بيانات حسابك.": "Monitor renewals, delivery, and performance using your account data.",
  "ابحث في مركز المساعدة": "Search the help center",
  "ابحث عن حل أو سؤال...": "Search for a solution or question...",
  "كيف أربط قناة واتساب؟": "How do I connect a WhatsApp channel?",
  "هل يمكنني إلغاء التجديد؟": "Can I cancel renewal?",
  "ما طرق الدفع المتاحة؟": "Which payment methods are available?",
  "كيف أتابع أداء الرسائل والتجديدات؟": "How do I track message and renewal performance?",
  "أين أجد رد فريق الدعم؟": "Where can I find the support team's reply?",
  "سيصل الطلب إلى الرسائل والشكاوى، وسنرسل الرد إلى بريدك.": "The request will reach Messages and Complaints, and we will send the reply to your email.",
  "نوع الطلب": "Request type",
  "استفسار عام": "General inquiry",
  "التكاملات وربط القنوات": "Integrations and channel connections",
  "الحساب وتسجيل الدخول": "Account and sign-in",
  "شكوى": "Complaint",
  "اقتراح": "Suggestion",
  "أخرى": "Other",
  "عنوان الطلب": "Request subject",
  "اكتب عنوانًا مختصرًا وواضحًا": "Write a short, clear subject",
  "اشرح المشكلة والخطوات التي قمت بها...": "Describe the issue and the steps you have taken...",
  "أدلة المساعدة": "Help guides",
  "افتح الدليل المطلوب لعرض الخطوات في نفس الصفحة.": "Open a guide to view its steps on this page.",
  "تصفح جميع المقالات": "Browse all articles",
  "لا توجد أدلة مطابقة لعبارة البحث.": "No guides match your search.",
  "لا توجد أسئلة مطابقة لعبارة البحث.": "No questions match your search.",
  "جرّب البحث بكلمات أخرى أو أرسل طلبًا إلى فريق الدعم.": "Try different search terms or send a request to the support team.",
  "أكمل بيانات الحساب والمتجر من الإعدادات.": "Complete the account and store details in Settings.",
  "أضف العميل ثم أنشئ اشتراكه وحدد الباقة وتواريخ البداية والنهاية.": "Add the customer, create the subscription, and set the plan and start and end dates.",
  "اختر قناة الإرسال وأدخل رقم واتساب أو البريد المطلوب.": "Choose the delivery channel and enter the required WhatsApp number or email.",
  "اربط القناة من قسم تطبيقاتنا، ثم فعّل رسالة التذكير بعد مراجعة القالب.": "Connect the channel from Our Apps, then enable the reminder after reviewing the template.",
  "افتح الاشتراكات واضغط إضافة اشتراك جديد.": "Open Subscriptions and select Add new subscription.",
  "اختر العميل والخدمة والباقة وأدخل مدة الاشتراك وقيمته.": "Choose the customer, service, and plan, then enter the subscription duration and value.",
  "حدد قناة الإرسال؛ رقم واتساب إلزامي لواتساب والبريد إلزامي للبريد.": "Choose the delivery channel; a WhatsApp number is required for WhatsApp and an email is required for email.",
  "راجع إعدادات التذكير وحدد الموعد، ثم احفظ الاشتراك.": "Review reminder settings, set the schedule, and save the subscription.",
  "انتقل إلى الإعدادات ثم تطبيقاتنا.": "Go to Settings, then Our Apps.",
  "اختر التكامل المتاح واتبع خطوات الربط الظاهرة.": "Choose an available integration and follow the displayed connection steps.",
  "استخدم مفاتيح API وWebhook من صفحة التكامل المخصصة ولا تشارك الأسرار.": "Use API keys and webhooks from the custom integration page and never share secrets.",
  "راجع سجل الاتصال وحالة الجاهزية قبل تشغيل الإرسال.": "Review connection logs and readiness before enabling delivery.",
  "راجع الباقة الحالية وحدودها من قسم الفوترة.": "Review the current plan and its limits in Billing.",
  "يُحتسب رصيد البريد واستهلاك القنوات وفق تفاصيل الباقة الظاهرة.": "Email credit and channel usage are calculated according to the displayed plan details.",
  "احتفظ بالفواتير وسجل عمليات الدفع للرجوع إليها.": "Keep invoices and payment records for reference.",
  "يمكن إدارة التجديد من صفحة الفوترة وفق شروط الباقة.": "Renewal can be managed from Billing according to the plan terms.",
  "افتح التقارير وحدد الفترة التي تريد تحليلها.": "Open Reports and choose the period you want to analyze.",
  "استخدم الفلاتر لعرض القناة أو الاشتراكات أو حالات الإرسال.": "Use filters to view a channel, subscriptions, or delivery statuses.",
  "راجع سجل التسليم والأخطاء قبل اتخاذ إجراء.": "Review delivery logs and errors before taking action.",
  "صدّر التقرير عند الحاجة إلى مراجعته أو مشاركته داخل فريقك.": "Export the report when it needs to be reviewed or shared with your team.",
  "Renvix منصة لإدارة العملاء والاشتراكات والتجديدات وقنوات التذكير من لوحة واحدة. تضيف بيانات العميل واشتراكه، ثم تضبط القناة والموعد والقالب، وتتابع النتيجة من السجلات والتقارير.": "Renvix manages customers, subscriptions, renewals, and reminder channels from one dashboard. Add a customer and subscription, configure the channel, schedule, and template, then track results in logs and reports.",
  "انتقل إلى «تطبيقاتنا»، افتح تكامل واتساب المتاح، واتبع خطوات الربط حتى تظهر الحالة «متصل». لن يبدأ الإرسال قبل اكتمال الاتصال وتوفر رقم واتساب صحيح للعميل.": "Go to Our Apps, open an available WhatsApp integration, and follow the connection steps until the status is Connected. Delivery will not start until the connection is complete and the customer has a valid WhatsApp number.",
  "يمكنك إدارة التجديد من صفحة الفوترة وفق الباقة وشروطها. إيقاف التجديد يمنع دورة التجديد التالية ولا يحذف بيانات حسابك أو اشتراكات عملائك.": "You can manage renewal from Billing according to the plan terms. Stopping renewal prevents the next cycle and does not delete your account or customer subscriptions.",
  "تظهر طرق الدفع المتاحة فعليًا أثناء اختيار الباقة أو إتمام عملية الدفع. إذا لم تظهر وسيلة مناسبة، أرسل طلبًا بعنوان «الفوترة والباقات» ليطلع الفريق على حالتك.": "Available payment methods appear when selecting a plan or completing payment. If no suitable option appears, send a Billing and plans request for the team to review.",
  "من قسم التقارير وسجل الإرسال يمكنك مراجعة الرسائل المجدولة والمرسلة والمتعثرة، ومعرفة الاشتراكات القريبة من التجديد واستخدام الفلاتر للوصول إلى السجل المطلوب.": "Use Reports and delivery logs to review scheduled, sent, and failed messages, identify upcoming renewals, and filter for the required record.",
  "يرسل فريق الدعم الرد إلى البريد الذي كتبته في الطلب، ويحفظ الرد مع التذكرة داخل لوحة الإدارة. احتفظ برقم الطلب لتسهيل المتابعة.": "The support team sends its reply to the email in your request and stores it with the ticket in the admin panel. Keep the ticket number for follow-up.",
  "نعم. افتح «الفوترة والباقات» واختر الخطة الجديدة. تُطبّق الترقية وفق السعر الظاهر قبل الدفع، بينما يبدأ خفض الباقة مع دورة الفوترة التالية ما لم تعرض صفحة الدفع خلاف ذلك، وتبقى بيانات حسابك محفوظة.": "Yes. Open Billing and plans and choose the new plan. Upgrades use the price displayed before payment, while downgrades begin with the next billing cycle unless checkout states otherwise. Your account data remains stored.",
  "لا. حد رسائل البريد مستقل ويظهر لكل باقة، أما رسائل واتساب الرسمية فتُحتسب حسب الاستخدام. استهلاك قناة لا يخصم من رصيد القناة الأخرى.": "No. Email has an independent plan limit, while official WhatsApp messages are usage-based. Using one channel does not deduct from the other channel's balance.",
  "يمكن إيقاف التجديد التلقائي للدورات القادمة مع استمرار الوصول حتى نهاية المدة المدفوعة. الإيقاف لا يحذف بياناتك ولا يعيد قيمة المدة المستخدمة تلقائيًا، وتُراجع طلبات الاسترجاع وفق سياسة الاستبدال والاسترجاع وحقوق المستهلك المطبقة.": "Automatic renewal can be stopped for future cycles while access continues through the paid term. Stopping renewal does not delete data or automatically refund used time; refund requests follow the refund policy and applicable consumer rights.",
  "تُسجّل الرسالة القابلة للفوترة مرة واحدة بعد قبول مزود القناة لعملية الإرسال بنجاح، مع حماية من الخصم المكرر. الرسائل التي تفشل قبل قبول المزود لا تُحتسب كإرسال ناجح، ويمكن مراجعة التفاصيل من سجل الاستخدام والإرسال.": "A billable message is recorded once after the channel provider accepts it successfully, with duplicate-charge protection. Messages that fail before provider acceptance are not counted as successful sends; details are available in usage and delivery logs."
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
  if (["ar", "en", "light", "dark", "system"].includes(direct)) return direct;
  const legacy = storage.get(legacyKey, fallback);
  localStorage.setItem(key, legacy);
  return legacy;
}

function readDensityPreference() {
  const value = localStorage.getItem("renewpilot_density");
  return ["comfortable", "medium", "compact"].includes(value) ? value : "comfortable";
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
  const directTranslation = operationalEnglishPhrases[trimmed] || localeMessages.en.phrases?.[trimmed];
  if (directTranslation) return source.replace(trimmed, directTranslation);
  const coreTranslation = operationalEnglishPhrases[core] || localeMessages.en.phrases?.[core];
  if (coreTranslation) return source.replace(trimmed, `${prefix}${coreTranslation}`);
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

function readPasswordResetSession() {
  try {
    const email = sessionStorage.getItem("renvix.passwordReset.email") || "";
    const step = Number(sessionStorage.getItem("renvix.passwordReset.step") || 1);
    return { email, step: email && step === 2 ? 2 : 1 };
  } catch {
    return { email: "", step: 1 };
  }
}

const dashboardProfileCacheKey = "renvix.dashboard.profile";

function readCachedDashboardProfile() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(dashboardProfileCacheKey) || "null");
    return cached && typeof cached.name === "string" && cached.name.trim()
      ? { name: cached.name.trim(), image: typeof cached.image === "string" ? cached.image : "" }
      : null;
  } catch {
    return null;
  }
}

function cacheDashboardProfile(profile) {
  if (!profile?.name?.trim()) return;
  const cached = { name: profile.name.trim(), image: typeof profile.image === "string" ? profile.image : "" };
  state.cachedDashboardProfile = cached;
  try {
    sessionStorage.setItem(dashboardProfileCacheKey, JSON.stringify(cached));
  } catch {
    // The verified profile remains available in memory when session storage is unavailable.
  }
}

function clearCachedDashboardProfile() {
  state.cachedDashboardProfile = null;
  try {
    sessionStorage.removeItem(dashboardProfileCacheKey);
  } catch {
    // Nothing else is required when session storage is unavailable.
  }
}

const passwordResetSession = readPasswordResetSession();

const state = {
  route: location.pathname,
  query: new URLSearchParams(location.search),
  navOpen: false,
  sidebarOpen: false,
  theme: readPreference("renewpilot_theme", "renewpilot.theme", "light"),
  language: readPreference("renewpilot_locale", "renewpilot.language", "ar"),
  interfaceDensity: readDensityPreference(),
  profileOpen: false,
  resetStep: passwordResetSession.step,
  resetEmail: passwordResetSession.email,
  emailOtpStatus: null,
  emailOtpLoading: false,
  mfaLoginStatus: null,
  mfaLoginLoading: false,
  mfaSetupPending: false,
  billing: storage.get("renewpilot.billing", "monthly"),
  billingTab: storage.get("renvix.billing.tab", "overview"),
  whatsappUsageExpanded: false,
  reportPeriod: "6",
  filter: "الكل",
  search: "",
  globalSearch: "",
  notificationDropdownOpen: false,
  notificationPreferenceSaving: "",
  notificationFilter: "all",
  subscriptionWindow: "",
  subscriptionStatus: "",
  subscriptionPlanId: "",
  subscriptionChannel: "",
  subscriptionSource: "",
  subscriptionReminderStatus: "",
  subscriptionDateFrom: "",
  subscriptionDateTo: "",
  subscriptionPage: 1,
  subscriptionSection: "list",
  templateCatalogChannel: "all",
  templateCatalogSearch: "",
  settings: { whatsapp: false, email: false, twoFactor: false, renewAuto: false },
  linkedDevice: { ...defaultLinkedDevice }
};

state.dbSubscriptions = null;
state.subscriptionMeta = null;
state.dbCustomers = null;
state.dashboardOverview = null;
state.cachedDashboardProfile = readCachedDashboardProfile();
state.notifications = null;
state.activities = null;
state.unsubscribes = null;
state.accountSettings = null;
state.readiness = null;
state.operationalIssues = null;
state.whatsappHealth = null;
state.deviceSearch = "";
state.deviceStatusFilter = "all";
state.deviceActivityExpanded = false;
state.deviceBulkSyncing = false;
state.securityScore = null;
state.notificationTemplate = null;
state.catalogTemplates = null;
state.metaTemplates = null;
state.billingOverview = null;
state.messageUsage = null;
state.campaignsOverview = null;
state.contactsOverview = null;
state.contactStatistics = null;
state.appsOverview = null;
state.customIntegrations = null;
state.customIntegrationSecret = null;
state.customIntegrationDraft = null;
state.supportTickets = null;
state.supportTicket = null;
state.supportFilter = "all";
state.supportSelectedId = state.query.get("ticket") || "";
state.sallaProductMappings = null;
state.sallaRenewalOptions = null;
state.sallaAutomationTemplates = null;
state.sallaAutomationTemplate = null;
state.renewalOptionMode = "automatic";
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
state.publicSallaPage = null;
state.publicSallaPageLoading = false;
state.publicSallaPageKey = "";
state.orderLinkPreviewSlide = 0;
state.orderLinkCreating = false;
state.orderLinkDraft = {
  hydrated: false,
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
  logoUrl: "",
  logoBorderRadius: 16,
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
  ["/pricing", "الباقات"],
  ["/blog", "المدونة"],
  ["/support", "public.support"]
];

const dashboardRoutes = [
  ["/dashboard", "الرئيسية", "home"],
  ["/dashboard/subscriptions", "الاشتراكات", "subscriptions"],
  ["/dashboard/customers", "العملاء", "customers"],
  ["/dashboard/order-links", "إرسال معلومات الطلب", "orderLink"],
  ["/dashboard/templates", "قوالب عامة", "template"],
  ["/dashboard/campaigns", "الحملات", "campaigns"],
  ["/dashboard/contacts", "جهات الاتصال", "contacts"],
  ["/dashboard/devices", "الأجهزة", "devices"],
  ["/dashboard/apps", "تطبيقاتنا", "apps"],
  ["/dashboard/security", "الحماية والأمان", "security"],
  ["/dashboard/reports", "التقارير", "reports"],
  ["/dashboard/billing", "الفوترة والباقات", "billing"],
  ["/dashboard/settings", "الإعدادات", "settings"],
  ["/dashboard/support", "الدعم والمساعدة", "support"]
];

const dashboardAliases = {
  "/settings/integrations/custom-api": "/dashboard/settings/integrations/custom-api",
  "/dashboard/apps/custom-integration": "/dashboard/settings/integrations/custom-api",
  "/dashboard/renewals": "/dashboard/subscriptions",
  "/dashboard/connected-devices": "/dashboard/devices",
  "/dashboard/linked-devices": "/dashboard/devices",
  "/dashboard/whatsapp-safety": "/dashboard/security",
  "/dashboard/unsubscribe": "/dashboard/security",
  "/dashboard/warranty": "/dashboard/security",
  "/dashboard/activity": "/dashboard/reports",
  "/dashboard/renewal-template": "/dashboard/templates",
  "/dashboard/notifications/template": "/dashboard/templates",
  "/dashboard/readiness": "/dashboard/security",
  "/dashboard/issues": "/dashboard/security"
};

const dashboardQuickSearchItems = [
  {
    route: "/dashboard",
    icon: "home",
    ar: "الرئيسية",
    en: "Dashboard",
    descriptionAr: "نظرة عامة وإحصائيات الحساب والإجراءات السريعة",
    descriptionEn: "Account overview, statistics and quick actions",
    keywords: ["لوحة التحكم", "نظرة عامة", "احصائيات", "إحصائيات", "ملخص", "الرئيسيه", "home", "overview", "statistics", "stats"]
  },
  {
    route: "/dashboard/subscriptions",
    icon: "subscriptions",
    ar: "الاشتراكات والتجديدات",
    en: "Subscriptions & renewals",
    descriptionAr: "إدارة الاشتراكات ومواعيد التجديد والتذكيرات",
    descriptionEn: "Subscriptions, renewal dates and reminders",
    keywords: ["اشتراك", "اشتراكات", "تجديد", "تجديدات", "تذكير", "تذكيرات", "الباقات", "باقة العميل", "renewal", "reminder", "plans"]
  },
  {
    route: "/dashboard/customers",
    icon: "customers",
    ar: "العملاء",
    en: "Customers",
    descriptionAr: "بيانات العملاء والمشتركين وإدارة الحسابات",
    descriptionEn: "Customer records, subscribers and accounts",
    keywords: ["عميل", "عملاء", "مشترك", "مشتركين", "المستخدمين", "customer", "customers", "client", "clients", "subscriber"]
  },
  {
    route: "/dashboard/order-links",
    icon: "orderLink",
    ar: "إرسال معلومات الطلب",
    en: "Order information",
    descriptionAr: "روابط الطلبات وصفحات عرض معلومات العميل",
    descriptionEn: "Order links and customer order pages",
    keywords: ["معلومات الطلب", "ارسال الطلب", "إرسال الطلب", "رابط الطلب", "روابط الطلب", "طلبات", "order information", "order link", "order links"]
  },
  {
    route: "/dashboard/templates",
    icon: "template",
    ar: "القوالب العامة",
    en: "General templates",
    descriptionAr: "قوالب الرسائل والبريد وواتساب",
    descriptionEn: "Message, email and WhatsApp templates",
    keywords: ["قالب", "قوالب", "رسالة", "رسائل", "واتساب", "بريد", "template", "templates", "message", "email", "whatsapp"]
  },
  {
    route: "/dashboard/campaigns",
    icon: "campaigns",
    ar: "الحملات",
    en: "Campaigns",
    descriptionAr: "إنشاء الحملات والإعلانات وجدولة الإرسال",
    descriptionEn: "Create campaigns, broadcasts and schedules",
    keywords: ["حملة", "حملات", "اعلان", "إعلان", "إعلانات", "ارسال جماعي", "إرسال جماعي", "campaign", "campaigns", "broadcast", "bulk", "marketing"]
  },
  {
    route: "/dashboard/contacts",
    icon: "contacts",
    ar: "جهات الاتصال",
    en: "Contacts",
    descriptionAr: "دليل الأرقام والمجموعات وجهات الاتصال",
    descriptionEn: "Contacts, phone book and groups",
    keywords: ["جهة اتصال", "جهات", "اتصال", "ارقام", "أرقام", "دليل", "مجموعات", "contact", "contacts", "phone book", "groups", "audience"]
  },
  {
    route: "/dashboard/devices",
    icon: "devices",
    ar: "الأجهزة",
    en: "Devices",
    descriptionAr: "ربط الأجهزة وفحص اتصال واتساب والمزامنة",
    descriptionEn: "Linked devices, WhatsApp connection and sync",
    keywords: ["جهاز", "اجهزة", "أجهزة", "ربط واتساب", "باركود", "رمز QR", "مزامنة", "device", "devices", "linked", "connection", "qr", "sync"]
  },
  {
    route: "/dashboard/apps",
    icon: "apps",
    ar: "التطبيقات والتكاملات",
    en: "Apps & integrations",
    descriptionAr: "سلة وزد وشوبيفاي والتطبيقات المرتبطة",
    descriptionEn: "Salla, Zid, Shopify and connected apps",
    keywords: ["تطبيقاتنا", "تطبيق", "تكامل", "تكاملات", "سلة", "زد", "شوبيفاي", "shopify", "salla", "zid", "apps", "integrations"]
  },
  {
    route: "/dashboard/apps/salla/templates",
    icon: "template",
    ar: "قوالب سلة",
    en: "Salla templates",
    descriptionAr: "قوالب حالات الطلب والشحن والتوصيل والمنتجات الرقمية",
    descriptionEn: "Order, shipping, delivery and digital product templates",
    keywords: ["قوالب سلة", "رسائل سلة", "منتج رقمي", "منتجات رقمية", "تم الشحن", "تم التوصيل", "طلب ملغي", "salla templates", "digital products", "shipping", "delivery"]
  },
  {
    route: "/dashboard/settings/integrations/custom-api",
    icon: "apps",
    ar: "API و Webhook",
    en: "API & Webhook",
    descriptionAr: "إدارة التكامل المخصص والمفاتيح وعناوين Webhook",
    descriptionEn: "Custom integration, API keys and webhooks",
    keywords: ["api", "webhook", "ويب هوك", "مفتاح api", "مفتاح واجهة", "تكامل مخصص", "واجهة برمجة", "developer", "integration key"]
  },
  {
    route: "/dashboard/notifications",
    icon: "notifications",
    ar: "الإشعارات والتنبيهات",
    en: "Notifications & alerts",
    descriptionAr: "الإشعارات والردود والتنبيهات داخل المنصة",
    descriptionEn: "Platform notifications, replies and alerts",
    keywords: ["اشعارات", "إشعارات", "تنبيهات", "تنبيه", "ردود", "الردود", "notification", "notifications", "alerts", "replies"]
  },
  {
    route: "/dashboard/security",
    icon: "security",
    ar: "الحماية والأمان",
    en: "Security & safety",
    descriptionAr: "الجلسات والتحقق الثنائي وحماية الحساب",
    descriptionEn: "Sessions, two-factor authentication and account security",
    keywords: ["حماية", "امان", "أمان", "جلسات", "جلسة", "تحقق ثنائي", "مصادقة ثنائية", "كلمة المرور", "mfa", "2fa", "security", "sessions", "password"]
  },
  {
    route: "/dashboard/reports",
    icon: "reports",
    ar: "التقارير والتحليلات",
    en: "Reports & analytics",
    descriptionAr: "تقارير الأداء والإرسال والنشاطات",
    descriptionEn: "Performance, delivery and activity reports",
    keywords: ["تقرير", "تقارير", "تحليل", "تحليلات", "اداء", "أداء", "سجل النشاط", "احصائيات", "reports", "analytics", "performance", "activity"]
  },
  {
    route: "/dashboard/billing",
    icon: "billing",
    ar: "الفوترة والباقات",
    en: "Billing & plans",
    descriptionAr: "الخطة الحالية والترقية والدفع وحدود الاستخدام",
    descriptionEn: "Current plan, upgrades, payments and usage limits",
    keywords: ["فوترة", "فاتورة", "فواتير", "باقة", "باقات", "ترقية", "دفع", "رصيد", "حد الاستخدام", "billing", "plans", "upgrade", "payment", "usage"]
  },
  {
    route: "/dashboard/settings",
    icon: "settings",
    ar: "الإعدادات",
    en: "Settings",
    descriptionAr: "الحساب والملف الشخصي واللغة والمظهر والتفضيلات",
    descriptionEn: "Account, profile, language, theme and preferences",
    keywords: ["اعدادات", "إعدادات", "حساب", "الملف الشخصي", "اسم المتجر", "لغة", "انجليزي", "إنجليزي", "مظهر", "كثافة", "settings", "account", "profile", "language", "theme", "preferences"]
  },
  {
    route: "/dashboard/support",
    icon: "support",
    ar: "الدعم والمساعدة",
    en: "Help & support",
    descriptionAr: "طلبات الدعم والشكاوى والمحادثات والأسئلة",
    descriptionEn: "Support tickets, complaints, chats and help",
    keywords: ["دعم", "مساعدة", "تذكرة", "شكوى", "شكاوى", "مشكلة", "محادثة", "اسئلة", "أسئلة", "support", "help", "ticket", "complaint", "chat", "faq"]
  }
];

function normalizeDashboardQuickSearch(value) {
  return String(value || "")
    .toLocaleLowerCase("ar")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ")
    .trim();
}

function dashboardQuickSearchMatches(query) {
  const normalizedQuery = normalizeDashboardQuickSearch(query);
  if (!normalizedQuery) return [];
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return dashboardQuickSearchItems
    .map((item, index) => {
      const label = state.language === "ar" ? item.ar : item.en;
      const normalizedLabel = normalizeDashboardQuickSearch(label);
      const haystack = normalizeDashboardQuickSearch([item.ar, item.en, item.descriptionAr, item.descriptionEn, ...item.keywords].join(" "));
      if (!tokens.every((token) => haystack.includes(token))) return null;
      const score = normalizedLabel === normalizedQuery ? 0 : normalizedLabel.startsWith(normalizedQuery) ? 1 : haystack.includes(normalizedQuery) ? 2 : 3;
      return { ...item, index, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, 8);
}

function dashboardQuickSearchResultsMarkup(query) {
  const normalizedQuery = normalizeDashboardQuickSearch(query);
  if (!normalizedQuery) return "";
  const matches = dashboardQuickSearchMatches(query);
  if (!matches.length) {
    return `<div class="dashboard-quick-search-empty" role="status">${dashboardIcon("reports")}<span><strong>${state.language === "ar" ? "لا توجد نتائج مطابقة" : "No matching results"}</strong><small>${state.language === "ar" ? "جرّب اسم القسم أو مرادفًا مثل: اشتراك، سلة، فاتورة، دعم." : "Try a section or keyword such as subscriptions, Salla, billing or support."}</small></span></div>`;
  }
  return matches.map((item, index) => {
    const label = state.language === "ar" ? item.ar : item.en;
    const description = state.language === "ar" ? item.descriptionAr : item.descriptionEn;
    return `<button type="button" class="dashboard-quick-search-result" role="option" data-global-search-result="${index}" data-link="${escapeHtml(item.route)}">${dashboardIcon(item.icon)}<span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></span><b aria-hidden="true">‹</b></button>`;
  }).join("");
}

function refreshDashboardQuickSearch(input) {
  const results = input?.closest(".dashboard-search")?.querySelector("[data-global-search-results]");
  if (!results) return;
  const markup = dashboardQuickSearchResultsMarkup(input.value);
  results.innerHTML = markup;
  results.hidden = !markup;
  input.setAttribute("aria-expanded", markup ? "true" : "false");
}

function applyPreferences() {
  const resolvedTheme = state.theme === "system"
    ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : state.theme;
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.density = state.interfaceDensity || "comfortable";
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
  const rawPayload = await response.text().catch(() => "");
  let payload = {};
  if (rawPayload) {
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      payload = { message: response.ok ? "تعذر قراءة استجابة الخادم." : "تعذر إكمال الطلب من الخادم." };
    }
  }
  if (!response.ok) {
    if (payload.reason === "storage_limit_reached" || payload.error?.code === "storage_limit_reached") {
      queueMicrotask(() => showStorageQuotaLimit(payload.storage || payload.error?.details?.storage));
    }
    const serverMessage = typeof payload.error === "object" ? payload.error?.message : payload.error;
    const error = new Error(payload.message || serverMessage || "تعذر إكمال الطلب.");
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

async function loadRemotePage(key, url, target, options, { renderOnComplete = true } = {}) {
  if (state.remoteLoading[key]) return null;
  state.remoteLoading[key] = true;
  try {
    const payload = await fetchJson(url, options);
    if (target === "dbSubscriptions") {
      state.dbSubscriptions = payload.items || [];
      state.subscriptionMeta = payload;
    } else if (target === "customIntegrations") {
      const secretIntegrationId = state.customIntegrationSecret?.integrationId;
      const currentItems = Array.isArray(state.customIntegrations?.items) ? state.customIntegrations.items : [];
      const optimisticItem = secretIntegrationId
        ? currentItems.find((item) => item.id === secretIntegrationId)
        : null;
      const incomingItems = Array.isArray(payload?.items) ? payload.items : [];
      if (optimisticItem) {
        const incomingItem = incomingItems.find((item) => item.id === secretIntegrationId);
        const optimisticKeys = Array.isArray(optimisticItem.keys) ? optimisticItem.keys : [];
        const incomingKeys = Array.isArray(incomingItem?.keys) ? incomingItem.keys : [];
        const keys = [
          ...optimisticKeys,
          ...incomingKeys.filter((key) => !optimisticKeys.some((current) => current.id === key.id))
        ];
        const preservedItem = { ...(incomingItem || {}), ...optimisticItem, keys };
        state.customIntegrations = {
          ...payload,
          items: [
            preservedItem,
            ...incomingItems.filter((item) => item.id !== secretIntegrationId)
          ]
        };
      } else {
        state.customIntegrations = payload;
      }
    } else state[target] = ["orderLinks", "notifications", "campaignsOverview", "contactsOverview", "contactStatistics", "metaTemplates", "supportTickets"].includes(target)
      ? payload
      : target === "orderLinkProfile"
        ? payload.profile
        : payload.items ?? payload.report ?? payload;
    if (target === "dashboardOverview" && payload.profile) cacheDashboardProfile(payload.profile);
    if (target === "accountSettings" && payload.settings) {
      state.language = payload.settings.language === "en" ? "en" : "ar";
      state.theme = ["light", "dark", "system"].includes(payload.settings.theme) ? payload.settings.theme : "light";
      state.interfaceDensity = ["comfortable", "medium", "compact"].includes(payload.settings.interfaceDensity)
        ? payload.settings.interfaceDensity
        : "comfortable";
      localStorage.setItem("renewpilot_locale", state.language);
      localStorage.setItem("renewpilot_theme", state.theme);
      localStorage.setItem("renewpilot_density", state.interfaceDensity);
      applyPreferences();
      state.settings = {
        whatsapp: Boolean(payload.settings.notificationChannels?.whatsapp),
        email: Boolean(payload.settings.notificationChannels?.email),
        twoFactor: Boolean(payload.settings.security?.twoFactor),
        renewAuto: Boolean(payload.settings.security?.renewAuto)
      };
    }
  } catch (error) {
    state[target] = { error: error.message || "تعذر تحميل البيانات" };
  } finally {
    state.remoteLoading[key] = false;
    if (renderOnComplete) render();
  }
  return state[target];
}

function syncRouteData(force = false) {
  const routeAtStart = state.route;
  const isDashboardHome = state.route === "/dashboard";
  const pending = [];
  const queue = (key, url, target, options) => {
    const request = loadRemotePage(key, url, target, options, { renderOnComplete: !isDashboardHome });
    if (isDashboardHome && request) pending.push(request);
  };

  if (state.route.startsWith("/dashboard") && (force || state.dashboardOverview === null)) queue("overview", "/api/dashboard/overview", "dashboardOverview");
  if (state.route.startsWith("/dashboard") && (force || state.messageUsage === null)) queue("messageUsage", "/api/billing/message-usage", "messageUsage");
  if (state.route.startsWith("/dashboard") && (force || state.notifications === null)) {
    const notificationLimit = state.route === "/dashboard/notifications" ? 50 : 8;
    queue("notifications", `/api/notifications?limit=${notificationLimit}`, "notifications");
  }
  if (["/dashboard", "/dashboard/subscriptions", "/dashboard/reports"].includes(state.route) && (force || state.dbSubscriptions === null)) {
    const params = new URLSearchParams();
    params.set("limit", state.route === "/dashboard" ? "5" : "20");
    if (state.route === "/dashboard/subscriptions") {
      if (state.search.trim()) params.set("search", state.search.trim());
      if (state.subscriptionStatus) params.set("status", state.subscriptionStatus);
      if (state.subscriptionPlanId) params.set("planId", state.subscriptionPlanId);
      if (state.subscriptionChannel) params.set("channel", state.subscriptionChannel);
      if (state.subscriptionSource) params.set("source", state.subscriptionSource);
      if (state.subscriptionWindow) params.set("renewalWindow", state.subscriptionWindow);
      if (state.subscriptionReminderStatus) params.set("reminderStatus", state.subscriptionReminderStatus);
      if (state.subscriptionDateFrom) params.set("dateFrom", state.subscriptionDateFrom);
      if (state.subscriptionDateTo) params.set("dateTo", state.subscriptionDateTo);
      params.set("page", String(state.subscriptionPage || 1));
    }
    queue("subscriptions", `/api/subscriptions?${params}`, "dbSubscriptions");
  }
  if (state.route === "/dashboard/apps" && (force || state.appsOverview === null)) queue("appsOverview", "/api/apps", "appsOverview");
  if ((["/dashboard/apps/custom-integration", "/settings/integrations/custom-api"].includes(state.route) || state.route.startsWith("/dashboard/settings/integrations/custom-api")) && (force || state.customIntegrations === null)) {
    queue("customIntegrations", "/api/integrations/custom", "customIntegrations");
  }
  if (state.route === "/dashboard/apps/salla/templates" && (force || state.sallaAutomationTemplates === null)) {
    queue("sallaAutomationTemplates", "/api/apps/salla/templates", "sallaAutomationTemplates");
  }
  const sallaTemplateKey = state.route.match(/^\/dashboard\/apps\/salla\/templates\/([^/]+)$/)?.[1];
  if (sallaTemplateKey && (force || state.sallaAutomationTemplate?.item?.templateKey !== sallaTemplateKey)) {
    queue("sallaAutomationTemplate", `/api/apps/salla/templates/${encodeURIComponent(sallaTemplateKey)}`, "sallaAutomationTemplate");
  }
  if (state.route.startsWith("/dashboard/integrations/salla/products") && (force || state.sallaProductMappings === null)) {
    queue("sallaProductMappings", "/api/apps/salla/product-mappings", "sallaProductMappings");
  }
  const renewalMappingId = state.route.match(/^\/dashboard\/integrations\/salla\/products\/([^/]+)$/)?.[1];
  if (renewalMappingId && (force || state.sallaRenewalOptions === null)) {
    queue("sallaRenewalOptions", `/api/apps/salla/product-mappings/${encodeURIComponent(renewalMappingId)}/renewal-options`, "sallaRenewalOptions");
  }
  if (["/dashboard", "/dashboard/subscriptions", "/dashboard/customers", "/dashboard/order-links"].includes(state.route) && (force || state.dbCustomers === null)) queue("customers", "/api/customers", "dbCustomers");
  if (state.route === "/dashboard/security" && (force || state.securityScore === null)) queue("securityScore", "/api/security/score", "securityScore");
  if (["/dashboard/security", "/dashboard/devices"].includes(state.route) && (force || state.whatsappHealth === null)) queue("whatsappHealth", "/api/whatsapp/health", "whatsappHealth");
  if (state.route === "/dashboard/templates" && (force || state.notificationTemplate === null)) queue("renewalTemplate", "/api/templates/renewal", "notificationTemplate");
  if (state.route === "/dashboard/templates" && (force || state.orderLinkProfile === null)) queue("templateStoreProfile", "/api/order-link/profile", "orderLinkProfile");
  if (state.route === "/dashboard/templates" && (force || state.catalogTemplates === null)) void loadRemotePage("catalogTemplates", "/api/templates/catalog", "catalogTemplates");
  if (state.route === "/dashboard/templates" && (force || state.metaTemplates === null)) void loadRemotePage("metaTemplates", "/api/whatsapp/templates", "metaTemplates");
  if (state.route === "/dashboard/campaigns" && (force || state.campaignsOverview === null)) queue("campaignsOverview", "/api/campaigns", "campaignsOverview");
  if (state.route === "/dashboard/contacts" && (force || state.contactsOverview === null)) queue("contactsOverview", "/api/contacts", "contactsOverview");
  if (state.route === "/dashboard/contacts" && (force || state.contactStatistics === null)) queue("contactStatistics", "/api/contacts/statistics", "contactStatistics");
  if (state.route === "/dashboard/order-links" && (force || state.orderLinkTemplates === null)) queue("orderLinkTemplates", "/api/order-information/template", "orderLinkTemplates");
  if (state.route === "/dashboard/order-links") {
    if (force || state.orderLinkProfile === null) queue("orderLinkProfile", "/api/order-link/profile", "orderLinkProfile");
    if (force || state.orderLinkSubscriptions === null) queue("orderLinkSubscriptions", "/api/order-link/subscriptions", "orderLinkSubscriptions");
    if (force || state.orderLinks === null) queue("orderLinks", "/api/order-link/list", "orderLinks");
  }
  if (state.route === "/dashboard/billing" && (force || state.billingOverview === null)) queue("billing", "/api/billing", "billingOverview");
  if (state.route === "/dashboard/settings" && (force || state.accountSettings === null)) queue("settings", "/api/settings", "accountSettings");
  if (state.route === "/dashboard/support") {
    const requestedTicket = state.query.get("ticket") || state.supportSelectedId;
    if (force || state.supportTickets === null) queue("supportTickets", `/api/support/tickets?filter=${encodeURIComponent(state.supportFilter)}&limit=25`, "supportTickets");
    if (requestedTicket && (force || state.supportTicket?.id !== requestedTicket)) queue("supportTicket", `/api/support/tickets/${encodeURIComponent(requestedTicket)}`, "supportTicket");
  }

  if (pending.length) {
    void Promise.allSettled(pending).then(() => {
      if (state.route === routeAtStart) render();
    });
  }
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
    const valid = response.ok && payload?.ok === true && Boolean(payload.user?.id);
    if (valid) state.mustChangePassword = Boolean(payload.user?.mustChangePassword);
    return valid;
  } catch {
    return false;
  }
}

async function navigate(to, { sessionVerified = false } = {}) {
  const url = new URL(to, location.origin);
  url.pathname = dashboardAliases[url.pathname] || url.pathname;
  if (url.pathname.startsWith("/dashboard")) {
    if (!sessionVerified && !await browserSessionIsValid()) {
      history.pushState({}, "", "/login");
      state.route = "/login";
      render();
      toast(t("auth.invalidCredentials"), "danger");
      return;
    }
    if (state.mustChangePassword && url.pathname !== "/dashboard/settings") {
      url.pathname = "/dashboard/settings";
      url.search = "";
      appToast.warning("غيّر كلمة المرور المؤقتة", { description: "لحماية حسابك، يجب تعيين كلمة مرور جديدة قبل استخدام المنصة.", id: "must-change-password" });
    }
  }
  history.pushState({}, "", url.pathname + url.search);
  state.route = url.pathname;
  state.query = url.searchParams;
  if (url.pathname.startsWith("/dashboard/integrations/salla/products/")) state.sallaRenewalOptions = null;
  if (url.pathname === "/dashboard/order-links" && url.searchParams.has("templateId")) {
    state.orderLinkDraft = { ...state.orderLinkDraft, hydrated: false };
  }
  state.navOpen = false;
  state.sidebarOpen = false;
  state.profileOpen = false;
  state.notificationDropdownOpen = false;
  state.globalSearch = "";
  state.search = "";
  state.filter = "الكل";
  render();
  if (state.route === "/dashboard/devices") void syncLinkedDevice();
}

async function enterDashboardAfterSessionVerification() {
  if (!await browserSessionIsValid()) return false;
  const destination = state.mustChangePassword ? "/dashboard/settings" : "/dashboard";
  history.pushState({}, "", destination);
  state.route = destination;
  state.query = new URLSearchParams();
  state.navOpen = false;
  state.sidebarOpen = false;
  state.profileOpen = false;
  state.globalSearch = "";
  state.search = "";
  render();
  if (state.mustChangePassword) appToast.warning("غيّر كلمة المرور المؤقتة", { description: "لحماية حسابك، يجب تعيين كلمة مرور جديدة قبل استخدام المنصة.", id: "must-change-password", persistent: true });
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
    delivered: "تم التسليم", read: "تمت القراءة", failed: "فشل",
    pending_activation: "بانتظار التفعيل", needs_review: "يحتاج مراجعة", scheduled: "مجدول",
    queued: "في قائمة الإرسال", processing: "قيد الإرسال", skipped: "تم التخطي",
    draft: "مسودة", validating: "جارٍ التحقق", ready: "جاهزة", queueing: "قيد الجدولة",
    sending: "جارٍ الإرسال", completed: "مكتملة", archived: "مؤرشفة", blocked: "محظورة",
    merge_review: "تحتاج مراجعة دمج"
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
    <img class="brand-logo-image" src="/assets/renewpilot-logo-horizontal.webp" width="1165" height="342" alt="${escapeHtml(appName)}">
  </button>`;
}

function stackedLogo() {
  const appName = t("app.name") || "Renvix";
  return `<div class="brand-logo-stacked" role="img" aria-label="${escapeHtml(appName)}">
    <img class="brand-logo-image" src="/assets/renewpilot-logo-horizontal.webp" width="1165" height="342" alt="${escapeHtml(appName)}">
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
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    campaigns: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    contacts: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M19 8v6M16 11h6"/>',
    orderLink: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><rect x="8" y="8" width="8" height="8" rx="2"/>',
    apps: '<path d="M19 13h-2.5a1.5 1.5 0 0 0-1.5 1.5V17h-3v-2.5a1.5 1.5 0 0 0-1.5-1.5H8V10h2.5A1.5 1.5 0 0 0 12 8.5V6h3v2.5a1.5 1.5 0 0 0 1.5 1.5H19z"/><path d="M8 10V7a2 2 0 1 0-4 0v3H2v4h2v3a2 2 0 1 0 4 0v-4"/><path d="M19 10h1a2 2 0 1 0 0-4h-2V3h-4v3"/>',
    language: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3C9.6 5.5 8.4 8.5 8.4 12s1.2 6.5 3.6 9"/>',
    billing: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
    notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    support: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M18 19h-2v-7h4v5a2 2 0 0 1-2 2ZM6 19H4a2 2 0 0 1-2-2v-5h4v7Z"/><path d="M16 19c0 1.1-.9 2-2 2h-2"/>',
    message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/>',
    attachment: '<path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.7 9.7a2 2 0 0 1-2.8-2.8l8.9-8.9"/>',
    upload: '<path d="M12 16V3M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    helpBook: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a2 2 0 0 1 2 2v16a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v18a2 2 0 0 1 2-2h2.5a2.5 2.5 0 0 1 2.5 2.5z"/>',
    faq: '<path d="M21 11.5a8.4 8.4 0 0 1-1 4 8.5 8.5 0 0 1-7.5 4.5 8.4 8.4 0 0 1-4-.95L3 21l1.95-5.5A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.5 4a8.4 8.4 0 0 1 4-.95H13a8.5 8.5 0 0 1 8 8.45Z"/><path d="M10.1 9.2a2.2 2.2 0 1 1 3.65 1.65c-.8.6-1.25 1-1.25 2.15"/><path d="M12.5 16h.01"/>',
    chat: '<path d="M5 17H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h1M19 17h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-1"/><path d="M5 10a7 7 0 0 1 14 0v7a4 4 0 0 1-4 4h-3"/><path d="M8 13h.01M12 13h.01M16 13h.01"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.25-2 5-2 5s3.75-.5 5-2"/><path d="M9 15 5 11s4.5-7.5 11-8l5 5c-.5 6.5-8 11-8 11z"/><path d="m9 15-1 4 4-1M5 11l-4 1 4 4"/><circle cx="15" cy="9" r="2"/>',
    puzzle: '<path d="M19 13h-2.5a1.5 1.5 0 0 0-1.5 1.5V17h-3v-2.5a1.5 1.5 0 0 0-1.5-1.5H8V10h2.5A1.5 1.5 0 0 0 12 8.5V6h3v2.5a1.5 1.5 0 0 0 1.5 1.5H19z"/><path d="M8 10V7a2 2 0 1 0-4 0v3H2v4h2v3a2 2 0 1 0 4 0v-4"/><path d="M19 10h1a2 2 0 1 0 0-4h-2V3h-4v3"/>',
    payments: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><rect x="13" y="12" width="5" height="4" rx="1"/><path d="M7 14h2"/>',
    barChart: '<path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M2 20h20"/>',
     settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.61.65 1.05 1.27 1.05H21v4h-.08c-.63 0-1.16.44-1.52 1z"/>',
     linkedin: '<path fill="currentColor" stroke="none" d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.32 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.1 20.45H3.54V9H7.1v11.45Z"/>',
     facebook: '<path fill="currentColor" stroke="none" d="M13.7 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.25-1.5 1.55-1.5h1.65V3.62c-.29-.04-1.27-.12-2.42-.12-2.4 0-4.05 1.47-4.05 4.16V9.9H7.7V13h2.73v8h3.27Z"/>',
     youtube: '<path fill="currentColor" stroke="none" d="M21.58 7.19a2.96 2.96 0 0 0-2.08-2.1C17.66 4.6 12 4.6 12 4.6s-5.66 0-7.5.49a2.96 2.96 0 0 0-2.08 2.1A30.8 30.8 0 0 0 1.93 12c0 1.63.14 3.25.49 4.81a2.96 2.96 0 0 0 2.08 2.1c1.84.49 7.5.49 7.5.49s5.66 0 7.5-.49a2.96 2.96 0 0 0 2.08-2.1c.35-1.56.49-3.18.49-4.81s-.14-3.25-.49-4.81Z"/><path fill="#fff" stroke="none" d="m9.85 15.15 5.15-3.15-5.15-3.15v6.3Z"/>',
     x: '<path fill="currentColor" stroke="none" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/>',
     instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.7" r="1" fill="currentColor" stroke="none"/>',
     globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3C9.6 5.5 8.4 8.5 8.4 12s1.2 6.5 3.6 9"/>',
     whatsapp: '<path d="M20 11.5a8 8 0 0 1-11.9 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z"/><path d="M8.7 8.1c.3 2.7 2.5 4.8 5.2 5.2M14.6 12.2l-1.4 1.1M9.8 9.4l1.1-1.2"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    code: '<path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"/>',
    add: '<path d="M12 5v14M5 12h14"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M15 8l2 2M17 6l2 2"/>',
    webhook: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><path d="M8.7 7.5 10.8 15M15.3 7.5 13.2 15M9 6h6"/>',
    refresh: '<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.4 9A7 7 0 0 0 6.3 6.3L4 9M5.6 15A7 7 0 0 0 17.7 17.7L20 15"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><rect x="4" y="4" width="11" height="11" rx="2"/>',
    success: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    document: '<path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/>',
    save: '<path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    delete: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
    "arrow-left": '<path d="m15 18-6-6 6-6"/><path d="M9 12h11"/>',
     warning: '<path d="M10.3 3.5 2.5 18a2 2 0 0 0 1.8 3h15.4a2 2 0 0 0 1.8-3L13.7 3.5a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    passwordReset: '<path d="M20 11a8 8 0 1 0 1 4"/><path d="M20 4v7h-7"/><rect x="8" y="10" width="8" height="8" rx="2"/><path d="M10 10V8a2 2 0 0 1 4 0v2"/>',
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
    button.setAttribute("aria-label", state.language === "en" ? "Show password" : "إظهار كلمة المرور");
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

function resetPasswordIcon() {
  return `<svg class="reset-password-icon-svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <path d="M47 49A23 23 0 1 1 54 31"/>
    <path d="M54 20v11"/>
    <path d="m48 25 6 6 6-6"/>
    <rect x="21" y="28" width="22" height="18" rx="4"/>
    <path d="M26 28v-5.5a6 6 0 0 1 12 0V28"/>
    <path d="M32 34v4"/>
  </svg>`;
}

function publicFooter() {
  return `<footer class="public-footer"><div class="container public-footer-inner">
    <div class="footer-brand-mini">${logo()}<span>© 2026 Renvix. جميع الحقوق محفوظة.</span></div>
    <nav class="footer-links" aria-label="روابط سريعة"><button data-link="/pricing">الباقات</button><button data-link="/about">عن المنصة</button><button data-link="/privacy">سياسة الخصوصية</button><button data-link="/terms">سياسة الاستخدام</button><button data-link="/refund-policy">سياسة الاستبدال والاسترجاع</button><button data-link="/support">الدعم</button><button data-link="/contact">تواصل معنا</button><button data-link="/blog">المدونة</button></nav>
    <div class="footer-social" aria-label="${state.language === "en" ? "Social media" : "وسائل التواصل الاجتماعي"}"><a href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">${dashboardIcon("linkedin")}</a><a href="https://www.facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook">${dashboardIcon("facebook")}</a><a href="https://www.youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube">${dashboardIcon("youtube")}</a><a href="https://x.com" target="_blank" rel="noreferrer" aria-label="X">${dashboardIcon("x")}</a><a href="https://www.instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">${dashboardIcon("instagram")}</a></div>
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
  return `<article class="dashboard-reference"><img src="/assets/dashboard-preview.webp" width="838" height="360" alt="معاينة لوحة تحكم Renvix"></article>`;
}

function featureGrid(limit = features.length) {
  return `<div class="grid grid-4">${features.slice(0, limit).map(([title, body, mark], index) => `<article class="card feature-card">
    ${icon(mark, index % 4 === 1 ? "purple" : index % 4 === 2 ? "green" : index % 4 === 3 ? "orange" : "")}
    <h3>${title}</h3>
    <p class="muted">${body}</p>
  </article>`).join("")}</div>`;
}

function pricingCards(short = false, billingCycle = state.billing) {
  return `<div class="grid grid-4">${pricingPlans.map((plan) => {
    const price = plan.priceLabel || (billingCycle === "yearly" ? plan.yearly : plan.monthly);
    const features = short ? plan.features.slice(0, 6) : plan.features;
    return `<article class="card pricing-card ${plan.featured ? "featured" : ""}">
      ${plan.badge ? `<span class="badge">${plan.badge}</span>` : ""}
      <div><h3>${plan.name}</h3></div>
      <div class="price">${typeof price === "number" ? `<strong>${price}</strong><small>ريال / شهريًا</small>` : `<strong>${price}</strong><small>تواصل معنا للحصول على عرض سعر</small>`}</div>
      <ul class="plan-feature-list">${features.map(([item, included]) => `<li class="${included ? "included" : "excluded"}">${dashboardIcon(included ? "success" : "close")}<span>${item}</span></li>`).join("")}</ul>
      <button class="btn ${plan.featured ? "btn-primary" : "btn-secondary"}" ${plan.contact ? 'data-link="/contact"' : `data-link="/register?plan=${plan.id}"`}>${plan.cta}</button>
    </article>`;
  }).join("")}</div>`;
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
  },
  {
    slug: "quick-start-guide", category: "أدلة المساعدة", image: "/assets/blog/help-quick-start.png",
    title: { ar: "دليل البدء السريع في Renvix: من إعداد الحساب إلى أول تذكير", en: "Renvix quick-start guide: from account setup to your first reminder" },
    excerpt: { ar: "مسار عملي يجهّز مساحة عملك وبيانات العميل والاشتراك وقناة الإرسال دون تخطي أي خطوة أساسية.", en: "A practical path to prepare your workspace, customer data, subscription, and delivery channel without missing a required step." },
    date: { ar: "31 يوليو 2026", en: "July 31, 2026" }, minutes: { ar: "6 دقائق قراءة", en: "6 min read" },
    lead: { ar: "ابدأ ببيانات صحيحة واتصال جاهز قبل تشغيل أي تذكير. يشرح هذا الدليل الترتيب الأفضل لإعداد الحساب وإنشاء أول اشتراك والتحقق من الرسالة قبل الإرسال.", en: "Start with accurate data and a ready connection before enabling any reminder. This guide covers the best order for setting up your account, creating the first subscription, and validating the message before sending." },
    sections: [
      { heading: { ar: "أكمل هوية الحساب والمتجر", en: "Complete your account and store identity" }, body: { ar: "افتح الإعدادات وراجع اسم المنشأة واسم المتجر والبريد ورقم التواصل والمنطقة الزمنية. تظهر هذه البيانات في أجزاء متعددة من المنصة، لذلك صححها من المصدر بدل تعديل كل رسالة يدويًا. امنح أعضاء الفريق الصلاحيات التي يحتاجونها فقط.", en: "Open settings and review the business name, store name, email, contact number, and time zone. These values appear across the platform, so correct them at the source instead of editing every message manually. Give team members only the permissions they need." } },
      { heading: { ar: "أضف العميل والاشتراك ببيانات قابلة للتنفيذ", en: "Add an actionable customer and subscription record" }, body: { ar: "أنشئ سجل العميل أولًا، ثم أضف الخدمة والباقة وتاريخي البداية والنهاية والقيمة وحالة الاشتراك. راجع التاريخ والعملة قبل الحفظ؛ فالتذكيرات والتقارير تعتمد على هذه القيم لتحديد الموعد والحالة بصورة صحيحة.", en: "Create the customer record first, then add the service, plan, start and end dates, amount, and subscription status. Review dates and currency before saving because reminders and reports rely on these values for accurate scheduling and status." } },
      { heading: { ar: "اختر قناة الإرسال الصحيحة", en: "Choose the correct delivery channel" }, body: { ar: "إذا اخترت واتساب فأدخل رقمًا صحيحًا بصيغة دولية وتأكد من اتصال التطبيق. عند اختيار البريد يصبح البريد الإلكتروني مطلوبًا، ويمكن إبقاء واتساب اختياريًا. لا تعتمد على قناة غير متصلة حتى لو كانت بيانات العميل مكتملة.", en: "For WhatsApp, enter a valid international-format number and confirm the integration is connected. When email is selected, the email address is required while WhatsApp can remain optional. Do not rely on a disconnected channel even when customer data is complete." } },
      { heading: { ar: "راجع القالب وفعّل التذكير", en: "Review the template and enable the reminder" }, body: { ar: "عاين القالب وتأكد من ظهور اسم العميل والخدمة وتاريخ الانتهاء والرابط بالشكل المطلوب. اضبط موعد التذكير، ثم فعّل رسالة التذكير وأرسل اختبارًا إلى جهة تملكها قبل تشغيلها على العملاء. راقب أول عملية من سجل الإرسال.", en: "Preview the template and confirm the customer name, service, expiry date, and link appear correctly. Set the reminder time, enable the reminder message, and send a test to an address you control before activating customer delivery. Monitor the first event in the delivery log." } }
    ],
    takeaways: { ar: ["صحح بيانات الحساب من الإعدادات أولًا.", "لا تفعّل الإرسال قبل جاهزية القناة.", "اختبر القالب وراقب أول عملية إرسال."], en: ["Correct account data in settings first.", "Do not enable sending before the channel is ready.", "Test the template and monitor the first delivery."] }
  },
  {
    slug: "subscription-management-guide", category: "أدلة المساعدة", image: "/assets/blog/help-subscriptions.png",
    title: { ar: "إدارة الاشتراكات باحتراف: الإنشاء والتذكير والتجديد", en: "Professional subscription management: creation, reminders, and renewal" },
    excerpt: { ar: "نظّم دورة الاشتراك من السجل الأول حتى التجديد، مع قواعد واضحة للقناة والموعد وحالة الإرسال.", en: "Organize the subscription lifecycle from the first record through renewal with clear channel, timing, and delivery rules." },
    date: { ar: "31 يوليو 2026", en: "July 31, 2026" }, minutes: { ar: "7 دقائق قراءة", en: "7 min read" },
    lead: { ar: "الاشتراك الجيد ليس تاريخ انتهاء فقط؛ بل سجل موحد يربط العميل بالخدمة والقناة والتذكيرات ونتيجة التجديد. اتبع هذه الخطوات لتحافظ على بيانات قابلة للمتابعة والقياس.", en: "A good subscription is more than an expiry date. It is one record connecting the customer, service, channel, reminders, and renewal result. Follow these steps to keep the lifecycle traceable and measurable." },
    sections: [
      { heading: { ar: "أنشئ سجلًا كاملًا من البداية", en: "Create a complete record from the start" }, body: { ar: "حدد العميل والخدمة والباقة والقيمة وتاريخي البداية والنهاية وحالة الاشتراك. استخدم رقم الطلب أو المرجع الداخلي عند توفره لتسهيل البحث والمطابقة، وأضف ملاحظة قصيرة فقط عندما تمنح الفريق سياقًا مفيدًا.", en: "Select the customer, service, plan, amount, start and end dates, and subscription status. Add an order number or internal reference when available for easier matching, and use notes only when they provide useful context to the team." } },
      { heading: { ar: "اربط القناة ببيانات العميل", en: "Match the channel to customer data" }, body: { ar: "اجعل رقم واتساب إلزاميًا عندما تكون قناة الإرسال واتساب، واجعل البريد إلزاميًا عند اختيار البريد. هذه القاعدة تمنع إنشاء اشتراك يبدو مكتملًا لكنه لا يملك وجهة قابلة للإرسال. صحح البيانات من سجل العميل لتبقى موحدة.", en: "Require a WhatsApp number when WhatsApp is the delivery channel and require an email address for email delivery. This prevents subscriptions that look complete but have no usable destination. Correct details on the customer record so they remain consistent." } },
      { heading: { ar: "اضبط التذكير حسب دورة الخدمة", en: "Schedule reminders around the service cycle" }, body: { ar: "اختر الإرسال اليدوي إذا كان الفريق يحتاج مراجعة كل رسالة، أو التلقائي إذا كانت القواعد والبيانات جاهزة. في الإرسال التلقائي حدد عدد الأيام قبل الانتهاء وفعّل رسالة التذكير. لا تضف تنبيهات متقاربة بلا حاجة.", en: "Use manual sending when the team must review every message, or automatic sending when rules and data are ready. For automatic delivery, choose the number of days before expiry and enable the reminder message. Avoid unnecessary closely spaced reminders." } },
      { heading: { ar: "أغلق دورة التجديد بصورة صحيحة", en: "Close the renewal cycle correctly" }, body: { ar: "عند التجديد حدّث تاريخ النهاية وسجل العملية وأوقف التذكيرات القديمة حتى لا تصل رسالة بعد الدفع. راجع الحالة في قائمة الاشتراكات وسجل الإرسال، واستخدم التقارير لمعرفة الاشتراكات التي لم تتفاعل وتحتاج متابعة بشرية.", en: "After renewal, update the end date, record the action, and stop old reminders so no message is sent after payment. Review status in the subscription list and delivery log, then use reports to find subscriptions requiring human follow-up." } }
    ],
    takeaways: { ar: ["سجل واحد كامل لكل اشتراك.", "القناة تحدد بيانات التواصل المطلوبة.", "أوقف التذكيرات القديمة فور التجديد."], en: ["One complete record per subscription.", "The channel determines required contact data.", "Stop outdated reminders immediately after renewal."] }
  },
  {
    slug: "integrations-settings-guide", category: "أدلة المساعدة", image: "/assets/blog/help-integrations.png",
    title: { ar: "دليل التكاملات والإعدادات الآمنة في Renvix", en: "A guide to secure integrations and settings in Renvix" },
    excerpt: { ar: "اربط التطبيقات ومفاتيح API وWebhooks بطريقة منظمة، واختبر الاتصال دون كشف الأسرار أو تعطيل العمليات الحالية.", en: "Connect apps, API keys, and webhooks methodically, then validate them without exposing secrets or disrupting current operations." },
    date: { ar: "31 يوليو 2026", en: "July 31, 2026" }, minutes: { ar: "8 دقائق قراءة", en: "8 min read" },
    lead: { ar: "نجاح التكامل يعتمد على اختيار المسار الصحيح وحماية بيانات الاعتماد ومراقبة الأحداث بعد التفعيل. استخدم هذا الدليل للربط والاختبار والتشغيل بأقل مخاطرة ممكنة.", en: "Integration success depends on choosing the right path, protecting credentials, and monitoring events after activation. Use this guide to connect, test, and operate with minimal risk." },
    sections: [
      { heading: { ar: "اختر التكامل الذي يخدم العملية", en: "Choose the integration that serves the workflow" }, body: { ar: "ابدأ من قسم تطبيقاتنا واقرأ حالة كل تكامل ومتطلباته. لا تبدأ ربط خدمة غير متاحة، وحدد مسبقًا البيانات التي ستدخل إلى Renvix والأحداث التي يجب أن تخرج منه. هذا يمنع ربطًا شكليًا بلا هدف تشغيلي واضح.", en: "Start in Our Apps and review each integration's availability and requirements. Do not begin an unavailable connection, and define the data entering Renvix and the events leaving it. This avoids integrations with no clear operational purpose." } },
      { heading: { ar: "احمِ مفاتيح API والأسرار", en: "Protect API keys and secrets" }, body: { ar: "أنشئ مفتاحًا بصلاحيات الحد الأدنى واحفظه في متغيرات البيئة لدى نظامك؛ لا تضعه في المتصفح أو رسالة دعم. انسخ المفتاح عند إنشائه لأن القيمة الكاملة لا تظهر لاحقًا، ودوّره فور الاشتباه في تسربه.", en: "Create a least-privilege key and store it in your system's environment variables. Never place it in the browser or a support message. Copy it when created because the full value is not shown again, and rotate it immediately if exposure is suspected." } },
      { heading: { ar: "هيئ Webhook بتوقيع موثوق", en: "Configure a securely signed webhook" }, body: { ar: "استخدم عنوان HTTPS ثابتًا وحدد الأحداث اللازمة فقط، ثم تحقق من توقيع HMAC قبل معالجة المحتوى. اجعل المعالجة قابلة لتكرار الطلب دون إنشاء سجل مكرر، وأعد رمز نجاح بسرعة ثم نفّذ العمل الثقيل في الخلفية.", en: "Use a stable HTTPS endpoint, subscribe only to required events, and verify the HMAC signature before processing payloads. Make handlers idempotent, return success quickly, and move heavy work to the background." } },
      { heading: { ar: "اختبر وراقب قبل الاعتماد", en: "Test and monitor before relying on it" }, body: { ar: "أرسل طلبًا تجريبيًا وتأكد من الاستجابة والتوقيع وشكل البيانات. بعد التفعيل راقب سجل التسليم والأخطاء ومعدل الإعادة، وعالج السبب قبل إعادة المحاولة. احتفظ بخطة لإلغاء المفتاح أو تعطيل Webhook دون فقد البيانات.", en: "Send a test request and verify the response, signature, and payload shape. After activation, monitor delivery logs, failures, and retries, then fix the cause before retrying. Keep a plan for revoking keys or disabling webhooks without losing data." } }
    ],
    takeaways: { ar: ["صلاحيات محدودة لكل مفتاح.", "تحقق من التوقيع ومنع التكرار.", "راقب التسليم وجهّز خطة إلغاء آمنة."], en: ["Use limited permissions for every key.", "Verify signatures and prevent duplicates.", "Monitor delivery and keep a safe revocation plan."] }
  },
  {
    slug: "billing-payments-guide", category: "أدلة المساعدة", image: "/assets/blog/help-billing.png",
    title: { ar: "فهم الفوترة والدفع والباقات في Renvix", en: "Understanding billing, payments, and plans in Renvix" },
    excerpt: { ar: "اعرف حدود الباقة والاستهلاك والفواتير والتجديد قبل اتخاذ أي قرار مالي أو طلب مساعدة.", en: "Understand plan limits, usage, invoices, and renewal before making a billing decision or requesting help." },
    date: { ar: "31 يوليو 2026", en: "July 31, 2026" }, minutes: { ar: "6 دقائق قراءة", en: "6 min read" },
    lead: { ar: "تجمع صفحة الفوترة المعلومات التي تحتاجها لفهم الباقة الحالية والاستهلاك والتجديد. راجع هذه العناصر بالترتيب قبل ترقية الخطة أو إيقاف التجديد أو التواصل مع الدعم.", en: "The billing page brings together the information needed to understand your current plan, usage, and renewal. Review these items in order before upgrading, stopping renewal, or contacting support." },
    sections: [
      { heading: { ar: "راجع الباقة وحدودها الفعلية", en: "Review the plan and its actual limits" }, body: { ar: "تحقق من اسم الباقة وحالتها وتاريخ الدورة والميزات المتاحة. افصل بين رصيد البريد وحدود واتساب أو أي قناة قائمة على الاستهلاك؛ فلكل قناة طريقة احتساب تظهر في صفحة الفوترة قبل الشراء أو الشحن.", en: "Check the plan name, status, billing period, and available features. Separate email credit from WhatsApp or other usage-based channels because each channel has its own calculation method shown before purchase or top-up." } },
      { heading: { ar: "افهم متى يُحتسب الاستخدام", en: "Understand when usage is counted" }, body: { ar: "تُسجل العملية الناجحة وفق قبول مزود القناة، مع ضوابط تمنع احتساب الطلب المكرر. راجع سجل العمليات إذا لم تتطابق الأرقام، ولا تعاود الإرسال قبل التحقق من حالة المحاولة السابقة حتى لا تنشئ عملية إضافية.", en: "Successful usage is recorded when the channel provider accepts the request, with safeguards against duplicate counting. Review transaction history when totals differ, and verify the previous attempt before sending again." } },
      { heading: { ar: "احتفظ بالفاتورة ومرجع الدفع", en: "Keep the invoice and payment reference" }, body: { ar: "بعد الدفع احتفظ برقم العملية والفاتورة وتاريخها والمبلغ والوسيلة المستخدمة. لا ترسل أرقام البطاقة الكاملة أو رمز التحقق إلى الدعم. يكفي رقم الفاتورة أو مرجع العملية لتتبع الحالة بصورة آمنة.", en: "After payment, keep the transaction reference, invoice, date, amount, and payment method. Never send full card numbers or verification codes to support. The invoice or transaction reference is enough to trace the payment safely." } },
      { heading: { ar: "أدر التجديد والتغيير بوضوح", en: "Manage renewal and plan changes clearly" }, body: { ar: "اعرض السعر والحدود قبل تأكيد الترقية. يبدأ خفض الباقة أو إيقاف التجديد وفق الشروط الظاهرة للحساب، ولا يعني إيقاف التجديد حذف البيانات فورًا. عند وجود اختلاف أرسل طلب فوترة يتضمن المرجع والوصف دون معلومات دفع حساسة.", en: "Review price and limits before confirming an upgrade. Downgrades and renewal stops follow the terms displayed for the account, and stopping renewal does not immediately delete data. If something differs, send a billing ticket with the reference and description but no sensitive payment data." } }
    ],
    takeaways: { ar: ["افصل حدود كل قناة عن الأخرى.", "تحقق من الحالة قبل إعادة الدفع أو الإرسال.", "شارك مرجع العملية فقط مع الدعم."], en: ["Keep each channel's limits separate.", "Verify status before retrying payment or delivery.", "Share only the transaction reference with support."] }
  },
  {
    slug: "reports-analytics-guide", category: "أدلة المساعدة", image: "/assets/blog/help-reports.png",
    title: { ar: "قراءة التقارير والتحليلات لاتخاذ قرارات أفضل", en: "Using reports and analytics to make better decisions" },
    excerpt: { ar: "حوّل سجلات التجديد والتسليم والاستهلاك إلى مؤشرات واضحة تقود إجراءات فريقك اليومية.", en: "Turn renewal, delivery, and usage records into clear metrics that guide your team's daily actions." },
    date: { ar: "31 يوليو 2026", en: "July 31, 2026" }, minutes: { ar: "7 دقائق قراءة", en: "7 min read" },
    lead: { ar: "التقرير المفيد يجيب عن سؤال محدد وينتهي بإجراء واضح. ابدأ بفترة مناسبة، ثم افصل مؤشرات القناة عن مؤشرات التجديد، وانتقل من الرقم الإجمالي إلى السجل الذي يحتاج متابعة.", en: "A useful report answers a specific question and ends with a clear action. Start with the right period, separate channel health from renewal performance, and move from totals to the records that need follow-up." },
    sections: [
      { heading: { ar: "حدد السؤال والفترة أولًا", en: "Define the question and period first" }, body: { ar: "قرر ما إذا كنت تقيس التجديد أو التسليم أو الاستجابة أو الإيراد، ثم اختر فترة تشمل دورة العمل كاملة. المقارنة بين فترتين متساويتين أكثر فائدة من قراءة رقم منفرد، خصوصًا عند تغير حجم العملاء أو مواسم النشاط.", en: "Decide whether you are measuring renewal, delivery, response, or revenue, then choose a period covering the full business cycle. Comparing equal periods is more useful than reading one number, especially when customer volume or seasonality changes." } },
      { heading: { ar: "استخدم الفلاتر للوصول إلى السبب", en: "Use filters to reach the cause" }, body: { ar: "صفِّ النتائج حسب القناة والباقة والحالة والفريق عند توفرها. إذا ارتفع الفشل في قناة واحدة فابدأ بفحص الاتصال والبيانات، أما إذا انخفض التجديد مع تسليم سليم فراجع الرسالة والتوقيت وتجربة الدفع.", en: "Filter results by channel, plan, status, and team where available. If failures rise on one channel, inspect connection and data first. If renewals fall while delivery remains healthy, review message, timing, and payment experience." } },
      { heading: { ar: "افصل التسليم عن النتيجة التجارية", en: "Separate delivery from business outcome" }, body: { ar: "نجاح تسليم الرسالة لا يعني اكتمال التجديد. تابع معدل التسليم والاستجابة والنقر والتجديد كلًا على حدة، ثم اربطها زمنيًا لمعرفة المرحلة التي يفقد عندها العميل. لا تعالج مشكلة محتوى بتغيير تقني غير ضروري.", en: "Successful delivery does not mean the subscription renewed. Track delivery, response, click, and renewal rates separately, then connect them over time to find where customers drop off. Do not treat a content problem as a technical one." } },
      { heading: { ar: "حوّل التقرير إلى قائمة عمل", en: "Turn the report into an action list" }, body: { ar: "استخرج الاشتراكات القريبة من الانتهاء والمتعثرة وحالات الفشل المتكرر، ووزع المتابعة مع سبب واضح لكل سجل. صدّر التقرير عند الحاجة للمراجعة الداخلية، وسجل الإجراء النهائي حتى يظهر أثره في الفترة التالية.", en: "Identify subscriptions nearing expiry, stalled renewals, and repeated failures, then assign follow-up with a clear reason for each record. Export the report for internal review when needed and record the final action so its impact appears in the next period." } }
    ],
    takeaways: { ar: ["ابدأ بسؤال وفترة محددين.", "افصل صحة القناة عن نتيجة التجديد.", "أنه كل تقرير بإجراء ومسؤول واضح."], en: ["Start with a defined question and period.", "Separate channel health from renewal outcome.", "End every report with a clear action and owner."] }
  }
];

function marketingHomePage() {
  const highlights = [
    ["إدارة اشتراكات ذكية", "أتمتة التجديدات والتنبيهات وتقليل الانقطاعات وزيادة رضا العملاء.", "subscriptions"],
    ["تذكيرات متعددة القنوات", "إرسال عبر واتساب والبريد الإلكتروني في الوقت المناسب.", "template"],
    ["ربط الأجهزة بسهولة", "دعم الباركود ورمز الاقتران لأكثر من جهاز وقناة.", "devices"],
    ["تقارير وتحليلات متقدمة", "لوحات واضحة لاتخاذ قرارات أفضل وتنمية عملك.", "reports"]
  ];
  return publicShell(`<main>
    <section class="marketing-hero"><div class="container marketing-hero-grid">
      <div class="marketing-copy"><span class="hero-trust-pill"><img src="/assets/renvix-mark.webp" width="327" height="342" alt=""><span>${localizedCopy("اشتراكات منظمة، تجديدات في وقتها", "Organized subscriptions, renewals on time")}</span><i aria-hidden="true"></i></span><h1>${localizedCopy("أدر اشتراكاتك وتجديدات عملائك بذكاء مع", "Manage customer subscriptions and renewals intelligently with")} <span>Renvix</span></h1><p class="lead">Renvix منصة ذكية تساعدك على إدارة الاشتراكات، متابعة التجديدات، إرسال التنبيهات، وإنشاء روابط معلومات الطلب باحترافية.</p><div class="hero-actions"><button class="btn btn-primary" data-link="/register">ابدأ الآن</button><button class="btn btn-secondary" data-link="/features">استكشف المميزات</button></div></div>
      <div class="hero-product-preview">${dashboardPreview()}</div>
    </div></section>
    <section class="marketing-strip" aria-label="${localizedCopy("مزايا المنصة", "Platform benefits")}"><div class="container grid grid-4">${highlights.map(([title, body, mark]) => `<article class="marketing-mini">${dashboardIcon(mark)}<div><h2>${title}</h2><p>${body}</p></div></article>`).join("")}</div></section>
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
  const topups = [50, 100, 250, 500, 1000];
  const questions = [
    ["هل يمكنني الترقية أو التبديل بين الباقات؟", "نعم. افتح «الفوترة والباقات» واختر الخطة الجديدة. تُطبّق الترقية وفق السعر الظاهر قبل الدفع، بينما يبدأ خفض الباقة مع دورة الفوترة التالية ما لم تعرض صفحة الدفع خلاف ذلك، وتبقى بيانات حسابك محفوظة."],
    ["هل البريد وواتساب ضمن حد واحد؟", "لا. حد رسائل البريد مستقل ويظهر لكل باقة، أما رسائل واتساب الرسمية فتُحتسب حسب الاستخدام. استهلاك قناة لا يخصم من رصيد القناة الأخرى."],
    ["ما سياسة إلغاء الاشتراك؟", "يمكن إيقاف التجديد التلقائي للدورات القادمة مع استمرار الوصول حتى نهاية المدة المدفوعة. الإيقاف لا يحذف بياناتك ولا يعيد قيمة المدة المستخدمة تلقائيًا، وتُراجع طلبات الاسترجاع وفق سياسة الاستبدال والاسترجاع وحقوق المستهلك المطبقة."],
    ["كيف يتم احتساب الرسائل؟", "تُسجّل الرسالة القابلة للفوترة مرة واحدة بعد قبول مزود القناة لعملية الإرسال بنجاح، مع حماية من الخصم المكرر. الرسائل التي تفشل قبل قبول المزود لا تُحتسب كإرسال ناجح، ويمكن مراجعة التفاصيل من سجل الاستخدام والإرسال."]
  ];
  return publicShell(`<main class="pricing-reference-page">
    <section class="section pricing-reference-section" aria-labelledby="pricing-page-title">
      <div class="container">
        <div class="pricing-reference-heading">
          <h1 id="pricing-page-title">الباقات</h1>
          <p>اختر الباقة المناسبة لاحتياجك، مع حدود واضحة للبريد وواتساب ومزايا كل خطة.</p>
        </div>
        <div class="pricing-public-grid">${pricingCards(false, "monthly")}</div>
        <div class="pricing-reference-extras">
          <article class="card faq-card faq-compact">
            <h2>أسئلة شائعة</h2>
            ${questions.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join("")}
          </article>
          <article class="card topup-card pricing-extra-card">
            <div><h2>شحن رصيد البريد</h2><p>اشحن رصيدًا لاستخدام رسائل البريد حسب احتياجك.</p></div>
            <div class="credit-grid">${topups.map((amount) => `<div class="credit-option"><span>رصيد بريد</span><strong>${amount} ر.س</strong><button class="btn btn-secondary" data-link="/register?emailTopup=${amount}">شحن الآن</button></div>`).join("")}</div>
          </article>
        </div>
      </div>
    </section>
  </main>`);
}

function blogPage() {
  const query = state.search.trim().toLowerCase();
  const posts = publicBlogPosts.filter((post) => (state.blogCategory === "الكل" || post.category === state.blogCategory) && (!query || `${localizedField(post.title)} ${localizedField(post.excerpt)}`.toLowerCase().includes(query)));
  const featured = posts[0];
  return publicShell(`<main><section class="public-heading"><div class="container"><h1>المدونة</h1><p>أحدث المقالات والنصائح حول تجديد الاشتراكات، الاحتفاظ بالعملاء، والأتمتة الذكية.</p></div></section><section class="section section-tight"><div class="container blog-toolbar"><div class="search-wrap"><span class="search-icon">⌕</span><input class="input" data-action="support-search" value="${escapeHtml(state.search)}" placeholder="ابحث في المقالات..."></div><div class="chips">${["الكل", "أدلة المساعدة", "النصائح", "التجديدات", "التقارير", "الحماية"].map((item) => `<button class="chip ${state.blogCategory === item ? "active" : ""}" data-action="blog-category" data-category="${item}">${item}</button>`).join("")}</div></div></section>
    <section class="section blog-section"><div class="container blog-layout"><div>${featured ? `<article class="card featured-post"><div class="blog-art"><img src="${featured.image}" alt="${escapeHtml(localizedField(featured.title))}"></div><div><span class="badge">مقال مميز</span><h2>${localizedField(featured.title)}</h2><p>${localizedField(featured.excerpt)}</p><small>${localizedField(featured.date)} · ${localizedField(featured.minutes)}</small><button class="link-button" data-link="/blog/${featured.slug}">اقرأ المقال ←</button></div></article><div class="blog-grid">${posts.slice(1).map((post) => blogCard(post)).join("")}</div>` : emptyState("لا توجد مقالات مطابقة", "جرّب البحث بكلمات أخرى أو اختر قسمًا مختلفًا.")}</div><aside class="blog-aside"><article class="card"><h3>أحدث المقالات</h3>${publicBlogPosts.slice(0, 4).map((post) => `<button data-link="/blog/${post.slug}"><img src="${post.image}" alt=""><strong>${localizedField(post.title)}</strong><small>${localizedField(post.date)}</small></button>`).join("")}</article><article class="card newsletter"><h3>اشترك في نشرتنا</h3><p>احصل على أحدث المقالات والنصائح مباشرة في بريدك.</p><form data-submit="newsletter"><input class="input" type="email" name="email" placeholder="بريدك الإلكتروني" required><button class="btn btn-primary">اشترك الآن</button></form></article></aside></div></section></main>`);
}

function blogCard(post) {
  return `<article class="card blog-card"><div class="blog-art"><img src="${post.image}" alt="${escapeHtml(localizedField(post.title))}"></div><span class="badge">${post.category}</span><h3>${localizedField(post.title)}</h3><p>${localizedField(post.excerpt)}</p><small>${localizedField(post.date)} · ${localizedField(post.minutes)}</small><button class="link-button" data-link="/blog/${post.slug}">اقرأ المقال ←</button></article>`;
}

function articlePage() {
  const post = publicBlogPosts.find((item) => `/blog/${item.slug}` === state.route);
  if (!post) return blogPage();
  const takeaways = localizedField(post.takeaways);
  const lead = post.lead ? localizedField(post.lead) : localizedCopy("في هذا الدليل ستجد خطوات عملية يمكنك تطبيقها مباشرة لبناء تجربة تجديد أوضح وأكثر أمانًا وقابلية للقياس.", "This guide gives you practical steps you can apply immediately to build a clearer, safer, and more measurable renewal experience.");
  return publicShell(`<main class="article-page"><section class="article-hero"><div class="container"><span class="badge">${post.category}</span><h1>${localizedField(post.title)}</h1><p>${localizedField(post.excerpt)}</p><small>${localizedField(post.date)} · ${localizedField(post.minutes)}</small></div></section><article class="container article-body"><img class="article-cover" src="${post.image}" alt="${escapeHtml(localizedField(post.title))}"><div class="article-content"><p class="article-lead">${lead}</p>${post.sections.map((section, index) => `<section><span>${String(index + 1).padStart(2, "0")}</span><div><h2>${localizedField(section.heading)}</h2><p>${localizedField(section.body)}</p></div></section>`).join("")}<aside class="article-takeaways"><h2>${localizedCopy("خلاصة عملية", "Practical takeaways")}</h2><ul>${takeaways.map((item) => `<li>${item}</li>`).join("")}</ul></aside></div><div class="public-cta"><div><h2>${localizedCopy("طبّق هذه الخطوات في Renvix", "Put these steps into practice with Renvix")}</h2><p>${localizedCopy("ابدأ بإدارة تجديداتك من لوحة موحدة وآمنة.", "Manage renewals from one clear and secure workspace.")}</p></div><button class="btn btn-primary" data-link="/register">${localizedCopy("ابدأ الآن", "Get started")}</button></div></article></main>`);
}

function linkedDeviceById(deviceId) {
  const devices = Array.isArray(state.linkedDevice?.devices) ? state.linkedDevice.devices : [];
  return devices.find((item) => String(item.id) === String(deviceId)) || (String(state.linkedDevice?.id || "") === String(deviceId) ? state.linkedDevice : null);
}

async function refreshLinkedDevice(deviceId, { connectionTest = false } = {}) {
  const device = linkedDeviceById(deviceId);
  if (!device) throw new Error("تعذر العثور على الجهاز المطلوب.");
  const provider = String(device.provider || "").toLowerCase();
  if (["meta", "meta_cloud", "meta_cloud_api"].includes(provider)) {
    await syncLinkedDevice();
    return { status: device.status, provider, fromWebhook: true, connectionTest };
  }
  throw new Error("هذه القناة ليست اتصال Meta Cloud API رسميًا.");
}

// Kept temporarily as a compatibility reference while the support center uses the functional implementation below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function legacyMarketingSupportPage() {
  const cards = [["مركز المساعدة", "أدلة شاملة ومقالات لمساعدتك خطوة بخطوة.", "تصفح المقالات", "#help-center", "helpBook"], ["الأسئلة الشائعة", "إجابات سريعة لأكثر الأسئلة شيوعًا.", "عرض الأسئلة", "#faq", "faq"], ["الدردشة", "تحدث مباشرة مع فريق الدعم.", "ابدأ المحادثة", "open-chat", "chat"], ["تواصل عبر البريد", "راسلنا وسنرد عليك خلال 24 ساعة عمل.", "راسلنا الآن", "open-email", "email"]];
  const knowledgeIcons = {
    "البدء السريع": "rocket",
    "إدارة الاشتراكات": "subscriptions",
    "التكاملات والإعدادات": "puzzle",
    "الفوترة والدفع": "payments",
    "التقارير والتحليلات": "barChart"
  };
  return publicShell(`<main class="support-page"><section class="section support-hero"><div class="container support-intro-row"><div class="support-intro-copy"><span class="eyebrow">نحن هنا لمساعدتك</span><h1>مركز الدعم</h1><p>ابحث في مقالات المساعدة، تواصل مع فريق الدعم، أو أرسل طلبك وسنعود إليك بأقرب وقت.</p></div><div class="support-cards">${cards.map(([title, body, label, action, mark]) => `<article class="card">${dashboardIcon(mark)}<h2>${title}</h2><p>${body}</p>${action.startsWith("#") ? `<a class="btn btn-secondary" href="/support${action}">${label}</a>` : `<button class="btn btn-secondary" data-action="${action}">${label}</button>`}</article>`).join("")}</div></div></section>
    <section class="section support-body"><div class="container support-layout"><article class="card help-center" id="help-center"><h2>مركز المساعدة</h2>${knowledgeBase.slice(0, 5).map((item) => `<button data-action="knowledge" data-term="${item}">${dashboardIcon(knowledgeIcons[item] || "helpBook")}<span><strong>${item}</strong><small>تعرف على التفاصيل والخطوات الأساسية.</small></span><b>‹</b></button>`).join("")}</article><article class="card faq-panel" id="faq"><h2>ابحث في مقالات المساعدة</h2><input class="input" data-action="support-search" placeholder="ابحث عن حلول ومقالات..."><h2>الأسئلة الشائعة</h2>${["ما هو Renvix وكيف يعمل؟", "كيف يمكنني ربط حسابي في واتساب؟", "هل يمكنني إلغاء اشتراكي في أي وقت؟", "ما هي طرق الدفع المتاحة؟", "كيف أتابع أداء حملاتي وتقاريري؟"].map((q) => `<details><summary>${q}</summary><p>ستجد الخطوات داخل مركز المساعدة، ويمكن لفريق الدعم مساعدتك إذا احتجت إلى توجيه إضافي.</p></details>`).join("")}</article><article class="card support-form-card"><h2>أرسل لنا طلب دعم</h2><p>صف مشكلتك أو استفسارك وسنقوم بالرد عليك.</p><form data-submit="support-request" class="grid"><label class="field"><span>الاسم الكامل</span><input class="input" name="name" required></label><label class="field"><span>البريد الإلكتروني</span><input class="input" type="email" name="email" required></label><label class="field"><span>الموضوع</span><select class="select" name="subject" required><option value="">اختر موضوع الطلب</option><option>مشكلة تقنية</option><option>الفوترة والباقات</option><option>ربط الأجهزة</option></select></label><label class="field"><span>تفاصيل الطلب</span><textarea class="textarea" name="details" required></textarea></label><button class="btn btn-primary">إرسال الطلب</button></form></article></div></section></main>`);
}

function marketingSupportPage() {
  const guides = [
    {
      id: "quick-start",
      slug: "quick-start-guide",
      title: "البدء السريع",
      icon: "rocket",
      summary: "جهّز حسابك وأول اشتراك وتذكير بخطوات واضحة.",
      steps: [
        "أكمل بيانات الحساب والمتجر من الإعدادات.",
        "أضف العميل ثم أنشئ اشتراكه وحدد الباقة وتواريخ البداية والنهاية.",
        "اختر قناة الإرسال وأدخل رقم واتساب أو البريد المطلوب.",
        "اربط القناة من قسم تطبيقاتنا، ثم فعّل رسالة التذكير بعد مراجعة القالب."
      ]
    },
    {
      id: "subscriptions",
      slug: "subscription-management-guide",
      title: "إدارة الاشتراكات",
      icon: "subscriptions",
      summary: "أنشئ الاشتراكات وتابع التجديدات وحالة الإرسال.",
      steps: [
        "افتح الاشتراكات واضغط إضافة اشتراك جديد.",
        "اختر العميل والخدمة والباقة وأدخل مدة الاشتراك وقيمته.",
        "حدد قناة الإرسال؛ رقم واتساب إلزامي لواتساب والبريد إلزامي للبريد.",
        "راجع إعدادات التذكير وحدد الموعد، ثم احفظ الاشتراك."
      ]
    },
    {
      id: "integrations",
      slug: "integrations-settings-guide",
      title: "التكاملات والإعدادات",
      icon: "puzzle",
      summary: "اربط القنوات والتطبيقات وتحقق من جاهزيتها بأمان.",
      steps: [
        "انتقل إلى الإعدادات ثم تطبيقاتنا.",
        "اختر التكامل المتاح واتبع خطوات الربط الظاهرة.",
        "استخدم مفاتيح API وWebhook من صفحة التكامل المخصصة ولا تشارك الأسرار.",
        "راجع سجل الاتصال وحالة الجاهزية قبل تشغيل الإرسال."
      ]
    },
    {
      id: "billing",
      slug: "billing-payments-guide",
      title: "الفوترة والدفع",
      icon: "payments",
      summary: "تعرّف على الباقات والفواتير والاستهلاك والتجديد.",
      steps: [
        "راجع الباقة الحالية وحدودها من قسم الفوترة.",
        "يُحتسب رصيد البريد واستهلاك القنوات وفق تفاصيل الباقة الظاهرة.",
        "احتفظ بالفواتير وسجل عمليات الدفع للرجوع إليها.",
        "يمكن إدارة التجديد من صفحة الفوترة وفق شروط الباقة."
      ]
    },
    {
      id: "reports",
      slug: "reports-analytics-guide",
      title: "التقارير والتحليلات",
      icon: "barChart",
      summary: "راقب التجديد والتسليم والأداء من بيانات حسابك.",
      steps: [
        "افتح التقارير وحدد الفترة التي تريد تحليلها.",
        "استخدم الفلاتر لعرض القناة أو الاشتراكات أو حالات الإرسال.",
        "راجع سجل التسليم والأخطاء قبل اتخاذ إجراء.",
        "صدّر التقرير عند الحاجة إلى مراجعته أو مشاركته داخل فريقك."
      ]
    }
  ];
  const faqs = [
    ["ما هو Renvix وكيف يعمل؟", "Renvix منصة لإدارة العملاء والاشتراكات والتجديدات وقنوات التذكير من لوحة واحدة. تضيف بيانات العميل واشتراكه، ثم تضبط القناة والموعد والقالب، وتتابع النتيجة من السجلات والتقارير."],
    ["كيف أربط قناة واتساب؟", "انتقل إلى «تطبيقاتنا»، افتح تكامل واتساب المتاح، واتبع خطوات الربط حتى تظهر الحالة «متصل». لن يبدأ الإرسال قبل اكتمال الاتصال وتوفر رقم واتساب صحيح للعميل."],
    ["هل يمكنني إلغاء التجديد؟", "يمكنك إدارة التجديد من صفحة الفوترة وفق الباقة وشروطها. إيقاف التجديد يمنع دورة التجديد التالية ولا يحذف بيانات حسابك أو اشتراكات عملائك."],
    ["ما طرق الدفع المتاحة؟", "تظهر طرق الدفع المتاحة فعليًا أثناء اختيار الباقة أو إتمام عملية الدفع. إذا لم تظهر وسيلة مناسبة، أرسل طلبًا بعنوان «الفوترة والباقات» ليطلع الفريق على حالتك."],
    ["كيف أتابع أداء الرسائل والتجديدات؟", "من قسم التقارير وسجل الإرسال يمكنك مراجعة الرسائل المجدولة والمرسلة والمتعثرة، ومعرفة الاشتراكات القريبة من التجديد واستخدام الفلاتر للوصول إلى السجل المطلوب."],
    ["أين أجد رد فريق الدعم؟", "يرسل فريق الدعم الرد إلى البريد الذي كتبته في الطلب، ويحفظ الرد مع التذكرة داخل لوحة الإدارة. احتفظ برقم الطلب لتسهيل المتابعة."]
  ];
  const query = state.search.trim().toLowerCase();
  const visibleGuides = guides.filter((guide) => !query || `${guide.title} ${guide.summary} ${guide.steps.join(" ")}`.toLowerCase().includes(query));
  const visibleFaqs = faqs.filter(([question, answer]) => !query || `${question} ${answer}`.toLowerCase().includes(query));
  const cards = [
    ["مركز المساعدة", "أدلة عملية تساعدك خطوة بخطوة.", "تصفح المقالات", "blog", "helpBook"],
    ["الأسئلة الشائعة", "إجابات واضحة لأكثر الأسئلة شيوعًا.", "عرض الأسئلة", "faq", "faq"],
    ["محادثة الدعم", "أرسل رسالة منظمة وتابع الرد عبر بريدك.", "ابدأ المحادثة", "open-chat", "chat"],
    ["طلب عبر البريد", "أنشئ تذكرة دعم تصل مباشرة إلى الفريق.", "راسلنا الآن", "open-email", "email"]
  ];
  const guideLabelsEn = {
    "quick-start-guide": "Read the quick start guide",
    "subscription-management-guide": "Read the subscription management guide",
    "integrations-settings-guide": "Read the integrations and settings guide",
    "billing-payments-guide": "Read the billing and payments guide",
    "reports-analytics-guide": "Read the reports and analytics guide"
  };
  const guideButtons = visibleGuides.length
    ? visibleGuides.map((guide) => `<button data-link="/blog/${guide.slug}" aria-label="${state.language === "en" ? guideLabelsEn[guide.slug] : `اقرأ دليل ${guide.title}`}">${dashboardIcon(guide.icon)}<span><strong>${guide.title}</strong><small>${guide.summary}</small></span><b>‹</b></button>`).join("")
    : `<p class="support-empty">لا توجد أدلة مطابقة لعبارة البحث.</p>`;
  const faqItems = visibleFaqs.length
    ? visibleFaqs.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join("")
    : `<p class="support-empty">لا توجد أسئلة مطابقة لعبارة البحث.</p>`;
  return publicShell(`<main class="support-page"><section class="section support-hero"><div class="container support-intro-row"><div class="support-intro-copy"><span class="eyebrow">نحن هنا لمساعدتك</span><h1>مركز الدعم</h1><p>ابحث في الأدلة والأسئلة، أو أنشئ طلب دعم حقيقي يصل إلى فريق Renvix وتابع الرد عبر بريدك الإلكتروني.</p></div><div class="support-cards">${cards.map(([title, body, label, action, mark]) => `<article class="card">${dashboardIcon(mark)}<h2>${title}</h2><p>${body}</p>${action === "blog" ? `<button class="btn btn-secondary" data-link="/blog">${label}</button>` : action === "faq" ? `<a class="btn btn-secondary" href="/support#faq">${label}</a>` : `<button class="btn btn-secondary" data-action="${action}">${label}</button>`}</article>`).join("")}</div></div></section>
    <section class="section support-body"><div class="container support-layout">
      <article class="card help-center" id="help-center"><h2>مركز المساعدة</h2>${guideButtons}</article>
      <article class="card faq-panel" id="faq"><h2>ابحث في مركز المساعدة</h2><input class="input" data-action="support-search" value="${escapeHtml(state.search)}" placeholder="ابحث عن حل أو سؤال..."><h2>الأسئلة الشائعة</h2>${faqItems}</article>
      <article class="card support-form-card" id="support-request"><h2>أرسل لنا طلب دعم</h2><p>سيصل الطلب إلى الرسائل والشكاوى، وسنرسل الرد إلى بريدك.</p><form data-submit="support-request" class="grid"><label class="field"><span>الاسم الكامل</span><input class="input" name="name" minlength="2" maxlength="120" required></label><label class="field"><span>البريد الإلكتروني</span><input class="input" type="email" name="email" maxlength="254" required></label><label class="field"><span>نوع الطلب</span><select class="select" name="type" required><option value="INQUIRY">استفسار عام</option><option value="TECHNICAL_ISSUE">مشكلة تقنية</option><option value="BILLING">الفوترة والباقات</option><option value="INTEGRATION">التكاملات وربط القنوات</option><option value="ACCOUNT">الحساب وتسجيل الدخول</option><option value="COMPLAINT">شكوى</option><option value="SUGGESTION">اقتراح</option><option value="OTHER">أخرى</option></select></label><label class="field"><span>عنوان الطلب</span><input class="input" name="subject" minlength="5" maxlength="150" placeholder="اكتب عنوانًا مختصرًا وواضحًا" required></label><label class="field"><span>تفاصيل الطلب</span><textarea class="textarea" name="details" minlength="10" maxlength="2000" placeholder="اشرح المشكلة والخطوات التي قمت بها..." required></textarea></label><button class="btn btn-primary" type="submit">إرسال الطلب</button></form></article>
    </div></section></main>`);
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
    "/privacy": {
      title: "سياسة الخصوصية - رينفكس",
      intro: "توضح هذه السياسة، بلغة واضحة، كيف تتعامل رينفكس (Renvix) مع البيانات الشخصية عند استخدام مواقعنا ومنصتنا وخدماتنا الرقمية.",
      sections: [
        ["نطاق السياسة وهوية المنصة", "تسري هذه السياسة على موقعَي renvix.app وrenvix.click، وعلى لوحة رينفكس والواجهات البرمجية والروابط والخدمات المرتبطة بهما. ويُقصد بعبارة «رينفكس» في هذه السياسة المنصة التي تقدم خدمات إدارة العملاء والاشتراكات والتجديدات والتنبيهات والتكاملات الرقمية."],
        ["البيانات التي نجمعها", "قد نعالج بيانات الحساب مثل الاسم والبريد ورقم التواصل وبيانات المنشأة، وبيانات العملاء والاشتراكات والطلبات التي يضيفها صاحب الحساب، وإعدادات الرسائل والقوالب والتكاملات، وسجلات الدخول والأمان والدعم والفوترة، إضافة إلى معلومات تقنية محدودة مثل عنوان الشبكة ونوع الجهاز والمتصفح ووقت الطلب، بالقدر اللازم لتشغيل الخدمة وحمايتها."],
        ["مصادر البيانات", "نحصل على البيانات منك مباشرة عند التسجيل أو التواصل مع الدعم، ومن المستخدمين المخولين داخل مساحة العمل، ومن المنصات الخارجية التي تختار ربطها برينفكس. وأنت مسؤول عن امتلاك الصلاحية والمسوغ النظامي لإضافة بيانات العملاء أو مزامنتها واستخدامها في الإرسال."],
        ["أغراض المعالجة ومسوغاتها", "نستخدم البيانات لإنشاء الحساب وإدارة الاشتراك، وتشغيل التنبيهات والرسائل والروابط والتكاملات، وتنفيذ طلباتك، وتقديم الدعم، ومعالجة المدفوعات، وحماية الحساب ومنع الاحتيال وإساءة الاستخدام، وتحسين موثوقية الخدمة، والوفاء بالالتزامات النظامية. وتتم المعالجة بحسب طبيعتها استنادًا إلى تنفيذ العقد، أو الموافقة، أو مصلحة مشروعة لا تتعارض مع حقوق صاحب البيانات، أو التزام نظامي واجب التطبيق."],
        ["دور رينفكس وبيانات عملائك", "يُعد صاحب الحساب مسؤولًا عن أغراض معالجة بيانات عملائه والرسائل المرسلة إليهم، وتعمل رينفكس على معالجة تلك البيانات لتنفيذ تعليماته وتقديم الخدمة، ما لم تكن رينفكس جهة تحكم مستقلة في معالجة محددة مثل بيانات الحساب والفوترة والأمان. يجب عدم رفع بيانات لا حاجة لها أو بيانات جُمعت دون مسوغ نظامي."],
        ["مشاركة البيانات ومقدمو الخدمات", "لا نبيع البيانات الشخصية. وقد نشارك القدر الضروري منها مع مزودي الاستضافة وقواعد البيانات والدفع والبريد والرسائل والتحليلات الأمنية والدعم، أو مع جهة رسمية عندما يلزم ذلك نظامًا. يقتصر الإفصاح على الغرض المحدد وبموجب ضوابط تعاقدية وأمنية مناسبة."],
        ["النقل والمعالجة خارج المملكة", "قد يستخدم بعض مزودي الخدمات بنية تقنية خارج المملكة العربية السعودية. عند حدوث نقل أو إفصاح عابر للحدود، تتخذ رينفكس الإجراءات والضمانات المطلوبة وفق الأنظمة واللوائح السارية، وبالقدر اللازم لتقديم الخدمة."],
        ["الحماية والاحتفاظ", "نطبق ضوابط وصول وعزل لمساحات العمل، وتدابير تقنية وتنظيمية معقولة لحماية البيانات، مع إدراك أنه لا توجد وسيلة إلكترونية خالية تمامًا من المخاطر. نحتفظ بالبيانات طوال مدة الحساب أو للمدة اللازمة للأغراض الموضحة، ثم نحذفها أو نخفي هويتها، ما لم يتطلب النظام أو تسوية نزاع أو حماية الحقوق الاحتفاظ بها مدة أطول."],
        ["حقوق أصحاب البيانات", "وفق الأنظمة المطبقة، يحق لصاحب البيانات العلم بطريقة المعالجة، وطلب الوصول إلى بياناته أو الحصول عليها بصيغة واضحة، وتصحيحها أو استكمالها أو تحديثها، وطلب إتلاف ما انتهت الحاجة إليه، والعدول عن الموافقة عندما تكون هي مسوغ المعالجة. يمكن تقديم الطلب عبر مركز الدعم أو support@renvix.app، وقد نطلب التحقق من الهوية قبل تنفيذه."],
        ["ملفات الارتباط والإشعارات", "قد تستخدم المواقع تقنيات تخزين ضرورية لتسجيل الدخول وحفظ تفضيلات اللغة والأمان وتشغيل الجلسة. ويمكن للمستخدم إدارة إعدادات التنبيهات والرسائل من حسابه، مع بقاء الإشعارات الضرورية المتعلقة بالأمان أو الخدمة أو الفوترة عند الحاجة."],
        ["التحديثات والتواصل", "قد نحدّث هذه السياسة عند تغير الخدمة أو المتطلبات النظامية، وسننشر النسخة المحدثة وتاريخ سريانها في هذه الصفحة، ونقدم إشعارًا مناسبًا عند وجود تغيير جوهري. للاستفسارات أو الشكاوى المتعلقة بالخصوصية تواصل عبر مركز الدعم أو support@renvix.app."]
      ]
    },
    "/terms": {
      title: "سياسة الاستخدام - رينفكس",
      intro: "تنظم هذه الشروط استخدام مواقع وخدمات رينفكس، وتوضح حقوق ومسؤوليات صاحب الحساب والمستخدمين المخولين.",
      sections: [
        ["نطاق الشروط وقبولها", "تسري هذه الشروط على renvix.app وrenvix.click وعلى لوحة رينفكس وواجهاتها وروابطها وخدماتها الرقمية. بإنشاء حساب أو شراء باقة أو استخدام الخدمة، فإنك تقر بقراءة هذه الشروط والسياسات المرتبطة بها والموافقة عليها، وبأن لديك الأهلية والصلاحية للتعاقد باسمك أو باسم المنشأة التي تمثلها."],
        ["الخدمة", "توفر رينفكس أدوات لإدارة العملاء والاشتراكات والتجديدات والتنبيهات والقوالب وروابط معلومات الطلب والتكاملات. قد تختلف الخصائص والحدود بحسب الخطة وحالة التكامل، وتُعد المعلومات المعروضة وقت الشراء جزءًا من وصف الخدمة."],
        ["الحساب والصلاحيات", "يجب تقديم بيانات صحيحة ومحدثة، وحماية كلمة المرور ورموز التحقق ومفاتيح API، وقصر الوصول على المستخدمين المخولين. يتحمل صاحب الحساب مسؤولية الأنشطة المنفذة من مساحته، وعليه إبلاغ رينفكس فورًا عند الاشتباه في وصول غير مصرح به."],
        ["بيانات العملاء والموافقات", "يؤكد صاحب الحساب أن لديه الحق والمسوغ النظامي لجمع بيانات عملائه ورفعها ومعالجتها، وأنه حصل على الموافقات المطلوبة قبل إرسال رسائل تسويقية أو تشغيلية إليهم. كما يلتزم باحترام طلبات إلغاء الاشتراك وعدم مراسلة من اعترض على التواصل معه متى كان ذلك واجبًا."],
        ["الاستخدام المقبول", "يُحظر استخدام رينفكس في الرسائل المزعجة أو المضللة، أو انتحال الهوية، أو الاحتيال، أو انتهاك الخصوصية والملكية الفكرية، أو نشر محتوى ضار أو غير مشروع، أو محاولة اختراق الخدمة أو تجاوز حدودها أو تعطيلها، أو مشاركة المفاتيح والأسرار مع غير المخولين."],
        ["القنوات والتكاملات الخارجية", "تخضع خدمات واتساب والبريد ومنصات التجارة الإلكترونية وبوابات الدفع وغيرها لشروط وتوفر مزوديها. أنت مسؤول عن صحة بيانات الربط والأرقام والقوالب والمحتوى، وقد تتأثر بعض الوظائف بتغيير مزود خارجي لسياساته أو واجهاته. لا يعني الربط أن رينفكس تملك تلك المنصات أو تمثلها."],
        ["الاشتراكات والأسعار والدفع", "تظهر رسوم الباقة ومدتها وحدودها والضرائب المطبقة قبل إتمام الشراء. يلتزم صاحب الحساب بسداد المبالغ المستحقة، وقد تُعلق المزايا المدفوعة عند تعذر السداد. إذا كان التجديد تلقائيًا فسيُوضح ذلك قبل الاشتراك، ويمكن إيقاف التجديد للدورات المستقبلية من القنوات المتاحة دون أن يلغي ذلك المدة المدفوعة الحالية."],
        ["الملكية الفكرية والترخيص", "تظل حقوق رينفكس في المنصة والبرمجيات والتصميم والعلامات والمحتوى محفوظة. يُمنح المستخدم ترخيصًا محدودًا وغير حصري لاستخدام الخدمة خلال مدة الاشتراك وفق هذه الشروط، ولا يجوز نسخها أو إعادة بيعها أو هندستها عكسيًا إلا بالقدر الذي يسمح به النظام صراحة."],
        ["التوفر والدعم", "نبذل عناية معقولة للمحافظة على استقرار الخدمة وأمانها، وقد يلزم إجراء صيانة أو تحديثات أو معالجة أعطال طارئة. لا تضمن رينفكس استمرار الخدمات الخارجية دون انقطاع، لكنها تتعامل مع الأعطال الواقعة ضمن نطاقها وتوفر قنوات للدعم والمتابعة."],
        ["التعليق والإنهاء", "يجوز تعليق الوصول مؤقتًا عند وجود خطر أمني أو استخدام مخالف أو مبالغ مستحقة، مع مراعاة الأنظمة المطبقة والإشعار عندما يكون ممكنًا. ويمكن لصاحب الحساب إلغاء التجديد أو طلب إغلاق الحساب، وتُعالج البيانات والمبالغ بعد الإنهاء وفق سياسة الخصوصية وسياسة الاستبدال والاسترجاع."],
        ["حدود المسؤولية", "تُطبق المسؤولية في حدود الأنظمة الواجبة، ولا تستبعد هذه الشروط حقًا لا يجوز استبعاده نظامًا. لا تتحمل رينفكس آثار قرارات أو محتوى أو بيانات غير صحيحة أدخلها المستخدم، أو استخدام مخالف، أو تعطل جهة خارجية لا تخضع لسيطرتها، مع بقاء مسؤوليتها عن التزاماتها النظامية والخدمة التي تعاقدت على تقديمها."],
        ["التعديلات والأنظمة المطبقة", "قد تُحدّث هذه الشروط عند تطوير الخدمة أو تغير المتطلبات النظامية، ويُنشر تاريخ التحديث في هذه الصفحة مع إشعار مناسب بالتغييرات الجوهرية. تخضع هذه الشروط للأنظمة السارية في المملكة العربية السعودية، وتُعالج الملاحظات والنزاعات أولًا عبر الدعم دون الإخلال بحقوق الأطراف أمام الجهات المختصة."],
        ["التواصل", "للاستفسار عن الشروط أو الإبلاغ عن مخالفة، افتح طلبًا من مركز الدعم أو راسل support@renvix.app. لا ترسل كلمات المرور أو رموز التحقق أو بيانات البطاقة الكاملة ضمن المراسلات."]
      ]
    },
    "/refund-policy": {
      title: "سياسة الاستبدال والاسترجاع - رينفكس",
      intro: "توضح هذه السياسة آلية إلغاء الخدمات الرقمية واسترداد المبالغ في رينفكس بصورة عادلة وشفافة، دون الانتقاص من الحقوق المقررة نظامًا.",
      sections: [
        ["نطاق السياسة", "تسري هذه السياسة على الباقات والرصيد والخدمات الرقمية المشتراة عبر renvix.app أو renvix.click. ولأن رينفكس تقدم خدمات رقمية وليست سلعًا مادية، فلا ينطبق الاستبدال بصورته الخاصة بالمنتجات المادية؛ ويُقصد به هنا معالجة خلل الخدمة أو توفير البديل المناسب متى كان ذلك ممكنًا."],
        ["حق الإلغاء خلال سبعة أيام", "يجوز للمستهلك طلب فسخ التعاقد واسترداد المبلغ خلال سبعة أيام من تاريخ التعاقد إذا لم يستخدم الخدمة ولم ينتفع بها، وذلك وفق نظام التجارة الإلكترونية وما ينطبق من استثناءاته. ويُعد تفعيل الخصائص المدفوعة أو إرسال الرسائل أو استهلاك الرصيد أو استخدام التكاملات انتفاعًا بالخدمة بالقدر المستهلك."],
        ["الحالات المؤهلة للاسترداد", "تشمل الحالات التي تستحق المراجعة: الخصم المكرر، أو تحصيل مبلغ مخالف لما ظهر عند الشراء، أو عدم إتاحة الخدمة المدفوعة بسبب خلل جوهري من رينفكس تعذر إصلاحه خلال مدة معقولة، أو تأخر تقديم الخدمة أكثر من خمسة عشر يومًا عن الموعد المتفق عليه ما لم يكن التأخير بسبب قوة قاهرة، إضافة إلى أي حالة يقرر النظام فيها حق الاسترداد."],
        ["معالجة العيوب التقنية", "عند وجود عيب تقني، نطلب معلومات كافية للتحقق منه ونسعى أولًا إلى إصلاحه أو إعادة إتاحة المنفعة دون تكلفة إضافية. إذا تعذر الإصلاح وكان الخلل مؤثرًا في الخدمة المدفوعة، يُحدد الاسترداد الكامل أو الجزئي بحسب أثر الخلل ومدة الانتفاع، مع مراعاة الحقوق النظامية."],
        ["الحالات غير المؤهلة عادةً", "لا تُسترد عادةً قيمة المدة أو الرسائل أو الرصيد الذي استُخدم فعليًا، أو الخدمات المخصصة بعد بدء تنفيذها بموافقة العميل، أو المبالغ الناتجة عن مخالفة سياسة الاستخدام، أو عدم توافق سببه إعداد خاطئ من المستخدم. كما لا يكون تعطل مزود خارجي وحده سببًا تلقائيًا للاسترداد متى ظلت خدمة رينفكس الأساسية متاحة، ما لم يقرر النظام أو وصف الخدمة خلاف ذلك."],
        ["إلغاء التجديد وتغيير الخطة", "يمكن إيقاف التجديد للدورات المستقبلية عبر القنوات المتاحة، ويستمر الوصول عادةً حتى نهاية المدة المدفوعة. لا يؤدي إيقاف التجديد إلى استرداد تلقائي للمدة المستخدمة. وتُطبق الترقية فورًا بحسب السعر المعروض، بينما يبدأ التخفيض من دورة الفوترة التالية ما لم يُذكر خلاف ذلك قبل التأكيد."],
        ["تقديم طلب الاسترداد", "يُقدم الطلب من مركز الدعم أو عبر support@renvix.app، مع بريد الحساب ورقم الفاتورة وتاريخ العملية ووصف واضح للسبب وأي مستند مؤيد. لا ترسل رقم البطاقة الكامل أو كلمة المرور أو رمز التحقق. وقد نطلب معلومات إضافية للتحقق من صاحب الحساب ومن العملية."],
        ["المراجعة وإعادة المبلغ", "تراجع رينفكس الفاتورة وسجل الاستخدام والخلل المبلغ عنه، ثم ترسل نتيجة الطلب إلى البريد المسجل. عند قبول الاسترداد، يُعاد المبلغ المستحق إلى وسيلة الدفع الأصلية متى كان ذلك متاحًا، وقد تختلف مدة ظهوره بحسب بوابة الدفع والبنك المصدر. لا تشمل المدة الزمنية إجراءات الجهات المالية الخارجة عن سيطرة رينفكس."],
        ["المدفوعات غير المصرح بها", "إذا اشتبهت في عملية غير مصرح بها، تواصل معنا فورًا وأبلغ البنك أو مزود الدفع. سنراجع سجلات الحساب ونتعاون في حدود الصلاحيات المتاحة، وقد نوقف الوصول مؤقتًا لحماية الحساب إلى حين اكتمال التحقق."],
        ["الشكاوى والتواصل", "لأي اعتراض على قرار فوترة، أرسل رقم الطلب المرجعي والمعلومات الداعمة عبر مركز الدعم أو support@renvix.app. سنعيد مراجعة الطلب، ولا تمنع هذه الآلية المستفيد من ممارسة حقوقه لدى الجهات المختصة وفق الأنظمة المعمول بها."]
      ]
    },
    "/contact": { title: "تواصل معنا", intro: "اختر القناة المناسبة وسنوجه طلبك إلى الفريق المختص بأسرع وقت ممكن.", sections: [["الدعم الفني", "لأخطاء الحساب، ربط الأجهزة، الجلسات، أو التكاملات استخدم نموذج مركز الدعم وأرفق وصفًا واضحًا ووقت حدوث المشكلة دون مشاركة أي مفتاح سري."], ["المبيعات والباقات", "للاستفسار عن الخطط وحدود الاستخدام واحتياجات المؤسسات، أرسل طلبًا بعنوان المبيعات والباقات مع حجم الفريق وعدد العملاء المتوقع."], ["الفوترة", "للفواتير أو المدفوعات اذكر رقم الفاتورة والبريد المسجل فقط. لن يطلب فريقنا كلمة المرور أو رمز التحقق أو بيانات البطاقة الكاملة."], ["الأمان والخصوصية", "للإبلاغ عن مشكلة أمنية أو طلب متعلق ببياناتك، استخدم قناة الدعم واكتب بوضوح أن الطلب متعلق بالأمان أو الخصوصية ليتم تصعيده للفريق المختص."], ["أوقات الاستجابة", "نراجع الطلبات حسب الأولوية والتأثير. تظهر الحالات الحرجة المتعلقة بتعطل الخدمة أو الأمان في مقدمة قائمة المعالجة."], ["البريد الرسمي", "يمكن مراسلتنا عبر support@renewpilot.ai، أو استخدام مركز الدعم للحصول على رقم مرجعي ومتابعة حالة الطلب."]] }
  };
  const englishPolicies = {
    "/privacy": {
      title: "Privacy Policy - Renvix",
      intro: "This policy explains in clear language how Renvix handles personal data across our websites, platform, and connected digital services.",
      sections: [
        ["Scope and platform identity", "This policy applies to renvix.app, renvix.click, the Renvix dashboard, APIs, links, and connected services. “Renvix” refers to the platform that provides customer, subscription, renewal, notification, and digital integration tools."],
        ["Data we process", "We may process account and business details, customer, subscription, and order data entered by account owners, messaging templates and settings, integration details, billing and support records, and limited technical information such as network address, device, browser, and request time where needed to operate and secure the service."],
        ["Sources of data", "Data comes directly from you, authorized workspace users, and third-party services you choose to connect. You are responsible for having the authority and lawful basis required to upload, synchronize, and use customer data for communications."],
        ["Purposes and legal bases", "We process data to create and manage accounts, provide subscriptions, reminders, messages, links, and integrations, fulfill requests, provide support, process payments, secure accounts, prevent fraud and abuse, improve reliability, and meet legal duties. Depending on the activity, processing is based on contract performance, consent, a legitimate interest that does not override individual rights, or an applicable legal obligation."],
        ["Renvix's role and your customer data", "The account owner determines the purposes of processing its customer data and the communications sent to customers. Renvix processes that data to provide the service and follow the account owner's instructions, except where Renvix independently controls a specific activity such as account, billing, or security processing."],
        ["Sharing and service providers", "We do not sell personal data. Necessary data may be shared with hosting, database, payment, email, messaging, security analytics, and support providers, or with public authorities where legally required. Disclosure is limited to a defined purpose and subject to appropriate contractual and security controls."],
        ["International processing", "Some service providers may use infrastructure outside Saudi Arabia. Where cross-border transfer or disclosure occurs, Renvix applies the measures and safeguards required by applicable laws and regulations and limits processing to what the service requires."],
        ["Security and retention", "We apply workspace isolation, access controls, and reasonable technical and organizational safeguards, while recognizing that no electronic method is risk-free. Data is retained while the account is active or as needed for the stated purposes, then deleted or de-identified unless law, dispute resolution, or protection of rights requires longer retention."],
        ["Your data rights", "Subject to applicable law, individuals may request information about processing, access to or a readable copy of their data, correction, completion or updating, destruction of data no longer needed, and withdrawal of consent where consent is the legal basis. Requests may be submitted through the Support Center or support@renvix.app, and identity verification may be required."],
        ["Cookies and notifications", "Our websites may use storage technologies necessary for sign-in, language preferences, security, and session operation. Users can manage reminder and messaging settings in their accounts, while essential security, service, and billing notices may still be delivered where necessary."],
        ["Updates and contact", "We may update this policy as the service or legal requirements change. The revised version and effective date will be published here, with appropriate notice for material changes. Privacy questions or complaints can be submitted through the Support Center or support@renvix.app."]
      ]
    },
    "/terms": {
      title: "Terms of Use - Renvix",
      intro: "These terms govern the use of Renvix websites and services and explain the responsibilities of account owners and authorized users.",
      sections: [
        ["Scope and acceptance", "These terms apply to renvix.app, renvix.click, the Renvix dashboard, APIs, links, and digital services. By creating an account, purchasing a plan, or using the service, you agree to these terms and related policies and confirm that you have authority to act for yourself or the represented organization."],
        ["The service", "Renvix provides tools for managing customers, subscriptions, renewals, notifications, templates, order information links, and integrations. Features and limits may vary by plan and integration status, and the information displayed at purchase forms part of the service description."],
        ["Accounts and permissions", "You must provide accurate and current information, protect passwords, verification codes, and API keys, and limit access to authorized users. The account owner is responsible for activity in the workspace and must promptly report suspected unauthorized access."],
        ["Customer data and consent", "The account owner confirms it has the authority and lawful basis to collect, upload, and process customer data and has obtained any consent required before sending marketing or operational messages. Opt-out and objection requests must be honored where applicable."],
        ["Acceptable use", "Renvix must not be used for spam, deceptive messaging, impersonation, fraud, privacy or intellectual-property violations, unlawful or harmful content, attempts to compromise or disrupt the service, limit circumvention, or disclosure of credentials to unauthorized persons."],
        ["Third-party channels and integrations", "WhatsApp, email, commerce platforms, payment gateways, and other integrations are subject to their providers' terms and availability. You are responsible for connection details, numbers, templates, and content. Connecting a service does not mean Renvix owns, represents, or controls that provider."],
        ["Subscriptions, pricing, and payment", "Plan fees, duration, limits, and applicable taxes are displayed before purchase. The account owner must pay amounts due, and paid features may be suspended after payment failure. Automatic renewal, where offered, is disclosed before subscription and may be stopped for future cycles without canceling the current paid term."],
        ["Intellectual property and license", "Renvix retains all rights in the platform, software, design, marks, and content. Users receive a limited, non-exclusive license to use the service during the subscription term and may not copy, resell, or reverse engineer it except where expressly permitted by law."],
        ["Availability and support", "We use reasonable care to maintain service stability and security, and maintenance, updates, or emergency remediation may be required. Renvix does not guarantee uninterrupted third-party services but addresses faults within its control and provides support channels."],
        ["Suspension and termination", "Access may be temporarily suspended for security risk, prohibited use, or overdue payment, subject to applicable law and notice where practical. Account owners may stop renewal or request closure, with data and billing handled under the Privacy Policy and Refund Policy."],
        ["Liability", "Liability is governed by applicable law, and these terms do not exclude rights that cannot legally be excluded. Renvix is not responsible for user-provided decisions, content, or inaccurate data, prohibited use, or failures of an external provider outside its control, while remaining responsible for its statutory duties and contracted service."],
        ["Changes and governing law", "We may update these terms as the service or legal requirements change. The updated date will be published here and material changes will receive appropriate notice. These terms are governed by the laws of Saudi Arabia, without limiting either party's rights before the competent authorities."],
        ["Contact", "Questions or reports of misuse may be submitted through the Support Center or support@renvix.app. Do not send passwords, verification codes, or full card details in a support message."]
      ]
    },
    "/refund-policy": {
      title: "Refund and Replacement Policy - Renvix",
      intro: "This policy explains cancellation and refund handling for Renvix digital services without limiting rights granted by applicable law.",
      sections: [
        ["Scope", "This policy applies to digital plans, credits, and services purchased through renvix.app or renvix.click. Renvix does not sell physical goods, so physical product replacement does not apply; replacement means correcting a service defect or providing a suitable digital alternative where possible."],
        ["Seven-day cancellation right", "A consumer may request cancellation and a refund within seven days of contracting if the service has not been used and no benefit has been received, subject to the Saudi E-Commerce Law and applicable exceptions. Activating paid features, sending messages, consuming credits, or using integrations constitutes use to the extent consumed."],
        ["Eligible cases", "Reviewable cases include duplicate charges, an amount different from that displayed at checkout, a material Renvix defect that prevents delivery of the paid service and cannot be remedied within a reasonable time, or a delay exceeding fifteen days beyond the agreed delivery date unless caused by force majeure, as well as any case where applicable law requires a refund."],
        ["Technical defects", "When a technical defect is reported, we request enough information to verify it and first attempt to restore the paid benefit without additional charge. If correction is not possible and the defect materially affects the service, a full or proportionate refund is determined based on impact and actual use, subject to statutory rights."],
        ["Normally non-refundable cases", "Used subscription time, messages, or credits are normally non-refundable, as are customized services after work begins with customer approval, charges arising from prohibited use, or incompatibility caused by incorrect user configuration. A third-party outage alone does not automatically qualify where the core Renvix service remains available, unless law or the service description provides otherwise."],
        ["Renewal cancellation and plan changes", "Future automatic renewal may be stopped through available channels, and access normally continues through the paid term. Stopping renewal does not automatically refund consumed time. Upgrades apply according to the displayed price, while downgrades begin with the next billing cycle unless checkout states otherwise."],
        ["Submitting a request", "Submit a request through the Support Center or support@renvix.app with the account email, invoice number, transaction date, reason, and supporting information. Never send a full card number, password, or verification code. Additional information may be requested to verify the account and transaction."],
        ["Review and payment return", "Renvix reviews the invoice, usage, and reported issue and sends the outcome to the registered email. Approved amounts are returned to the original payment method where available. Posting times vary by gateway and issuing bank and are outside Renvix's processing time."],
        ["Unauthorized payments", "If you suspect an unauthorized payment, contact us immediately and notify your bank or payment provider. We will review account records and cooperate within our authority, and access may be temporarily restricted to protect the account during verification."],
        ["Complaints and contact", "To challenge a billing decision, submit the reference number and supporting information through the Support Center or support@renvix.app. We will review the request again, and this process does not prevent the customer from exercising rights before the competent authorities."]
      ]
    },
    "/contact": { title: "Contact Us", intro: "Choose the right channel and we will route your request to the appropriate team as quickly as possible.", sections: [["Technical support", "For account errors, device linking, sessions, or integrations, use the support form and include a clear description and time of occurrence without sharing secrets."], ["Sales and plans", "For plans, limits, and enterprise requirements, submit a Sales and Plans request with the expected team size and customer volume."], ["Billing", "For invoices or payments, provide only the invoice number and registered email. Our team will never ask for your password, verification code, or full card details."], ["Security and privacy", "Clearly mark security or privacy requests in the support channel so they can be escalated to the appropriate specialist."], ["Response times", "Requests are reviewed by priority and impact. Critical service availability and security issues are moved to the front of the queue."], ["Official email", "You can email support@renewpilot.ai or use the support center to receive a reference number and track your request."]] }
  };
  const selectedPolicies = state.language === "en" ? englishPolicies : policies;
  const content = selectedPolicies[state.route] || selectedPolicies["/privacy"];
  return publicShell(`<main class="policy-page"><section class="policy-hero"><div class="container"><span class="eyebrow">${localizedCopy("معلومات قانونية وتشغيلية", "Legal and operational information")}</span><h1>${content.title}</h1><p>${content.intro}</p><small>${localizedCopy("آخر تحديث: 31 يوليو 2026", "Last updated: July 31, 2026")}</small></div></section><section class="section policy-section"><div class="container policy-layout"><aside class="policy-summary"><h2>${localizedCopy("في هذه الصفحة", "On this page")}</h2>${content.sections.map(([title], index) => `<a href="#policy-${index + 1}"><span>${String(index + 1).padStart(2, "0")}</span>${title}</a>`).join("")}<button class="btn btn-primary" data-link="/support">${localizedCopy("تواصل مع الدعم", "Contact support")}</button></aside><article class="policy-content">${content.sections.map(([title, body], index) => `<section id="policy-${index + 1}"><span>${String(index + 1).padStart(2, "0")}</span><div><h2>${title}</h2><p>${body}</p></div></section>`).join("")}<div class="policy-contact"><strong>${localizedCopy("هل تحتاج إلى توضيح إضافي؟", "Need more information?")}</strong><p>${localizedCopy("راسلنا عبر support@renvix.app أو افتح طلبًا من مركز الدعم.", "Email support@renvix.app or open a request in the Support Center.")}</p><button class="btn btn-secondary" data-link="/support">${localizedCopy("الانتقال إلى مركز الدعم", "Go to Support Center")}</button></div></article></div></section></main>`);
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
  return `<main class="auth-light-page"><header class="auth-light-header">${logo()}<button class="link-button" data-link="/">العودة إلى الرئيسية ←</button></header><section class="reset-light-shell"><article class="card reset-light-panel"><span class="reset-lock">${resetPasswordIcon()}</span><h1>نسيت كلمة المرور</h1><p>${step === 1 ? "لا مشكلة، أدخل بريدك الإلكتروني المرتبط بحسابك وسنرسل لك رابطًا آمنًا لإعادة تعيين كلمة المرور." : step === 2 ? "أدخل رمز التحقق الذي أرسلناه إلى بريدك ثم اختر كلمة مرور جديدة." : "يمكنك الآن العودة إلى حسابك."}</p>${content}<p class="muted">إذا كان البريد موجودًا فسيصلك رابط الاستعادة خلال دقائق.</p><button class="link-button" data-link="/login">تذكرت كلمة المرور؟ تسجيل الدخول</button></article><aside class="card reset-light-visual"><div class="mail-visual">${stackedLogo()}</div><h2>خطوة بسيطة لاستعادة الوصول</h2><p>سنرسل لك رابطًا آمنًا لإدارة كلمة المرور والعودة إلى اشتراكاتك بسهولة.</p></aside></section>${publicFooter()}</main>`;
}

function normalizeEmailOtpCode(value) {
  return String(value || "")
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.codePointAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.codePointAt(0) - 0x06F0))
    .replace(/\D/g, "")
    .slice(0, 6);
}

function normalizeEmailOtpDigit(value) {
  return normalizeEmailOtpCode(value).slice(-1);
}

function collectEmailOtpCode(form) {
  const fields = Array.from(form.querySelectorAll("[data-otp-digit]"))
    .sort((first, second) => Number(first.dataset.otpDigit) - Number(second.dataset.otpDigit));
  const completeValue = fields
    .map((field) => normalizeEmailOtpCode(field.value))
    .find((value) => value.length === 6);
  if (completeValue) return completeValue;
  return normalizeEmailOtpCode(fields.map((field) => field.value).join(""));
}

function emailOtpPage() {
  const statusData = state.emailOtpStatus;
  if (statusData?.error) {
    return `<main class="email-otp-page"><section class="email-otp-invalid card"><span>${dashboardIcon("security")}</span><h1>تعذر متابعة التحقق</h1><p>${escapeHtml(statusData.error)}</p><button class="btn btn-primary" data-link="/login">العودة إلى تسجيل الدخول</button></section></main>`;
  }
  const maskedEmail = statusData?.maskedEmail || "جارٍ التحقق من طلب تسجيل الدخول...";
  const digitInputs = Array.from({ length: 6 }, (_, index) => `<input class="email-otp-digit" name="digit${index}" data-otp-digit="${index}" inputmode="numeric" pattern="[0-9٠-٩۰-۹]*" autocomplete="${index === 0 ? "one-time-code" : "off"}" maxlength="${index === 0 ? 6 : 1}" aria-label="الرقم ${index + 1} من رمز التحقق" ${statusData ? "" : "disabled"}>`).join("");
  return `<main class="email-otp-page" dir="rtl"><section class="email-otp-shell">
    <aside class="email-otp-visual"><div class="email-otp-brand">${stackedLogo()}</div><div class="email-otp-envelope-art" aria-hidden="true"><span class="email-otp-code-card"><b>1</b><b>2</b><b>3</b><b>4</b><b>5</b><b>6</b></span><span class="email-otp-envelope"></span><span class="email-otp-art-shield">${dashboardIcon("security")}</span></div><h2>تحقق آمن · دخول موثوق.</h2><p>نرسل رمز تحقق فريدًا إلى بريدك الإلكتروني لضمان أمان حسابك وحماية بياناتك.</p><div class="email-otp-safety-card"><h3>${dashboardIcon("security")} حالة الأمان</h3><div><span>نوع التحقق</span><strong>${dashboardIcon("email")} OTP عبر البريد</strong></div><div><span>آخر طلب رمز</span><strong>${dashboardIcon("clock")} الآن</strong></div><div><span>الجهاز</span><strong>${dashboardIcon("devices")} غير موثوق بعد</strong></div></div></aside>
    <article class="email-otp-panel"><span class="email-otp-secure-badge">${dashboardIcon("security")} تحقق آمن</span><div class="email-otp-panel-grid"><div class="email-otp-content"><h1>التحقق عبر البريد الإلكتروني</h1><p>أدخل رمز التحقق المكوّن من 6 أرقام المرسل إلى بريدك الإلكتروني لإكمال تسجيل الدخول.</p><label class="field email-otp-email"><span>البريد الإلكتروني</span><input class="input" value="${escapeHtml(maskedEmail)}" readonly aria-label="البريد الإلكتروني المخفي"></label><form data-submit="email-otp" class="email-otp-form" novalidate><label>رمز التحقق (6 أرقام)</label><div class="email-otp-digits" dir="rtl">${digitInputs}</div><div class="email-otp-resend-row"><span>${dashboardIcon("clock")} <span data-otp-countdown>يمكن إعادة الإرسال بعد قليل</span></span><button type="button" class="link-button" data-action="email-otp-resend" disabled>إعادة إرسال الرمز ${dashboardIcon("send")}</button></div><label class="email-otp-remember"><input type="checkbox" name="rememberDevice" checked> تذكّر هذا الجهاز لمدة 15 يومًا</label><button class="btn btn-primary email-otp-submit" type="submit" ${statusData ? "" : "disabled"}>تحقق وتسجيل الدخول ←</button><button class="btn btn-secondary" type="button" data-action="email-otp-cancel">العودة إلى تسجيل الدخول</button></form><p class="email-otp-help">لم يصلك الرمز؟ <button class="link-button" data-action="email-otp-help">تحقق من البريد غير الهام</button></p></div><ol class="email-otp-steps"><li class="done"><b>1</b><div><strong>إدخال البريد<br>وكلمة المرور</strong><small>مكتمل</small></div></li><li class="active"><b>2</b><div><strong>التحقق عبر البريد</strong><small>الخطوة الحالية</small></div></li><li><b>3</b><div><strong>الدخول إلى<br>لوحة التحكم</strong></div></li></ol></div></article>
  </section><footer class="email-otp-footer"><span>© 2026 Renvix.</span><button data-link="/privacy">سياسة الخصوصية</button><button data-link="/terms">الشروط والأحكام</button><button data-link="/contact">اتصل بنا</button><span>جميع الحقوق محفوظة</span></footer></main>`;
}

function mfaLoginPage() {
  const statusData = state.mfaLoginStatus;
  if (statusData?.error) {
    return `<main class="email-otp-page"><section class="email-otp-invalid card"><span>${dashboardIcon("security")}</span><h1>تعذر متابعة التحقق الثنائي</h1><p>${escapeHtml(statusData.error)}</p><button class="btn btn-primary" data-action="mfa-login-cancel">العودة إلى تسجيل الدخول</button></section></main>`;
  }
  return `<main class="auth-light-page mfa-login-page" dir="rtl"><header class="auth-light-header mfa-login-header">${logo()}<span class="email-otp-secure-badge">${dashboardIcon("security")} دخول OTP آمن</span></header><section class="reset-light-shell mfa-login-shell"><article class="card reset-light-panel mfa-login-panel"><span class="reset-lock">${dashboardIcon("security")}</span><h1>أدخل رمز تطبيق المصادقة</h1><p>اكتب الرمز الحالي المكوّن من 6 أرقام. يمكنك أيضًا استخدام أحد رموز الاسترداد المحفوظة.</p><form data-submit="mfa-login" class="grid auth-form" novalidate><label class="field"><span>رمز التحقق أو الاسترداد</span><input class="input code-input" name="code" inputmode="text" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" maxlength="32" ${statusData ? "" : "disabled"} required autofocus></label><button class="btn btn-primary auth-submit" type="submit" ${statusData ? "" : "disabled"}>تحقق وسجّل الدخول</button><button class="btn btn-secondary" type="button" data-action="mfa-login-cancel">العودة إلى تسجيل الدخول</button></form><p class="muted">صلاحية طلب التحقق خمس دقائق، ويُغلق بعد خمس محاولات غير صحيحة.</p></article><aside class="card reset-light-visual mfa-login-visual"><div class="mail-visual">${stackedLogo()}</div><h2>دخول الحساب OTP يحمي حسابك</h2><p>لن تُنشأ جلسة دخول قبل التحقق من الرمز على الخادم، ولا يكفي إنشاء المفتاح من الواجهة.</p></aside></section>${publicFooter()}</main>`;
}

async function loadMfaLoginStatus(force = false) {
  if (state.mfaLoginLoading || (state.mfaLoginStatus && !force)) return;
  state.mfaLoginLoading = true;
  try {
    const response = await fetch("/api/auth/mfa/status", { credentials: "include", cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    state.mfaLoginStatus = response.ok && payload.ok
      ? payload
      : { error: payload.reason === "challenge_expired" ? "انتهت صلاحية طلب التحقق. سجّل الدخول مرة أخرى." : "طلب التحقق غير صالح أو انتهت صلاحيته." };
  } catch {
    state.mfaLoginStatus = { error: "تعذر الاتصال بخدمة التحقق. حاول مرة أخرى بعد قليل." };
  } finally {
    state.mfaLoginLoading = false;
    if (state.route === "/auth/verify-mfa") render();
  }
}

async function loadEmailOtpStatus(force = false) {
  if (state.emailOtpLoading || (state.emailOtpStatus && !force)) return;
  state.emailOtpLoading = true;
  try {
    const response = await fetch("/api/auth/email-otp/status", { credentials: "include", cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    state.emailOtpStatus = response.ok && payload.ok
      ? payload
      : { error: payload.reason === "challenge_expired" ? "انتهت صلاحية رمز التحقق. سجّل الدخول لطلب رمز جديد." : "طلب التحقق غير صالح أو انتهت صلاحيته." };
  } catch {
    state.emailOtpStatus = { error: "تعذر الاتصال بخدمة التحقق. حاول مرة أخرى بعد قليل." };
  } finally {
    state.emailOtpLoading = false;
    if (state.route === "/auth/verify-email") render();
  }
}

function updateEmailOtpCountdown() {
  if (state.route !== "/auth/verify-email" || !state.emailOtpStatus?.resendAt) return;
  const countdown = document.querySelector("[data-otp-countdown]");
  const button = document.querySelector('[data-action="email-otp-resend"]');
  const seconds = Math.max(0, Math.ceil((new Date(state.emailOtpStatus.resendAt).getTime() - Date.now()) / 1000));
  if (countdown) countdown.textContent = seconds ? `إعادة إرسال الرمز خلال 00:${String(seconds).padStart(2, "0")}` : "يمكنك إعادة إرسال رمز جديد الآن";
  if (button) button.disabled = seconds > 0;
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

function notificationTone(item = {}) {
  const type = String(item.type || "").toLowerCase();
  const priority = String(item.priority || "").toLowerCase();
  if (priority === "critical" || type.includes("security") || type.includes("failed") || type.includes("expired")) return "danger";
  if (priority === "high" || type.includes("warning") || type.includes("action_required") || type.includes("due")) return "warning";
  if (type.includes("sent") || type.includes("delivered") || type.includes("success")) return "success";
  return "info";
}

function notificationDropdownMarkup() {
  const items = notificationItems().slice(0, 4);
  const unread = Number(state.notifications?.summary?.unread || 0);
  return `<div class="notification-dropdown">
    <div class="notification-dropdown-head"><strong>الإشعارات</strong><span class="badge">${unread}</span></div>
    <div class="notification-dropdown-list">${items.length ? items.map((item) => {
      const tone = notificationTone(item);
      const icon = tone === "danger" ? "close" : tone === "warning" ? "warning" : tone === "success" ? "security" : "template";
      return `<article class="notification-item notification-item-${tone} ${item.isRead ? "" : "unread"}">
        <button class="notification-item-open" data-action="notification-open" data-id="${escapeHtml(item.id)}" data-url="${escapeHtml(item.actionUrl || "")}">
          <span class="notification-item-icon">${dashboardIcon(icon)}</span>
          <span class="notification-item-copy"><strong>${escapeHtml(item.title || notificationLabel(item.type))}</strong><small>${escapeHtml(item.message || "")}</small><em>${notificationRelativeTime(item.createdAt)}</em></span>
        </button>
        <button class="notification-item-dismiss" data-action="notification-delete" data-id="${escapeHtml(item.id)}" title="حذف الإشعار" aria-label="حذف الإشعار">${dashboardIcon("close")}</button>
      </article>`;
    }).join("") : `<div class="notification-empty"><strong>لا توجد إشعارات جديدة</strong><span>ستظهر هنا تنبيهات الاشتراكات وحالة الرسائل.</span></div>`}</div>
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
  const englishLabels = { "الرئيسية": "Dashboard", "الاشتراكات": "Subscriptions", "العملاء": "Customers", "قوالب عامة": "General Templates", "الحملات": "Campaigns", "جهات الاتصال": "Contacts", "الأجهزة": "Devices", "إرسال معلومات الطلب": "Order Information", "تطبيقاتنا": "Our Apps", "الحماية والأمان": "Security & Safety", "التقارير": "Reports", "الفوترة والباقات": "Billing & Plans", "الإعدادات": "Settings" };
  const routeGroups = [
    { label: "", paths: ["/dashboard", "/dashboard/subscriptions", "/dashboard/customers"] },
    { label: state.language === "ar" ? "الرسائل والطلبات" : "Messages & orders", paths: ["/dashboard/order-links", "/dashboard/templates", "/dashboard/campaigns", "/dashboard/contacts"] },
    { label: state.language === "ar" ? "القنوات والربط" : "Channels & integrations", paths: ["/dashboard/devices", "/dashboard/apps"] },
    { label: state.language === "ar" ? "الرقابة والإدارة" : "Control & management", paths: ["/dashboard/security", "/dashboard/reports", "/dashboard/billing", "/dashboard/settings"] }
  ];
  const links = routeGroups.map((group) => {
    const items = dashboardRoutes.filter(([path]) => group.paths.includes(path)).map(([path, label, mark]) => `<button class="side-link ${state.route === path || (path === "/dashboard/apps" && state.route.startsWith("/dashboard/apps/")) ? "active" : ""}" data-link="${path}">${dashboardIcon(mark)}<span>${state.language === "ar" ? label : englishLabels[label]}</span></button>`).join("");
    return `<div class="side-group">${group.label ? `<span class="side-group-title">${group.label}</span>` : ""}${items}</div>`;
  }).join("");
  const themeIcon = state.theme === "dark" ? "☾" : "☀";
  const profile = state.dashboardOverview?.profile?.name
    ? state.dashboardOverview.profile
    : state.cachedDashboardProfile || {};
  const profileName = String(profile.name || "").trim();
  const profileInitial = Array.from(profileName)[0] || "";
  const profileAvatar = profile.image
    ? `<img class="avatar avatar-image" src="${escapeHtml(profile.image)}" alt="${escapeHtml(profileName)}">`
    : profileInitial
      ? `<span class="avatar">${escapeHtml(profileInitial)}</span>`
      : `<span class="avatar profile-avatar-skeleton" aria-hidden="true"></span>`;
  const profileLabel = profileName
    ? `<strong>${escapeHtml(profileName)}</strong>`
    : `<span class="profile-name-skeleton" aria-label="${state.language === "ar" ? "جاري تحميل اسم الحساب" : "Loading account name"}"></span>`;
  const unreadNotifications = Number(state.notifications?.summary?.unread || 0);
  return `<div class="dashboard-shell">
    <aside class="sidebar ${state.sidebarOpen ? "open" : ""}">
      <div class="sidebar-brand">${logo()}</div>
      <nav class="side-links">${links}</nav>
      <button class="sidebar-support-link ${state.route === "/dashboard/support" ? "active" : ""}" data-link="/dashboard/support">${dashboardIcon("support")}<span>${state.language === "ar" ? "الدعم والمساعدة" : "Help & support"}</span></button>
    </aside>
    ${state.sidebarOpen ? `<button class="sidebar-backdrop" data-action="close-sidebar" aria-label="إغلاق القائمة"></button>` : ""}
    <main class="dashboard-main">
      <header class="topbar">
        <div class="topbar-tools">
          <button class="btn btn-secondary icon-btn mobile-side-toggle" data-action="toggle-sidebar">☰</button>
          <div class="search-wrap dashboard-search"><span class="search-icon">⌕</span><input class="input" type="search" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="dashboard-quick-search-results" aria-expanded="${state.globalSearch ? "true" : "false"}" data-action="global-search" placeholder="${state.language === "ar" ? "بحث سريع..." : "Quick search..."}" value="${escapeHtml(state.globalSearch)}"><div id="dashboard-quick-search-results" class="dashboard-quick-search-results" role="listbox" data-global-search-results ${state.globalSearch ? "" : "hidden"}>${dashboardQuickSearchResultsMarkup(state.globalSearch)}</div></div>
        </div>
        <div class="topbar-tools topbar-account-tools">
          <button class="profile-trigger compact-profile-trigger" data-action="profile-menu">${profileAvatar}<span>${profileLabel}</span><span class="profile-caret">⌄</span></button>
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
  if (usage === null) return `<article class="card message-usage-card loading"><div class="loading-state">جاري تحميل استهلاك رسائل البريد...</div></article>`;
  if (usage?.error) return `<article class="card message-usage-card error">${emptyState("تعذر تحميل استهلاك رسائل البريد", escapeHtml(usage.error))}</article>`;
  const emailUsage = usage?.channels?.email || usage;
  const unlimited = emailUsage.unlimited === true || Number(emailUsage.limit) === -1;
  const used = Number(emailUsage.used || 0);
  const reserved = Number(emailUsage.reserved || 0);
  const consumed = used + reserved;
  const limit = Number(emailUsage.limit || 0);
  const remaining = unlimited ? -1 : Math.max(0, Number(emailUsage.remaining || 0));
  const percentage = unlimited ? 0 : Math.min(100, Math.max(0, Number(emailUsage.percentage || 0)));
  const tone = messageUsageTone(emailUsage);
  const statusText = tone === "reached" ? "تم استهلاك حد البريد" : tone === "critical" ? "أوشك رصيد البريد على النفاد" : tone === "near" ? "اقتربت من حد البريد" : "استخدام طبيعي";
  return `<article class="card message-usage-card ${tone} ${compact ? "compact" : ""}">
    <div class="message-usage-head"><span class="message-usage-icon">${dashboardIcon("email")}</span><div><h2>استهلاك رسائل البريد</h2><p>${escapeHtml(usage.planName || "الباقة الحالية")} · هذه الدورة</p></div><span class="status ${tone === "reached" ? "danger" : tone === "normal" ? "info" : "warning"}">${statusText}</span></div>
    <div class="message-usage-numbers"><strong>${consumed.toLocaleString("ar-SA")} / ${unlimited ? "غير محدود" : limit.toLocaleString("ar-SA")}</strong><span>${unlimited ? "بريد غير محدود" : `متبقي ${remaining.toLocaleString("ar-SA")} رسالة بريد`}</span></div>
    <div class="message-usage-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}"><i style="width:${unlimited ? 100 : percentage}%"></i></div>
    <div class="message-usage-meta"><span>مرسلة: ${used.toLocaleString("ar-SA")}</span><span>محجوزة: ${reserved.toLocaleString("ar-SA")}</span>${unlimited ? "" : `<span>${percentage.toLocaleString("ar-SA")}%</span>`}${!compact && usage.periodEnd ? `<span>إعادة التعيين: ${new Date(usage.periodEnd).toLocaleDateString("ar-SA")}</span>` : ""}</div>
    ${tone === "reached" ? `<div class="message-limit-alert"><div><strong>استهلكت جميع رسائل البريد في باقتك لهذه الدورة.</strong><p>قم بترقية الباقة للاستمرار في إرسال البريد.</p></div><button class="btn btn-danger" data-link="/dashboard/billing">عرض الباقات</button></div>` : ""}
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
  const overviewReady = state.dashboardOverview !== null && !state.dashboardOverview?.error;
  const hasBusinessData = stats.totalSubscriptions > 0 || stats.totalCustomers > 0 || stats.connectedDevices > 0;
  const showWelcome = overviewReady && !hasBusinessData;
  const alertDisabled = stats.connectedDevices > 0 ? "" : "disabled";
  return dashboardShell(`${pageTitle("الرئيسية", `<button class="btn btn-primary" data-action="add-subscription">إضافة اشتراك</button>`)}
    ${showWelcome ? `<section class="welcome-panel"><div><span class="welcome-kicker">Renvix</span><h2>مرحبًا بك في Renvix</h2><p>ابدأ بإضافة أول عميل أو ربط جهازك. لن تظهر هنا أي بيانات ما لم تضفها أنت.</p></div><div class="welcome-actions"><button class="btn btn-primary" data-action="add-customer">إضافة أول عميل</button><button class="btn btn-secondary" data-link="/dashboard/devices">ربط جهاز</button></div></section>` : ""}
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
      <button class="quick-action" data-link="/dashboard/security">${dashboardIcon("security")}<span>الحماية والأمان</span></button>
    </div></section>
    <div class="section dashboard-two-column">
      <article class="card table-card"><div class="section-head"><div><h2>أحدث الاشتراكات</h2><p class="muted">بيانات حقيقية تخص مساحة عملك فقط.</p></div><button class="text-button" data-link="/dashboard/subscriptions">عرض الكل</button></div>${latestContent}</article>
      <article class="card chart-card"><div class="section-head"><div><h2>أداء الإيرادات</h2><p class="muted">آخر 6 أشهر</p></div></div>${performanceChart(state.dashboardOverview?.monthlyPerformance || [])}</article>
    </div>
    <article class="card table-card section"><div class="section-head"><div><h2>أحدث النشاطات</h2><p class="muted">العمليات الفعلية داخل الحساب.</p></div><button class="text-button" data-link="/dashboard/reports">سجل النشاط</button></div>${activities.length ? activityList(activities) : emptyState("لا توجد نشاطات بعد", "ستظهر العمليات التي تنفذها داخل المنصة هنا.")}</article>`);
}

function pageTitle(title, actions = "") {
  const pageActions = title === "قوالب عامة" ? "" : actions;
  const descriptions = {
    "الرئيسية": "ملخص أعمالك الحقيقي من قاعدة البيانات.",
    "إدارة الاشتراكات": "تابع الاشتراكات والتجديدات في مكان واحد.",
    "العملاء": "أدر عملاءك وتنبيهاتهم دون بيانات تجريبية.",
    "الأجهزة": "اربط واتساب وتحقق من حالة الاتصال الفعلية.",
    "القوالب": "إدارة قوالب الرسائل والروابط الجاهزة حسب القناة.",
    "إرسال معلومات الطلب": "صمم قالبًا واحدًا برابط ثابت وأضف إليه طلبات عملائك.",
    "تطبيقاتنا": "اربط متجرك بالتطبيقات الخارجية وشغّل المزامنة والأتمتة بأمان.",
    "الحماية": "قواعد الإرسال الآمن وقائمة إيقاف الرسائل.",
    "الحماية والأمان": "نراقب ونؤمّن منصتك وعمليات الإرسال لحماية بياناتك وضمان استمرارية أعمالك.",
    "التقارير": "المؤشرات وسجل النشاط والفوترة.",
    "الإعدادات": "إدارة الحساب واللغة والمظهر والأمان."
  };
  return `<div class="page-title"><div><h1>${title}</h1><p class="muted">${descriptions[title] || "Renvix"}</p></div><div class="toolbar">${pageActions}</div></div>`;
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

function renewalDurationLabel(value, unit) {
  const labels = { day: value === 1 ? "يوم" : "أيام", month: value === 1 ? "شهر" : "أشهر", year: value === 1 ? "سنة" : "سنوات" };
  return `${Number(value)} ${labels[unit] || unit}`;
}

function sallaProductsPage() {
  const payload = state.sallaProductMappings;
  if (payload === null) return dashboardShell(`${pageTitle("ربط منتجات سلة")}<div class="loading-state">جاري تحميل كتالوج سلة والربط الحالي...</div>`);
  if (payload?.error) return dashboardShell(`${pageTitle("ربط منتجات سلة")} ${emptyState("تعذر تحميل المنتجات", escapeHtml(payload.error), "إعادة المحاولة", "reload-salla-products")}`);
  const mappings = Array.isArray(payload?.mappings) ? payload.mappings : [];
  const rows = mappings.map((item) => `<tr>
    <td><div class="renewal-product-cell">${item.thumbnailUrl ? `<img src="${escapeHtml(item.thumbnailUrl)}" alt="">` : `<span>${dashboardIcon("apps")}</span>`}<div><strong>${escapeHtml(item.productName || item.productId)}</strong><small>${item.variantId ? `Variant: ${escapeHtml(item.variantId)}` : `Product: ${escapeHtml(item.productId)}`}${item.sku ? ` · SKU: ${escapeHtml(item.sku)}` : ""}</small></div></div></td>
    <td><strong>${escapeHtml(item.planName)}</strong><small>${renewalDurationLabel(item.durationValue, item.durationUnit)}</small></td>
    <td><span class="status ${item.renewalLinkMode === "automatic" ? "success" : "neutral"}">${item.renewalLinkMode === "automatic" ? "تلقائي من سلة" : "يدوي"}</span></td>
    <td><strong>${Number(item.renewalOptionsCount || 0)}</strong><small>خيار تجديد</small></td>
    <td><span class="status ${item.isActive ? "success" : "danger"}">${item.isActive ? "نشط" : "متوقف"}</span></td>
    <td><button class="btn btn-secondary" data-link="/dashboard/integrations/salla/products/${escapeHtml(item.id)}">إدارة خيارات التجديد</button></td>
  </tr>`).join("");
  return dashboardShell(`${pageTitle("ربط منتجات سلة", `<button class="btn btn-secondary" data-action="sync-salla-renewal-links">مزامنة روابط التجديد</button><button class="btn btn-primary" data-action="open-salla-product-mappings-legacy">+ ربط منتج بباقة</button>`)}
    ${Number(payload.unmapped?.length || 0) ? `<p class="inline-notice warning">يوجد ${Number(payload.unmapped.length)} عنصر طلب يحتاج إلى ربط باقة. لن يخمّن Renvix الباقة أو المدة.</p>` : ""}
    <section class="card table-card renewal-products-card"><div class="section-head"><div><h2>المنتجات المرتبطة</h2><p class="muted">الكتالوج محفوظ محليًا ويُحدّث عبر مزامنة سلة.</p></div><span class="status neutral">${mappings.length} منتج</span></div>
      ${rows ? `<div class="table-scroll"><table class="data-table renewal-products-table"><thead><tr><th>منتج سلة</th><th>الباقة</th><th>الوضع الافتراضي</th><th>الخيارات</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyState("لا توجد منتجات مرتبطة بعد", "زامن كتالوج سلة ثم اربط المنتجات الاشتراكية بالباقات دون الاعتماد على الاسم.", "ربط أول منتج", "open-salla-product-mappings-legacy")}
    </section>`);
}

function sallaProductRenewalPage() {
  const mappingId = state.route.match(/^\/dashboard\/integrations\/salla\/products\/([^/]+)$/)?.[1];
  const payload = state.sallaProductMappings;
  const mapping = payload?.mappings?.find((item) => item.id === mappingId);
  const options = Array.isArray(state.sallaRenewalOptions) ? state.sallaRenewalOptions : [];
  if (!payload || state.sallaRenewalOptions === null) return dashboardShell(`${pageTitle("خيارات التجديد")}<div class="loading-state">جاري تحميل المنتج وخيارات التجديد...</div>`);
  if (!mapping) return dashboardShell(`${pageTitle("خيارات التجديد")} ${emptyState("تعذر العثور على ربط المنتج", "قد يكون الربط متوقفًا أو تابعًا لمتجر آخر.", "العودة للمنتجات", "back-salla-products")}`);
  const optionCards = options.map((item) => `<article class="card renewal-option-card ${item.isActive ? "" : "is-disabled"}">
    <div class="section-head"><div><span class="status ${item.linkMode === "automatic" ? "success" : "neutral"}">${item.linkMode === "automatic" ? "تلقائي من سلة" : "رابط يدوي"}</span><h3>${escapeHtml(item.label)}</h3></div><span class="status ${item.syncStatus === "synced" ? "success" : "warning"}">${item.syncStatus === "synced" ? "متزامن" : "يحتاج مراجعة"}</span></div>
    <p>${escapeHtml(item.customerNote || "لا توجد ملاحظة للعميل")}</p>
    <div class="renewal-option-meta"><span>${renewalDurationLabel(item.durationValue, item.durationUnit)}</span><span>${item.showInPortal ? "يظهر في صفحة الطلب" : "مخفي من صفحة الطلب"}</span><span>${item.showInWhatsapp ? "واتساب" : "ليس في واتساب"}</span><span>${item.showInEmail ? "البريد" : "ليس في البريد"}</span></div>
    ${item.linkMode === "automatic" ? `<small>Product ${escapeHtml(item.targetSallaProductId || "-")}${item.targetSallaVariantId ? ` · Variant ${escapeHtml(item.targetSallaVariantId)}` : ""}</small>` : `<small dir="ltr">${escapeHtml(item.manualUrl || "")}</small>`}
    <div class="inline-actions"><button class="btn btn-secondary" data-action="edit-renewal-option" data-id="${escapeHtml(item.id)}">تعديل</button>${item.isActive ? `<button class="btn btn-ghost danger-text" data-action="disable-renewal-option" data-id="${escapeHtml(item.id)}">إيقاف</button>` : ""}</div>
  </article>`).join("");
  return dashboardShell(`${pageTitle("خيارات تجديد المنتج", `<button class="btn btn-secondary" data-action="back-salla-products">العودة للمنتجات</button><button class="btn btn-primary" data-action="add-renewal-option">+ إضافة رابط تجديد</button>`)}
    <section class="card renewal-source-product"><div class="renewal-product-cell">${mapping.thumbnailUrl ? `<img src="${escapeHtml(mapping.thumbnailUrl)}" alt="">` : `<span>${dashboardIcon("apps")}</span>`}<div><small>المنتج الأصلي في الطلب</small><h2>${escapeHtml(mapping.productName || mapping.productId)}</h2><p>Product ${escapeHtml(mapping.productId)}${mapping.variantId ? ` · Variant ${escapeHtml(mapping.variantId)}` : ""}${mapping.sku ? ` · SKU ${escapeHtml(mapping.sku)}` : ""}</p></div></div><div><small>الباقة المرتبطة</small><strong>${escapeHtml(mapping.planName)}</strong><p>${renewalDurationLabel(mapping.durationValue, mapping.durationUnit)}</p></div></section>
    <section class="section"><div class="section-head"><div><h2>روابط التجديد المتاحة للعميل</h2><p class="muted">كل خيار مرتبط بهذا المنتج فقط، ولا تتم المطابقة باسم المنتج.</p></div><button class="btn btn-secondary" data-action="sync-salla-renewal-links">تحديث من سلة</button></div>
      <div class="renewal-options-grid">${optionCards || emptyState("لا توجد خيارات تجديد", "أضف خيارًا تلقائيًا من كتالوج سلة أو رابط HTTPS يدويًا.", "إضافة رابط تجديد", "add-renewal-option")}</div>
    </section>`);
}

function renewalOptionForm(mappingId, item = null) {
  const products = Array.isArray(state.sallaProductMappings?.products) ? state.sallaProductMappings.products : [];
  const mode = item?.linkMode || state.renewalOptionMode || "automatic";
  const selectedKey = `${item?.targetSallaProductId || ""}|${item?.targetSallaVariantId || ""}|${item?.targetSallaSku || ""}`;
  const productOptions = products.map((product) => {
    const key = `${product.productId}|${product.variantId || ""}|${product.sku || ""}`;
    return `<option value="${escapeHtml(key)}" ${key === selectedKey ? "selected" : ""}>${escapeHtml(product.name || product.productId)}${product.sku ? ` · ${escapeHtml(product.sku)}` : ""}</option>`;
  }).join("");
  return `<form data-submit="renewal-option" data-mapping-id="${escapeHtml(mappingId)}" data-option-id="${escapeHtml(item?.id || "")}" class="grid renewal-option-form">
    <label class="field"><span>طريقة تحديد الرابط</span><select class="select" name="linkMode" data-action="renewal-option-mode"><option value="automatic" ${mode === "automatic" ? "selected" : ""}>تلقائي من كتالوج سلة</option><option value="manual" ${mode === "manual" ? "selected" : ""}>رابط يدوي آمن</option></select></label>
    <label class="field"><span>اسم الخيار للعميل</span><input class="input" name="label" maxlength="80" required value="${escapeHtml(item?.label || "")}" placeholder="مثال: تجديد سنة"></label>
    <div data-renewal-auto ${mode === "automatic" ? "" : "hidden"}><label class="field"><span>منتج التجديد من سلة</span><select class="select" name="catalogProduct"><option value="">اختر منتجًا أو متغيرًا مؤكدًا</option>${productOptions}</select><small>الأولوية: Variant ثم Product ثم SKU. لن يستخدم الاسم للمطابقة.</small></label></div>
    <div data-renewal-manual ${mode === "manual" ? "" : "hidden"}><label class="field"><span>رابط التجديد اليدوي</span><input class="input" dir="ltr" type="url" name="manualUrl" value="${escapeHtml(item?.manualUrl || "")}" placeholder="https://store.salla.sa/product"></label><small>يسمح بروابط HTTPS العامة فقط؛ الروابط المحلية والخاصة محظورة.</small></div>
    <div class="form-grid two"><label class="field"><span>المدة</span><input class="input" type="number" min="1" max="1000" name="durationValue" value="${Number(item?.durationValue || 1)}" required></label><label class="field"><span>الوحدة</span><select class="select" name="durationUnit"><option value="day" ${item?.durationUnit === "day" ? "selected" : ""}>يوم</option><option value="month" ${(!item || item.durationUnit === "month") ? "selected" : ""}>شهر</option><option value="year" ${item?.durationUnit === "year" ? "selected" : ""}>سنة</option></select></label></div>
    <label class="field"><span>ملاحظة تظهر للعميل (اختياري)</span><textarea class="input" name="customerNote" maxlength="240" placeholder="وصف مختصر لهذا الخيار">${escapeHtml(item?.customerNote || "")}</textarea></label>
    <div class="renewal-visibility"><label><input type="checkbox" name="showInPortal" ${item?.showInPortal !== false ? "checked" : ""}> صفحة معلومات الطلب</label><label><input type="checkbox" name="showInWhatsapp" ${item?.showInWhatsapp ? "checked" : ""}> واتساب</label><label><input type="checkbox" name="showInEmail" ${item?.showInEmail ? "checked" : ""}> البريد الإلكتروني</label><label><input type="checkbox" name="isActive" ${item?.isActive !== false ? "checked" : ""}> نشط</label></div>
    <button class="btn btn-primary" type="submit">${item ? "حفظ التعديلات" : "إضافة خيار التجديد"}</button>
  </form>`;
}

function sallaTemplateIcon(item) {
  const iconMap = {
    cart: "subscriptions", clock: "template", settings: "settings", check: "security",
    plane: "orderLink", truck: "devices", package: "apps", return: "subscriptions",
    refund: "billing", invoice: "template", download: "orderLink", star: "reports",
    cancel: "close"
  };
  return dashboardIcon(iconMap[item.icon] || "template");
}

function messageActivationCard({
  title,
  description,
  enabled = true,
  icon = "send",
  action = "",
  key = "",
  inputName = ""
}) {
  const checked = Boolean(enabled);
  const control = action
    ? `<button type="button" class="message-activation-switch ${checked ? "active" : ""}" data-action="${escapeHtml(action)}" data-key="${escapeHtml(key)}" data-enabled="${checked ? "true" : "false"}" role="switch" aria-checked="${checked ? "true" : "false"}" aria-label="${checked ? "إيقاف" : "تفعيل"} ${escapeHtml(title)}"><span></span></button>`
    : `<label class="message-activation-switch"><input type="checkbox" name="${escapeHtml(inputName)}" aria-label="${escapeHtml(title)}" ${checked ? "checked" : ""}><span></span></label>`;
  return `<div class="message-activation-card card">
    <div class="message-activation-copy"><span class="message-activation-icon">${dashboardIcon(icon)}</span><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span></div>
    <div class="message-activation-control">${control}<span class="message-activation-status"><i></i><b class="message-activation-status-on">مفعل</b><b class="message-activation-status-off">متوقف</b></span></div>
  </div>`;
}

function sallaTemplateActivationTitle(item) {
  const labels = {
    digital_product_delivery: "تفعيل رسالة إرسال المنتجات الرقمية",
    processing: "تفعيل رسالة قيد التنفيذ",
    under_review: "تفعيل رسالة تحت المراجعة",
    delivered: "تفعيل رسالة تم التوصيل",
    out_for_delivery: "تفعيل رسالة جاري التوصيل",
    completed: "تفعيل رسالة تم التنفيذ",
    review_request: "تفعيل رسالة طلب التقييم",
    abandoned_cart: "تفعيل رسالة السلة المتروكة",
    cancelled: "تفعيل رسالة إلغاء الطلب",
    return_in_progress: "تفعيل رسالة قيد الاسترجاع",
    returned: "تفعيل رسالة استلام المرتجع",
    shipped: "تفعيل رسالة تم الشحن",
    salla_invoice_ready: "تفعيل رسالة رابط الفاتورة"
  };
  return labels[item.templateKey] || `تفعيل رسالة ${item.name}`;
}

function sallaAutomationTemplatesPage() {
  const payload = state.sallaAutomationTemplates;
  if (!payload) return dashboardShell(`${pageTitle("قوالب سلة")}<div class="loading-state">جاري تحميل القوالب المرتبطة بمتجر سلة...</div>`);
  if (payload.error) return dashboardShell(`${pageTitle("قوالب سلة")} ${emptyState("تعذر تحميل قوالب سلة", payload.error, "إعادة المحاولة", "reload-salla-templates")}`);
  if (!payload.available) {
    return dashboardShell(`${pageTitle("قوالب سلة")}
      <section class="card salla-templates-locked">
        <span class="salla-template-lock-logo"><img src="/assets/salla-logo.svg" alt="سلة"></span>
        <h2>قوالب سلة غير متاحة</h2>
        <p>اربط متجرك بتطبيق سلة للوصول إلى قوالب حالات الطلب والسلات المتروكة والفواتير.</p>
        <button class="btn btn-primary" data-link="/dashboard/apps">ربط متجر سلة</button>
      </section>`);
  }
  const items = Array.isArray(payload.items) ? payload.items : [];
  const cards = items.map((item) => `<article class="card salla-template-card ${item.templateKey === "completed" ? "featured" : ""}">
    <div class="salla-template-card-head">
      <span class="salla-template-card-icon">${sallaTemplateIcon(item)}</span>
      <div><span class="salla-chip">سلة</span><h2>${escapeHtml(item.name)}</h2></div>
    </div>
    <p>${escapeHtml(item.description)}</p>
    ${item.templateKey === "completed" ? `<div class="salla-mode-chips"><span>واتساب</span><span>رابط صفحة آمنة</span></div>` : ""}
    <span class="status ${item.isEnabled ? "success" : "neutral"}">${item.isEnabled ? "نشط" : "غير مفعل"} <i></i></span>
    <footer><small>آخر تحديث: ${item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("ar-SA") : "—"}</small><div><button class="btn btn-secondary" data-link="/dashboard/apps/salla/templates/${escapeHtml(item.templateKey)}">${dashboardIcon("eye")} معاينة</button><button class="btn btn-secondary" data-link="/dashboard/apps/salla/templates/${escapeHtml(item.templateKey)}">${dashboardIcon("template")} تحرير</button></div></footer>
  </article>`).join("");
  return dashboardShell(`<div class="salla-templates-page-head">${pageTitle("قوالب سلة", `<button class="btn btn-primary" data-link="/dashboard/apps/salla/templates/${escapeHtml(items[0]?.templateKey || "processing")}">${dashboardIcon("template")} تخصيص قالب</button><button class="btn btn-secondary" data-link="/dashboard/apps/salla/templates/salla_invoice_ready">${dashboardIcon("billing")} رابط الفاتورة</button><button class="btn btn-secondary" data-action="sync-salla-statuses">${dashboardIcon("refresh")} مزامنة الحالات</button>`)}<span class="salla-chip">سلة</span></div>
    <p class="page-kicker">إدارة قوالب رسائل الطلبات المرتبطة بمتجر سلة. فعّل القالب وخصص محتواه والقناة بسهولة.</p>
    <section class="inline-notice info salla-templates-notice">${dashboardIcon("info")}<span>هذه قوالب خاصة بمتجرك فقط. يتم إرسال الرسائل عبر القناة المختارة لكل قالب بعد وصول حدث موثق من سلة.</span></section>
    <section class="salla-templates-grid">${cards}</section>`);
}

function sallaTemplatePreviewPanel(item, storeProfile = {}) {
  const isEmail = item.channel === "email";
  const settings = item.settings || {};
  const buttonEnabled = settings.buttonEnabled !== false;
  const activeContent = isEmail ? (item.emailTextContent || item.messageBody) : (item.whatsappContent || item.messageBody);
  const body = escapeHtml(activeContent || "").replace(/\n/g, "<br>");
  const logoUrl = storeProfile.logoUrl || "";
  const logoRadius = Math.max(0, Math.min(50, Number(storeProfile.logoBorderRadius ?? 16)));
  const emailLogo = logoUrl
    ? `<span class="salla-email-store-logo"><img src="${escapeHtml(logoUrl)}" alt="شعار ${escapeHtml(storeProfile.storeName || "المتجر")}" style="--salla-logo-radius:${logoRadius}px"></span>`
    : `<span class="salla-email-store-logo is-empty">${dashboardIcon("apps")}</span>`;
  return `<aside class="card salla-template-live-preview">
    <div class="section-head"><div><h2 data-salla-preview-title>${isEmail ? "معاينة البريد" : "معاينة واتساب"}</h2><p>معاينة موحدة وآمنة — لن يتم إرسال أي رسالة.</p></div>${dashboardIcon(isEmail ? "template" : "eye")}</div>
    <div class="${isEmail ? "salla-email-preview" : "salla-whatsapp-preview"}" data-salla-preview-frame>
      <div class="salla-whatsapp-preview-canvas" data-salla-preview-head="whatsapp" ${isEmail ? "hidden" : ""}>
        <div class="salla-whatsapp-bubble"><div class="salla-preview-message" data-salla-preview-message>${body}</div><button type="button" tabindex="-1" class="salla-preview-cta" data-salla-preview-cta ${buttonEnabled ? "" : "hidden"}>${dashboardIcon("orderLink")} <span>${escapeHtml(settings.buttonLabel || item.previewAction || "عرض التفاصيل")}</span></button><small>11:30 ص ✓✓</small></div>
      </div>
      <div class="salla-email-preview-canvas" data-salla-preview-head="email" ${isEmail ? "" : "hidden"}>
        <div class="salla-email-preview-head">${emailLogo}<div><small>${escapeHtml(storeProfile.storeName || "متجري")}</small><strong data-salla-email-subject>${escapeHtml(item.emailSubject || "عنوان الرسالة")}</strong></div></div>
        <div class="salla-email-hero">${dashboardIcon("template")}<strong>${escapeHtml(item.name || "تحديث طلبك")}</strong></div>
        <div class="salla-preview-message" data-salla-preview-message>${body}</div>
        <button type="button" tabindex="-1" class="salla-preview-cta primary" data-salla-preview-cta ${buttonEnabled ? "" : "hidden"}><span>${escapeHtml(settings.buttonLabel || item.previewAction || "عرض التفاصيل")}</span></button>
        <footer>هذه رسالة آلية آمنة من ${escapeHtml(storeProfile.storeName || "متجرك")}</footer>
      </div>
    </div>
    ${item.templateKey === "digital_product_delivery" ? `<section class="salla-digital-link-preview" data-salla-link-preview ${settings.secureLinkEnabled === false ? "hidden" : ""} style="--salla-link-theme:${escapeHtml(settings.themeColor || settings.branding?.themeColor || "#2563EB")}"><div class="salla-digital-link-head">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="شعار المتجر">` : dashboardIcon("security")}<div><small>الرابط الخاص بالطلب #10025</small><strong data-salla-link-title>${escapeHtml(settings.linkPageTitle || "منتجاتك الرقمية جاهزة")}</strong></div></div><p data-salla-link-content>${escapeHtml(settings.linkPageContent || "استخدم البيانات التالية للوصول إلى منتجك الرقمي بأمان.")}</p><article><strong>المنتج الرقمي</strong><dl><div><dt>كود التفعيل</dt><dd>RVX-2026-DEMO</dd></div><div><dt>البريد</dt><dd>customer@example.com</dd></div><div><dt>كلمة المرور</dt><dd>••••••••••</dd></div></dl><a>فتح المنتج بأمان</a></article><div class="salla-digital-countdown" data-salla-link-countdown ${settings.showCountdown === false ? "hidden" : ""}>متاح لمدة <strong>23:59:59</strong></div><small>تُرتب بيانات الكود أو البريد وكلمة المرور تلقائيًا حسب بيانات كل طلب.</small></section>` : ""}
    ${item.lastFailureAt ? `<div class="inline-notice danger"><strong>آخر خطأ</strong><span>${escapeHtml(item.lastFailureCode || "provider_failed")}</span></div>` : ""}
  </aside>`;
}

function refreshSallaTemplatePreview(form, { logoUrl = "" } = {}) {
  if (!form) return;
  const channel = form.elements.channel?.value || "";
  const isEmail = channel === "email";
  const frame = document.querySelector("[data-salla-preview-frame]");
  if (frame) {
    frame.classList.toggle("salla-email-preview", isEmail);
    frame.classList.toggle("salla-whatsapp-preview", !isEmail);
  }
  document.querySelectorAll("[data-salla-preview-head]").forEach((head) => {
    head.toggleAttribute("hidden", head.dataset.sallaPreviewHead !== (isEmail ? "email" : "whatsapp"));
  });
  const subject = document.querySelector("[data-salla-email-subject]");
  if (subject) subject.textContent = form.elements.emailSubject?.value || "عنوان الرسالة";
  const content = isEmail ? form.elements.emailTextContent?.value : form.elements.whatsappContent?.value;
  document.querySelectorAll("[data-salla-preview-message]").forEach((body) => {
    body.innerHTML = escapeHtml(content || "اكتب محتوى الرسالة ليظهر هنا.").replace(/\n/g, "<br>");
  });
  const title = document.querySelector("[data-salla-preview-title]");
  if (title) title.textContent = isEmail ? "معاينة البريد" : "معاينة واتساب";
  const buttonEnabled = form.elements.buttonEnabled?.checked !== false;
  document.querySelectorAll("[data-salla-preview-cta]").forEach((button) => {
    button.toggleAttribute("hidden", !buttonEnabled);
    const label = button.querySelector("span");
    if (label) label.textContent = form.elements.buttonLabel?.value || "عرض التفاصيل";
  });
  const linkPreview = document.querySelector("[data-salla-link-preview]");
  if (linkPreview) {
    linkPreview.toggleAttribute("hidden", form.elements.secureLinkEnabled?.checked === false);
    linkPreview.style.setProperty("--salla-link-theme", form.elements.themeColor?.value || "#2563EB");
    const linkTitle = linkPreview.querySelector("[data-salla-link-title]");
    const linkContent = linkPreview.querySelector("[data-salla-link-content]");
    const countdown = linkPreview.querySelector("[data-salla-link-countdown]");
    if (linkTitle) linkTitle.textContent = form.elements.linkPageTitle?.value || "منتجاتك الرقمية جاهزة";
    if (linkContent) linkContent.textContent = form.elements.linkPageContent?.value || "استخدم البيانات التالية للوصول إلى منتجك الرقمي بأمان.";
    if (countdown) countdown.toggleAttribute("hidden", form.elements.showCountdown?.checked === false);
  }
  if (logoUrl) {
    const logoShell = document.querySelector(".salla-email-store-logo");
    const logoEditor = form.querySelector(".salla-email-logo-preview");
    [logoShell, logoEditor].filter(Boolean).forEach((shell) => {
      const image = document.createElement("img");
      image.src = logoUrl;
      image.alt = "شعار المتجر";
      shell.replaceChildren(image);
      shell.classList.remove("is-empty");
    });
  }
}

function sallaAutomationTemplateEditorPage() {
  const payload = state.sallaAutomationTemplate;
  if (!payload) return dashboardShell(`${pageTitle("إعداد قالب سلة")}<div class="loading-state">جاري تحميل القالب...</div>`);
  if (payload.error) return dashboardShell(`${pageTitle("إعداد قالب سلة")} ${emptyState("تعذر تحميل القالب", payload.error, "العودة للقوالب", "back-salla-templates")}`);
  if (!payload.available || !payload.item) return sallaAutomationTemplatesPage();
  const item = payload.item;
  const storeProfile = payload.storeProfile || {};
  const statuses = Array.isArray(payload.statuses) ? payload.statuses : [];
  const metaTemplates = Array.isArray(payload.metaTemplates) ? payload.metaTemplates : [];
  const settings = item.settings || {};
  const selectedChannel = item.channel || "whatsapp";
  const statusField = item.requiresStatusMapping ? `<label class="field"><span>حالة سلة التي تشغّل القالب</span><select class="select" name="mappedStatusId" required><option value="">اختيار الحالة</option>${statuses.map((statusItem) => `<option value="${escapeHtml(statusItem.id)}" data-slug="${escapeHtml(statusItem.slug || "")}" data-name="${escapeHtml(statusItem.name)}" ${statusItem.id === item.mappedStatusId ? "selected" : ""}>${escapeHtml(statusItem.name)}${statusItem.isCustom ? " — مخصصة" : ""}</option>`).join("")}</select><small>${statuses.length ? "تتم المطابقة بمعرّف الحالة وslug، وليس بالنص العربي." : "زامن حالات سلة أولًا قبل التفعيل."}</small></label>` : `<label class="field"><span>حدث التشغيل</span><input class="input" value="${escapeHtml(item.eventName || item.triggerType)}" disabled></label>`;
  const variables = `<div class="variables-row"><strong>المتغيرات المتاحة</strong>${item.variables.map((variable) => `<button type="button" class="chip" data-action="insert-salla-variable" data-variable="{{${escapeHtml(variable)}}}">{{${escapeHtml(variable)}}}</button>`).join("")}</div>`;
  const metaPanel = `<section class="salla-channel-panel" data-channel-panel="whatsapp" ${selectedChannel === "whatsapp" ? "" : "hidden"}><label class="field"><span>قالب Meta المعتمد</span><select class="select" name="whatsappTemplateId"><option value="">اختر قالبًا معتمدًا</option>${metaTemplates.map((template) => `<option value="${escapeHtml(template.id)}" ${template.id === item.whatsappTemplateId ? "selected" : ""}>${escapeHtml(template.displayName || template.name)} — ${escapeHtml(template.language)}</option>`).join("")}</select><small>لا يُفعّل الإرسال الفعلي قبل اختيار قالب Meta معتمد.</small></label><label class="field"><span>محتوى رسالة واتساب</span><textarea class="textarea salla-template-message-editor" name="whatsappContent">${escapeHtml(item.whatsappContent || item.messageBody || "")}</textarea></label>${variables}<div class="salla-action-settings"><label class="setting-line"><span><strong>تفعيل زر الإجراء</strong><small>أظهر زرًا واضحًا داخل الرسالة، ويمكن إيقافه دون حذف النص المحفوظ.</small></span><input type="checkbox" name="buttonEnabled" ${settings.buttonEnabled !== false ? "checked" : ""}></label><label class="field"><span>نص زر الإجراء</span><input class="input" name="buttonLabel" maxlength="80" value="${escapeHtml(settings.buttonLabel || item.previewAction || "عرض التفاصيل")}" placeholder="مثال: عرض تفاصيل الطلب"></label></div></section>`;
  const emailPanel = `<section class="salla-channel-panel" data-channel-panel="email" ${selectedChannel === "email" ? "" : "hidden"}><label class="field"><span>عنوان البريد</span><input class="input" name="emailSubject" value="${escapeHtml(item.emailSubject || "")}" placeholder="تحديث طلبك رقم {{order_number}}"></label><label class="field"><span>محتوى البريد</span><textarea class="textarea salla-template-message-editor" name="emailTextContent">${escapeHtml(item.emailTextContent || item.messageBody || "")}</textarea></label>${variables}<div class="salla-email-logo-editor"><div class="salla-email-logo-preview">${storeProfile.logoUrl ? `<img src="${escapeHtml(storeProfile.logoUrl)}" alt="شعار المتجر الحالي">` : dashboardIcon("apps")}</div><div><strong>صورة متجر موحدة للبريد</strong><p>تظهر صورة متجرك داخل المعاينة الموحدة وتُستخدم بأمان في رسائل بريد قوالب سلة.</p><input type="file" accept="image/png,image/jpeg,image/webp" data-action="salla-email-logo-file" hidden><button class="btn btn-secondary" type="button" data-action="choose-salla-email-logo">${dashboardIcon("upload")} ${storeProfile.logoUrl ? "استبدال الصورة" : "إضافة صورة المتجر"}</button><small>PNG أو JPG أو WebP حقيقي، بحد أقصى 2 ميجابايت.</small></div></div></section>`;
  const abandoned = item.templateKey === "abandoned_cart" ? `<section class="salla-special-settings"><div class="section-head"><div><h2>إعدادات التذكير</h2><p>يُلغى التسلسل تلقائيًا فور وصول طلب حقيقي.</p></div>${dashboardIcon("clock")}</div><div class="form-grid three">${(settings.delaysMinutes || [30,1440,4320]).map((minutes,index) => `<label class="field"><span>التذكير ${index + 1} — بعد كم دقيقة</span><input class="input" type="number" min="5" max="43200" name="delay${index + 1}" value="${Number(minutes)}"></label>`).join("")}</div><label class="setting-line"><span><strong>إيقاف التذكير عند إتمام الشراء</strong><small>يمنع إرسال أي رسالة مؤجلة بعد التحويل إلى طلب.</small></span><input type="checkbox" name="stopOnConversion" ${settings.stopOnConversion !== false ? "checked" : ""}></label></section>` : "";
  const completed = item.templateKey === "completed" ? `<section class="salla-special-settings"><div class="section-head"><div><h2>رابط معلومات الطلب</h2><p>يتم إنشاء رابط سري مستقل للطلب، وتظهر رسالة واتساب ومعها زر فتح الصفحة.</p></div>${dashboardIcon("orderLink")}</div><input type="hidden" name="completedDeliveryMode" value="secure_order_page"><label class="setting-line"><span><strong>إظهار مدة الاشتراك</strong><small>تُحسب لحظيًا من بيانات الاشتراك الحقيقية عند فتح الرابط.</small></span><input type="checkbox" name="showSubscriptionDuration" ${settings.showSubscriptionDuration !== false ? "checked" : ""}></label></section>` : "";
  const review = item.templateKey === "review_request" ? `<section class="salla-special-settings"><div class="section-head"><div><h2>توقيت طلب التقييم</h2><p>يُلغى الطلب المؤجل تلقائيًا إذا ألغي الطلب أو بدأ استرجاعه.</p></div>${dashboardIcon("clock")}</div><label class="field"><span>الإرسال بعد التسليم — بالدقائق</span><input class="input" type="number" min="5" max="43200" name="reviewDelayMinutes" value="${Number(item.reviewDelayMinutes || settings.reviewDelayMinutes || 1440)}"></label></section>` : "";
  const invoice = item.templateKey === "salla_invoice_ready" ? `<section class="salla-special-settings"><div class="section-head"><div><h2>رابط الفاتورة الآمن</h2><p>محتوى الرسالة والمعاينة يعرضان رابطًا فقط؛ وتُقرأ بيانات الفاتورة الحقيقية من سلة داخل الصفحة الآمنة.</p></div>${dashboardIcon("billing")}</div><input type="hidden" name="invoiceTrigger" value="invoice.created"></section>` : "";
  const digital = item.templateKey === "digital_product_delivery" ? `<section class="salla-special-settings salla-digital-settings"><div class="section-head"><div><h2>صفحة تسليم المنتج الرقمي</h2><p>يُنشأ رابط سري مستقل لرقم كل طلب، وتُرتب داخله الأكواد أو البريد وكلمة المرور تلقائيًا.</p></div>${dashboardIcon("security")}</div><label class="setting-line"><span><strong>إرفاق رابط التسليم الآمن</strong><small>عند إيقافه تظهر معاينة قناة الإرسال فقط.</small></span><input type="checkbox" name="secureLinkEnabled" ${settings.secureLinkEnabled !== false ? "checked" : ""}></label><div class="form-grid two"><label class="field"><span>عنوان صفحة الرابط</span><input class="input" name="linkPageTitle" maxlength="160" value="${escapeHtml(settings.linkPageTitle || "منتجاتك الرقمية جاهزة")}"></label><label class="field"><span>لون الصفحة</span><input class="input salla-theme-color" type="color" name="themeColor" value="${escapeHtml(settings.themeColor || settings.branding?.themeColor || "#2563EB")}"></label></div><label class="field"><span>محتوى صفحة الرابط</span><textarea class="textarea" name="linkPageContent" maxlength="5000">${escapeHtml(settings.linkPageContent || "استخدم البيانات التالية للوصول إلى منتجك الرقمي بأمان.")}</textarea></label><div class="salla-digital-branding"><div><strong>شعار صفحة الرابط</strong><small>يُستخدم شعار المتجر المحفوظ نفسه داخل البريد وصفحة التسليم الآمنة.</small></div><button class="btn btn-secondary" type="button" data-action="choose-salla-email-logo">${dashboardIcon("upload")} ${storeProfile.logoUrl ? "تغيير الشعار" : "إضافة شعار المتجر"}</button></div><label class="setting-line"><span><strong>إظهار العد التنازلي</strong><small>يظهر فقط عندما ترسل سلة مدة أو تاريخ انتهاء موثقًا.</small></span><input type="checkbox" name="showCountdown" ${settings.showCountdown !== false ? "checked" : ""}></label></section>` : "";
  return dashboardShell(`<div class="salla-template-editor-top"><button class="btn btn-secondary" data-link="/dashboard/apps/salla/templates">${dashboardIcon("arrow-left")} العودة إلى القوالب</button></div>${pageTitle(item.name)}
    <p class="page-kicker">${escapeHtml(item.description)}</p>
    <section class="inline-notice info salla-template-editor-notice">${dashboardIcon("info")}<span>سيؤثر الحفظ على الرسائل المستقبلية فقط. لا يتم إرسال أي رسالة من المعاينة.</span></section>
    ${messageActivationCard({
      title: sallaTemplateActivationTitle(item),
      description: `عند تفعيلها، تُرسل هذه الرسالة بعد وصول حدث ${item.name} المطابق من سلة. عند الإيقاف لن تُرسل الرسالة.`,
      enabled: item.isEnabled,
      icon: "send",
      action: "salla-template-toggle",
      key: item.templateKey
    })}
    <section class="salla-template-editor-layout">
      <form id="salla-template-editor-form" class="grid" data-submit="salla-automation-template" data-template-key="${escapeHtml(item.templateKey)}">
        <article class="card salla-template-form-card">
          <div class="section-head"><div><h2>بيانات القالب</h2><p>كل قناة تحتفظ بمحتواها المستقل، وتظهر المعاينة المطابقة فورًا.</p></div>${dashboardIcon("template")}</div>
          <div class="form-grid two"><label class="field"><span>اسم القالب</span><input class="input" value="${escapeHtml(item.name)}" disabled></label>${statusField}</div>
          <fieldset class="salla-channel-choice"><legend>قناة الإرسال</legend><label><input type="radio" name="channel" value="email" data-salla-channel-choice ${selectedChannel === "email" ? "checked" : ""}><span>${dashboardIcon("template")} بريد إلكتروني</span></label><label><input type="radio" name="channel" value="whatsapp" data-salla-channel-choice ${selectedChannel === "whatsapp" ? "checked" : ""}><span>${dashboardIcon("send")} واتساب</span></label></fieldset>
          ${metaPanel}${emailPanel}
          ${abandoned}${completed}${review}${invoice}${digital}
        </article>
        <div class="salla-editor-actions"><button class="btn btn-primary" type="submit">${dashboardIcon("save")} حفظ التغييرات</button><button class="btn btn-secondary" type="button" data-action="preview-salla-template" data-key="${escapeHtml(item.templateKey)}">${dashboardIcon("eye")} تحديث المعاينة</button><button class="btn btn-secondary" type="button" data-action="test-salla-template" data-salla-test-button data-key="${escapeHtml(item.templateKey)}">${dashboardIcon("orderLink")} إرسال اختبار</button></div>
      </form>
      ${sallaTemplatePreviewPanel(item, storeProfile)}
    </section>`);
}

function linkedAppsSection(connection, customIntegrations = []) {
  const entries = [];
  if (connection) {
    const sallaConnected = connection.status === "connected";
    const sallaStatusLabel = sallaConnected ? "مربوط" : connection.status === "expired" ? "انتهت الصلاحية" : connection.status === "error" ? "يحتاج مراجعة" : "قيد الإعداد";
    entries.push(`<article class="linked-app-card">
      <span class="integration-logo integration-logo--salla"><img src="/assets/salla-logo.svg" alt="شعار سلة"></span>
      <div class="linked-app-copy"><span class="status ${sallaConnected ? "success" : "warning"}">${sallaStatusLabel}</span><h3>سلة</h3><p>${escapeHtml(connection.storeName || "متجر سلة")}</p><small>آخر مزامنة: ${connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString("ar-SA") : "لم تتم المزامنة بعد"}</small></div>
      <div class="linked-app-actions"><button class="btn btn-secondary" data-action="preview-salla-connection">${dashboardIcon("eye")} معاينة</button><button class="btn btn-secondary" data-action="open-salla-settings">${dashboardIcon("settings")} تحرير</button></div>
    </article>`);
  }
  customIntegrations.slice(0, 1).forEach((integration) => {
    const ready = integration.status === "ACTIVE";
    entries.push(`<article class="linked-app-card">
      <span class="integration-logo integration-logo--api" aria-hidden="true">&lt;/&gt;</span>
      <div class="linked-app-copy"><span class="status ${ready ? "success" : "warning"}">${ready ? "مربوط" : "قيد الإعداد"}</span><h3>${escapeHtml(integration.name || "API / Webhook")}</h3><p>تكامل مخصص · ${integration.environment === "live" ? "إنتاجي" : "تجريبي"}</p><small>${integration.webhookUrl ? `Webhook: ${escapeHtml(integration.webhookUrl)}` : "لم يكتمل إعداد Webhook بعد"}</small></div>
      <div class="linked-app-actions"><button class="btn btn-secondary" data-action="preview-custom-integration" data-id="${escapeHtml(integration.id)}">${dashboardIcon("eye")} معاينة</button><button class="btn btn-secondary" data-link="/dashboard/settings/integrations/custom-api">${dashboardIcon("settings")} تحرير</button></div>
    </article>`);
  });
  if (!entries.length) return "";
  return `<section class="card linked-apps-section"><div class="section-head"><div><h2>التطبيقات المرتبطة</h2><p>تبقى تطبيقاتك المحفوظة ظاهرة هنا، ويمكنك معاينتها أو تحرير إعداداتها في أي وقت.</p></div><span class="linked-app-count">${entries.length} مرتبط</span></div><div class="linked-apps-grid">${entries.join("")}</div></section>`;
}

function appsCatalogMarkup(data, connected, customIntegrations = []) {
  const customIntegration = customIntegrations[0] || null;
  const customReady = customIntegration?.status === "ACTIVE";
  const hasLinkedApp = Boolean(data?.connection) || Boolean(customIntegration);
  return `<section class="apps-catalog" aria-label="التطبيقات المتاحة للربط">
    <article class="integration-card integration-card--featured">
      <div class="integration-card-head"><span class="integration-logo integration-logo--salla"><img src="/assets/salla-logo.svg" alt="شعار سلة"></span><span class="recommended-badge">الأكثر تكاملًا</span></div>
      <h2>سلة</h2><p class="integration-subtitle">منصة التجارة الإلكترونية السعودية</p>
      <p class="integration-description">اربط متجرك على سلة لمزامنة الطلبات والعملاء والاشتراكات تلقائيًا.</p>
      <span class="integration-status ${connected ? "connected" : "disconnected"}"><i></i> ${connected ? "مربوط" : "غير مربوط"}</span>
      <ul class="integration-features"><li>مزامنة الطلبات تلقائيًا</li><li>إنشاء العملاء تلقائيًا</li><li>ربط المنتج بالباقة</li><li>إرسال رابط معلومات الطلب</li></ul>
      <button class="btn btn-primary integration-action" data-action="${connected ? "open-salla-settings" : "connect-salla"}" ${!connected && !data.configured ? "disabled" : ""}>${connected ? "إدارة الربط" : "ربط سلة"}</button>
      ${!connected && !data.configured ? `<small class="integration-config-note">الربط بانتظار تهيئة بيانات سلة الآمنة على الخادم.</small>` : ""}
    </article>
    <article class="integration-card integration-card--unavailable" aria-disabled="true">
      <div class="integration-card-head"><span class="integration-logo integration-logo--zid" aria-label="شعار زد"><img src="/assets/zid-logo-original.webp" alt="شعار زد الأصلي"></span><span class="unavailable-badge">${dashboardIcon("security")} غير متاح حاليًا</span></div>
      <h2>زد</h2><p class="integration-subtitle">منصة التجارة الإلكترونية زد</p>
      <p class="integration-description">سيُتاح ربط زد بعد اكتمال واعتماد التكامل الرسمي، دون طلب أي بيانات منك الآن.</p>
      <span class="integration-status unavailable"><i></i> قريبًا</span>
      <ul class="integration-features"><li>مزامنة الطلبات تلقائيًا</li><li>إنشاء العملاء تلقائيًا</li><li>ربط المنتج بالباقة</li><li>إرسال رابط معلومات الطلب</li></ul>
      <button class="btn btn-secondary integration-action" type="button" disabled>${dashboardIcon("security")} غير متاح حاليًا</button>
    </article>
    <article class="integration-card integration-card--unavailable" aria-disabled="true">
      <div class="integration-card-head"><span class="integration-logo integration-logo--shopify"><svg viewBox="0 0 48 48" role="img" aria-label="شعار شوبيفاي"><path class="shopify-bag" d="M12 15.5h24l2.2 26H9.8z"></path><path class="shopify-handle" d="M17 17c.3-6 3-10 7-10s6.7 4 7 10"></path><text x="24" y="34" text-anchor="middle">S</text></svg></span><span class="unavailable-badge">${dashboardIcon("security")} غير متاح حاليًا</span></div>
      <h2>شوبيفاي</h2><p class="integration-subtitle">منصة التجارة الإلكترونية شوبيفاي</p>
      <p class="integration-description">سيُتاح ربط شوبيفاي بعد اكتمال واعتماد التكامل الرسمي، دون طلب أي بيانات منك الآن.</p>
      <span class="integration-status unavailable"><i></i> قريبًا</span>
      <ul class="integration-features"><li>مزامنة الطلبات تلقائيًا</li><li>إنشاء العملاء تلقائيًا</li><li>ربط المنتج بالباقة</li><li>إرسال رابط معلومات الطلب</li></ul>
      <button class="btn btn-secondary integration-action" type="button" disabled>${dashboardIcon("security")} غير متاح حاليًا</button>
    </article>
    <article class="integration-card">
      <div class="integration-card-head"><span class="integration-logo integration-logo--api" aria-hidden="true">&lt;/&gt;</span></div>
      <h2 dir="ltr">API / Webhook</h2><p class="integration-subtitle">تطبيق مخصص</p>
      <p class="integration-description">اربط نظامك الخاص عبر API أو Webhook لتحكم كامل في التكامل.</p>
      <span class="integration-status ${customReady ? "connected" : customIntegration ? "pending" : "disconnected"}"><i></i> ${customReady ? "مربوط" : customIntegration ? "قيد الإعداد" : "غير مربوط"}</span>
      <ul class="integration-features"><li>تكامل مخصص عبر API</li><li>إمكانية Webhooks</li><li>إرسال واستقبال البيانات</li><li>توثيق شامل ومرن</li></ul>
      <button class="btn btn-secondary integration-action" data-link="/dashboard/settings/integrations/custom-api">${customIntegration ? "إدارة التكامل" : "إعداد التكامل"}</button>
    </article>
    ${hasLinkedApp ? "" : `<article class="integration-empty-card integration-empty-card--full">
      <div class="integration-empty-art" aria-hidden="true"><span>◇</span><i></i><i></i><i></i></div>
      <h2>لم تربط أي تطبيق بعد</h2>
      <p>اربط تطبيقاتك لبدء أتمتة الطلبات وإدارة اشتراكات عملائك بكفاءة أعلى.</p>
      <div><button class="btn btn-secondary" data-action="integration-guide">عرض دليل الربط</button><button class="btn btn-primary" data-action="connect-salla" ${data.configured ? "" : "disabled"}>ربط سلة</button></div>
      <small>تحتاج مساعدة في الربط؟ <button data-link="/support">تواصل مع الدعم</button></small>
    </article>`}
  </section>`;
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
  const customIntegrations = Array.isArray(data?.customIntegrations) ? data.customIntegrations : [];
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
      { title: "التطبيقات المرتبطة", value: stats.connectedApps || 0, caption: Number(stats.connectedApps || 0) ? "محفوظة في حسابك" : "لا يوجد تطبيق مرتبط", tone: "purple", icon: "customers" },
      { title: "آخر مزامنة", value: stats.lastSyncAt ? new Date(stats.lastSyncAt).toLocaleDateString("ar-SA") : "—", caption: stats.lastSyncAt ? "آخر نشاط محفوظ" : "لا توجد مزامنة حتى الآن", tone: "warning", icon: "reports" },
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
      ${linkedAppsSection(connection, customIntegrations)}
      ${appsCatalogMarkup(data, connected, customIntegrations)}
      <section class="apps-benefits card"><div class="apps-benefits-title"><span>☆</span><div><h2>مزايا ربط التطبيقات</h2><p>اربط تطبيقاتك واستمتع بأتمتة كاملة لعملياتك وتقليل الجهد اليدوي.</p></div></div><div class="apps-benefits-grid">${benefits.map(([icon,title,description]) => `<article><span>${dashboardIcon(icon)}</span><div><strong>${title}</strong><small>${description}</small></div></article>`).join("")}</div></section>`);
  }
  return dashboardShell(`${pageTitle("تطبيقاتنا")}
    ${statGrid([{ title: "التطبيقات المتاحة", value: stats.availableApps || 0, caption: "تطبيق", icon: "apps" }, { title: "التطبيقات المرتبطة", value: stats.connectedApps || 0, caption: "اتصال", tone: "success", icon: "apps" }, { title: "آخر مزامنة", value: stats.lastSyncAt ? new Date(stats.lastSyncAt).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }) : "لا يوجد", caption: "تحديث البيانات", tone: "warning", icon: "reports" }, { title: "طلبات تمت مزامنتها", value: stats.syncedOrders || 0, caption: "طلب حقيقي", tone: "purple", icon: "subscriptions" }])}
    ${linkedAppsSection(connection, customIntegrations)}
    ${appsCatalogMarkup(data, connected, customIntegrations)}
    <section class="card salla-app-card section"><div class="salla-card-head"><div class="salla-brand"><span class="salla-logo-shell"><img class="salla-logo" src="/assets/salla-logo.svg" alt="سلة"></span><div><h2>سلة</h2><p>منصة التجارة الإلكترونية السعودية</p></div></div><span class="status ${connected ? "success" : connection?.status === "error" || connection?.status === "expired" ? "danger" : "neutral"}">${statusLabel}</span></div><p class="salla-app-description">اربط متجر سلة عبر OAuth لمزامنة الطلبات والعملاء والاشتراكات دون نسخ التوكنات إلى المتصفح.</p>${connected ? `<div class="salla-connected-meta"><div><span>المتجر</span><strong>${escapeHtml(connection.storeName || "-")}</strong></div><div><span>آخر مزامنة</span><strong>${connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString("ar-SA") : "لم تتم المزامنة"}</strong></div></div><div class="salla-header-actions"><button class="btn btn-primary" data-link="/dashboard/apps/salla/templates">قوالب سلة</button><button class="btn btn-secondary" data-action="open-salla-settings">إعدادات الربط</button><button class="btn btn-secondary" data-action="open-salla-product-mappings">ربط المنتجات بالباقات</button><button class="btn btn-secondary" data-action="sync-salla-now">مزامنة الآن</button><button class="btn btn-secondary" data-action="show-salla-logs">عرض السجلات</button><button class="btn btn-ghost danger-text" data-action="disconnect-salla">فصل الربط</button></div>` : `<div class="salla-header-actions"><button class="btn btn-primary" data-action="connect-salla" ${data.configured ? "" : "disabled"} title="${data.configured ? "ربط سلة" : "إعدادات OAuth لسلة غير مكتملة على الخادم"}">ربط سلة</button></div>${!data.configured ? `<p class="inline-notice warning">تكامل سلة بانتظار إضافة بيانات OAuth الآمنة في الخادم.</p>` : ""}`}</section>
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
  const plans = state.subscriptionMeta?.plans || [];
  return `<div class="card subscription-server-filters">
    <label class="subscription-search"><span>بحث</span><div class="search-wrap"><span class="search-icon">⌕</span><input class="input" data-action="dashboard-search" placeholder="ابحث بالعميل أو رقم الطلب أو الاشتراك..." value="${escapeHtml(state.search)}"></div></label>
    <label><span>الحالة</span><select class="select" data-action="subscription-status-filter"><option value="">الكل</option>${[["active","نشط"],["expired","منتهي"],["paused","موقوف"],["needs_review","يحتاج مراجعة"]].map(([value,label])=>`<option value="${value}" ${state.subscriptionStatus===value?"selected":""}>${label}</option>`).join("")}</select></label>
    <label><span>الباقة</span><select class="select" data-action="subscription-plan-filter"><option value="">الكل</option>${plans.map((plan)=>`<option value="${plan.id}" ${state.subscriptionPlanId===plan.id?"selected":""}>${escapeHtml(plan.name)}</option>`).join("")}</select></label>
    <label><span>قناة الإرسال</span><select class="select" data-action="subscription-channel-filter"><option value="">الكل</option><option value="whatsapp" ${state.subscriptionChannel==="whatsapp"?"selected":""}>واتساب</option><option value="email" ${state.subscriptionChannel==="email"?"selected":""}>البريد</option></select></label>
    <label><span>موعد التجديد</span><select class="select" data-action="subscription-window"><option value="" ${!state.subscriptionWindow?"selected":""}>الكل</option><option value="3" ${state.subscriptionWindow==="3"?"selected":""}>خلال 3 أيام</option><option value="7" ${state.subscriptionWindow==="7"?"selected":""}>خلال 7 أيام</option><option value="14" ${state.subscriptionWindow==="14"?"selected":""}>خلال 14 يومًا</option><option value="30" ${state.subscriptionWindow==="30"?"selected":""}>خلال 30 يومًا</option></select></label>
    <label><span>المصدر</span><select class="select" data-action="subscription-source-filter"><option value="">الكل</option><option value="salla" ${state.subscriptionSource==="salla"?"selected":""}>سلة</option><option value="manual" ${state.subscriptionSource==="manual"?"selected":""}>يدوي</option><option value="import" ${state.subscriptionSource==="import"?"selected":""}>استيراد</option></select></label>
    <label><span>حالة التذكير</span><select class="select" data-action="subscription-reminder-status-filter"><option value="">الكل</option>${[["scheduled","مجدول"],["queued","في قائمة الإرسال"],["sent","تم الإرسال"],["failed","فشل"],["skipped","تم التخطي"]].map(([value,label])=>`<option value="${value}" ${state.subscriptionReminderStatus===value?"selected":""}>${label}</option>`).join("")}</select></label>
    <label><span>انتهاء الاشتراك من</span><input class="input" type="date" data-action="subscription-date-from" value="${escapeHtml(state.subscriptionDateFrom)}"></label>
    <label><span>إلى</span><input class="input" type="date" data-action="subscription-date-to" value="${escapeHtml(state.subscriptionDateTo)}"></label>
    <button class="btn btn-secondary subscription-clear-filters" data-action="clear-subscription-filters">مسح الفلاتر</button>
  </div>`;
}

function subscriptionsPage() {
  const meta = state.subscriptionMeta || {};
  const stats = meta.summary || {};
  const source = Array.isArray(state.dbSubscriptions) ? state.dbSubscriptions : [];
  const rows = source;
  const content = state.dbSubscriptions?.error
    ? `<div class="empty-state"><strong>تعذر تحميل الاشتراكات</strong><p class="muted">${escapeHtml(state.dbSubscriptions.error)}</p><button class="btn btn-secondary" data-action="reload-subscriptions">إعادة المحاولة</button></div>`
    : state.dbSubscriptions === null
      ? `<div class="loading-state">جاري تحميل الاشتراكات من قاعدة البيانات...</div>`
      : rows.length ? subscriptionsTable(rows) : emptyState("لا توجد اشتراكات حتى الآن", meta.sallaConnected ? "لن يُنشأ اشتراك إلا من طلب مدفوع لمنتج مربوط بباقة، أو بإضافة اشتراك يدوي." : "اربط متجر سلة لاستيراد الطلبات والمنتجات، أو أضف اشتراكًا يدويًا.", meta.sallaConnected ? "إضافة اشتراك" : "ربط متجر سلة", meta.sallaConnected ? "add-subscription" : "connect-salla");
  const tabs = [["list","قائمة الاشتراكات"],["settings","إعدادات التذكير"],["templates","قوالب الرسائل"],["log","سجل الإرسال"]];
  const upcoming = meta.upcoming || [];
  const sendLog = meta.sendLog || [];
  const settingsRows = Array.isArray(meta.settingsItems) ? meta.settingsItems : rows;
  const listSection = `<section class="subscription-workspace"><article class="card table-card subscription-list-card"><div class="section-head"><div><h2>قائمة الاشتراكات <span>(${Number(meta.total || 0).toLocaleString("ar-SA")})</span></h2><p class="muted">الطلبات المدفوعة المرتبطة بباقات Renvix فقط.</p></div></div>${content}<div class="subscription-pagination"><span>صفحة ${Number(meta.page||1)} من ${Math.max(1,Math.ceil(Number(meta.total||0)/Number(meta.limit||20)))}</span><div><button class="btn btn-secondary" data-action="subscription-page" data-page="${Math.max(1,Number(meta.page||1)-1)}" ${Number(meta.page||1)<=1?"disabled":""}>السابق</button><button class="btn btn-secondary" data-action="subscription-page" data-page="${Number(meta.page||1)+1}" ${Number(meta.page||1)*Number(meta.limit||20)>=Number(meta.total||0)?"disabled":""}>التالي</button></div></div></article><aside class="subscription-side-column"><article class="card subscription-upcoming"><div class="section-head"><h2>التجديدات القادمة</h2><button data-action="clear-subscription-filters">عرض الكل</button></div>${upcoming.length?upcoming.map((item)=>`<button class="upcoming-renewal-row" data-action="subscription-edit-db" data-id="${item.id}"><span><strong>${escapeHtml(item.customerName)}</strong><small>${escapeHtml(item.planName)}</small></span><b>${new Date(item.endDate).toLocaleDateString("ar-SA",{day:"numeric",month:"short"})}</b></button>`).join(""):`<div class="security-empty-row">لا توجد تجديدات قادمة.</div>`}</article></aside></section>`;
  const settingsRow = settingsRows[0] || {};
  const settingsSection = `<article class="card section subscription-settings-panel"><div class="section-head"><div><h2>إعدادات إرسال تذكير التجديد</h2><p class="muted">حدد قناة التذكير وطريقة التشغيل والموعد من مكان واحد. الإرسال التلقائي يعمل من Worker دون فتح الصفحة.</p></div><span class="delivery-secure-badge">إرسال آمن</span></div>${settingsRows.length ? `<form data-submit="subscription-settings" data-id="${escapeHtml(settingsRow.id || "")}" class="subscription-settings-form">${messageActivationCard({
    title: "تفعيل رسالة التذكير",
    description: "عند تفعيلها، يُرسل تذكير التجديد وفق القناة والموعد المحددين. عند الإيقاف تُلغى التذكيرات المجدولة ولا يمكن إرسالها يدويًا.",
    enabled: settingsRow.reminderEnabled !== false,
    icon: "send",
    inputName: "reminderEnabled"
  })}<label class="field"><span>قناة الإرسال</span><select class="select" name="reminderChannel"><option value="whatsapp" ${settingsRow.reminderChannel !== "email" ? "selected" : ""}>واتساب</option><option value="email" ${settingsRow.reminderChannel === "email" ? "selected" : ""}>البريد الإلكتروني</option></select><small>القناة المعتمدة لإرسال تذكير التجديد.</small></label><label class="field"><span>متى يتم الإرسال؟</span><select class="select" name="reminderDaysBefore">${[[0,"يوم الانتهاء"],[1,"قبل يوم واحد"],[3,"قبل 3 أيام"],[4,"قبل 4 أيام"],[7,"قبل 7 أيام"],[14,"قبل 14 يومًا"]].map(([value,label]) => `<option value="${value}" ${Number(settingsRow.reminderDaysBefore || 7) === value ? "selected" : ""}>${label}</option>`).join("")}</select><small>يعمل هذا الموعد عند اختيار الإرسال التلقائي.</small></label><fieldset class="field delivery-mode-field"><legend>أوامر الإرسال</legend><div class="delivery-mode-switch"><label><input type="radio" name="reminderMode" value="automatic" ${settingsRow.reminderMode !== "manual" ? "checked" : ""}><span>تلقائي</span></label><label><input type="radio" name="reminderMode" value="manual" ${settingsRow.reminderMode === "manual" ? "checked" : ""}><span>يدوي</span></label></div><small>اليدوي ينتظر ضغط زر «إرسال تذكير»، والتلقائي يجدوله في الموعد.</small></fieldset><div class="subscription-settings-actions"><button class="btn btn-primary">حفظ الإعدادات</button></div></form>` : emptyState("لا توجد اشتراكات","أضف اشتراكًا أولًا لتحديد إعدادات التذكير.")}</article>`;
  const templatesSection = `<article class="card section subscription-template-bridge"><div>${dashboardIcon("template")}<h2>قوالب رسائل التجديد</h2><p>قالب واتساب وقالب البريد مستقلان، ولا تُرسل رسالة إذا كان قالب القناة غير مهيأ أو يحتوي متغيرًا غير معتمد.</p><button class="btn btn-primary" data-link="/dashboard/templates">فتح القوالب</button></div></article>`;
  const logSection = `<article class="card table-card section"><div class="section-head"><div><h2>سجل الإرسال</h2><p class="muted">يبقى السجل محفوظًا حتى بعد اختفاء شارة «تم الإرسال» بعد 72 ساعة.</p></div></div>${sendLog.length?simpleTable(["العميل","الخدمة","القناة","الحالة","وقت النجاح","السبب"],sendLog.map((item)=>[escapeHtml(item.customerName||"-"),escapeHtml(item.serviceName||"-"),item.channel==="email"?"البريد":"واتساب",status(item.status),item.sentAt?new Date(item.sentAt).toLocaleString("ar-SA"):"-",escapeHtml(item.errorMessage||"-")])):emptyState("لا توجد رسائل مسجلة","ستظهر هنا نتائج الإرسال الفعلية.")}</article>`;
  const activeSection = state.subscriptionSection==="settings"?settingsSection:state.subscriptionSection==="templates"?templatesSection:state.subscriptionSection==="log"?logSection:listSection;
  return dashboardShell(`${pageTitle("الاشتراكات", `<button class="btn btn-primary" data-action="add-subscription">+ اشتراك جديد</button><button class="btn btn-secondary" data-action="export-subscriptions">تصدير</button>`)}
    <p class="subscriptions-page-subtitle">إدارة عملائك ومواعيد تجديدها في مكان واحد.</p>
    ${statGrid([
      { title: "إجمالي الاشتراكات", value: Number(stats.total||0), caption: "سجل فعلي", tone: "info", icon: "subscriptions" },
      { title: "الاشتراكات النشطة", value: Number(stats.active||0), caption: "نشط", tone: "success", icon: "security" },
      { title: "تجديد قريب (7 أيام)", value: Number(stats.upcoming7||0), caption: "موعد", tone: "warning", icon: "reports" },
      { title: "قيمة الاشتراكات النشطة", value: formatMoney(Number(stats.activeValue||0)), caption: "ر.س", tone: "purple", icon: "billing" }
    ])}
    ${Number(meta.unmappedCount||0)>0?`<button class="inline-notice warning subscription-unmapped-notice" data-link="/dashboard/apps">${Number(meta.unmappedCount)} عناصر طلب من سلة تحتاج إلى ربط باقة ومدة — لم يُنشأ لها اشتراك تلقائيًا.</button>`:""}
    <nav class="subscription-section-tabs">${tabs.map(([key,label])=>`<button class="${state.subscriptionSection===key?"active":""}" data-action="subscription-section" data-section="${key}">${label}</button>`).join("")}</nav>
    ${subscriptionToolbar()}
    ${activeSection}`);
}

function subscriptionsTable(rows, compact = false) {
  const head = compact ? ["رقم الطلب", "العميل", "الباقة", "تاريخ الانتهاء", "الحالة"] : ["العميل", "الباقة", "قيمة الاشتراك", "البداية", "التجديد القادم", "الحالة", "الإجراءات"];
  const body = rows.map((row) => {
    const noContact = !row.emailEligible && !row.whatsappEligible;
    const reminderDisabled = row.reminderEnabled === false;
    const disabled = noContact || reminderDisabled ? "disabled" : "";
    const reason = reminderDisabled ? "رسالة التذكير متوقفة من إعدادات التذكير" : noContact ? "لا يمكن الإرسال لعدم توفر رقم أو بريد صالح" : "";
    const deliveryLabel = `${row.reminderChannel === "email" ? "البريد الإلكتروني" : "واتساب"} · ${row.reminderMode === "automatic" ? "تلقائي" : "يدوي"}`;
    const reminderAction = row.lastMessageStatus === "failed"
      ? `<button class="btn btn-secondary" data-action="send-subscription-reminder" data-id="${row.id}" ${disabled} title="سيتم خصم الرصيد فقط إذا نجح الإرسال">إعادة الإرسال</button>`
      : `<button class="btn btn-ghost icon-only" data-action="send-subscription-reminder" data-id="${row.id}" ${disabled} title="${escapeHtml(reason||"معاينة التذكير")}">${dashboardIcon("template")}</button>`;
    const actions = `<div class="subscription-actions">
      <button class="btn btn-ghost icon-only" data-action="subscription-notifications" data-id="${row.id}" title="عرض السجل">${dashboardIcon("reports")}</button>
      ${reminderAction}
      <button class="btn btn-secondary" data-action="mark-renewed" data-id="${row.id}">تجديد</button>
      <button class="btn btn-ghost icon-only" data-action="subscription-edit-db" data-id="${row.id}" title="تعديل">${dashboardIcon("settings")}</button>
    </div>`;
    if (compact) return `<tr><td>${escapeHtml(row.orderNumber)}</td><td>${escapeHtml(row.customerName)}</td><td>${escapeHtml(row.planName)}</td><td>${escapeHtml(String(row.endDate).slice(0, 10))}</td><td>${status(row.status)}</td></tr>`;
    const sentBadge = row.showSentBadge
      ? `<span class="subscription-sent-badge">تم الإرسال <small>${row.lastReminderChannel==="email"?"بالبريد":"عبر واتساب"}</small></span>`
      : row.lastReminderSentAt
        ? `<span class="subscription-sent-history" title="آخر تذكير أُرسل ${new Date(row.lastReminderSentAt).toLocaleString("ar-SA")} ${row.lastReminderChannel==="email"?"عبر البريد":"عبر واتساب"}">✓</span>`
        : row.lastMessageStatus==="failed" ? `<span class="subscription-failed-badge" title="${escapeHtml(row.lastMessageError||"")}">فشل الإرسال</span>` : row.lastMessageStatus==="pending" ? `<span class="subscription-queued-badge">مجدول</span>` : "";
    const displayStatus = row.status==="active" && subscriptionRemainingDays(row)!==null && subscriptionRemainingDays(row)<=7 && subscriptionRemainingDays(row)>=0 ? "expiring_soon" : row.status;
    return `<tr><td><strong>${escapeHtml(row.customerName)}</strong><small>${escapeHtml(row.orderNumber)}</small></td><td><strong>${escapeHtml(row.planName)}</strong><small>${escapeHtml(row.serviceName)}</small><span class="delivery-preference-pill ${reminderDisabled ? "disabled" : row.reminderMode === "automatic" ? "automatic" : "manual"}">${reminderDisabled ? "التذكير متوقف" : escapeHtml(deliveryLabel)}</span></td><td>${formatMoney(Number(row.price||0))}<small>${escapeHtml(row.currency||"SAR")}</small></td><td>${escapeHtml(String(row.startDate).slice(0,10))}<small>بداية الاشتراك</small></td><td><strong>${escapeHtml(String(row.endDate).slice(0,10))}</strong><small>${subscriptionRemainingDays(row)>=0?`بعد ${subscriptionRemainingDays(row)} يوم`:"منتهي"}</small></td><td>${status(displayStatus)}${sentBadge}</td><td>${actions}</td></tr>`;
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

function campaignChannel(channel) {
  return channel === "email"
    ? `<span class="campaign-channel email">${dashboardIcon("email")} بريد إلكتروني</span>`
    : `<span class="campaign-channel whatsapp">${dashboardIcon("whatsapp")} واتساب</span>`;
}

function campaignProgress(value, total) {
  const percent = total > 0 ? Math.min(100, Math.round((Number(value || 0) / Number(total)) * 100)) : 0;
  return `<div class="campaign-progress"><span><i style="width:${percent}%"></i></span><b>${percent}%</b></div>`;
}

function campaignsTable(items) {
  if (!items.length) return emptyState("لا توجد حملات حتى الآن", "أنشئ حملتك الأولى وحدد القناة والجمهور، ولن يبدأ أي إرسال قبل مراجعتك.", "حملة جديدة", "campaign-create");
  return `<div class="compare campaign-table"><table><thead><tr><th>اسم الحملة</th><th>القناة</th><th>الجمهور</th><th>الموعد</th><th>الحالة</th><th>معدل التسليم</th><th>معدل الفشل</th><th>الإجراءات</th></tr></thead><tbody>${items.map((item) => {
    const sent = Number(item.sentCount || 0), delivered = Number(item.deliveredCount || 0), failed = Number(item.failedCount || 0);
    return `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description || "حملة تواصل")}</small></td><td>${campaignChannel(item.channel)}</td><td><strong>${Number(item.eligibleRecipients || 0).toLocaleString("ar-SA")}</strong><small>جهة مؤهلة</small></td><td>${item.scheduledFor ? `<strong>${new Date(item.scheduledFor).toLocaleDateString("ar-SA")}</strong><small>${new Date(item.scheduledFor).toLocaleTimeString("ar-SA", { hour:"2-digit",minute:"2-digit" })}</small>` : `<span class="muted">لم يحدد بعد</span>`}</td><td>${status(item.status)}</td><td>${campaignProgress(delivered, sent)}</td><td>${campaignProgress(failed, Math.max(sent, 1))}</td><td><div class="inline-actions"><button class="btn btn-ghost icon-only" data-action="campaign-estimate" data-id="${item.id}" title="فحص الجمهور">${dashboardIcon("reports")}</button>${["draft","ready","paused"].includes(item.status) ? `<button class="btn btn-secondary icon-only" data-action="campaign-start" data-id="${item.id}" title="بدء الحملة">${dashboardIcon("send")}</button>` : ""}${["scheduled","queueing","sending"].includes(item.status) ? `<button class="btn btn-secondary" data-action="campaign-pause" data-id="${item.id}">إيقاف</button>` : ""}</div></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function campaignActivityMarkup(items = []) {
  if (!items.length) return `<div class="campaign-activity-empty">لا توجد أنشطة حملات مسجلة بعد.</div>`;
  return items.map((item) => `<div class="campaign-activity"><span>${dashboardIcon(item.type?.includes("queued") ? "send" : "campaigns")}</span><div><strong>${escapeHtml(item.title)}</strong><small>${new Date(item.createdAt).toLocaleString("ar-SA")}</small></div></div>`).join("");
}

function campaignMetaTemplateBody(template) {
  const components = Array.isArray(template?.components) ? template.components : [];
  return components.find((component) => String(component?.type || "").toUpperCase() === "BODY")?.text || "";
}

function campaignCreateModalMarkup() {
  const options = state.campaignsOverview?.createOptions || {};
  const devices = Array.isArray(options.devices) ? options.devices : [];
  const groups = Array.isArray(options.groups) ? options.groups : [];
  const templates = Array.isArray(options.templates) ? options.templates : [];
  const metaTemplates = Array.isArray(options.metaTemplates) ? options.metaTemplates : [];
  const start = new Date(Date.now() + 5 * 60_000);
  const localStart = new Date(start.getTime() - start.getTimezoneOffset() * 60_000).toISOString();
  const startDate = localStart.slice(0, 10);
  const startTime = localStart.slice(11, 16);
  const dayOptions = [[0,"الأحد"],[1,"الاثنين"],[2,"الثلاثاء"],[3,"الأربعاء"],[4,"الخميس"],[5,"الجمعة"],[6,"السبت"]];
  const connectedDevices = devices.filter((device) => device.status === "connected");
  const emailTemplates = templates.filter((template) => template.channel === "email");
  return `<form data-submit="campaign-create" class="campaign-create-form">
    <section class="campaign-form-section campaign-form-intro">
      <div><strong>تفاصيل الحملة</strong><small>اضبط الجمهور والقناة والجدول من مكان واحد.</small></div>
      <label class="campaign-activation"><span><b>تفعيل الحملة</b><small>تحضير الجمهور وجدولة الإرسال عند الحفظ</small></span><span class="switch-control"><input type="checkbox" name="isEnabled" checked><span></span></span></label>
    </section>
    <section class="campaign-form-grid">
      <label class="field"><span>اسم الحملة</span><input class="input" name="name" maxlength="160" required placeholder="مثال: عروض نهاية الشهر"></label>
      <label class="field"><span>قناة الإرسال</span><select class="select" name="channel" data-action="campaign-channel"><option value="whatsapp">واتساب عبر Meta Cloud API</option><option value="email">البريد الإلكتروني عبر Resend</option></select></label>
      <label class="field"><span>وصف اختياري</span><input class="input" name="description" maxlength="600" placeholder="الغرض من الحملة"></label>
      <label class="field"><span>اختيار المجموعة</span><select class="select" name="groupId"><option value="">كل جهات الاتصال المؤهلة</option>${groups.map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)} (${Number(group.contactsCount || 0).toLocaleString("ar-SA")})</option>`).join("")}</select><small>تُستخدم مجموعات جهات الاتصال المحفوظة فقط.</small></label>
      <div data-campaign-panel="whatsapp" class="campaign-channel-fields">
        <label class="field"><span>اختيار الأجهزة</span><select class="select" name="whatsappChannelId" required><option value="">اختر جهازًا متصلًا</option>${connectedDevices.map((device) => `<option value="${escapeHtml(device.id)}">${escapeHtml(device.name)}${device.phoneNumber ? ` — ${escapeHtml(device.phoneNumber)}` : ""}</option>`).join("")}</select>${connectedDevices.length ? "" : `<small class="field-warning">لا يوجد جهاز Meta متصل. اربط جهازًا قبل تفعيل الحملة.</small>`}</label>
        <label class="field"><span>اختيار القالب</span><select class="select" name="metaTemplateId" data-action="campaign-template"><option value="">محتوى مخصص بدون قالب</option>${metaTemplates.map((template) => `<option value="${escapeHtml(template.id)}" data-channel-id="${escapeHtml(template.channelId)}" data-template-body="${escapeHtml(campaignMetaTemplateBody(template))}">${escapeHtml(template.name || "قالب Meta")} — ${escapeHtml(template.language || "ar")}</option>`).join("")}</select><small>تظهر قوالب Meta المعتمدة فقط.</small></label>
      </div>
      <div data-campaign-panel="email" class="campaign-channel-fields" hidden>
        <label class="field"><span>اختيار القالب</span><select class="select" name="templateId" data-action="campaign-template" disabled><option value="">محتوى بريد مخصص</option>${emailTemplates.map((template) => `<option value="${escapeHtml(template.id)}" data-template-body="${escapeHtml(template.body || "")}" data-template-subject="${escapeHtml(template.subject || template.name || "")}">${escapeHtml(template.name)}</option>`).join("")}</select></label>
        <label class="field"><span>عنوان البريد</span><input class="input" name="subject" maxlength="200" placeholder="عنوان واضح للحملة" disabled></label>
      </div>
    </section>
    <section class="campaign-form-section campaign-schedule-section"><div class="campaign-form-section-title"><strong>موعد الإرسال</strong><small>تُستخدم منطقة الرياض الزمنية لحماية دقة الجدولة.</small></div>
      <div class="campaign-form-grid campaign-schedule-grid">
        <label class="field"><span>تاريخ بدء الحملة</span><input class="input" type="date" name="startDate" min="${startDate}" value="${startDate}" required></label>
        <label class="field"><span>توقيت بدء الحملة</span><input class="input" type="time" name="startTime" value="${startTime}" required></label>
        <label class="field"><span>توقيت انتهاء الحملة</span><input class="input" type="time" name="endTime" value="23:00" required><small>يتوقف الإرسال بعد هذا الوقت ويُستكمل في يوم مسموح.</small></label>
        <div class="field campaign-days-field"><span>تحديد الأيام</span><div class="campaign-days"><label class="campaign-all-days"><input type="checkbox" data-action="campaign-all-days" checked> كل الأيام</label>${dayOptions.map(([value,label]) => `<label><input type="checkbox" name="allowedDays" value="${value}" checked> ${label}</label>`).join("")}</div></div>
      </div>
    </section>
    <section class="campaign-form-section"><div class="campaign-form-section-title"><strong>محتوى القالب</strong><small>استخدم <code dir="ltr">{{ مرحبا | اهلا بك | حياك }}</code> لاختيار عبارة مختلفة تلقائيًا لكل مستلم.</small></div>
      <label class="field campaign-message-field"><textarea class="textarea" name="body" maxlength="12000" rows="7" required placeholder="{{ مرحبا | أهلاً بك | حياك }} {{customer_name}}، اكتب رسالتك هنا..."></textarea></label>
      <div class="campaign-keywords-grid">
        <fieldset><legend>كلمات مفتاحية من جهة الاتصال الخاصة بك</legend><label><input type="checkbox" name="contactKeywords" value="customer_name" checked> اسم العميل <code>{{customer_name}}</code></label><label><input type="checkbox" name="contactKeywords" value="company_name"> اسم الشركة <code>{{company_name}}</code></label><label><input type="checkbox" name="contactKeywords" value="first_name"> الاسم الأول <code>{{first_name}}</code></label></fieldset>
        <label class="field"><span>كلمات مفتاحية أخرى لاستخدامها</span><textarea class="textarea" name="customKeywords" rows="4" maxlength="1200" placeholder="اكتب كل كلمة مفتاحية في سطر مستقل"></textarea><small>تُحفظ مع إعدادات الحملة لاستخدامها عند تجهيز الرسالة.</small></label>
      </div>
    </section>
    <section class="campaign-form-section"><div class="campaign-form-section-title"><strong>الفاصل العشوائي بين الرسائل</strong><small>كلما زادت الفترة كان الإرسال أكثر هدوءًا وأمانًا.</small></div><div class="campaign-delay-grid">
      <label class="field"><span>أقل وقت بين الرسالة والأخرى بالثانية</span><input class="input" name="minDelaySeconds" type="number" min="20" max="3600" value="20" required><small>الحد الأدنى الآمن هو 20 ثانية.</small></label>
      <label class="field"><span>أقصى وقت بين الرسالة والأخرى بالثانية</span><input class="input" name="maxDelaySeconds" type="number" min="20" max="7200" value="120" required><small>تختار المنصة فترة عشوائية ضمن النطاق.</small></label>
    </div></section>
    <div class="campaign-safety-note">لن يتم تجاوز الجهاز أو المجموعة أو الأيام المحددة، وتُفحص أهلية الجمهور قبل تفعيل الجدولة.</div>
    <div class="campaign-form-actions"><button class="btn btn-primary" type="submit">حفظ الحملة</button><button class="btn btn-secondary" type="button" data-action="close-modal">إلغاء</button></div>
  </form>`;
}

function campaignsPage() {
  const data = state.campaignsOverview;
  const items = Array.isArray(data?.items) ? data.items : [];
  const summary = data?.summary || { total:0,active:0,messagesThisMonth:0,deliveryRate:0,failed:0 };
  const content = data?.error ? emptyState("تعذر تحميل الحملات", escapeHtml(data.error), "إعادة المحاولة", "campaign-reload") : data === null ? `<div class="loading-state">جاري تحميل الحملات...</div>` : campaignsTable(items);
  return dashboardShell(`${pageTitle("الحملات", `<button class="btn btn-primary" data-action="campaign-create">${dashboardIcon("campaigns")} حملة جديدة</button><button class="btn btn-secondary" data-action="campaign-export">تصدير</button><button class="btn btn-secondary" data-link="/dashboard/contacts">جهات الاتصال</button>`)}`+
    `<p class="dashboard-page-lead">إدارة حملات واتساب والبريد الإلكتروني باحترافية، مع نتائج فعلية من مزودي الإرسال.</p>`+
    statGrid([
      { title:"إجمالي الحملات",value:Number(summary.total||0).toLocaleString("ar-SA"),caption:"حملة محفوظة",tone:"info",icon:"template" },
      { title:"الحملات النشطة",value:Number(summary.active||0).toLocaleString("ar-SA"),caption:"مجدولة أو قيد الإرسال",tone:"purple",icon:"campaigns" },
      { title:"معدل الوصول",value:`${Number(summary.deliveryRate||0)}%`,caption:"تأكيد مزود فعلي",tone:"success",icon:"reports" },
      { title:"الرسائل المرسلة هذا الشهر",value:Number(summary.messagesThisMonth||0).toLocaleString("ar-SA"),caption:"دون بيانات تجريبية",tone:"warning",icon:"send" }
    ])+
    `<section class="campaign-tabs"><button class="active">كل الحملات</button><button>المجدولة</button><button>النشطة</button><button>المكتملة</button></section>`+
    `<div class="campaign-layout"><section class="card campaign-main-card"><div class="toolbar"><div class="search-wrap"><span class="search-icon">⌕</span><input class="input" data-action="campaign-search" placeholder="ابحث عن حملة..."></div><select class="select"><option>كل القنوات</option><option>واتساب</option><option>البريد الإلكتروني</option></select><select class="select"><option>كل الحالات</option><option>مسودة</option><option>مجدولة</option><option>مكتملة</option></select></div>${content}</section>`+
    `<aside class="card campaign-activity-card"><div class="section-head"><div><h2>أحدث الأنشطة</h2><p class="muted">أحداث محفوظة في سجل مساحة العمل.</p></div></div>${campaignActivityMarkup(data?.activity || [])}</aside></div>`+
    `<section class="campaign-bottom-grid"><article class="card"><div class="section-head"><div><h2>نظرة عامة على الأداء</h2><p class="muted">المؤشرات محسوبة من الرسائل الفعلية فقط.</p></div></div><div class="campaign-performance"><div><span>تم التسليم</span><strong>${Number(summary.delivered||0).toLocaleString("ar-SA")}</strong>${campaignProgress(summary.delivered,summary.sent)}</div><div><span>فشل الإرسال</span><strong>${Number(summary.failed||0).toLocaleString("ar-SA")}</strong>${campaignProgress(summary.failed,summary.sent)}</div></div></article><article class="card campaign-tip"><span>${dashboardIcon("reports")}</span><div><h2>اقتراح لتحسين الأداء</h2><p>استخدم جمهورًا لديه موافقة صالحة، واختبر المحتوى قبل جدولة الحملة.</p><button class="btn btn-ghost" data-link="/dashboard/templates">فتح القوالب</button></div></article></section>`);
}

function contactsTable(items) {
  if (!items.length) return emptyState("لا توجد جهات اتصال", "أضف جهة اتصال يدويًا أو استوردها من سلة أو CSV.", "إضافة جهة اتصال", "contact-create");
  return `<div class="compare"><table><thead><tr><th>جهة الاتصال</th><th>البريد</th><th>واتساب</th><th>المصدر</th><th>الحالة</th><th>آخر تحديث</th><th>الإجراء</th></tr></thead><tbody>${items.map((item) => {
    const email=item.points?.find((point)=>point.channel==="email");const whatsapp=item.points?.find((point)=>point.channel==="whatsapp");
    return `<tr><td><strong>${escapeHtml(item.displayName)}</strong><small>${escapeHtml(item.companyName||"")}</small></td><td>${escapeHtml(email?.value||"غير متوفر")}</td><td>${escapeHtml(whatsapp?.value||"غير متوفر")}</td><td>${escapeHtml(item.source)}</td><td>${status(item.status)}</td><td>${new Date(item.updatedAt).toLocaleDateString("ar-SA")}</td><td><button class="btn btn-secondary" data-action="contact-archive" data-id="${item.id}" ${item.status==="archived"?"disabled":""}>أرشفة</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function contactsPage() {
  const data=state.contactsOverview;const stats=state.contactStatistics?.statistics||{};const items=Array.isArray(data?.items)?data.items:[];
  const content=data?.error?emptyState("تعذر تحميل جهات الاتصال",escapeHtml(data.error),"إعادة المحاولة","contacts-reload"):data===null?`<div class="loading-state">جاري تحميل جهات الاتصال...</div>`:contactsTable(items);
  return dashboardShell(`${pageTitle("جهات الاتصال",`<button class="btn btn-primary" data-action="contact-create">${dashboardIcon("contacts")} إضافة جهة اتصال</button><button class="btn btn-secondary" data-action="contacts-salla-sync">مزامنة سلة</button><button class="btn btn-secondary" data-action="contacts-import">استيراد CSV</button><button class="btn btn-secondary" data-action="contacts-export">تصدير</button>`)}`+
    `<p class="dashboard-page-lead">قاعدة جمهور الحملات، منفصلة عن حسابات مستخدمي المنصة ومحمية حسب مساحة العمل.</p>`+
    statGrid([{title:"إجمالي جهات الاتصال",value:Number(stats.total||0),caption:"سجل محفوظ",tone:"info",icon:"contacts"},{title:"مؤهلون لواتساب",value:Number(stats.whatsappEligible||0),caption:"رقم صالح وغير موقوف",tone:"success",icon:"whatsapp"},{title:"مؤهلون للبريد",value:Number(stats.emailEligible||0),caption:"بريد صالح وغير موقوف",tone:"purple",icon:"email"},{title:"مستبعدون",value:Number(stats.excluded||0),caption:"مؤرشفون أو بلا قناة",tone:"warning",icon:"security"}])+
    `<section class="card contact-card"><div class="toolbar"><div class="search-wrap"><span class="search-icon">⌕</span><input class="input" data-action="contact-search" placeholder="ابحث بالاسم أو البريد أو الجوال..."></div><select class="select"><option>كل القنوات</option><option>واتساب</option><option>البريد الإلكتروني</option></select><span class="status warning">تحتاج مراجعة: ${Number(stats.needsReview||0)}</span></div>${content}</section>`);
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
  const reminder = state.subscriptionMeta?.reminderPerformance || {};
  return dashboardShell(`${pageTitle("التقارير", `<select class="select report-period" data-action="report-period"><option value="6" ${state.reportPeriod === "6" ? "selected" : ""}>آخر 6 أشهر</option><option value="3" ${state.reportPeriod === "3" ? "selected" : ""}>آخر 3 أشهر</option><option value="1" ${state.reportPeriod === "1" ? "selected" : ""}>هذا الشهر</option></select><button class="btn btn-primary" data-action="export-report">تصدير التقرير</button>`)}
    ${statGrid([
      { title: "الإيراد الشهري", value: formatMoney(stats.monthlyRevenue), caption: "حالي", tone: "success", icon: "reports" },
      { title: "الرسائل المرسلة", value: stats.sentMessages, caption: "رسالة", tone: "info", icon: "subscriptions" },
      { title: "نسبة النجاح", value: `${stats.successRate || 0}%`, caption: "من إجمالي الرسائل", tone: "purple", icon: "reports" },
      { title: "العملاء المتجددون", value: stats.renewedCustomers, caption: "عميل", tone: "warning", icon: "customers" }
    ])}
    <article class="card chart-card section"><div class="section-head"><div><h2>رسم الأداء</h2><p class="muted">بيانات الاشتراكات للفترة المحددة.</p></div></div>${performanceChart(reportRows)}</article>
    <article class="card section"><div class="section-head"><div><h2>أداء تذكيرات التجديد</h2><p class="muted">يُحسب التحويل فقط من روابط التجديد الخاصة القابلة للتتبع.</p></div></div>${statGrid([
      {title:"الرسائل المجدولة",value:Number(reminder.scheduled||0),caption:"قيد الانتظار",tone:"info",icon:"template"},
      {title:"الرسائل الناجحة",value:Number(reminder.successful||0),caption:"قبِلها المزود",tone:"success",icon:"subscriptions"},
      {title:"الرسائل الفاشلة",value:Number(reminder.failed||0),caption:"مع سبب محفوظ",tone:"danger",icon:"security"},
      {title:"التجديدات المتتبعة",value:Number(reminder.renewed||0),caption:reminder.bestChannel?`أفضل قناة: ${reminder.bestChannel==="email"?"البريد":"واتساب"}`:"لا توجد بيانات",tone:"purple",icon:"reports"},
      {title:"فتح رابط التجديد",value:Number(reminder.opened||0),caption:`نقرات الزر ${Number(reminder.clicked||0)}`,tone:"warning",icon:"reports"},
      {title:"التحويل إلى تجديد",value:reminder.conversionRate===null||reminder.conversionRate===undefined?"غير متاح":`${Number(reminder.conversionRate)}%`,caption:"من الروابط المتتبعة فقط",tone:"success",icon:"reports"}
    ])}</article>
    <div class="section dashboard-two-column">
      <article class="card table-card"><div class="section-head"><div><h2>سجل النشاط</h2><p class="muted">آخر العمليات داخل مساحة العمل.</p></div></div>${activities.length ? activityList(activities) : emptyState("لا توجد نشاطات بعد", "ستظهر العمليات الفعلية هنا بعد استخدام المنصة.")}</article>
      <article class="card table-card"><div class="section-head"><div><h2>الفوترة والباقات</h2><p class="muted">الخطة الحالية والفواتير.</p></div><span class="plan-badge">${escapeHtml(profile.planName || "Free Trial")}</span></div>${emptyState("لا توجد فواتير بعد", "ستظهر الفواتير هنا عند إصدار أول فاتورة.", "عرض الباقات", "/dashboard/billing")}</article>
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
  if (risk) return `<strong class="security-risk-label">${escapeHtml(metric.label || "غير متاح")}</strong>`;
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

function showStorageQuotaLimit(storage = null) {
  const used = Number(storage?.usedMb || 0);
  const limit = Number(storage?.limitMb || 0);
  const usageText = limit > 0 ? `${used.toLocaleString("ar-SA")} من ${limit.toLocaleString("ar-SA")} MB` : "الحد المسموح في الباقة الحالية";
  openModal("مساحة الباقة ممتلئة", `<div class="quota-limit-modal storage-limit-modal">${dashboardIcon("billing")}<p>لا يمكن تنفيذ عملية جديدة تحتاج إلى مساحة لأن حسابك وصل إلى حد التخزين.</p><p>الاستخدام الحالي: <strong>${escapeHtml(usageText)}</strong>.</p><p>طوّر الباقة للمتابعة، أو احذف بيانات وملفات لم تعد تحتاجها ثم أعد المحاولة. عمليات الحذف وإدارة الفوترة تظل متاحة.</p><div class="inline-actions"><button class="btn btn-primary" data-action="upgrade-storage-plan">ترقية الباقة</button><button class="btn btn-secondary" data-link="/dashboard/settings">مراجعة المساحة</button></div></div>`);
}

function securityTrendMarkup(points = [], currentScore = null) {
  const trend = Array.isArray(points) ? points.filter((item) => Number.isFinite(Number(item?.score))).slice(-7) : [];
  if (trend.length < 2) {
    return `<div class="security-trend-empty">${dashboardIcon("reports")}<span>سيظهر الاتجاه الأسبوعي بعد تسجيل فحصين فعليين على الأقل.</span></div>`;
  }
  const width = 420;
  const height = 70;
  const padding = 7;
  const step = (width - padding * 2) / Math.max(1, trend.length - 1);
  const coords = trend.map((item, index) => ({
    x: Math.round((padding + index * step) * 10) / 10,
    y: Math.round((height - padding - (Math.max(0, Math.min(100, Number(item.score))) / 100) * (height - padding * 2)) * 10) / 10,
    score: Number(item.score),
    date: item.date
  }));
  const line = coords.map((item) => `${item.x},${item.y}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  const first = coords[0]?.score;
  const last = coords.at(-1)?.score ?? Number(currentScore || 0);
  const difference = Number.isFinite(first) ? last - first : 0;
  const direction = difference > 0 ? `تحسن ${difference}%` : difference < 0 ? `انخفاض ${Math.abs(difference)}%` : "مستقر";
  return `<div class="security-trend-wrap"><div class="security-trend-caption"><span>آخر 7 أيام</span><strong class="${difference < 0 ? "down" : "up"}">${escapeHtml(direction)}</strong></div><svg class="security-trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="اتجاه مؤشر الحماية خلال آخر سبعة أيام"><defs><linearGradient id="securityTrendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#27bf91" stop-opacity=".2"/><stop offset="1" stop-color="#27bf91" stop-opacity="0"/></linearGradient></defs><polygon points="${area}" fill="url(#securityTrendFill)"/><polyline points="${line}" fill="none" stroke="#25b98c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>${coords.map((item) => `<circle cx="${item.x}" cy="${item.y}" r="3" fill="#fff" stroke="#25b98c" stroke-width="2"><title>${escapeHtml(item.date)} · ${item.score}%</title></circle>`).join("")}</svg></div>`;
}

function securityEventsTable(events = []) {
  if (!events.length) return `<div class="security-empty-row">لا توجد أحداث أمنية مسجلة.</div>`;
  return `<div class="compare security-events-table"><table><thead><tr><th>نوع الحدث</th><th>المستوى</th><th>الوقت</th><th>الحالة</th><th>التفاصيل</th></tr></thead><tbody>${events.map((item) => `<tr><td><strong>${escapeHtml(item.type)}</strong></td><td><span class="security-severity ${escapeHtml(item.severity || "low")}">${item.severity === "critical" ? "حرج" : item.severity === "error" ? "عالٍ" : item.severity === "warning" ? "متوسط" : "منخفض"}</span></td><td>${escapeHtml(securityTime(item.occurredAt))}</td><td><span class="security-event-status">${escapeHtml(item.status || "مسجل")}</span></td><td>${escapeHtml(item.detail || "-")}</td></tr>`).join("")}</tbody></table></div>`;
}

function legacySecurityPage() {
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
            ${securityMetricCard("صحة واتساب", { ...whatsapp, score: whatsapp.healthScore }, "whatsapp", "الاتصال والرسائل والـQueue")}
            ${securityMetricCard("أمان الإرسال", sending, "send", "الفاصل والحدود والإيقاف الوقائي")}
            ${securityMetricCard("الخطر الحالي", currentRisk, "warning", `${Number(currentRisk.issues || 0)} أحداث تحتاج المراجعة`, true)}
          </div>
        </section>
        <section class="security-center-middle">
          <article class="card security-policy-card"><div class="security-panel-title">${dashboardIcon("security")}<div><h2>مركز حماية الحساب</h2><p>تحكم في وسائل حماية حسابك، جلسات الدخول والتنبيهات الأمنية.</p></div></div></article>
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

function securityTrustLabel(level) {
  return level === "trusted" ? "موثوق" : level === "new" ? "جديد" : "يحتاج مراجعة";
}

function securitySeverityLabel(level) {
  return ({ info: "معلومة", low: "منخفض", medium: "متوسط", high: "عالٍ", critical: "حرج" })[level] || "منخفض";
}

function securityPage() {
  if (state.securityScore === null) {
    return dashboardShell(`<div class="security-dashboard-page">${pageTitle("الحماية والأمان")}<div class="security-page-skeleton" aria-label="جاري التحقق">${Array.from({ length: 4 }, () => `<span></span>`).join("")}</div></div>`);
  }
  const score = state.securityScore?.overall ? state.securityScore : null;
  if (state.securityScore?.error || !score) {
    return dashboardShell(`<div class="security-dashboard-page">${pageTitle("الحماية والأمان")}${emptyState("تعذر التحقق من الحماية", "حافظنا على آخر حالة صحيحة ولم نعرض أرقامًا افتراضية. أعد الفحص لاسترجاع البيانات الفعلية.", "إعادة الفحص", "recalculate-security")}</div>`);
  }

  const overall = score.overall || { score: null, label: "البيانات غير مكتملة", confidence: "low" };
  const safeSending = score.safeSending || { available: false, successRate: null, successful: 0, comparison: null, periodDays: 30 };
  const blocked = score.blockedAttempts || { total: 0, periodDays: 7 };
  const alertSummary = score.alertSummary || { openCount: 0, highestSeverity: null };
  const sessions = score.sessions || { activeSessions: 0, items: [] };
  const protection = score.accountProtection || { otpStatus: "disabled", activeSessions: 0, openAlerts: 0, encryption: { status: "unavailable" }, unusualActivityMonitoring: { status: "automatic" } };
  const sessionItems = Array.isArray(sessions.items) ? sessions.items.slice(0, 5) : [];
  const alerts = (Array.isArray(score.securityAlerts) ? score.securityAlerts : []).filter((item) => item?.title).slice(0, 5);
  const overallAvailable = overall.score !== null && overall.score !== undefined && overall.status === "available";
  const otpState = protection.otpStatus === "enabled" ? { label: "مفعّل ومحمي", tone: "success", action: "إدارة OTP" } : protection.otpStatus === "pending" ? { label: "الإعداد غير مكتمل", tone: "warning", action: "إكمال التفعيل" } : { label: "غير مفعّل", tone: "warning", action: "تفعيل دخول OTP" };
  const sendingComparison = safeSending.comparison === null || safeSending.comparison === undefined ? "لا تتوفر مقارنة سابقة" : safeSending.comparison > 0 ? `تحسن ${safeSending.comparison}% عن الفترة السابقة` : safeSending.comparison < 0 ? `انخفاض ${Math.abs(safeSending.comparison)}% عن الفترة السابقة` : "مستقر مقارنة بالفترة السابقة";

  return dashboardShell(`<div class="security-dashboard-page">${pageTitle("الحماية والأمان")}
    <section class="security-summary-grid" aria-label="ملخص الحماية">
      <article class="card security-summary-card"><div class="security-summary-heading"><span class="security-summary-icon">${dashboardIcon("security")}</span><span>مؤشر الحماية العام</span></div><strong class="security-summary-value">${overallAvailable ? `${Number(overall.score)}%` : "—"}</strong><span class="security-status-badge ${overallAvailable ? securityScoreTone(overall.score) : "neutral"}">${overallAvailable ? escapeHtml(overall.label) : "البيانات غير مكتملة"}</span>${overallAvailable ? `<div class="security-summary-progress"><span style="width:${Number(overall.score)}%"></span></div>` : ""}<small>${overallAvailable ? escapeHtml((score.negativeSignals || [])[0] || "يعتمد على حماية الحساب والجلسات والمنصة.") : `الثقة في النتيجة: ${overall.confidence === "medium" ? "متوسطة" : "منخفضة"}`}</small></article>
      <article class="card security-summary-card"><div class="security-summary-heading"><span class="security-summary-icon">${dashboardIcon("send")}</span><span>عمليات الإرسال الآمنة</span></div>${safeSending.available ? `<strong class="security-summary-value">${Number(safeSending.successRate)}%</strong><span class="security-summary-caption">${Number(safeSending.successful)} رسالة ناجحة خلال ${Number(safeSending.periodDays)} يومًا</span><small>${escapeHtml(sendingComparison)}</small>` : `<strong class="security-summary-empty">لا توجد بيانات إرسال بعد</strong><small>سيظهر المؤشر بعد تنفيذ أول عملية إرسال فعلية.</small>`}</article>
      <article class="card security-summary-card"><div class="security-summary-heading"><span class="security-summary-icon">${dashboardIcon("warning")}</span><span>محاولات تم منعها</span></div><strong class="security-summary-value">${Number(blocked.total || 0)}</strong><span class="security-summary-caption">خلال آخر ${Number(blocked.periodDays || 7)} أيام</span><small>دخول مرفوض وطلبات API وتكرار وتجاوز حدود.</small></article>
      <article class="card security-summary-card"><div class="security-summary-heading"><span class="security-summary-icon">${dashboardIcon("notifications")}</span><span>تنبيهات تحتاج متابعة</span></div>${Number(alertSummary.openCount || 0) ? `<strong class="security-summary-value">${Number(alertSummary.openCount)}</strong><span class="security-status-badge ${escapeHtml(alertSummary.highestSeverity || "medium")}">${escapeHtml(securitySeverityLabel(alertSummary.highestSeverity))}</span><button class="security-summary-action" data-action="security-alerts">عرض التنبيهات</button>` : `<strong class="security-summary-empty">لا توجد تنبيهات مفتوحة</strong><button class="security-summary-action" data-action="security-alerts">عرض التنبيهات</button>`}</article>
    </section>

    <section class="security-main-grid">
      <article class="card security-main-card security-smart-center"><div class="security-main-heading"><span class="security-main-icon">${dashboardIcon("security")}</span><div><h2>مركز الحماية الذكي</h2><p>إعدادات وإجراءات لحماية حسابك وبيانات منصتك.</p></div></div><div class="security-protection-list">
        <div><span>${dashboardIcon("security")}</span><div><strong>دخول الحساب OTP</strong><small>اطلب رمزًا مؤقتًا عند تسجيل الدخول لحماية حسابك من الوصول غير المصرح.</small></div><em class="${otpState.tone}">${otpState.label}</em><button data-link="/dashboard/settings?section=security">${otpState.action}</button></div>
        <div><span>${dashboardIcon("devices")}</span><div><strong>حماية الجلسات</strong><small>${Number(protection.activeSessions || 0)} جلسة نشطة تخضع للانتهاء والإبطال الآمن.</small></div><em class="success">يعمل تلقائيًا</em><button data-action="manage-sessions">إدارة الجلسات</button></div>
        <div><span>${dashboardIcon("security")}</span><div><strong>تشفير البيانات الحساسة</strong><small>تُحمى أسرار الدخول على الخادم ولا تظهر بعد اكتمال الإعداد.</small></div><em class="${protection.encryption?.status === "automatic" ? "success" : "neutral"}">${protection.encryption?.status === "automatic" ? "يعمل تلقائيًا" : "غير متاح"}</em><button data-link="/dashboard/settings?section=security">عرض الإعدادات</button></div>
        <div><span>${dashboardIcon("reports")}</span><div><strong>مراقبة الأنشطة غير المعتادة</strong><small>مراجعة مستمرة للجلسات ومحاولات الدخول والتنبيهات المهمة.</small></div><em class="success">يعمل تلقائيًا</em><button data-action="security-alerts">عرض النشاط</button></div>
      </div></article>

      <article class="card security-main-card"><div class="security-main-heading"><span class="security-main-icon">${dashboardIcon("devices")}</span><div><h2>جلسات الدخول الأخيرة</h2><p>آخر خمس جلسات مرتبطة بحسابك.</p></div></div><div class="security-session-list">${sessionItems.length ? sessionItems.map((item) => `<div><span class="security-session-device">${dashboardIcon("devices")}</span><div><strong>${escapeHtml(`${item.browser || "متصفح"} · ${item.system || "نظام غير معروف"}`)}</strong><small>${escapeHtml(item.device || "جهاز غير معروف")} · ${escapeHtml(item.location || item.maskedIp || "موقع غير متاح")}</small></div><div class="security-session-state">${item.current ? `<b>الجلسة الحالية</b>` : `<b class="${escapeHtml(item.trustLevel || "review")}">${escapeHtml(securityTrustLabel(item.trustLevel))}</b>`}<time>${escapeHtml(securityTime(item.lastActivityAt))}</time></div></div>`).join("") : `<div class="security-empty-row">لا توجد بيانات جلسات متاحة.</div>`}</div><button class="security-main-link" data-action="manage-sessions">عرض جميع الجلسات</button></article>

      <article class="card security-main-card"><div class="security-main-heading"><span class="security-main-icon">${dashboardIcon("notifications")}</span><div><h2>أحدث التنبيهات الأمنية</h2><p>أحدث الأحداث التي تستحق المراجعة.</p></div></div><div class="security-latest-alerts">${alerts.length ? alerts.map((item) => `<div><span class="security-alert-level ${escapeHtml(item.severity || "low")}">${escapeHtml(securitySeverityLabel(item.severity))}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.message || item.detail || "راجع تفاصيل الحدث الأمني.")}</small></div><time>${escapeHtml(securityTime(item.timestamp || item.occurredAt))}</time></div>`).join("") : `<div class="security-empty-row">لا توجد تنبيهات مفتوحة.</div>`}</div><button class="security-main-link" data-action="security-alerts">عرض جميع التنبيهات</button></article>
    </section>

    <section class="card security-footer-banner"><div><h2>حماية حسابك أولوية</h2><p>تعمل أنظمة Renvix على مراقبة حسابك وعمليات الإرسال باستمرار، وسنبلغك عند وجود إجراء يتطلب تدخلك.</p></div><button class="btn btn-secondary" data-link="/dashboard/settings?section=security">مركز الأمان</button></section>
    <span class="security-data-count" aria-hidden="true">${alerts.length}</span></div>`);
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

function deviceStatusView(device) {
  if (device.requiresAttention || device.status === "error") return { key: "needs_attention", label: "يحتاج مراجعة", tone: "warning" };
  if (["pending", "pending_qr", "pending_pairing", "connecting", "pending_setup"].includes(device.status)) return { key: "syncing", label: "قيد المزامنة", tone: "syncing" };
  if (device.status === "connected") return { key: "connected", label: "متصل", tone: "connected" };
  return { key: "disconnected", label: "غير متصل", tone: "disconnected" };
}

function deviceRelativeTime(value) {
  const time = new Date(value || 0).getTime();
  if (!Number.isFinite(time) || time <= 0) return "لم تتم بعد";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes.toLocaleString("ar-SA")} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `منذ ${hours.toLocaleString("ar-SA")} ساعة`;
  return new Date(time).toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
}

function deviceProviderLabel(provider) {
  return ["meta", "meta_cloud", "meta_cloud_api"].includes(String(provider || "").toLowerCase()) ? "واتساب الرسمي · Meta" : "قناة غير متاحة للمستخدم";
}

function deviceActivityPresentation(item) {
  const type = String(item?.type || "");
  const mapped = type.includes("failed") || type.includes("disconnect")
    ? { tone: "error", icon: "notifications", title: "تعذر اتصال الجهاز" }
    : type.includes("pending") || type.includes("created")
      ? { tone: "warning", icon: "info", title: "الجهاز يحتاج متابعة" }
      : type.includes("connected") || type.includes("succeeded")
        ? { tone: "success", icon: "security", title: "تم تحديث اتصال الجهاز بنجاح" }
        : { tone: "info", icon: "orderLink", title: "تم تحديث إعدادات الربط" };
  return { ...mapped, title: /[\u0600-\u06FF]/.test(String(item?.title || "")) ? item.title : mapped.title };
}

function devicesWorkspacePage() {
  const payload = { ...defaultLinkedDevice, ...state.linkedDevice };
  const fallbackDevice = payload.id ? [payload] : [];
  const devices = Array.isArray(payload.devices) ? payload.devices : fallbackDevice;
  const search = String(state.deviceSearch || "").trim().toLocaleLowerCase("ar");
  const filter = state.deviceStatusFilter || "all";
  const visibleDevices = devices.filter((item) => {
    const statusInfo = deviceStatusView(item);
    const haystack = `${item.deviceName || ""} ${item.displayName || ""} ${item.phoneNumber || ""} ${deviceProviderLabel(item.provider)}`.toLocaleLowerCase("ar");
    return (!search || haystack.includes(search)) && (filter === "all" || statusInfo.key === filter);
  });
  const total = devices.length;
  const active = devices.filter((item) => deviceStatusView(item).key === "connected").length;
  const syncing = devices.filter((item) => deviceStatusView(item).key === "syncing").length;
  const attention = devices.filter((item) => ["needs_attention", "disconnected"].includes(deviceStatusView(item).key)).length;
  const stabilityScore = total ? Math.round(((active + syncing * 0.5) / total) * 100) : 0;
  const stabilityLabel = !total ? "غير متاح" : stabilityScore >= 90 ? "ممتاز" : stabilityScore >= 70 ? "جيد" : stabilityScore >= 50 ? "متوسط" : "يحتاج متابعة";
  const activity = Array.isArray(payload.activity) ? payload.activity : [];
  const activityLimit = state.deviceActivityExpanded ? 20 : 5;
  const metaDevices = devices.filter((item) => ["meta", "meta_cloud", "meta_cloud_api"].includes(String(item.provider || "").toLowerCase()));
  const metaConnected = metaDevices.some((item) => item.status === "connected");
  const hasOfficialNumber = metaDevices.some((item) => Boolean(item.phoneNumber));
  const metaConfigured = Boolean(window.__RENVIX_CONFIG__?.metaWhatsAppEnabled);
  const hasOnlineDevice = active > 0;
  const hasConnectionTest = devices.some((item) => Boolean(item.lastHealthCheckAt));
  const readiness = [
    ["حساب Meta Business متصل", metaDevices.length > 0, metaDevices.length ? "مكتمل" : "غير مكتمل"],
    ["رقم واتساب رسمي معتمد", hasOfficialNumber, hasOfficialNumber ? "مكتمل" : "غير مكتمل"],
    ["صلاحيات API مفعلة", metaConfigured && metaDevices.length > 0, metaConfigured ? "مكتمل" : "يحتاج متابعة"],
    ["Webhook مكوّن بشكل صحيح", metaConnected, metaConnected ? "مكتمل" : "يحتاج متابعة"],
    ["جهاز نشط ومشغّل", hasOnlineDevice, hasOnlineDevice ? "مكتمل" : "غير مكتمل"],
    ["اختبار الاتصال ناجح", hasConnectionTest && hasOnlineDevice, hasConnectionTest && hasOnlineDevice ? "مكتمل" : "يحتاج متابعة"]
  ];
  const lastSuccessfulSync = devices.filter((item) => item.lastHealthCheckAt).sort((a, b) => new Date(b.lastHealthCheckAt) - new Date(a.lastHealthCheckAt))[0]?.lastHealthCheckAt;
  const rows = visibleDevices.map((item) => {
    const statusInfo = deviceStatusView(item);
    const displayName = item.deviceName || item.displayName || "جهاز واتساب";
    const account = item.displayName || item.phoneNumber || "حساب غير مسمى";
    const iconName = /windows|mac|desktop|workstation|laptop/i.test(displayName) ? "reports" : "devices";
    return `<tr>
      <td><div class="devices-device-name"><span>${dashboardIcon(iconName)}</span><div><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(deviceProviderLabel(item.provider))}${item.isPrimary ? " · رئيسي" : ""}</small></div></div></td>
      <td><div class="devices-account"><strong>${escapeHtml(account)}</strong><small>${escapeHtml(item.phoneNumber || deviceProviderLabel(item.provider))}</small></div></td>
      <td><span class="device-state ${statusInfo.tone}"><i></i>${statusInfo.label}</span></td>
      <td><span class="devices-sync-time">${escapeHtml(deviceRelativeTime(item.lastHealthCheckAt || item.updatedAt))}</span></td>
      <td><div class="devices-row-actions"><button type="button" data-action="device-details" data-id="${item.id}">التفاصيل</button><button type="button" data-action="device-resync" data-id="${item.id}" aria-label="إعادة مزامنة ${escapeHtml(displayName)}">${dashboardIcon("reports")}</button><button type="button" data-action="device-details" data-id="${item.id}" aria-label="المزيد">•••</button></div></td>
    </tr>`;
  }).join("");

  return dashboardShell(`<section class="devices-command-page">
    <header class="devices-command-header"><div class="devices-command-title"><span>${dashboardIcon("devices")}</span><div><h1>الأجهزة</h1><p>إدارة أجهزتك المتصلة بمنصتك، والتحقق من حالة الاتصال ومزامنة البيانات.</p></div></div><div class="devices-header-actions"><button class="btn btn-primary" data-action="connect-meta-whatsapp">${dashboardIcon("orderLink")} ربط جهاز جديد <b>+</b></button><button class="btn btn-secondary" data-action="device-sync-all" ${!total || state.deviceBulkSyncing ? "disabled" : ""}>${dashboardIcon("reports")} ${state.deviceBulkSyncing ? "جاري المزامنة..." : "مزامنة الحالة"}</button><button class="btn btn-secondary" data-action="device-connection-test" ${!total ? "disabled" : ""}>${dashboardIcon("security")} فحص الاتصال</button></div></header>
    <section class="devices-overview-grid">
      <article class="devices-overview-card info"><span>${dashboardIcon("devices")}</span><div><small>إجمالي الأجهزة</small><strong>${total.toLocaleString("ar-SA")}</strong><em>مرتبطة بحسابك</em></div></article>
      <article class="devices-overview-card active"><span>${dashboardIcon("reports")}</span><div><small>الأجهزة النشطة</small><strong>${active.toLocaleString("ar-SA")}</strong><em>من أصل ${total.toLocaleString("ar-SA")} جهاز</em></div></article>
      <article class="devices-overview-card attention"><span>${dashboardIcon("notifications")}</span><div><small>أجهزة تحتاج اهتمام</small><strong>${attention.toLocaleString("ar-SA")}</strong><em>${attention ? "تحتاج مراجعة" : "لا توجد تنبيهات"}</em></div></article>
      <article class="devices-overview-card stability"><span>${dashboardIcon("security")}</span><div><small>مستوى الاستقرار</small><strong>${stabilityLabel}</strong><em>${total ? `${stabilityScore.toLocaleString("ar-SA")}% خلال آخر 24 ساعة` : "اربط جهازًا لبدء القياس"}</em></div></article>
    </section>
    <section class="devices-command-layout">
      <aside class="devices-command-side">
        <article class="card devices-readiness-card"><div class="devices-card-heading"><span>${dashboardIcon("orderLink")}</span><div><h2>جاهزية الربط</h2><p>تحقق من جاهزية الإعدادات للربط والاستقبال.</p></div></div><div class="devices-readiness-list">${readiness.map(([label, complete, value]) => `<div class="${complete ? "complete" : "pending"}"><span>${complete ? "✓" : ""}</span><strong>${label}</strong><em>${value}</em></div>`).join("")}</div><button class="devices-card-link" data-link="/dashboard/apps">${dashboardIcon("settings")} إدارة الإعدادات <b>‹</b></button></article>
        <article class="card devices-important-card"><div class="devices-card-heading"><span>${dashboardIcon("info")}</span><div><h2>معلومات مهمة</h2></div></div><ul><li>تأكد من بقاء الجهاز متصلًا بالإنترنت.</li><li>تجنب تسجيل الخروج من حساب واتساب الأعمال.</li><li>عند حدوث مشاكل، أعد مزامنة الجهاز أو اختبر الاتصال.</li><li>سيتم إشعارك في حال انقطاع أي جهاز.</li></ul><button class="devices-card-link" data-link="/support">${dashboardIcon("helpBook")} قراءة المزيد من التعليمات <b>‹</b></button></article>
      </aside>
      <div class="devices-command-main">
        <article class="card devices-table-card-v2"><div class="devices-card-heading devices-table-heading"><span>${dashboardIcon("devices")}</span><div><h2>إدارة الأجهزة المتصلة</h2><p>قائمة بجميع الأجهزة المرتبطة بحسابك وحالة اتصالها.</p></div></div><div class="devices-table-tools"><label>${dashboardIcon("reports")}<input value="${escapeHtml(state.deviceSearch || "")}" data-action="device-search" placeholder="ابحث عن جهاز..."></label><label class="devices-filter-control">${dashboardIcon("settings")}<select data-action="device-status-filter"><option value="all" ${filter === "all" ? "selected" : ""}>تصفية: الكل</option><option value="connected" ${filter === "connected" ? "selected" : ""}>متصل</option><option value="syncing" ${filter === "syncing" ? "selected" : ""}>قيد المزامنة</option><option value="disconnected" ${filter === "disconnected" ? "selected" : ""}>غير متصل</option><option value="needs_attention" ${filter === "needs_attention" ? "selected" : ""}>يحتاج مراجعة</option></select></label></div><div class="devices-table-scroll"><table><thead><tr><th>اسم الجهاز</th><th>الحساب / القناة</th><th>حالة الاتصال</th><th>آخر مزامنة</th><th>الإجراءات</th></tr></thead><tbody>${rows || `<tr><td colspan="5"><div class="devices-empty-state">${dashboardIcon("devices")}<strong>${devices.length ? "لا توجد أجهزة مطابقة" : "لا توجد أجهزة مرتبطة حتى الآن"}</strong><p>${devices.length ? "غيّر البحث أو عامل التصفية." : "اربط أول جهاز لتظهر حالته وسجل نشاطه هنا."}</p></div></td></tr>`}</tbody></table></div><footer class="devices-table-summary">${dashboardIcon("info")}<span>إجمالي الأجهزة المتصلة الآن: <strong>${active.toLocaleString("ar-SA")} من أصل ${total.toLocaleString("ar-SA")} جهاز</strong>${lastSuccessfulSync ? ` · آخر مزامنة ناجحة: <strong>${escapeHtml(deviceRelativeTime(lastSuccessfulSync))}</strong>` : ""}</span></footer></article>
        <article class="card devices-activity-card"><div class="devices-card-heading"><span>${dashboardIcon("template")}</span><div><h2>سجل النشاط الأخير</h2><p>آخر العمليات المرتبطة بأجهزتك.</p></div></div><div class="devices-activity-list">${activity.length ? activity.slice(0, activityLimit).map((item) => { const presentation = deviceActivityPresentation(item); return `<div class="${presentation.tone}"><span>${dashboardIcon(presentation.icon)}</span><div><strong>${escapeHtml(presentation.title)}</strong><small>${escapeHtml(item.deviceName || "تحديث على إعدادات الربط")}</small></div><time>${escapeHtml(deviceRelativeTime(item.createdAt))}</time></div>`; }).join("") : `<div class="devices-empty-activity">${dashboardIcon("template")}<strong>لا يوجد نشاط مسجل بعد</strong><p>ستظهر عمليات الربط والمزامنة وفحص الاتصال هنا.</p></div>`}</div>${activity.length > 5 ? `<button class="devices-card-link devices-activity-more" data-action="device-activity-toggle">${state.deviceActivityExpanded ? "عرض الأحدث فقط" : "عرض جميع السجلات"} <b>‹</b></button>` : ""}</article>
      </div>
    </section>
  </section>`);
}

const localDefaultEmailTemplate = {
  name: "تذكير بتجديد الاشتراك",
  channel: "email",
  storeName: "",
  title: "تذكير بتجديد اشتراكك في {{اسم_الخدمة}}",
  themeColor: "#0EA5A8",
  body: "مرحبًا {{اسم_العميل}}،\n\nنود تذكيرك بأن اشتراكك في {{اسم_الخدمة}} سينتهي بتاريخ {{تاريخ_الانتهاء}}.\n\nلضمان استمرار الخدمة دون انقطاع، يرجى تجديد اشتراكك الآن.",
  buttonLabel: "جدد اشتراكك الآن",
  footerText: "شكرًا لثقتك بنا"
};

function safeEmailTheme(value) {
  return /^#[0-9A-F]{6}$/i.test(String(value || "")) ? String(value).toUpperCase() : "#0EA5A8";
}

function templatePreviewValue(value) {
  return String(value || "");
}

function safeStoreLogoUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeStoreLogoRadius(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(50, Math.max(0, Math.round(parsed))) : 16;
}

function storeLogoImage(value, className = "store-logo-image", alt = "صورة المتجر", radius = 16) {
  const url = safeStoreLogoUrl(value);
  return url ? `<img class="${className}" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" style="--store-logo-radius:${safeStoreLogoRadius(radius)}px">` : dashboardIcon("orderLink");
}

function storeLogoEditor(value, radius = 16) {
  const url = safeStoreLogoUrl(value);
  const safeRadius = safeStoreLogoRadius(radius);
  return `<section class="store-logo-editor">
    <span class="store-logo-editor-preview ${url ? "has-image" : ""}">${storeLogoImage(url, "store-logo-image", "صورة المتجر", safeRadius)}</span>
    <div class="store-logo-editor-content"><strong>صورة المتجر</strong><small>تظهر في قالب البريد وصفحة معلومات الطلب.</small><div class="inline-actions"><input type="file" accept="image/png,image/jpeg,image/webp" data-action="store-logo-file" hidden><button type="button" class="btn btn-secondary" data-action="choose-store-logo">${dashboardIcon("upload")} ${url ? "استبدال الصورة" : "رفع صورة"}</button>${url ? `<button type="button" class="btn btn-ghost danger-text" data-action="remove-store-logo">حذف الصورة</button>` : ""}</div><em>PNG أو JPG أو WebP، بحد أقصى 2 ميجابايت.</em>${url ? `<label class="store-logo-radius-control"><span>حواف الصورة <output data-logo-radius-output>${safeRadius}px</output></span><input type="range" min="0" max="50" step="1" value="${safeRadius}" name="logoBorderRadius" data-order-field="logoBorderRadius" aria-label="ضبط حواف صورة المتجر"><small>اسحب للتحكم من حواف مستقيمة إلى دائرية.</small></label>` : ""}</div>
  </section>`;
}

function emailTemplatePreview(template) {
  const theme = safeEmailTheme(template.themeColor);
  const storeName = templatePreviewValue(template.storeName || "{{اسم_المتجر}}");
  const subject = templatePreviewValue(template.title || localDefaultEmailTemplate.title);
  const content = templatePreviewValue(template.body || localDefaultEmailTemplate.body);
  const buttonLabel = templatePreviewValue(template.buttonLabel || localDefaultEmailTemplate.buttonLabel);
  const footerText = templatePreviewValue(template.footerText || localDefaultEmailTemplate.footerText);
  const storeLogoUrl = safeStoreLogoUrl(template.storeImageUrl || state.orderLinkProfile?.logoUrl);
  const storeLogoRadius = safeStoreLogoRadius(template.logoBorderRadius ?? state.orderLinkProfile?.logoBorderRadius);
  const paragraphs = content.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean).map((item) => `<p>${escapeHtml(item).replaceAll("\n", "<br>")}</p>`).join("");
  return `<div class="email-envelope" style="--email-theme:${theme}">
    <div class="email-preview-brand"><span class="email-store-icon ${storeLogoUrl ? "has-store-logo" : ""}">${storeLogoImage(storeLogoUrl, "email-store-logo", storeName, storeLogoRadius)}</span><strong>${escapeHtml(storeName)}</strong><small>حلول رقمية متكاملة</small></div>
    <div class="email-preview-body"><h3>${escapeHtml(subject)}</h3>${paragraphs}<a href="#" tabindex="-1">${escapeHtml(buttonLabel)}</a><div class="email-trust-note">${dashboardIcon("security")} بياناتك محمية وتُستخدم لاستمرارية الخدمة والدعم الكامل.</div><p class="email-thanks">${escapeHtml(footerText)} ♥</p></div>
    <div class="email-preview-footer">© ${new Date().getFullYear()} ${escapeHtml(storeName)}. جميع الحقوق محفوظة.</div>
  </div>`;
}

function readEmailTemplateForm(form = document.querySelector("form[data-submit='renewal-template']")) {
  if (!form) return { ...localDefaultEmailTemplate };
  const data = Object.fromEntries(new FormData(form));
  return {
    name: data.name || "",
    channel: "email",
    storeName: data.storeName || document.querySelector("[data-email-field][name='storeName']")?.value || "",
    storeImageUrl: state.orderLinkProfile?.logoUrl || "",
    logoBorderRadius: safeStoreLogoRadius(state.orderLinkDraft.logoBorderRadius ?? state.orderLinkProfile?.logoBorderRadius),
    title: data.title || document.querySelector("[data-email-field][name='title']")?.value || "",
    themeColor: safeEmailTheme(data.themeColor || state.emailThemeColor),
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

function templateCatalogItems() {
  const definitions = {
    renewal_whatsapp: { channel: "whatsapp", name: "قالب رسالة التجديد - واتساب", description: "قالب لإشعار العميل بانتهاء اشتراكه وتشجيعه على التجديد عبر واتساب." }
  };
  const templates = Array.isArray(state.catalogTemplates) ? state.catalogTemplates : [];
  const catalogItems = Object.entries(definitions).map(([key, definition]) => {
    const item = templates.find((template) => template.templateKey === key);
    return item ? {
      ...item,
      key,
      kind: "catalog",
      channel: definition.channel,
      name: definition.name,
      description: definition.description,
      templateVersion: item.templateVersion || 1
    } : null;
  }).filter(Boolean);
  const renewalTemplates = Array.isArray(state.notificationTemplate?.templates) ? state.notificationTemplate.templates : [];
  const renewalEmail = renewalTemplates.find((template) => template.channel === "email");
  if (renewalEmail) {
    catalogItems.push({
      ...renewalEmail,
      key: "renewal_email",
      kind: "renewal",
      channel: "email",
      name: "قالب رسالة التجديد - البريد الإلكتروني",
      description: "قالب بريد احترافي لتذكير العميل بالتجديد مع هوية وصورة المتجر.",
      templateVersion: renewalEmail.templateVersion || 1
    });
  }
  return catalogItems;
}

function templateChannelLabel(channel) {
  if (channel === "whatsapp") return "واتساب";
  if (channel === "email") return "البريد الإلكتروني";
  if (channel === "salla") return "سلة";
  return "القناة";
}

function templateCatalogIcon(item) {
  if (item.channel === "salla") return `<span class="template-brand-icon salla"><img src="/assets/salla-logo.svg" alt="سلة"></span>`;
  return `<span class="template-brand-icon ${item.channel}">${dashboardIcon(item.channel === "whatsapp" ? "whatsapp" : "template")}</span>`;
}

function metaTemplateStatusLabel(value) {
  return {
    draft: "مسودة",
    submitting: "جارٍ الإرسال",
    pending: "قيد المراجعة",
    approved: "معتمد",
    rejected: "مرفوض",
    paused: "موقوف",
    disabled: "معطل",
    pending_deletion: "قيد الحذف",
    deleted: "محذوف",
    unknown: "حالة غير معروفة",
    error: "خطأ في الإرسال"
  }[String(value || "")] || "غير معروف";
}

function metaTemplateStatusTone(value) {
  if (value === "approved") return "active";
  if (["rejected", "error", "disabled", "deleted"].includes(value)) return "expired";
  if (["pending", "submitting", "paused", "pending_deletion"].includes(value)) return "pending";
  return "neutral";
}

function metaApprovedTemplatesSection() {
  const payload = state.metaTemplates;
  const loading = payload === null;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const integrations = Array.isArray(payload?.integrations) ? payload.integrations : [];
  const rows = items.map((item) => `<article class="meta-template-row">
    <span class="template-brand-icon whatsapp">${dashboardIcon("whatsapp")}</span>
    <div><div class="template-row-heading"><h3>${escapeHtml(item.name)}</h3><span class="channel-pill whatsapp">${escapeHtml(item.language)}</span></div>
      <p>${item.category === "MARKETING" ? "تسويقية" : item.category === "AUTHENTICATION" ? "مصادقة" : "خدمية"} · ${escapeHtml(item.channelName || item.phoneNumber || "قناة Meta")}</p>
      ${item.rejectionReason ? `<small class="meta-rejection">${escapeHtml(item.rejectionReason)}</small>` : ""}
    </div>
    <span class="status ${metaTemplateStatusTone(item.status)}">${metaTemplateStatusLabel(item.status)}</span>
    <div class="template-row-actions">
      ${["draft", "rejected", "error"].includes(item.status) ? `<button class="btn btn-primary" data-action="meta-template-submit" data-id="${item.id}">${dashboardIcon("send")} إرسال إلى Meta</button>` : ""}
    </div>
  </article>`).join("");
  return `<section class="card meta-template-section">
    <div class="section-head"><div><h2>قوالب واتساب المعتمدة</h2><p>مسودات مستقلة تُرسل من الخادم إلى Meta للمراجعة، ولا تصبح معتمدة إلا من Webhook أو المزامنة الفعلية.</p></div>
      <div class="inline-actions"><button class="btn btn-secondary" data-action="meta-template-sync" ${integrations.some((item) => item.status === "connected" && item.wabaId) ? "" : "disabled"}>${dashboardIcon("refresh")} مزامنة مع Meta</button><button class="btn btn-primary" data-action="meta-template-create">${dashboardIcon("template")} إنشاء قالب</button></div>
    </div>
    ${loading ? `<div class="loading-state">جارٍ تحميل قوالب Meta...</div>` : rows ? `<div class="meta-template-list">${rows}</div>` : `<div class="template-catalog-empty">${dashboardIcon("whatsapp")}<strong>لا توجد قوالب Meta محفوظة</strong><p>${integrations.length ? "أنشئ مسودة ثم أرسلها إلى Meta للمراجعة." : "اربط حساب واتساب رسميًا عبر Meta Cloud API قبل إنشاء قالب معتمد."}</p></div>`}
  </section>`;
}

function generalTemplateCard(item) {
  const isMeta = item.kind === "meta";
  const editTarget = isMeta
    ? `/dashboard/templates?metaTemplateId=${encodeURIComponent(item.id)}`
    : `/dashboard/templates?edit=${encodeURIComponent(item.key)}`;
  const updatedAt = isMeta ? item.lastSyncedAt || item.updatedAt : item.updatedAt;
  const updated = updatedAt ? new Date(updatedAt).toLocaleDateString("ar-SA") : "لم يتم التحديث بعد";
  const channel = isMeta ? "whatsapp" : item.channel;
  const title = isMeta ? (item.displayName || "قالب واتساب المعتمد") : item.name;
  const description = isMeta
    ? "قالب رسمي معتمد من واتساب للإرسال عبر المنصة وفق سياسات Meta."
    : item.description;
  const approvedBadge = isMeta && item.status === "approved"
    ? `<span class="channel-pill approved">${dashboardIcon("security")} معتمد</span>`
    : "";
  const metaStatus = isMeta ? `<span class="status ${metaTemplateStatusTone(item.status)}">${metaTemplateStatusLabel(item.status)}</span>` : status(item.isActive ? "active" : "paused");
  const activityLabel = isMeta
    ? `آخر مزامنة: ${escapeHtml(updated)}`
    : `استخدام فعلي: ${Number(item.usageCount || 0).toLocaleString("ar-SA")}`;
  return `<article class="general-template-card">
    <div class="general-template-main">
      <span class="template-brand-icon ${channel}">${dashboardIcon(isMeta ? "security" : channel === "whatsapp" ? "whatsapp" : "template")}</span>
      <div class="general-template-copy">
        <div class="template-card-title-row"><h2>${escapeHtml(title)}</h2><span class="channel-pill ${channel}">${templateChannelLabel(channel)}</span>${approvedBadge}</div>
        <p>${escapeHtml(description)}</p>
        <div class="general-template-state">${metaStatus}</div>
      </div>
    </div>
    <div class="general-template-actions">
      <button class="btn btn-secondary" data-link="${editTarget}">${dashboardIcon("eye")} معاينة</button>
      <button class="btn btn-secondary" data-link="${editTarget}">${dashboardIcon("settings")} تحرير</button>
    </div>
    <div class="general-template-stats">
      <span>${dashboardIcon("calendar")}<small>آخر تحديث</small><strong>${escapeHtml(updated)}</strong></span>
      <span>${dashboardIcon("reports")}<small>${isMeta ? "حالة المزامنة" : "الاستخدام"}</small><strong>${activityLabel}</strong></span>
    </div>
  </article>`;
}

function metaTemplateEditorPage(template) {
  const backButton = `<button class="btn btn-secondary" data-link="/dashboard/templates">${dashboardIcon("arrow-left")} العودة إلى القوالب</button>`;
  if (!template) return dashboardShell(`${pageTitle("قالب واتساب المعتمد", backButton)}<div class="template-catalog-empty">${dashboardIcon("whatsapp")}<strong>القالب غير متاح</strong><p>زامن القوالب مع Meta ثم حاول مرة أخرى.</p></div>`);
  const components = Array.isArray(template.components) ? template.components : [];
  const body = components.find((component) => component.type === "BODY")?.text || "";
  const categoryLabel = template.category === "MARKETING" ? "تسويقي" : template.category === "AUTHENTICATION" ? "مصادقة" : "خدمي";
  const updated = template.lastSyncedAt ? new Date(template.lastSyncedAt).toLocaleString("ar-SA") : "لم تتم المزامنة بعد";
  const approved = template.status === "approved";
  return dashboardShell(`<div class="template-breadcrumb"><span>القوالب العامة</span><b>/</b><strong>قالب واتساب المعتمد</strong></div>
    ${pageTitle(template.displayName || "قالب واتساب المعتمد", backButton)}
    <p class="page-kicker">قالب مرتبط بحساب واتساب الرسمي، وتأتي حالته مباشرة من Meta.</p>
    <section class="meta-approved-editor">
      <article class="card meta-approved-form">
        <div class="section-head"><div><h2>${dashboardIcon("template")} معلومات القالب</h2><p>البيانات التقنية المعتمدة في WhatsApp Manager.</p></div>${approved ? `<span class="channel-pill approved">${dashboardIcon("security")} معتمد</span>` : `<span class="status ${metaTemplateStatusTone(template.status)}">${metaTemplateStatusLabel(template.status)}</span>`}</div>
        <div class="meta-approved-fields">
          <label class="field"><span>اسم القالب</span><input class="input" value="${escapeHtml(template.name)}" readonly></label>
          <label class="field"><span>الاسم الظاهر</span><input class="input" value="${escapeHtml(template.displayName || template.name)}" readonly></label>
          <label class="field"><span>الحالة</span><input class="input" value="${escapeHtml(metaTemplateStatusLabel(template.status))}" readonly></label>
          <label class="field"><span>التصنيف</span><input class="input" value="${escapeHtml(categoryLabel)}" readonly></label>
          <label class="field"><span>اللغة</span><input class="input" value="${escapeHtml(template.language === "ar" ? "العربية" : template.language)}" readonly></label>
          <label class="field"><span>تقييم الجودة</span><input class="input" value="${escapeHtml(template.qualityRating || "غير متاح من Meta")}" readonly></label>
        </div>
        <label class="field"><span>محتوى الرسالة</span><textarea class="textarea meta-approved-body" readonly>${escapeHtml(body)}</textarea></label>
        ${template.rejectionReason ? `<div class="inline-notice danger"><strong>سبب الرفض</strong><p>${escapeHtml(template.rejectionReason)}</p></div>` : ""}
        <div class="meta-approved-footer">
          <span>${dashboardIcon("refresh")} آخر مزامنة: ${escapeHtml(updated)}</span>
          <div class="inline-actions">
            ${["draft", "rejected", "error"].includes(template.status) ? `<button class="btn btn-primary" data-action="meta-template-submit" data-id="${template.id}">${dashboardIcon("send")} إرسال إلى Meta</button>` : ""}
            <button class="btn btn-secondary" data-action="meta-template-sync">${dashboardIcon("refresh")} مزامنة مع Meta</button>
            <button class="btn btn-danger-outline" data-action="meta-template-delete" data-id="${template.id}">${dashboardIcon("delete")} حذف القالب</button>
          </div>
        </div>
      </article>
      <aside class="card meta-approved-preview"><div class="section-head"><div><h2>معاينة القالب</h2><p>معاينة تقريبية لمحتوى رسالة واتساب.</p></div>${dashboardIcon("whatsapp")}</div><div class="meta-approved-message"><strong>${escapeHtml(template.displayName || template.name)}</strong><p>${escapeHtml(body).replaceAll("\n", "<br>")}</p><small>الحالة: ${escapeHtml(metaTemplateStatusLabel(template.status))}</small></div></aside>
    </section>`);
}

function templatesCatalogPage() {
  const editorKey = state.query.get("edit") || "";
  const metaTemplateId = state.query.get("metaTemplateId") || "";
  if (metaTemplateId) {
    const template = (Array.isArray(state.metaTemplates?.items) ? state.metaTemplates.items : []).find((item) => item.id === metaTemplateId);
    return metaTemplateEditorPage(template);
  }
  if (editorKey === "renewal_whatsapp") return renewalTemplateEditorPageV2("whatsapp");
  if (editorKey === "renewal_email") return renewalTemplateEditorPageV2("email");
  if (editorKey === "email_delivery") return catalogTemplateEditorPage(editorKey);

  const loading = state.catalogTemplates === null || state.metaTemplates === null;
  const templates = templateCatalogItems();
  const metaPayload = state.metaTemplates && !state.metaTemplates.error ? state.metaTemplates : {};
  const integrations = Array.isArray(metaPayload.integrations) ? metaPayload.integrations : [];
  const hasOfficialConnection = integrations.some((item) => item.status === "connected" && item.wabaId);
  const metaItems = Array.isArray(metaPayload.items) ? metaPayload.items : [];
  const preferredMeta = metaItems.find((item) => item.name === "subscription_renewal_reminder" && item.status === "approved")
    || metaItems.find((item) => item.status === "approved")
    || metaItems[0];
  const rows = [
    ...templates.map((item) => generalTemplateCard(item)),
    ...(hasOfficialConnection && preferredMeta ? [generalTemplateCard({ ...preferredMeta, kind: "meta" })] : [])
  ].join("");
  const metaNotice = hasOfficialConnection
    ? (preferredMeta ? "" : `<div class="general-template-notice">${dashboardIcon("whatsapp")}<div><strong>لا توجد قوالب واتساب في حساب Meta المرتبط حتى الآن.</strong><p>أنشئ القالب من WhatsApp Manager أو من Renvix ثم اضغط مزامنة مع Meta.</p></div><div class="inline-actions"><button class="btn btn-secondary" data-action="meta-template-sync">${dashboardIcon("refresh")} مزامنة مع Meta</button><button class="btn btn-primary" data-action="meta-template-create">${dashboardIcon("template")} إنشاء قالب</button></div></div>`)
    : `<div class="general-template-notice">${dashboardIcon("whatsapp")}<div><strong>قوالب واتساب المعتمدة غير متاحة بعد.</strong><p>اربط حساب واتساب الرسمي عبر Meta Cloud API قبل إنشاء أو مزامنة القوالب المعتمدة.</p></div></div>`;
  return dashboardShell(`${pageTitle("قوالب عامة", `<button class="btn btn-secondary" data-link="/dashboard">${dashboardIcon("arrow-left")} العودة إلى اللوحة</button>`)}
    <p class="page-kicker">قوالب ثابتة ولوحة المستخدم العامة التي يمكنك استخدامها في مراسلاتك عبر قنوات التواصل.</p>
    <section class="general-templates-list">
      ${loading ? `<div class="loading-state">جارٍ تحميل القوالب المحفوظة...</div>` : rows || `<div class="template-catalog-empty">${dashboardIcon("template")}<strong>لا توجد قوالب عامة حتى الآن</strong><p>أعد تحميل الصفحة بعد اكتمال تهيئة مساحة العمل.</p></div>`}
    </section>
    ${loading ? "" : metaNotice}`);
}

function templatesPage() {
  const editorKey = state.query.get("edit") || "";
  if (["renewal_whatsapp", "renewal_email"].includes(editorKey)) {
    return renewalTemplateEditorPage(editorKey.endsWith("email") ? "email" : "whatsapp");
  }
  const loading = state.notificationTemplate === null;
  const items = templateCatalogItems();
  const channel = state.templateCatalogChannel || "all";
  const search = String(state.templateCatalogSearch || "").trim().toLocaleLowerCase("ar");
  const filtered = items.filter((item) => (channel === "all" || item.channel === channel) && (!search || `${item.name} ${item.description}`.toLocaleLowerCase("ar").includes(search)));
  const total = items.length;
  const active = items.filter((item) => item.isActive).length;
  const inactive = total - active;
  const channelTabs = [["all", "الكل"], ["whatsapp", "واتساب"], ["email", "بريد إلكتروني"]];
  const rows = filtered.map((item) => {
    const editTarget = item.kind === "renewal" ? `/dashboard/templates?edit=${encodeURIComponent(item.key)}` : `/dashboard/order-links?templateId=${encodeURIComponent(item.id)}`;
    const updated = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("ar-SA") : "لم يُحدّث بعد";
    return `<article class="template-catalog-row">
      ${templateCatalogIcon(item)}
      <div class="template-catalog-copy"><div class="template-row-heading"><h2>${escapeHtml(item.name)}</h2><span class="channel-pill ${item.channel}">${templateChannelLabel(item.channel)}</span></div><p>${escapeHtml(item.description)}</p><div class="template-row-meta"><span>${status(item.isActive ? "active" : "paused")}</span><span>آخر تحديث: ${escapeHtml(updated)}</span>${item.kind === "order" ? `<span>${item.openedCount} فتح فعلي</span>` : `<span>الإصدار ${Number(item.templateVersion || 1)}</span>`}</div></div>
      <div class="template-row-actions"><button class="btn btn-secondary" data-link="${editTarget}">${dashboardIcon("eye")} معاينة</button><button class="btn btn-secondary" data-link="${editTarget}">${dashboardIcon("settings")} تحرير</button></div>
    </article>`;
  }).join("");
  const body = loading
    ? `<div class="loading-state">جارٍ تحميل القوالب المحفوظة...</div>`
    : rows || `<div class="template-catalog-empty">${dashboardIcon("template")}<strong>${items.length ? "لا توجد نتائج مطابقة" : "لا توجد قوالب محفوظة حتى الآن"}</strong><p>${items.length ? "غيّر البحث أو القناة لعرض القوالب." : "يمكنك إعداد قالب التجديد لواتساب أو البريد، أو إنشاء قالب معلومات طلب من القسم المخصص."}</p>${items.length ? "" : `<div class="inline-actions"><button class="btn btn-primary" data-link="/dashboard/templates?edit=renewal_whatsapp">إعداد قالب واتساب</button><button class="btn btn-secondary" data-link="/dashboard/templates?edit=renewal_email">إعداد قالب البريد</button><button class="btn btn-secondary" data-link="/dashboard/order-links">قالب معلومات الطلب</button></div>`}</div>`;
  return dashboardShell(`<div class="template-breadcrumb"><span>الرئيسية</span><b>/</b><strong>القوالب</strong></div>
    ${pageTitle("قوالب التجديد")}
    <p class="page-kicker">إدارة رسائل تذكير العملاء عبر واتساب والبريد الإلكتروني.</p>
    <section class="template-summary-grid">
      <article class="card"><span class="template-summary-icon">${dashboardIcon("template")}</span><div><small>إجمالي القوالب</small><strong>${total}</strong></div></article>
      <article class="card"><span class="template-summary-icon success">${dashboardIcon("security")}</span><div><small>قوالب نشطة</small><strong>${active}</strong></div></article>
      <article class="card"><span class="template-summary-icon warning">${dashboardIcon("reports")}</span><div><small>مسودات أو متوقفة</small><strong>${inactive}</strong></div></article>
    </section>
    <section class="card template-catalog-card">
      <div class="template-catalog-toolbar"><label class="template-search-wrap">${dashboardIcon("reports")}<input class="input" data-action="template-catalog-search" value="${escapeHtml(state.templateCatalogSearch || "")}" placeholder="ابحث عن قالب..."></label><select class="select template-channel-select" data-action="template-catalog-channel"><option value="all" ${channel === "all" ? "selected" : ""}>كل القنوات</option>${channelTabs.slice(1).map(([value,label]) => `<option value="${value}" ${channel === value ? "selected" : ""}>${label}</option>`).join("")}</select><div class="template-channel-tabs">${channelTabs.map(([value,label]) => `<button class="${channel === value ? "active" : ""}" data-action="template-catalog-channel" data-channel="${value}">${label}</button>`).join("")}</div></div>
      <div class="template-catalog-list">${body}</div>
      ${!loading && filtered.length ? `<div class="template-catalog-footer"><span>عرض ${filtered.length} من ${total}</span><span>جميع الأرقام من القوالب المحفوظة في مساحة العمل.</span></div>` : ""}
    </section>`);
}

function catalogTemplateEditorPage(templateKey) {
  const template = (Array.isArray(state.catalogTemplates) ? state.catalogTemplates : []).find((item) => item.templateKey === templateKey);
  const backButton = `<button class="btn btn-secondary" data-link="/dashboard/templates">${dashboardIcon("arrow-left")} العودة إلى القوالب</button>`;
  if (!template) return dashboardShell(`${pageTitle("القوالب", backButton)}<div class="loading-state">جارٍ تحميل القالب المحفوظ...</div>`);
  const commonFields = `<input type="hidden" name="templateKey" value="${escapeHtml(templateKey)}"><div class="template-editor-meta-v2"><label class="field"><span>اسم القالب</span><input class="input" name="name" value="${escapeHtml(template.name || "")}" required></label><label class="setting-row setting-toggle"><span><strong>حالة القالب</strong><small>يمكن إيقافه دون حذفه</small></span><input type="checkbox" name="isActive" ${template.isActive !== false ? "checked" : ""}></label></div>`;
  const footer = `<div class="template-editor-v2-footer"><span class="muted">الحفظ يحدّث القالب نفسه ولا ينشئ نسخة جديدة.</span><div class="template-actions"><button class="btn btn-primary">حفظ القالب ${dashboardIcon("save")}</button><button type="button" class="btn btn-secondary" data-action="preview-catalog-template">معاينة ${dashboardIcon("eye")}</button></div></div>`;

  if (templateKey === "whatsapp_menu") {
    const section = template.contentJson?.sections?.[0] || { title: "الخدمات", rows: [] };
    const rows = Array.from({ length: 3 }, (_, index) => section.rows?.[index] || {}).map((row, index) => `<div class="catalog-menu-row"><input type="hidden" name="rowId" value="${escapeHtml(row.id || `option_${index + 1}`)}"><label class="field"><span>عنوان الخيار ${index + 1}</span><input class="input" name="rowTitle" value="${escapeHtml(row.title || "")}" data-catalog-preview-row="${index}" required></label><label class="field"><span>الوصف</span><input class="input" name="rowDescription" value="${escapeHtml(row.description || "")}" data-catalog-preview-description="${index}"></label></div>`).join("");
    const previewRows = Array.from({ length: 3 }, (_, index) => section.rows?.[index]).filter(Boolean).map((row) => `<li><strong>${escapeHtml(row.title)}</strong><span>${escapeHtml(row.description || "")}</span></li>`).join("");
    return dashboardShell(`${pageTitle("الرسائل التفاعلية", backButton)}<p class="page-kicker">تحرير الرسالة التفاعلية ومعاينة الرسالة والخيارات بعد فتحها.</p><section class="template-editor-v2 template-editor-v2-whatsapp catalog-special-editor"><article class="card template-editor-card-v2"><form data-submit="catalog-template" class="grid">${commonFields}<label class="field"><span>محتوى رسالة الترحيب</span><textarea class="textarea template-editor-v2-body" name="body" data-catalog-preview-body required>${escapeHtml(template.body || "")}</textarea></label><div class="template-meta-grid"><label class="field"><span>نص زر الخيارات</span><input class="input" name="buttonLabel" value="${escapeHtml(template.buttonLabel || "عرض الخيارات")}" data-catalog-preview-button required></label><label class="field"><span>النص الختامي</span><input class="input" name="footerText" value="${escapeHtml(template.footerText || "")}" data-catalog-preview-footer></label></div><div class="catalog-menu-options"><h2>الخيارات التفاعلية</h2><label class="field"><span>عنوان القسم</span><input class="input" name="sectionTitle" value="${escapeHtml(section.title || "الخدمات")}" required></label>${rows}</div>${footer}</form></article><aside class="template-preview-v2 catalog-dual-preview"><article class="card template-phone-card"><div class="section-head"><div><h2>الرسالة الأساسية</h2><p>النص وزر فتح الخيارات.</p></div>${dashboardIcon("whatsapp")}</div><div class="whatsapp-phone-preview compact"><div class="whatsapp-phone-shell"><div class="whatsapp-phone-speaker"></div><div class="whatsapp-chat-top"><span>‹</span><b>Renvix</b><small>حساب أعمال</small><i>⋮</i></div><div class="whatsapp-chat-day">اليوم</div><div class="whatsapp-message-bubble"><p data-catalog-preview-output>${escapeHtml(template.body || "")}</p><span class="whatsapp-list-button" data-catalog-preview-button-output>${escapeHtml(template.buttonLabel || "عرض الخيارات")}</span><small>11:21 ص ✓✓</small></div></div></div></article><article class="card whatsapp-opened-list"><div class="section-head"><div><h2>الخيارات بعد الفتح</h2><p>معاينة بنية الخيارات التفاعلية.</p></div>${dashboardIcon("template")}</div><strong>${escapeHtml(section.title || "الخدمات")}</strong><ul data-catalog-menu-preview>${previewRows}</ul><small>قد تختلف بعض التفاصيل البصرية حسب جهاز العميل وإصدار واتساب.</small></article></aside></section>`);
  }

  if (templateKey === "email_delivery") {
    const emailDraft = { ...template, storeName: "{{store_name}}", themeColor: template.themeColor || "#0EA5A8" };
    return dashboardShell(`${pageTitle("قالب قناة إرسال بريد", backButton)}<p class="page-kicker">قالب البريد المستخدم لإرسال تفاصيل الطلب ورابط صفحة العميل.</p><section class="template-editor-v2 template-editor-v2-email catalog-email-editor"><article class="card email-settings-v2"><h2>إعدادات الهوية</h2><p class="muted">عنوان المرسل ثابت وموثّق.</p><label class="field"><span>المرسل</span><input class="input" value="Renvix &lt;noreply@notify.renvix.app&gt;" readonly></label><label class="field"><span>لون القالب</span><input class="input" type="color" name="themeColorExternal" value="${safeEmailTheme(emailDraft.themeColor)}" data-catalog-theme></label><div class="email-settings-hint">رابط معلومات الطلب يُضاف آمنًا لكل عميل ولا يُحفظ كرابط ثابت داخل القالب.</div></article><article class="card template-editor-card-v2 email-editor-v2"><form data-submit="catalog-template" class="grid">${commonFields}<label class="field"><span>موضوع البريد</span><input class="input" name="title" value="${escapeHtml(template.title || "")}" data-catalog-preview-title required></label><label class="field"><span>محتوى الرسالة</span><textarea class="textarea template-editor email-content-editor" name="body" data-catalog-preview-body required>${escapeHtml(template.body || "")}</textarea></label><div class="variables-row"><span>المتغيرات المتاحة</span>${["{{customer_name}}","{{order_number}}","{{order_portal_url}}","{{store_name}}"].map((item) => `<span class="chip">${item}</span>`).join("")}</div><div class="template-meta-grid"><label class="field"><span>نص الزر</span><input class="input" name="buttonLabel" value="${escapeHtml(template.buttonLabel || "عرض معلومات الطلب")}" data-catalog-preview-button required></label><label class="field"><span>النص الختامي</span><input class="input" name="footerText" value="${escapeHtml(template.footerText || "")}" data-catalog-preview-footer></label></div>${footer}</form></article><aside class="template-preview-v2 email-preview-v2"><article class="card"><div class="section-head"><div><h2>معاينة البريد</h2><p>سطح المكتب والجوال بنفس محتوى الإرسال.</p></div>${dashboardIcon("email")}</div><div class="email-header-preview"><b>Renvix &lt;noreply@notify.renvix.app&gt;</b><span>إلى: {{customer_email}}</span><span data-catalog-preview-title-output>الموضوع: ${escapeHtml(template.title || "")}</span></div><div data-catalog-email-preview>${emailTemplatePreview(emailDraft)}</div></article></aside></section>`);
  }

  return dashboardShell(`${pageTitle("قالب تم التنفيذ — سلة", backButton)}<p class="page-kicker">الرسالة التي تُجهّز بعد تنفيذ طلب سلة، مع رابط طلب خاص وغير قابل للحذف.</p><section class="template-editor-v2 template-editor-v2-salla"><article class="card template-editor-card-v2"><form data-submit="catalog-template" class="grid">${commonFields}<label class="field"><span>نص الرسالة</span><textarea class="textarea template-editor-v2-body" name="body" data-catalog-preview-body required>${escapeHtml(template.body || "")}</textarea></label><div class="variables-row"><span>المتغيرات المتاحة</span>${["{{customer_name}}","{{order_number}}","{{store_name}}"].map((item) => `<span class="chip">${item}</span>`).join("")}</div><div class="catalog-locked-link">${dashboardIcon("security")}<div><strong>رابط الطلب الخاص بالعميل</strong><small>يُنشأ تلقائيًا لكل طلب ولا يمكن حذفه أو استبداله برابط ثابت.</small></div></div><input type="hidden" name="buttonLabel" value="${escapeHtml(template.buttonLabel || "عرض معلومات الطلب")}"><input type="hidden" name="footerText" value="${escapeHtml(template.footerText || "Renvix")}">${footer}</form></article><aside class="template-preview-v2 catalog-salla-previews"><article class="card"><div class="section-head"><div><h2>معاينة الرسالة</h2><p>النص الذي يصل إلى العميل.</p></div><img class="salla-preview-logo" src="/assets/salla-logo.svg" alt="سلة"></div><div class="salla-message-preview"><p data-catalog-preview-output>${escapeHtml(template.body || "")}</p><div class="catalog-locked-link compact">🔒 رابط الطلب الخاص بالعميل</div></div></article><article class="card"><div class="section-head"><div><h2>معاينة صفحة الطلب</h2><p>تُعرض المتغيرات حتى اختيار طلب حقيقي.</p></div>${dashboardIcon("orderLink")}</div><div class="salla-order-page-preview"><div class="salla-order-brand"><img src="/assets/salla-logo.svg" alt="سلة"><strong>{{store_name}}</strong></div><h3>تفاصيل الطلب</h3><dl><div><dt>رقم الطلب</dt><dd>{{order_number}}</dd></div><div><dt>الحالة</dt><dd>تم التنفيذ</dd></div><div><dt>العميل</dt><dd>{{customer_name}}</dd></div></dl><p>لا توجد بيانات طلب حقيقي محددة للمعاينة.</p></div></article></aside></section>`);
}

function renewalTemplateEditorPageV2(forcedChannel = "") {
  const payload = state.notificationTemplate || {};
  const templates = Array.isArray(payload.templates) ? payload.templates : (payload.template ? [payload.template] : []);
  const rules = Array.isArray(payload.rules) ? payload.rules : (payload.rule ? [payload.rule] : []);
  const channel = forcedChannel || state.templateChannel || payload.template?.channel || "whatsapp";
  const defaults = { ...localDefaultEmailTemplate, ...(payload.defaultEmailTemplate || {}) };
  const storedTemplate = templates.find((item) => item.channel === channel);
  const template = channel === "email" ? { ...defaults, ...(storedTemplate || {}) } : (storedTemplate || {});
  const rule = rules.find((item) => item.templateId === template.id || item.channel === channel) || {};
  const body = template.body || "";
  const channelSelect = `<label class="field"><span>قناة الإرسال</span><select class="select" name="channel" data-action="template-channel"><option value="whatsapp" ${channel === "whatsapp" ? "selected" : ""}>واتساب</option><option value="email" ${channel === "email" ? "selected" : ""}>البريد الإلكتروني</option></select></label>`;
  const backButton = `<button class="btn btn-secondary" data-link="/dashboard/templates">${dashboardIcon("arrow-left")} العودة إلى القوالب</button>`;
  const variableButtons = (variables) => variables.map((item) => `<button type="button" class="chip" data-action="insert-template-variable" data-variable="${item}">${item}</button>`).join("");
  const reminderSettings = `<div class="template-settings-grid"><label class="field"><span>متى يتم الإرسال؟</span><select class="select" name="daysOffset"><option value="7" ${Number(rule.daysOffset || 7) === 7 ? "selected" : ""}>قبل 7 أيام</option><option value="4" ${Number(rule.daysOffset) === 4 ? "selected" : ""}>قبل 4 أيام</option><option value="3" ${Number(rule.daysOffset) === 3 ? "selected" : ""}>قبل 3 أيام</option><option value="1" ${Number(rule.daysOffset) === 1 ? "selected" : ""}>قبل يوم واحد</option></select></label><label class="setting-row setting-toggle"><span><strong>حالة القالب</strong><small>يستخدم عند الإرسال التلقائي</small></span><input type="checkbox" name="isActive" ${template.isActive !== false ? "checked" : ""}></label></div>`;

  if (channel === "whatsapp") {
    const preview = body ? escapeHtml(body).replaceAll("\n", "<br>") : "اكتب محتوى الرسالة ليظهر هنا.";
    return dashboardShell(`${pageTitle("قالب رسالة التجديد", backButton)}<p class="page-kicker">إنشاء وتخصيص قالب رسالة تذكير التجديد التي يتم إرسالها للعملاء عبر واتساب.</p>
      <section class="template-editor-v2 template-editor-v2-whatsapp">
        <article class="card template-editor-card-v2"><form data-submit="renewal-template" class="grid">
          <div class="template-editor-meta-v2"><label class="field"><span>اسم القالب</span><input class="input" name="name" value="${escapeHtml(template.name || "قالب رسالة التجديد - واتساب")}" required></label>${channelSelect}<label class="field"><span>اسم المتجر</span><input class="input" name="storeName" value="${escapeHtml(template.storeName || "Renvix")}"></label><label class="field"><span>عنوان الرسالة</span><input class="input" name="title" value="${escapeHtml(template.title || "تذكير بتجديد اشتراكك")}"></label></div>
          <div class="editor-toolbar"><button type="button" title="تراجع">↶</button><button type="button" title="إعادة">↷</button><button type="button"><b>B</b></button><button type="button"><i>I</i></button><button type="button"><u>U</u></button><span>محتوى الرسالة</span></div><textarea class="textarea template-editor template-editor-v2-body" name="body" data-action="template-body" placeholder="اكتب رسالة التجديد هنا...">${escapeHtml(body)}</textarea>
          <div class="variables-row"><span>المتغيرات المتاحة</span>${variableButtons(["{{customer_name}}", "{{plan_name}}", "{{expiry_date}}", "{{days_remaining}}", "{{renewal_url}}"])}</div>
          ${reminderSettings}
          <div class="template-editor-v2-footer"><span class="muted">يمكنك تخصيص النص ونمط الرسالة بما يناسب علامتك التجارية.</span><div class="template-actions"><button class="btn btn-primary">حفظ القالب ${dashboardIcon("save")}</button><button type="button" class="btn btn-secondary" data-action="test-template">معاينة مباشرة ${dashboardIcon("eye")}</button></div></div>
        </form></article>
        <aside class="template-preview-v2"><article class="card template-phone-card"><div class="section-head"><div><h2>معاينة واتساب</h2><p>تظهر المعاينة كما سيشاهدها العميل على واتساب.</p></div>${dashboardIcon("whatsapp")}</div><div class="whatsapp-phone-preview"><div class="whatsapp-phone-shell"><div class="whatsapp-phone-speaker"></div><div class="whatsapp-chat-top"><span>‹</span><b>Renvix</b><small>حساب أعمال</small><i>⋮</i></div><div class="whatsapp-chat-day">اليوم</div><div class="whatsapp-message-bubble"><strong>${escapeHtml(template.title || "تذكير بتجديد اشتراكك")}</strong><p data-whatsapp-preview-body>${preview}</p><a href="#" tabindex="-1">رابط التجديد</a><small>11:21 ص ✓✓</small></div><div class="whatsapp-chat-composer">اكتب رسالة <span>⌕</span><b>●</b></div></div></div><p class="preview-note">هذه معاينة آمنة للرسالة، ولا يتم إرسالها أو خصم أي رصيد.</p></article><article class="card template-safety-note"><strong>ملاحظة مهمة</strong><p>تأكد من اتصال جهاز واتساب قبل تفعيل الإرسال التلقائي.</p></article></aside>
      </section>`);
  }

  const colors = ["#0EA5A8", "#2563EB", "#7C3AED", "#22C55E", "#F97316", "#64748B"];
  const variables = ["{{customer_name}}", "{{service_name}}", "{{end_date}}", "{{days_remaining}}", "{{renewal_link}}", "{{store_name}}"];
  return dashboardShell(`${pageTitle("قالب البريد الإلكتروني للتجديد", backButton)}<p class="page-kicker">تم إعداد هذا البريد لإرسال تذكيرات التجديد للعملاء قبل انتهاء اشتراكاتهم.</p>
    <section class="template-editor-v2 template-editor-v2-email"><article class="card email-settings-v2"><h2>إعدادات الهوية</h2><p class="muted">خصّص ألوان القالب وهوية المتجر.</p><div class="email-theme-row"><span>لون القالب</span><input type="hidden" name="themeColor" value="${safeEmailTheme(template.themeColor)}">${colors.map((color) => `<button type="button" class="email-color ${safeEmailTheme(template.themeColor) === color ? "active" : ""}" style="--swatch:${color}" data-action="template-theme" data-color="${color}" aria-label="اختيار اللون ${color}"></button>`).join("")}<label class="email-custom-color" title="لون مخصص">✎<input type="color" value="${safeEmailTheme(template.themeColor)}" data-action="template-custom-theme"></label></div><label class="field"><span>اسم المرسل</span><input class="input" value="Renvix &lt;noreply@notify.renvix.app&gt;" readonly></label><label class="field"><span>اسم المتجر في الرسالة</span><input class="input" name="storeName" data-email-field value="${escapeHtml(template.storeName || "Renvix Store")}" required></label><label class="field"><span>موضوع الرسالة</span><input class="input" name="title" data-email-field value="${escapeHtml(template.title || "تذكير بتجديد اشتراكك")}" required></label>${storeLogoEditor(state.orderLinkProfile?.logoUrl)}<div class="email-settings-hint">عنوان المرسل موثّق ولا يمكن تعديله من القالب.</div></article>
      <article class="card template-editor-card-v2 email-editor-v2"><form data-submit="renewal-template" class="grid"><div class="template-editor-meta-v2"><label class="field"><span>اسم القالب</span><input class="input" name="name" value="${escapeHtml(template.name || "قالب البريد الإلكتروني للتجديد")}" required></label>${channelSelect}</div><div class="editor-toolbar"><button type="button">↶</button><button type="button">↷</button><button type="button"><b>B</b></button><button type="button"><i>I</i></button><button type="button"><u>U</u></button><span>محرر الرسالة</span></div><textarea class="textarea template-editor email-content-editor" name="body" data-email-field placeholder="اكتب محتوى رسالة التجديد..." required>${escapeHtml(template.body || "")}</textarea><div class="variables-row email-variables"><span>المتغيرات المتاحة</span>${variableButtons(variables)}</div><div class="template-meta-grid"><label class="field"><span>نص زر التجديد</span><input class="input" name="buttonLabel" data-email-field value="${escapeHtml(template.buttonLabel || "جدد اشتراكك الآن")}" required></label><label class="field"><span>النص الختامي</span><input class="input" name="footerText" data-email-field value="${escapeHtml(template.footerText || "شكرًا لثقتك بنا")}" required></label></div>${reminderSettings}<div class="template-editor-v2-footer"><span class="muted">عنوان المرسل ثابت: Renvix &lt;noreply@notify.renvix.app&gt;</span><div class="template-actions"><button class="btn btn-primary">حفظ القالب ${dashboardIcon("save")}</button><button type="button" class="btn btn-secondary" data-action="test-template">إرسال رسالة تجريبية ${dashboardIcon("send")}</button></div></div></form></article><aside class="template-preview-v2 email-preview-v2"><article class="card"><div class="section-head"><div><h2>معاينة البريد</h2><p>معاينة حقيقية لمحتوى البريد المرسل.</p></div>${dashboardIcon("email")}</div><div class="email-header-preview"><b>Renvix &lt;noreply@notify.renvix.app&gt;</b><span>إلى: {{customer_email}}</span><span>الموضوع: ${escapeHtml(template.title || "تذكير بتجديد اشتراكك")}</span></div><div data-email-preview>${emailTemplatePreview(template)}</div></article></aside></section>`);
}

function renewalTemplateEditorPage(forcedChannel = "") {
  const payload = state.notificationTemplate || {};
  const templates = Array.isArray(payload.templates) ? payload.templates : (payload.template ? [payload.template] : []);
  const rules = Array.isArray(payload.rules) ? payload.rules : (payload.rule ? [payload.rule] : []);
  const channel = forcedChannel || state.templateChannel || payload.template?.channel || "whatsapp";
  const defaults = { ...localDefaultEmailTemplate, ...(payload.defaultEmailTemplate || {}) };
  const storedTemplate = templates.find((item) => item.channel === channel);
  const template = channel === "email" ? { ...defaults, ...(storedTemplate || {}) } : (storedTemplate || {});
  const rule = rules.find((item) => item.templateId === template.id || item.channel === channel) || {};
  const body = template.body || "";
  const isWhatsappReady = overviewStats().connectedDevices > 0;
  const channelSelect = `<label class="field"><span>قناة الإرسال</span><select class="select" name="channel" data-action="template-channel"><option value="whatsapp" ${channel === "whatsapp" ? "selected" : ""}>واتساب</option><option value="email" ${channel === "email" ? "selected" : ""}>البريد الإلكتروني</option></select></label>`;

  if (channel === "whatsapp") {
    const preview = body ? escapeHtml(body).replaceAll("\n", "<br>") : `<div class="template-empty"><strong>لا يوجد محتوى محفوظ بعد</strong><p>اكتب رسالة التجديد ثم احفظ القالب لتظهر المعاينة هنا.</p></div>`;
    return dashboardShell(`${pageTitle("قالب رسالة التجديد - واتساب", `<button class="btn btn-secondary" data-link="/dashboard/templates">‹ العودة إلى القوالب</button>`)}
      <p class="page-kicker">أنشئ وخصص رسالة التجديد التي سيتم إرسالها للعملاء قبل انتهاء اشتراكاتهم.</p>
      <section class="template-workspace"><article class="card template-editor-card"><div class="section-head"><div><h2>محتوى الرسالة</h2><p>محرر محتوى الرسالة باستخدام المتغيرات الذكية.</p></div>${dashboardIcon("template")}</div><form data-submit="renewal-template" class="grid">
        <div class="template-meta-grid"><label class="field"><span>اسم القالب</span><input class="input" name="name" value="${escapeHtml(template.name || "")}" placeholder="مثال: تذكير قبل التجديد"></label>${channelSelect}</div>
        <div class="editor-toolbar"><button type="button" title="تراجع">↶</button><button type="button" title="إعادة">↷</button><button type="button"><b>B</b></button><button type="button"><i>I</i></button><button type="button"><u>U</u></button><span>النص</span></div><textarea class="textarea template-editor" name="body" data-action="template-body" placeholder="اكتب رسالة التجديد هنا...">${escapeHtml(body)}</textarea><div class="variables-row"><span>المتغيرات المتاحة</span>${["{{customer_name}}", "{{service_name}}", "{{end_date}}", "{{renewal_link}}"].map((item) => `<button type="button" class="chip" data-action="insert-template-variable" data-variable="${item}">${item}</button>`).join("")}</div>
        <div class="template-settings"><label class="field"><span>موعد الإرسال</span><select class="select" name="daysOffset"><option value="7" ${Number(rule.daysOffset || 7) === 7 ? "selected" : ""}>قبل انتهاء الاشتراك بـ7 أيام</option><option value="3" ${Number(rule.daysOffset) === 3 ? "selected" : ""}>قبل انتهاء الاشتراك بـ3 أيام</option><option value="1" ${Number(rule.daysOffset) === 1 ? "selected" : ""}>قبل انتهاء الاشتراك بيوم</option></select></label><label class="setting-row setting-toggle"><span>تفعيل القالب</span><input type="checkbox" name="isActive" ${template.isActive !== false ? "checked" : ""}></label></div>
        <div class="template-actions"><button class="btn btn-primary">حفظ القالب</button><button type="button" class="btn btn-secondary" data-action="test-template" ${!isWhatsappReady ? "disabled title=\"اربط جهازًا أولًا حتى تتمكن من إرسال رسالة تجريبية.\"" : ""}>إرسال رسالة تجريبية</button></div></form></article>
        <aside class="template-side"><article class="card template-preview-card"><div class="section-head"><h2>معاينة الرسالة</h2>${dashboardIcon("reports")}</div><div class="whatsapp-preview"><span class="preview-day">معاينة القالب</span><div class="message-bubble">${preview}<small>معاينة فقط ✓✓</small></div></div><p class="preview-note">المعاينة تعرض المتغيرات كما هي، ولا تستخدم بيانات عميل أو طلب مختلقة.</p></article><article class="card"><h2>إعدادات الإرسال</h2><p>القناة الحالية: <strong>واتساب</strong></p><p class="muted">لن ترسل المنصة أي رسالة تلقائيًا ما لم يكن القالب مفعلاً والقناة جاهزة.</p></article></aside>
      </section>`);
  }

  const colors = ["#0EA5A8", "#2563EB", "#7C3AED", "#22C55E", "#F97316", "#64748B"];
  const variables = ["{{اسم_العميل}}", "{{اسم_الخدمة}}", "{{تاريخ_الانتهاء}}", "{{الأيام_المتبقية}}", "{{رابط_التجديد}}", "{{رقم_الطلب}}", "{{اسم_المتجر}}"];
  return dashboardShell(`${pageTitle("قالب البريد الإلكتروني للتجديد", `<button class="btn btn-secondary" data-link="/dashboard/templates">‹ العودة إلى القوالب</button>`)}
    <p class="page-kicker">خصص رسالة البريد التي ستصل للعميل قبل انتهاء اشتراكه، من داخل صفحة القالب الحالية.</p>
    <section class="email-template-layout">
      <article class="card template-editor-card email-template-editor"><div class="section-head"><div><h2>محتوى الرسالة</h2><p>محرر بريد آمن مع متغيرات معتمدة ومعاينة مطابقة للقالب المرسل.</p></div>${dashboardIcon("template")}</div>
        <form data-submit="renewal-template" class="grid">
          <div class="email-template-meta"><label class="field"><span>اسم القالب</span><input class="input" name="name" value="${escapeHtml(template.name)}" required></label><label class="field"><span>اسم المتجر</span><input class="input" name="storeName" data-email-field value="${escapeHtml(template.storeName)}" required></label>${channelSelect}</div>
          ${storeLogoEditor(state.orderLinkProfile?.logoUrl)}
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

const orderLinkTemplatePreferenceKey = "renvix.orderLink.templateId";

function rememberedOrderLinkTemplateId() {
  try {
    return localStorage.getItem(orderLinkTemplatePreferenceKey) || "";
  } catch {
    return "";
  }
}

function rememberOrderLinkTemplateSelection(templateId) {
  const value = String(templateId || "").trim();
  try {
    if (value) localStorage.setItem(orderLinkTemplatePreferenceKey, value);
    else localStorage.removeItem(orderLinkTemplatePreferenceKey);
  } catch {}
  if (location.pathname !== "/dashboard/order-links") return;
  const url = new URL(location.href);
  if (value) url.searchParams.set("templateId", value);
  else url.searchParams.delete("templateId");
  history.replaceState({}, "", `${url.pathname}${url.search}`);
  state.query = new URLSearchParams(url.search);
}

function hydrateOrderLinkDraft() {
  const profile = state.orderLinkProfile;
  if (profile === null || state.orderLinkTemplates === null || profile?.error || state.orderLinkDraft.hydrated) return;
  const templates = Array.isArray(state.orderLinkTemplates) ? state.orderLinkTemplates : [];
  const requestedTemplateId = state.query.get("templateId") || "";
  const rememberedTemplateId = rememberedOrderLinkTemplateId();
  const preferredTemplateId = requestedTemplateId || rememberedTemplateId || state.orderLinkDraft.templateId || "";
  const defaultTemplate = templates.find((item) => item.id === preferredTemplateId) || templates.find((item) => item.isDefault) || templates[0];
  state.orderLinkDraft = {
    ...state.orderLinkDraft,
    hydrated: true,
    storeName: defaultTemplate?.storeName || profile.storeName || "",
    logoUrl: profile.logoUrl || "",
    logoBorderRadius: safeStoreLogoRadius(profile.logoBorderRadius),
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
  if (defaultTemplate?.id) rememberOrderLinkTemplateSelection(defaultTemplate.id);
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
    if (customer && draft.manualServiceName?.trim() && draft.manualPlanName?.trim() && draft.manualStartDate && draft.manualEndDate) {
      return {
        orderNumber: draft.manualOrderNumber || "سيُنشأ عند الحفظ",
        customerName: customer.name,
        planName: draft.manualPlanName,
        serviceName: draft.manualServiceName,
        startDate: draft.manualStartDate,
        endDate: draft.manualEndDate,
        status: inferredSubscriptionStatus(draft.manualStartDate, draft.manualEndDate) || "غير مكتمل",
        isDraftPreview: true
      };
    }
  }
  return null;
}

function orderInfoPreviewCard(subscription, draft, publicData = null) {
  if (Array.isArray(publicData?.items)) {
    return `<section class="order-portal-items">${publicData.items.map((item) => {
      const remaining = item.remaining || {};
      const remainingText = remaining.status === "pending" ? "لم يبدأ الاشتراك"
        : remaining.status === "expired" ? "انتهى الاشتراك"
          : `${Number(remaining.remainingDays || 0)} يوم و${Number(remaining.remainingHours || 0)} ساعة و${Number(remaining.remainingMinutes || 0)} دقيقة`;
      const itemData = { ...publicData, items: undefined, order: {
        ...publicData.order, serviceName: item.serviceName, planName: item.planName, status: item.status,
        startDate: item.startsAt, endDate: item.expiresAt, remaining
      }, renewalOptions: item.renewalOptions || [] };
      return `<article class="subscription-live-time">
        <div><span>الخدمة</span><strong>${escapeHtml(item.serviceName || item.planName || "الاشتراك")}</strong></div>
        <div><span>المدة الأصلية</span><strong>${escapeHtml(item.durationLabel || "مدة الاشتراك غير مهيأة")}</strong></div>
        <div><span>المدة المتبقية</span><strong data-subscription-countdown data-expires-at="${escapeHtml(item.expiresAt)}" data-server-now="${escapeHtml(publicData.serverNow)}">${escapeHtml(remainingText)}</strong></div>
        <div class="subscription-time-progress"><i><b style="width:${Math.min(100, Math.max(0, Number(remaining.progressPercentage || 0)))}%"></b></i><small>اكتمل ${Math.min(100, Math.max(0, Number(remaining.progressPercentage || 0)))}% من المدة</small></div>
      </article>${orderInfoPreviewCard(null, draft, itemData)}`;
    }).join("")}</section>`;
  }
  const order = publicData?.order || subscription;
  const store = publicData?.store || { name: draft.storeName, logoUrl: draft.logoUrl };
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
  const storeLogoRadius = safeStoreLogoRadius(store.logoBorderRadius ?? draft.logoBorderRadius);
  return `<article class="order-customer-card order-style-${escapeHtml(template.style || "classic")} ${order.isPlaceholder ? "is-placeholder" : ""}" style="--order-theme:${themeColor}">
    <div class="order-card-accent"></div>
    <div class="order-card-brand"><span class="order-bag ${safeStoreLogoUrl(store.logoUrl || draft.logoUrl) ? "has-store-logo" : ""}">${storeLogoImage(store.logoUrl || draft.logoUrl, "order-store-logo", store.name || draft.storeName, storeLogoRadius)}</span><div><h2>${escapeHtml(store.name || draft.storeName || "المتجر")}</h2><p>${escapeHtml(template.headerText || "معلومات طلبك")}</p></div></div>
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
    ${Array.isArray(publicData?.renewalOptions) && publicData.renewalOptions.length ? `<section class="public-renewal-options"><div><h3>خيارات تجديد ${escapeHtml(order.serviceName || planName || "الاشتراك")}</h3><p>اختر المدة المناسبة لهذا المنتج.</p></div><div class="public-renewal-grid">${publicData.renewalOptions.map((item) => `<a href="${escapeHtml(item.url)}" class="public-renewal-card"><span>${dashboardIcon("subscriptions")}</span><div><strong>${escapeHtml(item.label)}</strong><small>${renewalDurationLabel(item.durationValue, item.durationUnit)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</small></div><b>تجديد الآن ←</b></a>`).join("")}</div></section>` : ""}
    ${template.footerText ? `<p class="order-card-footer">${escapeHtml(template.footerText)}</p>` : ""}
  </article>`;
}

function orderLookupPreviewCard(draft) {
  const themeColor = safeOrderLinkColor(draft.themeColor);
  const storeName = draft.storeName?.trim() || "اسم متجرك";
  return `<article class="order-lookup-preview order-style-${escapeHtml(draft.style || "classic")}" style="--order-theme:${themeColor}">
    <div class="order-lookup-accent"></div>
    <div class="order-lookup-brand"><span class="order-bag ${safeStoreLogoUrl(draft.logoUrl) ? "has-store-logo" : ""}">${storeLogoImage(draft.logoUrl, "order-store-logo", storeName, draft.logoBorderRadius)}</span><div><h2>${escapeHtml(storeName)}</h2><p>مرحبًا بك في صفحة متابعة طلبك</p></div></div>
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
    <div class="order-lookup-brand"><span class="order-bag ${safeStoreLogoUrl(store.logoUrl) ? "has-store-logo" : ""}">${storeLogoImage(store.logoUrl, "order-store-logo", store.name || "معلومات الطلب", store.logoBorderRadius)}</span><div><h2>${escapeHtml(store.name || "معلومات الطلب")}</h2><p>${escapeHtml(template.headerText || "مرحبًا بك في صفحة متابعة طلبك")}</p></div></div>
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
  if (state.orderLinkProfile === null || state.orderLinkTemplates === null) {
    return dashboardShell(`<div class="order-links-page-title">${pageTitle("إرسال معلومات الطلب")}</div><section class="card section loading-state order-links-workspace-loading">جاري تحميل القالب والرابط المحفوظين...</section>`);
  }
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
    `<div class="row-actions"><button class="btn btn-ghost" data-action="load-order-template" data-id="${item.id}">تعديل القالب الثابت</button></div>`
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
    `<div class="row-actions order-saved-actions"><button class="icon-action" data-action="copy-order-link" data-id="${item.id}" title="نسخ الرابط" aria-label="نسخ الرابط">${dashboardIcon("copy")}</button><button class="icon-action" data-action="preview-order-link" data-id="${item.id}" title="معاينة الطلب" aria-label="معاينة الطلب">${dashboardIcon("eye")}</button><button class="icon-action" data-action="send-order-link" data-id="${item.id}" title="إرسال رابط الطلب المحفوظ" aria-label="إرسال رابط الطلب المحفوظ">${dashboardIcon("send")}</button><button class="icon-action" data-action="regenerate-order-link" data-id="${item.id}" title="إنشاء رابط سري جديد" aria-label="إنشاء رابط سري جديد">${dashboardIcon("refresh")}</button><button class="icon-action" data-action="archive-order-link" data-id="${item.id}" title="أرشفة الطلب" aria-label="أرشفة الطلب">${dashboardIcon("document")}</button><button class="icon-action danger-text" data-action="disable-order-link" data-id="${item.id}" title="تعطيل الرابط" aria-label="تعطيل الرابط">${dashboardIcon("close")}</button><button class="icon-action danger-text" data-action="delete-order-link" data-id="${item.id}" title="حذف الطلب" aria-label="حذف الطلب">${dashboardIcon("delete")}</button></div>`
  ]);
  const savedOrdersContent = state.orderLinks === null
    ? `<div class="loading-state order-links-loading">جاري تحميل الطلبات المحفوظة...</div>`
    : linksPayload?.error
      ? `<div class="empty-state"><strong>تعذر تحميل الطلبات المحفوظة</strong><p class="muted">${escapeHtml(linksPayload.error)}</p><button class="btn btn-secondary" data-action="reload-order-links">إعادة المحاولة</button></div>`
      : links.length
        ? simpleTable(["رقم الطلب", "العميل", "القالب", "اللون", "طريقة الإرسال", "الحالة", "الفتحات", "آخر فتح", "الإنشاء", "الإجراءات"], linkRows)
        : emptyState("لا توجد طلبات محفوظة بعد", "أضف أول طلب إلى قالبك الثابت ليتمكن العميل من البحث عنه.");
  return dashboardShell(`<div class="order-links-page-title">${pageTitle("إرسال معلومات الطلب")}</div>
    ${statGrid([
      { title: "قالب معلومات الطلب", value: stats.activeTemplates || 0, caption: "قالب ثابت", tone: "purple", icon: "template" },
      { title: "روابط الطلبات", value: stats.sentLinks || 0, caption: "رابط خاص", tone: "info", icon: "orderLink" },
      { title: "الروابط المفتوحة", value: stats.openedLinks || 0, caption: "رابط", tone: "success", icon: "reports" },
      { title: "طلبات اليوم", value: stats.todayRequests || 0, caption: "استعلام", tone: "warning", icon: "template" },
      { title: "نسبة الفتح", value: `${stats.openRate || 0}%`, caption: "من الروابط", tone: "info", icon: "reports" }
    ])}
    <section class="order-link-workspace section">
      <article class="card order-link-builder">
        <div class="section-head"><div><h2>قالب معلومات الطلب — سلة</h2><p>خصص نص الرسالة ومظهر صفحة الطلب المستخدمة لجميع طلبات متجرك.</p></div>${dashboardIcon("orderLink")}</div>
        <form data-submit="order-link-template" class="order-link-form">
          <div class="order-source-picker" role="tablist" aria-label="مصدر معلومات الطلب">
            <button type="button" class="${draft.sourceMode === "existing" ? "active" : ""}" data-action="order-source-mode" data-value="existing">اشتراك موجود</button>
            <button type="button" class="${draft.sourceMode === "customer" ? "active" : ""}" data-action="order-source-mode" data-value="customer">اختيار حسب العميل</button>
            <button type="button" class="${draft.sourceMode === "manual" ? "active" : ""}" data-action="order-source-mode" data-value="manual">إضافة يدوية</button>
          </div>
          <div class="order-profile-grid">
            <label class="field"><span>اسم القالب</span><input class="input" name="templateName" data-order-field="templateName" value="${escapeHtml(draft.templateName)}" placeholder="قالب معلومات الطلب"></label>
            <label class="field"><span>اسم المتجر</span><input class="input" name="storeName" data-order-field="storeName" value="${escapeHtml(draft.storeName)}" required></label>
            <div class="order-store-logo-field">${storeLogoEditor(draft.logoUrl || profile.logoUrl, draft.logoBorderRadius ?? profile.logoBorderRadius)}</div>
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
      <aside class="card order-link-preview-panel"><div class="section-head"><div><h2>معاينة صفحة العميل</h2><p>نفس مكوّن الصفحة الفعلية، ببيانات الاشتراك المختار فقط.</p></div>${dashboardIcon("reports")}</div><div id="order-live-preview">${orderLinkPreviewSlides(selected, draft)}</div><p class="preview-note">لا ينشئ Renvix بيانات تجريبية. اختر اشتراكًا حقيقيًا أو أكمل الطلب اليدوي لعرض المعاينة.</p></aside>
    </section>
    <article class="card table-card section order-links-table-card order-links-table-card--links"><div class="section-head"><div><h2>الطلبات المحفوظة في القوالب <span class="saved-orders-count">${Number(links.length).toLocaleString("ar-SA")}</span></h2><p>كل الطلبات تستخدم الرابط الثابت للقالب، ويبحث العميل بينها برقم الطلب.</p></div></div>${savedOrdersContent}</article>
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
    if (storeSlug.startsWith("ord_")) {
      const payload = await fetchJson(`/api/public/order-portal/${encodeURIComponent(storeSlug)}?t=${encodeURIComponent(token)}`);
      state.publicOrder = payload.data;
      state.publicOrderKey = `${storeSlug}::${token}:false`;
      state.publicOrderPresentation = payload.data;
      return;
    }
    const payload = await fetchJson(`/api/public/order-link/${encodeURIComponent(storeSlug)}?t=${encodeURIComponent(token)}`);
    state.publicOrderPresentation = payload.presentation;
  } catch (error) {
    state.publicOrderPresentation = { error: error.message || "لم يتم العثور على الرابط أو أنه غير صالح.", reason: error.code };
  } finally {
    state.publicOrderPresentationLoading = false;
    render();
  }
}

let subscriptionCountdownTimer = null;
function bindSubscriptionCountdowns() {
  if (subscriptionCountdownTimer) clearInterval(subscriptionCountdownTimer);
  const loadedAt = Date.now();
  const update = () => document.querySelectorAll("[data-subscription-countdown]").forEach((node) => {
    const expiry = new Date(node.dataset.expiresAt || "").getTime();
    const serverNow = new Date(node.dataset.serverNow || "").getTime();
    if (!Number.isFinite(expiry) || !Number.isFinite(serverNow)) return;
    const remaining = Math.max(0, expiry - (serverNow + Date.now() - loadedAt));
    if (remaining <= 0) { node.textContent = "انتهى الاشتراك"; return; }
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    node.textContent = `${days} يوم و${hours} ساعة و${minutes} دقيقة`;
  });
  update();
  subscriptionCountdownTimer = setInterval(update, 60000);
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
  if (data?.items) queueMicrotask(bindSubscriptionCountdowns);
  return `<div class="public-order-page" style="--order-theme:${themeColor}">
    <header class="public-order-header"><div>${logo()}<span>منصة إدارة الاشتراكات الذكية</span></div><div><span class="order-bag">${dashboardIcon("orderLink")}</span><strong>${escapeHtml(storeName)}</strong><small>أهلًا بك في صفحة تتبع طلبك</small></div></header>
    <main class="public-order-main">
      ${state.publicOrderPresentationLoading && !presentation ? `<div class="loading-state">جاري تجهيز صفحة المتجر...</div>` : currentPresentation?.error && !presentation ? `<section class="public-order-error">${dashboardIcon("security")}<h2>${escapeHtml(currentPresentation.error)}</h2><p>تواصل مع المتجر للحصول على رابط جديد.</p></section>` : !data && presentation ? `<section class="public-order-entry">${publicOrderLookupCard(presentation, orderNumber)}</section>` : ""}
      ${state.publicOrderLoading ? `<div class="loading-state">جاري التحقق من الرابط والطلب...</div>` : currentOrder?.error ? `<section class="public-order-error">${dashboardIcon("security")}<h2>${escapeHtml(currentOrder.error)}</h2><p>تحقق من رقم الطلب أو تواصل مع المتجر للحصول على رابط جديد.</p><button class="btn btn-secondary" data-action="clear-public-order-error">المحاولة مرة أخرى</button></section>` : data ? `<section class="public-order-result">${orderInfoPreviewCard(null, state.orderLinkDraft, data)}<div class="public-order-actions">${data.store.supportPhone ? `<a class="btn order-themed-action" href="https://wa.me/${String(data.store.supportPhone).replace(/\D/g, "")}" target="_blank" rel="noreferrer">تواصل مع المتجر ${dashboardIcon("template")}</a>` : ""}<button class="btn btn-secondary" data-action="copy-public-order-number" data-value="${escapeHtml(data.order.orderNumber)}">نسخ رقم الطلب ${dashboardIcon("orderLink")}</button></div></section>` : ""}
    </main>
    <footer class="public-order-footer"><span>سياسة الخصوصية</span><span>الشروط والأحكام</span><span>الدعم الفني</span><span>تواصل معنا</span><small>© 2026 Renvix. جميع الحقوق محفوظة.</small></footer>
  </div>`;
}

async function loadPublicSallaPage() {
  const publicId = state.route.split("/").filter(Boolean)[1] || "";
  const token = state.query.get("t") || "";
  const key = `${publicId}:${token}`;
  if (!publicId || !token || state.publicSallaPageLoading || state.publicSallaPageKey === key) return;
  state.publicSallaPageLoading = true;
  state.publicSallaPageKey = key;
  state.publicSallaPage = null;
  try {
    const payload = await fetchJson(`/api/public/salla-page/${encodeURIComponent(publicId)}?t=${encodeURIComponent(token)}`);
    state.publicSallaPage = payload.data;
  } catch (error) {
    state.publicSallaPage = { error: error.message || "الرابط غير صالح أو انتهت صلاحيته." };
  } finally {
    state.publicSallaPageLoading = false;
    render();
  }
}

function publicSallaPage() {
  const publicId = state.route.split("/").filter(Boolean)[1] || "";
  const token = state.query.get("t") || "";
  const key = `${publicId}:${token}`;
  const data = state.publicSallaPageKey === key ? state.publicSallaPage : null;
  if (token && state.publicSallaPageKey !== key && !state.publicSallaPageLoading) queueMicrotask(() => loadPublicSallaPage());
  const snapshot = data?.snapshot || {};
  const invoice = snapshot.invoice || {};
  const order = snapshot.order || {};
  const store = snapshot.store || {};
  const theme = safeOrderLinkColor(data?.branding?.themeColor || "#2563EB");
  const isInvoice = data?.pageType === "invoice";
  const isDigital = data?.pageType === "digital";
  const digital = snapshot.digital || {};
  if (isDigital && data && digital.showCountdown !== false) queueMicrotask(bindDigitalProductCountdowns);
  const money = (value) => value == null || value === "" ? "—" : `${Number(value).toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ${escapeHtml(invoice.currency || "SAR")}`;
  const rows = (snapshot.items || []).map((item) => `<tr><td>${escapeHtml(item.name || "—")}</td><td>${Number(item.quantity || 1).toLocaleString("ar-SA")}</td><td>${money(item.unitPrice)}</td><td>${money(item.total)}</td></tr>`).join("");
  return `<div class="salla-public-page" style="--salla-public-theme:${theme}">
    <header class="salla-public-header">${logo()}<div><strong>${escapeHtml(store.name || "Renvix")}</strong><small>${isInvoice ? "فاتورة إلكترونية آمنة" : "صفحة معلومات الطلب الآمنة"}</small></div></header>
    <main class="salla-public-main">
      ${state.publicSallaPageLoading && !data ? `<div class="loading-state">جاري التحقق من الرابط...</div>` : data?.error ? `<section class="public-order-error">${dashboardIcon("security")}<h2>${escapeHtml(data.error)}</h2><p>تواصل مع المتجر للحصول على رابط جديد.</p></section>` : data ? `<section class="salla-public-card">
        <span class="salla-public-status">${dashboardIcon(isInvoice ? "billing" : "orderLink")} رابط موثّق وآمن</span>
        <h1>${isInvoice ? `فاتورة رقم ${escapeHtml(invoice.number || "—")}` : isDigital ? escapeHtml(digital.title || "منتجاتك الرقمية جاهزة") : "تم تنفيذ طلبك بنجاح"}</h1>
        <p>${isDigital ? escapeHtml(digital.content || "استخدم البيانات التالية للوصول إلى منتجك الرقمي بأمان.") : `مرحبًا ${escapeHtml(snapshot.customer?.name || "عميلنا")}، هذه البيانات مأخوذة من سجل سلة المرتبط بمتجرك.`}</p>
        <div class="salla-public-summary">
          <div><span>رقم الطلب</span><strong>${escapeHtml(order.number || order.id || "—")}</strong></div>
          ${isInvoice ? `<div><span>تاريخ الفاتورة</span><strong>${escapeHtml(invoice.date ? new Date(invoice.date).toLocaleDateString("ar-SA") : "—")}</strong></div><div><span>حالة الدفع</span><strong>${escapeHtml(invoice.paymentStatus || "—")}</strong></div><div><span>الإجمالي</span><strong>${money(invoice.total)}</strong></div>` : ""}
        </div>
        ${rows ? `<div class="salla-public-table-wrap"><table><thead><tr><th>المنتج</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}
        ${isDigital ? `<div class="salla-public-digital-assets">${(digital.assets || []).map((asset) => `<article><h2>${escapeHtml(asset.name || "منتج رقمي")}</h2><dl>${asset.code ? `<div><dt>كود التفعيل</dt><dd dir="ltr">${escapeHtml(asset.code)}</dd></div>` : ""}${asset.email ? `<div><dt>البريد أو اسم المستخدم</dt><dd dir="ltr">${escapeHtml(asset.email)}</dd></div>` : ""}${asset.password ? `<div><dt>كلمة المرور</dt><dd dir="ltr">${escapeHtml(asset.password)}</dd></div>` : ""}</dl><a class="btn order-themed-action" href="${escapeHtml(asset.url)}" target="_blank" rel="noopener noreferrer">فتح المنتج بأمان</a>${digital.showCountdown !== false && asset.expiresAt ? `<p class="salla-public-digital-timer">المدة المتبقية: <strong data-digital-countdown data-expires-at="${escapeHtml(asset.expiresAt)}">—</strong></p>` : ""}</article>`).join("")}</div>` : ""}
        ${!isInvoice && data.subscriptions?.length ? `<div class="salla-public-subscriptions">${data.subscriptions.map((item) => `<article><span>${escapeHtml(item.serviceName || item.planName || "الاشتراك")}</span><strong>${Number(item.remainingDays || 0).toLocaleString("ar-SA")} يومًا متبقيًا</strong><small>${escapeHtml(item.startsAt ? new Date(item.startsAt).toLocaleDateString("ar-SA") : "—")} — ${escapeHtml(item.expiresAt ? new Date(item.expiresAt).toLocaleDateString("ar-SA") : "—")}</small></article>`).join("")}</div>` : ""}
        ${isInvoice ? `<div class="salla-public-totals"><span>المجموع الفرعي <b>${money(invoice.subtotal)}</b></span><span>الخصم <b>${money(invoice.discounts)}</b></span><span>الضريبة <b>${money(invoice.tax)}</b></span><span>الشحن <b>${money(invoice.shipping)}</b></span><strong>الإجمالي <b>${money(invoice.total)}</b></strong></div>` : ""}
      </section>` : ""}
    </main>
    <footer class="public-order-footer"><small>© 2026 Renvix — صفحة محمية ولا تحتوي على معرفات داخلية قابلة للتخمين.</small></footer>
  </div>`;
}

function whatsappSourceLabel(source) {
  return ({
    renewal_reminder: "رسائل التجديد",
    order_information: "إرسال معلومات الطلب",
    campaign: "الحملات",
    manual_message: "الرسائل اليدوية",
    interactive_message: "الرسائل التفاعلية",
    automation: "الأتمتة",
    test_message: "رسائل الاختبار",
    other: "أخرى"
  })[source] || "أخرى";
}

function billingPlanCatalog(plans, current) {
  if (!plans.length) return emptyState("لا توجد باقات مفعلة", "يرجى التواصل مع الدعم لتهيئة باقات المنصة.", "مركز الدعم", "/support");
  const currentSlug = current?.planSlug || "free";
  return `<div class="dashboard-plan-grid">${plans.map((plan) => {
    const isCurrent = plan.slug === currentSlug || (plan.slug === "free" && currentSlug === "trial");
    const planFeatures = Array.isArray(plan.features) && plan.features.length ? plan.features : [
      `${Number(plan.emailMessageLimit || 0).toLocaleString("ar-SA")} رسالة بريد إلكتروني`,
      `${Number(plan.customersLimit || 0).toLocaleString("ar-SA")} عميل`,
      `${Number(plan.whatsappChannelsLimit || 0).toLocaleString("ar-SA")} قناة واتساب رسمية`,
      "رسائل واتساب حسب الاستخدام",
      `${Number(plan.storageLimitMb || 100).toLocaleString("ar-SA")} MB تخزين`
    ];
    return `<article class="dashboard-plan ${isCurrent ? "current" : ""}">
      <span class="status ${isCurrent ? "success" : "info"}">${isCurrent ? "خطتك الحالية" : "متاحة"}</span>
      <h3>${escapeHtml(plan.name)}</h3>
      <p class="plan-price">${plan.customPricing ? "مخصص" : formatMoney(state.billing === "yearly" ? plan.yearlyPriceSar : plan.monthlyPriceSar)} <small>${plan.customPricing ? "تواصل معنا" : `/ ${state.billing === "yearly" ? "سنة" : "شهر"}`}</small></p>
      <ul class="check-list">${planFeatures.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul>
      <p class="whatsapp-usage-note" title="تتم فوترة رسائل واتساب الرسمية مباشرة عبر Meta، ولا تبيع Renvix رصيد واتساب.">${dashboardIcon("whatsapp")} ربط واتساب الرسمي وإدارته مباشرة عبر Meta</p>
      <button class="btn ${isCurrent ? "btn-secondary" : "btn-primary"}" ${isCurrent ? "disabled" : 'data-link="/support"'}>${isCurrent ? "الخطة الحالية" : plan.customPricing ? "تواصل معنا" : "طلب الترقية"}</button>
    </article>`;
  }).join("")}</div>`;
}

function whatsappBillingCard(whatsapp = {}, expanded = false) {
  const meta = whatsapp.metaConnection || {};
  const metaStatus = meta.status === "connected"
    ? "متصل بـ Meta"
    : meta.status === "attention" ? "يحتاج مراجعة" : "غير مربوط";
  const metaTone = meta.status === "connected" ? "good" : meta.status === "attention" ? "low" : "empty";
  const sourceRows = Array.isArray(whatsapp.bySource) ? whatsapp.bySource : [];
  const max = Math.max(1, ...sourceRows.map((row) => Number(row.count || 0)));
  return `<article class="card channel-usage-card whatsapp-channel-card">
    <div class="channel-usage-title"><span class="channel-usage-icon whatsapp">${dashboardIcon("whatsapp")}</span><div><h2>استخدام واتساب</h2><p>بيانات الاستخدام وحالة الربط متزامنة مع Meta، والفوترة تتم مباشرة من Meta.</p></div><span class="status success">إدارة Meta</span></div>
    <div class="channel-usage-summary">
      <div><span>الرسائل هذا الشهر</span><strong>${Number(whatsapp.messagesThisMonth || 0).toLocaleString("ar-SA")}</strong></div>
      <div><span>المقبولة لدى Meta</span><strong>${Number(whatsapp.acceptedThisMonth || 0).toLocaleString("ar-SA")}</strong></div>
      <div><span>فشل الإرسال</span><strong>${Number(whatsapp.failedThisMonth || 0).toLocaleString("ar-SA")}</strong></div>
      <div><span>حالة الربط</span><strong class="wallet-health ${metaTone}">${metaStatus}</strong></div>
    </div>
    <button class="channel-details-toggle" data-action="toggle-whatsapp-usage">${expanded ? "إخفاء التفاصيل" : "عرض التفاصيل"} ${dashboardIcon("chevron")}</button>
    ${expanded ? `<div class="whatsapp-usage-details"><h3>تفاصيل الاستخدام</h3>${sourceRows.length ? sourceRows.map((row) => `<div class="usage-source-row"><span>${whatsappSourceLabel(row.source)}</span><div class="usage-source-progress"><i style="width:${Math.round(Number(row.count || 0) / max * 100)}%"></i></div><strong>${Number(row.count || 0).toLocaleString("ar-SA")} رسالة</strong><small>${Number(row.successful || 0).toLocaleString("ar-SA")} مقبولة · ${Number(row.failed || 0).toLocaleString("ar-SA")} فاشلة</small></div>`).join("") : `<p class="muted">لا يوجد استخدام واتساب مسجل خلال هذه الدورة.</p>`}<small class="billing-safe-note">تعرض Renvix سجلات الإرسال وحالة الربط فقط. الأسعار والفوترة وإدارة الرصيد تتم مباشرة داخل حساب Meta الخاص بك.</small></div>` : ""}
  </article>`;
}

let digitalProductCountdownTimer = null;
function bindDigitalProductCountdowns() {
  if (digitalProductCountdownTimer) clearInterval(digitalProductCountdownTimer);
  const update = () => document.querySelectorAll("[data-digital-countdown]").forEach((node) => {
    const remaining = Math.max(0, new Date(node.dataset.expiresAt || "").getTime() - Date.now());
    if (!Number.isFinite(remaining) || remaining <= 0) { node.textContent = "انتهت المدة"; return; }
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    node.textContent = `${days ? `${days} يوم و` : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  });
  update();
  digitalProductCountdownTimer = setInterval(update, 1000);
}

function emailBillingCard(usage) {
  return `<div class="email-channel-card">${messageUsageCard(usage)}</div>`;
}

function billingInvoices(invoices = []) {
  return `<article class="card table-card billing-tab-panel"><div class="section-head"><div><h2>الفواتير</h2><p>لا تظهر إلا الفواتير الصادرة والمسجلة فعليًا.</p></div></div>${invoices.length ? simpleTable(["رقم الفاتورة", "التاريخ", "الوصف", "المبلغ", "الحالة"], invoices.map((invoice) => [invoice.number, invoice.date, invoice.description, formatMoney(invoice.amount), status(invoice.status)])) : emptyState("لا توجد فواتير بعد", "ستظهر الفواتير هنا بعد إتمام أول عملية دفع موثقة.")}</article>`;
}

function emailCreditPanel(emailUsage = {}) {
  const remaining = Math.max(0, Number(emailUsage.remaining || 0));
  return `<article class="card billing-topup-panel billing-tab-panel"><div class="section-head"><div><h2>شحن رصيد رسائل البريد</h2><p>رصيد البريد مرتبط بحد باقتك. اطلب زيادة الرصيد أو ترقية الباقة دون التأثير على ربط واتساب الرسمي.</p></div><strong>${remaining.toLocaleString("ar-SA")} رسالة متبقية</strong></div><div class="topup-amounts"><button class="topup-option" data-link="/dashboard/support"><strong>طلب رصيد إضافي</strong><span>يراجعه فريق الدعم</span></button><button class="topup-option" data-action="billing-tab" data-tab="plans"><strong>ترقية الباقة</strong><span>حد بريد أعلى</span></button></div><div class="billing-safe-note">${dashboardIcon("security")} لا تتم إضافة رسوم أو أرصدة وهمية. سيُوثق أي رصيد إضافي ضمن باقتك وفواتير حسابك.</div></article>`;
}

function billingWorkspacePage() {
  if (state.billingOverview === null || state.messageUsage === null) {
    return dashboardShell(`${pageTitle("الفوترة والباقات")}<p class="page-kicker">جاري تحميل بيانات خطتك واستخدامك الموثق...</p><div class="card loading-state" role="status" aria-live="polite">جاري مزامنة بيانات الفوترة</div>`);
  }
  if (state.billingOverview?.error || state.messageUsage?.error) {
    return dashboardShell(`${pageTitle("الفوترة والباقات")}<p class="page-kicker">تعذر تحميل بيانات الفوترة الموثقة.</p>${emptyState("تعذر تحميل بيانات الفوترة", "لم نعرض قيمًا افتراضية حتى لا تظهر أرقام غير صحيحة.", "إعادة المحاولة", "billing-reload")}`);
  }
  const data = state.billingOverview;
  const current = data.current || {};
  const plans = data.plans || [];
  const usage = state.messageUsage && !state.messageUsage.error ? state.messageUsage : data.usage || null;
  const emailUsage = usage?.channels?.email || data.emailUsage || usage || {};
  const whatsapp = data.whatsappUsage || {};
  const storage = data.storage || { usedMb: 0, limitMb: 100, percent: 0 };
  const days = current.currentPeriodEnd ? Math.max(0, Math.ceil((new Date(current.currentPeriodEnd) - Date.now()) / 86400000)) : 0;
  const invoices = data.invoices || [];
  const tab = ["overview", "plans", "whatsapp", "email", "topup", "invoices"].includes(state.billingTab) ? state.billingTab : "overview";
  const consumedEmail = Number(emailUsage.used || 0) + Number(emailUsage.reserved || 0);
  const emailLimit = Number(emailUsage.limit || 0);
  const tabs = [
    ["overview", "نظرة عامة"], ["plans", "الباقات"], ["whatsapp", "استخدام واتساب"],
    ["email", "استخدام البريد"], ["topup", "شحن رصيد رسائل البريد"], ["invoices", "الفواتير"]
  ];
  const overview = `<section class="billing-stats-grid">
    <article class="card billing-stat"><span>${dashboardIcon("subscriptions")}</span><div><small>الخطة الحالية</small><strong>${escapeHtml(current.planName || "تجربة مجانية")}</strong><em>${escapeHtml(current.status || "trial")}</em></div></article>
    <article class="card billing-stat purple"><span>${dashboardIcon("template")}</span><div><small>الأيام المتبقية</small><strong>${days.toLocaleString("ar-SA")}</strong><em>${current.currentPeriodEnd ? `حتى ${new Date(current.currentPeriodEnd).toLocaleDateString("ar-SA")}` : "لا توجد دورة نشطة"}</em></div></article>
    <article class="card billing-stat whatsapp"><span>${dashboardIcon("whatsapp")}</span><div><small>رسائل واتساب هذا الشهر</small><strong>${Number(whatsapp.messagesThisMonth || 0).toLocaleString("ar-SA")}</strong><em>حسب الاستخدام</em></div></article>
    <article class="card billing-stat"><span>${dashboardIcon("email")}</span><div><small>استهلاك البريد الإلكتروني</small><strong>${consumedEmail.toLocaleString("ar-SA")} / ${emailLimit.toLocaleString("ar-SA")}</strong><em>${Number(emailUsage.percentage || 0).toLocaleString("ar-SA")}% مستخدم</em></div></article>
    <article class="card billing-stat success"><span>${dashboardIcon("email")}</span><div><small>رصيد رسائل البريد</small><strong>${Math.max(0, Number(emailUsage.remaining || 0)).toLocaleString("ar-SA")}</strong><em>رسالة متبقية</em></div></article>
    <article class="card billing-stat"><span>${dashboardIcon("billing")}</span><div><small>مساحة التخزين</small><strong>${storage.usedMb} / ${storage.limitMb} MB</strong><em>${storage.percent}% مستخدم</em></div></article>
  </section>`;
  let panel = "";
  if (tab === "overview") panel = `${overview}<section class="billing-channel-grid section">${whatsappBillingCard(whatsapp, state.whatsappUsageExpanded)}${emailBillingCard(usage)}</section><section class="section billing-workspace"><article class="card plan-catalog"><div class="section-head"><div><h2>اختر الباقة المناسبة لاحتياجاتك</h2><p>حد البريد مرتبط بالباقة، بينما استخدام واتساب وفوترته يُداران مباشرة عبر Meta.</p></div></div>${billingPlanCatalog(plans, current)}</article><aside class="billing-side">${emailCreditPanel(emailUsage)}<article class="card invoice-summary"><h2>ملخص الفاتورة</h2><div><span>الخطة الحالية</span><strong>${escapeHtml(current.planName || "تجربة مجانية")}</strong></div><div><span>دورة الفاتورة</span><strong>${escapeHtml(current.billingCycle || "monthly")}</strong></div><div><span>التجديد القادم</span><strong>${current.currentPeriodEnd ? new Date(current.currentPeriodEnd).toLocaleDateString("ar-SA") : "غير متوفر"}</strong></div></article></aside></section>`;
  if (tab === "plans") panel = `<article class="card plan-catalog billing-tab-panel"><div class="section-head"><div><h2>اختر الباقة المناسبة لاحتياجاتك</h2><p>الباقات الشهرية تشمل المنصة والبريد، بينما واتساب الرسمي يُدار ويُحاسب مباشرة عبر Meta.</p></div></div>${billingPlanCatalog(plans, current)}</article>`;
  if (tab === "whatsapp") panel = `<section class="billing-tab-panel">${whatsappBillingCard(whatsapp, true)}</section>`;
  if (tab === "email") panel = `<section class="billing-tab-panel">${emailBillingCard(usage)}</section>`;
  if (tab === "topup") panel = emailCreditPanel(emailUsage);
  if (tab === "invoices") panel = billingInvoices(invoices);
  return dashboardShell(`${pageTitle("الفوترة والباقات")}<p class="page-kicker">إدارة خطتك ورصيد البريد والفواتير، مع عرض استخدام واتساب المتزامن من Meta.</p>
    <nav class="billing-tabs" aria-label="أقسام الفوترة">${tabs.map(([key, label]) => `<button class="${tab === key ? "active" : ""}" data-action="billing-tab" data-tab="${key}">${label}</button>`).join("")}</nav>${panel}`);
}

function settingsPage() {
  if (state.accountSettings === null) {
    return dashboardShell(`${pageTitle("الإعدادات")}
      <p class="page-kicker">إدارة معلومات الحساب والأمان وتفضيلات الواجهة.</p>
      <div class="settings-loading-grid" role="status" aria-live="polite" aria-label="جاري تحميل إعدادات الحساب">
        ${Array.from({ length: 4 }, () => `<article class="card settings-loading-card"><span class="settings-loading-icon"></span><div><i></i><b></b><b></b><b></b></div></article>`).join("")}
      </div>`);
  }
  if (state.accountSettings?.error) {
    return dashboardShell(`${pageTitle("الإعدادات")}
      <p class="page-kicker">إدارة معلومات الحساب والأمان وتفضيلات الواجهة.</p>
      ${emptyState("تعذر تحميل إعدادات الحساب", escapeHtml(state.accountSettings.error), "إعادة المحاولة", "reload-settings")}`);
  }
  const remote = state.accountSettings.settings || {};
  const storage = state.accountSettings.storage || { usedMb: 0, limitMb: 100, percent: 0, breakdown: [] };
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
      <article class="card settings-panel settings-security-card"><div class="settings-panel-head">${dashboardIcon("security")}<div><h2>الأمان</h2><p class="muted">حافظ على أمان حسابك بتحديث كلمة المرور وإعدادات الحماية.</p></div></div><form data-submit="password" class="security-password-form"><label class="field"><span>كلمة المرور الحالية</span><input class="input" name="currentPassword" type="password" autocomplete="current-password" required></label><label class="field"><span>كلمة المرور الجديدة</span><input class="input" name="newPassword" type="password" autocomplete="new-password" minlength="10" required></label><label class="field"><span>تأكيد كلمة المرور</span><input class="input" name="confirmPassword" type="password" autocomplete="new-password" minlength="10" required></label><button class="btn btn-primary">تحديث كلمة المرور</button></form><div class="setting-row"><div><strong>دخول الحساب OTP</strong><p class="muted">رمز مؤقت عند تسجيل الدخول لحماية حسابك</p></div><label class="switch-control"><input type="checkbox" data-action="mfa-toggle" ${remote.mfaEnabled ? "checked" : ""}><span></span></label></div><button class="btn btn-secondary sessions-button" data-action="manage-sessions">إدارة الجلسات النشطة</button></article>
      <article class="card settings-panel settings-interface-card"><div class="settings-panel-head">${dashboardIcon("settings")}<div><h2>الواجهة واللغة</h2><p class="muted">تخصيص مظهر وكثافة ولغة الواجهة.</p></div></div><div class="settings-select-grid"><label class="field"><span>اللغة</span><select class="select" data-action="preference-select" data-preference="language"><option value="ar" ${state.language === "ar" ? "selected" : ""}>◉ العربية</option><option value="en" ${state.language === "en" ? "selected" : ""}>◉ English</option></select></label><label class="field"><span>المظهر</span><select class="select theme-preference-select" data-action="preference-select" data-preference="theme"><option value="light" ${state.theme === "light" ? "selected" : ""}>☀ شمسي (فاتح)</option><option value="dark" ${state.theme === "dark" ? "selected" : ""}>☾ قمري (داكن)</option><option value="system" ${state.theme === "system" ? "selected" : ""}>النظام</option></select></label><label class="field"><span>كثافة الواجهة</span><select class="select" data-action="preference-select" data-preference="interfaceDensity"><option value="comfortable" ${state.interfaceDensity === "comfortable" ? "selected" : ""}>مريحة</option><option value="medium" ${state.interfaceDensity === "medium" ? "selected" : ""}>متوسطة</option><option value="compact" ${state.interfaceDensity === "compact" ? "selected" : ""}>مضغوطة</option></select></label></div></article>
      <article class="card settings-panel settings-notifications-card"><div class="settings-panel-head">${dashboardIcon("notifications")}<div><h2>الإشعارات</h2><p class="muted">اختر الإشعارات التي ترغب في استلامها.</p></div></div>${notificationSettingToggle("renewalBillingNotifications", "إشعارات التجديد والفواتير", notifications.renewalBillingNotifications !== false, Boolean(state.notificationPreferenceSaving))}${notificationSettingToggle("securityNotifications", "التنبيهات الأمنية الأساسية", true, true)}${notificationSettingToggle("productUpdates", "تقارير النظام والتحديثات", notifications.productUpdates !== false, Boolean(state.notificationPreferenceSaving))}${notificationSettingToggle("messageFailureNotifications", "تنبيهات فشل الرسائل", notifications.messageFailureNotifications !== false, Boolean(state.notificationPreferenceSaving))}<small class="security-always-note">التنبيهات الأمنية الأساسية مفعلة دائمًا لحماية حسابك.</small></article>
      <article class="card settings-panel storage-panel ${storage.isLimitReached ? "is-limit-reached" : ""}"><div class="settings-panel-head">${dashboardIcon("billing")}<div><h2>مساحة الحساب</h2><p class="muted">المساحة الفعلية لبيانات عملائك واشتراكاتك وروابطك وسجلاتك.</p></div></div><div class="storage-summary"><strong>${storage.usedMb} MB</strong><span>${state.language === "en" ? "of" : "من"} ${storage.limitMb} MB</span></div><div class="storage-progress"><i style="width:${Number(storage.progressPercent ?? Math.min(100, Number(storage.percent || 0)))}%"></i></div><small>${storage.percent}% مستخدم من حد الباقة الحالية</small>${storage.isLimitReached ? `<div class="storage-capacity-warning">${dashboardIcon("warning")}<div><strong>وصلت إلى حد مساحة الباقة</strong><span>أوقفت المنصة العمليات الجديدة التي تحتاج مساحة. طوّر الباقة أو احذف بيانات لا تحتاجها.</span></div></div>` : ""}<div class="storage-breakdown">${storage.breakdown?.length ? storage.breakdown.map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${item.mb} MB</strong></div>`).join("") : `<p class="muted">لا توجد بيانات مخزنة حتى الآن.</p>`}</div><button class="btn ${storage.isLimitReached ? "btn-primary" : "btn-secondary"}" data-link="/dashboard/billing">${storage.isLimitReached ? "ترقية الباقة" : "عرض حدود الباقات"}</button></article>
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
    <header class="modal-head"><h2>${title}</h2><button class="btn btn-ghost icon-btn" type="button" data-action="close-modal" aria-label="إغلاق" title="إغلاق">×</button></header>
    <div class="modal-body">${body}</div>
  </aside></div>`;
  localizeElement(portal);
}

function closePortal() {
  portal.innerHTML = "";
  if (state.mfaSetupPending) {
    state.mfaSetupPending = false;
    void fetch("/api/settings/security/mfa/setup", { method: "DELETE", credentials: "include" }).catch(() => null);
  }
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
  const title = translatedPhrase(String(message || "").trim() || "تم تنفيذ العملية");
  const description = options.description ? translatedPhrase(options.description) : "";
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
  item.innerHTML = `<span class="toast-icon">${toastIcon(normalizedType)}</span><span class="toast-copy"><strong>${escapeHtml(title)}</strong>${description ? `<small>${escapeHtml(description)}</small>` : ""}</span><button class="toast-close" type="button" aria-label="${state.language === "en" ? "Close notification" : "إغلاق التنبيه"}">×</button><i class="toast-progress"></i>`;
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
  error.textContent = translatedPhrase(message);
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

function syncSubscriptionDeliveryFields(form, fillFromCustomer = false) {
  if (!form?.matches("[data-submit='subscription']")) return;
  const channel = form.elements.reminderChannel?.value === "email" ? "email" : "whatsapp";
  const whatsappInput = form.elements.whatsappNumber;
  const emailInput = form.elements.email;
  const whatsappField = whatsappInput?.closest("[data-subscription-contact='whatsapp']");
  const emailField = emailInput?.closest("[data-subscription-contact='email']");

  if (fillFromCustomer) {
    const customer = (Array.isArray(state.dbCustomers) ? state.dbCustomers : [])
      .find((item) => item.id === form.elements.customerId?.value);
    if (whatsappInput) whatsappInput.value = customer?.whatsappNumber || customer?.phone || "";
    if (emailInput) emailInput.value = customer?.email || "";
  }

  if (whatsappInput) {
    whatsappInput.required = channel === "whatsapp";
    whatsappInput.placeholder = channel === "whatsapp" ? "مطلوب — مثال: 9665XXXXXXXX" : "اختياري — مثال: 9665XXXXXXXX";
  }
  if (emailInput) {
    emailInput.required = channel === "email";
    emailInput.placeholder = channel === "email" ? "مطلوب — name@example.com" : "اختياري — name@example.com";
  }
  whatsappField?.classList.toggle("is-required", channel === "whatsapp");
  emailField?.classList.toggle("is-required", channel === "email");
  const whatsappRequirement = whatsappField?.querySelector("span b");
  const emailRequirement = emailField?.querySelector("span b");
  if (whatsappRequirement) whatsappRequirement.textContent = channel === "whatsapp" ? "مطلوب" : "اختياري";
  if (emailRequirement) emailRequirement.textContent = channel === "email" ? "مطلوب" : "اختياري";
  const whatsappHint = whatsappField?.querySelector("[data-contact-hint]");
  const emailHint = emailField?.querySelector("[data-contact-hint]");
  if (whatsappHint) whatsappHint.textContent = channel === "whatsapp"
    ? "مطلوب لإرسال التذكيرات عبر واتساب."
    : "اختياري كقناة تواصل إضافية.";
  if (emailHint) emailHint.textContent = channel === "email"
    ? "مطلوب لإرسال التذكيرات عبر البريد الإلكتروني."
    : "اختياري كقناة تواصل إضافية.";
}

function subscriptionForm(row = {}, editId = "") {
  const customers = Array.isArray(state.dbCustomers) ? state.dbCustomers : [];
  if (!customers.length) return emptyState("أضف عميلًا أولًا", "يجب اختيار عميل حقيقي قبل إنشاء الاشتراك.", "إضافة عميل", "add-customer");
  const reminderChannel = row.reminderChannel === "email" ? "email" : "whatsapp";
  const selectedCustomer = customers.find((customer) => customer.id === row.customerId) || customers[0] || {};
  const whatsappNumber = row.whatsappNumber || selectedCustomer.whatsappNumber || selectedCustomer.phone || "";
  const email = row.email || selectedCustomer.email || "";
  return `<form data-submit="subscription" data-id="${editId}" class="form-grid ${editId ? "subscription-edit-form" : "manual-subscription-form"}">
    <label class="field"><span>العميل</span><select class="select" name="customerId" data-action="subscription-customer" ${editId ? "disabled" : ""} required>${customers.map((customer) => `<option value="${customer.id}" ${row.customerId === customer.id ? "selected" : ""}>${escapeHtml(customer.name)}</option>`).join("")}</select></label>
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
        <div><strong id="subscription-delivery-title">قناة تذكير التجديد</strong><small>اختر قناة الإرسال وأكمل بيانات التواصل المطلوبة. تتحكم بإعدادات الجدولة من تبويب إعدادات التذكير.</small></div>
        <span class="delivery-secure-badge">إرسال آمن</span>
      </div>
      <div class="subscription-delivery-grid">
        <label class="field"><span>قناة الإرسال</span><select class="select" name="reminderChannel" data-action="subscription-reminder-channel">
          <option value="whatsapp" ${reminderChannel === "whatsapp" ? "selected" : ""}>واتساب</option>
          <option value="email" ${reminderChannel === "email" ? "selected" : ""}>البريد الإلكتروني</option>
        </select><small>تُستخدم القناة نفسها عند الإرسال اليدوي أو التلقائي.</small></label>
        <label class="field subscription-contact-field ${reminderChannel === "whatsapp" ? "is-required" : ""}" data-subscription-contact="whatsapp"><span>رقم واتساب <b>${reminderChannel === "whatsapp" ? "مطلوب" : "اختياري"}</b></span><input class="input" type="tel" inputmode="tel" name="whatsappNumber" dir="ltr" value="${escapeHtml(whatsappNumber)}" placeholder="${reminderChannel === "whatsapp" ? "مطلوب — مثال: 9665XXXXXXXX" : "اختياري — مثال: 9665XXXXXXXX"}" ${reminderChannel === "whatsapp" ? "required" : ""}><small data-contact-hint>${reminderChannel === "whatsapp" ? "مطلوب لإرسال التذكيرات عبر واتساب." : "اختياري كقناة تواصل إضافية."}</small></label>
        <label class="field subscription-contact-field ${reminderChannel === "email" ? "is-required" : ""}" data-subscription-contact="email"><span>البريد الإلكتروني <b>${reminderChannel === "email" ? "مطلوب" : "اختياري"}</b></span><input class="input" type="email" name="email" dir="ltr" value="${escapeHtml(email)}" placeholder="${reminderChannel === "email" ? "مطلوب — name@example.com" : "اختياري — name@example.com"}" ${reminderChannel === "email" ? "required" : ""}><small data-contact-hint>${reminderChannel === "email" ? "مطلوب لإرسال التذكيرات عبر البريد الإلكتروني." : "اختياري كقناة تواصل إضافية."}</small></label>
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
      logoUrl: draft.logoUrl || null,
      logoBorderRadius: safeStoreLogoRadius(draft.logoBorderRadius),
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
  const templatePayload = await fetchJson("/api/order-information/template", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  state.orderLinkDraft = {
    ...state.orderLinkDraft,
    templateId: templatePayload.item.id,
    templateName: templatePayload.item.name,
    templateLinkId: state.orderLinkDraft.templateLinkId || templatePayload.item.templateLinkId || "",
    publicUrl: state.orderLinkDraft.publicUrl || ""
  };
  rememberOrderLinkTemplateSelection(templatePayload.item.id);
  state.orderLinkTemplates = null;
  syncRouteData();
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
    await loadRemotePage(`orderLinksAfterCreate:${created.id}`, "/api/order-link/list", "orderLinks", undefined, { renderOnComplete: false });
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
  if (state.orderLinkDraft.publicUrl && (state.orderLinkDraft.templateLinkId || state.orderLinkDraft.linkId)) {
    return {
      id: state.orderLinkDraft.templateLinkId || state.orderLinkDraft.linkId,
      publicUrl: state.orderLinkDraft.publicUrl
    };
  }
  try {
    return await createCurrentOrderLink(trigger);
  } catch (error) {
    toast(error.message || "تعذر تجهيز رابط القالب", "danger");
    return null;
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
  const previous = {
    language: state.language,
    theme: state.theme,
    interfaceDensity: state.interfaceDensity || remote.interfaceDensity || "comfortable"
  };
  const next = {
    language: overrides.language === "en" ? "en" : overrides.language === "ar" ? "ar" : previous.language,
    theme: ["light", "dark", "system"].includes(overrides.theme) ? overrides.theme : previous.theme,
    interfaceDensity: ["comfortable", "medium", "compact"].includes(overrides.interfaceDensity)
      ? overrides.interfaceDensity
      : previous.interfaceDensity
  };
  const applyLocalState = (preferences) => {
    state.language = preferences.language;
    state.theme = preferences.theme;
    state.interfaceDensity = preferences.interfaceDensity;
    localStorage.setItem("renewpilot_locale", state.language);
    localStorage.setItem("renewpilot_theme", state.theme);
    localStorage.setItem("renewpilot_density", state.interfaceDensity);
    if (state.accountSettings?.settings) {
      state.accountSettings = {
        ...state.accountSettings,
        settings: { ...state.accountSettings.settings, ...preferences }
      };
    }
    applyPreferences();
    render();
  };

  applyLocalState(next);
  try {
    const payload = await fetchJson("/api/settings/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next)
    });
    const saved = payload.preferences || next;
    applyLocalState({
      language: saved.language === "en" ? "en" : "ar",
      theme: ["light", "dark", "system"].includes(saved.theme) ? saved.theme : "light",
      interfaceDensity: ["comfortable", "medium", "compact"].includes(saved.interfaceDensity)
        ? saved.interfaceDensity
        : "comfortable"
    });
    return saved;
  } catch (error) {
    if (!state.route.startsWith("/dashboard") && error.status === 401) return next;
    if (state.route.startsWith("/dashboard")) applyLocalState(previous);
    throw error;
  }
}

async function saveNotificationPreference(key, checked) {
  const remote = state.accountSettings?.settings || {};
  const previous = {
    renewalBillingNotifications: remote.notifications?.renewalBillingNotifications !== false,
    securityNotifications: true,
    productUpdates: remote.notifications?.productUpdates !== false,
    messageFailureNotifications: remote.notifications?.messageFailureNotifications !== false
  };
  const next = { ...previous, [key]: checked, securityNotifications: true };
  const applyNotificationState = (notifications) => {
    if (state.accountSettings?.settings) {
      state.accountSettings = {
        ...state.accountSettings,
        settings: {
          ...state.accountSettings.settings,
          notifications: { ...notifications, securityNotifications: true }
        }
      };
    }
  };

  state.notificationPreferenceSaving = key;
  applyNotificationState(next);
  render();
  try {
    const payload = await fetchJson("/api/settings/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        renewalBillingNotifications: next.renewalBillingNotifications,
        productUpdates: next.productUpdates,
        messageFailureNotifications: next.messageFailureNotifications
      })
    });
    applyNotificationState(payload.notifications || next);
    state.notificationPreferenceSaving = "";
    render();
    toast("تم حفظ تفضيلات الإشعارات");
  } catch (error) {
    applyNotificationState(previous);
    state.notificationPreferenceSaving = "";
    render();
    throw error;
  }
}

async function showSessionsDrawer() {
  openDrawer("إدارة الجلسات النشطة", `<div class="loading-state">جارٍ تحميل الجلسات...</div>`);
  try {
    const payload = await fetchJson("/api/settings/security/sessions");
    const rows = payload.sessions || [];
    openDrawer("إدارة الجلسات النشطة", `<div class="session-list">${rows.map((item) => `<div class="setting-row session-settings-row"><div><strong>${escapeHtml(item.device)}</strong><p class="muted">${escapeHtml(item.location)} · آخر نشاط ${new Date(item.lastActivityAt).toLocaleString("ar-SA")}</p></div>${item.current ? `<span class="status success">الجلسة الحالية</span>` : `<button class="btn btn-danger" data-action="revoke-session" data-id="${escapeHtml(item.id)}">إنهاء الجلسة</button>`}</div>`).join("") || `<p class="muted">لا توجد جلسات نشطة.</p>`}<button class="btn btn-secondary" data-action="revoke-other-sessions">إنهاء جميع الجلسات الأخرى</button></div>`);
  } catch (error) { openDrawer("إدارة الجلسات النشطة", `<div class="empty-state"><strong>تعذر تحميل الجلسات</strong><p>${escapeHtml(error.message)}</p></div>`); }
}

function startMfaSetup() {
  openModal("تفعيل دخول الحساب OTP", `<form data-submit="mfa-setup-start" class="grid"><div class="security-setup-step"><span>1</span><div><strong>تأكيد هويتك</strong><small>أدخل كلمة المرور الحالية قبل إنشاء مفتاح المصادقة.</small></div></div><label class="field"><span>كلمة المرور الحالية</span><input class="input" name="currentPassword" type="password" autocomplete="current-password" required autofocus></label><button class="btn btn-primary">متابعة</button></form>`);
}

async function requestMfaSetup(currentPassword) {
  try {
    const payload = await fetchJson("/api/settings/security/mfa/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword }) });
    state.mfaSetupPending = true;
    openModal("اربط تطبيق المصادقة", `<form data-submit="mfa-verify" class="grid"><div class="security-setup-step"><span>2</span><div><strong>اربط تطبيق المصادقة</strong><small>امسح الرمز ثم أدخل الرمز الحالي المكوّن من 6 أرقام.</small></div></div><img class="mfa-qr" src="${escapeHtml(payload.qrCode)}" alt="رمز إعداد دخول الحساب OTP"><div class="mfa-manual-key"><span>المفتاح اليدوي</span><code class="mfa-secret">${escapeHtml(payload.secret)}</code></div><label class="field"><span>رمز OTP</span><input class="input code-input" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button class="btn btn-primary">تأكيد التفعيل</button></form>`);
  } catch (error) { toast(error.message || "تعذر بدء إعداد دخول الحساب OTP", "danger"); }
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
  if (action === "support-filter") {
    state.supportFilter = target.dataset.filter || "all";
    state.supportTickets = null;
    syncRouteData(true);
    return render();
  }
  if (action === "support-open") {
    state.supportSelectedId = target.dataset.id || "";
    state.supportTicket = null;
    const url = new URL(location.href);
    if (state.supportSelectedId) url.searchParams.set("ticket", state.supportSelectedId);
    history.replaceState({}, "", url);
    try {
      await fetchJson(`/api/support/tickets/${encodeURIComponent(state.supportSelectedId)}/read`, { method: "POST" });
    } catch {}
    await syncRouteData(true);
    return;
  }
  if (action === "support-reopen") {
    try {
      await fetchJson(`/api/support/tickets/${encodeURIComponent(target.dataset.id)}/reopen`, { method: "POST" });
      state.supportTicket = null; state.supportTickets = null;
      await syncRouteData(true);
      toast("تمت إعادة فتح التذكرة");
    } catch (error) { toast(error.message || "تعذر إعادة فتح التذكرة", "danger"); }
    return;
  }
  if (action === "billing-tab") {
    state.billingTab = target.dataset.tab || "overview";
    storage.set("renvix.billing.tab", state.billingTab);
    return render();
  }
  if (action === "upgrade-storage-plan") {
    state.billingTab = "plans";
    storage.set("renvix.billing.tab", "plans");
    closePortal();
    return navigate("/dashboard/billing");
  }
  if (action === "toggle-whatsapp-usage") {
    state.whatsappUsageExpanded = !state.whatsappUsageExpanded;
    return render();
  }
  if (action === "meta-template-create") {
    const integrations = Array.isArray(state.metaTemplates?.integrations) ? state.metaTemplates.integrations : [];
    const options = integrations.map((item) => `<option value="${item.id}" ${item.status !== "connected" ? "disabled" : ""}>${escapeHtml(item.channelName || item.phoneNumber || "قناة Meta")} — ${item.status === "connected" ? "متصلة" : "غير متصلة"}</option>`).join("");
    if (!options) return toast("اربط حساب واتساب رسميًا عبر Meta Cloud API أولًا.", "warning");
    return openModal("إنشاء قالب واتساب معتمد", `<form data-submit="meta-template-create" class="grid">
      <p class="inline-notice info">سيُحفظ القالب كمسودة فقط. لن يُرسل إلى Meta قبل ضغط زر «إرسال إلى Meta».</p>
      <label class="field"><span>قناة Meta الرسمية</span><select class="select" name="integrationId" required>${options}</select></label>
      <label class="field"><span>الاسم الظاهر</span><input class="input" name="displayName" required maxlength="120" value="قالب تذكير التجديد المعتمد"></label>
      <label class="field"><span>اسم القالب</span><input class="input" name="name" required maxlength="512" pattern="[a-z0-9_]+" placeholder="renewal_reminder_ar"></label>
      <div class="form-grid"><label class="field"><span>الفئة</span><select class="select" name="category"><option value="UTILITY">خدمية</option><option value="MARKETING">تسويقية</option><option value="AUTHENTICATION">مصادقة</option></select></label><label class="field"><span>اللغة</span><select class="select" name="language"><option value="ar">العربية</option><option value="en_US">English (US)</option></select></label></div>
      <label class="field"><span>رأس نصي (اختياري)</span><input class="input" name="header" maxlength="1024"></label>
      <label class="field"><span>محتوى الرسالة</span><textarea class="textarea" name="body" rows="7" maxlength="4096" required placeholder="مرحبًا {{1}}، نذكرك بموعد تجديد اشتراكك."></textarea></label>
      <label class="field"><span>التذييل (اختياري)</span><input class="input" name="footer" maxlength="1024"></label>
      <button class="btn btn-primary">حفظ كمسودة</button>
    </form>`);
  }
  if (action === "meta-template-submit") {
    if (!confirm("سيتم إرسال القالب إلى Meta للمراجعة. هل تريد المتابعة؟")) return;
    target.disabled = true;
    try {
      const payload = await fetchJson(`/api/whatsapp/templates/${encodeURIComponent(target.dataset.id)}/submit`, { method: "POST" });
      state.metaTemplates = { ...(state.metaTemplates || {}), items: (state.metaTemplates?.items || []).map((item) => item.id === payload.item.id ? payload.item : item) };
      toast(payload.message || "تم إرسال القالب إلى Meta للمراجعة.");
      render();
    } catch (error) {
      toast(error.message || "تعذر إرسال القالب إلى Meta.", "danger");
    } finally {
      target.disabled = false;
    }
    return;
  }
  if (action === "meta-template-sync") {
    target.disabled = true;
    try {
      const payload = await fetchJson("/api/whatsapp/templates/sync", { method: "POST" });
      state.metaTemplates = null;
      await syncRouteData(true);
      toast(`تمت مزامنة ${Number(payload.total || 0)} قالبًا — أضيف ${Number(payload.added || 0)}، حُدّث ${Number(payload.updated || 0)}، بدون تغيير ${Number(payload.unchanged || 0)}.`);
    } catch (error) {
      toast(error.message || "تعذرت مزامنة القوالب مع Meta.", "danger");
    } finally {
      target.disabled = false;
    }
    return;
  }
  if (action === "meta-template-delete") {
    const id = target.dataset.id;
    if (!id) return;
    const warning = "حذف القالب من Meta قد يمنع استخدامه في الرسائل والأتمتة المرتبطة به. هل تريد المتابعة؟";
    if (!confirm(warning)) return;
    target.disabled = true;
    try {
      const payload = await fetchJson(`/api/whatsapp/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
      state.metaTemplates = {
        ...(state.metaTemplates || {}),
        items: (state.metaTemplates?.items || []).filter((item) => item.id !== id)
      };
      toast(payload.message || "تم حذف القالب.");
      navigate("/dashboard/templates");
    } catch (error) {
      toast(error.message || "تعذر حذف القالب من Meta.", "danger");
    } finally {
      target.disabled = false;
    }
    return;
  }
  if (action === "campaign-reload") { state.campaignsOverview=null; syncRouteData(true); return render(); }
  if (action === "contacts-reload") { state.contactsOverview=null; state.contactStatistics=null; syncRouteData(true); return render(); }
  if (action === "campaign-create") {
    return openModal("إنشاء حملة جديدة", campaignCreateModalMarkup());
  }
  if (action === "contact-create") {
    return openModal("إضافة جهة اتصال", `<form data-submit="contact-create" class="grid"><label class="field"><span>الاسم</span><input class="input" name="displayName" maxlength="160"></label><label class="field"><span>البريد الإلكتروني</span><input class="input" name="email" type="email"></label><label class="field"><span>رقم الجوال</span><input class="input" name="phone" inputmode="tel" placeholder="+966 5X XXX XXXX"></label><label class="field"><span>الشركة (اختياري)</span><input class="input" name="companyName" maxlength="160"></label><label class="field"><span>الموافقة على التواصل</span><select class="select" name="consentStatus"><option value="unknown">غير محددة</option><option value="granted">موافق</option><option value="revoked">سحب الموافقة</option></select></label><button class="btn btn-primary">حفظ جهة الاتصال</button></form>`);
  }
  if (action === "contacts-import") {
    return openModal("استيراد جهات الاتصال", `<form data-submit="contacts-import" class="grid"><p class="muted">ألصق CSV بالترتيب: الاسم، البريد، الجوال. حد أقصى 500 صف.</p><textarea class="textarea" name="text" rows="10" required placeholder="الاسم,email@example.com,+966501234567"></textarea><button class="btn btn-primary">تحقق واستيراد</button></form>`);
  }
  if (action === "contacts-salla-sync") {
    try { const payload=await fetchJson("/api/contacts/salla-sync",{method:"POST"}); state.contactsOverview=null;state.contactStatistics=null;await syncRouteData(true);toast(`تمت مزامنة ${Number(payload.imported||0)} جهة اتصال من سلة`); }
    catch(error){toast(error.message||"تعذرت مزامنة سلة","danger");} return;
  }
  if (action === "contact-archive") {
    try { await fetchJson(`/api/contacts/${encodeURIComponent(target.dataset.id)}`,{method:"DELETE"});state.contactsOverview=null;state.contactStatistics=null;await syncRouteData(true);toast("تمت أرشفة جهة الاتصال"); }
    catch(error){toast(error.message||"تعذرت الأرشفة","danger");} return;
  }
  if (action === "campaign-estimate") {
    try { const payload=await fetchJson(`/api/campaigns/${encodeURIComponent(target.dataset.id)}/estimate`);openDrawer("فحص جمهور الحملة",`<div class="grid"><div class="mini-stat"><span>إجمالي الجمهور</span><strong>${Number(payload.estimate.total||0).toLocaleString("ar-SA")}</strong></div><div class="mini-stat"><span>مؤهلون للإرسال</span><strong>${Number(payload.estimate.eligible||0).toLocaleString("ar-SA")}</strong></div><div class="mini-stat"><span>مستبعدون بأمان</span><strong>${Number(payload.estimate.excluded||0).toLocaleString("ar-SA")}</strong></div><p class="muted">لا يتم إرسال أي رسالة في خطوة الفحص.</p></div>`); }
    catch(error){toast(error.message||"تعذر فحص الجمهور","danger");} return;
  }
  if (action === "campaign-start") {
    try { const payload=await fetchJson(`/api/campaigns/${encodeURIComponent(target.dataset.id)}/start`,{method:"POST"});state.campaignsOverview=null;state.messageUsage=null;await syncRouteData(true);toast(`تمت جدولة ${Number(payload.queued||0)} رسالة. سيُخصم الرصيد فقط بعد قبول مزود الإرسال.`); }
    catch(error){if(error.usage)showMessageQuotaLimit(error.usage);else toast(error.message||"تعذر بدء الحملة","danger");} return;
  }
  if (action === "campaign-pause") {
    try { await fetchJson(`/api/campaigns/${encodeURIComponent(target.dataset.id)}/pause`,{method:"POST"});state.campaignsOverview=null;state.messageUsage=null;await syncRouteData(true);toast("تم إيقاف الحملة وإعادة الرصيد المحجوز غير المستخدم"); }
    catch(error){toast(error.message||"تعذر إيقاف الحملة","danger");} return;
  }
  if (action === "reload-salla-templates") {
    state.sallaAutomationTemplates = null;
    await syncRouteData(true);
    return render();
  }
  if (action === "back-salla-templates") return navigate("/dashboard/apps/salla/templates");
  if (action === "sync-salla-statuses") {
    target.disabled = true;
    try {
      const payload = await fetchJson("/api/apps/salla/order-statuses", { method: "POST" });
      state.sallaAutomationTemplates = null;
      state.sallaAutomationTemplate = null;
      await syncRouteData(true);
      toast(`تمت مزامنة ${Number(payload.count || 0)} حالة طلب من سلة.`);
    } catch (error) {
      toast(error.message || "تعذرت مزامنة حالات سلة.", "danger");
    } finally {
      target.disabled = false;
    }
    return;
  }
  if (action === "salla-template-toggle") {
    const templateKey = target.dataset.key;
    const shouldEnable = target.dataset.enabled !== "true";
    target.disabled = true;
    try {
      const payload = await fetchJson(`/api/apps/salla/templates/${encodeURIComponent(templateKey)}/${shouldEnable ? "enable" : "disable"}`, { method: "POST" });
      if (!payload.ok) {
        const details = Array.isArray(payload.errors) ? payload.errors.join(" • ") : payload.message;
        throw new Error(details || "لم ينجح التحقق من متطلبات القالب.");
      }
      state.sallaAutomationTemplate = null;
      state.sallaAutomationTemplates = null;
      await syncRouteData(true);
      toast(shouldEnable ? "تم تفعيل القالب بعد اجتياز التحقق." : "تم إيقاف القالب.");
    } catch (error) {
      toast(error.message || "تعذر تغيير حالة القالب.", "danger");
    } finally {
      target.disabled = false;
    }
    return;
  }
  if (action === "insert-salla-variable") {
    const form = target.closest("form");
    const channel = form?.elements.channel?.value || "whatsapp";
    const textarea = channel === "email" ? form?.elements.emailTextContent : form?.elements.whatsappContent;
    if (!textarea) return;
    const value = target.dataset.variable || "";
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    textarea.value = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
    textarea.focus();
    textarea.setSelectionRange(start + value.length, start + value.length);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  if (action === "preview-salla-template") {
    const form = target.closest("form");
    if (!form) return;
    refreshSallaTemplatePreview(form);
    toast("تم تحديث المعاينة محليًا. لن يتم إرسال أي رسالة.");
    return;
  }
  if (action === "choose-salla-email-logo") {
    target.closest("form")?.querySelector('[data-action="salla-email-logo-file"]')?.click();
    return;
  }
  if (action === "test-salla-template") {
    const templateKey = target.dataset.key;
    const channel = state.sallaAutomationTemplate?.item?.channel;
    return openModal("إرسال رسالة اختبار", `<form class="grid" data-submit="salla-template-test" data-template-key="${escapeHtml(templateKey)}">
      <p class="inline-notice info">هذه رسالة اختبار من Renvix ولا تخص طلبًا فعليًا، ولن تُسجل كتذكير عميل.</p>
      <label class="field"><span>${channel === "email" ? "البريد الإلكتروني" : "رقم واتساب بصيغة دولية"}</span><input class="input" name="destination" ${channel === "email" ? 'type="email"' : 'inputmode="tel" dir="ltr"'} required></label>
      <button class="btn btn-primary" type="submit">جدولة رسالة الاختبار</button>
    </form>`);
  }
  if (action === "open-salla-product-mappings") {
    closePortal();
    return navigate("/dashboard/integrations/salla/products");
  }
  if (action === "reload-salla-products") {
    state.sallaProductMappings = null;
    syncRouteData(true);
    return render();
  }
  if (action === "back-salla-products") return navigate("/dashboard/integrations/salla/products");
  if (action === "add-renewal-option") {
    const mappingId = state.route.match(/^\/dashboard\/integrations\/salla\/products\/([^/]+)$/)?.[1];
    if (!mappingId) return;
    state.renewalOptionMode = "automatic";
    openDrawer("إضافة رابط تجديد", renewalOptionForm(mappingId));
    return;
  }
  if (action === "edit-renewal-option") {
    const mappingId = state.route.match(/^\/dashboard\/integrations\/salla\/products\/([^/]+)$/)?.[1];
    const item = Array.isArray(state.sallaRenewalOptions) ? state.sallaRenewalOptions.find((entry) => entry.id === target.dataset.id) : null;
    if (!mappingId || !item) return;
    state.renewalOptionMode = item.linkMode;
    openDrawer("تعديل رابط التجديد", renewalOptionForm(mappingId, item));
    return;
  }
  if (action === "disable-renewal-option") {
    const mappingId = state.route.match(/^\/dashboard\/integrations\/salla\/products\/([^/]+)$/)?.[1];
    if (!mappingId) return;
    try {
      await fetchJson(`/api/apps/salla/product-mappings/${encodeURIComponent(mappingId)}/renewal-options?optionId=${encodeURIComponent(target.dataset.id)}`, { method: "DELETE" });
      state.sallaRenewalOptions = null;
      await syncRouteData(true);
      toast("تم إيقاف خيار التجديد. الروابط التابعة له لن تحول العميل.");
    } catch (error) { toast(error.message || "تعذر إيقاف خيار التجديد", "danger"); }
    return;
  }
  if (action === "sync-salla-renewal-links") {
    const mappingId = state.route.match(/^\/dashboard\/integrations\/salla\/products\/([^/]+)$/)?.[1] || "all";
    target.disabled = true;
    try {
      const result = await fetchJson(`/api/apps/salla/product-mappings/${encodeURIComponent(mappingId)}/sync-renewal-links`, { method: "POST" });
      state.sallaProductMappings = null; state.sallaRenewalOptions = null;
      await syncRouteData(true);
      toast(`تم تحديث ${Number(result.synced || 0)} رابط من كتالوج سلة${result.unavailable ? `، و${Number(result.unavailable)} يحتاج مراجعة` : ""}.`);
    } catch (error) { toast(error.message || "تعذرت مزامنة روابط التجديد", "danger"); }
    finally { target.disabled = false; }
    return;
  }
  if (action === "toggle-password") {
    const input = target.closest(".password-input-wrap")?.querySelector("input");
    if (input) {
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      target.innerHTML = dashboardIcon(visible ? "eye-off" : "eye");
      target.setAttribute("aria-label", state.language === "en" ? (visible ? "Hide password" : "Show password") : (visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"));
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
  if (action === "close-sidebar") { state.sidebarOpen = false; render(); return; }
  if (action === "template-catalog-channel" && target.tagName !== "SELECT") { state.templateCatalogChannel = target.dataset.channel || "all"; render(); }
  if (action === "preview-catalog-template") document.querySelector(".template-preview-v2")?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (action === "close-modal") closePortal();
  if (action === "copy-recovery-codes") {
    const codes = Array.from(portal.querySelectorAll(".recovery-code-grid code")).map((item) => item.textContent.trim()).filter(Boolean);
    if (!codes.length) return toast("لا توجد رموز متاحة للنسخ", "warning");
    try { await navigator.clipboard.writeText(codes.join("\n")); toast("تم نسخ رموز الاسترداد"); }
    catch { toast("تعذر النسخ التلقائي. انسخ الرموز يدويًا.", "warning"); }
  }
  if (action === "download-recovery-codes") {
    const codes = Array.from(portal.querySelectorAll(".recovery-code-grid code")).map((item) => item.textContent.trim()).filter(Boolean);
    if (!codes.length) return toast("لا توجد رموز متاحة للتنزيل", "warning");
    const url = URL.createObjectURL(new Blob([`Renvix - رموز استرداد دخول الحساب OTP\n\n${codes.join("\n")}\n`], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "renvix-otp-recovery-codes.txt"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  if (action === "email-otp-cancel") {
    state.emailOtpStatus = null;
    void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => null);
    return navigate("/login");
  }
  if (action === "mfa-login-cancel") {
    state.mfaLoginStatus = null;
    void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => null);
    return navigate("/login");
  }
  if (action === "email-otp-help") {
    return appToast.info("تحقق من مجلد البريد غير الهام", {
      description: "ابحث عن رسالة من Renvix، وتأكد من أن البريد الظاهر في صفحة التحقق هو بريد حسابك.",
      id: "email-otp-help"
    });
  }
  if (action === "email-otp-resend") {
    target.disabled = true;
    try {
      const response = await fetch("/api/auth/email-otp/resend", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: state.language })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload.reason === "resend_cooldown"
          ? "انتظر انتهاء العداد قبل طلب رمز جديد."
          : payload.reason === "resend_limit"
            ? "تم بلوغ الحد المؤقت لإعادة الإرسال. حاول لاحقًا."
            : "تعذر إرسال رمز جديد الآن.";
        throw new Error(message);
      }
      state.emailOtpStatus = payload;
      render();
      appToast.success("تم إرسال رمز تحقق جديد", {
        description: "استخدم أحدث رمز وصلك؛ تم إلغاء صلاحية الرمز السابق.",
        id: "email-otp-resent"
      });
    } catch (error) {
      updateEmailOtpCountdown();
      appToast.error("تعذرت إعادة إرسال الرمز", {
        description: error.message || "حاول مرة أخرى بعد قليل.",
        id: "email-otp-resend-error"
      });
    }
    return;
  }
  if (action === "copy-order-number") await copyText(target.dataset.value, "تم نسخ رقم الطلب");
  if (action === "choose-avatar") document.querySelector('[data-action="avatar-file"]')?.click();
  if (action === "choose-store-logo") {
    document.querySelector('[data-action="store-logo-file"]')?.click();
    return;
  }
  if (action === "billing-reload") {
    state.billingOverview = null;
    state.messageUsage = null;
    render();
    return syncRouteData(true);
  }
  if (action === "remove-store-logo") {
    openModal("حذف صورة المتجر", "<p>ستُزال الصورة من قالب البريد وصفحة معلومات الطلب، مع بقاء اسم المتجر وبقية الإعدادات كما هي.</p>", '<button class="btn btn-danger" data-action="confirm-remove-store-logo">حذف الصورة</button><button class="btn btn-secondary" data-action="close-modal">إلغاء</button>');
    return;
  }
  if (action === "confirm-remove-store-logo") {
    try {
      await fetchJson("/api/order-link/profile/logo", { method: "DELETE" });
      closePortal();
      state.orderLinkProfile = { ...(state.orderLinkProfile || {}), logoUrl: null };
      state.orderLinkDraft.logoUrl = "";
      render();
      appToast.success("تم حذف صورة المتجر", { description: "ستُستخدم هوية المتجر النصية بدل الصورة.", id: "store-logo-removed" });
    } catch (error) {
      appToast.error("تعذر حذف صورة المتجر", { description: error.message || "حاول مرة أخرى بعد قليل.", id: "store-logo-remove-error" });
    }
    return;
  }
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
  if (action === "reload-settings") { state.accountSettings = null; render(); syncRouteData(true); }
  if (action === "reload-custom-integrations") { state.customIntegrations = null; syncRouteData(true); }
  if (action === "reload-order-links") { state.orderLinks = null; syncRouteData(true); render(); }
  if (action === "open-custom-api-setup") {
    navigate("/dashboard/settings/integrations/custom-api/setup");
    return;
  }
  if (action === "open-custom-api-webhook") {
    navigate("/dashboard/settings/integrations/custom-api/webhook");
    return;
  }
  if (action === "preview-custom-api-setup") {
    const form = target.closest("form");
    const formData = new FormData(form);
    const scopes = formData.getAll("scopes");
    const directionLabels = { inbound: "API فقط", outbound: "Webhook فقط", bidirectional: "API + Webhook" };
    openModal("معاينة إعداد التكامل", `<div class="capi-setup-preview">
      <div><span>اسم التكامل</span><strong>${escapeHtml(formData.get("name") || "لم يُكتب بعد")}</strong></div>
      <div><span>البيئة</span><strong>${formData.get("environment") === "live" ? "إنتاجية" : "تجريبية"}</strong></div>
      <div><span>اتجاه التكامل</span><strong>${directionLabels[formData.get("direction")] || "API + Webhook"}</strong></div>
      <div><span>Webhook</span><strong dir="ltr">${escapeHtml(formData.get("initialWebhookUrl") || "سيُضاف لاحقًا")}</strong></div>
      <section><span>الصلاحيات المحددة</span>${scopes.length ? scopes.map((scope) => `<code dir="ltr">${escapeHtml(scope)}</code>`).join("") : "<strong>لم تحدد صلاحيات بعد</strong>"}</section>
    </div>`, `<button class="btn btn-primary" data-action="close-modal">العودة إلى الإعداد</button>`);
    return;
  }
  if (action === "preview-webhook-payload") {
    openModal("معاينة Payload", `<pre class="custom-api-payload-preview" dir="ltr">${escapeHtml(JSON.stringify({
      id: "evt_example",
      type: "subscription.renewed",
      api_version: "v1",
      created_at: new Date().toISOString(),
      data: { object: { id: "sub_example", status: "ACTIVE" } }
    }, null, 2))}</pre>`, `<button class="btn btn-primary" data-action="close-modal">إغلاق</button>`);
    return;
  }
  if (action === "copy-text") {
    await copyText(target.dataset.value || "", "تم النسخ");
    return;
  }
  if (action === "copy-custom-secret") {
    if (state.customIntegrationSecret?.value) await copyText(state.customIntegrationSecret.value, "تم نسخ السر");
    return;
  }
  if (action === "test-custom-api-key") {
    const apiKey = state.customIntegrationSecret?.kind === "api" ? state.customIntegrationSecret.value : "";
    if (!apiKey) {
      appToast.warning("المفتاح الكامل غير متاح", { description: "يمكن اختبار المفتاح عند إنشائه أو بعد تدويره مباشرة فقط.", id: "custom-api-key-test-unavailable" });
      return;
    }
    const button = target.closest("button");
    const integration = (state.customIntegrations?.items || []).find((item) => item.id === state.customIntegrationSecret?.integrationId);
    const grantedScopes = new Set(Array.isArray(integration?.scopes) ? integration.scopes : []);
    const testEndpoint = grantedScopes.has("customers:read")
      ? "/api/v1/customers?limit=1"
      : grantedScopes.has("subscriptions:read")
        ? "/api/v1/subscriptions?limit=1"
        : "";
    if (!testEndpoint) {
      appToast.warning("لا توجد صلاحية قراءة للاختبار الآمن", { description: "أضف customers:read أو subscriptions:read لاختبار المفتاح دون إنشاء أو تعديل بيانات.", id: "custom-api-key-test-no-read-scope" });
      return;
    }
    setSubmitBusy(button, true, "جاري اختبار API...");
    try {
      const response = await fetch(testEndpoint, { headers: { Authorization: `Bearer ${apiKey}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.reason || `HTTP ${response.status}`);
      appToast.success("نجح اختبار API", { description: "تم توثيق المفتاح واستلام استجابة صحيحة من واجهة العملاء.", id: "custom-api-key-test-success" });
    } catch (error) {
      appToast.error("فشل اختبار API", { description: error.message || "تحقق من المفتاح والصلاحيات.", id: "custom-api-key-test-failed" });
    } finally {
      setSubmitBusy(button, false, "اختبار طلب API");
    }
    return;
  }
  if (action === "dismiss-custom-secret") { state.customIntegrationSecret = null; render(); return; }
  if (action === "revoke-custom-key") {
    return openModal(
      "إلغاء مفتاح API",
      "<p>سيتوقف هذا المفتاح عن قبول أي طلب جديد فورًا. لن تتأثر المفاتيح الأخرى أو بيانات التكامل.</p>",
      `<button class="btn btn-danger" data-action="confirm-revoke-custom-key" data-integration-id="${escapeHtml(target.dataset.integrationId)}" data-key-id="${escapeHtml(target.dataset.keyId)}">إلغاء المفتاح</button><button class="btn btn-secondary" data-action="close-modal">تراجع</button>`
    );
  }
  if (action === "confirm-revoke-custom-key") {
    const button = target.closest("button");
    const integrationId = target.dataset.integrationId;
    const keyId = target.dataset.keyId;
    setSubmitBusy(button, true, "جاري إلغاء المفتاح...");
    try {
      await fetchJson(`/api/integrations/custom/${encodeURIComponent(integrationId)}/keys/${encodeURIComponent(keyId)}`, { method: "DELETE" });
      if (state.customIntegrationSecret?.keyId === keyId) state.customIntegrationSecret = null;
      state.customIntegrations = await fetchJson("/api/integrations/custom");
      closePortal();
      render();
      appToast.success("تم إلغاء مفتاح API", {
        description: "توقف المفتاح عن العمل، وبقيت بقية مفاتيح التكامل وبياناته كما هي.",
        id: "custom-key-revoked"
      });
    } catch (error) {
      appToast.error("تعذر إلغاء المفتاح", {
        description: error.message || "حاول مرة أخرى بعد قليل.",
        id: "custom-key-revoke-error"
      });
      setSubmitBusy(button, false, "إلغاء المفتاح");
    }
    return;
  }
  if (action === "rotate-custom-key") {
    const button = target.closest("button");
    setSubmitBusy(button, true, "جاري إنشاء المفتاح...");
    try {
      const payload = await fetchJson(`/api/integrations/custom/${encodeURIComponent(target.dataset.id)}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "مفتاح بديل" })
      });
      if (!payload.apiKey) throw new Error("لم يُرجع الخادم المفتاح الجديد. أعد المحاولة دون إغلاق الصفحة.");
      state.customIntegrationSecret = {
        kind: "api",
        value: payload.apiKey,
        integrationId: target.dataset.id,
        keyId: payload.item?.id
      };
      const currentItems = Array.isArray(state.customIntegrations?.items) ? state.customIntegrations.items : [];
      state.customIntegrations = {
        ...(state.customIntegrations || {}),
        ok: true,
        items: currentItems.map((item) => item.id === target.dataset.id
          ? {
              ...item,
              latestKeyPrefix: payload.item?.prefix || item.latestKeyPrefix,
              activeKeys: Number(item.activeKeys || 0) + 1,
              keys: payload.item
                ? [{ ...payload.item, status: "ACTIVE" }, ...(Array.isArray(item.keys) ? item.keys : [])]
                : item.keys
            }
          : item)
      };
      await navigate("/dashboard/settings/integrations/custom-api/key-created", { sessionVerified: true });
      void syncRouteData(true);
      appToast.success("تم إنشاء مفتاح بديل", {
        description: "انسخ المفتاح الآن ثم ألغِ المفتاح السابق بعد تحديث نظامك.",
        id: "custom-key-rotated"
      });
    } catch (error) {
      appToast.error("تعذر إنشاء المفتاح", { description: error.message || "حاول مرة أخرى.", id: "custom-key-rotate-error" });
      setSubmitBusy(button, false, "تدوير المفتاح");
    }
    return;
  }
  if (action === "test-custom-webhook") {
    const button = target.closest("button");
    setSubmitBusy(button, true, "جاري جدولة الاختبار...");
    try {
      await fetchJson(`/api/integrations/custom/${encodeURIComponent(target.dataset.id)}/webhooks/${encodeURIComponent(target.dataset.endpointId)}/test`, {
        method: "POST"
      });
      state.customIntegrations = null;
      await syncRouteData(true);
      appToast.success("تمت جدولة رسالة الاختبار", {
        description: "ستظهر نتيجة التسليم الحقيقية في السجل بعد تنفيذ العامل.",
        id: "custom-webhook-test"
      });
    } catch (error) {
      appToast.error("تعذر اختبار Webhook", { description: error.message || "تحقق من العنوان ثم حاول مجددًا.", id: "custom-webhook-test-error" });
      setSubmitBusy(button, false, "إرسال حدث تجريبي");
    }
    return;
  }
  if (action === "retry-custom-delivery") {
    const button = target.closest("button");
    setSubmitBusy(button, true, "جاري الجدولة...");
    try {
      await fetchJson(`/api/integrations/custom/${encodeURIComponent(target.dataset.id)}/deliveries/${encodeURIComponent(target.dataset.deliveryId)}/retry`, {
        method: "POST"
      });
      state.customIntegrations = null;
      await syncRouteData(true);
      appToast.success("تمت جدولة إعادة المحاولة", {
        description: "لن تُعرض كناجحة إلا بعد استجابة Webhook الفعلية.",
        id: "custom-delivery-retry"
      });
    } catch (error) {
      appToast.error("تعذرت إعادة المحاولة", { description: error.message || "حاول مرة أخرى.", id: "custom-delivery-retry-error" });
      setSubmitBusy(button, false, "إعادة المحاولة");
    }
    return;
  }
  if (action === "add-custom-webhook") {
    state.customIntegrationDraft = { ...(state.customIntegrationDraft || {}), integrationId: target.dataset.id || state.customIntegrations?.items?.[0]?.id };
    navigate("/dashboard/settings/integrations/custom-api/webhook");
    return;
  }
  if (action === "preview-salla-connection") {
    const connection = state.appsOverview?.connection || {};
    openModal("معاينة تطبيق سلة", `<div class="linked-app-preview"><span class="integration-logo integration-logo--salla"><img src="/assets/salla-logo.svg" alt="شعار سلة"></span><div><span class="status success">مربوط</span><h3>${escapeHtml(connection.storeName || "متجر سلة")}</h3><p>${escapeHtml(connection.storeDomain || "تم حفظ الربط في حسابك")}</p><small>آخر مزامنة: ${connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString("ar-SA") : "لم تتم المزامنة بعد"}</small></div></div>`, `<button class="btn btn-primary" data-action="open-salla-settings">تحرير إعدادات الربط</button><button class="btn btn-secondary" data-action="close-modal">إغلاق</button>`);
    return;
  }
  if (action === "preview-custom-integration") {
    const integration = (state.appsOverview?.customIntegrations || []).find((item) => item.id === target.dataset.id);
    if (!integration) return;
    const ready = integration.status === "ACTIVE";
    openModal("معاينة التكامل المخصص", `<div class="linked-app-preview"><span class="integration-logo integration-logo--api">&lt;/&gt;</span><div><span class="status ${ready ? "success" : "warning"}">${ready ? "مربوط" : "قيد الإعداد"}</span><h3>${escapeHtml(integration.name)}</h3><p>${integration.environment === "live" ? "بيئة إنتاجية" : "بيئة تجريبية"} · ${integration.direction === "inbound" ? "API" : integration.direction === "outbound" ? "Webhook" : "API + Webhook"}</p><small>${integration.webhookUrl ? escapeHtml(integration.webhookUrl) : "لا يوجد عنوان Webhook محفوظ بعد"}</small></div></div>`, `<button class="btn btn-primary" data-link="/dashboard/settings/integrations/custom-api">إدارة التكامل</button><button class="btn btn-secondary" data-action="close-modal">إغلاق</button>`);
    return;
  }
  if (action === "connect-salla") window.location.href = "/api/apps/salla/connect";
  if (action === "integration-coming-soon") toast(`تكامل ${target.dataset.integration || "هذا التطبيق"} قيد التجهيز وسيُتاح قريبًا.`, "info");
  if (action === "integration-guide") openModal("دليل ربط التطبيقات", `<div class="integration-guide"><p>اختر التطبيق المطلوب ثم اضغط زر الربط. عند اختيار سلة ستنتقل إلى صفحة التفويض الآمنة، وبعد الموافقة تعود تلقائيًا إلى Renvix وتبدأ المزامنة.</p><ol><li>تأكد أن حساب المتجر يملك صلاحية إدارة التطبيقات.</li><li>اضغط «ربط سلة» وأكمل الموافقة داخل سلة.</li><li>ارجع إلى هذه الصفحة واضبط خيارات المزامنة.</li></ol></div>`, `<button class="btn btn-primary" data-action="connect-salla">ربط سلة</button><button class="btn btn-secondary" data-action="close-modal">إغلاق</button>`);
  if (action === "open-salla-settings") { closePortal(); state.sallaSettingsOpen = true; state.sallaRuleDrafts = null; render(); }
  if (action === "open-salla-product-mappings-legacy") {
    let payload;
    try {
      payload = await fetchJson("/api/apps/salla/product-mappings");
      const productOptions = (payload.products || []).map((item) => `<option value="${escapeHtml(`${item.productId}|${item.variantId || ""}|${item.sku || ""}`)}">${escapeHtml(item.name || item.sku || item.productId)}${item.variantId ? ` — ${escapeHtml(item.variantId)}` : ""}</option>`).join("");
      const planOptions = (payload.plans || []).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} (${Number(item.durationValue)} ${item.durationUnit})</option>`).join("");
      const mappingRows = (payload.mappings || []).map((item) => `<div class="activity-item"><div><strong>${escapeHtml(item.planName)}</strong><p class="muted">Product ${escapeHtml(item.productId)}${item.variantId ? ` · Variant ${escapeHtml(item.variantId)}` : ""} · ${Number(item.durationValue)} ${escapeHtml(item.durationUnit)}</p></div><span class="status ${item.isActive ? "success" : "neutral"}">${item.isActive ? "نشط" : "متوقف"}</span></div>`).join("");
      const unmappedNotice = Number(payload.unmapped?.length || 0) ? `<p class="inline-notice warning">يوجد ${Number(payload.unmapped.length)} عنصر طلب يحتاج إلى ربط باقة. لن ينشئ النظام اشتراكات لها قبل تحديد الربط.</p>` : "";
      openDrawer("ربط منتجات سلة بالباقات", `${unmappedNotice}<form data-submit="salla-product-mapping" class="grid"><label class="field"><span>منتج سلة / المتغير</span><select class="select" name="product" required><option value="">اختر المنتج</option>${productOptions}</select></label><label class="field"><span>الباقة الحالية</span><select class="select" name="planId"><option value="">إنشاء باقة جديدة</option>${planOptions}</select></label><label class="field"><span>اسم باقة جديدة (اختياري)</span><input class="input" name="newPlanName" placeholder="مثال: Canva Yearly"></label><label class="field"><span>رابط منتج التجديد في سلة</span><input class="input" type="url" name="renewalUrl" dir="ltr" placeholder="https://store.salla.sa/product"></label><div class="form-grid two"><label class="field"><span>المدة</span><input class="input" name="durationValue" type="number" min="1" value="1" required></label><label class="field"><span>وحدة المدة</span><select class="select" name="durationUnit"><option value="month">شهر</option><option value="year">سنة</option><option value="day">يوم</option></select></label></div><label class="field"><span>بدء الاشتراك</span><select class="select" name="startTrigger"><option value="payment_completed">بعد اكتمال الدفع</option><option value="order_completed">بعد اكتمال الطلب</option><option value="manual_activation">تفعيل يدوي</option><option value="specific_order_status">حالة طلب محددة</option></select></label><label class="field"><span>سلوك الكمية</span><select class="select" name="quantityBehavior"><option value="multiply_duration">مضاعفة مدة الاشتراك</option><option value="create_multiple_subscriptions">إنشاء اشتراكات مستقلة</option></select></label><button class="btn btn-primary" type="submit">حفظ الربط</button></form><section class="section"><h3>الروابط الحالية</h3><div class="activity-list">${mappingRows || emptyState("لا توجد روابط بعد", "زامن المنتجات ثم اربط كل منتج اشتراكي بباقة.")}</div></section>`);
    } catch (error) { toast(error.message || "تعذر تحميل ربط المنتجات.", "danger"); }
    const triggerField = document.querySelector("form[data-submit='salla-product-mapping'] select[name='startTrigger']")?.closest("label");
    triggerField?.insertAdjacentHTML("afterend", '<label class="field"><span>معرّف حالة الطلب المحددة (عند اختيارها)</span><input class="input" name="specificOrderStatus" dir="ltr" placeholder="completed"></label>');
    document.querySelectorAll("#portal .activity-list > .activity-item").forEach((row, index) => {
      const mapping = payload?.mappings?.[index];
      if (mapping?.isActive) row.insertAdjacentHTML("beforeend", `<button class="btn btn-ghost danger-text" data-action="deactivate-salla-mapping" data-id="${escapeHtml(mapping.id)}">إيقاف الربط</button>`);
    });
    return;
  }
  if (action === "deactivate-salla-mapping") {
    try {
      await fetchJson(`/api/apps/salla/product-mappings?id=${encodeURIComponent(target.dataset.id)}`, { method: "DELETE" });
      closePortal();
      toast("تم إيقاف ربط المنتج. الطلبات الجديدة لن تنشئ اشتراكًا منه حتى إعادة ربطه.");
    } catch (error) { toast(error.message || "تعذر إيقاف الربط.", "danger"); }
    return;
  }
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
    const theme = state.theme === "dark" ? "light" : "dark";
    void saveInterfacePreferences({ theme })
      .then(() => toast(theme === "dark" ? "تم تفعيل الوضع الليلي" : "تم تفعيل الوضع الشمسي"))
      .catch((error) => toast(error.message || "تعذر حفظ التفضيلات", "danger"));
  }
  if (action === "language") {
    const language = target.dataset.language || (state.language === "ar" ? "en" : "ar");
    void saveInterfacePreferences({ language })
      .then(() => toast(language === "ar" ? "تم تفعيل الواجهة العربية" : "English interface enabled"))
      .catch((error) => toast(error.message || "تعذر حفظ التفضيلات", "danger"));
  }
  if (action === "profile-menu") { state.profileOpen = !state.profileOpen; render(); }
  if (action === "logout-confirm") openModal(t("auth.logoutConfirmTitle"), `<p>${t("auth.logoutConfirmMessage")}</p>`, `<button class="btn btn-danger" data-action="logout">${t("auth.logout")}</button><button class="btn btn-secondary" data-action="close-modal">${t("common.cancel")}</button>`);
  if (action === "logout") {
    const finishLogout = () => {
      clearCachedDashboardProfile();
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
  if (action === "security-alerts") {
    const alerts = Array.isArray(state.securityScore?.securityAlerts) ? state.securityScore.securityAlerts : Array.isArray(state.securityScore?.events) ? state.securityScore.events : [];
    openModal("سجل تنبيهات الحماية", `<div class="security-alert-history">${alerts.length ? alerts.map((item) => `<article class="security-alert-history-item ${escapeHtml(item.severity || "low")}"><span>${item.severity === "critical" || item.severity === "high" ? "!" : "i"}</span><div><strong>${escapeHtml(item.title || item.type || "تنبيه أمني")}</strong><p>${escapeHtml(item.message || item.detail || "تم تسجيل الحدث الأمني.")}</p><small>${escapeHtml(securityTime(item.timestamp || item.occurredAt))} · ${item.deliveryChannels?.includes("email") ? "داخل النظام والبريد" : "داخل النظام"}</small></div>${item.actionUrl ? `<button class="btn btn-secondary" data-link="${escapeHtml(item.actionUrl)}">${escapeHtml(item.actionLabel || "عرض التفاصيل")}</button>` : ""}</article>`).join("") : `<div class="security-empty-row success">لا توجد تنبيهات أمنية مسجلة حاليًا.</div>`}</div>`, '<button class="btn btn-secondary" data-action="close-modal">إغلاق</button>');
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
    if (action === "load-order-template") rememberOrderLinkTemplateSelection(item.id);
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
      if (state.orderLinkDraft.templateId === target.dataset.id) {
        state.orderLinkDraft.templateId = "";
        state.orderLinkDraft.hydrated = false;
        rememberOrderLinkTemplateSelection("");
      }
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
    const payload = await fetchJson(`/api/order-link/${target.dataset.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "copy" }) });
    await copyText(payload.publicUrl, "تم نسخ رابط الطلب بنجاح");
  }
  if (action === "preview-order-link") {
    const orderId = target.dataset.id || target.closest(".row-actions")?.querySelector("[data-id]")?.dataset.id;
    if (orderId) {
      const payload = await fetchJson(`/api/order-link/${orderId}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "copy" }) });
      window.open(payload.publicUrl, "_blank", "noopener,noreferrer");
    }
  }
  if (action === "send-order-link") {
    const item = state.orderLinks?.items?.find((link) => link.id === target.dataset.id);
    openOrderLinkSendModal(item);
  }
  if (action === "regenerate-order-link") {
    return openModal("إنشاء رابط سري جديد", "<p>سيُلغى الرابط الحالي فورًا ولن يتمكن العميل من فتحه بعد التأكيد.</p>", `<button class="btn btn-danger" data-action="confirm-regenerate-order-link" data-id="${escapeHtml(target.dataset.id)}">تأكيد إنشاء رابط جديد</button><button class="btn btn-secondary" data-action="close-modal">إلغاء</button>`);
  }
  if (action === "confirm-regenerate-order-link") {
    try {
      const payload = await fetchJson(`/api/orders/${target.dataset.id}/portal-link/regenerate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      closePortal();
      state.orderLinks = null;
      syncRouteData(true);
      await copyText(payload.url, "تم إنشاء ونسخ الرابط السري الجديد");
    } catch (error) { toast(error.message || "تعذر إنشاء رابط جديد", "danger"); }
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
        state.orderLinkDraft = { ...state.orderLinkDraft, linkId: "", createdOrderNumber: "", createdCustomerName: "" };
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
  if (action === "device-details") {
    const device = linkedDeviceById(target.dataset.id);
    if (!device) return toast("تعذر العثور على الجهاز المطلوب.", "danger");
    const statusInfo = deviceStatusView(device);
    return openModal("تفاصيل الجهاز", `<div class="device-details-modal"><div class="devices-device-name"><span>${dashboardIcon("devices")}</span><div><strong>${escapeHtml(device.deviceName || device.displayName || "جهاز واتساب")}</strong><small>${escapeHtml(deviceProviderLabel(device.provider))}</small></div></div><dl><div><dt>الحساب / القناة</dt><dd>${escapeHtml(device.displayName || device.phoneNumber || "غير مسمى")}</dd></div><div><dt>حالة الاتصال</dt><dd><span class="device-state ${statusInfo.tone}"><i></i>${statusInfo.label}</span></dd></div><div><dt>آخر مزامنة</dt><dd>${escapeHtml(deviceRelativeTime(device.lastHealthCheckAt || device.updatedAt))}</dd></div><div><dt>آخر إرسال</dt><dd>${escapeHtml(deviceRelativeTime(device.lastSendAt))}</dd></div>${device.lastError ? `<div class="device-detail-warning"><dt>آخر تنبيه</dt><dd>${escapeHtml(device.lastError)}</dd></div>` : ""}</dl></div>`, `<button class="btn btn-primary" data-action="device-resync" data-id="${device.id}">إعادة المزامنة</button><button class="btn btn-secondary" data-action="close-modal">إغلاق</button>`);
  }
  if (action === "device-resync") {
    try {
      await refreshLinkedDevice(target.dataset.id);
      closePortal();
      toast("تمت مزامنة حالة الجهاز بنجاح.", "success");
      render();
    } catch (error) { toast(error.message || "تعذر مزامنة الجهاز.", "danger"); }
    return;
  }
  if (action === "device-sync-all") {
    const devices = Array.isArray(state.linkedDevice?.devices) ? state.linkedDevice.devices : [];
    if (!devices.length) return toast("لا توجد أجهزة مرتبطة لمزامنتها.", "warning");
    state.deviceBulkSyncing = true;
    render();
    const results = await Promise.allSettled(devices.map((item) => refreshLinkedDevice(item.id)));
    state.deviceBulkSyncing = false;
    await syncLinkedDevice();
    const succeeded = results.filter((item) => item.status === "fulfilled").length;
    toast(succeeded === devices.length ? "تمت مزامنة حالة جميع الأجهزة." : `اكتملت مزامنة ${succeeded.toLocaleString("ar-SA")} من ${devices.length.toLocaleString("ar-SA")} أجهزة.`, succeeded ? "success" : "danger");
    render();
    return;
  }
  if (action === "device-connection-test") {
    const devices = Array.isArray(state.linkedDevice?.devices) ? state.linkedDevice.devices : [];
    const candidate = devices.find((item) => item.status === "connected") || devices[0];
    if (!candidate) return toast("اربط جهازًا أولًا لبدء فحص الاتصال.", "warning");
    try {
      const result = await refreshLinkedDevice(candidate.id, { connectionTest: true });
      const connected = result.status === "connected";
      toast(result.fromWebhook ? "تم التحقق من آخر حالة مسجلة عبر Meta Webhook." : connected ? "اختبار الاتصال ناجح والجهاز متصل." : "اكتمل الفحص والجهاز غير متصل حاليًا.", connected ? "success" : "warning");
      render();
    } catch (error) { toast(error.message || "فشل اختبار الاتصال.", "danger"); }
    return;
  }
  if (action === "device-activity-toggle") {
    state.deviceActivityExpanded = !state.deviceActivityExpanded;
    render();
    return;
  }
  if (action === "connect-meta-whatsapp") {
    const connectUrl = window.__RENVIX_CONFIG__?.metaWhatsAppConnectUrl;
    if (connectUrl) {
      window.location.assign(connectUrl);
      return;
    }
    openModal(
      "ربط حساب واتساب الرسمي",
      `<div class="meta-connect-guide">
        <p>يحتاج الربط الرسمي إلى تطبيق Meta Business مهيأ من مسؤول المنصة.</p>
        <ol>
          <li>إضافة رابط Embedded Signup الآمن في متغير <code>NEXT_PUBLIC_META_WHATSAPP_CONNECT_URL</code>.</li>
          <li>تسجيل Callback وWebhook في تطبيق Meta والتحقق من التوقيع.</li>
          <li>تشفير Access Token في الخادم وربطه بمساحة العمل الحالية.</li>
        </ol>
        <div class="meta-config-note"><strong>حماية البيانات</strong><p>لن تطلب Renvix مفتاح Meta داخل المتصفح، ولن تنشئ قناة وهمية بدل الربط الرسمي.</p></div>
      </div>`,
      `<button class="btn btn-secondary" data-action="close-modal">إغلاق</button>`
    );
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
  if (action === "open-chat") {
    openDrawer("ابدأ محادثة مع الدعم", `<div class="support-chat-intro">${dashboardIcon("chat")}<div><strong>فريق دعم Renvix</strong><p class="muted">أرسل رسالتك الآن. ستصل إلى لوحة الدعم وسنرسل الرد إلى بريدك الإلكتروني.</p></div></div><form data-submit="support-chat" class="grid support-chat-form"><label class="field"><span>الاسم الكامل</span><input class="input" name="name" minlength="2" maxlength="120" required></label><label class="field"><span>البريد الإلكتروني</span><input class="input" type="email" name="email" maxlength="254" required></label><label class="field"><span>نوع الطلب</span><select class="select" name="type"><option value="INQUIRY">استفسار عام</option><option value="TECHNICAL_ISSUE">مشكلة تقنية</option><option value="BILLING">الفوترة والباقات</option><option value="INTEGRATION">التكاملات وربط القنوات</option><option value="COMPLAINT">شكوى</option><option value="OTHER">أخرى</option></select></label><label class="field"><span>عنوان المحادثة</span><input class="input" name="subject" minlength="5" maxlength="150" required></label><label class="field"><span>رسالتك</span><textarea class="textarea" name="message" minlength="10" maxlength="2000" required></textarea></label><button class="btn btn-primary" type="submit">إرسال إلى فريق الدعم</button></form>`);
    return;
  }
  if (action === "open-email") {
    const supportForm = document.getElementById("support-request");
    supportForm?.scrollIntoView({ behavior: "smooth", block: "start" });
    supportForm?.querySelector('input[name="email"]')?.focus({ preventScroll: true });
    return;
  }
  if (action === "open-whatsapp") window.open("https://wa.me/966500000000?text=مرحبًا، أحتاج دعم Renvix", "_blank");
  if (action === "knowledge") {
    const guide = document.getElementById(`support-guide-${target.dataset.articleId || ""}`);
    if (guide) {
      guide.open = true;
      guide.scrollIntoView({ behavior: "smooth", block: "center" });
      guide.querySelector("summary")?.focus({ preventScroll: true });
    }
    return;
  }
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
    const form = target.closest("form") || document.querySelector("form[data-submit='renewal-template']");
    const color = safeEmailTheme(target.dataset.color);
    const hidden = form?.querySelector("input[name='themeColor']");
    const custom = form?.querySelector("input[type='color']");
    state.emailThemeColor = color;
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
    const form = target.closest("form") || document.querySelector("form[data-submit='renewal-template']");
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
  if (action === "subscription-section") { state.subscriptionSection = target.dataset.section || "list"; render(); }
  if (action === "subscription-page") { state.subscriptionPage = Math.max(1, Number(target.dataset.page||1)); state.dbSubscriptions=null; syncRouteData(true); render(); }
  if (action === "clear-subscription-filters") {
    state.search=""; state.subscriptionStatus=""; state.subscriptionPlanId=""; state.subscriptionChannel=""; state.subscriptionSource=""; state.subscriptionWindow=""; state.subscriptionReminderStatus=""; state.subscriptionDateFrom=""; state.subscriptionDateTo=""; state.subscriptionPage=1; state.dbSubscriptions=null; syncRouteData(true); render();
  }
  if (action === "send-subscription-reminder") {
    try {
      const payload = await fetchJson(`/api/subscriptions/${target.dataset.id}/remind`);
      const preview = payload.preview;
      openModal("معاينة تذكير التجديد", `<form data-submit="confirm-subscription-reminder" data-id="${target.dataset.id}" class="grid"><div class="reminder-confirm-summary"><span>القناة</span><strong>${preview.channel==="email"?"البريد الإلكتروني":"واتساب"}</strong><span>المستلم</span><strong>${escapeHtml(preview.recipient)}</strong><span>القالب</span><strong>${escapeHtml(preview.templateName||"-")}</strong></div>${preview.subject?`<label class="field"><span>العنوان</span><input class="input" value="${escapeHtml(preview.subject)}" readonly></label>`:""}<label class="field"><span>محتوى الرسالة</span><textarea class="textarea" rows="9" readonly>${escapeHtml(preview.body)}</textarea></label><p class="inline-notice info">سيتم خصم رصيد رسالة واحدة فقط إذا نجح مزود الإرسال.</p><button class="btn btn-primary">تأكيد وجدولة الرسالة</button><button type="button" class="btn btn-secondary" data-action="close-modal">إلغاء</button></form>`);
    } catch (error) {
      if (error.code === "PLAN_MESSAGE_LIMIT_REACHED") showMessageQuotaLimit(error.usage);
      else toast(error.message || "تعذر تجهيز معاينة التذكير", "danger");
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
  if (action === "campaign-export") {
    const rows = Array.isArray(state.campaignsOverview?.items) ? state.campaignsOverview.items : [];
    if (!rows.length) return toast("لا توجد حملات لتصديرها", "warning");
    exportCsv("renvix-campaigns.csv", [["الحملة", "القناة", "الحالة", "الجمهور المؤهل", "تم الإرسال", "تم التسليم", "الفشل", "الموعد"], ...rows.map((row) => [row.name, row.channel, row.status, row.eligibleRecipients || 0, row.sentCount || 0, row.deliveredCount || 0, row.failedCount || 0, row.scheduledFor || ""])]);
  }
  if (action === "contacts-export") {
    const rows = Array.isArray(state.contactsOverview?.items) ? state.contactsOverview.items : [];
    if (!rows.length) return toast("لا توجد جهات اتصال لتصديرها", "warning");
    exportCsv("renvix-contacts.csv", [["الاسم", "البريد", "واتساب", "المصدر", "الحالة", "آخر تحديث"], ...rows.map((row) => {
      const email = row.points?.find((point) => point.channel === "email")?.value || "";
      const whatsapp = row.points?.find((point) => point.channel === "whatsapp")?.value || "";
      return [row.displayName, email, whatsapp, row.source, row.status, row.updatedAt || ""];
    })]);
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
    await navigate("/dashboard/security");
    toast("تم فتح مركز حماية الحساب", "info");
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
    const enabled = Boolean(state.accountSettings?.settings?.mfaEnabled);
    target.checked = enabled;
    if (!enabled) await startMfaSetup();
    else openModal("إيقاف دخول الحساب OTP", `<form data-submit="mfa-disable" class="grid"><p>أكد هويتك بكلمة المرور الحالية ورمز OTP أو أحد رموز الاسترداد.</p><label class="field"><span>كلمة المرور الحالية</span><input class="input" name="password" type="password" autocomplete="current-password" required></label><label class="field"><span>رمز OTP أو رمز الاسترداد</span><input class="input code-input" name="code" autocomplete="one-time-code" required></label><div class="notice warning">سيؤدي الإيقاف إلى إبطال تحديات الدخول المفتوحة وإنهاء الجلسات الأخرى.</div><button class="btn btn-danger">تأكيد إيقاف دخول OTP</button></form>`);
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
  if (type === "support-ticket") {
    const button = form.querySelector("button[type='submit']");
    const attachmentInput = form.querySelector('input[name="attachments"]');
    const attachments = Array.from(attachmentInput?.files || []);
    setSubmitBusy(button, true, "جاري إرسال الرسالة...");
    try {
      const payload = await fetchJson("/api/support/tickets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: data.type, subject: data.subject, body: data.body })
      });
      if (attachments.length) {
        const uploadData = new FormData();
        attachments.forEach((file) => uploadData.append("files", file));
        uploadData.append("messageId", payload.item.messageId);
        try {
          await fetchJson(`/api/support/tickets/${encodeURIComponent(payload.item.id)}/attachments`, {
            method: "POST",
            body: uploadData
          });
        } catch (uploadError) {
          appToast.warning("أُرسلت الرسالة دون بعض المرفقات", {
            description: uploadError.message,
            id: "support-attachments-warning"
          });
        }
      }
      form.reset();
      state.supportSelectedId = payload.item.id;
      history.replaceState({}, "", `/dashboard/support?ticket=${encodeURIComponent(payload.item.id)}`);
      state.supportTickets = null; state.supportTicket = null;
      await syncRouteData(true);
      appToast.success("تم إرسال رسالتك", { description: `رقم التذكرة ${payload.item.ticketNumber}`, id: "support-created" });
    } catch (error) {
      appToast.error("تعذر إرسال الرسالة", { description: error.message, id: "support-create-error" });
      setSubmitBusy(button, false, "إرسال الرسالة");
    }
    return;
  }
  if (type === "support-reply") {
    const id = form.dataset.ticketId;
    const button = form.querySelector("button[type='submit']");
    setSubmitBusy(button, true, "جاري إرسال الرد...");
    try {
      await fetchJson(`/api/support/tickets/${encodeURIComponent(id)}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: data.body })
      });
      form.reset(); state.supportTicket = null; state.supportTickets = null;
      await syncRouteData(true);
    } catch (error) {
      toast(error.message || "تعذر إرسال الرد", "danger");
      setSubmitBusy(button, false, "إرسال الرد");
    }
    return;
  }
  if (["custom-integration", "custom-integration-update"].includes(type)) {
    const button = form.querySelector("button[type='submit']");
    const formData = new FormData(form);
    const scopes = formData.getAll("scopes");
    const updating = type === "custom-integration-update";
    setSubmitBusy(button, true, updating ? "جاري حفظ التغييرات..." : "جاري إنشاء التكامل...");
    try {
      const endpoint = updating
        ? `/api/integrations/custom/${encodeURIComponent(form.dataset.integrationId)}`
        : "/api/integrations/custom";
      const payload = await fetchJson(endpoint, {
        method: updating ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, description: data.description, environment: data.environment, direction: data.direction, scopes })
      });
      if (updating) {
        state.customIntegrationDraft = null;
        state.customIntegrations = null;
        await navigate(CUSTOM_API_BASE, { sessionVerified: true });
        await syncRouteData(true);
        appToast.success("تم تحديث التكامل", { description: "حُفظت التغييرات على التكامل الحالي دون إنشاء نسخة جديدة.", id: "custom-integration-updated" });
        return;
      }
      if (!payload.apiKey || !payload.item?.id) {
        throw new Error("تم حفظ التكامل لكن لم يصل المفتاح إلى الصفحة. أعد المحاولة قبل مغادرتها.");
      }
      state.customIntegrationDraft = {
        name: data.name,
        description: data.description,
        environment: data.environment,
        direction: data.direction,
        scopes,
        initialWebhookUrl: data.initialWebhookUrl || "",
        initialWebhookDescription: data.initialWebhookDescription || "",
        integrationId: payload.item?.id
      };
      state.customIntegrationSecret = {
        kind: "api",
        value: payload.apiKey,
        integrationId: payload.item?.id,
        keyId: payload.key?.id
      };
      const currentItems = Array.isArray(state.customIntegrations?.items) ? state.customIntegrations.items : [];
      const createdItem = {
        ...payload.item,
        name: data.name,
        description: data.description || "",
        environment: data.environment === "test" ? "test" : "live",
        direction: data.direction || "bidirectional",
        scopes,
        latestKeyPrefix: payload.key?.prefix || payload.apiKey.split("_").slice(0, 3).join("_"),
        activeKeys: 1,
        activeWebhooks: 0,
        keys: payload.key ? [payload.key] : [],
        webhooks: [],
        recentDeliveries: [],
        webhook: {}
      };
      state.customIntegrations = {
        ...(state.customIntegrations || {}),
        ok: true,
        items: [createdItem, ...currentItems.filter((item) => item.id !== createdItem.id)]
      };
      await navigate("/dashboard/settings/integrations/custom-api/key-created", { sessionVerified: true });
      void syncRouteData(true);
      appToast.success("تم إنشاء التكامل", { description: "انسخ مفتاح API الآن؛ لن يظهر كاملًا مرة أخرى.", id: "custom-integration-created" });
    } catch (error) {
      appToast.error(updating ? "تعذر تحديث التكامل" : "تعذر إنشاء التكامل", { description: error.message || "تحقق من الإعدادات السرية وقاعدة البيانات.", id: "custom-integration-error" });
      setSubmitBusy(button, false, updating ? "حفظ التغييرات" : "إنشاء التكامل والمفتاح");
    }
    return;
  }
  if (type === "custom-webhook") {
    const button = form.querySelector("button[type='submit']");
    const formData = new FormData(form);
    const endpointId = form.dataset.endpointId || "";
    const enabled = data.enabled === "on";
    setSubmitBusy(button, true, "جاري التحقق من العنوان...");
    try {
      const baseUrl = `/api/integrations/custom/${encodeURIComponent(form.dataset.integrationId)}/webhooks`;
      const payload = await fetchJson(endpointId ? `${baseUrl}/${encodeURIComponent(endpointId)}` : baseUrl, {
        method: endpointId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: data.url,
          description: data.description,
          events: formData.getAll("events"),
          status: enabled ? "enabled" : "disabled"
        })
      });
      if (payload.signingSecret) {
        state.customIntegrationSecret = { kind: "webhook", value: payload.signingSecret, integrationId: form.dataset.integrationId };
      }
      const savedEndpointId = endpointId || payload.item?.id;
      let testError = null;
      if (enabled && savedEndpointId) {
        try {
          await fetchJson(`${baseUrl}/${encodeURIComponent(savedEndpointId)}/test`, { method: "POST" });
        } catch (error) {
          testError = error;
        }
      }
      state.customIntegrations = null;
      state.appsOverview = null;
      await syncRouteData(true);
      render();
      if (testError) {
        appToast.warning("تم حفظ Webhook", {
          description: `تم حفظ الإعدادات، لكن تعذرت جدولة الاختبار: ${testError.message || "حاول من زر الاختبار."}`,
          id: "custom-webhook-saved-test-failed"
        });
      } else {
        appToast.success(endpointId ? "تم تحديث Webhook" : "تمت إضافة Webhook", {
          description: enabled
            ? `${payload.signingSecret ? "انسخ سر التوقيع الآن. " : ""}تمت جدولة حدث اختبار حقيقي وستظهر نتيجته في السجل.`
            : "تم حفظ العنوان بحالة غير مفعّل ولن تُرسل إليه أحداث.",
          id: endpointId ? "custom-webhook-updated" : "custom-webhook-created"
        });
      }
    } catch (error) {
      appToast.error(endpointId ? "تعذر تحديث Webhook" : "تعذر إضافة Webhook", { description: error.code === "private_address" ? "العنوان خاص أو محلي وغير مسموح." : error.message, id: "custom-webhook-error" });
      setSubmitBusy(button, false, endpointId ? "حفظ التغييرات وإرسال اختبار" : "حفظ وإرسال اختبار");
    }
    return;
  }
  if (type === "salla-automation-template") {
    const templateKey = form.dataset.templateKey;
    const statusSelect = form.elements.mappedStatusId;
    const selectedStatus = statusSelect?.selectedOptions?.[0];
    const currentSettings = state.sallaAutomationTemplate?.item?.settings || {};
    const settings = {
      ...currentSettings,
      buttonEnabled: Boolean(form.elements.buttonEnabled?.checked),
      buttonLabel: String(form.elements.buttonLabel?.value || currentSettings.buttonLabel || "").trim(),
      ...(form.elements.delay1 ? {
        delaysMinutes: [form.elements.delay1, form.elements.delay2, form.elements.delay3]
          .filter(Boolean).map((input) => Number(input.value || 30)),
        maxMessages: 3,
        stopOnConversion: Boolean(form.elements.stopOnConversion?.checked)
      } : {}),
      ...(form.elements.completedDeliveryMode ? {
        completedDeliveryMode: data.completedDeliveryMode,
        showSubscriptionDuration: Boolean(form.elements.showSubscriptionDuration?.checked)
      } : {}),
      ...(form.elements.reviewDelayMinutes ? { reviewDelayMinutes: Number(data.reviewDelayMinutes || 1440) } : {}),
      ...(form.elements.secureLinkEnabled ? {
        secureLinkEnabled: Boolean(form.elements.secureLinkEnabled.checked),
        linkPageTitle: String(form.elements.linkPageTitle?.value || "").trim(),
        linkPageContent: String(form.elements.linkPageContent?.value || "").trim(),
        showCountdown: Boolean(form.elements.showCountdown?.checked),
        themeColor: form.elements.themeColor?.value || "#2563EB",
        branding: { ...(currentSettings.branding || {}), themeColor: form.elements.themeColor?.value || "#2563EB" }
      } : {})
    };
    const button = form.querySelector("button[type='submit']");
    setSubmitBusy(button, true, "جاري حفظ القالب...");
    try {
      const payload = await fetchJson(`/api/apps/salla/templates/${encodeURIComponent(templateKey)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: data.channel || null,
          whatsappTemplateId: data.whatsappTemplateId || null,
          emailSubject: data.emailSubject || null,
          whatsappContent: data.whatsappContent,
          emailTextContent: data.emailTextContent,
          emailHtmlContent: data.emailTextContent,
          mappedStatusId: data.mappedStatusId || null,
          mappedStatusSlug: selectedStatus?.dataset.slug || null,
          mappedStatusName: selectedStatus?.dataset.name || null,
          settings
        })
      });
      state.sallaAutomationTemplate = {
        ...(state.sallaAutomationTemplate || {}),
        item: {
          ...(state.sallaAutomationTemplate?.item || {}),
          ...payload.item
        }
      };
      state.sallaAutomationTemplates = null;
      toast("تم حفظ تعديلات القالب دون إنشاء سجل إضافي.");
      render();
    } catch (error) {
      toast(error.message || "تعذر حفظ قالب سلة.", "danger");
    } finally {
      setSubmitBusy(button, false, "حفظ التغييرات");
    }
    return;
  }
  if (type === "salla-template-test") {
    const button = form.querySelector("button[type='submit']");
    setSubmitBusy(button, true, "جاري جدولة الاختبار...");
    try {
      const payload = await fetchJson(`/api/apps/salla/templates/${encodeURIComponent(form.dataset.templateKey)}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: data.destination })
      });
      if (!payload.ok) throw new Error(payload.reason || payload.message || "تعذرت جدولة رسالة الاختبار.");
      closePortal();
      toast("تمت جدولة رسالة الاختبار. سيظهر النجاح بعد قبول مزود الإرسال.");
    } catch (error) {
      toast(error.message || "تعذرت جدولة رسالة الاختبار.", "danger");
      setSubmitBusy(button, false, "جدولة رسالة الاختبار");
    }
    return;
  }
  if (type === "campaign-create") {
    const allowedDays = [...new FormData(form).getAll("allowedDays")].map(Number);
    const contactKeywords = [...new FormData(form).getAll("contactKeywords")].map(String);
    const customKeywords = String(data.customKeywords || "").split(/\r?\n|،|,/).map((item) => item.trim()).filter(Boolean);
    const minDelaySeconds = Number(data.minDelaySeconds || 20);
    const maxDelaySeconds = Number(data.maxDelaySeconds || 120);
    if (!allowedDays.length) return toast("اختر يومًا واحدًا على الأقل لتشغيل الحملة.", "warning");
    if (maxDelaySeconds < minDelaySeconds) return toast("أقصى وقت بين الرسائل يجب أن يكون أكبر من أقل وقت أو مساويًا له.", "warning");
    const scheduledDate = new Date(`${data.startDate}T${data.startTime}`);
    if (Number.isNaN(scheduledDate.getTime())) return toast("تحقق من تاريخ ووقت بدء الحملة.", "warning");
    try {
      await fetchJson("/api/campaigns", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        name:data.name,channel:data.channel,description:data.description||null,subject:data.subject||null,body:data.body,
        whatsappChannelId:data.channel === "whatsapp" ? data.whatsappChannelId || null : null,
        metaTemplateId:data.channel === "whatsapp" ? data.metaTemplateId || null : null,
        templateId:data.channel === "email" ? data.templateId || null : null,groupId:data.groupId||null,
        isEnabled:Boolean(form.elements.isEnabled?.checked),scheduledFor:scheduledDate.toISOString(),endTime:data.endTime,
        timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Riyadh",allowedDays,minDelaySeconds,maxDelaySeconds,
        contactKeywords,customKeywords
      }) });
      closePortal(); state.campaignsOverview=null; await syncRouteData(true); toast(form.elements.isEnabled?.checked ? "تم إنشاء الحملة وتفعيل جدولها بنجاح." : "تم حفظ الحملة كمسودة غير مفعلة.");
    } catch(error){toast(error.message||"تعذر إنشاء الحملة","danger");}
    return;
  }
  if (type === "contact-create") {
    try {
      await fetchJson("/api/contacts", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({displayName:data.displayName,email:data.email||null,phone:data.phone||null,companyName:data.companyName||null,consentStatus:data.consentStatus}) });
      closePortal(); state.contactsOverview=null;state.contactStatistics=null;await syncRouteData(true);toast("تم حفظ جهة الاتصال");
    } catch(error){toast(error.message||"تعذر حفظ جهة الاتصال","danger");}
    return;
  }
  if (type === "contacts-import") {
    const lines=String(data.text||"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean).slice(0,500);
    const rows=lines.map(line=>{const [displayName,email,phone,companyName]=line.split(",").map(value=>value?.trim());return{displayName,email:email||null,phone:phone||null,companyName:companyName||null};});
    if(!rows.length)return toast("لا توجد صفوف صالحة للاستيراد","warning");
    try {const payload=await fetchJson("/api/contacts/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows})});closePortal();state.contactsOverview=null;state.contactStatistics=null;await syncRouteData(true);toast(`تم استيراد ${Number(payload.imported||0)} جهة، واستبعاد ${Number(payload.invalid||0)} صف غير صالح.`);}
    catch(error){toast(error.message||"تعذر الاستيراد","danger");}
    return;
  }
  if (type === "renewal-option") {
    const [targetSallaProductId, targetSallaVariantId, targetSallaSku] = String(data.catalogProduct || "").split("|");
    const optionId = form.dataset.optionId || "";
    const body = {
      id: optionId || undefined,
      label: data.label,
      customerNote: data.customerNote || null,
      linkMode: data.linkMode === "manual" ? "manual" : "automatic",
      manualUrl: data.manualUrl || null,
      targetSallaProductId: targetSallaProductId || null,
      targetSallaVariantId: targetSallaVariantId || null,
      targetSallaSku: targetSallaSku || null,
      durationValue: Number(data.durationValue || 1),
      durationUnit: data.durationUnit,
      showInPortal: form.elements.showInPortal.checked,
      showInWhatsapp: form.elements.showInWhatsapp.checked,
      showInEmail: form.elements.showInEmail.checked,
      isActive: form.elements.isActive.checked,
      sortOrder: 0
    };
    if (body.linkMode === "automatic" && !body.targetSallaProductId && !body.targetSallaVariantId) return toast("اختر منتج التجديد من كتالوج سلة.", "danger");
    const button = form.querySelector("button[type='submit']");
    setSubmitBusy(button, true, "جاري حفظ رابط التجديد...");
    try {
      await fetchJson(`/api/apps/salla/product-mappings/${encodeURIComponent(form.dataset.mappingId)}/renewal-options`, {
        method: optionId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      closePortal(); state.sallaRenewalOptions = null; state.sallaProductMappings = null;
      await syncRouteData(true);
      toast(optionId ? "تم تحديث خيار التجديد." : "تمت إضافة خيار التجديد وربطه بالمنتج.");
    } catch (error) {
      setSubmitBusy(button, false, optionId ? "حفظ التعديلات" : "إضافة خيار التجديد");
      const reason = error.code === "salla_product_not_found" ? "منتج سلة المحدد غير موجود في الكتالوج المتزامن." : error.message;
      toast(reason || "تعذر حفظ خيار التجديد", "danger");
    }
    return;
  }
  if (type === "salla-product-mapping") {
    const [productId, variantId, sku] = String(data.product || "").split("|");
    if (!productId || (!data.planId && !String(data.newPlanName || "").trim())) return toast("اختر باقة حالية أو اكتب اسم باقة جديدة.", "danger");
    const button = form.querySelector("button[type='submit']");
    setSubmitBusy(button, true, "جاري حفظ الربط...");
    try {
      await fetchJson("/api/apps/salla/product-mappings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, productId, variantId: variantId || null, sku: sku || null, durationValue: Number(data.durationValue || 1) }) });
      closePortal();
      state.sallaProductMappings = null;
      if (state.route.startsWith("/dashboard/integrations/salla/products")) await syncRouteData(true);
      toast("تم ربط منتج سلة بالباقة بنجاح.");
    } catch (error) {
      setSubmitBusy(button, false, "حفظ الربط");
      toast(error.message || "تعذر حفظ ربط المنتج.", "danger");
    }
    return;
  }
  if (type === "confirm-subscription-reminder") {
    const button = form.querySelector("button[type='submit'],button:not([type])");
    setSubmitBusy(button, true, "جاري الجدولة...");
    try {
      await fetchJson(`/api/subscriptions/${form.dataset.id}/remind`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({confirmed:true}) });
      closePortal(); invalidateMessageUsage(); state.dbSubscriptions=null; await syncRouteData(true);
      toast("تمت جدولة الرسالة، وسيُخصم الرصيد فقط بعد نجاح الإرسال.");
    } catch (error) {
      setSubmitBusy(button, false, "تأكيد وجدولة الرسالة");
      if (error.code === "PLAN_MESSAGE_LIMIT_REACHED") return showMessageQuotaLimit(error.usage);
      toast(error.message || "تعذرت جدولة التذكير", "danger");
    }
    return;
  }
  if (type === "order-link-template") {
    const button = form.querySelector("button[type='submit']");
    if (button) button.disabled = true;
    try {
      await persistOrderLinkDraft();
      toast("تم حفظ التعديلات");
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
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, locale: state.language })
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok === true && payload?.requiresMfa === true) {
        state.mfaLoginStatus = {
          ok: true,
          expiresAt: payload.expiresAt,
          attemptsRemaining: payload.attemptsRemaining
        };
        setSubmitBusy(button, false, state.language === "en" ? "Sign in" : "تسجيل الدخول");
        history.pushState({}, "", "/auth/verify-mfa");
        render();
        requestAnimationFrame(() => document.querySelector('[data-submit="mfa-login"] input[name="code"]')?.focus());
        appToast.info("أدخل رمز تطبيق المصادقة", {
          description: "تم التحقق من كلمة المرور. أكمل تسجيل الدخول برمز OTP.",
          id: "mfa-login-required"
        });
        return;
      }
      if (response.ok && payload?.ok === true && payload?.requiresEmailOtp === true) {
        state.emailOtpStatus = {
          ok: true,
          maskedEmail: payload.maskedEmail,
          expiresAt: payload.expiresAt,
          resendAt: payload.resendAt,
          attemptsRemaining: 5
        };
        setSubmitBusy(button, false, state.language === "en" ? "Sign in" : "تسجيل الدخول");
        history.pushState({}, "", "/auth/verify-email");
        render();
        requestAnimationFrame(() => document.querySelector('[data-otp-digit="0"]')?.focus());
        appToast.info("أرسلنا رمز التحقق إلى بريدك", {
          description: "أدخل الرمز المكوّن من 6 أرقام لإكمال تسجيل الدخول.",
          id: "email-otp-required"
        });
        return;
      }
      loginAccepted = response.ok && payload?.ok === true && Boolean(payload.user?.id);
      failureReason = payload?.reason || "";
    } catch {
      networkFailed = true;
    }
    if (!loginAccepted) {
      setSubmitBusy(button, false, state.language === "en" ? "Sign in" : "تسجيل الدخول");
      if (networkFailed) return appToast.error("تعذر الاتصال بالخادم", { description: "تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.", id: "login-network" });
      if (failureReason === "rate_limited") return appToast.warning("محاولات تسجيل دخول كثيرة", { description: "انتظر قليلًا قبل المحاولة مرة أخرى.", id: "login-rate-limit" });
      if (failureReason === "email_otp_unavailable") return appToast.error("تعذر إرسال رمز التحقق", { description: "خدمة التحقق عبر البريد غير متاحة حاليًا. تواصل مع مسؤول المنصة.", id: "login-otp-unavailable" });
      if (failureReason === "server_error") return appToast.error("تعذر تسجيل الدخول مؤقتًا", { description: "حدث خطأ في الخادم ولم يتم التحقق من بياناتك. حاول مرة أخرى بعد قليل.", id: "login-server-error" });
      return appToast.error("تعذر تسجيل الدخول", { description: "البريد الإلكتروني أو كلمة المرور غير صحيحة.", id: "login-error" });
    }
    if (!await browserSessionIsValid()) {
      setSubmitBusy(button, false, state.language === "en" ? "Sign in" : "تسجيل الدخول");
      return appToast.error("تعذر إكمال تسجيل الدخول", { description: "حدث خطأ غير متوقع. حاول مرة أخرى بعد قليل.", id: "login-session-error" });
    }
    clearCachedDashboardProfile();
    appToast.success("تم تسجيل الدخول بنجاح", { description: "مرحبًا بك في Renvix، جاري تحويلك إلى لوحة التحكم.", id: "login-success", duration: 1800 });
    setTimeout(() => { void enterDashboardAfterSessionVerification(); }, 650);
    return;
  }
  if (type === "mfa-login") {
    const code = String(data.code || "").trim();
    if (!/^\d{6}$/.test(code) && !/^[A-Za-z0-9-]{8,32}$/.test(code)) {
      return appToast.warning("أدخل رمز تحقق صالحًا", { description: "اكتب الرمز المكوّن من 6 أرقام أو أحد رموز الاسترداد.", id: "mfa-login-invalid-format" });
    }
    const button = form.querySelector("button[type='submit']");
    setSubmitBusy(button, true, "جاري التحقق...");
    try {
      const response = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setSubmitBusy(button, false, "تحقق وسجّل الدخول");
        if (payload.reason === "attempts_exceeded") return appToast.error("تم إيقاف طلب التحقق", { description: "تجاوزت عدد المحاولات المسموح. سجّل الدخول من جديد.", id: "mfa-login-attempts" });
        if (payload.reason === "challenge_expired" || payload.reason === "challenge_invalid") return appToast.error("انتهت صلاحية طلب التحقق", { description: "سجّل الدخول من جديد لبدء طلب آمن آخر.", id: "mfa-login-expired" });
        return appToast.error("رمز المصادقة غير صحيح", { description: `تحقق من الرمز الحالي وحاول مرة أخرى${Number.isFinite(Number(payload.attemptsRemaining)) ? ` — المتبقي ${payload.attemptsRemaining}` : ""}.`, id: "mfa-login-code-error" });
      }
      state.mfaLoginStatus = null;
      clearCachedDashboardProfile();
      if (!await enterDashboardAfterSessionVerification()) throw new Error("session_invalid");
      appToast.success("تم تسجيل الدخول بأمان", { description: "تم التحقق من رمز دخول الحساب OTP بنجاح.", id: "mfa-login-success" });
    } catch (error) {
      setSubmitBusy(button, false, "تحقق وسجّل الدخول");
      if (error?.message !== "session_invalid") appToast.error("تعذر إكمال التحقق", { description: "تحقق من اتصالك ثم حاول مرة أخرى.", id: "mfa-login-network-error" });
    }
    return;
  }
  if (type === "email-otp") {
    const code = collectEmailOtpCode(form);
    if (!/^\d{6}$/.test(code)) {
      return appToast.warning("أدخل رمز التحقق كاملًا", {
        description: "يتكون رمز التحقق من 6 أرقام.",
        id: "email-otp-incomplete"
      });
    }
    const button = form.querySelector("button[type='submit']");
    setSubmitBusy(button, true, "جارٍ التحقق...");
    try {
      const response = await fetch("/api/auth/email-otp/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, rememberDevice: Boolean(form.elements.rememberDevice?.checked) })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        const messages = {
          invalid_code: `رمز التحقق غير صحيح${Number.isFinite(payload.attemptsRemaining) ? ` — تبقى ${payload.attemptsRemaining} محاولات` : ""}.`,
          challenge_expired: "انتهت صلاحية رمز التحقق. اطلب رمزًا جديدًا.",
          challenge_invalid: "طلب التحقق غير صالح. سجّل الدخول من جديد.",
          attempts_exceeded: "تم تجاوز عدد المحاولات المسموح. سجّل الدخول لطلب رمز جديد."
        };
        const error = new Error(messages[payload.reason] || "تعذر التحقق من الرمز.");
        error.reason = payload.reason;
        throw error;
      }
      state.emailOtpStatus = null;
      clearCachedDashboardProfile();
      appToast.success("تم التحقق وتسجيل الدخول", {
        description: "مرحبًا بك في Renvix، جاري تحويلك إلى لوحة التحكم.",
        id: "email-otp-success",
        duration: 1500
      });
      setTimeout(() => { void enterDashboardAfterSessionVerification(); }, 450);
    } catch (error) {
      setSubmitBusy(button, false, "تحقق وتسجيل الدخول ←");
      form.querySelectorAll("[data-otp-digit]").forEach((input) => { input.value = ""; });
      form.querySelector('[data-otp-digit="0"]')?.focus();
      if (["challenge_invalid", "attempts_exceeded"].includes(error.reason)) {
        state.emailOtpStatus = { error: error.message };
        render();
      }
      appToast.error("تعذر إكمال التحقق", {
        description: error.message || "تحقق من الرمز ثم حاول مرة أخرى.",
        id: "email-otp-verify-error"
      });
    }
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
  if (type === "catalog-template") {
    const templateKey = String(data.templateKey || "");
    if (!data.name?.trim() || !data.body?.trim()) return toast("أكمل اسم القالب ومحتوى الرسالة.", "danger");
    const formData = new FormData(form);
    const payload = {
      templateKey,
      name: data.name,
      title: data.title || null,
      body: data.body,
      buttonLabel: data.buttonLabel || null,
      footerText: data.footerText || null,
      themeColor: document.querySelector("[data-catalog-theme]")?.value || "#0EA5A8",
      isActive: data.isActive === "on",
      contentJson: templateKey === "whatsapp_menu" ? {
        sections: [{
          title: data.sectionTitle || "الخدمات",
          rows: formData.getAll("rowTitle").map((title, index) => ({
            id: formData.getAll("rowId")[index] || `option_${index + 1}`,
            title,
            description: formData.getAll("rowDescription")[index] || ""
          }))
        }]
      } : templateKey === "salla_fulfilled" ? { lockedPortalLink: true } : {}
    };
    try {
      const result = await fetchJson("/api/templates/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      state.catalogTemplates = (state.catalogTemplates || []).map((item) => item.templateKey === result.item.templateKey ? result.item : item);
      toast("تم حفظ القالب وتحديث الإصدار نفسه");
      render();
    } catch (error) { toast(error.message || "تعذر حفظ القالب", "danger"); }
    return;
  }
  if (type === "meta-template-create") {
    const components = [];
    if (data.header?.trim()) components.push({ type: "HEADER", format: "TEXT", text: data.header.trim() });
    components.push({ type: "BODY", text: data.body?.trim() || "" });
    if (data.footer?.trim()) components.push({ type: "FOOTER", text: data.footer.trim() });
    const button = form.querySelector("button[type='submit'],button:not([type])");
    setSubmitBusy(button, true, "جارٍ حفظ المسودة...");
    try {
      const payload = await fetchJson("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationId: data.integrationId,
          displayName: data.displayName,
          name: data.name,
          language: data.language,
          category: data.category,
          components
        })
      });
      state.metaTemplates = { ...(state.metaTemplates || {}), items: [payload.item, ...(state.metaTemplates?.items || [])] };
      closePortal();
      toast("تم حفظ قالب Meta كمسودة. لم يتم إرساله للمراجعة بعد.");
      render();
    } catch (error) {
      setSubmitBusy(button, false, "حفظ كمسودة");
      toast(error.message || "تعذر حفظ مسودة القالب.", "danger");
    }
    return;
  }
  if (type === "renewal-template") {
    if (!data.name?.trim()) return toast("اكتب اسمًا للقالب.", "danger");
    if (!data.body?.trim()) return toast("اكتب محتوى رسالة التجديد.", "danger");
    const emailDraft = data.channel === "email" ? readEmailTemplateForm(form) : null;
    if (data.channel === "email" && (!emailDraft.storeName?.trim() || !emailDraft.title?.trim() || !emailDraft.buttonLabel?.trim() || !emailDraft.footerText?.trim())) {
      return toast("أكمل جميع حقول قالب البريد الإلكتروني.", "danger");
    }
    try {
      const requestBody = data.channel === "email" ? emailDraft : {
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
      toast("تم حفظ التعديلات");
      render();
    } catch (error) { toast(error.message || "تعذر حفظ القالب", "danger"); }
    return;
  }
  if (type === "support-request" || type === "support-chat") {
    const body = String(data.details || data.message || "").trim();
    if (!data.name?.trim() || !data.email?.trim() || !data.subject?.trim() || !body) return toast("يرجى تعبئة جميع حقول طلب الدعم.", "danger");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return toast("صيغة البريد الإلكتروني غير صحيحة.", "danger");
    const button = form.querySelector('button[type="submit"]');
    setSubmitBusy(button, true, "جارٍ إرسال الطلب...");
    try {
      const payload = await fetchJson("/api/public/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          type: data.type || "INQUIRY",
          subject: data.subject,
          body
        })
      });
      form.reset();
      if (type === "support-chat") closePortal();
      toast(`تم إرسال طلبك بنجاح. رقم الطلب: ${payload.item?.ticketNumber || "—"}`);
    } catch (error) {
      toast(error.message || "تعذر إرسال طلب الدعم حاليًا.", "danger");
    } finally {
      setSubmitBusy(button, false);
    }
    return;
  }
  if (type === "newsletter") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")) return toast("أدخل بريدًا إلكترونيًا صحيحًا.", "danger");
    form.reset();
    toast("تم الاشتراك في النشرة بنجاح");
    return;
  }
  if (type === "subscription-settings") {
    try {
      await fetchJson(`/api/subscriptions/${form.dataset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminderEnabled: Boolean(form.elements.reminderEnabled?.checked),
          reminderChannel: data.reminderChannel,
          reminderMode: data.reminderMode,
          reminderDaysBefore: Number(data.reminderDaysBefore || 7)
        })
      });
      state.dbSubscriptions = null;
      await syncRouteData(true);
      toast(form.elements.reminderEnabled?.checked ? "تم تفعيل رسالة التذكير وحفظ الإعدادات" : "تم إيقاف رسالة التذكير وإلغاء المواعيد المجدولة");
    } catch (error) { toast(error.message || "تعذر حفظ إعدادات التذكير", "danger"); }
    return;
  }
  if (type === "subscription") {
    const id = form.dataset.id;
    const reminderChannel = data.reminderChannel === "email" ? "email" : "whatsapp";
    const whatsappNumber = String(data.whatsappNumber || "").trim();
    const email = String(data.email || "").trim();
    if (reminderChannel === "whatsapp" && !whatsappNumber) {
      form.elements.whatsappNumber?.focus();
      return appToast.warning("رقم واتساب مطلوب", { description: "أدخل رقم العميل بصيغة دولية لإرسال تذكيرات واتساب.", id: "subscription-whatsapp-required" });
    }
    if (reminderChannel === "email" && !email) {
      form.elements.email?.focus();
      return appToast.warning("البريد الإلكتروني مطلوب", { description: "أدخل بريد العميل لاستقبال تذكيرات التجديد.", id: "subscription-email-required" });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      form.elements.email?.focus();
      return appToast.error("البريد الإلكتروني غير صحيح", { description: "استخدم صيغة مثل name@example.com.", id: "subscription-email-invalid" });
    }
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
      try {
        sessionStorage.setItem("renvix.passwordReset.email", state.resetEmail);
        sessionStorage.setItem("renvix.passwordReset.step", "2");
      } catch {}
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
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(data.password || "")) {
      setFormError(form, "password", "استخدم 8 خانات على الأقل تشمل حروفًا ورقمًا ورمزًا خاصًا.");
      return appToast.warning("كلمة المرور غير قوية", { description: "استخدم 8 خانات على الأقل تشمل حروفًا ورقمًا ورمزًا خاصًا.", id: "reset-password-weak" });
    }
    try {
      let resetEmail = state.resetEmail;
      try { resetEmail ||= sessionStorage.getItem("renvix.passwordReset.email") || ""; } catch {}
      if (!resetEmail) {
        state.resetStep = 1;
        render();
        return appToast.warning("ابدأ طلب الاستعادة من جديد", { description: "أدخل بريد حسابك أولًا لإرسال رمز تحقق جديد.", id: "reset-email-missing" });
      }
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: resetEmail, code: data.code, password: data.password }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.reason === "expired") return appToast.warning("انتهت صلاحية الرمز", { description: "اطلب رمزًا جديدًا لإكمال إعادة تعيين كلمة المرور.", id: "reset-code-expired" });
        if (payload.reason === "invalid") return appToast.error("رمز التحقق غير صحيح", { description: "تحقق من الرمز المرسل إلى بريدك وحاول مرة أخرى.", id: "reset-code-invalid" });
        if (payload.reason === "weak_password") return appToast.warning("كلمة المرور غير قوية", { description: "استخدم حروفًا وأرقامًا ورمزًا خاصًا ثم حاول مرة أخرى.", id: "reset-password-weak-server" });
        if (payload.reason === "server_error") return appToast.error("تعذر إكمال الطلب", { description: "حدث خطأ في الخادم ولم تُغيّر كلمة المرور. حاول مرة أخرى بعد قليل.", id: "reset-server-error" });
        return appToast.error("تعذر تغيير كلمة المرور", { description: "جلسة إعادة التعيين غير صالحة. ابدأ العملية من جديد.", id: "reset-error" });
      }
      state.resetStep = 3;
      state.resetEmail = "";
      try {
        sessionStorage.removeItem("renvix.passwordReset.email");
        sessionStorage.removeItem("renvix.passwordReset.step");
      } catch {}
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
  if (type === "mfa-setup-start") {
    await requestMfaSetup(data.currentPassword);
    return;
  }
  if (type === "mfa-verify") {
    try {
      const payload = await fetchJson("/api/settings/security/mfa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: data.code }) });
      state.mfaSetupPending = false;
      openModal("احفظ رموز الاسترداد", `<form data-submit="mfa-finish" class="grid"><div class="security-setup-step"><span>3</span><div><strong>احفظ رموز الاسترداد</strong><small>تظهر هذه الرموز مرة واحدة فقط، ويُستخدم كل رمز مرة واحدة.</small></div></div><div class="recovery-code-grid">${payload.recoveryCodes.map((code) => `<code>${escapeHtml(code)}</code>`).join("")}</div><div class="inline-actions"><button class="btn btn-secondary" type="button" data-action="copy-recovery-codes">نسخ الرموز</button><button class="btn btn-secondary" type="button" data-action="download-recovery-codes">تنزيل ملف نصي</button></div><label class="setting-row"><span>حفظت رموز الاسترداد في مكان آمن</span><input type="checkbox" name="confirmed" required></label><button class="btn btn-primary">إنهاء</button></form>`);
      state.accountSettings = null; state.securityScore = null; await syncRouteData(true);
      appToast.success("تم التحقق من هويتك", { description: "تم تفعيل دخول الحساب OTP ورفع حماية حسابك.", id: "mfa-enabled" });
    } catch { appToast.error("رمز OTP غير صحيح", { description: "الرمز غير صحيح أو انتهت صلاحيته.", id: "mfa-invalid" }); }
    return;
  }
  if (type === "mfa-finish") {
    closePortal();
    toast("تم حفظ إعداد دخول الحساب OTP", "success");
    return;
  }
  if (type === "mfa-disable") {
    try {
      await fetchJson("/api/settings/security/mfa/disable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: data.password || "", code: data.code || "" }) });
      closePortal(); state.accountSettings = null; state.securityScore = null; await syncRouteData(true); toast("تم إيقاف دخول الحساب OTP");
    } catch (error) { toast(error.message || "تعذر إيقاف دخول الحساب OTP", "danger"); }
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

function supportStatusLabel(value) {
  return {
    NEW: "جديدة", OPEN: "مفتوحة", IN_PROGRESS: "قيد المعالجة",
    WAITING_FOR_USER: "تم الرد", WAITING_FOR_SUPPORT: "بانتظار الرد",
    RESOLVED: "تم الحل", CLOSED: "مغلقة", REOPENED: "أعيد فتحها"
  }[value] || value || "—";
}

function supportTypeLabel(value) {
  return {
    INQUIRY: "استفسار", TECHNICAL_ISSUE: "مشكلة تقنية", SUGGESTION: "اقتراح",
    COMPLAINT: "شكوى", BILLING: "الفوترة", INTEGRATION: "التكاملات",
    ACCOUNT: "الحساب", OTHER: "أخرى"
  }[value] || value || "رسالة";
}

function supportConversation(ticket) {
  if (!ticket) return `<div class="support-empty-conversation">${dashboardIcon("support")}<strong>اختر رسالة لعرض المحادثة</strong><p>ستظهر الردود وتحديثات فريق الدعم هنا.</p></div>`;
  const messages = Array.isArray(ticket.messages) ? ticket.messages.filter((item) => !item.isInternalNote) : [];
  const attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
  return `<section class="support-thread" aria-label="المحادثة">
    <header><div><strong>${escapeHtml(ticket.subject)}</strong><span>${escapeHtml(ticket.ticketNumber)} · ${supportStatusLabel(ticket.status)}</span></div>${["RESOLVED","CLOSED"].includes(ticket.status) ? `<button class="btn btn-secondary" data-action="support-reopen" data-id="${ticket.id}">إعادة فتح التذكرة</button>` : ""}</header>
    <div class="support-thread-messages">${messages.map((message) => `<article class="support-bubble ${message.senderType === "USER" ? "support-bubble-user" : "support-bubble-admin"}"><b>${message.senderType === "USER" ? "أنت" : escapeHtml(message.senderName || "فريق الدعم")}</b><p>${escapeHtml(message.body).replace(/\n/g, "<br>")}</p>${attachments.filter((file) => file.messageId === message.id).map((file) => `<a class="support-attachment-link" href="${escapeHtml(file.url)}" target="_blank" rel="noopener noreferrer">${dashboardIcon("attachment")} ${escapeHtml(file.originalName)}</a>`).join("")}<time>${new Date(message.createdAt).toLocaleString("ar-SA")}</time></article>`).join("")}</div>
    ${["CLOSED"].includes(ticket.status) ? `<p class="support-closed-note">هذه التذكرة مغلقة. يمكنك إعادة فتحها خلال المدة المتاحة.</p>` : `<form class="support-reply-form" data-submit="support-reply" data-ticket-id="${ticket.id}"><textarea name="body" maxlength="2000" minlength="2" placeholder="اكتب ردك..." required></textarea><button class="btn btn-primary" type="submit">إرسال الرد</button></form>`}
  </section>`;
}

function dashboardSupportPage() {
  const payload = state.supportTickets;
  const tickets = Array.isArray(payload?.items) ? payload.items : [];
  const counts = payload?.counts || {};
  const selected = state.supportTicket?.id ? state.supportTicket : null;
  const filters = [["all","الكل",counts.total],["new","جديدة",counts.new],["replied","تم الرد",counts.replied],["closed","مغلقة",counts.closed]];
  return dashboardShell(`
    <section class="dashboard-support-page">
      <div class="support-page-heading"><div><span class="support-heading-icon">${dashboardIcon("support")}</span><div><h1>التواصل والمساعدة</h1><p>أرسل رسالتك إلى فريق الدعم وتابع الردود مباشرة من داخل المنصة.</p></div></div><span class="support-security-note">${dashboardIcon("security")} كل محادثاتك آمنة ومرئية بالكامل داخل المنصة</span></div>
      <div class="support-main-grid">
        <section class="support-conversations card">
          <div class="support-section-title"><div><h2>الإشعارات والردود</h2><p>متابعة جميع رسائلك مع فريق الدعم.</p></div>${dashboardIcon("message")}</div>
          <nav class="support-tabs">${filters.map(([key,label,count]) => `<button class="${state.supportFilter === key ? "active" : ""}" data-action="support-filter" data-filter="${key}">${label}<span>${Number(count || 0)}</span></button>`).join("")}</nav>
          ${payload === null ? `<div class="loading-state">جاري تحميل الرسائل...</div>` : tickets.length ? `<div class="support-ticket-list">${tickets.map((ticket) => `<button class="support-ticket-row ${selected?.id === ticket.id ? "active" : ""}" data-action="support-open" data-id="${ticket.id}"><span class="support-ticket-mark">${dashboardIcon(ticket.type === "COMPLAINT" ? "warning" : "message")}</span><span><b>${escapeHtml(ticket.subject)}</b><small>${supportTypeLabel(ticket.type)} · ${supportStatusLabel(ticket.status)}</small><em>${escapeHtml(ticket.lastMessage || "")}</em></span><time>${new Date(ticket.updatedAt).toLocaleDateString("ar-SA")}</time>${Number(ticket.userUnreadCount || 0) ? `<i>${Number(ticket.userUnreadCount)}</i>` : ""}</button>`).join("")}</div>` : `<div class="support-empty-conversation"><strong>لا توجد رسائل بعد</strong><p>أرسل رسالة جديدة وسيظهر سجلها هنا.</p></div>`}
          ${supportConversation(selected)}
        </section>
        <section class="support-compose card">
          <div class="support-section-title"><div><h2>إرسال رسالة جديدة</h2><p>صف المشكلة بوضوح ليتمكن فريقنا من مساعدتك بسرعة.</p></div>${dashboardIcon("send")}</div>
          <form data-submit="support-ticket">
            <label><span>البريد المرتبط بالحساب</span><input value="${escapeHtml(state.accountSettings?.profile?.email || state.accountSettings?.user?.email || "")}" readonly placeholder="بريد حسابك المسجل"></label>
            <label><span>نوع الرسالة</span><select name="type" required><option value="">اختر نوع الرسالة</option><option value="INQUIRY">استفسار</option><option value="TECHNICAL_ISSUE">مشكلة تقنية</option><option value="SUGGESTION">اقتراح</option><option value="COMPLAINT">شكوى</option><option value="BILLING">الفوترة</option><option value="INTEGRATION">التكاملات</option><option value="ACCOUNT">الحساب</option><option value="OTHER">أخرى</option></select></label>
            <label><span>عنوان الرسالة</span><input name="subject" minlength="5" maxlength="150" required placeholder="اكتب عنوانًا مختصرًا لرسالتك"></label>
            <label><span>تفاصيل الرسالة</span><textarea name="body" minlength="10" maxlength="2000" required placeholder="اكتب رسالتك هنا..."></textarea><small>حتى 2000 حرف</small></label>
            <label class="support-upload-placeholder">${dashboardIcon("upload")}<strong>إرفاق ملفات (اختياري)</strong><span>PNG أو JPG أو WebP أو PDF أو TXT — حتى 5 ملفات و10MB لكل ملف</span><input name="attachments" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.log,image/png,image/jpeg,image/webp,application/pdf,text/plain"></label>
            <button class="btn btn-primary support-send-button" type="submit">${dashboardIcon("send")} إرسال الرسالة</button>
          </form>
        </section>
      </div>
      <div class="support-bottom-note">${dashboardIcon("info")} جميع المحادثات تتم من داخل المنصة فقط، وسيصلك إشعار عند وجود رد جديد.</div>
    </section>`);
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
      "/dashboard/templates": templatesCatalogPage,
      "/dashboard/campaigns": campaignsPage,
      "/dashboard/contacts": contactsPage,
      "/dashboard/devices": devicesWorkspacePage,
      "/dashboard/order-links": orderLinksWorkspacePage,
      "/dashboard/apps": appsPage,
      "/dashboard/apps/custom-integration": customIntegrationPage,
      "/settings/integrations/custom-api": customIntegrationPage,
      "/dashboard/settings/integrations/custom-api": customIntegrationPage,
      "/dashboard/settings/integrations/custom-api/setup": customIntegrationSetupPage,
      "/dashboard/settings/integrations/custom-api/key-created": customIntegrationKeyCreatedPage,
      "/dashboard/settings/integrations/custom-api/webhook": customIntegrationWebhookPage,
      "/dashboard/notifications": notificationsPage,
      "/dashboard/security": securityPage,
      "/dashboard/reports": reportsPage,
      "/dashboard/billing": billingWorkspacePage,
      "/dashboard/settings": settingsPage
      ,"/dashboard/support": dashboardSupportPage
    };
    const dashboardPage = state.route === "/dashboard/integrations/salla/products"
      ? sallaProductsPage
      : /^\/dashboard\/integrations\/salla\/products\/[^/]+$/.test(state.route)
        ? sallaProductRenewalPage
        : state.route === "/dashboard/apps/salla/templates"
          ? sallaAutomationTemplatesPage
          : /^\/dashboard\/apps\/salla\/templates\/[^/]+$/.test(state.route)
            ? sallaAutomationTemplateEditorPage
        : pages[state.route] || dashboardHome;
    app.innerHTML = dashboardPage();
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
    "/auth/verify-email": emailOtpPage,
    "/auth/verify-mfa": mfaLoginPage,
    "/privacy": policyPage,
    "/terms": policyPage,
    "/refund-policy": policyPage,
    "/contact": policyPage
  };
  const isSallaPublicOrder = /^\/o\/(sord|sdig)_/.test(state.route);
  const page = state.route.startsWith("/blog/")
    ? articlePage
    : isSallaPublicOrder || state.route.startsWith("/i/")
      ? publicSallaPage
      : state.route.startsWith("/o/")
        ? publicOrderPage
        : pages[state.route] || marketingHomePage;
  app.innerHTML = page();
  localizeElement(app);
  ensurePasswordToggles();
  if (state.route === "/auth/verify-email") {
    if (!state.emailOtpStatus) queueMicrotask(() => loadEmailOtpStatus());
    requestAnimationFrame(() => {
      updateEmailOtpCountdown();
      document.querySelector('[data-otp-digit="0"]:not([disabled])')?.focus();
    });
  }
  if (state.route === "/auth/verify-mfa") {
    if (!state.mfaLoginStatus) queueMicrotask(() => loadMfaLoginStatus());
    requestAnimationFrame(() => document.querySelector('[data-submit="mfa-login"] input[name="code"]:not([disabled])')?.focus());
  }
}

const CUSTOM_API_BASE = "/dashboard/settings/integrations/custom-api";
const CUSTOM_API_SCOPES = [
  ["customers:read", "قراءة العملاء"],
  ["customers:write", "إدارة العملاء"],
  ["subscriptions:read", "قراءة الاشتراكات"],
  ["subscriptions:write", "إدارة الاشتراكات"],
  ["messages:read", "قراءة الرسائل"],
  ["messages:send", "إرسال الرسائل"]
];
const CUSTOM_API_EVENTS = [
  ["customer.created", "تم إنشاء عميل جديد", "customers"],
  ["subscription.created", "تم إنشاء اشتراك جديد", "subscriptions"],
  ["subscription.renewed", "تم تجديد اشتراك", "refresh"],
  ["message.sent", "تم إرسال رسالة", "send"],
  ["message.delivered", "تم تسليم رسالة", "email"],
  ["payment.succeeded", "تمت عملية دفع بنجاح", "billing"]
];

function customApiPayloadContext() {
  const payload = state.customIntegrations;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const preferredId = state.customIntegrationSecret?.integrationId || state.customIntegrationDraft?.integrationId;
  const item = items.find((entry) => entry.id === preferredId) || items[0] || null;
  const webhook = item?.webhook && typeof item.webhook === "object" ? item.webhook : {};
  const deliveries = Array.isArray(item?.recentDeliveries) ? item.recentDeliveries : [];
  return { payload, items, item, webhook, deliveries };
}

function customApiDate(value) {
  if (!value) return "لا يوجد بعد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "لا يوجد بعد";
  return new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

function customApiHeader(title = "API / Webhook", subtitle = "اربط نظامك الخاص عبر API أو Webhook للتحكم الكامل في التكامل.", icon = "code", trail = "") {
  return `<header class="capi-page-head">
    <div class="capi-breadcrumbs"><span>الإعدادات</span>${dashboardIcon("arrow-left")}<span>التكاملات</span>${trail ? `${dashboardIcon("arrow-left")}<strong>${escapeHtml(trail)}</strong>` : ""}</div>
    <div class="capi-title-row"><span class="capi-title-icon">${dashboardIcon(icon)}</span><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div></div>
  </header>`;
}

function customApiBenefits(includeHelp = false) {
  return `<aside class="capi-side-stack">
    <section class="card capi-benefits">
      <h2>مزايا التكامل</h2>
      <div><span>${dashboardIcon("code")}</span><p><b>تكامل مخصص عبر API</b><small>تحكم كامل في البيانات والصلاحيات</small></p></div>
      <div><span>${dashboardIcon("webhook")}</span><p><b>Webhooks فورية</b><small>استلام الأحداث فور حدوثها</small></p></div>
      <div><span>${dashboardIcon("refresh")}</span><p><b>إرسال واستقبال البيانات</b><small>تكامل ثنائي الاتجاه مع منع التكرار</small></p></div>
      <div><span>${dashboardIcon("security")}</span><p><b>توثيق شامل وآمن</b><small>أمثلة اختبارات ووسائل تدقيق</small></p></div>
    </section>
    ${includeHelp ? `<section class="card capi-help"><h3>تحتاج مساعدة؟</h3><p>راجع وثائق المطور أو تواصل مع فريق الدعم.</p><a class="btn btn-secondary" href="/docs/api" target="_blank" rel="noopener">${dashboardIcon("helpBook")} فتح وثائق المطور</a></section>` : `<section class="capi-secure-note"><span>${dashboardIcon("passwordReset")}</span><div><b>آمن وموثوق</b><small>جميع الاتصالات مشفرة باستخدام TLS 1.2+ لحماية بياناتك.</small></div></section>`}
  </aside>`;
}

function customApiLoadingPage(title = "API / Webhook") {
  return dashboardShell(`<section class="capi-page">${customApiHeader(title)}<div class="loading-state">جاري تحميل بيانات التكامل...</div></section>`);
}

function customApiKeyManagement(item) {
  const keys = Array.isArray(item?.keys) ? item.keys : [];
  const oneTimeSecret = state.customIntegrationSecret?.kind === "api"
    && state.customIntegrationSecret.integrationId === item?.id
    ? state.customIntegrationSecret.value
    : "";
  const activeKeys = keys.filter((key) => !key.revokedAt && String(key.status || "ACTIVE").toUpperCase() !== "REVOKED");
  const keyRows = activeKeys.length
    ? `<div class="capi-managed-keys">
        <div class="capi-managed-keys-head"><strong>المفتاح الحالي</strong><span>واحد نشط</span></div>
        ${activeKeys.slice(0, 1).map((key) => {
          return `<article class="capi-managed-key">
            <div><strong>${escapeHtml(key.name || "مفتاح API")}</strong><code dir="ltr">${escapeHtml(key.prefix || item.latestKeyPrefix || "rvx_")}••••••••••••</code><small>أُنشئ ${customApiDate(key.createdAt)}</small></div>
            <span class="status success">نشط</span>
            <button class="btn btn-danger btn-compact" data-action="revoke-custom-key" data-integration-id="${escapeHtml(item.id)}" data-key-id="${escapeHtml(key.id)}">${dashboardIcon("delete")} إلغاء المفتاح</button>
          </article>`;
        }).join("")}
      </div>`
    : "";

  if (!item?.latestKeyPrefix && !oneTimeSecret && !keys.length) {
    return `<div class="capi-empty-box">${dashboardIcon("key")}<strong>لم يتم إنشاء مفتاح API بعد</strong><p>سيظهر المفتاح مرة واحدة فقط بعد إنشائه.</p><button class="btn btn-primary" data-action="open-custom-api-setup">إنشاء مفتاح API</button></div>`;
  }

  return `${oneTimeSecret ? `<section class="capi-one-time-key">
      <div><span class="status success">${dashboardIcon("success")} مفتاح جديد</span><strong>انسخ المفتاح الحقيقي الآن</strong><small>سيظل ظاهرًا في هذه الجلسة فقط، ولن يمكن استعادته بعد تحديث الصفحة.</small></div>
      <div class="capi-key-copy"><code dir="ltr">${escapeHtml(oneTimeSecret)}</code><button class="btn btn-primary" data-action="copy-custom-secret">${dashboardIcon("copy")} نسخ المفتاح</button></div>
      <button class="btn btn-secondary btn-compact" data-action="dismiss-custom-secret">تم الحفظ وإخفاء المفتاح</button>
    </section>` : ""}
    ${item?.latestKeyPrefix ? `<div class="capi-resource-value"><code dir="ltr">${escapeHtml(item.latestKeyPrefix)}••••••••••••</code><span class="status success">نشط</span></div>` : ""}
    <div class="capi-card-actions"><button class="btn btn-secondary" data-action="rotate-custom-key" data-id="${escapeHtml(item.id)}">${dashboardIcon("refresh")} استبدال المفتاح الحالي</button></div>
    ${keyRows}`;
}

function customIntegrationPage() {
  const { payload, item, webhook, deliveries } = customApiPayloadContext();
  if (payload === null) return customApiLoadingPage();
  if (payload?.error) return dashboardShell(`<section class="capi-page">${customApiHeader()}${emptyState("تعذر تحميل التكامل", escapeHtml(payload.error), "إعادة المحاولة", "reload-custom-integrations")}</section>`);

  const connected = item?.status === "ACTIVE";
  const statusLabel = !item ? "غير مربوط" : connected ? "مربوط" : item.status === "ERROR" ? "يوجد خطأ" : "قيد الإعداد";
  const statusClass = connected ? "success" : item?.status === "ERROR" ? "danger" : "neutral";
  const lastWebhook = webhook.lastSuccessAt || webhook.lastTestedAt;
  const summary = [
    ["apps", "البيئة", item ? (item.environment === "live" ? "إنتاجية" : "تجريبية") : "—", item ? "بيئة التكامل" : "لم يبدأ الإعداد"],
    ["send", "آخر طلب API", customApiDate(item?.latestKeyUsedAt || item?.lastApiRequestAt), item?.latestKeyUsedAt ? "طلب موثق" : "طلبات موثقة"],
    ["success", "آخر Webhook ناجح", customApiDate(lastWebhook), lastWebhook ? "تسليم ناجح" : "تسليمات ناجحة"],
    ["refresh", "آخر مزامنة", customApiDate(item?.lastSuccessAt), item?.lastSuccessAt ? "أحداث مستقرة" : "أحداث مستقلة"],
    ["barChart", "عدد الأحداث / التسليمات", String(Number(item?.events24h || 0) + Number(item?.delivered24h || 0)), "إجمالي"]
  ];

  return dashboardShell(`<section class="capi-page">
    ${customApiHeader()}
    <section class="card capi-overview-status">
      <div class="capi-status-copy"><span class="capi-status-orb ${statusClass}">${dashboardIcon(item ? "code" : "close")}</span><div><small>حالة التكامل</small><strong>${statusLabel}</strong><p>${item ? "يتم تحديث الحالة بعد طلب API أو تسليم Webhook ناجح." : "لم تقم بربط نظامك بعد. ابدأ الآن لإعداد التكامل."}</p></div></div>
      <div class="capi-overview-actions">
        <button class="btn btn-primary" data-action="open-custom-api-setup">${dashboardIcon("settings")} ${item ? "تعديل التكامل" : "إعداد التكامل"}</button>
        ${item && webhook.id ? `<button class="btn btn-secondary" data-action="test-custom-webhook" data-id="${escapeHtml(item.id)}" data-endpoint-id="${escapeHtml(webhook.id)}">${dashboardIcon("send")} اختبار الاتصال</button>` : `<button class="btn btn-secondary" data-action="${item ? "open-custom-api-webhook" : "open-custom-api-setup"}">${dashboardIcon("send")} اختبار الاتصال</button>`}
        <a class="btn btn-secondary" href="/docs/api" target="_blank" rel="noopener">${dashboardIcon("document")} عرض التوثيق</a>
      </div>
    </section>
    <div class="capi-shell-grid">
      <main class="capi-overview-main">
        <div class="capi-summary-grid">${summary.map(([icon,label,value,hint]) => `<article class="card capi-summary-card"><span>${dashboardIcon(icon)}</span><div><small>${label}</small><strong>${escapeHtml(value)}</strong><em>${hint}</em></div></article>`).join("")}</div>
        <div class="capi-config-grid">
          <article class="card capi-resource-card">
            <div class="capi-card-head"><span>${dashboardIcon("key")}</span><div><h2>مفتاح API</h2><p>أنشئ مفتاح API للوصول إلى نظامك عبر واجهة برمجة التطبيقات.</p></div></div>
            ${item ? customApiKeyManagement(item) : `<div class="capi-empty-box">${dashboardIcon("key")}<strong>لم يتم إنشاء مفتاح API بعد</strong><p>سيظهر المفتاح مرة واحدة فقط بعد إنشائه.</p><button class="btn btn-primary" data-action="open-custom-api-setup">إنشاء مفتاح API</button></div>`}
            <footer>${dashboardIcon("info")} احتفظ بالمفتاح في مكان آمن. لا يمكن استعادته بعد إغلاق النافذة.</footer>
          </article>
          <article class="card capi-resource-card">
            <div class="capi-card-head"><span>${dashboardIcon("webhook")}</span><div><h2>Webhook</h2><p>استقبل الأحداث الفورية في نظامك عبر Webhook.</p></div></div>
            ${webhook.id ? `<div class="capi-resource-value"><code dir="ltr">${escapeHtml(webhook.url || "")}</code><span class="status ${webhook.status === "enabled" ? "success" : "warning"}">${webhook.status === "enabled" ? "نشط" : "متوقف"}</span></div><div class="capi-card-actions"><button class="btn btn-secondary" data-action="open-custom-api-webhook">${dashboardIcon("edit")} تحرير Webhook</button><button class="btn btn-primary" data-action="test-custom-webhook" data-id="${escapeHtml(item.id)}" data-endpoint-id="${escapeHtml(webhook.id)}">${dashboardIcon("send")} إرسال حدث تجريبي</button></div>` : `<div class="capi-empty-box">${dashboardIcon("webhook")}<strong>لم تتم إضافة Webhook بعد</strong><p>أكمل إعداد عنوان Webhook أولًا لاستقبال الأحداث.</p><button class="btn btn-primary" data-action="${item ? "open-custom-api-webhook" : "open-custom-api-setup"}">إعداد Webhook</button></div>`}
            <footer>${dashboardIcon("security")} يتم توقيع جميع الأحداث باستخدام HMAC-SHA256 لضمان الأمان.</footer>
          </article>
        </div>
        <section class="card capi-deliveries">
          <div class="capi-card-head"><span>${dashboardIcon("document")}</span><div><h2>سجل الأحداث والتسليمات</h2><p>عرض جميع طلبات API وتسليمات Webhook.</p></div></div>
          ${deliveries.length ? `<div class="capi-table-wrap"><table><thead><tr><th>Event ID</th><th>نوع الحدث</th><th>الحالة</th><th>HTTP</th><th>وقت الإرسال</th><th>المحاولات</th></tr></thead><tbody>${deliveries.map((entry) => `<tr><td><code dir="ltr">${escapeHtml(entry.id)}</code></td><td><code dir="ltr">${escapeHtml(entry.eventType)}</code></td><td><span class="status ${entry.status === "delivered" ? "success" : entry.status === "failed" ? "danger" : "warning"}">${escapeHtml(String(entry.status).toUpperCase())}</span></td><td>${entry.httpStatus || "—"}</td><td>${customApiDate(entry.createdAt)}</td><td>${Number(entry.attempts || 0)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="capi-delivery-empty">${dashboardIcon("document")}<strong>لا توجد تسليمات حتى الآن</strong><p>ستظهر هنا جميع الأحداث وطلبات API والتسليمات بعد إعداد التكامل وبدء الاستخدام.</p></div>`}
        </section>
      </main>
      ${customApiBenefits()}
    </div>
  </section>`);
}

function customIntegrationSetupPage() {
  const { payload, item } = customApiPayloadContext();
  if (payload === null) return customApiLoadingPage("إعداد التكامل الأول");
  const draft = { ...(item || {}), ...(state.customIntegrationDraft || {}) };
  const selectedScopes = new Set(draft.scopes || ["customers:read", "customers:write", "subscriptions:read", "messages:send"]);
  return dashboardShell(`<section class="capi-page">
    ${customApiHeader(item ? "تعديل التكامل" : "إعداد التكامل الأول", item ? "حدّث التكامل الحالي دون إنشاء نسخة أو مفتاح مكرر." : "أكمل إعداد التكامل المخصص عبر API وWebhook لربط نظامك الداخلي باحترافية.", item ? "settings" : "add", "إعداد التكامل")}
    ${item ? `<section class="capi-existing-warning card">${dashboardIcon("info")} يسمح بتكامل API / Webhook واحد فقط. التغييرات هنا تُحفظ على التكامل الحالي.</section>` : ""}
    <div class="capi-setup-layout">
      ${customApiBenefits(true)}
      <main>
        <section class="card capi-setup-summary">
          <div><span>${dashboardIcon("security")}</span><small>نوع التكامل</small><strong>تطبيق مخصص</strong></div>
          <div><span>${dashboardIcon("calendar")}</span><small>الحالة الحالية</small><strong>قيد الإعداد</strong></div>
          <div><span>${dashboardIcon("code")}</span><small>عدد الصلاحيات المحددة</small><strong data-scope-count>${selectedScopes.size}</strong></div>
        </section>
        <form class="card capi-setup-form" data-submit="${item ? "custom-integration-update" : "custom-integration"}" data-integration-id="${escapeHtml(item?.id || "")}">
          <section><h2>1. معلومات التكامل</h2><div class="capi-three-fields">
            <label><span>اسم التكامل</span><input name="name" required maxlength="100" value="${escapeHtml(draft.name || "")}" placeholder="نظام المتجر الداخلي"></label>
            <label><span>البيئة</span><select name="environment"><option value="test" ${draft.environment !== "live" ? "selected" : ""}>تجريبية</option><option value="live" ${draft.environment === "live" ? "selected" : ""}>إنتاجية</option></select></label>
            <label><span>وصف اختياري</span><input name="description" maxlength="300" value="${escapeHtml(draft.description || "")}" placeholder="مزامنة العملاء والاشتراكات والرسائل"></label>
          </div>
          <div class="capi-direction"><span>اتجاه التكامل</span>
            <label><input type="radio" name="direction" value="inbound" ${draft.direction === "inbound" ? "checked" : ""}><i>${dashboardIcon("key")}</i><b>API فقط</b></label>
            <label><input type="radio" name="direction" value="outbound" ${draft.direction === "outbound" ? "checked" : ""}><i>${dashboardIcon("webhook")}</i><b>Webhook فقط</b></label>
            <label><input type="radio" name="direction" value="bidirectional" ${!["inbound", "outbound"].includes(draft.direction) ? "checked" : ""}><i>${dashboardIcon("webhook")}</i><b>API + Webhook</b></label>
          </div></section>
          <section><h2>2. الصلاحيات</h2><div class="capi-choice-grid">${CUSTOM_API_SCOPES.map(([scope,label]) => `<label class="capi-choice"><input type="checkbox" name="scopes" value="${scope}" ${selectedScopes.has(scope) ? "checked" : ""}><span><b dir="ltr">${scope}</b><small>${label}</small></span></label>`).join("")}</div></section>
          <section><h2>3. إعداد أولي لعنوان Webhook</h2><div class="capi-two-fields"><label><span>Webhook URL</span><input type="url" name="initialWebhookUrl" dir="ltr" value="${escapeHtml(draft.initialWebhookUrl || "")}" placeholder="https://example.com/webhooks/renvix"></label><label><span>وصف اختياري</span><input name="initialWebhookDescription" value="${escapeHtml(draft.initialWebhookDescription || "")}" placeholder="مثال: استقبال أحداث العملاء والاشتراكات"></label></div><p class="capi-info-strip">${dashboardIcon("info")} جميع طلبات Webhook يتم توقيعها باستخدام HMAC-SHA256 لضمان الأمان والسلامة.</p></section>
          <footer class="capi-footer-actions"><button class="btn btn-primary" type="submit">${dashboardIcon("security")} ${item ? "حفظ التغييرات" : "إنشاء التكامل والمفتاح"}</button><button class="btn btn-secondary" type="button" data-action="preview-custom-api-setup">${dashboardIcon("eye")} معاينة الإعداد</button><a class="btn btn-secondary" data-link="${CUSTOM_API_BASE}">إلغاء</a></footer>
        </form>
      </main>
    </div>
  </section>`);
}

function customIntegrationKeyCreatedPage() {
  const { payload, item } = customApiPayloadContext();
  if (payload === null) return customApiLoadingPage("إنشاء مفتاح API");
  if (!item) return dashboardShell(`<section class="capi-page">${customApiHeader("إنشاء مفتاح API")}${emptyState("لا يوجد تكامل", "ابدأ بإعداد التكامل الأول لإنشاء مفتاح API.", "إعداد التكامل", "open-custom-api-setup")}</section>`);
  const secret = state.customIntegrationSecret?.kind === "api" ? state.customIntegrationSecret.value : "";
  const scopes = Array.isArray(item.scopes) ? item.scopes : [];
  return dashboardShell(`<section class="capi-page">
    ${customApiHeader("إنشاء مفتاح API", secret ? "تم إنشاء المفتاح بنجاح. انسخه الآن واحتفظ به في مكان آمن، فلن يظهر كاملًا مرة أخرى." : "يمكنك إدارة المفتاح الحالي أو تدويره عند الحاجة.", "code", "إنشاء مفتاح API")}
    <section class="card capi-key-meta"><div>${dashboardIcon("apps")}<span><small>اسم التكامل:</small><strong>${escapeHtml(item.name)}</strong></span></div><div>${dashboardIcon("apps")}<span><small>البيئة:</small><strong>${item.environment === "live" ? "إنتاجية" : "تجريبية"}</strong></span></div><div>${dashboardIcon("success")}<span><small>الحالة:</small><strong>جاهز للاستخدام</strong></span></div></section>
    <div class="capi-key-layout">
      <main>
        <section class="card capi-key-card"><div class="capi-card-head"><span>${dashboardIcon("key")}</span><div><h2>المفتاح الذي تم إنشاؤه</h2></div>${secret ? `<em class="status success">${dashboardIcon("success")} تم الإنشاء</em>` : ""}</div>
          <label><span>مفتاح API</span><div class="capi-key-copy"><code dir="ltr">${escapeHtml(secret || `${item.latestKeyPrefix || "rvx_"}••••••••••••••••`)}</code><button class="btn btn-primary" data-action="copy-custom-secret" ${secret ? "" : "disabled"}>${dashboardIcon("copy")} نسخ المفتاح</button></div></label>
          <p class="capi-warning-strip">${dashboardIcon("warning")} ${secret ? "لن تتمكن من رؤية المفتاح كاملًا بعد إغلاق هذه الصفحة." : "المفتاح الكامل عُرض مرة واحدة فقط عند الإنشاء."}</p>
        </section>
        <section class="card capi-next-steps"><div class="capi-card-head"><span>${dashboardIcon("success")}</span><div><h2>خطواتك التالية</h2></div></div><div><article><b>02 نسخ المفتاح</b><small>انسخ المفتاح واحفظه في مكان آمن.</small></article><article><b>اختبار API</b><small>اختبر اتصالك عبر إرسال طلب تجريبي.</small></article><article><b>03 إضافة Webhook</b><small>أضف Webhook لاستقبال الأحداث.</small></article></div></section>
      </main>
      <aside class="capi-side-stack">
        <section class="card capi-granted"><h2>${dashboardIcon("security")} الصلاحيات الممنوحة</h2>${scopes.map((scope) => `<div><code dir="ltr">${escapeHtml(scope)}</code>${dashboardIcon("success")}</div>`).join("")}</section>
        <section class="card capi-security-guide"><h2>${dashboardIcon("passwordReset")} إرشادات الأمان</h2><ul><li>لا تشارك المفتاح مع أي طرف غير موثوق</li><li>احفظه في متغيرات البيئة فقط</li><li>يمكنك إلغاء المفتاح أو تدويره لاحقًا</li></ul></section>
      </aside>
    </div>
    <footer class="card capi-page-actions"><button class="btn btn-primary" data-action="open-custom-api-webhook">${dashboardIcon("success")} تم، متابعة الإعداد</button><button class="btn btn-secondary" data-action="test-custom-api-key" ${secret ? "" : "disabled"}>${dashboardIcon("send")} اختبار طلب API</button><a class="btn btn-secondary" data-link="${CUSTOM_API_BASE}">${dashboardIcon("arrow-left")} العودة إلى التكامل</a></footer>
  </section>`);
}

function customIntegrationWebhookPage() {
  const { payload, item, webhook } = customApiPayloadContext();
  if (payload === null) return customApiLoadingPage("Webhook");
  if (!item) return dashboardShell(`<section class="capi-page">${customApiHeader("Webhook")}${emptyState("أكمل إعداد التكامل أولًا", "يلزم إنشاء تكامل ومفتاح API قبل إضافة عنوان Webhook.", "إعداد التكامل", "open-custom-api-setup")}</section>`);
  const draft = state.customIntegrationDraft || {};
  const enabledEvents = new Set(Array.isArray(webhook.events) ? webhook.events : ["customer.created", "subscription.created", "subscription.renewed", "message.sent", "payment.succeeded"]);
  const secret = state.customIntegrationSecret?.kind === "webhook" ? state.customIntegrationSecret.value : "";
  return dashboardShell(`<section class="capi-page">
    ${customApiHeader("Webhook", "أضف عنوان الاستقبال وحدد الأحداث التي تريد استلامها بتوقيع آمن.", "webhook", "إعداد Webhook")}
    <section class="card capi-webhook-meta"><div>${dashboardIcon("apps")}<span><small>اسم التكامل</small><strong>${escapeHtml(item.name)}</strong></span></div><div>${dashboardIcon("apps")}<span><small>البيئة</small><strong>${item.environment === "live" ? "إنتاجية" : "تجريبية"}</strong></span></div><div>${dashboardIcon("calendar")}<span><small>الحالة</small><strong>${webhook.id ? "مهيأ" : "قيد الإعداد"}</strong></span></div></section>
    <form class="capi-webhook-form" data-submit="custom-webhook" data-integration-id="${escapeHtml(item.id)}" data-endpoint-id="${escapeHtml(webhook.id || "")}">
      <section class="card capi-webhook-receiver"><h2>بيانات عنوان الاستقبال</h2><label><span>Webhook URL</span><input type="url" name="url" dir="ltr" required value="${escapeHtml(webhook.url || draft.initialWebhookUrl || "")}" placeholder="https://example.com/webhooks/renvix"></label><label><span>وصف اختياري</span><input name="description" maxlength="200" value="${escapeHtml(webhook.description || draft.initialWebhookDescription || "")}" placeholder="استقبال أحداث العملاء والاشتراكات"></label><div class="capi-receiver-options"><label><span>حالة التفعيل</span><input type="checkbox" name="enabled" ${!webhook.id || webhook.status === "enabled" ? "checked" : ""}></label><label><span>مهلة الاتصال</span><select name="timeout" disabled aria-label="مهلة اتصال ثابتة"><option selected>10 ثوانٍ (ثابتة)</option></select></label></div></section>
      <section class="card capi-event-section"><h2>الأحداث المشتركة</h2><p>اختر الأحداث التي ترغب في استلامها عبر هذا Webhook.</p><div class="capi-event-grid">${CUSTOM_API_EVENTS.map(([event,label,icon]) => `<label class="capi-choice"><input type="checkbox" name="events" value="${event}" ${enabledEvents.has(event) ? "checked" : ""}><span>${dashboardIcon(icon)}<b dir="ltr">${event}</b><small>${label}</small></span></label>`).join("")}</div></section>
      <section class="card capi-secret-card"><h2>${dashboardIcon("security")} سر التوقيع</h2><p>استخدم هذا السر للتحقق من توقيع المحتوى باستخدام HMAC-SHA256.</p><div class="capi-key-copy"><code dir="ltr">${escapeHtml(secret || "whsec_••••••••••••••••••••")}</code><button class="btn btn-secondary" type="button" data-action="copy-custom-secret" ${secret ? "" : "disabled"}>${dashboardIcon("copy")} نسخ السر</button></div><p class="capi-warning-strip">${dashboardIcon("warning")} يظهر هذا السر مرة واحدة فقط. استخدمه للتحقق من توقيع HMAC-SHA256.</p></section>
      <section class="card capi-test-card"><h2>${dashboardIcon("send")} اختبار الاتصال</h2><p>أرسل حدثًا تجريبيًا للتأكد من استجابة عنوان الاستقبال بشكل صحيح.</p>${webhook.id ? `<button class="btn btn-primary" type="button" data-action="test-custom-webhook" data-id="${escapeHtml(item.id)}" data-endpoint-id="${escapeHtml(webhook.id)}">${dashboardIcon("send")} إرسال حدث تجريبي</button>` : `<button class="btn btn-primary" type="submit">${dashboardIcon("save")} حفظ ثم إرسال اختبار</button>`}<p class="capi-success-strip">${dashboardIcon("success")} سيتم إرسال حدث تجريبي بعد الحفظ.</p></section>
      <section class="card capi-retry-card"><h2>${dashboardIcon("refresh")} سياسة إعادة المحاولة</h2><ul><li>إعادة المحاولة عند 500</li><li>إعادة عند Timeout</li><li>تعطيل العنوان بعد الإخفاقات المتكررة</li></ul><p class="capi-info-strip">${dashboardIcon("info")} نعيد المحاولة باستخدام تزايد أُسّي حتى 72 ساعة.</p></section>
      <footer class="card capi-page-actions"><button class="btn btn-primary" type="submit">${dashboardIcon("send")} ${webhook.id ? "حفظ التغييرات وإرسال اختبار" : "حفظ وإرسال اختبار"}</button><button class="btn btn-secondary" type="button" data-action="preview-webhook-payload">${dashboardIcon("eye")} معاينة Payload</button><a class="btn btn-secondary" data-link="${CUSTOM_API_BASE}">إلغاء</a></footer>
    </form>
  </section>`);
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
  if (!event.target.closest(".dashboard-search")) {
    const quickSearchResults = document.querySelector("[data-global-search-results]");
    if (quickSearchResults) quickSearchResults.hidden = true;
    document.querySelector('[data-action="global-search"]')?.setAttribute("aria-expanded", "false");
  }
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
  const globalSearch = event.target.closest?.('[data-action="global-search"]');
  if (globalSearch) {
    const matches = dashboardQuickSearchMatches(globalSearch.value);
    if (event.key === "Escape") {
      event.preventDefault();
      state.globalSearch = "";
      globalSearch.value = "";
      refreshDashboardQuickSearch(globalSearch);
      return;
    }
    if (event.key === "ArrowDown") {
      const firstResult = globalSearch.closest(".dashboard-search")?.querySelector("[data-global-search-result]");
      if (firstResult) {
        event.preventDefault();
        firstResult.focus();
      }
      return;
    }
    if (event.key === "Enter" && matches[0]) {
      event.preventDefault();
      void navigate(matches[0].route);
      return;
    }
  }
  const target = event.target.closest?.("[data-otp-digit]");
  if (!target) return;
  const index = Number(target.dataset.otpDigit);
  if (event.key === "Backspace" && !target.value && index > 0) {
    event.preventDefault();
    const previous = document.querySelector(`[data-otp-digit="${index - 1}"]`);
    if (previous) {
      previous.value = "";
      previous.focus();
    }
  }
  if (event.key === "ArrowLeft" && index < 5) document.querySelector(`[data-otp-digit="${index + 1}"]`)?.focus();
  if (event.key === "ArrowRight" && index > 0) document.querySelector(`[data-otp-digit="${index - 1}"]`)?.focus();
});

document.addEventListener("input", (event) => {
  const target = event.target;
  const sallaTemplateForm = target.closest?.('form[data-submit="salla-automation-template"]');
  if (sallaTemplateForm && ["whatsappContent", "emailTextContent", "emailSubject", "buttonLabel", "buttonEnabled", "secureLinkEnabled", "linkPageTitle", "linkPageContent", "showCountdown", "themeColor"].includes(target.name)) {
    refreshSallaTemplatePreview(sallaTemplateForm);
  }
  if (target.matches?.("[data-otp-digit]")) {
    const normalized = normalizeEmailOtpCode(target.value);
    const index = Number(target.dataset.otpDigit);
    if (normalized.length > 1) {
      [...normalized].slice(0, 6).forEach((digit, digitIndex) => {
        const input = document.querySelector(`[data-otp-digit="${digitIndex}"]`);
        if (input) input.value = digit;
      });
      document.querySelector(`[data-otp-digit="${Math.min(5, normalized.length - 1)}"]`)?.focus();
      return;
    }
    const value = normalizeEmailOtpDigit(normalized);
    target.value = value;
    if (value && index < 5) document.querySelector(`[data-otp-digit="${index + 1}"]`)?.focus();
    return;
  }
  const profileForm = target.closest?.('[data-submit="profile-settings"]');
  if (profileForm) {
    const nameChanged = String(profileForm.elements.fullName?.value || "").trim() !== String(profileForm.dataset.originalName || "");
    const storeChanged = profileForm.elements.storeName && !profileForm.elements.storeName.disabled && String(profileForm.elements.storeName.value || "").trim() !== String(profileForm.dataset.originalStore || "");
    const phoneChanged = String(profileForm.elements.phone?.value || "").trim() !== String(profileForm.dataset.originalPhone || "");
    const button = profileForm.querySelector(".profile-save-button");
    if (button) button.disabled = !(nameChanged || storeChanged || phoneChanged);
  }
  if (target.dataset.emailField !== undefined) refreshEmailTemplatePreview();
  if (target.dataset.action === "template-body") {
    const preview = document.querySelector("[data-whatsapp-preview-body]");
    if (preview) preview.textContent = target.value || "اكتب محتوى الرسالة ليظهر هنا.";
  }
  if (target.dataset.catalogPreviewBody !== undefined) {
    document.querySelectorAll("[data-catalog-preview-output]").forEach((preview) => { preview.textContent = target.value || "اكتب محتوى الرسالة ليظهر هنا."; });
    const emailBody = document.querySelector("[data-catalog-email-preview] .email-preview-body");
    if (emailBody) {
      emailBody.querySelectorAll("p:not(.email-thanks)").forEach((node) => node.remove());
      const action = emailBody.querySelector("a");
      String(target.value || "").split(/\n{2,}/).filter(Boolean).forEach((text) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = text;
        emailBody.insertBefore(paragraph, action);
      });
    }
  }
  if (target.dataset.catalogPreviewButton !== undefined) {
    document.querySelectorAll("[data-catalog-preview-button-output]").forEach((preview) => { preview.textContent = target.value; });
    const emailButton = document.querySelector("[data-catalog-email-preview] .email-preview-body a");
    if (emailButton) emailButton.textContent = target.value;
  }
  if (target.dataset.catalogPreviewTitle !== undefined) {
    const subject = document.querySelector("[data-catalog-preview-title-output]");
    if (subject) subject.textContent = `الموضوع: ${target.value}`;
    const heading = document.querySelector("[data-catalog-email-preview] .email-preview-body h3");
    if (heading) heading.textContent = target.value;
  }
  if (target.dataset.catalogPreviewFooter !== undefined) {
    const footer = document.querySelector("[data-catalog-email-preview] .email-thanks");
    if (footer) footer.textContent = `${target.value} ♥`;
  }
  if (target.dataset.catalogTheme !== undefined) {
    const envelope = document.querySelector("[data-catalog-email-preview] .email-envelope");
    if (envelope) envelope.style.setProperty("--email-theme", safeEmailTheme(target.value));
  }
  if (target.dataset.catalogPreviewRow !== undefined || target.dataset.catalogPreviewDescription !== undefined) {
    const index = Number(target.dataset.catalogPreviewRow ?? target.dataset.catalogPreviewDescription);
    const form = target.closest("form");
    const titles = [...(form?.querySelectorAll("[data-catalog-preview-row]") || [])];
    const descriptions = [...(form?.querySelectorAll("[data-catalog-preview-description]") || [])];
    const list = document.querySelector("[data-catalog-menu-preview]");
    if (list) list.innerHTML = titles.map((input, rowIndex) => `<li><strong>${escapeHtml(input.value)}</strong><span>${escapeHtml(descriptions[rowIndex]?.value || "")}</span></li>`).join("");
  }
  if (target.dataset.action === "template-catalog-search") {
    state.templateCatalogSearch = target.value;
    render();
    requestAnimationFrame(() => {
      const input = document.querySelector('[data-action="template-catalog-search"]');
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
    return;
  }
  if (target.dataset.sallaRuleField) {
    const index = Number(target.dataset.ruleIndex);
    const drafts = readSallaRuleDrafts();
    if (drafts[index]) drafts[index][target.dataset.sallaRuleField] = target.dataset.sallaRuleField === "durationDays" ? Number(target.value) : target.value;
    state.sallaRuleDrafts = drafts;
  }
  if (target.dataset.action === "global-search") {
    state.globalSearch = target.value;
    refreshDashboardQuickSearch(target);
    return;
  }
  if (target.dataset.action === "dashboard-search" || target.dataset.action === "support-search" || target.dataset.action === "notification-search") {
    state.search = target.value;
    if (state.route === "/dashboard/subscriptions" && target.dataset.action === "dashboard-search") {
      clearTimeout(state.subscriptionSearchTimer);
      state.subscriptionSearchTimer = setTimeout(() => { state.subscriptionPage=1; state.dbSubscriptions=null; syncRouteData(true); render(); }, 350);
    } else render();
  }
  if (target.dataset.action === "pairing-phone-input") {
    state.linkedDevice.phoneInput = target.value;
  }
  if (target.dataset.action === "device-search") {
    state.deviceSearch = target.value;
    render();
    requestAnimationFrame(() => {
      const input = document.querySelector('[data-action="device-search"]');
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
    return;
  }
  if (target.dataset.orderField) {
    const value = target.type === "checkbox" ? target.checked : target.dataset.orderField === "logoBorderRadius" ? safeStoreLogoRadius(target.value) : target.value;
    state.orderLinkDraft[target.dataset.orderField] = value;
    if (target.dataset.orderField === "logoBorderRadius") {
      const output = target.closest(".store-logo-radius-control")?.querySelector("[data-logo-radius-output]");
      if (output) output.textContent = `${value}px`;
      target.closest(".store-logo-editor")?.querySelector(".store-logo-editor-preview img")?.style.setProperty("--store-logo-radius", `${value}px`);
    }
    refreshOrderLinkPreview();
  }
  if (target.dataset.orderNote !== undefined) {
    state.orderLinkDraft.additionalNotes[Number(target.dataset.orderNote)] = target.value;
    refreshOrderLinkPreview();
  }
});

document.addEventListener("focusin", (event) => {
  const globalSearch = event.target.closest?.('[data-action="global-search"]');
  if (globalSearch) refreshDashboardQuickSearch(globalSearch);
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.action === "campaign-channel") {
    const form = target.closest("form");
    form?.querySelectorAll("[data-campaign-panel]").forEach((panel) => {
      const active = panel.dataset.campaignPanel === target.value;
      panel.toggleAttribute("hidden", !active);
      panel.querySelectorAll("input,select,textarea").forEach((control) => { control.disabled = !active; });
    });
    return;
  }
  if (target.dataset.action === "campaign-template") {
    const form = target.closest("form");
    const selected = target.selectedOptions?.[0];
    const body = form?.elements.body;
    const subject = form?.elements.subject;
    if (body && selected?.dataset.templateBody) body.value = selected.dataset.templateBody;
    if (subject && selected?.dataset.templateSubject) subject.value = selected.dataset.templateSubject;
    return;
  }
  if (target.dataset.action === "campaign-all-days") {
    target.closest(".campaign-days")?.querySelectorAll('input[name="allowedDays"]').forEach((input) => { input.checked = target.checked; });
    return;
  }
  if (target.name === "allowedDays") {
    const days = [...(target.closest(".campaign-days")?.querySelectorAll('input[name="allowedDays"]') || [])];
    const all = target.closest(".campaign-days")?.querySelector('[data-action="campaign-all-days"]');
    if (all) all.checked = days.length > 0 && days.every((input) => input.checked);
  }
  if (target.dataset.sallaChannelChoice !== undefined) {
    const form = target.closest("form");
    form?.querySelectorAll("[data-channel-panel]").forEach((panel) => {
      panel.toggleAttribute("hidden", panel.dataset.channelPanel !== target.value);
    });
    refreshSallaTemplatePreview(form);
    const testButton = form?.querySelector("[data-salla-test-button]");
    if (testButton) {
      testButton.disabled = true;
      testButton.title = "احفظ قناة الإرسال أولًا قبل إرسال الاختبار.";
    }
    return;
  }
  if (target.dataset.action === "renewal-option-mode") {
    const form = target.closest("form");
    const automatic = target.value === "automatic";
    form?.querySelector("[data-renewal-auto]")?.toggleAttribute("hidden", !automatic);
    form?.querySelector("[data-renewal-manual]")?.toggleAttribute("hidden", automatic);
    const catalog = form?.elements.catalogProduct;
    const manual = form?.elements.manualUrl;
    if (catalog) catalog.required = automatic;
    if (manual) manual.required = !automatic;
    state.renewalOptionMode = automatic ? "automatic" : "manual";
    return;
  }
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
  if (target.dataset.action === "store-logo-file" && target.files?.[0]) {
    void (async () => {
      try {
        const file = target.files[0];
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("اختر صورة PNG أو JPG أو WebP.");
        if (file.size > 2 * 1024 * 1024) throw new Error("يجب ألا يتجاوز حجم صورة المتجر 2 ميجابايت.");
        const formData = new FormData();
        formData.append("file", file);
        const payload = await fetchJson("/api/order-link/profile/logo", { method: "POST", body: formData });
        state.orderLinkProfile = { ...(state.orderLinkProfile || {}), logoUrl: payload.logoUrl };
        state.orderLinkDraft.logoUrl = payload.logoUrl;
        render();
        appToast.success("تم تحديث صورة المتجر", { description: "ظهرت الصورة في المعاينة وستُستخدم في البريد وصفحة معلومات الطلب.", id: "store-logo-updated" });
      } catch (error) {
        appToast.error("تعذر رفع صورة المتجر", { description: error.message || "حاول مرة أخرى بعد قليل.", id: "store-logo-upload-error" });
      }
    })();
    return;
  }
  if (target.dataset.action === "salla-email-logo-file" && target.files?.[0]) {
    void (async () => {
      const form = target.closest("form");
      try {
        const file = target.files[0];
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("اختر صورة PNG أو JPG أو WebP.");
        if (file.size > 2 * 1024 * 1024) throw new Error("يجب ألا يتجاوز حجم شعار المتجر 2 ميجابايت.");
        const formData = new FormData();
        formData.append("file", file);
        const payload = await fetchJson("/api/order-link/profile/logo", { method: "POST", body: formData });
        if (state.sallaAutomationTemplate) {
          state.sallaAutomationTemplate.storeProfile = {
            ...(state.sallaAutomationTemplate.storeProfile || {}),
            logoUrl: payload.logoUrl
          };
        }
        refreshSallaTemplatePreview(form, { logoUrl: payload.logoUrl });
        form?.querySelectorAll('[data-action="choose-salla-email-logo"]').forEach((button) => {
          button.innerHTML = `${dashboardIcon("upload")} تغيير الشعار`;
        });
        appToast.success("تم حفظ شعار المتجر", { description: "سيظهر في معاينة ورسائل البريد لجميع قوالب سلة.", id: "salla-email-logo-updated" });
      } catch (error) {
        appToast.error("تعذر رفع شعار المتجر", { description: error.message || "حاول مرة أخرى بعد قليل.", id: "salla-email-logo-error" });
      } finally {
        target.value = "";
      }
    })();
    return;
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
  if (target.dataset.action === "device-status-filter") {
    state.deviceStatusFilter = target.value || "all";
    render();
  }
  if (target.dataset.action === "notification-filter") {
    state.notificationFilter = target.value;
    render();
  }
  if (target.dataset.action === "subscription-reminder-channel") {
    syncSubscriptionDeliveryFields(target.closest("form"));
  }
  if (target.dataset.action === "subscription-customer") {
    syncSubscriptionDeliveryFields(target.closest("form"), true);
  }
  if (target.dataset.action === "subscription-window") {
    state.subscriptionWindow = target.value;
    state.subscriptionPage=1; state.dbSubscriptions=null; syncRouteData(true); render();
  }
  if (target.dataset.action === "subscription-status-filter") { state.subscriptionStatus=target.value; state.subscriptionPage=1; state.dbSubscriptions=null; syncRouteData(true); render(); }
  if (target.dataset.action === "subscription-plan-filter") { state.subscriptionPlanId=target.value; state.subscriptionPage=1; state.dbSubscriptions=null; syncRouteData(true); render(); }
  if (target.dataset.action === "subscription-channel-filter") { state.subscriptionChannel=target.value; state.subscriptionPage=1; state.dbSubscriptions=null; syncRouteData(true); render(); }
  if (target.dataset.action === "subscription-source-filter") { state.subscriptionSource=target.value; state.subscriptionPage=1; state.dbSubscriptions=null; syncRouteData(true); render(); }
  if (target.dataset.action === "subscription-reminder-status-filter") { state.subscriptionReminderStatus=target.value; state.subscriptionPage=1; state.dbSubscriptions=null; syncRouteData(true); render(); }
  if (target.dataset.action === "subscription-date-from") { state.subscriptionDateFrom=target.value; state.subscriptionPage=1; state.dbSubscriptions=null; syncRouteData(true); render(); }
  if (target.dataset.action === "subscription-date-to") { state.subscriptionDateTo=target.value; state.subscriptionPage=1; state.dbSubscriptions=null; syncRouteData(true); render(); }
  if (target.dataset.action === "preference-select") {
    const value = target.value;
    const key = target.dataset.preference;
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
    if (state.route === "/dashboard/templates") void navigate(`/dashboard/templates?edit=renewal_${state.templateChannel}`);
    else render();
  }
  if (target.dataset.action === "template-catalog-channel") {
    state.templateCatalogChannel = target.value || target.dataset.channel || "all";
    render();
  }
  if (target.dataset.action === "template-custom-theme") {
    const form = target.closest("form") || document.querySelector("form[data-submit='renewal-template']");
    const color = safeEmailTheme(target.value);
    const hidden = form?.querySelector("input[name='themeColor']");
    state.emailThemeColor = color;
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
    } else if (target.dataset.orderField === "subscriptionId") {
      state.orderLinkDraft = { ...state.orderLinkDraft, linkId: "", createdOrderNumber: "", createdCustomerName: "" };
      render();
    }
    else refreshOrderLinkPreview();
  }
  if (target.dataset.orderVisible) {
    state.orderLinkDraft.visibleFields[target.dataset.orderVisible] = target.checked;
    refreshOrderLinkPreview();
  }
});

window.addEventListener("popstate", render);
document.addEventListener("paste", (event) => {
  const target = event.target.closest?.("[data-otp-digit]");
  if (!target) return;
  const digits = normalizeEmailOtpCode(event.clipboardData?.getData("text") || "");
  if (!digits) return;
  event.preventDefault();
  [...digits].slice(0, 6).forEach((digit, index) => {
    const input = document.querySelector(`[data-otp-digit="${index}"]`);
    if (input) input.value = digit;
  });
  document.querySelector(`[data-otp-digit="${Math.min(5, digits.length - 1)}"]`)?.focus();
});
setInterval(updateEmailOtpCountdown, 1000);
setInterval(() => {
  if (state.route !== "/dashboard/support" || document.visibilityState !== "visible") return;
  state.supportTickets = null;
  if (state.supportSelectedId) state.supportTicket = null;
  void syncRouteData(true);
}, 25_000);
render();
if (state.route === "/dashboard/devices") void syncLinkedDevice();
