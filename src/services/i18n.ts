// Video ichida KO'RINADIGAN va ESHITILADIGAN matnlar hamda butun Sayt UI i18n tili.
import { Quiz } from "../types";

export type QuizLanguage = NonNullable<Quiz["language"]>;
export type UILanguage = "uz" | "ru" | "en" | "tr";

export interface VideoStrings {
  questionBadge: string; // "SAVOL" (badge: SAVOL 1/5)
  thinking: string; // taymer yorlig'i
  correctAnswer: string; // javob ochilgandagi yorliq
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
  horizontalYoutube: string;
  timerDurationLabel: string;
  timerStyleLabel: string;
  transitionEffectLabel: string;
  themesLabel: string;
  bgmLabel: string;
  bgmStyleLabel: string;
  bgmVolumeLabel: string;
  customBgmUpload: string;
  watermarkLabel: string;
  bgmRecommendTip: string;

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
    verticalShorts: "Shorts / Reels (9:16)",
    horizontalYoutube: "YouTube Long (16:9)",
    timerDurationLabel: "O'ylash vaqti (Taymer)",
    timerStyleLabel: "Taymer uslubi",
    transitionEffectLabel: "Kadrlar almashishi",
    themesLabel: "Video Shablonlari (Uslub)",
    bgmLabel: "Fon musiqasini yoqish (BGM)",
    bgmStyleLabel: "Musiqa uslubi (BGM Style)",
    bgmVolumeLabel: "Musiqa ovozi balandligi (Volume)",
    customBgmUpload: "O'z MP3 musiqangizni yuklash",
    watermarkLabel: "Watermark (@username)",
    bgmRecommendTip: "* AI suxandon ovozi aniq eshitilishi uchun 15% - 30% oralig'i eng maqbul hisoblanadi.",

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
    verticalShorts: "Shorts / Reels (9:16)",
    horizontalYoutube: "YouTube Long (16:9)",
    timerDurationLabel: "Время на размышление (Таймер)",
    timerStyleLabel: "Стиль таймера",
    transitionEffectLabel: "Эффект перехода",
    themesLabel: "Шаблоны видео (Темы)",
    bgmLabel: "Включить фоновую музыку (BGM)",
    bgmStyleLabel: "Стиль музыки (BGM)",
    bgmVolumeLabel: "Громкость музыки (Volume)",
    customBgmUpload: "Загрузить свой MP3 трек",
    watermarkLabel: "Водяной знак (@username)",
    bgmRecommendTip: "* Для четкой слышимости диктора рекомендуется громкость 15% - 30%.",

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
    verticalShorts: "Shorts / Reels (9:16)",
    horizontalYoutube: "YouTube Long (16:9)",
    timerDurationLabel: "Thinking Time (Timer)",
    timerStyleLabel: "Timer Style",
    transitionEffectLabel: "Slide Transition",
    themesLabel: "Visual Themes (Presets)",
    bgmLabel: "Enable Background Music (BGM)",
    bgmStyleLabel: "BGM Music Style",
    bgmVolumeLabel: "Music Volume",
    customBgmUpload: "Upload Custom MP3 Audio",
    watermarkLabel: "Watermark (@username)",
    bgmRecommendTip: "* 15% - 30% volume is recommended for crystal-clear narrator voice.",

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
    verticalShorts: "Shorts / Reels (9:16)",
    horizontalYoutube: "YouTube Tam Video (16:9)",
    timerDurationLabel: "Düşünme Süresi (Zamanlayıcı)",
    timerStyleLabel: "Zamanlayıcı Stili",
    transitionEffectLabel: "Geçiş Efekti",
    themesLabel: "Video Şablonları (Temalar)",
    bgmLabel: "Arka Plan Müziğini Aç (BGM)",
    bgmStyleLabel: "Müzik Tarzı (BGM)",
    bgmVolumeLabel: "Müzik Ses Seviyesi",
    customBgmUpload: "Kendi MP3 Müziğinizi Yükleyin",
    watermarkLabel: "Filigran (@username)",
    bgmRecommendTip: "* Spiker sesinin net duyulması için %15 - %30 aralığı önerilir.",

    btnPreview: "Önizleme",
    btnExportVideo: "Videoyu İndir",
    btnExporting: "Video Hazırlanıyor...",
    btnCancelExport: "İptal",
  },
};

export function getUIStrings(lang?: string): UIStrings {
  return UI_DICTIONARY[(lang as UILanguage) || "uz"] || UI_DICTIONARY.uz;
}
