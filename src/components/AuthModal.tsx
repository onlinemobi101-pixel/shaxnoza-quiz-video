import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Mail, Lock, LogIn, UserPlus, Loader2, Key } from "lucide-react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        // Sign Up
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (name) {
          await updateProfile(user, { displayName: name });
        }

        // Create user document in Firestore with standard values
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, {
          role: "free",
          videosCreated: 0,
          premiumUntil: null,
          email: user.email,
          createdAt: new Date().toISOString()
        });
      } else {
        // Sign In
        await signInWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("Ushbu elektron pochta manzili allaqachon ro'yxatdan o'tgan.");
      } else if (err.code === "auth/invalid-credential") {
        setError("Elektron pochta yoki parol noto'g'ri.");
      } else if (err.code === "auth/weak-password") {
        setError("Parol kamida 6 ta belgidan iborat bo'lishi kerak.");
      } else {
        setError("Xatolik yuz berdi. Iltimos qayta urinib ko'ring.");
      }
    } finally {
      setIsLoading(false);
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
                  {isSignUp ? "Ro'yxatdan O'tish" : "Tizimga Kirish"}
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  {isSignUp
                    ? "Premium imkoniyatlardan foydalanish va ma'lumotlarni saqlash uchun yangi hisob yarating"
                    : "Mavjud hisobingizga kiring va videolarni yaratishda davom eting"}
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Ismingiz</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <UserPlus size={16} />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Ismingizni kiriting"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 font-sans">Elektron Pochta</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <Mail size={16} />
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 font-sans">Parol</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <Lock size={16} />
                    </span>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 mt-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-slate-950 hover:text-white font-semibold text-sm active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : isSignUp ? (
                    <>
                      <UserPlus size={18} />
                      Hisob Yaratish
                    </>
                  ) : (
                    <>
                      <LogIn size={18} />
                      Tizimga Kirish
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
                {isSignUp ? (
                  <>
                    Sizda allaqachon hisob bormi?{" "}
                    <button
                      onClick={() => setIsSignUp(false)}
                      className="text-indigo-400 hover:underline font-medium cursor-pointer"
                    >
                      Kirish
                    </button>
                  </>
                ) : (
                  <>
                    Hisobingiz yo'qmi?{" "}
                    <button
                      onClick={() => setIsSignUp(true)}
                      className="text-indigo-400 hover:underline font-medium cursor-pointer"
                    >
                      Ro'yxatdan o'tish
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
