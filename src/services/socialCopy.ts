import { Quiz } from "../types";

export interface SocialCopyResult {
  titles: {
    challenge: string;
    engaging: string;
    short: string;
  };
  hashtags: string[];
  fullCaption: string;
}

export function generateViralSocialCopy(quiz: Quiz): SocialCopyResult {
  const title = (quiz.title || "Qiziqarli Quiz").trim();
  const count = quiz.questions?.length || 5;
  const lang = quiz.language || "uz";
  const lowerTitle = title.toLowerCase();

  // Topic specific tags
  const topicTags: string[] = [];
  if (lowerTitle.includes("geograf") || lowerTitle.includes("davlat") || lowerTitle.includes("poytaxt") || lowerTitle.includes("xarita")) {
    topicTags.push("geografiya", "davlatlar", "poytaxtlar", "dunyo", "xarita");
  } else if (lowerTitle.includes("tarix") || lowerTitle.includes("ajdod") || lowerTitle.includes("shaxs") || lowerTitle.includes("sulton")) {
    topicTags.push("tarix", "buyuklar", "jahontarixi", "allomalar", "otmish");
  } else if (lowerTitle.includes("kosmos") || lowerTitle.includes("koinot") || lowerTitle.includes("sayyora") || lowerTitle.includes("mars")) {
    topicTags.push("kosmos", "koinot", "astronomiya", "sayyoralar", "fazoviy");
  } else if (lowerTitle.includes("sport") || lowerTitle.includes("futbol") || lowerTitle.includes("messi") || lowerTitle.includes("ronaldo")) {
    topicTags.push("sport", "futbol", "chempion", "futboltv", "match");
  } else if (lowerTitle.includes("mantiq") || lowerTitle.includes("topishmoq") || lowerTitle.includes("zukk")) {
    topicTags.push("mantiq", "topishmoqlar", "zakovat", "zukkolik", "intellekt");
  } else if (lowerTitle.includes("kino") || lowerTitle.includes("film") || lowerTitle.includes("aktyor")) {
    topicTags.push("kino", "filmlar", "kinolar", "serial", "premyera");
  } else if (lowerTitle.includes("avto") || lowerTitle.includes("mashina") || lowerTitle.includes("tezlik")) {
    topicTags.push("avtomobil", "mashinalar", "avto", "inomarka", "tuning");
  } else if (lowerTitle.includes("hayvon") || lowerTitle.includes("tabiat") || lowerTitle.includes("zoolog")) {
    topicTags.push("hayvonot", "tabiat", "jonivorlar", "faktlar", "mojiza");
  }

  let titles = {
    challenge: `99% odam bu savollarga javob topolmaydi! 🧠 ${title} testi`,
    engaging: `${title} haqida eng qiziqarli ${count} ta test! 🌍 Qanchasini topasiz?`,
    short: `${title} bo'yicha bilimingizni sinab ko'ring! 🎬 #shorts #quiz`,
  };

  let baseTags: string[] = ["shorts", "quiz", "savoljavob", "bilim", "faktlar", "intellekt", "tiktok", "reels", "uzbekistan", "uzb", "trend"];

  if (lang === "ru") {
    titles = {
      challenge: `99% людей не ответят на эти вопросы! 🧠 Тест: ${title}`,
      engaging: `Самые интересные ${count} вопросов про ${title}! 🌍 Сколько угадаешь?`,
      short: `Проверь свои знания: ${title}! 🎬 #shorts #викторина`,
    };
    baseTags = ["shorts", "викторина", "тест", "факты", "знания", "интеллект", "тикток", "рилс", "топ", "тренды"];
  } else if (lang === "en") {
    titles = {
      challenge: `99% of people fail this test! 🧠 ${title} Quiz`,
      engaging: `Top ${count} interesting questions about ${title}! 🌍 How many can you get?`,
      short: `Test your knowledge: ${title}! 🎬 #shorts #quiz #trivia`,
    };
    baseTags = ["shorts", "quiz", "trivia", "knowledge", "facts", "braintest", "tiktok", "reels", "viral", "trending"];
  } else if (lang === "tr") {
    titles = {
      challenge: `İnsanların %99'u bu soruları bilemiyor! 🧠 ${title} Testi`,
      engaging: `${title} hakkında en ilginç ${count} soru! 🌍 Kaç tanesini bildin?`,
      short: `Bilgini test et: ${title}! 🎬 #shorts #bilgi #test`,
    };
    baseTags = ["shorts", "bilgi", "test", "genelkültür", "sorucevap", "tiktok", "reels", "turkiye", "trend"];
  }

  const allTags = Array.from(new Set([...baseTags, ...topicTags])).map(t => `#${t.replace(/\s+/g, "")}`);

  const fullCaption = `${titles.engaging}\n\n👇 Izohlarda nechta savolga to'g'ri javob berganingizni yozib qoldiring!\n\n${allTags.join(" ")}`;

  return {
    titles,
    hashtags: allTags,
    fullCaption,
  };
}
