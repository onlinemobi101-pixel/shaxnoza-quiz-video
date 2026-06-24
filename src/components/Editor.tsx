import React, { useState, useEffect } from "react";
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
  Pause,
} from "lucide-react";
import { generateTTS, playPCM, stopPCM } from "../services/tts";
import { generateQuizAI } from "../services/ai";
import { QuizRenderer } from "../services/renderer";

interface EditorProps {
  quiz: Quiz;
  setQuiz: (quiz: Quiz) => void;
  onPlay: () => void;
}

export function Editor({ quiz, setQuiz, onPlay }: EditorProps) {
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(
    null,
  );
  const [aiTopic, setAiTopic] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stopPCM();
    };
  }, []);

  const handlePlayAudio = (id: string, base64: string) => {
    if (playingAudioId === id) {
      stopPCM();
      setPlayingAudioId(null);
    } else {
      stopPCM();
      setPlayingAudioId(id);
      playPCM(base64, 24000, () => {
        setPlayingAudioId(null);
      });
    }
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
          options: ["Variant A", "Variant B", "Variant C", "Variant D"],
          correctOptionIndex: 0,
          backgroundImage:
            "https://images.unsplash.com/photo-1505506874110-6a7a48e14c49?q=80&w=1000&auto=format&fit=crop",
          fact: "",
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
    const audioBase64 = await generateTTS(textToRead, quiz.voiceName || "Kore");
    
    let correctTextToRead = `To'g'ri javob: ${letters[q.correctOptionIndex]}, ${q.options[q.correctOptionIndex]}.`;
    if (q.fact) {
      correctTextToRead += ` Bilasizmi? ${q.fact}`;
    }
    const correctAudioBase64 = await generateTTS(correctTextToRead, quiz.voiceName || "Kore");
    
    if (audioBase64) {
      updateQuestion(qIndex, { ...q, audioBase64, correctAudioBase64: correctAudioBase64 || undefined });
    } else {
      alert("Ovoz yaratishda xatolik yuz berdi.");
    }
    setGeneratingAudioId(null);
  };

  const handleAIGenerate = async () => {
    if (!aiTopic) return;
    setIsGeneratingAI(true);
    
    try {
      const newQuestions = await generateQuizAI(aiTopic);
      if (newQuestions && newQuestions.length > 0) {
        // Avval savollarni ekranga chiqaramiz
        setQuiz({ ...quiz, title: aiTopic, questions: newQuestions });
        
        // Keyin har bir savol uchun avtomatik ovoz yaratamiz
        let updatedQuestions = [...newQuestions];
        for (let i = 0; i < updatedQuestions.length; i++) {
          const q = updatedQuestions[i];
          setGeneratingAudioId(q.id);
          const letters = ['A', 'B', 'C', 'D'];
          const optionsText = q.options.map((opt, idx) => `${letters[idx]}) ${opt}`).join(". ");
          const textToRead = `${q.text}. Variantlar: ${optionsText}.`;
          const audioBase64 = await generateTTS(textToRead, quiz.voiceName || "Kore");
          
          let correctTextToRead = `To'g'ri javob: ${letters[q.correctOptionIndex]}, ${q.options[q.correctOptionIndex]}.`;
          if (q.fact) {
            correctTextToRead += ` Bilasizmi? ${q.fact}`;
          }
          const correctAudioBase64 = await generateTTS(correctTextToRead, quiz.voiceName || "Kore");
          
          if (audioBase64) {
            updatedQuestions[i] = { ...updatedQuestions[i], audioBase64, correctAudioBase64: correctAudioBase64 || undefined };
            setQuiz({ ...quiz, title: aiTopic, questions: [...updatedQuestions] });
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

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      const renderer = new QuizRenderer(quiz);
      renderer.onProgress = (p) => setExportProgress(p);
      renderer.onComplete = (url, extension) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${quiz.title || 'quiz'}.${extension}`;
        a.click();
        setIsExporting(false);
      };
      await renderer.start();
    } catch (err) {
      console.error(err);
      alert("Video yaratishda xatolik yuz berdi.");
      setIsExporting(false);
    }
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl sm:text-5xl font-display font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-emerald-400 via-emerald-200 to-cyan-400 drop-shadow-sm mb-2">
            Quiz Video Tayyorlash
          </h1>
          <p className="text-neutral-400 text-lg font-medium">
            TikTok, Instagram Reels va YouTube Shorts uchun
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-4 sm:mt-0">
          <button
            onClick={handleExport}
            disabled={isExporting || isGeneratingAI}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 disabled:opacity-50 text-white px-6 py-3.5 rounded-2xl font-semibold transition-all shadow-lg relative overflow-hidden"
          >
            {isExporting ? (
              <>
                <div className="absolute inset-0 bg-emerald-600/30" style={{ width: `${exportProgress * 100}%` }} />
                <Loader2 size={20} className="animate-spin relative z-10" />
                <span className="relative z-10">Tayyorlanmoqda... {Math.round(exportProgress * 100)}%</span>
              </>
            ) : (
              <>
                <Download size={20} />
                Video Yuklab Olish
              </>
            )}
          </button>
          <button
            onClick={onPlay}
            disabled={isExporting || isGeneratingAI}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 disabled:opacity-50 text-white px-6 py-3.5 rounded-2xl font-semibold transition-all shadow-lg shadow-emerald-900/20 border border-white/10 border-t-white/20"
          >
            <Play size={20} fill="currentColor" />
            Ko'rish
          </button>
        </div>
      </div>

      {/* Settings & AI Generation Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {/* Settings */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl transition-all duration-300 hover:bg-white/[0.07] hover:border-white/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-white/10 p-2.5 rounded-xl text-white shadow-inner">
              <Settings2 size={24} />
            </div>
            <h2 className="text-xl font-display font-bold text-white tracking-tight">Sozlamalar</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Suxandon ovozi (AI)
              </label>
              <div className="relative">
                <select
                  value={quiz.voiceName || "Kore"}
                  onChange={(e) => setQuiz({ ...quiz, voiceName: e.target.value })}
                  className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="Kore" className="bg-neutral-900">Kore (Ayol, sokin)</option>
                  <option value="Zephyr" className="bg-neutral-900">Zephyr (Ayol/Erkak, jarangdor)</option>
                  <option value="Puck" className="bg-neutral-900">Puck (Erkak, energiya bilan)</option>
                  <option value="Charon" className="bg-neutral-900">Charon (Erkak, jiddiy)</option>
                  <option value="Fenrir" className="bg-neutral-900">Fenrir (Erkak, chuqur)</option>
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
                className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
              />
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
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Video Formati (Aspect Ratio)
              </label>
              <select
                value={quiz.aspectRatio || "9:16"}
                onChange={(e) => setQuiz({ ...quiz, aspectRatio: e.target.value as any })}
                className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
              >
                <option value="9:16" className="bg-neutral-900">9:16 (Tik Tok / Shorts / Reels)</option>
                <option value="16:9" className="bg-neutral-900">16:9 (YouTube Landscape)</option>
                <option value="1:1" className="bg-neutral-900">1:1 (Kvadrat / Instagram Post)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Watermark (@username)
              </label>
              <input
                type="text"
                placeholder="@TarixQuiz"
                value={quiz.watermark || ""}
                onChange={(e) => setQuiz({ ...quiz, watermark: e.target.value })}
                className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
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
              <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
                <label className="block text-sm font-medium text-neutral-300">
                  Shaxsiy fon musiqasi (MP3 / WAV)
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer flex-1 bg-black/40 hover:bg-black/60 text-neutral-300 border border-white/10 px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] overflow-hidden">
                    <Upload size={18} className="shrink-0" />
                    <span className="truncate text-sm font-medium">
                      {quiz.customBgmName || "Musiqa yuklash"}
                    </span>
                    <input
                      type="file"
                      accept="audio/mp3,audio/wav,audio/mpeg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result as string;
                            const base64Data = result.split(',')[1];
                            setQuiz({
                              ...quiz,
                              customBgmBase64: base64Data,
                              customBgmName: file.name
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {quiz.customBgmBase64 && (
                    <button
                      onClick={() => {
                        setQuiz({
                          ...quiz,
                          customBgmBase64: undefined,
                          customBgmName: undefined
                        });
                      }}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-3 rounded-xl transition-all shrink-0"
                      title="Musiqani o'chirish"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Generation */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl p-6 shadow-2xl transition-all duration-300 hover:border-indigo-500/30 hover:shadow-indigo-500/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full" />
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="bg-indigo-500/20 p-2.5 rounded-xl text-indigo-300 shadow-inner">
              <Sparkles size={24} />
            </div>
            <h2 className="text-xl font-display font-bold text-indigo-100 tracking-tight">AI bilan test yaratish</h2>
          </div>
          <div className="flex flex-col gap-4 relative z-10">
            <input
              type="text"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="Mavzuni kiriting (masalan: Tarix...)"
              className="w-full bg-black/40 backdrop-blur-md border border-indigo-500/30 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-indigo-200/30"
              onKeyDown={(e) => e.key === 'Enter' && handleAIGenerate()}
            />
            <button
              onClick={handleAIGenerate}
              disabled={isGeneratingAI || !aiTopic}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 text-white px-6 py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-900/20 border border-white/10 border-t-white/20"
            >
              {isGeneratingAI ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
              {isGeneratingAI ? (generatingAudioId ? "Ovozlar yaratilmoqda..." : "Savollar tuzilmoqda...") : "Yaratish"}
            </button>
          </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {q.options.map((opt, optIndex) => (
                    <div key={optIndex} className="relative group">
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
                        className={`w-full bg-black/40 backdrop-blur-md border rounded-xl pl-12 pr-4 py-3.5 text-white font-medium focus:outline-none transition-all placeholder:text-neutral-600 ${
                          q.correctOptionIndex === optIndex
                            ? "border-emerald-500/50 bg-emerald-500/10"
                            : "border-white/10 focus:border-white/30 hover:border-white/20"
                        }`}
                        placeholder={`Variant ${optIndex + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Bilasizmi? (Qiziqarli fakt)
                </label>
                <textarea
                  value={q.fact || ""}
                  onChange={(e) =>
                    updateQuestion(qIndex, { ...q, fact: e.target.value })
                  }
                  className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3.5 text-white font-medium focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-neutral-600 resize-y min-h-[100px]"
                  placeholder="To'g'ri javob chiqgandan keyin ko'rsatiladigan ma'lumot..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Orqa fon rasmi (URL yoki fayl yuklash)
                </label>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="relative flex-1 w-full flex gap-3">
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
                        placeholder="https://..."
                      />
                    </div>
                    <label className="cursor-pointer bg-white/5 hover:bg-white/10 text-white p-3.5 rounded-xl border border-white/10 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm shrink-0" title="Rasm yuklash">
                      <Upload size={20} />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(qIndex, e)}
                      />
                    </label>
                  </div>
                  {q.backgroundImage && (
                    <div className="w-full sm:w-28 h-40 sm:h-20 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-inner">
                      <img
                        src={q.backgroundImage}
                        alt="Background preview"
                        className="w-full h-full object-cover transition-transform hover:scale-110 duration-700"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-6 border-t border-white/10 mt-6">
                <button
                  onClick={() => handleGenerateAudio(qIndex, q)}
                  disabled={generatingAudioId === q.id}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-medium text-emerald-300 hover:text-emerald-200 disabled:opacity-50 disabled:hover:scale-100 transition-all hover:scale-[1.02] active:scale-[0.98] bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 px-5 py-3 sm:py-2.5 rounded-xl shadow-sm"
                >
                  {generatingAudioId === q.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Volume2 size={16} />
                  )}
                  {q.audioBase64 ? "Ovozni yangilash" : "AI Ovoz yaratish"}
                </button>
                {q.audioBase64 && (
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handlePlayAudio(`${q.id}-question`, q.audioBase64!)}
                      className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/25 px-4 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95"
                    >
                      {playingAudioId === `${q.id}-question` ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                      Savol Ovozi
                    </button>
                    {q.correctAudioBase64 && (
                      <button
                        onClick={() => handlePlayAudio(`${q.id}-correct`, q.correctAudioBase64!)}
                        className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/25 px-4 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95"
                      >
                        {playingAudioId === `${q.id}-correct` ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                        Javob Ovozi
                      </button>
                    )}
                  </div>
                )}
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
    </div>
  );
}
