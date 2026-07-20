import { useState, useEffect } from "react";
import { Editor } from "./components/Editor";
import { Player } from "./components/Player";
import { AdminPanel } from "./components/AdminPanel";
import { Quiz, UserProfile } from "./types";
import { auth, db } from "./services/firebase";
import { onAuthStateChanged, signOut, User, getRedirectResult } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { AuthModal } from "./components/AuthModal";
import { PaywallModal } from "./components/PaywallModal";
import { Landing } from "./components/Landing";
import { Crown, LogIn, LogOut, Sparkles, Loader2, User as UserIcon, Shield } from "lucide-react";
import { firstQuiz } from "./data/firstQuiz";

const AUTOSAVE_KEY = "qv_autosaved_quiz_v3";

function getEffectiveRole(
  role: UserProfile["role"] | undefined,
  premiumUntil: string | null,
  email: string | null,
): UserProfile["role"] {
  const adminEmails = ["onlinemobi101@gmail.com", "optombazar9@gmail.com"];
  if ((email && adminEmails.includes(email)) || role === "admin") return "admin";
  if (role !== "premium") return role || "free";
  const expiresAt = premiumUntil ? Date.parse(premiumUntil) : Number.NaN;
  return Number.isFinite(expiresAt) && expiresAt > Date.now() ? "premium" : "free";
}

export default function App() {
  // Oxirgi ish avtosaqlangan bo'lsa, o'shandan boshlaymiz (audio qayta yaratiladi)
  const [quiz, setQuiz] = useState<Quiz>(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          const isLegacyStarterQuiz =
            parsed.title === "English Knowledge Challenge" &&
            parsed.questions.length <= 3;
          if (!isLegacyStarterQuiz) return parsed as Quiz;
        }
      }
    } catch (e) {
      console.warn("Autosave restore failed:", e);
    }
    return firstQuiz;
  });
  // Birinchi tashrifda landing sahifani ko'rsatamiz
  const [mode, setMode] = useState<"landing" | "editor" | "player" | "admin">(() =>
    localStorage.getItem("qv_visited") ? "editor" : "landing"
  );

  const startEditor = () => {
    localStorage.setItem("qv_visited", "1");
    setMode("editor");
  };

  // Har o'zgarishda quiz'ni localStorage'ga saqlaymiz (audio'siz — hajm limiti uchun)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const light: Quiz = {
          ...quiz,
          questions: quiz.questions.map(({ audioBase64, correctAudioBase64, ...rest }) => rest),
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(light));
      } catch (e) {
        console.warn("Autosave failed:", e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [quiz]);

  // Firebase Auth & Profile States
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Modals States
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const hasPremiumAccess = userProfile?.role === "premium" || userProfile?.role === "admin";

  // Ochiq sahifada ham premium muddati tugashi bilan UI huquqlarini yangilaymiz.
  useEffect(() => {
    if (userProfile?.role !== "premium" || !userProfile.premiumUntil) return;
    const interval = window.setInterval(() => {
      if (Date.parse(userProfile.premiumUntil!) <= Date.now()) {
        setUserProfile((current) => current?.role === "premium" ? { ...current, role: "free" } : current);
      }
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [userProfile?.role, userProfile?.premiumUntil]);

  // Monitor Auth State
  useEffect(() => {
    // Instantly load guest profile as a fallback starting point
    setUserProfile({
      uid: "guest",
      email: null,
      role: "free",
      videosCreated: 0,
      premiumUntil: null,
    });

    // Safety timeout: If Firebase auth doesn't resolve in 5 seconds, unblock the UI anyway
    const safetyTimeout = setTimeout(() => {
      setIsAuthLoading((loading) => {
        if (loading) {
          console.warn("Auth state resolution timed out. Unblocking UI.");
          return false;
        }
        return loading;
      });
    }, 5000);

    // 1. Resolve redirect result to catch any Google sign-in redirect errors
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

    // 2. Monitor auth state changes
    let unsubProfile: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      clearTimeout(safetyTimeout);
      // Foydalanuvchi almashganda eski profil obunasini yopamiz
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      setUser(currentUser);

      if (currentUser) {
        // Subscribe to real-time profile updates
        const userDocRef = doc(db, "users", currentUser.uid);

        unsubProfile = onSnapshot(
          userDocRef,
          async (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const premiumUntil = data.premiumUntil || null;
              const role = getEffectiveRole(data.role, premiumUntil, currentUser.email);
              
              // Automatically elevate owner email to admin in Firestore
              const adminEmails = ["onlinemobi101@gmail.com", "optombazar9@gmail.com"];
              if (currentUser.email && adminEmails.includes(currentUser.email) && data.role !== "admin") {
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
              });
            } else {
              // Profile document doesn't exist yet, create it
              const adminEmails = ["onlinemobi101@gmail.com", "optombazar9@gmail.com"];
              const defaultProfile = {
                role: (currentUser.email && adminEmails.includes(currentUser.email)) ? "admin" : "free",
                videosCreated: 0,
                premiumUntil: null,
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
            // Fallback so the app doesn't get stuck on loading
            setUserProfile({
              uid: currentUser.uid,
              email: currentUser.email,
              role: "free",
              videosCreated: 0,
              premiumUntil: null,
            });
            setIsAuthLoading(false);
          }
        );
      } else {
        // No user signed in — show guest UI with login button
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
      {/* Premium Header / Status Bar */}
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

        {/* User Status and Controls */}
        <div className="flex items-center gap-3 font-sans">
          {isAuthLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
              <Loader2 size={14} className="animate-spin" />
              Yuklanmoqda...
            </div>
          ) : user ? (
            <div className="flex flex-wrap items-center gap-3">
              {/* Badge: Free vs Premium vs Pack10 */}
              {userProfile?.role === "premium" ? (
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
                  <Crown size={14} className="fill-current animate-pulse" />
                  Premium (Cheksiz)
                </div>
              ) : userProfile?.role === "pack10" ? (
                <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded-xl text-xs font-semibold">
                  <Sparkles size={14} className="text-cyan-400" />
                  Paket ({userProfile?.videosCreated || 0}/10 video)
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-semibold">
                  <Sparkles size={14} className="text-emerald-400" />
                  Bepul ({userProfile?.videosCreated || 0}/1 video)
                </div>
              )}

              {/* Guest badge vs Registered badge */}
              <div className="text-xs text-slate-400 flex items-center gap-1.5 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl">
                <UserIcon size={14} className="text-slate-500" />
                <span className="max-w-[120px] truncate">
                  {user.isAnonymous ? "Mehmon" : user.email}
                </span>
              </div>

              {/* Admin Panel Button */}
              {(userProfile?.role === "admin" || (user && user.email === "onlinemobi101@gmail.com")) && (
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

              {/* Upgrade or Sign In CTAs */}
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
                <button
                  id="header-login-btn"
                  onClick={() => setIsAuthOpen(true)}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium text-xs px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                >
                  <LogIn size={13} />
                  Kirish
                </button>
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

      {/* Main Container */}
      <main className="flex-1 overflow-auto">
        {mode === "landing" ? (
          <Landing
            onStart={startEditor}
            onShowPricing={() => setIsPaywallOpen(true)}
          />
        ) : mode === "admin" ? (
          <AdminPanel
            onBack={() => setMode("editor")}
            currentUserId={user?.uid || "guest"}
          />
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

      {/* Premium Paywall and Auth Modals */}
      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
        userId={user?.uid || "guest"}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
}
