import { useState } from "react";
import { Editor } from "./components/Editor";
import { Player } from "./components/Player";
import { Quiz } from "./types";

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
  const [mode, setMode] = useState<"editor" | "player">("editor");

  return (
    <div className="min-h-screen text-white font-sans selection:bg-emerald-500/30">
      {mode === "editor" ? (
        <Editor
          quiz={quiz}
          setQuiz={setQuiz}
          onPlay={() => setMode("player")}
        />
      ) : (
        <Player quiz={quiz} onExit={() => setMode("editor")} />
      )}
    </div>
  );
}
