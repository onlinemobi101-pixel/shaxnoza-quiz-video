import { useState, useMemo } from "react";
import { Copy, Check, Hash, Sparkles, Flame, Target, Zap } from "lucide-react";
import { Quiz } from "../types";
import { generateViralSocialCopy } from "../services/socialCopy";
import { telegramHaptic } from "../services/telegram";

interface SocialCopyCardProps {
  quiz: Quiz;
  compact?: boolean;
}

export function SocialCopyCard({ quiz, compact = false }: SocialCopyCardProps) {
  const [selectedStyle, setSelectedStyle] = useState<"challenge" | "engaging" | "short">("engaging");
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const lang = quiz.language || "uz";
  const socialData = useMemo(() => generateViralSocialCopy(quiz), [quiz]);

  const activeTitle = socialData.titles[selectedStyle];
  const hashtagsString = socialData.hashtags.join(" ");
  const commentPrompt =
    lang === "ru"
      ? "👇 Напишите в комментариях, на сколько вопросов вы ответили правильно!"
      : lang === "en"
      ? "👇 Drop your score in the comments! How many did you get right?"
      : lang === "tr"
      ? "👇 Yorumlarda kaç soruya doğru cevap verdiğinizi yazın!"
      : "👇 Izohlarda nechta savolga to'g'ri javob berganingizni yozing!";

  const fullTextToCopy = `${activeTitle}\n\n${commentPrompt}\n\n${hashtagsString}`;

  const handleCopy = async (text: string, sectionKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionKey);
      telegramHaptic("success");
      setTimeout(() => setCopiedSection(null), 2500);
    } catch {
      // Fallback
    }
  };

  const copyLabel =
    lang === "ru" ? "Скопировать всё" : lang === "en" ? "Copy All" : lang === "tr" ? "Hepsini Kopyala" : "Hammasini nusxalash";
  const copiedLabel =
    lang === "ru" ? "Скопировано!" : lang === "en" ? "Copied!" : lang === "tr" ? "Kopyalandı!" : "Nusxalandi!";
  const cardTitle =
    lang === "ru"
      ? "Описание для YouTube, TikTok & Reels"
      : lang === "en"
      ? "Description for YouTube, TikTok & Reels"
      : lang === "tr"
      ? "YouTube, TikTok & Reels için Açıklama"
      : "YouTube, TikTok & Reels uchun tavsif";
  const cardSub =
    lang === "ru"
      ? "Вирусный заголовок и трендовые теги от ИИ"
      : lang === "en"
      ? "AI generated viral title and trending hashtags"
      : lang === "tr"
      ? "Yapay zeka viral başlık ve trend etiketler"
      : "AI tomonidan tuzilgan viral sarlavha va trend hashtaglar";

  return (
    <div className={`rounded-2xl border border-indigo-500/20 bg-indigo-500/5 text-left font-sans ${compact ? "p-3.5" : "p-4.5"}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">
            <Sparkles size={14} />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide">
              {cardTitle}
            </h4>
            <p className="text-[10px] text-slate-400">{cardSub}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleCopy(fullTextToCopy, "full")}
          className="flex items-center gap-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
        >
          {copiedSection === "full" ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          {copiedSection === "full" ? copiedLabel : copyLabel}
        </button>
      </div>

      {/* Style Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-white/5 mb-3 text-[11px]">
        <button
          type="button"
          onClick={() => {
            telegramHaptic("light");
            setSelectedStyle("engaging");
          }}
          className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer ${
            selectedStyle === "engaging" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Target size={12} />
          <span>{lang === "ru" ? "Интересный" : lang === "en" ? "Engaging" : lang === "tr" ? "İlgi Çekici" : "Qiziqarli"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            telegramHaptic("light");
            setSelectedStyle("challenge");
          }}
          className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer ${
            selectedStyle === "challenge" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Flame size={12} />
          <span>{lang === "ru" ? "Челлендж" : lang === "en" ? "Challenge" : lang === "tr" ? "Meydan Okuma" : "Chaqiruv"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            telegramHaptic("light");
            setSelectedStyle("short");
          }}
          className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer ${
            selectedStyle === "short" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Zap size={12} />
          <span>{lang === "ru" ? "Краткий" : lang === "en" ? "Short" : lang === "tr" ? "Kısa" : "Qisqa"}</span>
        </button>
      </div>

      {/* Title Box */}
      <div className="mb-2.5 bg-slate-950/80 border border-white/5 rounded-xl p-2.5 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-200 font-medium leading-snug break-words flex-1">
          {activeTitle}
        </p>
        <button
          type="button"
          onClick={() => handleCopy(activeTitle, "title")}
          title="Sarlavhani nusxalash"
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
        >
          {copiedSection === "title" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
      </div>

      {/* Hashtags Box */}
      <div className="bg-slate-950/80 border border-white/5 rounded-xl p-2.5 flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 flex-1">
          <Hash size={13} className="text-indigo-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-indigo-300/90 font-mono leading-relaxed break-words">
            {hashtagsString}
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleCopy(hashtagsString, "tags")}
          title="Hashtaglarni nusxalash"
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
        >
          {copiedSection === "tags" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}
