import React, { useState, useEffect, useRef } from "react";
import { Quiz } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { X, Maximize2, RotateCcw, Heart } from "lucide-react";
import { playPCMAsync, stopPCM } from "../services/tts";
import { playPop, playTick, playSuccess, startProceduralBGM, stopProceduralBGM } from "../services/sfx";
import { getVideoStrings } from "../services/i18n";

interface PlayerProps {
  quiz: Quiz;
  onExit: () => void;
}

export function Player({ quiz, onExit }: PlayerProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [phase, setPhase] = useState<
    "init" | "question" | "options" | "timer" | "reveal" | "end"
  >("init");
  const [timerCountdown, setTimerCountdown] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const question = quiz.questions[currentQuestionIndex];
  // Video matnlari quiz tiliga mos (preview eksport bilan bir xil ko'rinsin)
  const vs = getVideoStrings(quiz.language);

  // BGM butun preview davomida bitta joydan boshqariladi (savol almashganda uzilmasin)
  useEffect(() => {
    if (quiz.bgmEnabled) {
      startProceduralBGM(undefined, quiz.bgmType);
    }
    return () => {
      stopProceduralBGM();
    };
  }, [quiz.bgmEnabled, quiz.bgmType]);

  useEffect(() => {
    if (!question) return;

    let isCancelled = false;

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const runSequence = async () => {
      setPhase("init");
      await sleep(500);
      if (isCancelled) return;

      setPhase("question");
      
      let audioPromise = Promise.resolve();
      if (question.audioBase64) {
        audioPromise = playPCMAsync(question.audioBase64);
      }

      // Wait 2 seconds for the user to read the question while audio starts
      await sleep(2000);
      if (isCancelled) return;

      setPhase("options");
      question.options.forEach((_, idx) => {
        setTimeout(() => {
          if (!isCancelled) playPop();
        }, idx * 150);
      });
      
      // Wait for options animation to finish
      await sleep(question.options.length * 150 + 500);
      if (isCancelled) return;

      // IMPORTANT: Wait for the audio to completely finish before starting the timer
      await audioPromise;
      if (isCancelled) return;

      // Small pause after audio finishes
      await sleep(500);
      if (isCancelled) return;

      setPhase("timer");
      const duration = quiz.timerDuration || 5;
      setTimerCountdown(duration);
      for (let i = 0; i < duration; i++) {
        if (isCancelled) return;
        setTimerCountdown(duration - i);
        playTick();
        await sleep(1000);
      }
      if (isCancelled) return;
      setTimerCountdown(0);

      setPhase("reveal");
      playSuccess();
      let revealAudioPromise = Promise.resolve();
      if (question.correctAudioBase64) {
        revealAudioPromise = playPCMAsync(question.correctAudioBase64);
      }
      
      // Wait for at least 3 seconds or until the audio finishes
      await Promise.all([revealAudioPromise, sleep(3000)]);
      if (isCancelled) return;

      setPhase("end");
      await sleep(500);
      if (isCancelled) return;

      if (currentQuestionIndex < quiz.questions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1);
      } else {
        setPhase("outro");
        playSuccess(); // Small chime for outro
        await sleep(4000);
        if (isCancelled) return;
        
        stopProceduralBGM();
        setPhase("done"); // Trigger end screen
      }
    };

    runSequence();

    return () => {
      isCancelled = true;
      stopPCM();
    };
    // MUHIM: `phase` bu ro'yxatga qo'shilmasin — setPhase har safar effektni qayta
    // ishga tushirib, ketma-ketlikni bekor qiladi (init<->question cheksiz aylanish).
  }, [currentQuestionIndex, quiz.questions.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  if (phase === 'outro') {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl z-0" />
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="z-10 flex flex-col items-center text-center"
        >
          <Heart size={80} className="text-rose-500 mb-6 drop-shadow-[0_0_30px_rgba(243,63,94,0.6)] animate-pulse" fill="currentColor" />
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 drop-shadow-lg">{vs.outroTitle}</h2>
          <p className="text-xl md:text-2xl text-neutral-300 font-medium">{vs.outroSubtitle}</p>
          
          {quiz.watermark && (
            <div className="mt-12 bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/20">
              <span className="text-2xl font-bold tracking-wider">{quiz.watermark}</span>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  if (phase === 'done' || currentQuestionIndex >= quiz.questions.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 text-white p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-neutral-900 p-8 rounded-3xl text-center max-w-md w-full border border-neutral-800 shadow-2xl"
        >
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <RotateCcw size={40} className="text-emerald-500" />
          </div>
          <h2 className="text-3xl font-bold mb-2">Test yakunlandi!</h2>
          <p className="text-neutral-400 mb-8">
            Barcha savollar namoyish etildi.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setCurrentQuestionIndex(0)}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-xl font-semibold transition-colors"
            >
              <RotateCcw size={20} /> Qayta boshlash
            </button>
            <button
              onClick={onExit}
              className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-6 py-4 rounded-xl font-semibold transition-colors"
            >
              <X size={20} /> Tahrirlashga qaytish
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const themeParams = {
    emerald: { from: "from-emerald-500", to: "to-emerald-400", border: "border-emerald-300/50", shadow: "shadow-[0_0_15px_rgba(16,185,129,0.5)]" },
    cyan: { from: "from-cyan-500", to: "to-cyan-400", border: "border-cyan-300/50", shadow: "shadow-[0_0_15px_rgba(6,182,212,0.5)]" },
    violet: { from: "from-violet-500", to: "to-violet-400", border: "border-violet-300/50", shadow: "shadow-[0_0_15px_rgba(139,92,246,0.5)]" },
    rose: { from: "from-rose-500", to: "to-rose-400", border: "border-rose-300/50", shadow: "shadow-[0_0_15px_rgba(244,63,94,0.5)]" },
    amber: { from: "from-amber-500", to: "to-amber-400", border: "border-amber-300/50", shadow: "shadow-[0_0_15px_rgba(245,158,11,0.5)]" }
  };
  const activeTheme = themeParams[quiz.themeColor || "emerald"];

  const presets = {
    default: {
      container: "relative w-full max-w-[420px] max-h-[85vh] aspect-[9/16] bg-neutral-900 rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-[8px] ring-neutral-900/90 box-border",
      overlay: "absolute inset-0 bg-gradient-to-b from-black/70 via-black/35 to-black/95 pointer-events-none",
      progress: "absolute top-8 left-8 sm:left-8 bg-black/55 backdrop-blur-md px-4 py-1.5 rounded-2xl border border-white/10 text-white/95 font-sans text-xs font-bold tracking-widest uppercase shadow-lg flex items-center gap-1.5",
      questionBox: "bg-black/40 backdrop-blur-md text-white w-full rounded-[2rem] p-6 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.4)] mb-8 sm:mb-12 text-center relative border border-white/10",
      questionText: "text-xl sm:text-2xl md:text-3xl font-display font-black leading-tight tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] text-white",
      optionNormal: "bg-white/10 backdrop-blur-2xl text-white border-white/20 hover:bg-white/20",
      optionCorrect: `bg-gradient-to-r ${activeTheme.from} ${activeTheme.to} ${activeTheme.border} text-white font-bold drop-shadow-md shadow-[0_0_20px_rgba(16,185,129,0.4)]`,
      optionIncorrect: "bg-black/50 backdrop-blur-xl text-white/30 border-white/5",
      letter: "bg-black/20 text-white border border-transparent",
      gridOverlay: null as React.ReactNode
    },
    cyberpunk: {
      container: "relative w-full max-w-[420px] max-h-[85vh] aspect-[9/16] bg-purple-950 rounded-[3rem] overflow-hidden shadow-[0_0_30px_rgba(240,46,170,0.4)] ring-[8px] ring-fuchsia-500/30 box-border border-2 border-fuchsia-500/50",
      overlay: "absolute inset-0 bg-gradient-to-b from-purple-950/40 via-neutral-950/70 to-neutral-950/95 pointer-events-none",
      progress: "absolute top-8 left-8 sm:left-8 bg-fuchsia-500/20 backdrop-blur-xl px-4 py-1.5 rounded-full border border-fuchsia-500/50 text-fuchsia-300 font-mono text-xs uppercase tracking-widest font-bold shadow-[0_0_10px_rgba(240,46,170,0.2)]",
      questionBox: "bg-neutral-900/95 border-2 border-cyan-400 text-cyan-300 w-full rounded-[2rem] p-6 sm:p-8 shadow-[0_0_25px_rgba(34,211,238,0.3)] mb-8 sm:mb-12 text-center relative",
      questionText: "text-xl sm:text-2xl md:text-3xl font-mono font-bold leading-tight tracking-tight text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]",
      optionNormal: "bg-neutral-900/80 hover:bg-neutral-900 border-purple-500/40 text-purple-300 hover:border-purple-400 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]",
      optionCorrect: "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white font-extrabold border-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.6)] animate-pulse",
      optionIncorrect: "bg-neutral-950/90 text-neutral-600 border-neutral-900",
      letter: "bg-purple-950 text-cyan-300 border border-cyan-500/30",
      gridOverlay: (
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-30 pointer-events-none z-0" />
      ) as React.ReactNode
    },
    retro: {
      container: "relative w-full max-w-[420px] max-h-[85vh] aspect-[9/16] bg-black rounded-[2rem] overflow-hidden shadow-[12px_12px_0px_0px_#000000] ring-[8px] ring-yellow-400 box-border border-4 border-yellow-400",
      overlay: "absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80 pointer-events-none",
      progress: "absolute top-8 left-8 sm:left-8 bg-black border-2 border-yellow-400 px-4 py-1.5 rounded-none text-yellow-400 font-mono text-xs uppercase font-black tracking-wider shadow-[4px_4px_0px_0px_rgba(234,179,8,0.3)]",
      questionBox: "bg-black border-4 border-yellow-400 text-yellow-400 w-full rounded-none p-6 sm:p-8 shadow-[6px_6px_0px_0px_#ca8a04] mb-8 sm:mb-12 text-center relative",
      questionText: "text-xl sm:text-2xl md:text-3xl font-mono font-black leading-tight tracking-wider text-yellow-400 uppercase",
      optionNormal: "bg-black hover:bg-neutral-900 border-2 border-white text-white rounded-none shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all",
      optionCorrect: "bg-yellow-400 text-black font-black border-4 border-yellow-500 rounded-none shadow-[6px_6px_0px_0px_#ca8a04]",
      optionIncorrect: "bg-neutral-900 text-neutral-600 border-2 border-neutral-800 rounded-none line-through",
      letter: "bg-black text-yellow-400 border-2 border-yellow-400 rounded-none font-black",
      gridOverlay: (
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%)] bg-[length:100%_6px] pointer-events-none opacity-40 z-0" />
      ) as React.ReactNode
    },
    sunset: {
      container: "relative w-full max-w-[420px] max-h-[85vh] aspect-[9/16] bg-amber-950 rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(234,88,12,0.2)] ring-[8px] ring-orange-950/80 box-border border border-orange-500/20",
      overlay: "absolute inset-0 bg-gradient-to-b from-amber-950/40 via-red-950/20 to-black/95 pointer-events-none",
      progress: "absolute top-8 left-8 sm:left-8 bg-orange-500/10 backdrop-blur-xl px-4 py-1.5 rounded-full border border-orange-500/30 text-orange-200 font-mono text-xs uppercase font-bold shadow-lg",
      questionBox: "bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 text-white w-full rounded-[2rem] p-6 sm:p-8 shadow-[0_10px_25px_rgba(234,88,12,0.3)] mb-8 sm:mb-12 text-center relative border border-yellow-400/30",
      questionText: "text-xl sm:text-2xl md:text-3xl font-display font-black leading-tight tracking-tight text-white drop-shadow-md",
      optionNormal: "bg-amber-500/10 hover:bg-amber-500/20 border-orange-500/20 text-orange-200 hover:border-orange-500/40",
      optionCorrect: "bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold border-yellow-400 shadow-[0_0_20px_rgba(234,88,12,0.4)]",
      optionIncorrect: "bg-black/60 text-orange-950/40 border-orange-950/20",
      letter: "bg-orange-950/40 text-orange-300 border border-transparent",
      gridOverlay: null as React.ReactNode
    },
    chalk: {
      container: "relative w-full max-w-[420px] max-h-[85vh] aspect-[9/16] bg-neutral-900 rounded-[1.5rem] overflow-hidden shadow-2xl ring-[8px] ring-amber-900/60 box-border border-8 border-amber-950",
      overlay: "absolute inset-0 bg-radial-gradient from-transparent to-neutral-950/90 pointer-events-none",
      progress: "absolute top-8 left-8 sm:left-8 bg-neutral-800/80 border border-white/20 px-4 py-1.5 rounded-lg text-neutral-200 font-serif text-xs tracking-wider",
      questionBox: "bg-neutral-800/40 backdrop-blur-sm border-2 border-dashed border-white/30 text-white w-full rounded-xl p-6 sm:p-8 shadow-lg mb-8 sm:mb-12 text-center relative",
      questionText: "text-xl sm:text-2xl md:text-3xl font-serif italic tracking-wide text-white drop-shadow-sm",
      optionNormal: "bg-transparent border border-white/20 hover:border-white/40 text-neutral-200 hover:bg-white/5",
      optionCorrect: "bg-white text-neutral-950 font-black border-2 border-neutral-300 shadow-md",
      optionIncorrect: "bg-neutral-800/30 text-neutral-500 border border-neutral-800/50 line-through decoration-neutral-600/50",
      letter: "bg-neutral-800 text-white border border-white/15",
      gridOverlay: (
        <div className="absolute inset-0 bg-neutral-950/20 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-10 z-0" />
      ) as React.ReactNode
    }
  };

  const activePreset = presets[quiz.themePreset || "default"];

  const effect = quiz.transitionEffect || "slide";

  const transitionVariants = {
    initial: {
      opacity: 0,
      x: effect === "slide" ? 150 : 0,
      scale: effect === "zoom" ? 0.8 : 1,
    },
    animate: {
      opacity: 1,
      x: 0,
      scale: 1,
    },
    exit: {
      opacity: 0,
      x: effect === "slide" ? -150 : 0,
      scale: effect === "zoom" ? 0.8 : 1,
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blur effect */}
      <div
        className="absolute inset-0 opacity-20 blur-3xl scale-110"
        style={{
          backgroundImage: `url(${question.backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div className="absolute top-6 right-6 z-50 flex gap-3">
        <button
          onClick={toggleFullscreen}
          className="p-3 bg-neutral-800/80 hover:bg-neutral-700 backdrop-blur rounded-full text-white transition-colors shadow-lg"
        >
          <Maximize2 size={20} />
        </button>
        <button
          onClick={onExit}
          className="p-3 bg-neutral-800/80 hover:bg-neutral-700 backdrop-blur rounded-full text-white transition-colors shadow-lg"
        >
          <X size={20} />
        </button>
      </div>

      {/* 9:16 Video Container (Simulated Device) */}
      <div
        ref={containerRef}
        className={`${activePreset.container} relative overflow-hidden`}
      >
        {/* Background Image with Transition */}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 z-0 pointer-events-none"
            style={{
              backgroundImage: `url(${question.backgroundImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        </AnimatePresence>

        {/* Dark Overlay gradient */}
        <div className={`${activePreset.overlay} z-1 pointer-events-none`} />

        {/* Custom preset overlays if any */}
        <div className="absolute inset-0 z-2 pointer-events-none">
          {activePreset.gridOverlay}
        </div>

        {/* Content */}
        <div className="absolute inset-0 flex flex-col p-6 sm:p-8 z-10">
          
          {/* Progress Indicator */}
          <div className={`${activePreset.progress} z-10`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse opacity-80" />
            <span>{vs.questionBadge}: {currentQuestionIndex + 1} / {quiz.questions.length}</span>
          </div>

          <div className="flex-1 flex flex-col justify-center relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestionIndex}
                variants={transitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.5 }}
                className="w-full flex flex-col justify-center"
              >
                {/* Question Box */}
                <AnimatePresence>
                  {(phase === "question" ||
                    phase === "options" ||
                    phase === "timer" ||
                    phase === "reveal") && (
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, y: -20 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className={activePreset.questionBox}
                    >
                      <h2 className={activePreset.questionText}>
                        {question.text}
                      </h2>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Options */}
                <div className="w-full space-y-3 sm:space-y-4">
                  <AnimatePresence>
                    {(phase === "options" ||
                      phase === "timer" ||
                      phase === "reveal") &&
                      question.options.map((opt, idx) => {
                        const isReveal = phase === "reveal";
                        const isCorrect = idx === question.correctOptionIndex;

                        let optionStyle = activePreset.optionNormal;
                        let scale = 1;

                        if (isReveal) {
                          if (isCorrect) {
                            optionStyle = typeof activePreset.optionCorrect === 'function' ? (activePreset.optionCorrect as any)(activeTheme) : activePreset.optionCorrect;
                            scale = 1.05;
                          } else {
                            optionStyle = activePreset.optionIncorrect;
                            scale = 0.98;
                          }
                        }

                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0, scale }}
                            transition={{
                              delay: idx * 0.15,
                              type: "spring",
                              stiffness: 300,
                              damping: 25,
                            }}
                            className={`w-full border-[1.5px] rounded-2xl p-4 sm:p-5 text-center text-lg sm:text-xl font-semibold transition-all duration-500 shadow-xl ${optionStyle}`}
                          >
                            <div className="flex items-center">
                              <div className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center rounded-full text-sm sm:text-base font-bold shadow-inner mr-3 ${activePreset.letter}`}>
                                {['A', 'B', 'C', 'D'][idx]}
                              </div>
                              <div className="flex-1 text-left">
                                {opt}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                  </AnimatePresence>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Timer Bar */}
          <div className="min-h-[100px] flex items-center justify-center pb-4 sm:pb-6 mt-2">
            <AnimatePresence>
              {(phase === "timer" || phase === "reveal") && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="w-full flex justify-center"
                >
                  {quiz.timerStyle === "circular" ? (
                    <div className="relative flex flex-col items-center justify-center">
                      <div className="relative w-16 h-16 sm:w-20 sm:h-20">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          {/* Background circle */}
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            className="stroke-white/10"
                            strokeWidth="8"
                            fill="transparent"
                          />
                          {/* Active glowing circle */}
                          <motion.circle
                            cx="50"
                            cy="50"
                            r="42"
                            className="stroke-current"
                            style={{
                              stroke: quiz.themeColor === "emerald" ? "#10b981" :
                                      quiz.themeColor === "cyan" ? "#06b6d4" :
                                      quiz.themeColor === "violet" ? "#8b5cf6" :
                                      quiz.themeColor === "rose" ? "#f43f5e" : "#f59e0b"
                            }}
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={2 * Math.PI * 42}
                            initial={{ strokeDashoffset: 0 }}
                            animate={{
                              strokeDashoffset: (2 * Math.PI * 42) * (1 - (phase === "reveal" ? 0 : timerCountdown) / (quiz.timerDuration || 5))
                            }}
                            transition={{ duration: phase === "reveal" ? 0.3 : 1, ease: "linear" }}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                          <span className="text-xl sm:text-2xl font-display font-black leading-none tracking-tight">
                            {phase === "reveal" ? "✓" : timerCountdown}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-white/50 tracking-[0.2em] font-display uppercase font-black mt-2">
                        {phase === "timer" ? vs.seconds : vs.ready}
                      </span>
                    </div>
                  ) : quiz.timerStyle === "digital" ? (
                    <div className="w-full flex justify-center">
                      <div className="bg-neutral-900/90 border-2 border-white/10 rounded-2xl px-5 py-3 font-mono shadow-[inset_0_0_15px_rgba(0,0,0,0.9)] backdrop-blur-xl relative overflow-hidden flex items-center gap-4 min-w-[170px] justify-center">
                        {/* Scanlines and indicator */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.2)_50%)] bg-[length:100%_4px] pointer-events-none" />
                        
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] uppercase tracking-widest text-neutral-500 font-bold">TIMER</span>
                          <span className={`text-2xl sm:text-3xl font-black tracking-widest font-mono tabular-nums ${
                            quiz.themeColor === 'emerald' ? 'text-emerald-400' :
                            quiz.themeColor === 'cyan' ? 'text-cyan-400' :
                            quiz.themeColor === 'violet' ? 'text-violet-400' :
                            quiz.themeColor === 'rose' ? 'text-rose-400' : 'text-amber-400'
                          } drop-shadow-[0_0_6px_currentColor]`}>
                            00:{String(phase === "reveal" ? 0 : timerCountdown).padStart(2, '0')}
                          </span>
                        </div>

                        <div className="h-8 w-[1px] bg-white/10" />

                        <div className="flex flex-col items-center">
                          <span className="text-[8px] uppercase tracking-widest text-neutral-500 font-bold">STATUS</span>
                          <span className={`text-[10px] font-bold tracking-wider ${phase === 'reveal' ? 'text-emerald-400 animate-pulse' : 'text-amber-400 animate-pulse'}`}>
                            {phase === 'reveal' ? 'REVEAL' : 'RUNNING'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Glowing line */
                    <div className="w-full">
                      <div className="flex justify-between items-center text-white/90 text-xs sm:text-sm mb-3 font-display font-black uppercase tracking-[0.2em] drop-shadow-md">
                        <span>{phase === "timer" ? vs.thinking : vs.correctAnswer}</span>
                        <span className={`text-sm sm:text-base font-black ${
                          quiz.themeColor === 'emerald' ? 'text-emerald-400' :
                          quiz.themeColor === 'cyan' ? 'text-cyan-400' :
                          quiz.themeColor === 'violet' ? 'text-violet-400' :
                          quiz.themeColor === 'rose' ? 'text-rose-400' : 'text-amber-400'
                        } animate-pulse`}>
                          {phase === "reveal" ? "0" : timerCountdown}s
                        </span>
                      </div>
                      <div className="h-3 w-full bg-black/50 backdrop-blur-xl rounded-full overflow-hidden border border-white/20 shadow-inner">
                        <motion.div
                          initial={{ width: "100%" }}
                          animate={{ width: phase === "reveal" ? "0%" : `${(timerCountdown / (quiz.timerDuration || 5)) * 100}%` }}
                          transition={{ duration: phase === "reveal" ? 0.3 : 1, ease: "linear" }}
                          className={`h-full bg-gradient-to-r ${activeTheme.from} ${activeTheme.to} rounded-full ${activeTheme.shadow}`}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Watermark overlay - floating/bouncing across the screen */}
          {quiz.watermark && (
            <motion.div
              animate={{
                left: ["5%", "70%", "10%", "75%", "25%", "70%", "5%"],
                top: ["5%", "45%", "90%", "10%", "50%", "90%", "5%"],
                opacity: [0.25, 0.45, 0.25, 0.45, 0.25, 0.45, 0.25]
              }}
              transition={{
                duration: 25,
                ease: "linear",
                repeat: Infinity,
              }}
              className="absolute z-50 text-white font-bold tracking-widest text-[11px] bg-black/30 px-3 py-1.5 rounded-full backdrop-blur-xs border border-white/5 pointer-events-none whitespace-nowrap shadow-md"
              style={{
                textShadow: "0 1px 4px rgba(0,0,0,0.8)"
              }}
            >
              {quiz.watermark}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
