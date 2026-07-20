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
} from "lucide-react";

interface LandingProps {
  onStart: () => void;
  onShowPricing: () => void;
}

export function Landing({ onStart, onShowPricing }: LandingProps) {
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
            AI bilan 2 daqiqada
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-black tracking-tight leading-[1.05] mb-5">
            <span className="bg-clip-text text-transparent bg-gradient-to-br from-emerald-400 via-emerald-200 to-cyan-400">
              Quiz videolar
            </span>
            <br />
            YouTube, Shorts va Reels uchun
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-md">
            Mavzuni yozing — AI savollarni tuzadi, professional ovoz bilan o'qiydi va tayyor
            16:9 uzun yoki 9:16 vertikal videoni yuklab beradi. Montaj ham, studiya ham kerak emas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onStart}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 hover:scale-[1.02] active:scale-[0.98] text-white px-8 py-4 rounded-2xl font-display font-bold text-base transition-all shadow-xl shadow-emerald-900/30 border border-white/10 border-t-white/20 cursor-pointer"
            >
              Bepul boshlash
              <ArrowRight size={19} />
            </button>
            <button
              onClick={onShowPricing}
              className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-8 py-4 rounded-2xl font-semibold text-base transition-all cursor-pointer"
            >
              Narxlarni ko'rish
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Google orqali kirib 1 ta video bepul yarating • Karta ma'lumotlari so'ralmaydi
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
      <div className="mb-16">
        <h2 className="text-2xl sm:text-3xl font-display font-black text-center mb-3">Narxlar</h2>
        <p className="text-slate-400 text-sm text-center mb-10">Sinash bepul — yoqsa, o'zingizga mosini tanlang</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {/* Bepul */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col">
            <h3 className="font-display font-bold text-lg mb-1">Bepul</h3>
            <p className="text-3xl font-black font-display mb-4">0 <span className="text-sm font-semibold text-slate-400">so'm</span></p>
            <ul className="space-y-2.5 text-sm text-slate-300 mb-6 flex-1">
              <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />1 ta to'liq video</li>
              <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />AI savollar va ovoz</li>
              <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-slate-600 mt-0.5 shrink-0" /><span className="text-slate-500">Suv belgisi bilan</span></li>
            </ul>
            <button
              onClick={onStart}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-sm transition-all cursor-pointer"
            >
              Boshlash
            </button>
          </div>

          {/* Paket */}
          <div className="bg-white/5 border border-cyan-500/30 rounded-3xl p-6 flex flex-col relative">
            <span className="absolute -top-2.5 left-6 bg-cyan-500 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">Ommabop</span>
            <h3 className="font-display font-bold text-lg mb-1 flex items-center gap-2"><ShoppingBag size={16} className="text-cyan-400" />Paket</h3>
            <p className="text-3xl font-black font-display mb-4 text-cyan-400">20,000 <span className="text-sm font-semibold text-slate-400">so'm</span></p>
            <ul className="space-y-2.5 text-sm text-slate-300 mb-6 flex-1">
              <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-cyan-400 mt-0.5 shrink-0" />10 ta to'liq video</li>
              <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-cyan-400 mt-0.5 shrink-0" />Barcha AI imkoniyatlar</li>
              <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-cyan-400 mt-0.5 shrink-0" />Muddatsiz amal qiladi</li>
            </ul>
            <button
              onClick={onShowPricing}
              className="w-full py-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold text-sm transition-all cursor-pointer"
            >
              Sotib olish
            </button>
          </div>

          {/* Premium */}
          <div className="bg-gradient-to-b from-amber-500/10 to-transparent border border-amber-500/30 rounded-3xl p-6 flex flex-col">
            <h3 className="font-display font-bold text-lg mb-1 flex items-center gap-2"><Crown size={16} className="text-amber-400 fill-current" />Premium</h3>
            <p className="text-3xl font-black font-display mb-4 text-amber-400">99,000 <span className="text-sm font-semibold text-slate-400">so'm/oy</span></p>
            <ul className="space-y-2.5 text-sm text-slate-300 mb-6 flex-1">
              <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-amber-400 mt-0.5 shrink-0" />Oyiga 100 ta video</li>
              <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-amber-400 mt-0.5 shrink-0" />Suv belgisiz eksport</li>
              <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-amber-400 mt-0.5 shrink-0" />Premium ovozlar va dizaynlar</li>
            </ul>
            <button
              onClick={onShowPricing}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all cursor-pointer"
            >
              Premium olish
            </button>
          </div>
        </div>
      </div>

      {/* PASTKI CTA */}
      <div className="text-center pb-8">
        <button
          onClick={onStart}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 hover:scale-[1.02] active:scale-[0.98] text-white px-10 py-4 rounded-2xl font-display font-bold text-base transition-all shadow-xl shadow-emerald-900/30 border border-white/10 border-t-white/20 cursor-pointer"
        >
          Birinchi videoni hoziroq yarating
          <ArrowRight size={19} />
        </button>
      </div>
    </div>
  );
}
