import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Share2, Gift, Users, Sparkles } from "lucide-react";
import { UserProfile } from "../types";
import { getTelegramUser, isTelegramWebApp, telegramHaptic } from "../services/telegram";

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
}

export function ReferralModal({ isOpen, onClose, userProfile }: ReferralModalProps) {
  const [copied, setCopied] = useState(false);
  const tgUser = getTelegramUser();

  const refCode = tgUser?.id ? String(tgUser.id) : (userProfile?.uid && userProfile.uid !== "guest" ? userProfile.uid : "app");
  const referralLink = `https://t.me/QuizVideoAIBot?start=ref_${refCode}`;

  const shareText = `🎬 Sun'iy intellekt (AI) yordamida YouTube Shorts, TikTok va Reels uchun test videolarini 1 daqiqada tayyorlang!\n\n👇 Ushbu havola orqali kiring va 1 ta videoni bepul yarating:`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      telegramHaptic("success");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleTelegramShare = () => {
    telegramHaptic("medium");
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;
    if (isTelegramWebApp() && (window as any).Telegram?.WebApp?.openTelegramLink) {
      (window as any).Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  };

  const referralsCount = userProfile?.referralsCount || 0;
  const bonusVideos = userProfile?.bonusVideos || referralsCount;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md bg-slate-900 border border-emerald-500/20 rounded-3xl p-6 shadow-2xl overflow-hidden font-sans"
          >
            {/* Background Glows */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

            <button
              onClick={() => {
                telegramHaptic("light");
                onClose();
              }}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Yopish"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                <Gift size={28} />
              </div>
              <h3 className="text-xl font-display font-extrabold text-white tracking-tight">
                Do'stlarni Taklif Qiling
              </h3>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed max-w-xs mx-auto">
                Har bir taklif qilgan do'stingiz botga kirganda, sizga <strong className="text-emerald-300">+1 ta bepul video</strong> qo'shiladi!
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1 font-medium">
                  <Users size={14} className="text-cyan-400" />
                  Do'stlar
                </div>
                <div className="text-2xl font-display font-black text-white">
                  {referralsCount} <span className="text-xs text-slate-400 font-normal">ta</span>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1 font-medium">
                  <Sparkles size={14} className="text-emerald-400" />
                  Yutilgan video
                </div>
                <div className="text-2xl font-display font-black text-emerald-400">
                  +{bonusVideos} <span className="text-xs text-slate-400 font-normal">ta</span>
                </div>
              </div>
            </div>

            {/* Link Box */}
            <div className="mb-4">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                Sizning shaxsiy referal havolangiz:
              </label>
              <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-2xl p-2 pl-3">
                <input
                  type="text"
                  readOnly
                  value={referralLink}
                  className="bg-transparent text-xs text-emerald-300 font-mono flex-1 outline-none truncate select-all"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copied ? "Nusxalandi" : "Nusxalash"}
                </button>
              </div>
            </div>

            {/* Telegram Share Button */}
            <button
              type="button"
              onClick={handleTelegramShare}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#229ED9] to-[#0088cc] hover:from-[#1f8ec4] hover:to-[#0077b5] text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-[#229ED9]/25 cursor-pointer mb-3"
            >
              <Share2 size={16} />
              Telegram'da Do'stlarga Ulashish
            </button>

            {/* How it works */}
            <div className="bg-slate-950/50 rounded-2xl p-3 border border-white/5 text-[11px] text-slate-400 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] flex items-center justify-center font-bold">1</span>
                <span>Havolangizni do'stlaringizga yoki guruhlarga yuboring</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] flex items-center justify-center font-bold">2</span>
                <span>Do'stingiz havola orqali botga kiradi</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] flex items-center justify-center font-bold">3</span>
                <span>Sizga darhol <strong>+1 ta bepul video</strong> sovg'a qilinadi!</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
