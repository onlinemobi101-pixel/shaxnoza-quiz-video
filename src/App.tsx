import { useState, useEffect } from "react";
import { Editor } from "./components/Editor";
import { Player } from "./components/Player";
import { AdminPanel } from "./components/AdminPanel";
import { Quiz } from "./types";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, getUserProfile } from "./services/firebase";

const defaultQuiz: Quiz = {
  title: "Tarix Testi",
  questions: [
    {
      id: "1",
      text: "Amir Temur davlatiga qaysi yilda asos solingan?",
      options: ["1360-yil", "1370-yil", "1380-yil", "1390-yil"],
      correctOptionIndex: 1,
      backgroundImage:
        "https://images.unsplash.com/photo-1541359927273-d76820fc43f9?q=80&w=1000&auto=format&fit=crop",
      fact: "Amir Temur 1370-yilda qultoy chog'ida Movarounnahrning amiri etib e'lon qilingan va poytaxtni Samarqand deb belgilagan.",
    },
    {
      id: "2",
      text: "Mirzo Ulug'bek Samarqandda qanday inshoot qurdirgan?",
      options: ["Registon madrasasi", "Rasadxona", "Bibixonim masjidi", "Go'ri Amir"],
      correctOptionIndex: 1,
      backgroundImage:
        "https://images.unsplash.com/photo-1584286595398-a59f21d313f5?q=80&w=1000&auto=format&fit=crop",
      fact: "Mirzo Ulug'bek rasadxonasi 1420-yillarda qurilgan bo'lib, o'z davrining eng yetuk astronomik inshootlaridan biri bo'lgan.",
    },
    {
      id: "3",
      text: "'Tib qonunlari' asari muallifi kim?",
      options: ["Abu Rayhon Beruniy", "Al-Xorazmiy", "Ibn Sino", "Umar Xayyom"],
      correctOptionIndex: 2,
      backgroundImage:
        "https://images.unsplash.com/photo-1585036156171-384164a8c675?q=80&w=1000&auto=format&fit=crop",
      fact: "Ibn Sino bu kitobni yozish orqali butun dunyoda tibbiyot faniga 500 yildan ortiq vaqt davomida asosiy qo'llanma bo'ladigan asar qoldirdi.",
    },
  ],
};

export default function App() {
  const [quiz, setQuiz] = useState<Quiz>(defaultQuiz);
  const [mode, setMode] = useState<"editor" | "player" | "admin">("editor");
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const profile = await getUserProfile(currentUser.uid);
          setIsAdmin(profile.role === "admin");
        } catch (err) {
          console.error(err);
          // Fallback: check email
          setIsAdmin(currentUser.email === "admin@gmail.com" || currentUser.email === "admin@quiz.uz");
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen text-white font-sans selection:bg-emerald-500/30">
      {mode === "editor" ? (
        <Editor
          quiz={quiz}
          setQuiz={setQuiz}
          onPlay={() => setMode("player")}
          onNavigateToAdmin={() => setMode("admin")}
          isAdmin={isAdmin}
          user={user}
        />
      ) : mode === "player" ? (
        <Player quiz={quiz} onExit={() => setMode("editor")} />
      ) : (
        <AdminPanel onBack={() => setMode("editor")} />
      )}
    </div>
  );
}
