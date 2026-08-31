import React, { useEffect, useState, useRef } from "react";
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
  Pause,
  VolumeX,
  Check,
  Mic,
  MicOff,
  Music,
} from "lucide-react";
import { generateTTS, generateTTSBatch } from "../services/tts";
import { getVideoStrings } from "../services/i18n";
import { setBGMVolume } from "../services/sfx";
import { getLongVideoPreset, LONG_VIDEO_PRESETS } from "../services/videoPlan";
import { generateQuizAI, analyzeQuestionsForImages, getUnsplashImageForKeyword } from "../services/ai";
import { compressImageFile } from "../services/images";
import { QuizRenderer } from "../services/renderer";
import {
  completeVideoExport,
  failVideoExport,
  PlanUsageResult,
  reserveVideoExport,
} from "../services/access";
import { hasReachedExportLimit } from "../services/plans";
import { isTelegramWebApp, telegramHaptic, sendVideoToTelegramChat } from "../services/telegram";
import { SocialCopyCard } from "./SocialCopyCard";
import type { User } from "firebase/auth";
import { UserProfile } from "../types";

interface EditorProps {
  quiz: Quiz;
  setQuiz: (quiz: Quiz) => void;
  onPlay: () => void;
  user: User | null;
  userProfile: UserProfile | null;
  onOpenPaywall: () => void;
  onRequireAuth: () => void;
  onOpenReferral?: () => void;
  onVideoCreated?: (result: PlanUsageResult) => void;
}

export function Editor({ quiz, setQuiz, onPlay, user, userProfile, onOpenPaywall, onRequireAuth, onOpenReferral, onVideoCreated }: EditorProps) {
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(
    null,
  );
  const [aiTopic, setAiTopic] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [exportedVideoExtension, setExportedVideoExtension] = useState<string>("");
  const [exportProgress, setExportProgress] = useState(0);
  const [exportWasPaused, setExportWasPaused] = useState(false);

  const handleCloseExportModal = () => {
    if (exportedVideoUrl) {
      URL.revokeObjectURL(exportedVideoUrl);
    }
    setExportedVideoUrl(null);
    setExportedVideoExtension("");
    setIsExporting(false);
  };
  const [exportResolution, setExportResolution] = useState("");
  const [isMobileExport, setIsMobileExport] = useState(false);
  const [isGeneratingBulkImages, setIsGeneratingBulkImages] = useState(false);
  const [isGeneratingBulkVoices, setIsGeneratingBulkVoices] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<"uz" | "en" | "ru" | "tr">(
    quiz.language || "uz"
  );
  const [showSettings, setShowSettings] = useState(false);
  const hasPremiumAccess = userProfile?.role === "premium" || userProfile?.role === "admin";
  const isAdmin = userProfile?.role === "admin";
  const isYouTubeFormat = quiz.videoFormat === "youtube";
  const longVideoPreset = getLongVideoPreset(quiz.targetDuration);
  const exportQuestionNumber = Math.min(
    quiz.questions.length,
    Math.floor(exportProgress * quiz.questions.length) + 1,
  );
  const estimatedExportSeconds = quiz.videoFormat === "youtube" && quiz.targetDuration
    ? quiz.targetDuration * 60
    : quiz.questions.length * ((quiz.timerDuration || 5) + 8) + 7;
  const estimatedMinutesRemaining = Math.max(
    1,
    Math.ceil((estimatedExportSeconds * (1 - exportProgress)) / 60),
  );

  useEffect(() => {
    if (!isExporting) return;
    const protectActiveExport = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectActiveExport);
    return () => window.removeEventListener("beforeunload", protectActiveExport);
  }, [isExporting]);

  // Ovozni tinglash (play) uchun holat
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
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

  // Ovozli xabar / Mikrofon orqali mavzu aytish (Voice Input)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // URL orqali kelgan mavzuni avtomatik yuklash (?topic=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const topicParam = params.get("topic");
      if (topicParam && topicParam.trim()) {
        setAiTopic(topicParam.trim());
      }
    } catch {}
  }, []);

  const handleToggleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Kechirasiz, brauzeringiz ovozli qidiruvni qo'llab-quvvatlamaydi. Iltimos, Chrome, Safari yoki Telegram ichida sinab ko'ring."
      );
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;

      const langCodeMap: Record<string, string> = {
        uz: "uz-UZ",
        ru: "ru-RU",
        en: "en-US",
        tr: "tr-TR",
      };
      recognition.lang = langCodeMap[selectedLanguage] || "uz-UZ";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        if (transcript) {
          setAiTopic(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  };

  const handleCustomBgmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert("Musiqa hajmi 25 MB dan oshmasligi kerak.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setQuiz({
        ...quiz,
        bgmEnabled: true,
        bgmType: 'custom',
        customBgmBase64: base64,
        customBgmName: file.name,
      });
    };
    reader.onerror = () => {
      alert("Musiqa faylini o'qishda xatolik yuz berdi.");
    };
    reader.readAsDataURL(file);
  };

  // TTS xatolarini bitta joyda tushunarli xabarga aylantiramiz
  const handleTTSError = (err: any): void => {
    const code = err?.message || String(err);
    if (code === "AUTH_REQUIRED") {
      alert("AI ovoz yaratish uchun avval Google hisobingiz bilan kiring. Savollaringiz saqlanib qoladi.");
      onRequireAuth();
    } else if (code === "TTS_LIMIT" || code === "PLAN_LIMIT" || code === "VIDEO_LIMIT") {
      alert("AI ovoz limitingiz tugagan. Davom etish uchun Premium yoki 10 talik paketni oling.");
      onOpenPaywall();
    } else if (code === "AI_VOICE_LIMIT") {
      alert("Shu tarif uchun ajratilgan AI ovoz byudjeti tugadi. Premium yoki 10 talik paket bilan byudjet kengayadi.");
      onOpenPaywall();
    } else if (code === "AI_QUIZ_LIMIT") {
      alert("Shu tarif uchun ajratilgan AI savol yaratish byudjeti tugadi. Savollarni qo'lda kiritishingiz yoki tarifni kengaytirishingiz mumkin.");
      onOpenPaywall();
    } else if (code === "AI_IMAGE_LIMIT") {
      alert("Shu tarif uchun ajratilgan AI rasm qidirish byudjeti tugadi. Rasmlarni qo'lda yuklashingiz yoki tarifni kengaytirishingiz mumkin.");
      onOpenPaywall();
    } else if (code === "PREMIUM_VOICE_REQUIRED") {
      alert("Bu ovoz faqat faol Premium tarifda mavjud.");
      onOpenPaywall();
    } else if (code === "TTS_TIMEOUT") {
      alert("Ovoz yaratish serveri javob berishga ulgurmadi. \"Barcha ovozlar (AI)\" tugmasini qayta bosing — faqat yetishmayotgan ovozlar yaratiladi, limitingiz sarflanmaydi.");
    } else if (code === "RATE_LIMITED") {
      alert("Juda ko'p AI so'rovi yuborildi. Biroz kutib, qayta urinib ko'ring.");
    } else if (code === "QUOTA_EXCEEDED") {
      alert("AI Ovoz yaratish uchun API kvotasi tugadi. Boshqa vaqt qayta urinib ko'ring.");
    } else {
      alert(`Ovoz yaratishda xatolik: ${code}`);
      console.error(err);
    }
  };

  const generateSingleAudio = async (qIndex: number, q: Question, type: "question" | "correct") => {
    setGeneratingAudioId(`${q.id}-${type}`);
    try {
      if (type === "question") {
        // Faqat savol o'qiladi — variantlar ekranda; video sur'ati tez qoladi
        const textToRead = q.text;
        const audioBase64 = await generateTTS(textToRead, quiz.voiceName || "Kore");
        if (audioBase64) {
          updateQuestion(qIndex, { ...q, audioBase64 });
        } else {
          alert("Ovoz yaratishda xatolik yuz berdi.");
        }
      } else {
        const letters = ["A", "B", "C", "D"];
        const correctTextToRead = getVideoStrings(quiz.language).ttsCorrect(
          letters[q.correctOptionIndex],
          q.options[q.correctOptionIndex],
          q.explanation,
        );
        const correctAudioBase64 = await generateTTS(correctTextToRead, quiz.voiceName || "Kore");
        if (correctAudioBase64) {
          updateQuestion(qIndex, { ...q, correctAudioBase64 });
        } else {
          alert("Ovoz yaratishda xatolik yuz berdi.");
        }
      }
    } catch (ttsErr: any) {
      handleTTSError(ttsErr);
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
          explanation: "",
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

  const handleImageUpload = async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Inputni darhol bo'shatamiz — aks holda bir xil faylni qayta tanlash ishlamaydi.
    event.target.value = "";
    if (!file) return;

    try {
      // Telefondan kelgan surat 4–8MB bo'lishi mumkin; siqilmasa u quiz obyektida
      // qolib, avtosaqlash va JSON eksportini shishirib yuboradi.
      const backgroundImage = await compressImageFile(file);
      updateQuestion(index, { ...quiz.questions[index], backgroundImage });
    } catch (error) {
      console.error(error);
      alert("Rasmni yuklab bo'lmadi. Boshqa faylni tanlab ko'ring.");
    }
  };

  const handleGenerateAudio = async (qIndex: number, q: Question) => {
    setGeneratingAudioId(q.id);
    const letters = ['A', 'B', 'C', 'D'];
    // Faqat savol o'qiladi — variantlar ekranda; video sur'ati tez qoladi
    const textToRead = q.text;
    const correctTextToRead = getVideoStrings(quiz.language).ttsCorrect(
      letters[q.correctOptionIndex],
      q.options[q.correctOptionIndex],
      q.explanation,
    );

    try {
      // Ikkala klip bitta so'rovda — ilgarigi 4s kutish shart emas.
      const [audioBase64, correctAudioBase64] = await generateTTSBatch(
        [{ text: textToRead }, { text: correctTextToRead }],
        quiz.voiceName || "Kore",
      );
      if (audioBase64) {
        updateQuestion(qIndex, { ...q, audioBase64, correctAudioBase64: correctAudioBase64 || undefined });
      } else {
        alert("Ovoz yaratishda xatolik yuz berdi.");
      }
    } catch (ttsErr: any) {
      handleTTSError(ttsErr);
    }
    setGeneratingAudioId(null);
  };

  const handleAIGenerate = async (overrideTopic?: string) => {
    const topicToUse = overrideTopic || aiTopic;
    if (!topicToUse) return;
    if (overrideTopic) setAiTopic(overrideTopic);
    if (!user) {
      onRequireAuth();
      return;
    }

    const isLimitReached = hasReachedExportLimit(userProfile);

    if (isLimitReached) {
      onOpenPaywall();
      return;
    }

    setIsGeneratingAI(true);
    
    try {
      const questionCount = (isYouTubeFormat && isAdmin) ? longVideoPreset.questionCount : 5;
      const newQuestions = await generateQuizAI(topicToUse, selectedLanguage, questionCount);
      if (newQuestions && newQuestions.length > 0) {
        const generatedQuiz: Quiz = {
          ...quiz,
          title: topicToUse,
          questions: newQuestions,
          language: selectedLanguage,
          timerDuration: (isYouTubeFormat && isAdmin) ? longVideoPreset.timerSeconds : quiz.timerDuration,
        };
        // Avval savollarni ekranga chiqaramiz
        setQuiz(generatedQuiz);
        
        // Keyin barcha savollar uchun ovozlarni bitta batch so'rovda yaratamiz
        setGeneratingAudioId("batch");
        try {
          const letters = ['A', 'B', 'C', 'D'];
          // Faqat savol o'qiladi — variantlar ekranda; video sur'ati tez qoladi
          const vs = getVideoStrings(selectedLanguage);
          const items = newQuestions.flatMap((q) => [
            { text: q.text },
            { text: vs.ttsCorrect(letters[q.correctOptionIndex], q.options[q.correctOptionIndex], q.explanation) },
          ]);
          const audios = await generateTTSBatch(items, quiz.voiceName || "Kore");
          const withAudio = newQuestions.map((q, i) => ({
            ...q,
            audioBase64: audios[2 * i] || undefined,
            correctAudioBase64: audios[2 * i + 1] || undefined,
          }));
          setQuiz({ ...generatedQuiz, questions: withAudio });

          // Server vaqt/hajm chegarasiga yetganda qisman natija qaytarishi mumkin —
          // buni jimgina o'tkazib yubormaymiz, aks holda video ovozsiz qismlar bilan chiqadi.
          const missingClips = audios.filter((clip) => !clip).length;
          if (missingClips > 0) {
            alert(
              `Savollar tayyor, lekin ${missingClips} ta ovoz yaratilmadi.\n\n` +
              "\"Barcha ovozlar (AI)\" tugmasini bosing — faqat yetishmaganlari yaratiladi."
            );
          }
        } catch (ttsErr: any) {
          // Savollar allaqachon yaratildi — ovoz xatosi ularni yo'qotmasin
          const code = ttsErr?.message || "";
          if (code === "AUTH_REQUIRED") {
            alert("Savollar tayyor! AI ovoz qo'shish uchun Google hisobingiz bilan kiring, so'ng \"Barcha ovozlar (AI)\" tugmasini bosing.");
          } else if (code === "TTS_LIMIT" || code === "AI_VOICE_LIMIT") {
            alert("Savollar tayyor, lekin AI ovoz byudjetingiz tugagan. Premium yoki paket bilan ovoz qo'shishingiz mumkin.");
          } else if (code === "QUOTA_EXCEEDED") {
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
    } catch (err: any) {
      console.error(err);
      handleTTSError(err);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleBulkImageGenerate = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
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
    } catch (err: any) {
      console.error(err);
      handleTTSError(err);
    } finally {
      setIsGeneratingBulkImages(false);
    }
  };

  const handleBulkVoiceGenerate = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!quiz.questions || quiz.questions.length === 0) {
      alert("Avval test savollarini qo'shing yoki yaratib oling.");
      return;
    }
    const letters = ['A', 'B', 'C', 'D'];
    // Faqat savol o'qiladi — variantlar ekranda; video sur'ati tez qoladi
    const vs = getVideoStrings(quiz.language);

    // Faqat YETISHMAYOTGAN kliplarni so'raymiz. Shu tufayli tugmani qayta bosish
    // arzon "qayta urinish" bo'lib xizmat qiladi — tayyor ovozlar uchun AI byudjeti
    // ikkinchi marta sarflanmaydi.
    const missingSlots = quiz.questions.flatMap((q, questionIndex) => {
      const slots: { questionIndex: number; kind: "question" | "correct"; text: string }[] = [];
      if (!q.audioBase64) {
        slots.push({ questionIndex, kind: "question", text: q.text });
      }
      if (!q.correctAudioBase64) {
        slots.push({
          questionIndex,
          kind: "correct",
          text: vs.ttsCorrect(letters[q.correctOptionIndex], q.options[q.correctOptionIndex], q.explanation),
        });
      }
      return slots;
    });

    if (missingSlots.length === 0) {
      alert("Barcha savollar uchun ovozlar allaqachon tayyor.");
      return;
    }

    setIsGeneratingBulkVoices(true);
    setGeneratingAudioId("batch");
    try {
      const audios = await generateTTSBatch(
        missingSlots.map((slot) => ({ text: slot.text })),
        quiz.voiceName || "Kore",
      );

      const updatedQuestions = quiz.questions.map((q) => ({ ...q }));
      let createdCount = 0;
      missingSlots.forEach((slot, index) => {
        const audio = audios[index];
        if (!audio) return;
        createdCount++;
        if (slot.kind === "question") {
          updatedQuestions[slot.questionIndex].audioBase64 = audio;
        } else {
          updatedQuestions[slot.questionIndex].correctAudioBase64 = audio;
        }
      });
      setQuiz({ ...quiz, questions: updatedQuestions });

      const stillMissing = missingSlots.length - createdCount;
      if (stillMissing > 0) {
        alert(
          `${createdCount} ta ovoz yaratildi, ${stillMissing} tasi yaratilmadi.\n\n` +
          "Tugmani qayta bosing — faqat yetishmaganlari so'raladi va limitingiz ular uchun qayta sarflanmaydi."
        );
      } else {
        alert(`${createdCount} ta ovoz muvaffaqiyatli yaratildi va o'rnatildi!`);
      }
    } catch (ttsErr: any) {
      handleTTSError(ttsErr);
    } finally {
      setGeneratingAudioId(null);
      setIsGeneratingBulkVoices(false);
    }
  };

  const handleExport = async (forceArg: any = false) => {
    const force = typeof forceArg === "boolean" ? forceArg : false;
    if (!user) {
      onRequireAuth();
      return;
    }
    const isLimitReached = hasReachedExportLimit(userProfile);

    if (isLimitReached) {
      onOpenPaywall();
      return;
    }

    setExportedVideoUrl(null);
    setExportedVideoExtension("");
    setIsExporting(true);
    setExportProgress(0);
    setExportWasPaused(false);
    setExportResolution("");
    setIsMobileExport(false);
    let reservationId: string | null = null;
    let exportCompleted = false;
    let errorHandled = false;
    const renderStartedAt = performance.now();

    const releaseReservation = async (failureCode: string) => {
      if (!reservationId || exportCompleted) return;
      try {
        await failVideoExport(reservationId, failureCode);
      } catch (releaseError) {
        console.error("Eksport rezervatsiyasini bo'shatib bo'lmadi:", releaseError);
      }
    };

    const showExportError = async (err: any) => {
      if (errorHandled) return;
      errorHandled = true;
      console.error(err);
      const code = err?.message || "";
      await releaseReservation(code || "EXPORT_FAILED");
      if (code === "AUTH_REQUIRED") onRequireAuth();
      else if (code === "VIDEO_LIMIT" || code === "PLAN_LIMIT") onOpenPaywall();
      else if (code === "EXPORT_IN_PROGRESS") {
        const forceCancel = window.confirm(
          "Sizda faol eksport mavjud (ehtimol, sahifani yangilagansiz yoki avvalgi eksport to'xtab qolgan).\n\nAvvalgi eksportni bekor qilib, yangisini boshlashni xohlaysizmi?"
        );
        if (forceCancel) {
          setIsExporting(false);
          setTimeout(() => {
            handleExport(true);
          }, 100);
          return;
        }
      }
      else if (code === "RATE_LIMITED") alert("Juda ko'p urinish. Bir daqiqadan keyin qayta urinib ko'ring.");
      else alert("Video yaratishda xatolik yuz berdi. Limit sarflanmadi.");
      setIsExporting(false);
    };

    try {
      const quizToRender = {
        ...quiz,
        watermark: hasPremiumAccess ? quiz.watermark : "@QuizVideo",
      };
      const renderer = new QuizRenderer(quizToRender);
      setExportResolution(`${renderer.outputWidth}×${renderer.outputHeight}`);
      setIsMobileExport(renderer.isMobileOptimized);
      renderer.onProgress = (p) => setExportProgress(p);
      renderer.onPauseChange = (isPaused) => {
        if (isPaused) setExportWasPaused(true);
      };
      renderer.onBeforeRecording = async () => {
        const result = await reserveVideoExport({
          format: quiz.videoFormat === "youtube" ? "youtube" : "vertical",
          questionCount: quiz.questions.length,
          targetDuration: quiz.videoFormat === "youtube" ? quiz.targetDuration : undefined,
          force,
        });
        reservationId = result.reservationId;
        onVideoCreated?.(result);
      };
      renderer.onComplete = async (url, extension, blob) => {
        try {
          if (!reservationId) throw new Error("RESERVATION_NOT_FOUND");
          const videoDurationSeconds = quiz.videoFormat === "youtube" && quiz.targetDuration
            ? quiz.targetDuration * 60
            : quiz.questions.length * ((quiz.timerDuration || 5) + 8) + 7;
          const result = await completeVideoExport(reservationId, {
            renderDurationMs: Math.round(performance.now() - renderStartedAt),
            videoDurationSeconds,
            outputBytes: blob.size,
            questionCount: quiz.questions.length,
            audioClipCount: quiz.questions.reduce(
              (count, question) =>
                count + Number(Boolean(question.audioBase64)) + Number(Boolean(question.correctAudioBase64)),
              0,
            ),
            imageCount: quiz.questions.filter((question) => Boolean(question.backgroundImage)).length,
            format: quiz.videoFormat === "youtube" ? "youtube" : "vertical",
            extension: extension === "mp4" ? "mp4" : "webm",
          });
          exportCompleted = true;
          onVideoCreated?.(result);

          setExportedVideoUrl(url);
          setExportedVideoExtension(extension);

          telegramHaptic("success");

          // Telegram Mini App ichida bo'lsa: videoni to'g'ridan-to'g'ri Telegram chatiga ham yuboramiz
          if (isTelegramWebApp()) {
            sendVideoToTelegramChat(
              blob,
              `${quiz.title || "quiz"}.${extension}`,
              `🎬 <b>${quiz.title || "Quiz Video"}</b>\n\n✨ <i>Quiz Video Generator orqali tayyorlandi</i>`
            ).catch((tgErr) => console.warn("Telegram chatga yuborishda xatolik:", tgErr));
          }

          try {
            const a = document.createElement("a");
            a.href = url;
            a.download = `${quiz.title || "quiz"}.${extension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          } catch (e) {
            console.warn("Auto-download failed:", e);
          }
        } catch (error) {
          URL.revokeObjectURL(url);
          await showExportError(error);
        }
      };
      renderer.onError = showExportError;
      await renderer.start();
    } catch (err: any) {
      await showExportError(err);
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
            explanation: q.explanation || "",
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
          videoFormat: importedQuiz.videoFormat || quiz.videoFormat || "vertical",
          targetDuration: importedQuiz.targetDuration || quiz.targetDuration || 8,
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
      videoFormat: "youtube",
      targetDuration: 8,
      watermark: "@myusername",
      questions: [
        {
          text: "O'zbekiston Respublikasining poytaxti qaysi shahar?",
          options: ["Toshkent", "Samarqand", "Buxoro", "Xiva"],
          correctOptionIndex: 0,
          explanation: "Tashkent has been the capital of Uzbekistan since 1930.",
          backgroundImage: "https://images.unsplash.com/photo-1505506874110-6a7a48e14c49?q=80&w=1000&auto=format&fit=crop"
        },
        {
          text: "Yer yuzida nechta okean bor?",
          options: ["3 ta", "4 ta", "5 ta", "6 ta"],
          correctOptionIndex: 2,
          explanation: "Earth has five recognized oceans, including the Southern Ocean.",
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
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center text-white p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-title"
        >
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-neutral-950/90 p-6 sm:p-8 text-center shadow-2xl">
            {exportedVideoUrl ? (
              <div>
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
                  <Check size={34} className="text-emerald-400" />
                </div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-400">
                  Tayyor!
                </p>
                <h2 id="export-title" className="text-2xl sm:text-3xl font-black mb-3">
                  Video yaratildi!
                </h2>
                <p className="text-sm text-neutral-300 max-w-lg mx-auto mb-6 leading-relaxed">
                  Videongiz muvaffaqiyatli render qilindi va yuklab olishga tayyor. 
                  Agar yuklash avtomatik boshlanmagan bo'lsa yoki Telegram/Instagram ichidan foydalanayotgan bo'lsangiz, quyidagi tugmalar yordamida yuklab oling.
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = exportedVideoUrl;
                      a.download = `${quiz.title || "quiz"}.${exportedVideoExtension}`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className="w-full bg-gradient-to-r from-emerald-600 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-white font-bold py-3 px-6 rounded-xl transition-all cursor-pointer"
                  >
                    Yuklab olish (Download)
                  </button>

                  <button
                    onClick={() => {
                      window.open(exportedVideoUrl, "_blank");
                    }}
                    className="w-full bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold py-3 px-6 rounded-xl transition-all cursor-pointer"
                  >
                    Yangi oynada ochish (Mobil/Telegram)
                  </button>

                  <div className="my-2">
                    <SocialCopyCard quiz={quiz} />
                  </div>

                  <button
                    onClick={handleCloseExportModal}
                    className="w-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 font-semibold py-3 px-6 rounded-xl transition-all cursor-pointer"
                  >
                    Yopish
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
                  <Loader2 size={34} className="animate-spin text-emerald-400" />
                </div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-400">
                  Eksport davom etmoqda
                </p>
                <h2 id="export-title" className="text-2xl sm:text-3xl font-black mb-3">
                  Videongiz tayyorlanmoqda
                </h2>
                <p className="text-sm sm:text-base text-neutral-300 max-w-lg mx-auto mb-4 leading-relaxed">
                  Bu sahifani yopmang yoki yangilamang. Boshqa oynaga o'tishingiz mumkin:
                  eksport xavfsiz pauza qilinadi va qaytishingiz bilan avtomatik davom etadi.
                </p>
                <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300 text-left max-w-lg mx-auto flex items-start gap-2.5">
                  <span className="text-base leading-none">💡</span>
                  <p className="leading-relaxed">
                    <strong>Tavsiya:</strong> Agar eksport orqa fonda ham to'xtamasdan davom etishini xohlasangiz, ushbu saytni <strong>alohida yangi oyna (window, yangi tab emas)</strong> sifatida oching. Oynani minimallashtirmasdan (свернуть qilmasdan) orqada qoldirsangiz, boshqa ishlaringizni qilayotganingizda ham eksport to'xtamaydi.
                  </p>
                </div>

                <div className="mb-3 flex items-center justify-between text-xs font-semibold text-neutral-400">
                  <span>
                    {exportProgress >= 1
                      ? "Video fayli yakunlanmoqda"
                      : `${exportQuestionNumber}-savol / ${quiz.questions.length}`}
                  </span>
                  <span className="font-mono text-emerald-300">{Math.round(exportProgress * 100)}%</span>
                </div>
                <div
                  className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden border border-neutral-700"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(exportProgress * 100)}
                >
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
                    style={{ width: `${exportProgress * 100}%` }}
                  />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3 text-left">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs text-neutral-500">Taxminiy qolgan vaqt</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {exportProgress >= 1 ? "Bir necha soniya" : `${estimatedMinutesRemaining} daqiqagacha`}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs text-neutral-500">Eksport sifati</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {exportResolution || "Tayyorlanmoqda"}
                    </p>
                    {isMobileExport && (
                      <p className="mt-1 text-[10px] font-semibold text-emerald-300">Mobil xavfsiz rejim</p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs text-neutral-500">Muhim</p>
                    <p className="mt-1 text-sm font-bold text-white">Qurilmani uyqu rejimiga o'tkazmang</p>
                  </div>
                </div>

                {exportWasPaused && (
                  <p className="mt-4 text-sm font-semibold text-emerald-300" aria-live="polite">
                    Jarayon tiklandi — eksport davom etmoqda.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-emerald-400 via-emerald-200 to-cyan-400 drop-shadow-sm mb-2">
          Quiz Video Tayyorlash
        </h1>
        <p className="text-neutral-400 text-base font-medium">
          3 qadam: savollar tayyorlang → tekshiring → videoni yuklab oling
        </p>
      </div>

      {!isTelegramWebApp() && (
        <div className="mb-4 p-4 rounded-2xl bg-[#229ED9]/10 border border-[#229ED9]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-200 shadow-lg shadow-[#229ED9]/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#229ED9]/20 border border-[#229ED9]/40 flex items-center justify-center text-[#229ED9] shrink-0">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
            </div>
            <div>
              <p className="font-bold text-white text-sm">Telegram Botimiz: @QuizVideoAIBot</p>
              <p className="text-slate-400">Telegram ichida to'g'ridan-to'g'ri video yaratish va chatga qabul qilish mumkin!</p>
            </div>
          </div>
          <a
            href="https://t.me/QuizVideoAIBot"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 bg-gradient-to-r from-[#229ED9] to-[#0088cc] hover:from-[#1f8ec4] hover:to-[#0077b5] text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
          >
            Botda ochish ↗
          </a>
        </div>
      )}

      {onOpenReferral && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-emerald-500/15 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-200 shadow-lg shadow-emerald-900/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 text-lg">
              🎁
            </div>
            <div>
              <p className="font-bold text-white text-sm flex items-center gap-2">
                Do'stingizni taklif qiling — Bepul video oling!
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-extrabold">+1 Video</span>
              </p>
              <p className="text-slate-400">
                Har bir taklif qilgan do'stingiz uchun sizga +1 ta bepul video sovg'a qilinadi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              telegramHaptic("medium");
              onOpenReferral();
            }}
            className="shrink-0 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            Havolani olish →
          </button>
        </div>
      )}

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
          Mavzuni yozing — AI {(isYouTubeFormat && isAdmin) ? `${longVideoPreset.questionCount} ta savol, javob izohlari` : "5 ta savol"} va rasmlarni avtomatik tuzib beradi.
          Yoki pastda savollarni qo'lda kiriting.
        </p>
        <div className="flex flex-col md:flex-row gap-3 relative z-10">
          <div className="relative flex-1 flex items-center">
            <input
              type="text"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder={
                isListening
                  ? "🎙 Eshitilmoqda... Mavzuni ayting..."
                  : selectedLanguage === "ru"
                  ? "Введите тему (например: История, Космос, Спорт...)"
                  : selectedLanguage === "en"
                  ? "Enter a topic (e.g. History, Space, Sports...)"
                  : selectedLanguage === "tr"
                  ? "Bir konu yazın (örnek: Tarih, Uzay, Spor...)"
                  : "Mavzuni kiriting (masalan: Tarix, Kosmos, Sport...)"
              }
              className={`w-full bg-black/40 backdrop-blur-md border ${
                isListening
                  ? "border-red-500 ring-2 ring-red-500/30 text-white animate-pulse"
                  : "border-indigo-500/30 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              } rounded-xl px-4 py-3.5 pr-12 text-white focus:outline-none transition-all placeholder:text-indigo-200/30 font-semibold`}
              onKeyDown={(e) => e.key === 'Enter' && handleAIGenerate()}
            />
            <button
              type="button"
              onClick={handleToggleVoiceInput}
              title={isListening ? "To'xtatish" : "Ovoz orqali aytish"}
              className={`absolute right-2.5 p-2 rounded-lg transition-all cursor-pointer ${
                isListening
                  ? "bg-red-500 text-white animate-bounce shadow-lg shadow-red-500/40"
                  : "text-indigo-300 hover:text-white hover:bg-white/10"
              }`}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          </div>
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
            onClick={() => handleAIGenerate()}
            disabled={isGeneratingAI || !aiTopic}
            className="md:w-auto shrink-0 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 text-white px-6 py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/20 border border-white/10 border-t-white/20 cursor-pointer whitespace-nowrap"
          >
            {isGeneratingAI ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
            {isGeneratingAI ? (generatingAudioId ? "Ovozlar yaratilmoqda..." : "Savollar tuzilmoqda...") : "AI bilan yaratish"}
          </button>
        </div>

        {/* Trending Topics Quick-Select */}
        <div className="mt-4 pt-3 border-t border-indigo-500/20 relative z-10">
          <p className="text-xs font-bold text-indigo-200/80 mb-2 uppercase tracking-wider">
            🔥 Ommabop mavzular (Bitta bosishda AI yaratadi):
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              selectedLanguage === "ru"
                ? [
                    { topic: "География мира и страны", label: "🌍 География" },
                    { topic: "Всемирная история и великие личности", label: "📜 История" },
                    { topic: "Космос и тайны вселенной", label: "🚀 Космос" },
                    { topic: "Логические загадки и головоломки", label: "🧠 Логика" },
                    { topic: "Мировой спорт и футбол", label: "⚽ Спорт" },
                    { topic: "Шедевры мирового кино", label: "🎬 Кино" },
                    { topic: "Автомобили и суперкары", label: "🚗 Авто" },
                    { topic: "Наука и великие открытия", label: "🔬 Наука" },
                  ]
                : selectedLanguage === "en"
                ? [
                    { topic: "World Geography and Countries", label: "🌍 Geography" },
                    { topic: "World History and Great Leaders", label: "📜 History" },
                    { topic: "Space and Universe Mysteries", label: "🚀 Space" },
                    { topic: "Brain Teasers and Logic Riddles", label: "🧠 Logic" },
                    { topic: "World Sports and Football", label: "⚽ Sports" },
                    { topic: "Cinema and Famous Movies", label: "🎬 Movies" },
                    { topic: "Supercars and Automobiles", label: "🚗 Cars" },
                    { topic: "Science and Innovations", label: "🔬 Science" },
                  ]
                : selectedLanguage === "tr"
                ? [
                    { topic: "Dünya Coğrafyası ve Ülkeler", label: "🌍 Coğrafya" },
                    { topic: "Dünya Tarihi ve Büyük Şahsiyetler", label: "📜 Tarih" },
                    { topic: "Uzay ve Evrenin Sırları", label: "🚀 Uzay" },
                    { topic: "Mantık ve Zeka Soruları", label: "🧠 Mantık" },
                    { topic: "Dünya Sporu ve Futbol", label: "⚽ Spor" },
                    { topic: "Sinema ve Efsanevi Filmler", label: "🎬 Sinema" },
                    { topic: "Otomobiller ve Süper Arabalar", label: "🚗 Araba" },
                    { topic: "Bilim ve İcatlar", label: "🔬 Bilim" },
                  ]
                : [
                    { topic: "Dunyo Geografiyasi va Davlatlar", label: "🌍 Geografiya" },
                    { topic: "Jahon Tarixi va Buyuk Shaxslar", label: "📜 Tarix" },
                    { topic: "Kosmos va Koinot Sirlari", label: "🚀 Kosmos" },
                    { topic: "Mantiqiy Topishmoqlar va Zukkolik", label: "🧠 Mantiqiy" },
                    { topic: "Jahon Sporti va Futbol", label: "⚽ Sport" },
                    { topic: "Kino va Mashhur Filmlar", label: "🎬 Kino" },
                    { topic: "Avtomobillar va Texnika", label: "🚗 Avto" },
                    { topic: "Fizika va Ilm-Fan Kashfiyotlari", label: "🔬 Ilm-Fan" },
                  ]
            ).map((t) => (
              <button
                key={t.topic}
                type="button"
                disabled={isGeneratingAI}
                onClick={() => handleAIGenerate(t.topic)}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-200 text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1 shadow-sm"
              >
                {t.label}
              </button>
            ))}
          </div>
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
            <div className="pt-4">
              <label className="block text-sm font-medium text-neutral-300 mb-3">
                Video formati
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { id: "vertical", title: "Shorts / Reels", subtitle: "1080×1920 · 9:16" },
                  { id: "youtube", title: "YouTube Long", subtitle: "1920×1080 · telefonda xavfsiz 720p" },
                ] as const).map((format) => (
                  <button
                    key={format.id}
                    type="button"
                    onClick={() => {
                      if (format.id === "youtube") {
                        const targetDur = isAdmin ? (quiz.targetDuration || 2) : 2;
                        const preset = getLongVideoPreset(targetDur);
                        setQuiz({
                          ...quiz,
                          videoFormat: "youtube",
                          targetDuration: preset.durationMinutes,
                          timerDuration: preset.timerSeconds,
                        });
                      } else {
                        setQuiz({ ...quiz, videoFormat: "vertical", timerDuration: 5 });
                      }
                    }}
                    className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                      (quiz.videoFormat || "vertical") === format.id
                        ? "bg-emerald-500/15 border-emerald-500 text-white ring-2 ring-emerald-500/20"
                        : "bg-black/30 border-white/10 text-neutral-300 hover:border-white/20"
                    }`}
                  >
                    <span className="block text-sm font-black">{format.title}</span>
                    <span className="block text-xs text-neutral-400 mt-1">{format.subtitle}</span>
                  </button>
                ))}
              </div>
            </div>

            {isYouTubeFormat && (
              <div className="mb-5 relative z-10 bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
                  <label className="block text-sm font-medium text-neutral-300">
                    Maqsadli davomiylik
                  </label>
                  {!isAdmin && (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                      Foydalanuvchilar: 2 min · 3+ min faqat Admin
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {LONG_VIDEO_PRESETS.map((preset) => {
                    const isLocked = !isAdmin && preset.durationMinutes > 2;
                    const isSelected = (quiz.targetDuration || 2) === preset.durationMinutes;

                    return (
                      <button
                        key={preset.durationMinutes}
                        type="button"
                        onClick={() => {
                          if (isLocked) {
                            telegramHaptic("warning");
                            alert("3 daqiqadan uzun YouTube videolari faqat Adminlar uchun mo'ljallangan. Foydalanuvchilar uchun 2 min va Shorts/Reels (30-60s) ochiq.");
                            return;
                          }
                          telegramHaptic("light");
                          setQuiz({
                            ...quiz,
                            targetDuration: preset.durationMinutes,
                            timerDuration: preset.timerSeconds,
                          });
                        }}
                        className={`rounded-xl border px-2 py-3 text-center transition-all relative ${
                          isLocked
                            ? "bg-black/20 border-white/5 text-neutral-600 opacity-60 cursor-not-allowed"
                            : isSelected
                            ? "bg-cyan-500/15 border-cyan-400 text-cyan-200 ring-2 ring-cyan-500/20 cursor-pointer"
                            : "bg-black/30 border-white/10 text-neutral-400 hover:text-white cursor-pointer"
                        }`}
                      >
                        {isLocked && (
                          <span className="absolute top-1 right-1 text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded px-1 font-bold">
                            Admin
                          </span>
                        )}
                        <span className="block text-base sm:text-lg font-black">{preset.durationMinutes} min</span>
                        <span className="block text-[10px] mt-1">
                          {preset.questionCount} savol · {preset.timerSeconds}s
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  AI savollar soni va taymerni shu rejaga moslaydi; javob izohi qolgan vaqtni tabiiy to‘ldiradi.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2 flex items-center justify-between">
                <span>Suxandon ovozi (AI)</span>
                {!hasPremiumAccess && (
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
                    if (selectedVal !== "Kore" && !hasPremiumAccess) {
                      onOpenPaywall();
                      return;
                    }
                    setQuiz({ ...quiz, voiceName: selectedVal });
                  }}
                  className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="Kore" className="bg-neutral-900">Kore (Ayol, sokin)</option>
                  <option value="Aoede" className="bg-neutral-900">Aoede (Ayol, jarangdor) {!hasPremiumAccess ? "🔒" : ""}</option>
                  <option value="Puck" className="bg-neutral-900">Puck (Erkak, energiya) {!hasPremiumAccess ? "🔒" : ""}</option>
                  <option value="Charon" className="bg-neutral-900">Charon (Erkak, jiddiy) {!hasPremiumAccess ? "🔒" : ""}</option>
                  <option value="Fenrir" className="bg-neutral-900">Fenrir (Erkak, chuqur) {!hasPremiumAccess ? "🔒" : ""}</option>
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
                min={isYouTubeFormat ? 8 : 1}
                max={isYouTubeFormat ? 12 : 30}
                value={quiz.timerDuration || 5}
                onChange={(e) => {
                  const fallback = isYouTubeFormat ? longVideoPreset.timerSeconds : 5;
                  setQuiz({ ...quiz, timerDuration: parseInt(e.target.value) || fallback });
                }}
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
                  { id: 'chalk', name: 'Chalk Board', desc: 'Doska/Bo\'r', premium: true },
                  { id: 'kids', name: 'Kids Cartoon', desc: 'Yorqin/Quvnoq', premium: true },
                  { id: 'neon', name: 'Neon Glow', desc: 'Elektr/Yashil', premium: true }
                ].map((preset) => {
                  const isLocked = preset.premium && !hasPremiumAccess;
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
                {!hasPremiumAccess && (
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1 font-bold uppercase tracking-wider">
                    🔒 Premium
                  </span>
                )}
              </label>
              <input
                type="text"
                placeholder="@TarixQuiz"
                readOnly={!hasPremiumAccess}
                onClick={() => {
                  if (!hasPremiumAccess) {
                    onOpenPaywall();
                  }
                }}
                value={hasPremiumAccess ? (quiz.watermark || "") : "@QuizVideo"}
                onChange={(e) => {
                  if (!hasPremiumAccess) {
                    onOpenPaywall();
                    return;
                  }
                  setQuiz({ ...quiz, watermark: e.target.value });
                }}
                className={`w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                  !hasPremiumAccess ? "opacity-50 cursor-pointer select-none bg-slate-950/50" : ""
                }`}
              />
              {!hasPremiumAccess && (
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
              <div className="pt-2 space-y-3">
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Musiqa uslubi (BGM Style)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['calm', 'happy', 'tense', 'custom'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setQuiz({ ...quiz, bgmType: style })}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold capitalize transition-all border cursor-pointer ${
                        (quiz.bgmType || 'calm') === style
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm"
                          : "bg-black/30 border-white/5 text-neutral-400 hover:text-white hover:border-white/10"
                      }`}
                    >
                      {style === 'calm'
                        ? '🍃 Sokin'
                        : style === 'happy'
                        ? '🎉 Quvnoq'
                        : style === 'tense'
                        ? '⚡️ Hayajonli'
                        : '📁 O\'z MP3 Musiqangiz'}
                    </button>
                  ))}
                </div>

                {/* Custom MP3 Upload Card */}
                {quiz.bgmType === 'custom' && (
                  <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                          <Music size={14} />
                          O'zingizning MP3 musiqangiz:
                        </p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          {quiz.customBgmName || "Hali musiqa yuklanmagan (.mp3, .wav, .m4a)"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {quiz.customBgmBase64 && (
                          <button
                            type="button"
                            onClick={() => playAudio(quiz.customBgmBase64!, "custom_bgm")}
                            className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            {playingAudioId === "custom_bgm" ? <Pause size={14} /> : <Play size={14} />}
                            {playingAudioId === "custom_bgm" ? "To'xtatish" : "Eshitish"}
                          </button>
                        )}

                        <label className="py-2 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-md">
                          <Upload size={14} />
                          {quiz.customBgmBase64 ? "Almashtirish" : "MP3 Yuklash"}
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={handleCustomBgmUpload}
                          />
                        </label>

                        {quiz.customBgmBase64 && (
                          <button
                            type="button"
                            onClick={() =>
                              setQuiz({
                                ...quiz,
                                customBgmBase64: undefined,
                                customBgmName: undefined,
                                bgmType: 'calm',
                              })
                            }
                            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold transition-all cursor-pointer"
                            title="Musiqani o'chirish"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* BGM Volume Slider */}
                <div className="p-3.5 rounded-2xl border border-white/10 bg-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                      <Volume2 size={15} className="text-emerald-400" />
                      Musiqa ovozi balandligi (Volume):
                    </span>
                    <span className="font-mono font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      {Math.round((quiz.bgmVolume !== undefined ? quiz.bgmVolume : 0.20) * 100)}%
                      {Math.round((quiz.bgmVolume !== undefined ? quiz.bgmVolume : 0.20) * 100) === 20 ? " (Tavsiya)" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <VolumeX size={16} className="text-neutral-500 shrink-0" />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={Math.round((quiz.bgmVolume !== undefined ? quiz.bgmVolume : 0.20) * 100)}
                      onChange={(e) => {
                        const val = Number(e.target.value) / 100;
                        setQuiz({ ...quiz, bgmVolume: val });
                        setBGMVolume(val);
                      }}
                      className="flex-1 h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <Volume2 size={16} className="text-emerald-400 shrink-0" />
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-tight">
                    * AI suxandon ovozi aniq eshitilishi uchun <b>15% - 30%</b> oralig'i eng maqbul hisoblanadi.
                  </p>
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
                  Javobdan keyingi qisqa tushuntirish
                </label>
                <textarea
                  value={q.explanation || ""}
                  onChange={(e) => updateQuestion(qIndex, { ...q, explanation: e.target.value })}
                  rows={2}
                  maxLength={240}
                  className="w-full resize-y bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3.5 text-white font-medium focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-neutral-600"
                  placeholder="Example: The Pacific is the world's largest and deepest ocean."
                />
                <p className="mt-1.5 text-xs text-neutral-500">
                  Bu matn javob ochilganda ekranda chiqadi va AI ovoz bilan o‘qiladi.
                </p>
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
                              } catch (err: any) {
                                console.error(err);
                                handleTTSError(err);
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
                            } catch (err: any) {
                              console.error(err);
                              handleTTSError(err);
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
                    Ovoz sozlamalari
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
                        disabled={generatingAudioId !== null}
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
                        disabled={generatingAudioId !== null}
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

        <div className="mt-8 mb-4">
          <SocialCopyCard quiz={quiz} />
        </div>
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
              onClick={() => handleExport(false)}
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
