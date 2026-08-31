import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, Key, ShieldCheck, ExternalLink } from "lucide-react";
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, signInAnonymously } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInAppBrowser = typeof navigator !== "undefined" && /Instagram|FBAN|FBAV|musical_ly|Telegram|Line/i.test(navigator.userAgent);

  useEffect(() => {
    if (!isOpen) return;

    (window as any).onTelegramAuth = async (tgUser: any) => {
      setIsLoading(true);
      try {
        const userCred = await signInAnonymously(auth);
        await setDoc(
          doc(db, "users", userCred.user.uid),
          {
            telegramId: tgUser.id,
            telegramName: tgUser.first_name,
            telegramUsername: tgUser.username || null,
            telegramPhoto: tgUser.photo_url || null,
          },
          { merge: true }
        );
        onClose();
      } catch (err: any) {
        console.error("Telegram web login failed:", err);
        setError("Telegram orqali kirishda xatolik yuz berdi.");
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      const container = document.getElementById("telegram-login-container");
      if (container && !container.hasChildNodes()) {
        const script = document.createElement("script");
        script.src = "https://telegram.org/js/telegram-widget.js?22";
        script.setAttribute("data-telegram-login", "QuizVideoAIBot");
        script.setAttribute("data-size", "large");
        script.setAttribute("data-radius", "12");
        script.setAttribute("data-onauth", "onTelegramAuth(user)");
        script.setAttribute("data-request-access", "write");
        script.async = true;
        container.appendChild(script);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/popup-blocked") {
        // Fallback to Redirect if Popups are blocked by browser settings
        try {
          const provider = new GoogleAuthProvider();
          await signInWithRedirect(auth, provider);
        } catch (redirErr: any) {
          setError(`Google orqali kirishda xatolik yuz berdi (${redirErr.code || redirErr.message}).`);
          setIsLoading(false);
        }
      } else if (err.code === "auth/unauthorized-domain") {
        const currentDomain = window.location.host;
        setError(
          `Bu manzil Firebase Authentication'da ruxsat etilmagan (${currentDomain}). ` +
          "Lokal ishlash uchun ilovani http://localhost:3000 orqali oching.",
        );
        setIsLoading(false);
      } else if (err.code !== "auth/popup-closed-by-user") {
        setError(`Google orqali kirishda xatolik yuz berdi (${err.code || err.message || "noma'lum xato"}).`);
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="auth-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl text-white"
          >
            {/* Close Button */}
            <button
              id="auth-close-btn"
              onClick={onClose}
              aria-label="Kirish oynasini yopish"
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            {/* Content */}
            <div className="p-8">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
                  <Key size={24} />
                </div>
                <h2 className="text-2xl font-display font-bold tracking-tight">
                  Tizimga Kirish
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Google hisobingiz bilan kiring — videolaringiz va tarifingiz saqlanadi
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium text-center">
                  {error}
                </div>
              )}

              {isInAppBrowser && (
                <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs text-left leading-relaxed">
                  <span className="font-semibold text-amber-200">💡 Instagram/Telegram foydalanuvchilari uchun:</span>
                  <br />
                  Google orqali kirish uchun yuqoridagi <strong>⋮ (uch nuqta)</strong> ni bosing va <strong>«Brauzerda ochish» (Chrome / Safari)</strong> ni tanlang.
                </div>
              )}

              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center cursor-pointer shadow-md"
              >
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    Google orqali kirish
                  </>
                )}
              </button>

              <div className="relative my-4 flex items-center justify-center">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-3 text-[11px] uppercase tracking-wider text-slate-500 font-bold">yoki</span>
                <div className="border-t border-slate-800 w-full" />
              </div>

              {/* Telegram Official Login Widget */}
              <div className="flex flex-col items-center justify-center gap-2">
                <div id="telegram-login-container" className="min-h-[40px] flex items-center justify-center" />
                
                <a
                  href="https://t.me/QuizVideoAIBot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white font-medium text-xs active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4 fill-[#229ED9]" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                  </svg>
                  <span>Telegram botda ochish (@QuizVideoAIBot)</span>
                  <ExternalLink size={12} className="text-slate-500" />
                </a>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
                <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
                Parol talab qilinmaydi — xavfsiz autentifikatsiya
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
