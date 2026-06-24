import { useState, useEffect, useRef } from "react";
import { Quiz } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { X, Maximize2, RotateCcw, Heart, Lightbulb } from "lucide-react";
import { playPCMAsync, stopPCM } from "../services/tts";
import { playPop, playTick, playSuccess, startProceduralBGM, stopProceduralBGM } from "../services/sfx";

interface PlayerProps {
  quiz: Quiz;
  onExit: () => void;
}

export function Player({ quiz, onExit }: PlayerProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [phase, setPhase] = useState<
    "init" | "question" | "options" | "timer" | "reveal" | "end" | "outro" | "done"
  >("init");
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const question = quiz.questions[currentQuestionIndex];

  const ratio = quiz.aspectRatio || '9:16';
  let containerDimensionsClass = "max-w-[420px] aspect-[9/16] rounded-[3rem] pt-12 pb-10";
  if (ratio === '16:9') {
    containerDimensionsClass = "max-w-[850px] aspect-[16/9] rounded-[2rem] pt-6 pb-6";
  } else if (ratio === '1:1') {
    containerDimensionsClass = "max-w-[500px] aspect-[1/1] rounded-[2.5rem] pt-8 pb-8";
  }

  useEffect(() => {
    if (!question) return;

    let isCancelled = false;

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const runSequence = async () => {
      if (currentQuestionIndex === 0 && phase === 'init' && quiz.bgmEnabled) {
          startProceduralBGM(undefined, quiz.customBgmBase64);
      }

      setPhase("init");
      await sleep(500);
      if (isCancelled) return;

      setPhase("question");
      
      let audioPromise = Promise.resolve();
      if (question.audioBase64) {
        audioPromise = playPCMAsync(question.audioBase64);
      }

      await sleep(2000);
      if (isCancelled) return;

      setPhase("options");
      question.options.forEach((_, idx) => {
        setTimeout(() => {
          if (!isCancelled) playPop();
        }, idx * 150);
      });
      
      await sleep(question.options.length * 150 + 500);
      if (isCancelled) return;

      await audioPromise;
      if (isCancelled) return;

      await sleep(500);
      if (isCancelled) return;

      setPhase("timer");
      const duration = quiz.timerDuration || 5;
      for (let i = duration; i > 0; i--) {
        if (isCancelled) return;
        setTimeLeft(i);
        playTick();
        await sleep(1000);
      }
      if (isCancelled) return;

      setPhase("reveal");
      playSuccess();
      let revealAudioPromise = Promise.resolve();
      if (question.correctAudioBase64) {
        revealAudioPromise = playPCMAsync(question.correctAudioBase64);
      }
      
      // longer wait if there is a fact to read / show
      const revealWait = question.fact ? Math.max(5000, 3000) : 3000;
      await Promise.all([revealAudioPromise, sleep(revealWait)]);
      if (isCancelled) return;

      setPhase("end");
      await sleep(500);
      if (isCancelled) return;

      if (currentQuestionIndex < quiz.questions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1);
      } else {
        setPhase("outro");
        playSuccess(); 
        await sleep(4000);
        if (isCancelled) return;
        
        stopProceduralBGM();
        setPhase("done"); 
      }
    };

    if (phase !== 'outro' && phase !== 'done') {
      runSequence();
    }

    return () => {
      isCancelled = true;
      stopPCM();
      stopProceduralBGM();
    };
  }, [currentQuestionIndex, phase, quiz.questions.length]);

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
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 drop-shadow-lg">Videoga Like Bosing!</h2>
          <p className="text-xl md:text-2xl text-neutral-300 font-medium">Kanalga obuna bo'lishni unutmang</p>
          
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

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
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

      <div
        ref={containerRef}
        className={`relative w-full max-h-[85vh] bg-neutral-900 overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.6)] ring-[12px] ring-neutral-950 border border-white/10 box-border ${containerDimensionsClass}`}
        style={{
          backgroundImage: `url(${question.backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/50 pointer-events-none" />

        {/* Simulated Phone Bezel Status Bar & Speaker Notch (only in 9:16) */}
        {ratio === '9:16' && (
          <>
            <div className="absolute top-2 left-0 right-0 px-8 h-6 flex justify-between items-center z-30 text-white/40 text-[10px] font-semibold tracking-wider select-none pointer-events-none">
              <span>09:41</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px]">5G</span>
                <div className="w-5 h-2.5 border border-white/20 rounded-[3px] p-0.5 flex items-center">
                  <div className="h-full w-full bg-white/40 rounded-[1px]" />
                </div>
              </div>
            </div>
            {/* Notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4.5 bg-black rounded-full z-40 flex items-center justify-center gap-1.5 border border-white/5 shadow-inner">
              <div className="w-8 h-1 bg-neutral-900 rounded-full" />
              <div className="w-1.5 h-1.5 bg-neutral-950 rounded-full border border-neutral-900" />
            </div>
          </>
        )}

        <div className="relative w-full h-full flex flex-col items-center px-6 sm:px-8 z-10 justify-between">
          
          {/* Top Pill / Badge */}
          <AnimatePresence mode="wait">
            {phase === "reveal" ? (
              <motion.div
                key="reveal"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-500/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-emerald-500/50"
              >
                <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest drop-shadow-sm">
                  TO'G'RI JAVOB: {['A', 'B', 'C', 'D'][question.correctOptionIndex]}
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="normal"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20"
              >
                <span className="text-emerald-300 font-bold text-xs uppercase tracking-widest drop-shadow-sm">
                  JAVOBINI TOP
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Question Title */}
          <div className="mt-8 mb-auto text-center w-full">
            <AnimatePresence>
              {(phase === "question" || phase === "options" || phase === "timer" || phase === "reveal") && (
                <motion.h1
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-2xl sm:text-[1.7rem] font-bold text-white leading-tight drop-shadow-md text-balance"
                >
                  {question.text}
                </motion.h1>
              )}
            </AnimatePresence>
          </div>

          {/* Options List */}
          <div className={`w-full relative z-20 ${ratio === '16:9' ? 'grid grid-cols-2 gap-4' : 'flex flex-col space-y-3'}`}>
            <AnimatePresence>
              {(phase === "options" || phase === "timer" || phase === "reveal") &&
                question.options.map((opt, idx) => {
                  const isReveal = phase === "reveal";
                  const isCorrect = idx === question.correctOptionIndex;
                  const letter = ['A', 'B', 'C', 'D'][idx];

                  let containerClasses = "bg-[#1a1a1a]/80 border border-white/10";
                  let letterClasses = "bg-white text-black";
                  let textClasses = "text-white";
                  let opacity = 1;

                  if (isReveal) {
                    if (isCorrect) {
                      containerClasses = "bg-emerald-900/60 border border-emerald-500";
                      letterClasses = "bg-emerald-500 text-white border border-emerald-400";
                      textClasses = "text-emerald-400 drop-shadow-md";
                    } else {
                      opacity = 0.5;
                    }
                  }

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity, x: 0 }}
                      transition={{ delay: isReveal ? 0 : idx * 0.15, duration: 0.3 }}
                      className={`flex items-center w-full rounded-[1.25rem] p-2 backdrop-blur-sm transition-all duration-500 ${containerClasses}`}
                    >
                      <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center font-bold text-lg rounded-xl shadow-inner transition-colors duration-500 ${letterClasses}`}>
                        {letter}.
                      </div>
                      <div className={`flex-1 font-bold text-lg ml-4 mr-2 transition-colors duration-500 ${textClasses}`}>
                        {opt}
                      </div>
                    </motion.div>
                  );
                })}
            </AnimatePresence>
          </div>

          {/* Fact Info Box */}
          <div className={`${ratio === '16:9' ? 'h-auto' : 'h-32'} w-full flex items-center justify-center shrink-0`}>
            <AnimatePresence mode="popLayout">
              {(phase === "timer") && (
                <motion.div
                  key="timer-visuals"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="w-full flex flex-col items-center"
                >
                  <div className="text-amber-500 font-extrabold text-7xl leading-none drop-shadow-[0_0_15px_rgba(245,158,11,0.5)] mb-2 tracking-tighter">
                    {timeLeft}
                  </div>
                  <div className="w-3/4 h-2 bg-white/10 rounded-full overflow-hidden mt-2">
                    <motion.div
                      initial={{ width: "100%" }}
                      animate={{ width: "0%" }}
                      transition={{ duration: quiz.timerDuration || 5, ease: "linear" }}
                      className="h-full bg-amber-500"
                    />
                  </div>
                </motion.div>
              )}

              {(phase === "reveal" && question.fact) && (
                <motion.div
                  key="fact-box"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full bg-[#1e293b]/90 backdrop-blur-xl border-2 border-cyan-500/50 rounded-2xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.15)] relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Lightbulb size={48} />
                  </div>
                  <div className="flex items-center gap-2 mb-2 relative z-10">
                    <Lightbulb size={18} className="text-cyan-400" />
                    <h3 className="text-cyan-400 font-bold tracking-wide uppercase text-sm">Bilasizmi?</h3>
                  </div>
                  <p className="text-white text-sm sm:text-base font-medium leading-snug relative z-10">
                    {question.fact}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </div>
  );
}

