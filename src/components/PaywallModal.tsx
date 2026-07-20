import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Crown, CheckCircle2, X, Sparkles, Zap, AlertCircle, ShoppingBag, Copy, Check, ExternalLink, Send, ArrowLeft } from "lucide-react";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
}

type PlanId = "pack10" | "premium";

export function PaywallModal({ isOpen, onClose, userId }: PaywallModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("premium");
  const [step, setStep] = useState<1 | 2>(1);
  const [copied, setCopied] = useState(false);

  // Generate stable guest ID if no real userId is provided
  const displayId = useMemo(() => {
    if (userId && userId !== "guest") return userId;
    let guestId = localStorage.getItem("guest_id");
    if (!guestId) {
      guestId = "GUEST_" + Math.random().toString(36).substring(2, 11).toUpperCase();
      localStorage.setItem("guest_id", guestId);
    }
    return guestId;
  }, [userId]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(displayId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaynetCheckout = () => {
    // Open Paynet payment link
    window.open(
      "https://app.paynet.uz/?m=49156&i=4805742d-d76c-4b39-8c02-8ddf1c450f33&branchId=&actTypeId=144",
      "_blank"
    );
    // Transition to Step 2 (To'lovni tasdiqlash)
    setStep(2);
  };

  const handleAdminTelegramRedirect = () => {
    window.open("https://t.me/Akramjon1984", "_blank");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="paywall-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-lg">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-full max-w-xl overflow-hidden rounded-[32px] bg-slate-950 border border-indigo-500/30 shadow-[0_0_60px_rgba(99,102,241,0.2)] text-white"
          >
            {/* Cyberpunk Neon Glow Lines */}
            <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 shadow-[0_2px_15px_rgba(99,102,241,0.5)]" />
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-[120px] pointer-events-none" />

            {/* Back Button for Step 2 */}
            {step === 2 && (
              <button
                id="paywall-back-btn"
                onClick={() => setStep(1)}
                className="absolute top-5 left-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-400 hover:text-white transition-all duration-200 flex items-center gap-1 text-xs font-semibold"
              >
                <ArrowLeft size={14} />
                Orqaga
              </button>
            )}

            {/* Close Button */}
            <button
              id="paywall-close-btn"
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-400 hover:text-white transition-all duration-200"
            >
              <X size={18} />
            </button>

            {/* Modal Body */}
            <div className="p-8 md:p-10 flex flex-col items-center">
              {step === 1 ? (
                /* Step 1: Selection & Checkout Initiation */
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="w-full flex flex-col items-center"
                >
                  {/* Header Badge */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4">
                    <Sparkles size={12} className="animate-pulse text-indigo-400" />
                    Premiumga o'tish
                  </div>

                  <h2 className="text-3xl md:text-4xl font-display font-black text-center tracking-tight leading-none mb-3 bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                    Ijodiy Chegaralarni <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400">
                      Butkul Buzib O'ting!
                    </span>
                  </h2>
                  <p className="text-slate-400 text-sm text-center max-w-md mb-8">
                    Siz bepul limitingizdan foydalanib bo'ldingiz. Ilovani faollashtiring va Reels, TikTok, Shorts uchun trenddagi videolarni tayyorlang.
                  </p>

                  {/* 2 Plans Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mb-8">
                    {/* Plan 1: 10 Videos */}
                    <div
                      onClick={() => setSelectedPlan("pack10")}
                      className={`relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                        selectedPlan === "pack10"
                          ? "bg-slate-900/80 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                          : "bg-slate-900/30 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/40"
                      }`}
                    >
                      {selectedPlan === "pack10" && (
                        <span className="absolute -top-2.5 right-4 bg-cyan-500 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                          Ommabop
                        </span>
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`p-1.5 rounded-lg border ${selectedPlan === "pack10" ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : "bg-white/5 border-white/5 text-slate-400"}`}>
                            <ShoppingBag size={16} />
                          </div>
                          <h4 className="text-sm font-bold text-slate-100">1 Martalik Paket</h4>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed mb-4">
                          Loyiha doirasida 10 ta to'liq video yaratish huquqi.
                        </p>
                      </div>
                      <div className="flex items-baseline justify-between pt-2 border-t border-slate-800/60 mt-auto">
                        <span className="text-xs text-slate-400">10 Ta Video</span>
                        <span className="text-lg font-black text-cyan-400">20,000 so'm</span>
                      </div>
                    </div>

                    {/* Plan 2: 100 monthly exports */}
                    <div
                      onClick={() => setSelectedPlan("premium")}
                      className={`relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                        selectedPlan === "premium"
                          ? "bg-slate-900/80 border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.15)]"
                          : "bg-slate-900/30 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/40"
                      }`}
                    >
                      {selectedPlan === "premium" && (
                        <span className="absolute -top-2.5 right-4 bg-fuchsia-500 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                          100 Video Pro
                        </span>
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`p-1.5 rounded-lg border ${selectedPlan === "premium" ? "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400" : "bg-white/5 border-white/5 text-slate-400"}`}>
                            <Crown size={16} />
                          </div>
                          <h4 className="text-sm font-bold text-slate-100">Oylik Premium (Pro)</h4>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed mb-4">
                          Oyiga 100 ta video, barcha premium ovozlar va premium dizayn mavzulari.
                        </p>
                      </div>
                      <div className="flex items-baseline justify-between pt-2 border-t border-slate-800/60 mt-auto">
                        <span className="text-xs text-slate-400">Oyiga 100 Video</span>
                        <span className="text-lg font-black text-fuchsia-400">99,000 so'm</span>
                      </div>
                    </div>
                  </div>

                  {/* Perks Grid */}
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-900/40 border border-slate-900 rounded-2xl p-5 mb-8 text-left text-xs">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 size={16} className="text-indigo-400 mt-0.5 shrink-0" />
                      <span className="text-slate-300">Suv belgisiz (No Watermark) eksport</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 size={16} className="text-indigo-400 mt-0.5 shrink-0" />
                      <span className="text-slate-300">Cyberpunk, Retro va Chalk Board dizaynlari</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 size={16} className="text-indigo-400 mt-0.5 shrink-0" />
                      <span className="text-slate-300">4 ta qo'shimcha premium AI ovozlari</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 size={16} className="text-indigo-400 mt-0.5 shrink-0" />
                      <span className="text-slate-300">Tezkor render va barqaror yuklab olish</span>
                    </div>
                  </div>

                  {/* Checkout Action */}
                  <button
                    id="paywall-upgrade-submit"
                    onClick={handlePaynetCheckout}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:brightness-110 active:scale-98 text-slate-950 font-display font-black text-sm shadow-xl shadow-indigo-500/15 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Zap size={18} className="fill-current" />
                    Sotib Olish — {selectedPlan === "premium" ? "99,000 so'm" : "20,000 so'm"}
                  </button>

                  <div className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-500">
                    <AlertCircle size={12} />
                    <span>Paynet tizimi orqali xavfsiz va tezkor to'lov amalga oshiriladi.</span>
                  </div>
                </motion.div>
              ) : (
                /* Step 2: Paynet Instructions & Admin Verification */
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="w-full flex flex-col items-center"
                >
                  {/* Header Badge */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-4">
                    <CheckCircle2 size={12} />
                    To'lovni tasdiqlash
                  </div>

                  <h3 className="text-2xl md:text-3xl font-display font-black text-center tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
                    Buyurtmani Faollashtirish
                  </h3>
                  <p className="text-slate-400 text-xs text-center max-w-sm mb-6">
                    Tarifingizni faollashtirish va hisobingizni tasdiqlash uchun quyidagi 2 ta bosqichni bajaring.
                  </p>

                  {/* Instruction Cards */}
                  <div className="w-full space-y-4 mb-8 text-left">
                    {/* Step 2-1 card */}
                    <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
                        <span className="text-xs font-black text-cyan-400">1</span>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                          Paynet orqali to'lovni amalga oshiring
                        </h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Yangi ochilgan Paynet oynasida {selectedPlan === "premium" ? "99,000" : "20,000"} so'm miqdoridagi to'lovni tasdiqlang.
                        </p>
                        <button
                          onClick={() => window.open("https://app.paynet.uz/?m=49156&i=4805742d-d76c-4b39-8c02-8ddf1c450f33&branchId=&actTypeId=144", "_blank")}
                          className="mt-1 flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:underline"
                        >
                          Paynet-ni qayta ochish <ExternalLink size={10} />
                        </button>
                      </div>
                    </div>

                    {/* Step 2-2 card */}
                    <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center shrink-0">
                        <span className="text-xs font-black text-fuchsia-400">2</span>
                      </div>
                      <div className="space-y-1.5 w-full">
                        <h4 className="text-sm font-bold text-slate-100">
                          To'lov chekini va quyidagi ID-ni adminga yuboring
                        </h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Administrator to'lovingizni tekshirib, hisobingizga premium paketni bir zumda yuklab beradi.
                        </p>

                        {/* ID Container */}
                        <div className="flex items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 mt-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Mijoz ID raqami</span>
                            <span className="text-xs font-mono font-bold text-slate-200 select-all truncate max-w-[200px] sm:max-w-[280px]">
                              {displayId}
                            </span>
                          </div>
                          <button
                            id="copy-id-btn"
                            onClick={handleCopyId}
                            className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                              copied
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "bg-white/5 border-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                            }`}
                          >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            {copied ? "Nusxalandi" : "Nusxalash"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Telegram Send Button */}
                  <button
                    id="paywall-telegram-submit"
                    onClick={handleAdminTelegramRedirect}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:brightness-110 active:scale-98 text-white font-display font-black text-sm shadow-xl shadow-fuchsia-500/10 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border border-fuchsia-500/30"
                  >
                    <Send size={18} className="fill-current shrink-0" />
                    Chekni adminga yuborish 🚀
                  </button>

                  <p className="text-[11px] text-slate-400 mt-3 text-center">
                    Telegram: <span className="text-indigo-400 font-bold hover:underline cursor-pointer" onClick={handleAdminTelegramRedirect}>@Akramjon1984</span>
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
