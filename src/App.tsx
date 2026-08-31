import { useState, useEffect, Suspense, lazy } from "react";
import { Editor } from "./components/Editor";
import { Player } from "./components/Player";
import { Quiz, UserProfile } from "./types";
import { auth, db } from "./services/firebase";
import { onAuthStateChanged, signOut, User, getRedirectResult, signInAnonymously } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { Landing } from "./components/Landing";
import { Crown, LogIn, LogOut, Sparkles, Loader2, User as UserIcon, Shield, AlertTriangle } from "lucide-react";
import { firstQuiz } from "./data/firstQuiz";
import { isAdminEmail } from "./services/admins";
import { AutosaveStatus, loadQuizDraft, saveQuizDraft } from "./services/draft";
import { safeGetItem, safeSetItem } from "./services/storage";
import {
  getPlanLimit,
  getPlanUsage,
  isCurrentPlanCycle,
  PLAN_EXPORT_LIMITS,
} from "./services/plans";

import { initTelegramWebApp, isTelegramWebApp, getTelegramUser } from "./services/telegram";

// Lazy Loaded Heavy Components
const AdminPanel = lazy(() => import("./components/AdminPanel").then(module => ({ default: module.AdminPanel })));
const AuthModal = lazy(() => import("./components/AuthModal").then(module => ({ default: module.AuthModal })));
const PaywallModal = lazy(() => import("./components/PaywallModal").then(module => ({ default: module.PaywallModal })));

function getEffectiveRole(
  role: UserProfile["role"] | undefined,
  premiumUntil: string | null,
  email: string | null,
): UserProfile["role"] {
  if (isAdminEmail(email) || role === "admin") return "admin";
  if (role !== "premium") return role || "free";
  const expiresAt = premiumUntil ? Date.parse(premiumUntil) : Number.NaN;
  return Number.isFinite(expiresAt) && expiresAt > Date.now() ? "premium" : "free";
}

function getProfileQuota(
  data: Record<string, any>,
  role: UserProfile["role"],
): Pick<UserProfile, "quotaCycle" | "quotaUsed" | "quotaLimit"> {
  const quotaCycle = typeof data.quotaCycle === "string" ? data.quotaCycle : null;
  const cycleMatchesRole = isCurrentPlanCycle(role, quotaCycle);
  const quotaLimit = role === "admin" ? null : PLAN_EXPORT_LIMITS[role];
  const legacyUsed = role === "premium" || role === "admin"
    ? 0
    : Math.min(Number(data.videosCreated) || 0, quotaLimit || 0);
  return {
    quotaCycle,
    quotaUsed: cycleMatchesRole && Number.isFinite(data.quotaUsed)
      ? Math.max(0, Number(data.quotaUsed))
      : legacyUsed,
    quotaLimit,
  };
}

export default function App() {
  const [quiz, setQuiz] = useState<Quiz>(() => loadQuizDraft(firstQuiz));
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("ok");
  const [mode, setMode] = useState<"landing" | "editor" | "player" | "admin">(() => {
    // Telegram Mini App ichida ochilsa: to'g'ridan-to'g'ri tahrirlagichni ochamiz
    if (isTelegramWebApp()) return "editor";
    return safeGetItem("qv_visited") ? "editor" : "landing";
  });

  useEffect(() => {
    initTelegramWebApp();
    if (isTelegramWebApp()) {
      signInAnonymously(auth).catch((err) => console.warn("Telegram auto-anonymous auth failed:", err));
    }
  }, []);

  const startEditor = () => {
    safeSetItem("qv_visited", "1");
    setMode("editor");
  };

  useEffect(() => {
    const timer = setTimeout(() => setAutosaveStatus(saveQuizDraft(quiz)), 600);
    return () => clearTimeout(timer);
  }, [quiz]);

  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const hasPremiumAccess = userProfile?.role === "premium" || userProfile?.role === "admin";

  useEffect(() => {
    if (userProfile?.role !== "premium" || !userProfile.premiumUntil) return;
    const interval = window.setInterval(() => {
      if (Date.parse(userProfile.premiumUntil!) <= Date.now()) {
        setUserProfile((current) => current?.role === "premium" ? {
          ...current,
          role: "free",
          quotaCycle: null,
          quotaUsed: Math.min(current.videosCreated, 1),
          quotaLimit: 1,
        } : current);
      }
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [userProfile?.role, userProfile?.premiumUntil]);

  useEffect(() => {
    setUserProfile({
      uid: "guest",
      email: null,
      role: "free",
      videosCreated: 0,
      premiumUntil: null,
      quotaCycle: null,
      quotaUsed: 0,
      quotaLimit: 1,
    });

    const safetyTimeout = setTimeout(() => {
      setIsAuthLoading((loading) => {
        if (loading) {
          console.warn("Auth state resolution timed out. Unblocking UI.");
          return false;
        }
        return loading;
      });
    }, 5000);

    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log("Redirect sign-in successful:", result.user.email);
        }
      })
      .catch((err) => {
        console.error("Redirect sign-in error:", err);
        alert(`Google orqali kirishda xatolik yuz berdi (${err.code || err.message}).`);
      });

    let unsubProfile: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      clearTimeout(safetyTimeout);
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      setUser(currentUser);

      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);

        unsubProfile = onSnapshot(
          userDocRef,
          async (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const premiumUntil = data.premiumUntil || null;
              const role = getEffectiveRole(data.role, premiumUntil, currentUser.email);
              const quota = getProfileQuota(data, role);
              
              if (isAdminEmail(currentUser.email) && data.role !== "admin") {
                try {
                  await setDoc(userDocRef, { role: "admin" }, { merge: true });
                } catch (e) {
                  console.error("Auto admin elevation failed:", e);
                }
              }

              setUserProfile({
                uid: currentUser.uid,
                email: currentUser.email,
                role,
                videosCreated: data.videosCreated || 0,
                premiumUntil,
                ...quota,
              });
            } else {
              const defaultRole: UserProfile["role"] =
                isAdminEmail(currentUser.email) ? "admin" : "free";
              const defaultProfile = {
                role: defaultRole,
                videosCreated: 0,
                premiumUntil: null,
                quotaCycle: null,
                quotaUsed: 0,
                quotaLimit: defaultRole === "admin" ? null : PLAN_EXPORT_LIMITS[defaultRole],
                email: currentUser.email,
                createdAt: new Date().toISOString()
              };
              try {
                await setDoc(userDocRef, defaultProfile);
                setUserProfile({
                  uid: currentUser.uid,
                  email: currentUser.email,
                  ...defaultProfile
                });
              } catch (setErr) {
                console.error("Error setting default profile:", setErr);
              }
            }
            setIsAuthLoading(false);
          },
          (snapError) => {
            console.error("Profile snapshot read failed:", snapError);
            setUserProfile({
              uid: currentUser.uid,
              email: currentUser.email,
              role: "free",
              videosCreated: 0,
              premiumUntil: null,
              quotaCycle: null,
              quotaUsed: 0,
              quotaLimit: 1,
            });
            setIsAuthLoading(false);
          }
        );
      } else {
        setIsAuthLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      if (unsubProfile) unsubProfile();
      unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      alert("Tizimdan muvaffaqiyatli chiqdingiz!");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  return (
    <div className="min-h-screen text-white font-sans selection:bg-emerald-500/30 flex flex-col">
      <header className="border-b border-white/5 bg-slate-950/30 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        <button
          onClick={() => setMode(mode === "landing" ? "editor" : "landing")}
          className="flex items-center gap-3 cursor-pointer text-left"
          title={mode === "landing" ? "Tahrirlagichga o'tish" : "Bosh sahifa"}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center font-display font-extrabold text-slate-950 shadow-md">
            QV
          </div>
          <div>
            <h2 className="text-md font-display font-bold text-white tracking-wide">Quiz Video Generator</h2>
            <p className="text-[10px] text-slate-400 font-medium">YouTube Long, Shorts & Reels Creator</p>
          </div>
        </button>

        <div className="flex items-center gap-3 font-sans">
          {isAuthLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
              <Loader2 size={14} className="animate-spin" />
              Yuklanmoqda...
            </div>
          ) : user ? (
            <div className="flex flex-wrap items-center gap-3">
              {userProfile?.role === "admin" ? (
                <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-xl text-xs font-semibold">
                  <Shield size={14} className="text-amber-400" />
                  Admin (cheklanmagan)
                </div>
              ) : userProfile?.role === "premium" ? (
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
                  <Crown size={14} className="fill-current animate-pulse" />
                  Premium ({getPlanUsage(userProfile)}/{getPlanLimit(userProfile)} video)
                </div>
              ) : userProfile?.role === "pack10" ? (
                <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded-xl text-xs font-semibold">
                  <Sparkles size={14} className="text-cyan-400" />
                  Paket ({getPlanUsage(userProfile)}/{getPlanLimit(userProfile)} video)
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-semibold">
                  <Sparkles size={14} className="text-emerald-400" />
                  Bepul ({getPlanUsage(userProfile)}/{getPlanLimit(userProfile)} video)
                </div>
              )}

              <div className="text-xs text-slate-400 flex items-center gap-1.5 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl">
                {user.isAnonymous && getTelegramUser() ? (
                  <span className="text-[#229ED9] font-bold flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                    </svg>
                    {getTelegramUser()?.first_name || getTelegramUser()?.username || "Telegram"}
                  </span>
                ) : (
                  <>
                    <UserIcon size={14} className="text-slate-500" />
                    <span className="max-w-[120px] truncate">
                      {user.isAnonymous ? "Mehmon" : user.email}
                    </span>
                  </>
                )}
              </div>

              {(userProfile?.role === "admin" || isAdminEmail(user.email)) && (
                <button
                  id="header-admin-btn"
                  onClick={() => setMode(mode === "admin" ? "editor" : "admin")}
                  className={`font-semibold text-xs px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 ${
                    mode === "admin" 
                      ? "bg-amber-500 text-slate-950 hover:bg-amber-600" 
                      : "bg-white/5 hover:bg-white/10 border border-white/10 text-amber-400 hover:text-amber-300"
                  }`}
                >
                  <Shield size={13} />
                  {mode === "admin" ? "Tahrirchi" : "Admin Panel"}
                </button>
              )}

              {!hasPremiumAccess && (
                <button
                  id="header-upgrade-btn"
                  onClick={() => setIsPaywallOpen(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Crown size={13} className="fill-current" />
                  Premiumga o'tish
                </button>
              )}

              {user.isAnonymous ? (
                !getTelegramUser() && (
                  <button
                    id="header-login-btn"
                    onClick={() => setIsAuthOpen(true)}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium text-xs px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <LogIn size={13} />
                    Kirish
                  </button>
                )
              ) : (
                <button
                  id="header-logout-btn"
                  onClick={handleSignOut}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white font-medium text-xs px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                >
                  <LogOut size={13} />
                  Chiqish
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-semibold">
                <Sparkles size={14} className="text-emerald-400" />
                Bepul (0/1 video)
              </div>
              <a
                href="https://t.me/QuizVideoAIBot"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-[#229ED9]/15 hover:bg-[#229ED9]/25 border border-[#229ED9]/30 text-[#229ED9] px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                title="Telegram botimiz orqali ochish"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
                <span className="hidden sm:inline">Telegram Bot</span>
              </a>

              <button
                id="header-login-btn-guest"
                onClick={() => setIsAuthOpen(true)}
                className="bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-indigo-500/20"
              >
                <LogIn size={13} />
                Gmail bilan Kirish
              </button>
            </div>
          )}
        </div>
      </header>

      {autosaveStatus !== "ok" && (
        <div
          role="status"
          className="flex items-start gap-2.5 border-b border-amber-500/20 bg-amber-500/10 px-6 py-3 text-xs text-amber-200"
        >
          <AlertTriangle size={15} className="mt-px shrink-0 text-amber-400" />
          <p className="leading-relaxed">
            {autosaveStatus === "degraded" ? (
              <>
                <strong>Brauzer xotirasi to'ldi.</strong> Savollaringiz saqlanmoqda, lekin
                yuklangan rasmlar saqlanmayapti — sahifani yangilasangiz ular yo'qoladi.
                Ishingizni <strong>Eksport (.json)</strong> orqali faylga saqlab qo'ying.
              </>
            ) : (
              <>
                <strong>Avtosaqlash ishlamayapti.</strong> Brauzer xotirasi to'la yoki
                saqlash o'chirilgan. Sahifani yopsangiz ishingiz yo'qoladi —
                <strong> Eksport (.json)</strong> tugmasi bilan faylga saqlang.
              </>
            )}
          </p>
        </div>
      )}

      <main className="flex-1 overflow-auto">
        {mode === "landing" ? (
          <Landing
            onStart={startEditor}
            onShowPricing={() => setIsPaywallOpen(true)}
          />
        ) : mode === "admin" ? (
          <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-emerald-400" size={32} /></div>}>
            <AdminPanel
              onBack={() => setMode("editor")}
              currentUserId={user?.uid || "guest"}
            />
          </Suspense>
        ) : mode === "editor" ? (
          <Editor
            quiz={quiz}
            setQuiz={setQuiz}
            onPlay={() => setMode("player")}
            user={user}
            userProfile={userProfile}
            onOpenPaywall={() => setIsPaywallOpen(true)}
            onRequireAuth={() => setIsAuthOpen(true)}
            onVideoCreated={(result) => {
              setUserProfile(prev => prev ? {
                ...prev,
                role: result.role,
                videosCreated: result.videosCreated,
                premiumUntil: result.premiumUntil,
                quotaCycle: result.quotaCycle,
                quotaUsed: result.quotaUsed,
                quotaLimit: result.quotaLimit,
              } : null);
            }}
          />
        ) : (
          <Player
            quiz={{
              ...quiz,
              watermark: hasPremiumAccess ? quiz.watermark : "@QuizVideo",
            }}
            onExit={() => setMode("editor")}
          />
        )}
      </main>

      <Suspense fallback={null}>
        <PaywallModal
          isOpen={isPaywallOpen}
          onClose={() => setIsPaywallOpen(false)}
          userId={user?.uid || "guest"}
        />
      </Suspense>

      <Suspense fallback={null}>
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
        />
      </Suspense>
    </div>
  );
}
