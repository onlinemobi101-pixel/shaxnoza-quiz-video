import React, { useState, useRef } from "react";
import { Quiz, Question } from "../types";
import {
  Plus,
  Trash2,
  Play,
  Image as ImageIcon,
  Volume2,
  Loader2,
  Sparkles,
  Download,
  Settings2,
  ArrowUp,
  ArrowDown,
  Upload,
  FileJson,
  FileDown,
  FileUp,
  Mic,
  Square,
  Pause,
  VolumeX,
} from "lucide-react";
import { generateTTS } from "../services/tts";
import { generateQuizAI, analyzeQuestionsForImages, getUnsplashImageForKeyword } from "../services/ai";
import { QuizRenderer } from "../services/renderer";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../services/firebase";
import { UserProfile } from "../types";

interface EditorProps {
  quiz: Quiz;
  setQuiz: (quiz: Quiz) => void;
  onPlay: () => void;
  user: any;
  userProfile: UserProfile | null;
  onOpenPaywall: () => void;
  onVideoCreated?: () => void;
}

export function Editor({ quiz, setQuiz, onPlay, user, userProfile, onOpenPaywall, onVideoCreated }: EditorProps) {
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(
    null,
  );
  const [aiTopic, setAiTopic] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isGeneratingBulkImages, setIsGeneratingBulkImages] = useState(false);
  const [isGeneratingBulkVoices, setIsGeneratingBulkVoices] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<"uz" | "en" | "ru" | "tr">(
    quiz.language || "uz"
  );
  const [showSettings, setShowSettings] = useState(false);

  // O'z ovozini yozib olish (Voice Recorder) states & refs
  interface RecordingState {
    questionId: string;
    type: "question" | "correct";
    isRecording: boolean;
    duration: number;
  }
  const [activeRecording, setActiveRecording] = useState<RecordingState | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);
  const audioInstanceRef = useRef<HTMLAudioElement | null>(null);

  const playAudio = (base64: string, playId: string) => {
    try {
      if (audioInstanceRef.current) {
        audioInstanceRef.current.pause();
        audioInstanceRef.current = null;
      }

      if (playingAudioId === playId) {
        setPlayingAudioId(null);
        return;
      }

      const audio = new Audio(base64);
      audioInstanceRef.current = audio;
      setPlayingAudioId(playId);

      audio.onended = () => {
        setPlayingAudioId(null);
        audioInstanceRef.current = null;
      };

      audio.onerror = () => {
        setPlayingAudioId(null);
        audioInstanceRef.current = null;
        alert("Ovoz faylini tinglashda xatolik yuz berdi.");
      };

      audio.play();
    } catch (err) {
      console.error(err);
      setPlayingAudioId(null);
    }
  };

  const startRecording = async (questionId: string, type: "question" | "correct") => {
    try {
      if (activeRecording) {
        stopRecording();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          const qIdx = quiz.questions.findIndex((x) => x.id === questionId);
          if (qIdx !== -1) {
            const q = quiz.questions[qIdx];
            if (type === "question") {
              updateQuestion(qIdx, { ...q, audioBase64: base64data });
            } else {
              updateQuestion(qIdx, { ...q, correctAudioBase64: base64data });
            }
          }
        };

        // Stop all media tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      const startTime = Date.now();

      setActiveRecording({
        questionId,
        type,
        isRecording: true,
        duration: 0,
      });

      recordingIntervalRef.current = setInterval(() => {
        setActiveRecording((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            duration: Math.floor((Date.now() - startTime) / 1000),
          };
        });
      }, 1000);
    } catch (err) {
      console.error("Mikrofon yozishda xatolik:", err);
      alert("Mikrofonga ruxsat berishda xatolik yuz berdi. Iltimos, qurilmangiz sozlamalarida mikrofonga ruxsat berilganini tekshiring.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setActiveRecording(null);
  };

  const generateSingleAudio = async (qIndex: number, q: Question, type: "question" | "correct") => {
    setGeneratingAudioId(`${q.id}-${type}`);
    try {
      if (type === "question") {
        const letters = ["A", "B", "C", "D"];
        const optionsText = q.options.map((opt, idx) => `${letters[idx]}) ${opt}`).join(". ");
        const textToRead = `${q.text}. Variantlar: ${optionsText}.`;
        const audioBase64 = await generateTTS(textToRead, quiz.voiceName || "Kore");
        if (audioBase64) {
          updateQuestion(qIndex, { ...q, audioBase64 });
        } else {
          alert("Ovoz yaratishda xatolik yuz berdi.");
        }
      } else {
        const letters = ["A", "B", "C", "D"];
        const correctTextToRead = `To'g'ri javob: ${letters[q.correctOptionIndex]}, ${q.options[q.correctOptionIndex]}.`;
        const correctAudioBase64 = await generateTTS(correctTextToRead, quiz.voiceName || "Kore");
        if (correctAudioBase64) {
          updateQuestion(qIndex, { ...q, correctAudioBase64 });
        } else {
          alert("Ovoz yaratishda xatolik yuz berdi.");
        }
      }
    } catch (ttsErr: any) {
      if (ttsErr.message === "QUOTA_EXCEEDED") {
        alert("AI Ovoz yaratish uchun API kvotasi tugadi. Boshqa vaqt qayta urinib ko'ring.");
      } else {
        alert(`Ovoz yaratishda xatolik: ${ttsErr.message || ttsErr}`);
        console.error(ttsErr);
      }
    }
    setGeneratingAudioId(null);
  };

  const updateQuestion = (index: number, updated: Question) => {
    const newQs = [...quiz.questions];
    newQs[index] = updated;
    setQuiz({ ...quiz, questions: newQs });
  };

  const addQuestion = () => {
    setQuiz({
      ...quiz,
      questions: [
        ...quiz.questions,
        {
          id: Math.random().toString(36).substr(2, 9),
          text: "Yangi savol?",
          options: ["Variant A", "Variant B", "Variant C"],
          correctOptionIndex: 0,
          backgroundImage:
            "https://images.unsplash.com/photo-1505506874110-6a7a48e14c49?q=80&w=1000&auto=format&fit=crop",
        },
      ],
    });
  };

  const removeQuestion = (index: number) => {
    const newQs = quiz.questions.filter((_, i) => i !== index);
    setQuiz({ ...quiz, questions: newQs });
  };

  const moveQuestionUp = (index: number) => {
    if (index === 0) return;
    const newQs = [...quiz.questions];
    const temp = newQs[index];
    newQs[index] = newQs[index - 1];
    newQs[index - 1] = temp;
    setQuiz({ ...quiz, questions: newQs });
  };

  const moveQuestionDown = (index: number) => {
    if (index === quiz.questions.length - 1) return;
    const newQs = [...quiz.questions];
    const temp = newQs[index];
    newQs[index] = newQs[index + 1];
    newQs[index + 1] = temp;
    setQuiz({ ...quiz, questions: newQs });
  };

  const handleImageUpload = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        updateQuestion(index, { ...quiz.questions[index], backgroundImage: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateAudio = async (qIndex: number, q: Question) => {
    setGeneratingAudioId(q.id);
    const letters = ['A', 'B', 'C', 'D'];
    const optionsText = q.options.map((opt, idx) => `${letters[idx]}) ${opt}`).join(". ");
    const textToRead = `${q.text}. Variantlar: ${optionsText}.`;
    
    try {
      const audioBase64 = await generateTTS(textToRead, quiz.voiceName || "Kore");
      await new Promise(r => setTimeout(r, 4000));
      
      const correctTextToRead = `To'g'ri javob: ${letters[q.correctOptionIndex]}, ${q.options[q.correctOptionIndex]}.`;
      const correctAudioBase64 = await generateTTS(correctTextToRead, quiz.voiceName || "Kore");
      
      if (audioBase64) {
        updateQuestion(qIndex, { ...q, audioBase64, correctAudioBase64: correctAudioBase64 || undefined });
      } else {
        alert("Ovoz yaratishda xatolik yuz berdi.");
      }
    } catch (ttsErr: any) {
      if (ttsErr.message === "QUOTA_EXCEEDED") {
        alert("AI Ovoz yaratish uchun API kvotasi tugadi. Boshqa vaqt qayta urinib ko'ring.");
      } else {
        alert("Ovoz yaratishda xatolik yuz berdi.");
        console.error(ttsErr);
      }
    }
    setGeneratingAudioId(null);
  };

  const handleAIGenerate = async () => {
    if (!aiTopic) return;

    const isLimitReached = userProfile && (
      (userProfile.role === "free" && userProfile.videosCreated >= 1) ||
      (userProfile.role === "pack10" && userProfile.videosCreated >= 10)
    );

    if (isLimitReached) {
      onOpenPaywall();
      return;
    }

    setIsGeneratingAI(true);
    
    try {
      const newQuestions = await generateQuizAI(aiTopic, selectedLanguage);
      if (newQuestions && newQuestions.length > 0) {
        // Avval savollarni ekranga chiqaramiz
        setQuiz({ ...quiz, title: aiTopic, questions: newQuestions, language: selectedLanguage });
        
        // Keyin har bir savol uchun avtomatik ovoz yaratamiz
        let updatedQuestions = [...newQuestions];
        try {
          for (let i = 0; i < updatedQuestions.length; i++) {
            const q = updatedQuestions[i];
            setGeneratingAudioId(q.id);
            const letters = ['A', 'B', 'C', 'D'];
            const optionsText = q.options.map((opt, idx) => `${letters[idx]}) ${opt}`).join(". ");
            const textToRead = `${q.text}. Variantlar: ${optionsText}.`;
            const audioBase64 = await generateTTS(textToRead, quiz.voiceName || "Kore");
            await new Promise(r => setTimeout(r, 4000));
            
            const correctTextToRead = `To'g'ri javob: ${letters[q.correctOptionIndex]}, ${q.options[q.correctOptionIndex]}.`;
            const correctAudioBase64 = await generateTTS(correctTextToRead, quiz.voiceName || "Kore");
            await new Promise(r => setTimeout(r, 4000));
            
            if (audioBase64) {
              updatedQuestions[i] = { ...updatedQuestions[i], audioBase64, correctAudioBase64: correctAudioBase64 || undefined };
              setQuiz({ ...quiz, title: aiTopic, questions: [...updatedQuestions], language: selectedLanguage });
            }
          }
        } catch (ttsErr: any) {
          if (ttsErr.message === "QUOTA_EXCEEDED") {
            alert("AI Ovoz yaratish uchun API kvotasi tugadi. Siz audio yaratilmagan savollarni o'zingiz matn sifatida qoldirishingiz mumkin.");
          } else {
            console.error(ttsErr);
          }
        }
        setGeneratingAudioId(null);
        setAiTopic('');
      } else {
        alert("AI yordamida savollar yaratishda xatolik yuz berdi.");
      }
    } catch (err) {
      console.error(err);
      alert("Xatolik yuz berdi.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleBulkImageGenerate = async () => {
    if (!quiz.questions || quiz.questions.length === 0) {
      alert("Avval test savollarini qo'shing yoki yaratib oling.");
      return;
    }
    setIsGeneratingBulkImages(true);
    try {
      const keywords = await analyzeQuestionsForImages(quiz.questions);
      if (keywords && keywords.length > 0) {
        const updatedQuestions = await Promise.all(
          quiz.questions.map(async (q, idx) => {
            const keyword = keywords[idx] || "nature";
            const backgroundImage = await getUnsplashImageForKeyword(keyword);
            return {
              ...q,
              backgroundImage
            };
          })
        );
        setQuiz({ ...quiz, questions: updatedQuestions });
        alert("Barcha savollar uchun mos rasmlar muvaffaqiyatli qidirildi va o'rnatildi!");
      } else {
        alert("AI orqali kalit so'zlarni tahlil qilishda xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.");
      }
    } catch (err) {
      console.error(err);
      alert("Rasmlarni ommaviy qidirishda kutilmagan xatolik yuz berdi.");
    } finally {
      setIsGeneratingBulkImages(false);
    }
  };

  const handleBulkVoiceGenerate = async () => {
    if (!quiz.questions || quiz.questions.length === 0) {
      alert("Avval test savollarini qo'shing yoki yaratib oling.");
      return;
    }
    setIsGeneratingBulkVoices(true);
    let updatedQuestions = [...quiz.questions];
    try {
      for (let i = 0; i < updatedQuestions.length; i++) {
        const q = updatedQuestions[i];
        setGeneratingAudioId(q.id);
        const letters = ['A', 'B', 'C', 'D'];
        const optionsText = q.options.map((opt, idx) => `${letters[idx]}) ${opt}`).join(". ");
        const textToRead = `${q.text}. Variantlar: ${optionsText}.`;
        
        const audioBase64 = await generateTTS(textToRead, quiz.voiceName || "Kore");
        await new Promise(r => setTimeout(r, 4000));
        
        const correctTextToRead = `To'g'ri javob: ${letters[q.correctOptionIndex]}, ${q.options[q.correctOptionIndex]}.`;
        const correctAudioBase64 = await generateTTS(correctTextToRead, quiz.voiceName || "Kore");
        await new Promise(r => setTimeout(r, 4000));
        
        if (audioBase64) {
          updatedQuestions[i] = { 
            ...updatedQuestions[i], 
            audioBase64, 
            correctAudioBase64: correctAudioBase64 || undefined 
          };
          setQuiz({ ...quiz, questions: [...updatedQuestions] });
        }
      }
      alert("Barcha savollar uchun ovozlar muvaffaqiyatli yaratildi va o'rnatildi!");
    } catch (ttsErr: any) {
      if (ttsErr.message === "QUOTA_EXCEEDED") {
        alert("AI Ovoz yaratish uchun API kvotasi tugadi. Boshqa vaqt qayta urinib ko'ring.");
      } else {
        alert("Ovoz yaratishda xatolik yuz berdi.");
        console.error(ttsErr);
      }
    } finally {
      setGeneratingAudioId(null);
      setIsGeneratingBulkVoices(false);
    }
  };

  const handleExport = async () => {
    const isLimitReached = userProfile && (
      (userProfile.role === "free" && userProfile.videosCreated >= 1) ||
      (userProfile.role === "pack10" && userProfile.videosCreated >= 10)
    );

    if (isLimitReached) {
      onOpenPaywall();
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    
    try {
      const quizToRender = {
        ...quiz,
        watermark: userProfile?.role === "premium" ? quiz.watermark : "@QuizVideo",
      };
      const renderer = new QuizRenderer(quizToRender);
      renderer.onProgress = (p) => setExportProgress(p);
      renderer.onComplete = async (url, extension) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${quiz.title || 'quiz'}.${extension}`;
        a.click();
        setIsExporting(false);

        if (user && user.uid !== "guest") {
          try {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
              videosCreated: increment(1)
            });
          } catch (err) {
            console.error("Failed to increment videosCreated:", err);
          }
        } else {
          const currentCount = parseInt(localStorage.getItem("guest_videos_created") || "0", 10);
          localStorage.setItem("guest_videos_created", (currentCount + 1).toString());
          if (onVideoCreated) {
            onVideoCreated();
          }
        }
      };
      await renderer.start();
    } catch (err) {
      console.error(err);
      alert("Video yaratishda xatolik yuz berdi.");
      setIsExporting(false);
    }
  };

  const handleJSONExport = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(quiz, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      const fileName = `${quiz.title.toLowerCase().replace(/[^a-z0-9]/g, "_") || "quiz"}_test.json`;
      downloadAnchor.setAttribute("download", fileName);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error(err);
      alert("JSON eksport qilishda xatolik yuz berdi.");
    }
  };

  const handleJSONImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        let importedQuiz: Partial<Quiz> = {};

        if (Array.isArray(parsed)) {
          importedQuiz = {
            title: "Import qilingan test",
            questions: parsed,
          };
        } else if (parsed && typeof parsed === "object") {
          importedQuiz = parsed;
        } else {
          throw new Error("Noto'g'ri JSON formati");
        }

        if (!importedQuiz.questions || !Array.isArray(importedQuiz.questions)) {
          throw new Error("Test savollari topilmadi");
        }

        const validatedQuestions: Question[] = importedQuiz.questions.map((q: any, idx: number) => {
          if (!q.text) {
            throw new Error(`${idx + 1}-savol matni bo'sh bo'lishi mumkin emas`);
          }
          if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
            throw new Error(`${idx + 1}-savol kamida 2 ta variantga ega bo'lishi kerak`);
          }

          const correctOptionIndex = typeof q.correctOptionIndex === 'number' 
            ? q.correctOptionIndex 
            : 0;

          return {
            id: q.id || Math.random().toString(36).substr(2, 9),
            text: q.text,
            options: q.options,
            correctOptionIndex: correctOptionIndex,
            backgroundImage: q.backgroundImage || "https://images.unsplash.com/photo-1505506874110-6a7a48e14c49?q=80&w=1000&auto=format&fit=crop",
            audioBase64: q.audioBase64,
            correctAudioBase64: q.correctAudioBase64,
          };
        });

        const newQuiz: Quiz = {
          title: importedQuiz.title || "Yangi test",
          voiceName: importedQuiz.voiceName || quiz.voiceName || "Kore",
          watermark: importedQuiz.watermark || quiz.watermark || "",
          themeColor: importedQuiz.themeColor || quiz.themeColor || "emerald",
          themePreset: importedQuiz.themePreset || quiz.themePreset || "default",
          timerStyle: importedQuiz.timerStyle || quiz.timerStyle || "line",
          transitionEffect: importedQuiz.transitionEffect || quiz.transitionEffect || "slide",
          bgmEnabled: importedQuiz.bgmEnabled !== undefined ? importedQuiz.bgmEnabled : (quiz.bgmEnabled || false),
          bgmType: importedQuiz.bgmType || quiz.bgmType || "calm",
          timerDuration: importedQuiz.timerDuration || quiz.timerDuration || 5,
          questions: validatedQuestions,
          language: importedQuiz.language || quiz.language || "uz",
        };

        setQuiz(newQuiz);
        setSelectedLanguage(newQuiz.language || "uz");
        alert("Test muvaffaqiyatli import qilindi!");
      } catch (err: any) {
        alert(`Import qilishda xatolik: ${err.message || err}`);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const downloadSampleTemplate = () => {
    const sample = {
      title: "Namuna Test",
      themeColor: "emerald",
      bgmEnabled: true,
      bgmType: "calm",
      timerDuration: 5,
      watermark: "@myusername",
      questions: [
        {
          text: "O'zbekiston Respublikasining poytaxti qaysi shahar?",
          options: ["Toshkent", "Samarqand", "Buxoro", "Xiva"],
          correctOptionIndex: 0,
          backgroundImage: "https://images.unsplash.com/photo-1505506874110-6a7a48e14c49?q=80&w=1000&auto=format&fit=crop"
        },
        {
          text: "Yer yuzida nechta okean bor?",
          options: ["3 ta", "4 ta", "5 ta", "6 ta"],
          correctOptionIndex: 2,
          backgroundImage: "https://images.unsplash.com/photo-1505506874110-6a7a48e14c49?q=80&w=1000&auto=format&fit=crop"
        }
      ]
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sample, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "quiz_namuna_shablon.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 pb-24">
      {isExporting && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-6 text-center">
          <Loader2 size={64} className="animate-spin text-emerald-500 mb-6" />
          <h2 className="text-3xl font-bold mb-4">Video tayyorlanmoqda...</h2>
          <p className="text-xl text-red-400 font-semibold max-w-lg mb-8 animate-pulse">
            Iltimos, sahifani yopmang yoki boshqa oynaga o'tmang! Aks holda videoda ovoz va tasvir mos kelmay qolishi mumkin.
          </p>
          <div className="w-full max-w-md bg-neutral-800 rounded-full h-4 overflow-hidden border border-neutral-700">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
              style={{ width: `${exportProgress * 100}%` }}
            />
          </div>
          <p className="mt-4 font-mono text-lg">{Math.round(exportProgress * 100)}%</p>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-emerald-400 via-emerald-200 to-cyan-400 drop-shadow-sm mb-2">
          Quiz Video Tayyorlash
        </h1>
        <p className="text-neutral-400 text-base font-medium">
          3 qadam: savollar tayyorlang → tekshiring → videoni yuklab oling
        </p>
      </div>

      {/* QADAM 1: AI bilan savollar tayyorlash */}
      <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden mb-5">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full" />
        <div className="flex items-center gap-3 mb-2 relative z-10">
          <div className="w-8 h-8 shrink-0 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-display font-black text-sm">
            1
          </div>
          <h2 className="text-xl font-display font-bold text-indigo-100 tracking-tight">Savollar tayyorlang</h2>
        </div>
        <p className="text-sm text-indigo-200/60 mb-5 relative z-10 leading-relaxed">
          Mavzuni yozing — AI 5 ta savolni rasmlari bilan avtomatik tuzib beradi. Yoki pastda savollarni qo'lda kiriting.
        </p>
        <div className="flex flex-col md:flex-row gap-3 relative z-10">
          <input
            type="text"
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder="Mavzuni kiriting (masalan: Tarix, Kosmos, Sport...)"
            className="flex-1 bg-black/40 backdrop-blur-md border border-indigo-500/30 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-indigo-200/30 font-semibold"
            onKeyDown={(e) => e.key === 'Enter' && handleAIGenerate()}
          />
          <div className="relative md:w-52 shrink-0">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as any)}
              className="w-full bg-black/40 backdrop-blur-md border border-indigo-500/30 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer font-semibold"
            >
              <option value="uz" className="bg-neutral-900">🇺🇿 O'zbek tili</option>
              <option value="en" className="bg-neutral-900">🇺🇸 Ingliz tili</option>
              <option value="ru" className="bg-neutral-900">🇷🇺 Rus tili</option>
              <option value="tr" className="bg-neutral-900">🇹🇷 Turk tili</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400">
              <ArrowDown size={16} />
            </div>
          </div>
          <button
            onClick={handleAIGenerate}
            disabled={isGeneratingAI || !aiTopic}
            className="md:w-auto shrink-0 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 text-white px-6 py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/20 border border-white/10 border-t-white/20 cursor-pointer whitespace-nowrap"
          >
            {isGeneratingAI ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
            {isGeneratingAI ? (generatingAudioId ? "Ovozlar yaratilmoqda..." : "Savollar tuzilmoqda...") : "AI bilan yaratish"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 mt-4 relative z-10 text-xs text-indigo-200/50">
          <span className="mr-1">Tayyor testingiz bormi?</span>
          <label className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 cursor-pointer font-semibold transition-colors">
            <FileUp size={13} />
            Import (.json)
            <input type="file" accept=".json" className="hidden" onChange={handleJSONImport} />
          </label>
          <span className="mx-1.5 text-indigo-200/20">•</span>
          <button
            type="button"
            onClick={handleJSONExport}
            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold transition-colors cursor-pointer"
          >
            <FileDown size={13} />
            Eksport
          </button>
          <span className="mx-1.5 text-indigo-200/20">•</span>
          <button
            type="button"
            onClick={downloadSampleTemplate}
            className="text-indigo-300/60 hover:text-indigo-200 underline decoration-dotted transition-colors cursor-pointer"
          >
            Shablon namunasi
          </button>
        </div>
      </div>

      {/* Sozlamalar (yig'iladigan) */}
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl mb-10 overflow-hidden transition-all duration-300">
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2.5 rounded-xl text-white shadow-inner">
              <Settings2 size={20} />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-display font-bold text-white tracking-tight">Video sozlamalari</h2>
              <p className="text-xs text-neutral-400 font-medium">Suxandon ovozi, taymer, dizayn mavzusi, musiqa</p>
            </div>
          </div>
          <ArrowDown
            size={18}
            className={`text-neutral-400 transition-transform duration-300 ${showSettings ? "rotate-180" : ""}`}
          />
        </button>
        {showSettings && (
          <div className="p-6 pt-2 space-y-4 border-t border-white/5">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2 flex items-center justify-between">
                <span>Suxandon ovozi (AI)</span>
                {userProfile?.role !== "premium" && (
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-bold uppercase tracking-wider">
                    🔒 Premium
                  </span>
                )}
              </label>
              <div className="relative">
                <select
                  value={quiz.voiceName || "Kore"}
                  onChange={(e) => {
                    const selectedVal = e.target.value;
                    if (selectedVal !== "Kore" && userProfile?.role !== "premium") {
                      onOpenPaywall();
                      return;
                    }
                    setQuiz({ ...quiz, voiceName: selectedVal });
                  }}
                  className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="Kore" className="bg-neutral-900">Kore (Ayol, sokin)</option>
                  <option value="Aoede" className="bg-neutral-900">Aoede (Ayol, jarangdor) {userProfile?.role !== "premium" ? "🔒" : ""}</option>
                  <option value="Puck" className="bg-neutral-900">Puck (Erkak, energiya) {userProfile?.role !== "premium" ? "🔒" : ""}</option>
                  <option value="Charon" className="bg-neutral-900">Charon (Erkak, jiddiy) {userProfile?.role !== "premium" ? "🔒" : ""}</option>
                  <option value="Fenrir" className="bg-neutral-900">Fenrir (Erkak, chuqur) {userProfile?.role !== "premium" ? "🔒" : ""}</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                  <ArrowDown size={16} />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                O'ylash vaqti (soniya)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={quiz.timerDuration || 5}
                onChange={(e) => setQuiz({ ...quiz, timerDuration: parseInt(e.target.value) || 5 })}
                className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono mb-4"
              />

              <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wider">
                Taymer uslubi
              </label>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(['line', 'circular', 'digital'] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setQuiz({ ...quiz, timerStyle: style })}
                    className={`py-2.5 px-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      (quiz.timerStyle || 'line') === style
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                        : "bg-black/30 border-white/5 text-neutral-400 hover:text-white hover:border-white/10"
                    }`}
                  >
                    {style === 'line' ? 'Chiziqli' : style === 'circular' ? 'Aylanma' : 'Retro'}
                  </button>
                ))}
              </div>

              <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wider">
                O'tish effekti
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['slide', 'zoom', 'fade'] as const).map((effect) => (
                  <button
                    key={effect}
                    type="button"
                    onClick={() => setQuiz({ ...quiz, transitionEffect: effect })}
                    className={`py-2.5 px-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      (quiz.transitionEffect || 'slide') === effect
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                        : "bg-black/30 border-white/5 text-neutral-400 hover:text-white hover:border-white/10"
                    }`}
                  >
                    {effect === 'slide' ? 'Slide' : effect === 'zoom' ? 'Zoom' : 'Fade'}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <label className="block text-sm font-medium text-neutral-300 mb-2 flex items-center justify-between">
                <span>Premium Mavzular</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest font-black">PREMIUM</span>
              </label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { id: 'default', name: 'Standart', desc: 'Minimal/Klassik', premium: false },
                  { id: 'cyberpunk', name: 'Cyberpunk', desc: 'Binafsha/Neon', premium: true },
                  { id: 'retro', name: 'Retro Arcade', desc: 'Sariq/Piksel', premium: true },
                  { id: 'sunset', name: 'Sunset', desc: 'Iliq/Gradient', premium: false },
                  { id: 'chalk', name: 'Chalk Board', desc: 'Doska/Bo\'r', premium: true }
                ].map((preset) => {
                  const isLocked = preset.premium && userProfile?.role !== "premium";
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        if (isLocked) {
                          onOpenPaywall();
                          return;
                        }
                        setQuiz({ ...quiz, themePreset: preset.id as any });
                      }}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between relative ${
                        isLocked ? "opacity-50 hover:bg-black/40" : ""
                      } ${
                        (quiz.themePreset || 'default') === preset.id
                          ? "bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/20"
                          : "bg-black/30 border-white/5 hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full gap-1">
                        <span className={`text-xs font-extrabold block truncate ${
                          (quiz.themePreset || 'default') === preset.id ? 'text-emerald-300' : 'text-neutral-200'
                        }`}>{preset.name}</span>
                        {isLocked && <span className="text-xs text-amber-400">🔒</span>}
                      </div>
                      <span className="text-[10px] text-neutral-400 block truncate mt-0.5">{preset.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Mavzu Rangi
              </label>
              <select
                value={quiz.themeColor || "emerald"}
                onChange={(e) => setQuiz({ ...quiz, themeColor: e.target.value as any })}
                className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
              >
                <option value="emerald" className="bg-neutral-900">Yashil (Emerald)</option>
                <option value="cyan" className="bg-neutral-900">Havorang (Cyan)</option>
                <option value="violet" className="bg-neutral-900">Siyohrang (Violet)</option>
                <option value="rose" className="bg-neutral-900">Pushti (Rose)</option>
                <option value="amber" className="bg-neutral-900">Sariq (Amber)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2 flex items-center justify-between">
                <span>Watermark (@username)</span>
                {userProfile?.role !== "premium" && (
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1 font-bold uppercase tracking-wider">
                    🔒 Premium
                  </span>
                )}
              </label>
              <input
                type="text"
                placeholder="@TarixQuiz"
                readOnly={userProfile?.role !== "premium"}
                onClick={() => {
                  if (userProfile?.role !== "premium") {
                    onOpenPaywall();
                  }
                }}
                value={userProfile?.role === "premium" ? (quiz.watermark || "") : "@QuizVideo"}
                onChange={(e) => {
                  if (userProfile?.role !== "premium") {
                    onOpenPaywall();
                    return;
                  }
                  setQuiz({ ...quiz, watermark: e.target.value });
                }}
                className={`w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                  userProfile?.role !== "premium" ? "opacity-50 cursor-pointer select-none bg-slate-950/50" : ""
                }`}
              />
              {userProfile?.role !== "premium" && (
                <p className="text-[10px] text-amber-400/80 mt-1.5 font-medium leading-relaxed">
                  * Bepul va oddiy tariflarda suv belgisi majburiy bo'lib, uni o'chirish faqat premium foydalanuvchilar uchun ruxsat etiladi.
                </p>
              )}
            </div>

            <label className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
              <input
                type="checkbox"
                checked={quiz.bgmEnabled || false}
                onChange={(e) => setQuiz({ ...quiz, bgmEnabled: e.target.checked })}
                className="w-5 h-5 rounded border-white/20 bg-black/50 text-emerald-500 focus:ring-emerald-500/50 focus:ring-offset-0"
              />
              <span className="text-sm font-medium text-neutral-200">Fon musiqasini yoqish (BGM)</span>
            </label>

            {quiz.bgmEnabled && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wider">
                  Musiqa uslubi (BGM Style)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['calm', 'happy', 'tense'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setQuiz({ ...quiz, bgmType: style })}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold capitalize transition-all border ${
                        (quiz.bgmType || 'calm') === style
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm"
                          : "bg-black/30 border-white/5 text-neutral-400 hover:text-white hover:border-white/10"
                      }`}
                    >
                      {style === 'calm' ? 'Sokin' : style === 'happy' ? 'Quvnoq' : 'Hayajonli'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QADAM 2: Savollarni tekshirish */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 shrink-0 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-display font-black text-sm">
            2
          </div>
          <h2 className="text-xl font-display font-bold text-white tracking-tight">Savollarni tekshiring</h2>
          <span className="text-xs font-bold bg-white/5 border border-white/10 text-neutral-300 px-2.5 py-1 rounded-full">
            {quiz.questions.length} ta
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleBulkImageGenerate}
            disabled={isGeneratingBulkImages || quiz.questions.length === 0}
            title="AI barcha savollarga mos rasm topib qo'yadi"
            className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-xs font-bold px-3.5 py-2 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
          >
            {isGeneratingBulkImages ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
            {isGeneratingBulkImages ? "Tahlil..." : "Barcha rasmlar (AI)"}
          </button>
          <button
            onClick={handleBulkVoiceGenerate}
            disabled={isGeneratingBulkVoices || quiz.questions.length === 0}
            title="AI barcha savollar va javoblar uchun ovoz yaratadi"
            className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-xs font-bold px-3.5 py-2 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
          >
            {isGeneratingBulkVoices ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
            {isGeneratingBulkVoices ? "Yaratilmoqda..." : "Barcha ovozlar (AI)"}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {quiz.questions.map((q, qIndex) => (
          <div
            key={q.id}
            className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl transition-all duration-300 hover:bg-white/[0.07] hover:border-white/20"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-300 w-10 h-10 rounded-2xl flex items-center justify-center font-display font-bold text-lg shadow-inner">
                  {qIndex + 1}
                </div>
                <h3 className="text-2xl font-display font-bold tracking-tight">Savol</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => moveQuestionUp(qIndex)}
                  disabled={qIndex === 0}
                  className="text-neutral-400 hover:text-white transition-all p-2.5 hover:bg-white/10 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ArrowUp size={20} />
                </button>
                <button
                  onClick={() => moveQuestionDown(qIndex)}
                  disabled={qIndex === quiz.questions.length - 1}
                  className="text-neutral-400 hover:text-white transition-all p-2.5 hover:bg-white/10 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ArrowDown size={20} />
                </button>
                <button
                  onClick={() => removeQuestion(qIndex)}
                  className="text-neutral-400 hover:text-red-400 transition-all p-2.5 hover:bg-red-500/20 rounded-xl ml-2"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-7">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Savol matni
                </label>
                <input
                  type="text"
                  value={q.text}
                  onChange={(e) =>
                    updateQuestion(qIndex, { ...q, text: e.target.value })
                  }
                  className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3.5 text-white font-medium focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-neutral-600"
                  placeholder="Masalan: Amir Temur davlatiga qaysi yilda asos solingan?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-3">
                  Variantlar (To'g'ri javobni belgilang)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {q.options.map((opt, optIndex) => (
                    <div key={optIndex} className="relative group flex items-center">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center z-10 bg-black/40 rounded-full p-0.5">
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={q.correctOptionIndex === optIndex}
                          onChange={() =>
                            updateQuestion(qIndex, {
                              ...q,
                              correctOptionIndex: optIndex,
                            })
                          }
                          className="w-4 h-4 accent-emerald-500 cursor-pointer opacity-0 absolute"
                        />
                        <div className={`w-4 h-4 rounded-full border border-white/30 flex items-center justify-center transition-colors ${q.correctOptionIndex === optIndex ? 'border-emerald-500 bg-emerald-500' : 'bg-transparent'}`}>
                          {q.correctOptionIndex === optIndex && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...q.options];
                          newOpts[optIndex] = e.target.value;
                          updateQuestion(qIndex, { ...q, options: newOpts });
                        }}
                        className={`w-full bg-black/40 backdrop-blur-md border rounded-xl pl-12 pr-12 py-3.5 text-white font-medium focus:outline-none transition-all placeholder:text-neutral-600 ${
                          q.correctOptionIndex === optIndex
                            ? "border-emerald-500/50 bg-emerald-500/10"
                            : "border-white/10 focus:border-white/30 hover:border-white/20"
                        }`}
                        placeholder={`Variant ${optIndex + 1}`}
                      />
                      {q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newOpts = q.options.filter((_, idx) => idx !== optIndex);
                            let newCorrectIdx = q.correctOptionIndex;
                            if (q.correctOptionIndex === optIndex) {
                              newCorrectIdx = 0;
                            } else if (q.correctOptionIndex > optIndex) {
                              newCorrectIdx -= 1;
                            }
                            updateQuestion(qIndex, {
                              ...q,
                              options: newOpts,
                              correctOptionIndex: newCorrectIdx,
                            });
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-red-400 p-1.5 hover:bg-white/5 rounded-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Variantni o'chirish"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  
                  {q.options.length < 4 && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextLetter = ['A', 'B', 'C', 'D'][q.options.length];
                        const newOpts = [...q.options, `Variant ${nextLetter}`];
                        updateQuestion(qIndex, { ...q, options: newOpts });
                      }}
                      className="border border-dashed border-white/20 hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:text-white text-neutral-400 rounded-xl p-3.5 flex items-center justify-center gap-2 font-semibold transition-all text-sm h-full min-h-[54px]"
                    >
                      <Plus size={16} />
                      Variant qo'shish
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Orqa fon rasmi (URL, fayl yuklash yoki qidirish)
                </label>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="relative flex-1 w-full flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <ImageIcon
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500"
                          size={18}
                        />
                        <input
                          type="text"
                          value={q.backgroundImage}
                          onChange={(e) =>
                            updateQuestion(qIndex, {
                              ...q,
                              backgroundImage: e.target.value,
                            })
                          }
                          className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-neutral-600"
                          placeholder="Orqa fon rasm URL manzili..."
                        />
                      </div>
                      <label className="cursor-pointer bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-sm shrink-0" title="Rasm yuklash">
                        <Upload size={18} className="text-emerald-400" />
                        <span className="text-xs font-semibold">Komp'yuterdan yuklash</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(qIndex, e)}
                        />
                      </label>
                    </div>

                    {/* Fast Unsplash Image Searcher */}
                    <div className="flex gap-2 w-full">
                      <input
                        type="text"
                        placeholder="Mavzuga doir kalit so'z (masalan: space, history, nature)..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500/50"
                        id={`search-kw-${q.id}`}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const input = document.getElementById(`search-kw-${q.id}`) as HTMLInputElement;
                            if (input && input.value.trim()) {
                              const btn = e.currentTarget.nextElementSibling as HTMLButtonElement;
                              if (btn) btn.disabled = true;
                              const prevText = btn ? btn.textContent : "";
                              if (btn) btn.textContent = "...";
                              try {
                                const backgroundImage = await getUnsplashImageForKeyword(input.value.trim());
                                updateQuestion(qIndex, {
                                  ...q,
                                  backgroundImage
                                });
                              } catch (err) {
                                console.error(err);
                              } finally {
                                if (btn) {
                                  btn.disabled = false;
                                  btn.textContent = prevText;
                                }
                              }
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={async (e) => {
                          const input = document.getElementById(`search-kw-${q.id}`) as HTMLInputElement;
                          if (input && input.value.trim()) {
                            const btn = e.currentTarget;
                            btn.disabled = true;
                            const prevText = btn.textContent;
                            btn.textContent = "...";
                            try {
                              const backgroundImage = await getUnsplashImageForKeyword(input.value.trim());
                              updateQuestion(qIndex, {
                                ...q,
                                backgroundImage
                              });
                            } catch (err) {
                              console.error(err);
                            } finally {
                              btn.disabled = false;
                              btn.textContent = prevText;
                            }
                          } else {
                            alert("Iltimos, kalit so'z kiriting.");
                          }
                        }}
                        className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0 disabled:opacity-50 cursor-pointer"
                      >
                        Rasmni topish
                      </button>
                    </div>
                  </div>
                  {q.backgroundImage && (
                    <div className="flex flex-col items-center gap-2 shrink-0 w-full sm:w-auto">
                      <div className="w-full sm:w-28 h-40 sm:h-28 rounded-xl overflow-hidden border border-white/10 shadow-inner">
                        <img
                          src={q.backgroundImage}
                          alt="Background preview"
                          className="w-full h-full object-cover transition-transform hover:scale-110 duration-700"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updatedQuestions = quiz.questions.map((item) => ({
                            ...item,
                            backgroundImage: q.backgroundImage
                          }));
                          setQuiz({ ...quiz, questions: updatedQuestions });
                          alert("Ushbu fon rasmi barcha savollarga muvaffaqiyatli qo'llanildi!");
                        }}
                        className="text-[10px] w-full bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 py-1.5 rounded-lg transition-all font-semibold cursor-pointer text-center"
                      >
                        Barchasiga qo'llash
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 mt-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                    <Volume2 size={14} className="text-emerald-400 animate-pulse" />
                    Ovoz sozlamalari & Yozib olish
                  </h4>
                  
                  <button
                    type="button"
                    onClick={() => handleGenerateAudio(qIndex, q)}
                    disabled={generatingAudioId !== null}
                    className="flex items-center gap-2 text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40"
                    title="Savol va To'g'ri javob ovozlarini AI orqali birgalikda yaratish"
                  >
                    {generatingAudioId === q.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    Barcha ovozlarni yaratish (AI)
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Savol Audiosi Block */}
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-300">1. Savol va Variantlar</span>
                      {q.audioBase64 ? (
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Tayyor
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full">
                          Kiritilmagan
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {q.audioBase64 && (
                        <button
                          type="button"
                          onClick={() => playAudio(q.audioBase64!, `${q.id}-question`)}
                          className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                            playingAudioId === `${q.id}-question`
                              ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                              : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                          }`}
                          title="Tinglash"
                        >
                          {playingAudioId === `${q.id}-question` ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                      )}

                      {/* AI Generator for single */}
                      <button
                        type="button"
                        disabled={generatingAudioId !== null || activeRecording !== null}
                        onClick={() => generateSingleAudio(qIndex, q, "question")}
                        className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 text-xs py-2 px-3 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
                      >
                        {generatingAudioId === `${q.id}-question` ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Volume2 size={13} />
                        )}
                        AI Ovoz
                      </button>

                      {/* Voice Recorder for single */}
                      {activeRecording && activeRecording.questionId === q.id && activeRecording.type === "question" ? (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 bg-rose-500/20 border border-rose-500 text-rose-300 text-xs py-2 px-3 rounded-xl animate-pulse font-bold cursor-pointer"
                        >
                          <Square size={13} />
                          Stop ({activeRecording.duration}s)
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={activeRecording !== null || generatingAudioId !== null}
                          onClick={() => startRecording(q.id, "question")}
                          className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-xs py-2 px-3 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
                        >
                          <Mic size={13} />
                          Yozish
                        </button>
                      )}

                      {q.audioBase64 && (
                        <button
                          type="button"
                          onClick={() => updateQuestion(qIndex, { ...q, audioBase64: undefined })}
                          className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 transition-all cursor-pointer"
                          title="O'chirish"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* To'g'ri Javob Audiosi Block */}
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-300">2. To'g'ri javob matni</span>
                      {q.correctAudioBase64 ? (
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Tayyor
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full">
                          Kiritilmagan
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {q.correctAudioBase64 && (
                        <button
                          type="button"
                          onClick={() => playAudio(q.correctAudioBase64!, `${q.id}-correct`)}
                          className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                            playingAudioId === `${q.id}-correct`
                              ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                              : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                          }`}
                          title="Tinglash"
                        >
                          {playingAudioId === `${q.id}-correct` ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                      )}

                      {/* AI Generator for single */}
                      <button
                        type="button"
                        disabled={generatingAudioId !== null || activeRecording !== null}
                        onClick={() => generateSingleAudio(qIndex, q, "correct")}
                        className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 text-xs py-2 px-3 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
                      >
                        {generatingAudioId === `${q.id}-correct` ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Volume2 size={13} />
                        )}
                        AI Ovoz
                      </button>

                      {/* Voice Recorder for single */}
                      {activeRecording && activeRecording.questionId === q.id && activeRecording.type === "correct" ? (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 bg-rose-500/20 border border-rose-500 text-rose-300 text-xs py-2 px-3 rounded-xl animate-pulse font-bold cursor-pointer"
                        >
                          <Square size={13} />
                          Stop ({activeRecording.duration}s)
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={activeRecording !== null || generatingAudioId !== null}
                          onClick={() => startRecording(q.id, "correct")}
                          className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-xs py-2 px-3 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
                        >
                          <Mic size={13} />
                          Yozish
                        </button>
                      )}

                      {q.correctAudioBase64 && (
                        <button
                          type="button"
                          onClick={() => updateQuestion(qIndex, { ...q, correctAudioBase64: undefined })}
                          className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 transition-all cursor-pointer"
                          title="O'chirish"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addQuestion}
          className="w-full py-8 border-[1.5px] border-dashed border-white/20 rounded-3xl text-neutral-400 hover:text-white hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] transition-all flex items-center justify-center gap-3 font-display font-bold text-lg hover:scale-[1.01] active:scale-[0.99]"
        >
          <Plus size={24} />
          Yangi savol qo'shish
        </button>
      </div>

      {/* QADAM 3: Doimiy pastki harakat paneli */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-slate-950/85 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.4)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="hidden sm:flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-display font-black text-sm">
              3
            </div>
            <div className="flex flex-col text-xs leading-tight">
              <span className="font-bold text-white">{quiz.questions.length} ta savol</span>
              <span className="text-neutral-400">
                {quiz.questions.filter((q) => q.audioBase64).length}/{quiz.questions.length} ovoz tayyor
              </span>
            </div>
          </div>
          <div className="flex gap-2.5 flex-1 sm:flex-none justify-end">
            <button
              onClick={onPlay}
              disabled={isExporting || isGeneratingAI}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer"
            >
              <Play size={17} fill="currentColor" />
              Ko'rish
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || isGeneratingAI}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-900/30 border border-white/10 border-t-white/20 relative overflow-hidden cursor-pointer"
            >
              {isExporting ? (
                <>
                  <div className="absolute inset-0 bg-emerald-400/20" style={{ width: `${exportProgress * 100}%` }} />
                  <Loader2 size={17} className="animate-spin relative z-10" />
                  <span className="relative z-10">{Math.round(exportProgress * 100)}%</span>
                </>
              ) : (
                <>
                  <Download size={17} />
                  Video Yuklab Olish
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
