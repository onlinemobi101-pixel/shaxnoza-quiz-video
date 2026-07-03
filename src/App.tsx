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
import { Crown, LogIn, LogOut, Sparkles, Loader2, User as UserIcon, Shield } from "lucide-react";

const defaultQuiz: Quiz = {
  title: "Tarix Testi",
  themeColor: "emerald",
  themePreset: "default",
  timerStyle: "line",
  transitionEffect: "slide",
  questions: [
    {
      id: "1",
      text: "Amir Temur davlatiga qaysi yilda asos solingan?",
      options: ["1360-yil", "1370-yil", "1380-yil"],
      correctOptionIndex: 1,
      backgroundImage:
        "https://images.unsplash.com/photo-1541359927273-d76820fc43f9?q=80&w=1000&auto=format&fit=crop",
    },
    {
      id: "2",
      text: "Mirzo Ulug'bek Samarqandda qanday inshoot qurdirgan?",
      options: ["Registon madrasasi", "Rasadxona", "Bibixonim masjidi"],
      correctOptionIndex: 1,
      backgroundImage:
        "https://images.unsplash.com/photo-1584286595398-a59f21d313f5?q=80&w=1000&auto=format&fit=crop",
    },
    {
      id: "3",
      text: "'Tib qonunlari' asari muallifi kim?",
      options: ["Abu Rayhon Beruniy", "Al-Xorazmiy", "Ibn Sino"],
      correctOptionIndex: 2,
      backgroundImage:
        "https://images.unsplash.com/photo-1585036156171-384164a8c675?q=80&w=1000&auto=format&fit=crop",
    },
  ],
};

export default function App() {
  const [quiz, setQuiz] = useState<Quiz>(defaultQuiz);
  const [mode, setMode] = useState<"editor" | "player" | "admin">("editor");

  // Firebase Auth & Profile States
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Modals States
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Monitor Auth State
  useEffect(() => {
    // Instantly load guest profile as a fallback starting point
    const localCount = parseInt(localStorage.getItem("guest_videos_created") || "0", 10);
    const localRole = (localStorage.getItem("guest_role") as "free" | "premium" | "pack10") || "free";
    setUserProfile({
      uid: "guest",
      email: null,
      role: localRole,
      videosCreated: localCount,
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
              
              // Automatically elevate owner email to admin in Firestore
              if (currentUser.email === "onlinemobi101@gmail.com" && data.role !== "admin") {
                try {
                  await setDoc(userDocRef, { role: "admin" }, { merge: true });
                } catch (e) {
                  console.error("Auto admin elevation failed:", e);
                }
              }

              setUserProfile({
                uid: currentUser.uid,
                email: currentUser.email,
                role: currentUser.email === "onlinemobi101@gmail.com" ? "admin" : (data.role || "free"),
                videosCreated: data.videosCreated || 0,
                premiumUntil: data.premiumUntil || null,
              });
            } else {
              // Profile document doesn't exist yet, create it
              const defaultProfile = {
                role: currentUser.email === "onlinemobi101@gmail.com" ? "admin" : "free",
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center font-display font-extrabold text-slate-950 shadow-md">
            QV
          </div>
          <div>
            <h2 className="text-md font-display font-bold text-white tracking-wide">Quiz Video Generator</h2>
            <p className="text-[10px] text-slate-400 font-medium">Frictionless TikTok, Shorts & Reels Creator</p>
          </div>
        </div>

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
              {userProfile?.role !== "premium" && (
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
        {mode === "admin" ? (
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
            onVideoCreated={() => {
              const localCount = parseInt(localStorage.getItem("guest_videos_created") || "0", 10);
              setUserProfile(prev => prev ? { ...prev, videosCreated: localCount } : null);
            }}
          />
        ) : (
          <Player
            quiz={{
              ...quiz,
              watermark: userProfile?.role === "premium" ? quiz.watermark : "@QuizVideo",
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
        onUpgradeSuccess={() => {
          const localRole = (localStorage.getItem("guest_role") as "free" | "premium" | "pack10") || "free";
          if (localRole === "premium") {
            alert("Tabriklaymiz! Hisobingiz muvaffaqiyatli Premium tarifga o'tkazildi.");
          } else if (localRole === "pack10") {
            alert("Tabriklaymiz! 10 ta video paketingiz muvaffaqiyatli faollashtirildi.");
          } else {
            alert("Xarid muvaffaqiyatli yakunlandi.");
          }
          const localCount = parseInt(localStorage.getItem("guest_videos_created") || "0", 10);
          setUserProfile(prev => prev ? { ...prev, role: localRole, videosCreated: localCount } : null);
        }}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
}
