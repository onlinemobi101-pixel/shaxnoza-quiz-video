import { motion } from "motion/react";
import {
  Sparkles,
  Volume2,
  Clapperboard,
  ArrowRight,
  CheckCircle2,
  Crown,
  ShoppingBag,
  Wand2,
  ListChecks,
  Download,
  GraduationCap,
  Coins,
  TrendingUp,
  Briefcase,
  Send,
} from "lucide-react";
import { getUIStrings, UILanguage } from "../services/i18n";
import { safeGetItem } from "../services/storage";

interface LandingProps {
  onStart: () => void;
  onShowPricing: () => void;
  uiLang?: UILanguage;
}

export function Landing({ onStart, onShowPricing, uiLang }: LandingProps) {
  const lang: UILanguage = uiLang || (safeGetItem("qv_ui_lang") as UILanguage) || "uz";
  const ui = getUIStrings(lang);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 md:py-20">
      {/* HERO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-5">
            <Sparkles size={12} />
            {ui.landingHeroBadge}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-black tracking-tight leading-[1.15] mb-5">
            <span className="bg-clip-text text-transparent bg-gradient-to-br from-emerald-400 via-emerald-200 to-cyan-400">
              {ui.landingHeroTitle}
            </span>
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-8 max-w-lg">
            {ui.landingHeroDesc}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onStart}
              className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 hover:scale-[1.03] active:scale-[0.98] text-slate-950 px-7 py-4 rounded-2xl font-display font-black text-sm sm:text-base transition-all shadow-xl shadow-emerald-500/25 border border-white/20 cursor-pointer"
            >
              <span>{ui.landingHeroStartFree}</span>
              <ArrowRight size={19} />
            </button>
            <a
              href="https://t.me/QuizVideoAIBot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-[#229ED9]/15 hover:bg-[#229ED9]/25 border border-[#229ED9]/35 text-[#229ED9] hover:scale-[1.02] active:scale-[0.98] px-6 py-4 rounded-2xl font-bold text-base transition-all cursor-pointer shadow-lg shadow-[#229ED9]/10"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              Telegram Bot
            </a>
            <button
              onClick={onShowPricing}
              className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-4 rounded-2xl font-semibold text-base transition-all cursor-pointer"
            >
              {ui.landingHeroPricingBtn}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Brauzerda yoki to'g'ridan-to'g'ri Telegram botimizda (@QuizVideoAIBot) bepul sinab ko'ring
          </p>
        </motion.div>

        {/* Telefon mockup */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex justify-center lg:justify-end"
        >
          <div className="relative w-[270px] sm:w-[300px] aspect-[9/17] rounded-[36px] border-[6px] border-slate-800 bg-slate-950 shadow-[0_25px_80px_rgba(16,185,129,0.15)] overflow-hidden">
            {/* Fon */}
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-slate-900 to-emerald-950" />
            <div className="absolute -top-20 -right-20 w-56 h-56 bg-emerald-500/20 blur-3xl rounded-full" />
            <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-cyan-500/20 blur-3xl rounded-full" />

            {/* Kontent */}
            <div className="relative h-full flex flex-col justify-center px-5 gap-3">
              {/* Taymer chizig'i */}
              <div className="absolute top-8 left-5 right-5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
                  animate={{ width: ["100%", "12%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />
              </div>

              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 mb-1">
                <p className="text-white font-display font-bold text-[15px] leading-snug text-center">
                  Amir Temur davlatiga qaysi yilda asos solingan?
                </p>
              </div>

              {["1360-yil", "1370-yil", "1380-yil"].map((opt, i) => (
                <motion.div
                  key={opt}
                  animate={
                    i === 1
                      ? { scale: [1, 1, 1.04, 1], borderColor: ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.1)", "rgba(52,211,153,0.9)", "rgba(52,211,153,0.9)"] }
                      : {}
                  }
                  transition={{ duration: 4, repeat: Infinity, times: [0, 0.6, 0.75, 1] }}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold border backdrop-blur-md text-center ${
                    i === 1
                      ? "bg-emerald-500/20 text-emerald-200 border-white/10"
                      : "bg-black/30 text-slate-200 border-white/10"
                  }`}
                >
                  {opt}
                </motion.div>
              ))}

              <p className="absolute bottom-6 left-0 right-0 text-center text-[10px] text-white/30 font-bold tracking-widest">
                @QuizVideo
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* KIMLAR UCHUN? */}
      <div className="mb-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-3">
            <Sparkles size={12} />
            {ui.landingWhoTitle}
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-white mb-3">
            {ui.landingWhoTitle}
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            {ui.landingWhoSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Repetitorlar va O'quv markazlari */}
          <div className="relative p-6 sm:p-7 rounded-3xl bg-slate-900/40 border border-emerald-500/20 hover:border-emerald-500/40 transition-all hover:scale-[1.02] flex flex-col justify-between group shadow-lg">
            <div className="mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                <GraduationCap size={26} />
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider mb-2 inline-block">
                🎓 Ta'lim & Testlar
              </span>
              <h3 className="font-display font-bold text-lg text-white mb-2">
                {ui.landingAudience1Title}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {ui.landingAudience1Desc}
              </p>
            </div>
            <div className="pt-4 border-t border-slate-800/80 flex items-center text-xs font-bold text-emerald-400">
              <span>+300% Obunachilar jalb qilish</span>
            </div>
          </div>

          {/* Card 2: YouTube va TikTok Faceless */}
          <div className="relative p-6 sm:p-7 rounded-3xl bg-slate-900/40 border border-cyan-500/20 hover:border-cyan-500/40 transition-all hover:scale-[1.02] flex flex-col justify-between group shadow-lg">
            <div className="mb-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
                <Coins size={26} />
              </div>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider mb-2 inline-block">
                💰 Faceless Kanallar
              </span>
              <h3 className="font-display font-bold text-lg text-white mb-2">
                {ui.landingAudience2Title}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {ui.landingAudience2Desc}
              </p>
            </div>
            <div className="pt-4 border-t border-slate-800/80 flex items-center text-xs font-bold text-cyan-400">
              <span>4 Tilda YouTube Monetizatsiyasi</span>
            </div>
          </div>

          {/* Card 3: SMM va Blogerlar */}
          <div className="relative p-6 sm:p-7 rounded-3xl bg-slate-900/40 border border-fuchsia-500/20 hover:border-fuchsia-500/40 transition-all hover:scale-[1.02] flex flex-col justify-between group shadow-lg">
            <div className="mb-4">
              <div className="w-12 h-12 rounded-2xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp size={26} />
              </div>
              <span className="text-[10px] bg-fuchsia-500/20 text-fuchsia-300 px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider mb-2 inline-block">
                📱 3x Engagement
              </span>
              <h3 className="font-display font-bold text-lg text-white mb-2">
                {ui.landingAudience3Title}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {ui.landingAudience3Desc}
              </p>
            </div>
            <div className="pt-4 border-t border-slate-800/80 flex items-center text-xs font-bold text-fuchsia-400">
              <span>Izohlar va saqlashlar sonini oshirish</span>
            </div>
          </div>
        </div>
      </div>

      {/* QANDAY ISHLAYDI */}
      <div className="mb-24">
        <h2 className="text-2xl sm:text-3xl font-display font-black text-center mb-3">
          Qanday ishlaydi?
        </h2>
        <p className="text-slate-400 text-sm text-center mb-10">
          Uch qadam — studiya, mikrofon va montaj dasturisiz
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: <Wand2 size={22} />,
              step: "1",
              title: "Mavzuni yozing",
              text: "\"English\", \"Business\", \"Science\"... AI 5–30 ta savolni variantlari, izohlari va mos fon rasmlari bilan tuzib beradi.",
              iconClass: "bg-indigo-500/15 text-indigo-300 border-indigo-500/20",
            },
            {
              icon: <ListChecks size={22} />,
              step: "2",
              title: "Tekshiring va ovoz qo'shing",
              text: "Savollarni tahrirlang, AI suxandon ovozini tanlang yoki o'z ovozingizni yozib qo'ying.",
              iconClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
            },
            {
              icon: <Download size={22} />,
              step: "3",
              title: "Videoni yuklab oling",
              text: "1920×1080 YouTube Long yoki 1080×1920 Shorts video tayyor — platformaga to'g'ridan-to'g'ri joylang.",
              iconClass: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 hover:bg-white/[0.07] hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl border ${item.iconClass}`}>
                  {item.icon}
                </div>
                <span className="text-xs font-black text-slate-500 font-display">QADAM {item.step}</span>
              </div>
              <h3 className="font-display font-bold text-lg mb-2">{item.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* IMKONIYATLAR */}
      <div className="mb-24">
        <h2 className="text-2xl sm:text-3xl font-display font-black text-center mb-10">
          Nima uchun aynan shu asbob?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: <Sparkles size={20} />, title: "AI savol generatori", text: "4 tilda (o'zbek, ingliz, rus, turk) savollar bir necha soniyada" },
            { icon: <Volume2 size={20} />, title: "AI suxandon ovozi", text: "5 xil professional ovoz — matnni tabiiy o'qib beradi" },
            { icon: <Clapperboard size={20} />, title: "Ikki tayyor video format", text: "1920×1080 va 1080×1920, taymer, izohlar, effektlar va fon musiqasi" },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 shrink-0">
                {f.icon}
              </div>
              <div>
                <h3 className="font-bold text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* NARXLAR */}
      <div className="mb-20">
        <h2 className="text-2xl sm:text-3xl font-display font-black text-center mb-3">
          {ui.landingHeroPricingBtn}
        </h2>
        <p className="text-slate-400 text-sm text-center mb-10">
          Sinash bepul — o'zingizga yoki biznesingizga mos tarifni tanlang
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {/* Bepul */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col justify-between">
            <div>
              <h3 className="font-display font-bold text-base mb-1">Bepul</h3>
              <p className="text-2xl font-black font-display mb-3">0 <span className="text-xs font-semibold text-slate-400">so'm</span></p>
              <ul className="space-y-2 text-xs text-slate-300 mb-6">
                <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />1 ta to'liq video</li>
                <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />AI savollar va ovoz</li>
                <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-slate-600 mt-0.5 shrink-0" /><span className="text-slate-500">Suv belgisi bilan</span></li>
              </ul>
            </div>
            <button
              onClick={onStart}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs transition-all cursor-pointer"
            >
              Boshlash
            </button>
          </div>

          {/* Paket */}
          <div className="bg-white/5 border border-cyan-500/30 rounded-3xl p-5 flex flex-col justify-between relative">
            <span className="absolute -top-2.5 left-5 bg-cyan-500 text-slate-950 text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">Ommabop</span>
            <div>
              <h3 className="font-display font-bold text-base mb-1 flex items-center gap-1.5"><ShoppingBag size={15} className="text-cyan-400" />Paket</h3>
              <p className="text-2xl font-black font-display mb-3 text-cyan-400">{lang === "uz" ? "20,000" : "$3"} <span className="text-xs font-semibold text-slate-400">{lang === "uz" ? "so'm" : ""}</span></p>
              <ul className="space-y-2 text-xs text-slate-300 mb-6">
                <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-cyan-400 mt-0.5 shrink-0" />10 ta to'liq video</li>
                <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-cyan-400 mt-0.5 shrink-0" />Barcha AI imkoniyatlar</li>
                <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-cyan-400 mt-0.5 shrink-0" />Muddatsiz amal qiladi</li>
              </ul>
            </div>
            <button
              onClick={onShowPricing}
              className="w-full py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold text-xs transition-all cursor-pointer"
            >
              Sotib olish
            </button>
          </div>

          {/* Premium */}
          <div className="bg-gradient-to-b from-fuchsia-500/10 to-transparent border border-fuchsia-500/30 rounded-3xl p-5 flex flex-col justify-between">
            <div>
              <h3 className="font-display font-bold text-base mb-1 flex items-center gap-1.5"><Crown size={15} className="text-fuchsia-400 fill-current" />Premium</h3>
              <p className="text-2xl font-black font-display mb-3 text-fuchsia-400">{lang === "uz" ? "99,000" : "$9"} <span className="text-xs font-semibold text-slate-400">{lang === "uz" ? "so'm/oy" : "/mo"}</span></p>
              <ul className="space-y-2 text-xs text-slate-300 mb-6">
                <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-fuchsia-400 mt-0.5 shrink-0" />Oyiga 100 ta video</li>
                <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-fuchsia-400 mt-0.5 shrink-0" />Suv belgisiz eksport</li>
                <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-fuchsia-400 mt-0.5 shrink-0" />Premium ovozlar va mavzular</li>
              </ul>
            </div>
            <button
              onClick={onShowPricing}
              className="w-full py-2.5 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-md"
            >
              Premium olish
            </button>
          </div>

          {/* VIP / B2B */}
          <div className="bg-gradient-to-b from-amber-500/15 via-orange-500/5 to-transparent border border-amber-500/40 rounded-3xl p-5 flex flex-col justify-between relative shadow-xl shadow-amber-950/20">
            <span className="absolute -top-2.5 left-5 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
              {ui.paywallB2BBadge}
            </span>
            <div>
              <h3 className="font-display font-bold text-base mb-1 flex items-center gap-1.5 text-amber-300">
                <Briefcase size={15} className="text-amber-400" />
                {ui.paywallB2BTitle}
              </h3>
              <p className="text-2xl font-black font-display text-amber-400">
                {ui.paywallB2BPrice}
              </p>
              <p className="text-[11px] text-amber-300/80 mb-3">{ui.paywallB2BPriceUnit}</p>
              <p className="text-[11px] text-slate-300 mb-5 leading-relaxed">
                {ui.paywallB2BDesc}
              </p>
            </div>
            <button
              onClick={() => {
                const b2bMsg = `${ui.paywallB2BTelegramMsg}LANDING_DIRECT`;
                window.open(`https://t.me/Akramjon1984?text=${encodeURIComponent(b2bMsg)}`, "_blank");
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Send size={13} />
              {ui.paywallB2BBtn}
            </button>
          </div>
        </div>
      </div>

      {/* PASTKI CTA */}
      <div className="text-center pb-8">
        <button
          onClick={onStart}
          className="inline-flex items-center gap-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 hover:scale-[1.03] active:scale-[0.98] text-slate-950 px-9 py-4 rounded-2xl font-display font-black text-sm sm:text-base transition-all shadow-xl shadow-emerald-500/25 border border-white/20 cursor-pointer"
        >
          <span>{ui.landingHeroStartFree}</span>
          <ArrowRight size={19} />
        </button>
      </div>
    </div>
  );
}
