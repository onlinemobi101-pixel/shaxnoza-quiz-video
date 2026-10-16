import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Sparkles,
  Play,
  CheckCircle,
  Clock,
  Send,
  FileText,
  Download,
  Upload,
  Trash2,
  Copy,
  Check,
  Loader2,
  Film,
  RefreshCw,
  Video,
  Languages,
  Search,
} from "lucide-react";
import { Quiz, Question } from "../types";
import { generateQuizAI, generate30DayViralTopics } from "../services/ai";
import { generateTTSBatch } from "../services/tts";
import { getVideoStrings } from "../services/i18n";
import { QuizRenderer } from "../services/renderer";
import { generateViralSocialCopy } from "../services/socialCopy";
import {
  sendVideoToTelegramChat,
  sendVideoDirectToTelegram,
  fetchTelegramConfig,
  getLatestTelegramChatId,
  sendTestTelegramMessage,
  telegramHaptic,
} from "../services/telegram";

interface AutoFactoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LanguageWatermarks {
  uz: string;
  ru: string;
  en: string;
  tr: string;
}

interface GeneratedVideoResult {
  lang: "uz" | "ru" | "en" | "tr";
  title: string;
  fileName: string;
  videoBlob: Blob;
  videoUrl: string;
  socialCopy: {
    title: string;
    caption: string;
    hashtags: string;
    pinnedComment: string;
    fullText: string;
  };
  sentToTelegram?: boolean;
}

const DEFAULT_WATERMARKS: LanguageWatermarks = {
  uz: "@QuizArenaUz",
  ru: "@QuizArenaRu",
  en: "@EnglishQuizArena",
  tr: "@QuizArenaTr",
};

export function AutoFactoryModal({ isOpen, onClose }: AutoFactoryModalProps) {
  // 1. Watermark sozlamalari (4 til uchun alohida)
  const [watermarks, setWatermarks] = useState<LanguageWatermarks>(() => {
    try {
      const saved = localStorage.getItem("qz_auto_watermarks");
      return saved ? JSON.parse(saved) : DEFAULT_WATERMARKS;
    } catch {
      return DEFAULT_WATERMARKS;
    }
  });

  const handleWatermarkChange = (lang: keyof LanguageWatermarks, val: string) => {
    const updated = { ...watermarks, [lang]: val };
    setWatermarks(updated);
    localStorage.setItem("qz_auto_watermarks", JSON.stringify(updated));
  };

  // 2. 30 kunlik mavzular ro'yxati va bajarilganlar
  const [topicsRaw, setTopicsRaw] = useState<string>(() => {
    try {
      return localStorage.getItem("qz_30day_topics") || "";
    } catch {
      return "";
    }
  });

  const [completedTopics, setCompletedTopics] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("qz_completed_topics");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const topicsList = topicsRaw
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  const [selectedTopicIndex, setSelectedTopicIndex] = useState<number>(0);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);

  // 3. Orqa fon loop videolari hovuzi (Pool)
  const [bgVideoUrls, setBgVideoUrls] = useState<string[]>([]);
  const bgVideosRef = useRef<string[]>([]);
  bgVideosRef.current = bgVideoUrls;

  const handleBgVideosUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = "";
    if (!files || files.length === 0) return;

    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 150 * 1024 * 1024) {
        alert(`${file.name} hajmi 150MB dan katta.`);
        continue;
      }
      urls.push(URL.createObjectURL(file));
    }

    if (urls.length > 0) {
      setBgVideoUrls((prev) => [...prev, ...urls]);
      telegramHaptic("success");
    }
  };

  const handleClearBgVideos = () => {
    bgVideoUrls.forEach((u) => URL.revokeObjectURL(u));
    setBgVideoUrls([]);
    telegramHaptic("light");
  };

  // 4. Telegram sozlamalari
  const [adminChatId, setAdminChatId] = useState<string>(() => {
    try {
      return localStorage.getItem("qz_admin_telegram_chat_id") || "";
    } catch {
      return "";
    }
  });

  const [autoSendTelegram, setAutoSendTelegram] = useState<boolean>(() => {
    try {
      return localStorage.getItem("qz_auto_send_telegram") === "1";
    } catch {
      return true;
    }
  });

  const [botToken, setBotToken] = useState<string>("");
  const [isFindingId, setIsFindingId] = useState<boolean>(false);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [telegramStatuses, setTelegramStatuses] = useState<
    Record<string, { status: "sending" | "sent" | "error"; error?: string }>
  >({});

  useEffect(() => {
    if (isOpen) {
      fetchTelegramConfig().then((cfg) => {
        if (cfg?.botToken) {
          setBotToken(cfg.botToken);
          if (!adminChatId && cfg.defaultChatId) {
            setAdminChatId(cfg.defaultChatId);
            localStorage.setItem("qz_admin_telegram_chat_id", cfg.defaultChatId);
          }
        }
      });
    }
  }, [isOpen]);

  const handleSaveTelegramSettings = (id: string, auto: boolean) => {
    setAdminChatId(id);
    setAutoSendTelegram(auto);
    localStorage.setItem("qz_admin_telegram_chat_id", id);
    localStorage.setItem("qz_auto_send_telegram", auto ? "1" : "0");
  };

  const handleFindTelegramId = async () => {
    let token = botToken;
    if (!token) {
      const cfg = await fetchTelegramConfig();
      if (cfg?.botToken) {
        token = cfg.botToken;
        setBotToken(token);
      } else {
        alert("Telegram bot token topilmadi yoki admin huquqi yo'q.");
        return;
      }
    }
    setIsFindingId(true);
    try {
      const res = await getLatestTelegramChatId(token);
      if (res.success && res.chatId) {
        handleSaveTelegramSettings(res.chatId, autoSendTelegram);
        telegramHaptic("success");
        const name = res.user?.first_name ? ` (${res.user.first_name})` : "";
        alert(`✅ Chat ID muvaffaqiyatli topildi: ${res.chatId}${name}!`);
      } else {
        telegramHaptic("error");
        alert(res.error || "ID topilmadi. Telegram botingizga /start bosing va qaytadan sinab ko'ring.");
      }
    } catch (err: any) {
      alert("Xatolik: " + (err.message || String(err)));
    } finally {
      setIsFindingId(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!adminChatId.trim()) {
      alert("Iltimos, avval Telegram Chat ID ni kiriting yoki «🔍 Oxirgi ID» tugmasini bosing.");
      return;
    }
    let token = botToken;
    if (!token) {
      const cfg = await fetchTelegramConfig();
      if (cfg?.botToken) {
        token = cfg.botToken;
        setBotToken(token);
      } else {
        alert("Bot token topilmadi.");
        return;
      }
    }
    setIsSendingTest(true);
    try {
      const res = await sendTestTelegramMessage(token, adminChatId.trim());
      if (res.success) {
        telegramHaptic("success");
        alert("✅ Test xabari Telegram botingizga muvaffaqiyatli yuborildi!");
      } else {
        telegramHaptic("error");
        alert("❌ Telegram xatosi: " + (res.error || "Noma'lum"));
      }
    } catch (err: any) {
      alert("Xatolik: " + (err.message || String(err)));
    } finally {
      setIsSendingTest(false);
    }
  };

  // 5. Avto-generatsiya holati
  const [isRunningAutoFactory, setIsRunningAutoFactory] = useState(false);
  const [activeStepText, setActiveStepText] = useState("");
  const [currentLangProgress, setCurrentLangProgress] = useState<string>("");
  const [renderProgress, setRenderProgress] = useState(0);
  const [generatedResults, setGeneratedResults] = useState<GeneratedVideoResult[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [sendingTgIndex, setSendingTgIndex] = useState<number | null>(null);

  // 30 kunlik mavzularni AI orqali generatsiya qilish
  const handleGenerate30DayTopics = async () => {
    setIsGeneratingTopics(true);
    try {
      const topics = await generate30DayViralTopics();
      if (topics && topics.length > 0) {
        const text = topics.join("\n");
        setTopicsRaw(text);
        localStorage.setItem("qz_30day_topics", text);
        telegramHaptic("success");
      } else {
        alert("Mavzular ro'yxatini olib bo'lmadi. Qaytadan urinib ko'ring.");
      }
    } catch (err: any) {
      console.error(err);
      alert("AI mavzular yaratishda xatolik: " + (err.message || String(err)));
    } finally {
      setIsGeneratingTopics(false);
    }
  };

  const handleTopicRawChange = (text: string) => {
    setTopicsRaw(text);
    localStorage.setItem("qz_30day_topics", text);
  };

  const toggleTopicCompleted = (topic: string) => {
    const updated = { ...completedTopics, [topic]: !completedTopics[topic] };
    setCompletedTopics(updated);
    localStorage.setItem("qz_completed_topics", JSON.stringify(updated));
  };

  // 4 tilda video chiqarish
  const handleStartAutoFactory = async () => {
    const selectedTopic = topicsList[selectedTopicIndex];
    if (!selectedTopic) {
      alert("Iltimos, avval ro'yxatdan mavzuni tanlang!");
      return;
    }

    setIsRunningAutoFactory(true);
    setGeneratedResults([]);
    setRenderProgress(0);

    const languages: ("uz" | "ru" | "en" | "tr")[] = ["uz", "ru", "en", "tr"];
    const results: GeneratedVideoResult[] = [];
    const letters = ["A", "B", "C", "D"];

    try {
      for (let langIndex = 0; langIndex < languages.length; langIndex++) {
        const lang = languages[langIndex];
        const langNames = { uz: "O'zbek", ru: "Rus", en: "Ingliz", tr: "Turk" };
        const langFlag = { uz: "🇺🇿", ru: "🇷🇺", en: "🇺🇸", tr: "🇹🇷" };

        setCurrentLangProgress(`${langFlag[lang]} ${langNames[lang]} (${langIndex + 1}/4)`);
        setActiveStepText(`${langNames[lang]} tilida 3 ta savol va qiziqarli izohlar yaratilmoqda...`);

        // a) AI orqali savollar yaratish (3 ta viral savol)
        const newQuestions = await generateQuizAI(selectedTopic, lang, 3);
        if (!newQuestions || newQuestions.length === 0) {
          throw new Error(`${langNames[lang]} tilida savollar yaratilmadi`);
        }

        const vs = getVideoStrings(lang);
        const outroText = vs.outroCtaText;

        // b) TTS diktor ovozlarini generatsiya qilish
        setActiveStepText(`${langNames[lang]} tilidagi diktor ovozlari generatsiya qilinmoqda...`);
        const items = [
          ...newQuestions.flatMap((q) => [
            { text: q.text },
            { text: vs.ttsCorrect(letters[q.correctOptionIndex], q.options[q.correctOptionIndex], q.explanation) },
          ]),
          { text: outroText },
        ];

        const audios = await generateTTSBatch(items, "Kore");
        const withAudio: Question[] = newQuestions.map((q, i) => ({
          ...q,
          audioBase64: audios[2 * i] || undefined,
          correctAudioBase64: audios[2 * i + 1] || undefined,
        }));
        const outroAudio = audios[newQuestions.length * 2] || undefined;

        // c) O'sha tilga mos kanal nomi va navbatdagi loop video fonni tanlash
        const langWatermark = watermarks[lang] || DEFAULT_WATERMARKS[lang];
        const assignedBgVideo = bgVideosRef.current.length > 0
          ? bgVideosRef.current[langIndex % bgVideosRef.current.length]
          : undefined;

        const preparedQuiz: Quiz = {
          title: selectedTopic,
          questions: withAudio,
          language: lang,
          watermark: langWatermark,
          themeColor: "emerald",
          themePreset: "default",
          timerDuration: 5,
          hideLastAnswer: true,
          outroEnabled: true,
          outroAudioBase64: outroAudio,
          backgroundVideoUrl: assignedBgVideo,
          bgmEnabled: true,
          bgmType: "tense",
          bgmVolume: 0.18,
          videoFormat: "vertical",
        };

        // d) QuizRenderer orqali videoni yig'ish (render)
        setActiveStepText(`${langNames[lang]} tilidagi video 30 FPS sifatda yig'ilmoqda...`);
        setRenderProgress(0);

        const renderedVideo = await new Promise<{ url: string; ext: string; blob: Blob }>((resolve, reject) => {
          const renderer = new QuizRenderer(preparedQuiz);
          renderer.onProgress = (p) => setRenderProgress(p);
          renderer.onComplete = (url, ext, blob) => resolve({ url, ext, blob });
          renderer.onError = (err) => reject(err);
          renderer.start().catch(reject);
        });

        // Aniq nom bilan yuklab olish
        const safeTopic = selectedTopic
          .replace(/[^a-zA-Z0-9\u0400-\u04FF]/g, "_")
          .slice(0, 30);
        const fileName = `${String(selectedTopicIndex + 1).padStart(2, "0")}_${lang.toUpperCase()}_${safeTopic}.${renderedVideo.ext}`;

        try {
          const a = document.createElement("a");
          a.href = renderedVideo.url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (downloadErr) {
          console.warn("Auto-download failed:", downloadErr);
        }

        // e) Viral Shorts / Instagram Reels tavsif matnini generatsiya qilish
        const socialData = generateViralSocialCopy(preparedQuiz);
        const commentPrompt =
          lang === "ru"
            ? "👇 Напишите в комментариях, на сколько вопросов вы ответили правильно!"
            : lang === "en"
            ? "👇 Drop your score in the comments! How many did you get right?"
            : lang === "tr"
            ? "👇 Yorumlarda kaç soruya doğru cevap verdiğinizi yazın!"
            : "👇 Izohlarda nechta savolga to'g'ri javob berganingizni yozing!";

        const fullCopyText = `${socialData.titles.engaging}\n\n${commentPrompt}\n\n${socialData.hashtags.join(" ")}`;

        const resultEntry: GeneratedVideoResult = {
          lang,
          title: `${langFlag[lang]} ${selectedTopic}`,
          fileName,
          videoBlob: renderedVideo.blob,
          videoUrl: renderedVideo.url,
          socialCopy: {
            title: socialData.titles.engaging,
            caption: commentPrompt,
            hashtags: socialData.hashtags.join(" "),
            pinnedComment: commentPrompt,
            fullText: fullCopyText,
          },
        };

        // f) Telegram-ga avtomatik yuborish (to'g'ridan-to'g'ri brauzerdan Telegram API ga)
        if (autoSendTelegram && adminChatId.trim()) {
          setActiveStepText(`✈️ ${langNames[lang]} videosi Telegram'ingizga yuborilmoqda...`);
          setTelegramStatuses((prev) => ({ ...prev, [lang]: { status: "sending" } }));

          const tgCaption = `🎬 <b>${resultEntry.title}</b>\n\n${fullCopyText}`;
          let tgRes: { success: boolean; messageId?: number; error?: string } = { success: false };

          let activeToken = botToken;
          if (!activeToken) {
            const cfg = await fetchTelegramConfig();
            if (cfg?.botToken) {
              activeToken = cfg.botToken;
              setBotToken(activeToken);
            }
          }

          if (activeToken) {
            tgRes = await sendVideoDirectToTelegram(
              activeToken,
              adminChatId.trim(),
              renderedVideo.blob,
              fileName,
              tgCaption
            );
          } else {
            tgRes = await sendVideoToTelegramChat(
              renderedVideo.blob,
              fileName,
              tgCaption,
              adminChatId.trim()
            );
          }

          if (tgRes.success) {
            resultEntry.sentToTelegram = true;
            setTelegramStatuses((prev) => ({ ...prev, [lang]: { status: "sent" } }));
          } else {
            setTelegramStatuses((prev) => ({
              ...prev,
              [lang]: { status: "error", error: tgRes.error || "Yuborib bo'lmadi" },
            }));
          }
        }

        results.push(resultEntry);
        setGeneratedResults([...results]);
        telegramHaptic("success");
      }

      // Mavzuni "Bajarildi ✅" deb belgilash
      toggleTopicCompleted(selectedTopic);
      setActiveStepText("🎉 4 ta tildagi barcha videolar muvaffaqiyatli tayyorlandi va yuklandi!");
    } catch (err: any) {
      console.error("Auto factory error:", err);
      alert("Avto-zavod jarayonida xatolik: " + (err.message || String(err)));
    } finally {
      setIsRunningAutoFactory(false);
      setRenderProgress(1);
    }
  };

  const handleCopyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      telegramHaptic("light");
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {}
  };

  const handleDownloadTxt = (result: GeneratedVideoResult) => {
    try {
      const content = `🎬 VIDEO: ${result.fileName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 SARLAVHA (TITLE):
${result.socialCopy.title}

📝 TAVSIF MATNI (DESCRIPTION):
${result.socialCopy.fullText}

💬 QADALADIGAN IZOH (PINNED COMMENT):
${result.socialCopy.pinnedComment}

🏷 XESHTEGLAR (HASHTAGS):
${result.socialCopy.hashtags}
`;
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName.replace(/\.[^.]+$/, ".txt");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  };

  const handleManualSendToTelegram = async (result: GeneratedVideoResult, index: number) => {
    if (!adminChatId.trim()) {
      alert("Iltimos, avval Telegram Chat ID'ingizni kiriting!");
      return;
    }
    setSendingTgIndex(index);
    setTelegramStatuses((prev) => ({ ...prev, [result.lang]: { status: "sending" } }));
    try {
      const caption = `🎬 <b>${result.title}</b>\n\n${result.socialCopy.fullText}`;
      let activeToken = botToken;
      if (!activeToken) {
        const cfg = await fetchTelegramConfig();
        if (cfg?.botToken) {
          activeToken = cfg.botToken;
          setBotToken(activeToken);
        }
      }

      let res: { success: boolean; messageId?: number; error?: string } = { success: false };
      if (activeToken) {
        res = await sendVideoDirectToTelegram(
          activeToken,
          adminChatId.trim(),
          result.videoBlob,
          result.fileName,
          caption
        );
      } else {
        res = await sendVideoToTelegramChat(
          result.videoBlob,
          result.fileName,
          caption,
          adminChatId.trim()
        );
      }

      if (res.success) {
        alert("✅ Video Telegram'ingizga muvaffaqiyatli yuborildi!");
        const updated = [...generatedResults];
        updated[index].sentToTelegram = true;
        setGeneratedResults(updated);
        setTelegramStatuses((prev) => ({ ...prev, [result.lang]: { status: "sent" } }));
      } else {
        alert("❌ Telegram'ga yuborishda xatolik: " + (res.error || "Noma'lum"));
        setTelegramStatuses((prev) => ({
          ...prev,
          [result.lang]: { status: "error", error: res.error || "Yuborib bo'lmadi" },
        }));
      }
    } catch (err: any) {
      alert("Xatolik: " + (err.message || String(err)));
    } finally {
      setSendingTgIndex(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-950 border border-amber-500/30 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl shadow-amber-950/40 overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-indigo-500/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/30">
              🚀
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                4 Tilda Avto-Zavod
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Admin Maxsus
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                1 ta mavzudan birvarakayiga 4 ta tilda (UZ, RU, EN, TR) Shorts/Reels video va tavsiflarini ishlab chiqarish
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* 1. Kanal nomlari (Watermarks) sozlamasi */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Languages size={16} className="text-amber-400" />
              1. 4 ta til uchun shaxsiy kanal nomlari (Watermarks)
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Har bir tildagi video uchun o'sha tilga mos kanal nomini o'rnating. Ular avtomatik saqlanib turadi.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-neutral-300 mb-1 flex items-center gap-1">
                  🇺🇿 O'zbekcha kanal
                </label>
                <input
                  type="text"
                  value={watermarks.uz}
                  onChange={(e) => handleWatermarkChange("uz", e.target.value)}
                  placeholder="@QuizArenaUz"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-neutral-300 mb-1 flex items-center gap-1">
                  🇷🇺 Ruscha kanal
                </label>
                <input
                  type="text"
                  value={watermarks.ru}
                  onChange={(e) => handleWatermarkChange("ru", e.target.value)}
                  placeholder="@QuizArenaRu"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-neutral-300 mb-1 flex items-center gap-1">
                  🇺🇸 Inglizcha kanal
                </label>
                <input
                  type="text"
                  value={watermarks.en}
                  onChange={(e) => handleWatermarkChange("en", e.target.value)}
                  placeholder="@EnglishQuizArena"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-neutral-300 mb-1 flex items-center gap-1">
                  🇹🇷 Turkcha kanal
                </label>
                <input
                  type="text"
                  value={watermarks.tr}
                  onChange={(e) => handleWatermarkChange("tr", e.target.value)}
                  placeholder="@QuizArenaTr"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* 2. Orqa fon loop videolari hovuzi */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Film size={16} className="text-cyan-400" />
                  2. Fon videolari hovuzi (YouTube monetizatsiyasi xavfsizligi)
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Kompyuteringizdan 5–10 ta `.mp4` loop video yuklang. Tizim har bir tilga alohida fon qo'yadi.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="py-2 px-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-md">
                  <Upload size={14} />
                  <span>Videolar tanlash (.mp4)</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    multiple
                    className="hidden"
                    onChange={handleBgVideosUpload}
                  />
                </label>
                {bgVideoUrls.length > 0 && (
                  <button
                    onClick={handleClearBgVideos}
                    className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all"
                    title="Tozalash"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {bgVideoUrls.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-xs font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Video size={13} />
                  {bgVideoUrls.length} ta fon videosi yuklangan ✅ (har bir tilga har xil fon o'rnatiladi)
                </span>
              </div>
            ) : (
              <p className="text-xs text-neutral-500 italic">
                * Fon videolari yuklanmasa, standart yuqori sifatli rasmlardan foydalaniladi.
              </p>
            )}
          </div>

          {/* 3. 30 kunlik mavzular rejasi */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock size={16} className="text-amber-400" />
                  3. 30 kunlik virusli mavzular rejasi ({topicsList.length} ta mavzu)
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Har bir qatorda 1 ta mavzu. Tugmani bosib AI dan tayyor 60 ta trend mavzu oling:
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerate30DayTopics}
                disabled={isGeneratingTopics}
                className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isGeneratingTopics ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>{isGeneratingTopics ? "Tuzilmoqda..." : "✨ AI bilan 60 ta virusli mavzu tuzish"}</span>
              </button>
            </div>

            {/* Topics editor */}
            <textarea
              rows={4}
              value={topicsRaw}
              onChange={(e) => handleTopicRawChange(e.target.value)}
              placeholder="1-qator: Dunyo mo'jizalari va qadimiy sirlar&#10;2-qator: Koinotdagi eng dahshatli qora tuynuklar&#10;3-qator: Ronaldo va Messining unutilmas rekordlari..."
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-amber-500 leading-relaxed"
            />

            {/* Quick Topic Selector List */}
            {topicsList.length > 0 && (
              <div className="pt-2">
                <p className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider mb-2">
                  Chiqarish uchun mavzuni tanlang (Hozirgi: #{selectedTopicIndex + 1}):
                </p>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {topicsList.map((topic, idx) => {
                    const isSelected = selectedTopicIndex === idx;
                    const isDone = completedTopics[topic];

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedTopicIndex(idx)}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isSelected
                            ? "bg-amber-500/20 border-amber-500 text-amber-200 shadow-sm"
                            : isDone
                            ? "bg-black/30 border-emerald-500/20 text-neutral-400 hover:text-white"
                            : "bg-black/30 border-white/5 text-neutral-300 hover:text-white hover:border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-[10px] text-neutral-500 w-5">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold truncate">{topic}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTopicCompleted(topic);
                            }}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                              isDone
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : "bg-white/5 text-neutral-400 border-white/10 hover:text-white"
                            }`}
                          >
                            {isDone ? "Bajarildi ✅" : "Bajarilmadi ⏳"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4. Telegram integratsiyasi */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Send size={16} className="text-[#229ED9]" />
                4. Telegram'ga avtomatik yuborish (Kompyuterdan telefonga 1 soniyada)
              </h3>
              {botToken && (
                <span className="text-[10px] bg-[#229ED9]/20 text-[#229ED9] border border-[#229ED9]/40 px-2 py-0.5 rounded-full font-bold">
                  Bot ulangan ✅
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-neutral-300 block">
                  Admin Telegram Chat ID (yoki @user_id)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={adminChatId}
                    onChange={(e) => handleSaveTelegramSettings(e.target.value, autoSendTelegram)}
                    placeholder="Masalan: 123456789"
                    className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-[#229ED9]"
                  />
                  <button
                    type="button"
                    onClick={handleFindTelegramId}
                    disabled={isFindingId}
                    className="px-2.5 sm:px-3 py-2 rounded-xl bg-[#229ED9]/20 hover:bg-[#229ED9]/30 border border-[#229ED9]/40 text-[#229ED9] text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                    title="Botga yozgan oxirgi chat ID ni avtomatik topish"
                  >
                    {isFindingId ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                    <span>🔍 Oxirgi ID</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSendTestMessage}
                    disabled={isSendingTest || !adminChatId.trim()}
                    className="px-2.5 sm:px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                    title="Telegramga test xabar yuborish"
                  >
                    {isSendingTest ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    <span>✈️ Test</span>
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400">
                  * Chat ID ni bilmasangiz, Telegramda botingizga <code className="text-[#229ED9]">/start</code> yozing va «🔍 Oxirgi ID» tugmasini bosing.
                </p>
              </div>

              <label className="flex items-center gap-2.5 p-3.5 rounded-xl border border-white/10 bg-white/5 cursor-pointer sm:mt-5 hover:bg-white/10 transition-colors">
                <input
                  type="checkbox"
                  checked={autoSendTelegram}
                  onChange={(e) => handleSaveTelegramSettings(adminChatId, e.target.checked)}
                  className="w-4 h-4 rounded text-[#229ED9] focus:ring-0 shrink-0"
                />
                <span className="text-xs font-semibold text-white">
                  Har bir tayyor videoni tavsifi bilan avtomat Telegram'imga yuborish
                </span>
              </label>
            </div>
          </div>

          {/* Boshlash tugmasi va Progress */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-emerald-500/10 border border-amber-500/30 text-center space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-left">
                <p className="text-xs text-amber-300/80 font-bold uppercase tracking-wider">
                  Tanlangan Mavzu:
                </p>
                <h4 className="text-lg font-black text-white">
                  {topicsList[selectedTopicIndex] || "Hech qanday mavzu tanlanmagan"}
                </h4>
              </div>

              <button
                type="button"
                onClick={handleStartAutoFactory}
                disabled={isRunningAutoFactory || !topicsList[selectedTopicIndex]}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-sm transition-all shadow-xl shadow-amber-950/40 disabled:opacity-50 flex items-center justify-center gap-2.5 cursor-pointer active:scale-95"
              >
                {isRunningAutoFactory ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                <span>
                  {isRunningAutoFactory ? "Avto-Zavod ishlamoqda..." : "▶️ 4 Tilda Avto-Generatsiya (1 Bosishda)"}
                </span>
              </button>
            </div>

            {isRunningAutoFactory && (
              <div className="pt-3 border-t border-white/10 space-y-2 text-left">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-amber-300">{currentLangProgress}</span>
                  <span className="text-neutral-400 font-mono">{Math.round(renderProgress * 100)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-black/50 overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${renderProgress * 100}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-300 animate-pulse font-medium">
                  {activeStepText}
                </p>
              </div>
            )}
          </div>

          {/* 5. Tayyor bo'lgan natijalar (4 tilda) */}
          {generatedResults.length > 0 && (
            <div className="space-y-4 pt-2">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <CheckCircle size={18} className="text-emerald-400" />
                Tayyor bo'lgan videolar va ijtimoiy tarmoq tavsiflari ({generatedResults.length}/4)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generatedResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-white truncate">
                        {result.title}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {telegramStatuses[result.lang]?.status === "sending" && (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse">
                            <Loader2 size={10} className="animate-spin" /> ✈️ Telegramga yuborilmoqda...
                          </span>
                        )}
                        {telegramStatuses[result.lang]?.status === "sent" && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                            ✅ Telegramga yuborildi!
                          </span>
                        )}
                        {telegramStatuses[result.lang]?.status === "error" && (
                          <span
                            className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full font-bold"
                            title={telegramStatuses[result.lang]?.error}
                          >
                            ❌ Telegram xatosi
                          </span>
                        )}
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                          Tayyor ✅
                        </span>
                      </div>
                    </div>

                    {/* Video Player */}
                    <div className="w-full aspect-video rounded-xl overflow-hidden bg-black/60 border border-white/10">
                      <video
                        src={result.videoUrl}
                        controls
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="text-xs text-neutral-300 space-y-1">
                      <p className="font-bold text-white text-[11px] truncate">
                        {result.socialCopy.title}
                      </p>
                      <p className="text-neutral-400 text-[10px] line-clamp-2">
                        {result.socialCopy.hashtags}
                      </p>
                    </div>

                    {/* Tugmalar */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopyText(result.socialCopy.fullText, `res-${idx}`)}
                        className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-1 transition-all"
                      >
                        {copiedKey === `res-${idx}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span className="text-[10px]">{copiedKey === `res-${idx}` ? "Nusxalandi" : "Nusxalash"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadTxt(result)}
                        className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-1 transition-all"
                      >
                        <FileText size={12} />
                        <span className="text-[10px]">.txt saqlash</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleManualSendToTelegram(result, idx)}
                        disabled={sendingTgIndex === idx}
                        className="py-2 px-2.5 rounded-xl bg-[#229ED9]/20 hover:bg-[#229ED9]/30 border border-[#229ED9]/40 text-[#229ED9] text-xs font-bold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                      >
                        {sendingTgIndex === idx ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Send size={12} />
                        )}
                        <span className="text-[10px]">
                          {result.sentToTelegram ? "Yuborildi ✈️" : "Telegram"}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-white/10 bg-white/5 flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            Avto-Zavod: Shorts va Reels formatida 4 ta tilda to'liq avtomatlashtirilgan video generator
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Yopish
          </button>
        </div>

      </div>
    </div>
  );
}
