// Video ichida KO'RINADIGAN va ESHITILADIGAN matnlar hamda butun Sayt UI i18n tili.
import { Quiz } from "../types";

export type QuizLanguage = NonNullable<Quiz["language"]>;
export type UILanguage = "uz" | "ru" | "en" | "tr";

export interface VideoStrings {
  questionBadge: string; // "SAVOL" (badge: SAVOL 1/5)
  thinking: string; // taymer yorlig'i
  correctAnswer: string; // javob ochilgandagi yorliq
  explanationBadge: string; // "IZOH", "WHY?", "ФАКТ", "NEDEN?"
  hideLastAnswerCommentPrompt: string; // "Oxirgi savol javobini va necha ball to'plaganingizni izohda yozing!"
  hideLastAnswerBadge: string; // "IZOHDA YOZING 💬"
  outroCtaText: string; // "🤖 Bunday videolarni 1 daqiqada yarating!..."
  introBadge: string; // intro'dagi rangli badge
  introCount: (n: number) => string; // intro pastki matni
  outroTitle: string;
  outroSubtitle: string;
  seconds: string; // preview taymeridagi "Soniya"
  ready: string; // preview taymeridagi "Tayyor"
  ttsCorrect: (letter: string, option: string, explanation?: string) => string; // TTS o'qiydigan javob va izoh
}

const STRINGS: Record<QuizLanguage, VideoStrings> = {
  uz: {
    questionBadge: "SAVOL",
    thinking: "O'YLASH VAQTI...",
    correctAnswer: "TO'G'RI JAVOB",
    explanationBadge: "IZOH",
    hideLastAnswerCommentPrompt: "Oxirgi savol javobini va necha ball to'plaganingizni izohda yozing!",
    hideLastAnswerBadge: "IZOHDA YOZING 💬",
    outroCtaText: "🤖 Bunday videolarni 1 daqiqada yarating! Profilimizdagi havolaga kiring yoki izohga «AI» deb yozing!",
    introBadge: "NECHTASINI TOPASIZ?",
    introCount: (n) => `${n} ta savol • Javoblari ichida`,
    outroTitle: "Videoga Like Bosing!",
    outroSubtitle: "Kanalga obuna bo'lishni unutmang",
    seconds: "Soniya",
    ready: "Tayyor",
    ttsCorrect: (letter, option, explanation) =>
      `To'g'ri javob: ${letter}, ${option}.${explanation ? ` ${explanation}` : ""}`,
  },
  en: {
    questionBadge: "QUESTION",
    thinking: "TIME TO THINK...",
    correctAnswer: "CORRECT ANSWER",
    explanationBadge: "WHY?",
    hideLastAnswerCommentPrompt: "Write the answer to the last question and your score in the comments!",
    hideLastAnswerBadge: "WRITE IN COMMENTS 💬",
    outroCtaText: "🤖 Create videos like this in 1 minute! Click the link in bio or comment «QUIZ» below!",
    introBadge: "HOW MANY CAN YOU GET?",
    introCount: (n) => `${n} questions • Answers inside`,
    outroTitle: "Like this video!",
    outroSubtitle: "Don't forget to subscribe",
    seconds: "Seconds",
    ready: "Done",
    ttsCorrect: (letter, option, explanation) =>
      `The correct answer is ${letter}, ${option}.${explanation ? ` ${explanation}` : ""}`,
  },
  ru: {
    questionBadge: "ВОПРОС",
    thinking: "ВРЕМЯ ПОДУМАТЬ...",
    correctAnswer: "ПРАВИЛЬНЫЙ ОТВЕТ",
    explanationBadge: "ФАКТ",
    hideLastAnswerCommentPrompt: "Напишите ответ на последний вопрос и ваш счёт в комментариях!",
    hideLastAnswerBadge: "ПИШИТЕ В КОММЕНТАРИЯХ 💬",
    outroCtaText: "🤖 Создавайте такие видео за 1 минуту! Ссылка в профиле или напишите «ИИ» в комментарии!",
    introBadge: "СКОЛЬКО УГАДАЕШЬ?",
    introCount: (n) => `Вопросов: ${n} • Ответы внутри`,
    outroTitle: "Ставь лайк!",
    outroSubtitle: "Не забудь подписаться на канал",
    seconds: "Секунды",
    ready: "Готово",
    ttsCorrect: (letter, option, explanation) =>
      `Правильный ответ: ${letter}, ${option}.${explanation ? ` ${explanation}` : ""}`,
  },
  tr: {
    questionBadge: "SORU",
    thinking: "DÜŞÜNME ZAMANI...",
    correctAnswer: "DOĞRU CEVAP",
    explanationBadge: "NEDEN?",
    hideLastAnswerCommentPrompt: "Son sorunun cevabını ve puanınızı yorumlara yazın!",
    hideLastAnswerBadge: "YORUMLARA YAZIN 💬",
    outroCtaText: "🤖 1 dakikada böyle videolar yapın! Profildeki linke tıklayın veya yorumlara «AI» yazın!",
    introBadge: "KAÇINI BİLEBİLİRSİN?",
    introCount: (n) => `${n} soru • Cevaplar içinde`,
    outroTitle: "Videoyu beğen!",
    outroSubtitle: "Kanala abone olmayı unutma",
    seconds: "Saniye",
    ready: "Hazır",
    ttsCorrect: (letter, option, explanation) =>
      `Doğru cevap: ${letter}, ${option}.${explanation ? ` ${explanation}` : ""}`,
  },
};

export function getVideoStrings(language?: string): VideoStrings {
  return STRINGS[(language as QuizLanguage) || "uz"] || STRINGS.uz;
}

export interface UIStrings {
  // Navbar
  navGenerator: string;
  navUpgrade: string;
  navReferral: string;
  navLogin: string;
  navLogout: string;
  navAdmin: string;
  freeBadge: string;
  unlimitedBadge: string;
  
  // Page Header & Banners
  pageTitle: string;
  pageSubtitle: string;
  tgBannerTitle: string;
  tgBannerDesc: string;
  tgBannerBtn: string;
  refBannerTitle: string;
  refBannerDesc: string;
  refBannerBtn: string;

  // Step 1
  step1Title: string;
  step1Subtitle: string;
  topicPlaceholder: string;
  voiceListening: string;
  btnGenerateAI: string;
  btnGeneratingQuestions: string;
  btnGeneratingVoices: string;
  trendingTitle: string;
  languageSelectLabel: string;
  haveQuizFile: string;
  importJson: string;
  exportJson: string;
  sampleTemplate: string;

  // Step 2 (Questions)
  step2Title: string;
  btnBulkImages: string;
  btnBulkVoices: string;
  questionLabel: string;
  questionPlaceholder: string;
  optionsLabel: string;
  explanationLabel: string;
  explanationPlaceholder: string;
  bgImageLabel: string;
  voiceAudioLabel: string;
  btnUploadImg: string;
  btnFindAIImg: string;
  btnGenVoice: string;
  btnListenVoice: string;
  btnDeleteQuestion: string;
  btnAddQuestion: string;
  btnAddOption: string;
  customUploadBtn: string;

  // Step 3 & 4 (Settings)
  settingsTitle: string;
  settingsDesc: string;
  step3Title: string;
  step3Subtitle: string;
  videoFormatLabel: string;
  verticalShorts: string;
  verticalFormatSubtitle: string;
  horizontalYoutube: string;
  youtubeFormatSubtitle: string;
  voiceSelectLabel: string;
  voiceKore: string;
  voiceAoede: string;
  voicePuck: string;
  voiceCharon: string;
  voiceFenrir: string;
  timerDurationLabel: string;
  timerDurationInputLabel: string;
  timerStyleLabel: string;
  timerLine: string;
  timerCircle: string;
  timerRetro: string;
  transitionEffectLabel: string;
  transSlide: string;
  transZoom: string;
  transFade: string;
  themesLabel: string;
  themeColorLabel: string;
  colorEmerald: string;
  colorCyan: string;
  colorViolet: string;
  colorRose: string;
  colorAmber: string;
  bgmLabel: string;
  bgmStyleLabel: string;
  bgmVolumeLabel: string;
  customBgmUpload: string;
  watermarkLabel: string;
  watermarkTip: string;
  watermarkPaywallAlert: string;
  bgmRecommendTip: string;

  questionCountLabel: string;
  questionCount3: string;
  questionCount5: string;
  hideLastAnswerLabel: string;
  hideLastAnswerDesc: string;
  outroEnabledLabel: string;
  outroEnabledDesc: string;

  // Background Video & Auto-Factory
  uploadBgVideoBtn: string;
  removeBgVideoBtn: string;
  bgVideoActive: string;
  autoFactoryTitle: string;
  autoFactoryBtn: string;

  // Paywall & B2B
  paywallB2BBadge: string;
  paywallB2BTitle: string;
  paywallB2BDesc: string;
  paywallB2BPrice: string;
  paywallB2BPriceUnit: string;
  paywallB2BBtn: string;
  paywallB2BTelegramMsg: string;

  // Landing Page
  landingHeroBadge: string;
  landingHeroTitle: string;
  landingHeroDesc: string;
  landingHeroStartFree: string;
  landingHeroPricingBtn: string;
  landingWhoTitle: string;
  landingWhoSubtitle: string;
  landingAudience1Title: string;
  landingAudience1Desc: string;
  landingAudience2Title: string;
  landingAudience2Desc: string;
  landingAudience3Title: string;
  landingAudience3Desc: string;

  // Action bar
  btnPreview: string;
  btnExportVideo: string;
  btnExporting: string;
  btnCancelExport: string;
}

const UI_DICTIONARY: Record<UILanguage, UIStrings> = {
  uz: {
    navGenerator: "Generator",
    navUpgrade: "Tariflar",
    navReferral: "🎁 Bonus Olish",
    navLogin: "Kirish",
    navLogout: "Chiqish",
    navAdmin: "Admin Panel",
    freeBadge: "Bepul",
    unlimitedBadge: "Cheksiz",

    pageTitle: "Quiz Video Tayyorlash",
    pageSubtitle: "3 qadam: savollar tayyorlang → tekshiring → videoni yuklab oling",
    tgBannerTitle: "Telegram Botimiz: @QuizVideoAIBot",
    tgBannerDesc: "Telegram ichida to'g'ridan-to'g'ri video yaratish va chatga qabul qilish mumkin!",
    tgBannerBtn: "Botda ochish ↗",
    refBannerTitle: "Do'stingizni taklif qiling — Bepul video oling!",
    refBannerDesc: "Har bir taklif qilgan do'stingiz uchun sizga +1 ta bepul video sovg'a qilinadi.",
    refBannerBtn: "Havolani olish →",

    step1Title: "AI yordamida savollar yarating",
    step1Subtitle: "Mavzuni yozing yoki mikrofonga ayting — AI savollar, javob izohlari va rasmlarni avtomatik tuzib beradi.",
    topicPlaceholder: "Mavzuni kiriting (masalan: Tarix, Kosmos, Sport...)",
    voiceListening: "🎙 Eshitilmoqda... Mavzuni ayting...",
    btnGenerateAI: "AI bilan yaratish",
    btnGeneratingQuestions: "Savollar tuzilmoqda...",
    btnGeneratingVoices: "Ovozlar yaratilmoqda...",
    trendingTitle: "🔥 Ommabop mavzular (Bitta bosishda AI yaratadi):",
    languageSelectLabel: "Video Tili",
    haveQuizFile: "Tayyor testingiz bormi?",
    importJson: "Import (.json)",
    exportJson: "Eksport",
    sampleTemplate: "Shablon namunasi",

    step2Title: "Savollarni tekshiring",
    btnBulkImages: "Barcha rasmlar (AI)",
    btnBulkVoices: "Barcha ovozlar (AI)",
    questionLabel: "Savol",
    questionPlaceholder: "Savolni kiriting...",
    optionsLabel: "Variantlar (To'g'ri javobni yashil qilib belgilang)",
    explanationLabel: "Javob izohi (ixtiyoriy)",
    explanationPlaceholder: "Nega bu javob to'g'riligi haqida qisqa fakt...",
    bgImageLabel: "Fon rasmi (URL, fayl yuklash yoki qidirish)",
    voiceAudioLabel: "AI Suxandon ovozi",
    btnUploadImg: "Rasm yuklash",
    btnFindAIImg: "AI Rasm",
    btnGenVoice: "Ovoz yaratish",
    btnListenVoice: "Eshitish",
    btnDeleteQuestion: "Savolni o'chirish",
    btnAddQuestion: "Yangi savol qo'shish",
    btnAddOption: "Variant qo'shish",
    customUploadBtn: "Komp'yuterdan yuklash",

    settingsTitle: "Video sozlamalari",
    settingsDesc: "Suxandon ovozi, taymer, dizayn mavzusi, musiqa",
    step3Title: "AI Suxandon ovozi",
    step3Subtitle: "Videongiz uchun eng jarangdor va mos ovozni tanlang",

    videoFormatLabel: "Video formati",
    verticalShorts: "Shorts / Reels",
    verticalFormatSubtitle: "1080×1920 · 9:16 Tik",
    horizontalYoutube: "YouTube Long",
    youtubeFormatSubtitle: "1920×1080 · 16:9 Keng",
    voiceSelectLabel: "Suxandon ovozi (AI)",
    voiceKore: "Kore (Ayol, sokin)",
    voiceAoede: "Aoede (Ayol, jarangdor)",
    voicePuck: "Puck (Erkak, energiya)",
    voiceCharon: "Charon (Erkak, jiddiy)",
    voiceFenrir: "Fenrir (Erkak, chuqur)",
    timerDurationLabel: "O'ylash vaqti (Taymer)",
    timerDurationInputLabel: "O'ylash vaqti (soniya)",
    timerStyleLabel: "Taymer uslubi",
    timerLine: "Chiziqli",
    timerCircle: "Aylanma",
    timerRetro: "Retro",
    transitionEffectLabel: "O'tish effekti",
    transSlide: "Slide",
    transZoom: "Zoom",
    transFade: "Fade",
    themesLabel: "Premium Mavzular",
    themeColorLabel: "Mavzu Rangi",
    colorEmerald: "Yashil (Emerald)",
    colorCyan: "Havorang (Cyan)",
    colorViolet: "Siyohrang (Violet)",
    colorRose: "Pushti (Rose)",
    colorAmber: "Sariq (Amber)",
    bgmLabel: "Fon musiqasini yoqish (BGM)",
    bgmStyleLabel: "Musiqa uslubi (BGM Style)",
    bgmVolumeLabel: "Musiqa ovozi balandligi (Volume)",
    customBgmUpload: "O'z MP3 musiqangizni yuklash",
    watermarkLabel: "Watermark (@username)",
    watermarkTip: "* Bepul va oddiy tariflarda suv belgisi majburiy bo'lib, uni o'chirish faqat premium foydalanuvchilar uchun ruxsat etiladi.",
    watermarkPaywallAlert: "Shaxsiy kanal nomini qo'yish faqat Pack10 va Premium tariflarida mavjud",
    bgmRecommendTip: "* AI suxandon ovozi aniq eshitilishi uchun 15% - 30% oralig'i eng maqbul hisoblanadi.",

    questionCountLabel: "Savollar soni",
    questionCount3: "3 ta savol (Shorts/Reels tezkor — tavsiya etiladi)",
    questionCount5: "5 ta savol (Standart)",
    hideLastAnswerLabel: "Oxirgi savol javobini yashirish (Komment yig'ish)",
    hideLastAnswerDesc: "Eng oxirgi savolda to'g'ri javob ochilmaydi va tomoshabinlarga javobni izohda yozish tavsiya qilinadi",
    outroEnabledLabel: "Yakuniy chorlov (Outro) qo'shish",
    outroEnabledDesc: "Videoning oxiriga 3 soniyalik chiroyli sotuv va profilga taklif kartasi qo'shiladi",

    uploadBgVideoBtn: "🎬 Orqa fonga video (.mp4/.webm) yuklash",
    removeBgVideoBtn: "🗑 Videoni o'chirish / Rasm rejimiga qaytish",
    bgVideoActive: "🎬 Harakatlanuvchi video fon yoqilgan",
    autoFactoryTitle: "🚀 4 Tilda Avto-Zavod va 30 Kunlik Reja",
    autoFactoryBtn: "🚀 Avto-Zavod (4 til)",

    paywallB2BBadge: "VIP / 30 KUNLIK REJA",
    paywallB2BTitle: "VIP / B2B Tayyor Paket (30 ta video)",
    paywallB2BDesc: "Oʻquv markazlari, repetitorlar va ekspertlar uchun: vaqtingiz yoʻqmi? Biz sizning mavzularingiz va shaxsiy logotipingiz asosida 1 oylik (30 dona) tayyor videoni 24 soatda oʻzimiz tayyorlab beramiz!",
    paywallB2BPrice: "350 000 soʻm",
    paywallB2BPriceUnit: "1 oylik (30 ta) video",
    paywallB2BBtn: "✈️ Buyurtma berish (Telegram)",
    paywallB2BTelegramMsg: "Assalomu alaykum! Men B2B Tayyor Paket (30 ta video) buyurtma qilmoqchiman. Mijoz ID: ",

    landingHeroBadge: "AI bilan 60 soniyada",
    landingHeroTitle: "1 ta mavzu kiriting — 60 soniyada Instagram Reels, YouTube Shorts va TikTok uchun 4 tilda tayyor viktorina videosini oling!",
    landingHeroDesc: "Mavzuni yozing — AI savollarni tuzadi, professional ovoz bilan o'qiydi va tayyor 16:9 uzun yoki 9:16 vertikal videoni yuklab beradi. Montaj ham, studiya ham kerak emas.",
    landingHeroStartFree: "🎁 1 ta videoni hoziroq BEPUL yaratib koʻring",
    landingHeroPricingBtn: "Tariflar",
    landingWhoTitle: "Kimlar uchun?",
    landingWhoSubtitle: "Har bir soha uchun maxsus moslashtirilgan video generator",
    landingAudience1Title: "Repetitorlar va Oʻquv markazlari",
    landingAudience1Desc: "DTM, IELTS, tarix, avto-test va fan savollarini 1 daqiqada obunachilarni jalb qiluvchi Reels formatiga aylantiring.",
    landingAudience2Title: "YouTube va TikTok (Faceless) kreatorlar",
    landingAudience2Desc: "Yuzingizni koʻrsatmasdan 4 ta tilda (UZ, RU, EN, TR) kanal yuriting va YouTube monetizatsiyasiga tezroq chiqing.",
    landingAudience3Title: "SMM-mutaxassislar va Blogerlar",
    landingAudience3Desc: "Mijozlaringiz sahifasida izohlar va koʻrishlar sonini (Engagement) 3 barobar oshiruvchi interaktiv kontent yarating.",

    btnPreview: "Ko'rish (Preview)",
    btnExportVideo: "Video Yuklab Olish",
    btnExporting: "Video Tayyorlanmoqda...",
    btnCancelExport: "Bekor qilish",
  },
  ru: {
    navGenerator: "Генератор",
    navUpgrade: "Тарифы",
    navReferral: "🎁 Получить бонус",
    navLogin: "Войти",
    navLogout: "Выйти",
    navAdmin: "Панель админа",
    freeBadge: "Бесплатно",
    unlimitedBadge: "Безлимит",

    pageTitle: "Создание Quiz Видео",
    pageSubtitle: "3 шага: создайте вопросы → проверьте → скачайте готовое видео",
    tgBannerTitle: "Наш Telegram бот: @QuizVideoAIBot",
    tgBannerDesc: "Создавайте видео прямо внутри Telegram и получайте в чат!",
    tgBannerBtn: "Открыть в боте ↗",
    refBannerTitle: "Пригласи друга — Получи бесплатное видео!",
    refBannerDesc: "За каждого приглашенного друга вам дарится +1 бесплатное видео.",
    refBannerBtn: "Получить ссылку →",

    step1Title: "Создайте викторину с помощью ИИ",
    step1Subtitle: "Напишите тему или скажите в микрофон — ИИ автоматически сгенерирует вопросы, пояснения и подберет фоны.",
    topicPlaceholder: "Введите тему (например: История, Космос, Спорт...)",
    voiceListening: "🎙 Слушаю... Назовите тему...",
    btnGenerateAI: "Создать с ИИ",
    btnGeneratingQuestions: "Генерация вопросов...",
    btnGeneratingVoices: "Создание озвучки...",
    trendingTitle: "🔥 Популярные темы (Создание в 1 клик):",
    languageSelectLabel: "Язык видео",
    haveQuizFile: "Есть готовый тест?",
    importJson: "Импорт (.json)",
    exportJson: "Экспорт",
    sampleTemplate: "Пример шаблона",

    step2Title: "Проверьте вопросы",
    btnBulkImages: "Все картинки (ИИ)",
    btnBulkVoices: "Все озвучки (ИИ)",
    questionLabel: "Вопрос",
    questionPlaceholder: "Введите вопрос...",
    optionsLabel: "Варианты (Отметьте правильный ответ зеленым)",
    explanationLabel: "Пояснение к ответу (необязательно)",
    explanationPlaceholder: "Короткий интересный факт, почему ответ верен...",
    bgImageLabel: "Фоновое изображение (URL, загрузка или поиск)",
    voiceAudioLabel: "Озвучка ИИ",
    btnUploadImg: "Загрузить фото",
    btnFindAIImg: "ИИ Картинка",
    btnGenVoice: "Создать голос",
    btnListenVoice: "Слушать",
    btnDeleteQuestion: "Удалить вопрос",
    btnAddQuestion: "Добавить вопрос",
    btnAddOption: "Добавить вариант",
    customUploadBtn: "Загрузить с устройства",

    settingsTitle: "Настройки видео",
    settingsDesc: "Голос диктора, таймер, тема дизайна, фоновая музыка",
    step3Title: "Голос диктора ИИ",
    step3Subtitle: "Выберите подходящий голос для озвучивания видео",

    videoFormatLabel: "Формат видео",
    verticalShorts: "Shorts / Reels",
    verticalFormatSubtitle: "1080×1920 · 9:16 Вертикальный",
    horizontalYoutube: "YouTube Long",
    youtubeFormatSubtitle: "1920×1080 · 16:9 Горизонтальный",
    voiceSelectLabel: "Голос диктора (ИИ)",
    voiceKore: "Kore (Женский, спокойный)",
    voiceAoede: "Aoede (Женский, звонкий)",
    voicePuck: "Puck (Мужской, энергичный)",
    voiceCharon: "Charon (Мужской, солидный)",
    voiceFenrir: "Fenrir (Мужской, глубокий)",
    timerDurationLabel: "Время на размышление (Таймер)",
    timerDurationInputLabel: "Время на размышление (секунды)",
    timerStyleLabel: "Стиль таймера",
    timerLine: "Линейный",
    timerCircle: "Круговой",
    timerRetro: "Ретро",
    transitionEffectLabel: "Эффект перехода",
    transSlide: "Слайд",
    transZoom: "Зум",
    transFade: "Затухание",
    themesLabel: "Премиум Темы",
    themeColorLabel: "Цвет темы",
    colorEmerald: "Изумрудный (Emerald)",
    colorCyan: "Голубой (Cyan)",
    colorViolet: "Фиолетовый (Violet)",
    colorRose: "Розовый (Rose)",
    colorAmber: "Золотой (Amber)",
    bgmLabel: "Включить фоновую музыку (BGM)",
    bgmStyleLabel: "Стиль музыки (BGM)",
    bgmVolumeLabel: "Громкость музыки (Volume)",
    customBgmUpload: "Загрузить свой MP3 трек",
    watermarkLabel: "Водяной знак (@username)",
    watermarkTip: "* На бесплатном тарифе водяной знак обязателен. Удаление доступно в тарифе Premium.",
    watermarkPaywallAlert: "Установка своего водяного знака доступна только на тарифах Pack10 и Premium",
    bgmRecommendTip: "* Для четкой слышимости диктора рекомендуется громкость 15% - 30%.",

    questionCountLabel: "Количество вопросов",
    questionCount3: "3 вопроса (Shorts/Reels быстрый — рекомендуется)",
    questionCount5: "5 вопросов (Стандарт)",
    hideLastAnswerLabel: "Скрыть ответ на последний вопрос (Сбор комментариев)",
    hideLastAnswerDesc: "В самом последнем вопросе ответ не показывается, зрителям предлагается написать его в комментариях",
    outroEnabledLabel: "Добавить финальный призыв (Аутро)",
    outroEnabledDesc: "В конец видео добавляется 3-секундная карточка с призывом перейти в профиль",

    uploadBgVideoBtn: "🎬 Загрузить фоновое видео (.mp4/.webm)",
    removeBgVideoBtn: "🗑 Удалить видео / Вернуться к фото",
    bgVideoActive: "🎬 Живой видеофон включен",
    autoFactoryTitle: "🚀 Авто-Завод (4 языка) и План на 30 дней",
    autoFactoryBtn: "🚀 Авто-Завод (4 языка)",

    paywallB2BBadge: "VIP / НА 30 ДНЕЙ",
    paywallB2BTitle: "VIP / B2B Готовый Пакет (30 видео)",
    paywallB2BDesc: "Для учебных центров, репетиторов и экспертов: нет времени? Мы сами создадим для вас 30 готовых видео на месяц с вашим логотипом и по вашим темам за 24 часа!",
    paywallB2BPrice: "$29",
    paywallB2BPriceUnit: "30 готовых видео",
    paywallB2BBtn: "✈️ Заказать (Telegram)",
    paywallB2BTelegramMsg: "Здравствуйте! Я хочу заказать VIP / B2B Готовый Пакет (30 видео). Мой ID: ",

    landingHeroBadge: "ИИ за 60 секунд",
    landingHeroTitle: "Введите 1 тему — и за 60 секунд получите готовое видео для Reels, Shorts и TikTok на 4 языках!",
    landingHeroDesc: "Напишите тему — ИИ создаст вопросы, озвучит профессиональным диктором и сгенерирует готовое видео 9:16 или 16:9. Без монтажа и студии.",
    landingHeroStartFree: "🎁 Создайте 1 видео прямо сейчас БЕСПЛАТНО",
    landingHeroPricingBtn: "Тарифы",
    landingWhoTitle: "Для кого этот сервис?",
    landingWhoSubtitle: "Идеально подходит для авторов контента, педагогов и бизнеса",
    landingAudience1Title: "Репетиторы и учебные центры",
    landingAudience1Desc: "Превращайте экзаменационные тесты, историю и языковые темы в вирусный формат Reels за 1 минуту.",
    landingAudience2Title: "YouTube и TikTok (Faceless) авторы",
    landingAudience2Desc: "Ведите каналы без показа лица на 4 языках (UZ, RU, EN, TR) и быстрее выходите на монетизацию YouTube.",
    landingAudience3Title: "SMM-специалисты и блогеры",
    landingAudience3Desc: "Создавайте интерактивный контент, увеличивающий комментарии и просмотры (Engagement) ваших клиентов в 3 раза.",

    btnPreview: "Просмотр (Preview)",
    btnExportVideo: "Скачать видео",
    btnExporting: "Рендеринг видео...",
    btnCancelExport: "Отмена",
  },
  en: {
    navGenerator: "Generator",
    navUpgrade: "Pricing",
    navReferral: "🎁 Get Free Bonus",
    navLogin: "Sign In",
    navLogout: "Sign Out",
    navAdmin: "Admin Panel",
    freeBadge: "Free",
    unlimitedBadge: "Unlimited",

    pageTitle: "Quiz Video Creator",
    pageSubtitle: "3 steps: generate questions → review & edit → download video",
    tgBannerTitle: "Our Telegram Bot: @QuizVideoAIBot",
    tgBannerDesc: "Generate videos directly inside Telegram and receive in your chat!",
    tgBannerBtn: "Open in Bot ↗",
    refBannerTitle: "Invite a friend — Get a free video!",
    refBannerDesc: "For each invited friend, you get +1 free video reward.",
    refBannerBtn: "Get Link →",

    step1Title: "Generate Quiz Video with AI",
    step1Subtitle: "Type a topic or speak into your mic — AI will automatically create questions, facts, and matching images.",
    topicPlaceholder: "Enter a topic (e.g. History, Space, Sports...)",
    voiceListening: "🎙 Listening... Speak your topic...",
    btnGenerateAI: "Generate with AI",
    btnGeneratingQuestions: "Generating questions...",
    btnGeneratingVoices: "Generating voices...",
    trendingTitle: "🔥 Trending topics (1-click AI generation):",
    languageSelectLabel: "Video Language",
    haveQuizFile: "Have a quiz file?",
    importJson: "Import (.json)",
    exportJson: "Export",
    sampleTemplate: "Sample Template",

    step2Title: "Review Questions",
    btnBulkImages: "All Images (AI)",
    btnBulkVoices: "All Voices (AI)",
    questionLabel: "Question",
    questionPlaceholder: "Enter question...",
    optionsLabel: "Options (Mark the correct answer in green)",
    explanationLabel: "Answer Explanation (optional)",
    explanationPlaceholder: "Short interesting fact explaining why it is correct...",
    bgImageLabel: "Background Image (URL, upload or search)",
    voiceAudioLabel: "AI Voiceover",
    btnUploadImg: "Upload Image",
    btnFindAIImg: "AI Image",
    btnGenVoice: "Generate Voice",
    btnListenVoice: "Listen",
    btnDeleteQuestion: "Delete question",
    btnAddQuestion: "Add question",
    btnAddOption: "Add option",
    customUploadBtn: "Upload from device",

    settingsTitle: "Video Settings",
    settingsDesc: "Narrator voice, timer, visual theme, background music",
    step3Title: "AI Voice Narrator",
    step3Subtitle: "Choose the best voice tone for your quiz video",

    videoFormatLabel: "Video Format",
    verticalShorts: "Shorts / Reels",
    verticalFormatSubtitle: "1080×1920 · 9:16 Vertical",
    horizontalYoutube: "YouTube Long",
    youtubeFormatSubtitle: "1920×1080 · 16:9 Landscape",
    voiceSelectLabel: "AI Narrator Voice",
    voiceKore: "Kore (Female, calm)",
    voiceAoede: "Aoede (Female, energetic)",
    voicePuck: "Puck (Male, energetic)",
    voiceCharon: "Charon (Male, authoritative)",
    voiceFenrir: "Fenrir (Male, deep)",
    timerDurationLabel: "Thinking Time (Timer)",
    timerDurationInputLabel: "Thinking Time (seconds)",
    timerStyleLabel: "Timer Style",
    timerLine: "Linear",
    timerCircle: "Circular",
    timerRetro: "Retro",
    transitionEffectLabel: "Transition Effect",
    transSlide: "Slide",
    transZoom: "Zoom",
    transFade: "Fade",
    themesLabel: "Visual Themes",
    themeColorLabel: "Accent Color",
    colorEmerald: "Emerald (Green)",
    colorCyan: "Cyan (Sky Blue)",
    colorViolet: "Violet (Purple)",
    colorRose: "Rose (Pink)",
    colorAmber: "Amber (Gold)",
    bgmLabel: "Enable Background Music (BGM)",
    bgmStyleLabel: "BGM Music Style",
    bgmVolumeLabel: "Music Volume",
    customBgmUpload: "Upload Custom MP3 Audio",
    watermarkLabel: "Watermark (@username)",
    watermarkTip: "* Watermark is mandatory on free plan. Upgrade to Premium to remove or customize.",
    watermarkPaywallAlert: "Custom watermark is available exclusively on Pack10 and Premium plans",
    bgmRecommendTip: "* 15% - 30% volume is recommended for crystal-clear narrator voice.",

    questionCountLabel: "Question Count",
    questionCount3: "3 questions (Fast Shorts/Reels — recommended)",
    questionCount5: "5 questions (Standard)",
    hideLastAnswerLabel: "Hide last answer (Comment booster)",
    hideLastAnswerDesc: "The answer to the final question won't be shown, asking viewers to comment their guess",
    outroEnabledLabel: "Add Outro Call-To-Action",
    outroEnabledDesc: "Adds a 3-second closing card inviting viewers to check your link in bio",

    uploadBgVideoBtn: "🎬 Upload Background Video (.mp4/.webm)",
    removeBgVideoBtn: "🗑 Remove Video / Back to Images",
    bgVideoActive: "🎬 Looping video background active",
    autoFactoryTitle: "🚀 4-Language Auto-Factory & 30-Day Plan",
    autoFactoryBtn: "🚀 Auto-Factory (4 Langs)",

    paywallB2BBadge: "VIP / 30-DAY PACK",
    paywallB2BTitle: "VIP / B2B Done-For-You Pack (30 videos)",
    paywallB2BDesc: "For educators, agencies & creators: short on time? We will create 30 ready-to-post custom quiz videos with your branding and topics within 24 hours!",
    paywallB2BPrice: "$29",
    paywallB2BPriceUnit: "30 custom videos",
    paywallB2BBtn: "✈️ Order on Telegram",
    paywallB2BTelegramMsg: "Hello! I want to order the VIP / B2B Done-For-You Package (30 videos). Client ID: ",

    landingHeroBadge: "AI in 60 Seconds",
    landingHeroTitle: "Enter 1 topic — get ready-to-post quiz videos for Instagram Reels, YouTube Shorts & TikTok in 4 languages within 60 seconds!",
    landingHeroDesc: "Type a topic — AI creates engaging questions, voices them with pro narrators, and renders ready-to-post 9:16 or 16:9 videos. No editing or studio required.",
    landingHeroStartFree: "🎁 Create 1 video right now for FREE",
    landingHeroPricingBtn: "Pricing",
    landingWhoTitle: "Who is this for?",
    landingWhoSubtitle: "Built for educators, viral creators, and digital agencies",
    landingAudience1Title: "Tutors & Education Centers",
    landingAudience1Desc: "Turn exam tests, IELTS, history, quizzes, and lessons into high-engagement Reels in under a minute.",
    landingAudience2Title: "YouTube & TikTok (Faceless) Creators",
    landingAudience2Desc: "Run faceless channels in 4 languages (UZ, RU, EN, TR) and reach YouTube monetization significantly faster.",
    landingAudience3Title: "SMM Experts & Digital Creators",
    landingAudience3Desc: "Create interactive quiz content that triples comments, shares, and engagement on your client pages.",

    btnPreview: "Preview",
    btnExportVideo: "Download Video",
    btnExporting: "Rendering Video...",
    btnCancelExport: "Cancel",
  },
  tr: {
    navGenerator: "Oluşturucu",
    navUpgrade: "Paketler",
    navReferral: "🎁 Bonus Kazan",
    navLogin: "Giriş Yap",
    navLogout: "Çıkış",
    navAdmin: "Yönetici Paneli",
    freeBadge: "Ücretsiz",
    unlimitedBadge: "Sınırsız",

    pageTitle: "Quiz Video Hazırlama",
    pageSubtitle: "3 adım: soruları hazırlayın → inceleyin → videoyu indirin",
    tgBannerTitle: "Telegram Botumuz: @QuizVideoAIBot",
    tgBannerDesc: "Doğrudan Telegram içinde video oluşturun ve sohbette teslim alın!",
    tgBannerBtn: "Bota git ↗",
    refBannerTitle: "Arkadaşını davet et — Ücretsiz video kazan!",
    refBannerDesc: "Davet ettiğiniz her arkadaşınız için +1 ücretsiz video hediye edilir.",
    refBannerBtn: "Bağlantıyı Al →",

    step1Title: "Yapay Zeka ile Bilgi Yarışması Oluşturun",
    step1Subtitle: "Bir konu yazın veya mikrofona söyleyin — Yapay Zeka soruları, açıklamaları ve arka planları otomatik hazırlar.",
    topicPlaceholder: "Bir konu yazın (örnek: Tarih, Uzay, Spor...)",
    voiceListening: "🎙 Dinleniyor... Konuyu söyleyin...",
    btnGenerateAI: "Yapay Zekayla Oluştur",
    btnGeneratingQuestions: "Sorular hazırlanıyor...",
    btnGeneratingVoices: "Sesler oluşturuluyor...",
    trendingTitle: "🔥 Popüler Konular (Tek tıkla Yapay Zeka oluşturur):",
    languageSelectLabel: "Video Dili",
    haveQuizFile: "Hazır testiniz var mı?",
    importJson: "İçe aktar (.json)",
    exportJson: "Dışa aktar",
    sampleTemplate: "Örnek Şablon",

    step2Title: "Soruları İnceleyin",
    btnBulkImages: "Tüm Resimler (AI)",
    btnBulkVoices: "Tüm Seslendirmeler (AI)",
    questionLabel: "Soru",
    questionPlaceholder: "Soruyu yazın...",
    optionsLabel: "Seçenekler (Doğru cevabı yeşil olarak işaretleyin)",
    explanationLabel: "Cevap Açıklaması (isteğe bağlı)",
    explanationPlaceholder: "Cevabın neden doğru olduğuna dair kısa bir bilgi...",
    bgImageLabel: "Arka Plan Resmi (URL, yükleme veya arama)",
    voiceAudioLabel: "Yapay Zeka Seslendirmesi",
    btnUploadImg: "Resim Yükle",
    btnFindAIImg: "AI Resim",
    btnGenVoice: "Ses Oluştur",
    btnListenVoice: "Dinle",
    btnDeleteQuestion: "Soruyu sil",
    btnAddQuestion: "Soru ekle",
    btnAddOption: "Seçenek ekle",
    customUploadBtn: "Cihazdan yükle",

    settingsTitle: "Video Ayarları",
    settingsDesc: "Spiker sesi, zamanlayıcı, görsel tema, müzik",
    step3Title: "Yapay Zeka Spiker Sesi",
    step3Subtitle: "Videonuz için en uygun ses tonunu seçin",

    videoFormatLabel: "Video Formatı",
    verticalShorts: "Shorts / Reels",
    verticalFormatSubtitle: "1080×1920 · 9:16 Dikey",
    horizontalYoutube: "YouTube Tam Video",
    youtubeFormatSubtitle: "1920×1080 · 16:9 Yatay",
    voiceSelectLabel: "Spiker Sesi (AI)",
    voiceKore: "Kore (Kadın, sakin)",
    voiceAoede: "Aoede (Kadın, berrak)",
    voicePuck: "Puck (Erkek, enerjik)",
    voiceCharon: "Charon (Erkek, ciddi)",
    voiceFenrir: "Fenrir (Erkek, derin)",
    timerDurationLabel: "Düşünme Süresi (Zamanlayıcı)",
    timerDurationInputLabel: "Düşünme Süresi (saniye)",
    timerStyleLabel: "Zamanlayıcı Stili",
    timerLine: "Çizgisel",
    timerCircle: "Dairesel",
    timerRetro: "Retro",
    transitionEffectLabel: "Geçiş Efekti",
    transSlide: "Kayma",
    transZoom: "Yakınlaşma",
    transFade: "Kararma",
    themesLabel: "Görsel Temalar",
    themeColorLabel: "Tema Rengi",
    colorEmerald: "Zümrüt Yeşili (Emerald)",
    colorCyan: "Açık Mavi (Cyan)",
    colorViolet: "Mor (Violet)",
    colorRose: "Pembe (Rose)",
    colorAmber: "Kehribar (Amber)",
    bgmLabel: "Arka Plan Müziğini Aç (BGM)",
    bgmStyleLabel: "Müzik Tarzı (BGM)",
    bgmVolumeLabel: "Müzik Ses Seviyesi",
    customBgmUpload: "Kendi MP3 Müziğinizi Yükleyin",
    watermarkLabel: "Filigran (@username)",
    watermarkTip: "* Ücretsiz pakette filigran zorunludur. Kaldırmak için Premium'a geçin.",
    watermarkPaywallAlert: "Özel filigran yalnızca Pack10 ve Premium paketlerinde kullanılabilir",
    bgmRecommendTip: "* Spiker sesinin net duyulması için %15 - %30 aralığı önerilir.",

    questionCountLabel: "Soru Sayısı",
    questionCount3: "3 soru (Hızlı Shorts/Reels — önerilen)",
    questionCount5: "5 soru (Standart)",
    hideLastAnswerLabel: "Son sorunun cevabını gizle (Yorum toplama)",
    hideLastAnswerDesc: "Son soruda doğru cevap gösterilmez, izleyicilerden cevabı yorumlara yazması istenir",
    outroEnabledLabel: "Bitiş çağrısı (Outro) ekle",
    outroEnabledDesc: "Videonun sonuna profile davet eden 3 saniyelik kart eklenir",

    uploadBgVideoBtn: "🎬 Arka Plana Video (.mp4/.webm) Yükle",
    removeBgVideoBtn: "🗑 Videoyu Kaldır / Resim Moduna Dön",
    bgVideoActive: "🎬 Hareketli video arka plan aktif",
    autoFactoryTitle: "🚀 4 Dilde Oto-Fabrika ve 30 Günlük Plan",
    autoFactoryBtn: "🚀 Oto-Fabrika (4 Dil)",

    paywallB2BBadge: "VIP / 30 GÜNLÜK PLAN",
    paywallB2BTitle: "VIP / B2B Hazır Paket (30 video)",
    paywallB2BDesc: "Eğitim kurumları, öğretmenler ve içerik üreticileri için: vaktiniz yok mu? Logonuz ve konularınızla 1 aylık (30 adet) hazır videoyu 24 saat içinde biz hazırlayalım!",
    paywallB2BPrice: "$29",
    paywallB2BPriceUnit: "30 hazır video",
    paywallB2BBtn: "✈️ Sipariş Ver (Telegram)",
    paywallB2BTelegramMsg: "Merhaba! VIP / B2B Hazır Paket (30 video) siparişi vermek istiyorum. Müşteri ID: ",

    landingHeroBadge: "Yapay Zeka ile 60 Saniyede",
    landingHeroTitle: "1 konu girin — 60 saniyede Instagram Reels, YouTube Shorts ve TikTok için 4 dilde hazır bilgi yarışması videosu alın!",
    landingHeroDesc: "Konuyu yazın — AI soruları oluştursun, profesyonel sesle okusun ve 9:16 veya 16:9 formatında hazır videoyu indirsin. Montaja gerek yok.",
    landingHeroStartFree: "🎁 Şimdi 1 videoyu ÜCRETSİZ oluşturun",
    landingHeroPricingBtn: "Paketler",
    landingWhoTitle: "Kimler için?",
    landingWhoSubtitle: "Öğretmenler, içerik üreticileri ve SMM uzmanları için özel olarak geliştirildi",
    landingAudience1Title: "Öğretmenler ve Eğitim Kurumları",
    landingAudience1Desc: "Sınav, IELTS, tarih, genel kültür ve ders sorularını 1 dakikada takipçi çeken Reels formatına dönüştürün.",
    landingAudience2Title: "YouTube ve TikTok (Yüzsüz) İçerik Üreticileri",
    landingAudience2Desc: "Yüzünüzü göstermeden 4 dilde (UZ, RU, EN, TR) kanal yönetin ve YouTube para kazanma şartlarına hızla ulaşın.",
    landingAudience3Title: "SMM Uzmanları ve İçerik Üreticileri",
    landingAudience3Desc: "Müşterilerinizin hesaplarında yorumları ve etkileşimi (Engagement) 3 katına çıkaran interaktif içerikler üretin.",

    btnPreview: "Önizleme",
    btnExportVideo: "Videoyu İndir",
    btnExporting: "Video Hazırlanıyor...",
    btnCancelExport: "İptal",
  },
};

export function getUIStrings(lang?: string): UIStrings {
  return UI_DICTIONARY[(lang as UILanguage) || "uz"] || UI_DICTIONARY.uz;
}
