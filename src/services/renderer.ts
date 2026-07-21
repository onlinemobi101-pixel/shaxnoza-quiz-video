import { Quiz, Question } from "../types";
import { playPCMAsync, stopPCM } from "./tts";
import { playPop, playTick, playSuccess, startProceduralBGM, stopProceduralBGM } from "./sfx";
import { getVideoStrings, VideoStrings } from "./i18n";
import { getIntroDurationMs, getOutroDurationMs, getTargetQuestionDurationMs } from "./videoPlan";

const THEME_COLORS: Record<string, { main: string; light: string }> = {
  emerald: { main: '#10b981', light: '#34d399' },
  cyan: { main: '#06b6d4', light: '#22d3ee' },
  violet: { main: '#8b5cf6', light: '#a78bfa' },
  rose: { main: '#f43f5e', light: '#fb7185' },
  amber: { main: '#f59e0b', light: '#fbbf24' }
};

export class QuizRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  quiz: Quiz;
  stream: MediaStream;
  recorder: MediaRecorder;
  audioCtx: AudioContext;
  masterGain: GainNode;
  limiter: DynamicsCompressorNode;
  dest: MediaStreamAudioDestinationNode;
  worker: Worker;
  
  // State
  currentQuestionIndex = 0;
  phase = 'init';
  phaseStartTime = 0;
  qStartTime = 0; // Ken Burns zoom uchun savol boshlangan vaqt
  isRecording = false;
  recordedChunks: Blob[] = [];
  isCancelled = false;
  extension = 'webm';
  readonly isMobileOptimized: boolean;
  readonly outputWidth: number;
  readonly outputHeight: number;
  readonly designWidth: number;
  readonly designHeight: number;
  
  // Assets
  bgImages: Array<HTMLImageElement | undefined> = [];
  cachedLines: { [key: number]: string[] } = {};
  silenceOscillator?: OscillatorNode;
  wakeLock: any = null;
  handleVisibilityChange?: () => void;

  // Tab yashirilganda render pauza bo'ladi — audio/video surilishi (desync) oldini oladi
  isPaused = false;
  pauseStartedAt = 0;
  private resumeWaiters: (() => void)[] = [];
  
  onProgress?: (progress: number) => void;
  onComplete?: (url: string, extension: string, blob: Blob) => void | Promise<void>;
  onError?: (err: any) => void;
  onBeforeRecording?: () => Promise<void>;
  onPauseChange?: (isPaused: boolean) => void;

  strings: VideoStrings;

  constructor(quiz: Quiz) {
    this.quiz = {
      ...quiz,
      questions: quiz.questions.map((question) => ({ ...question })),
    };
    this.strings = getVideoStrings(quiz.language);
    this.canvas = document.createElement('canvas');
    const isYouTube = quiz.videoFormat === "youtube";
    this.designWidth = isYouTube ? 1920 : 1080;
    this.designHeight = isYouTube ? 1080 : 1920;
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    this.isMobileOptimized = isMobileDevice || (typeof deviceMemory === "number" && deviceMemory <= 4);
    this.outputWidth = isYouTube
      ? (this.isMobileOptimized ? 960 : 1920)
      : (this.isMobileOptimized ? 540 : 1080);
    this.outputHeight = isYouTube
      ? (this.isMobileOptimized ? 540 : 1080)
      : (this.isMobileOptimized ? 960 : 1920);
    this.canvas.width = this.outputWidth;
    this.canvas.height = this.outputHeight;
    this.ctx = this.canvas.getContext('2d', { alpha: false, willReadFrequently: true })!;
    
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 0.9;
    this.dest = this.audioCtx.createMediaStreamDestination();

    // Limiter: TTS + SFX + BGM yig'indisi 0 dBFS shiftiga urilib buzilmasligi uchun
    this.limiter = this.audioCtx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 4;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.25;

    // masterGain -> limiter -> (yozuv + karnay)
    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.dest);
    this.limiter.connect(this.audioCtx.destination);
    
    // Keep audio stream active to prevent WebM encoder from dropping silent frames (fixes A/V desync)
    this.silenceOscillator = this.audioCtx.createOscillator();
    this.silenceOscillator.type = 'sine';
    this.silenceOscillator.frequency.value = 0; // Inaudible
    this.silenceOscillator.connect(this.dest);
    this.silenceOscillator.start();
    
    const blob = new Blob([`
      let intervalId = null;
      self.onmessage = function(e) {
        if (e.data?.type === 'start') {
          intervalId = setInterval(() => self.postMessage('tick'), 1000 / e.data.fps);
        } else if (e.data === 'stop') {
          clearInterval(intervalId);
        }
      };
    `], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
    this.worker.onmessage = () => {
      if (this.isRecording) this.drawFrame();
    };
    
    // @ts-ignore
    const fps = isYouTube ? 24 : 30;
    const canvasStream = this.canvas.captureStream(fps);
    const tracks = [...canvasStream.getVideoTracks(), ...this.dest.stream.getAudioTracks()];
    this.stream = new MediaStream(tracks);
    
    let mimeType = '';
    this.extension = 'webm';
    
    const candidates = [
      { type: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' },
      { type: 'video/mp4;codecs=avc1', ext: 'mp4' },
      { type: 'video/mp4;codecs=h264', ext: 'mp4' },
      { type: 'video/mp4', ext: 'mp4' },
      { type: 'video/webm;codecs=vp9,opus', ext: 'webm' },
      { type: 'video/webm;codecs=vp8,opus', ext: 'webm' },
      { type: 'video/webm;codecs=h264', ext: 'webm' },
      { type: 'video/webm', ext: 'webm' },
      { type: 'video/quicktime;codecs=h264', ext: 'mp4' },
      { type: 'video/quicktime', ext: 'mp4' }
    ];

    const selectedCandidate = candidates.find(c => MediaRecorder.isTypeSupported(c.type));
    if (selectedCandidate) {
      mimeType = selectedCandidate.type;
      this.extension = selectedCandidate.ext;
    }

    try {
      const options: MediaRecorderOptions = {};
      if (mimeType) {
        options.mimeType = mimeType;
      }
      
      options.videoBitsPerSecond = isYouTube
        ? (this.isMobileOptimized ? 800000 : 4000000)
        : (this.isMobileOptimized ? 800000 : 6000000);
      options.audioBitsPerSecond = this.isMobileOptimized ? 96000 : 128000;
      
      this.recorder = new MediaRecorder(this.stream, options);
    } catch (e) {
      console.warn("MediaRecorder construction failed with options, trying basic initialization...", e);
      try {
        const options: MediaRecorderOptions = {};
        options.videoBitsPerSecond = isYouTube
          ? (this.isMobileOptimized ? 800000 : 4000000)
          : (this.isMobileOptimized ? 800000 : 6000000);
        options.audioBitsPerSecond = this.isMobileOptimized ? 96000 : 128000;
        this.recorder = new MediaRecorder(this.stream, options);
      } catch (e2) {
        console.error("MediaRecorder construction failed completely with options, using browser defaults", e2);
        this.recorder = new MediaRecorder(this.stream);
        if (this.recorder.mimeType) {
          mimeType = this.recorder.mimeType;
          if (mimeType.includes('mp4') || mimeType.includes('quicktime')) {
            this.extension = 'mp4';
          } else {
            this.extension = 'webm';
          }
        }
      }
    }
    
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    this.recorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: this.recorder.mimeType || mimeType });
      this.recordedChunks = [];
      const url = URL.createObjectURL(blob);
      if (this.onComplete) {
        Promise.resolve(this.onComplete(url, this.extension, blob)).catch((error) => {
          URL.revokeObjectURL(url);
          this.onError?.(error);
        });
      }
    };
    this.recorder.onerror = (event: Event) => {
      const error = (event as Event & { error?: DOMException }).error || new Error("MEDIA_RECORDER_ERROR");
      this.onError?.(error);
    };
  }
  
  async loadImage(index: number) {
    if (this.bgImages[index]) return;
    const source = this.quiz.questions[index]?.backgroundImage;
    if (!source) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = source;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
    this.bgImages[index] = img;
  }

  releaseImage(index: number) {
    const img = this.bgImages[index];
    if (!img) return;
    img.onload = null;
    img.onerror = null;
    img.removeAttribute("src");
    this.bgImages[index] = undefined;
  }

  async requestWakeLock() {
    // Render paytida ekran o'chib qolmasligi uchun (ayniqsa mobil qurilmalarda)
    try {
      this.wakeLock = await (navigator as any).wakeLock?.request('screen');
    } catch (e) {
      // Qo'llab-quvvatlanmasa yoki rad etilsa jim davom etamiz
    }
  }

  async start() {
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    await this.requestWakeLock();
    // Tab yashirilsa: renderni pauza qilamiz (desync o'rniga xavfsiz to'xtash),
    // qaytganda: wake lock qayta so'rab, davom ettiramiz.
    this.handleVisibilityChange = () => {
      if (!this.isRecording) return;
      if (document.visibilityState === 'hidden') {
        this.pauseRendering();
      } else {
        this.requestWakeLock();
        this.resumeRendering();
      }
    };
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    // Mobil RAMni tejash uchun barcha 20–30 fonni birdan dekodlamaymiz.
    // Birinchi rasmni tayyorlaymiz, keyingilarini savol navbati kelganda yuklaymiz.
    this.bgImages = new Array(this.quiz.questions.length);
    await this.loadImage(0);
    await this.onBeforeRecording?.();
    
    if (this.quiz.bgmEnabled) {
      startProceduralBGM(this.masterGain, this.quiz.bgmType);
    }
    
    this.isRecording = true;
    this.qStartTime = performance.now();
    this.drawFrame();
    // Kichik data bo'laklari uzoq eksportda bitta ulkan ichki buffer hosil bo'lishini kamaytiradi.
    this.recorder.start(2000);
    this.worker.postMessage({ type: 'start', fps: this.quiz.videoFormat === "youtube" ? 24 : 30 });

    // Hook-intro: skroll to'xtatish uchun 2 soniyalik kirish ekrani
    this.setPhase('intro');
    playPop(this.masterGain);
    await this.sleep(getIntroDurationMs(this.quiz));

    for (let i = 0; i < this.quiz.questions.length; i++) {
      if (this.isCancelled) break;
      await this.loadImage(i);
      this.currentQuestionIndex = i;
      if (i > 0) this.releaseImage(i - 1);
      await this.runQuestionSequence(this.quiz.questions[i]);
    }

    if (!this.isCancelled) {
      this.setPhase('outro');
      playSuccess(this.masterGain);
      await this.sleep(getOutroDurationMs(this.quiz));
    }
    
    stopProceduralBGM();
    this.stop();
  }

  drawRoundedRect(x: number, y: number, w: number, h: number, r: number) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }

  wrapText(text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    
    for(let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = this.ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        this.ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      }
      else {
        line = testLine;
      }
    }
    this.ctx.fillText(line, x, currentY);
    return currentY + lineHeight;
  }

  getWrappedLines(text: string, maxWidth: number, maxLines = 3): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (this.ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
        if (lines.length === maxLines - 1) break;
      } else {
        line = candidate;
      }
    }

    if (line && lines.length < maxLines) {
      const consumedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
      const remaining = words.slice(consumedWords).join(" ");
      let finalLine = remaining || line;
      while (this.ctx.measureText(finalLine).width > maxWidth && finalLine.length > 1) {
        finalLine = finalLine.slice(0, -1);
      }
      if (finalLine !== remaining) finalLine = `${finalLine.trimEnd()}…`;
      lines.push(finalLine);
    }

    return lines;
  }

  drawYouTubeFrame() {
    const w = this.designWidth;
    const h = this.designHeight;
    const q = this.quiz.questions[this.currentQuestionIndex];
    if (!q) return;

    const activeTheme = THEME_COLORS[this.quiz.themeColor || "emerald"];
    const now = performance.now();
    const phaseTime = now - this.phaseStartTime;
    const bgImg = this.bgImages[this.currentQuestionIndex];

    if (bgImg?.complete && bgImg.naturalWidth > 0) {
      const kenBurns = 1 + 0.045 * Math.min(1, (now - this.qStartTime) / 24000);
      const scale = Math.max(w / bgImg.width, h / bgImg.height) * kenBurns;
      const x = (w - bgImg.width * scale) / 2;
      const y = (h - bgImg.height * scale) / 2;
      this.ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale);
    } else {
      this.ctx.fillStyle = "#0b1020";
      this.ctx.fillRect(0, 0, w, h);
    }

    const overlay = this.ctx.createLinearGradient(0, 0, w, h);
    overlay.addColorStop(0, "rgba(3,7,18,0.91)");
    overlay.addColorStop(0.55, "rgba(3,7,18,0.68)");
    overlay.addColorStop(1, "rgba(3,7,18,0.94)");
    this.ctx.fillStyle = overlay;
    this.ctx.fillRect(0, 0, w, h);

    if (this.phase === "intro") {
      const p = Math.min(1, phaseTime / 500);
      this.ctx.save();
      this.ctx.globalAlpha = p;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";

      this.ctx.font = '900 34px system-ui, -apple-system, sans-serif';
      const badgeWidth = Math.max(430, this.ctx.measureText(this.strings.introBadge).width + 100);
      this.ctx.fillStyle = activeTheme.main;
      this.drawRoundedRect((w - badgeWidth) / 2, 205, badgeWidth, 76, 38);
      this.ctx.fill();
      this.ctx.fillStyle = "#fff";
      this.ctx.fillText(this.strings.introBadge, w / 2, 243);

      this.ctx.font = '900 100px system-ui, -apple-system, sans-serif';
      const titleLines = this.getWrappedLines((this.quiz.title || "QUIZ").toUpperCase(), 1540, 3);
      const titleStart = 435 - ((titleLines.length - 1) * 110) / 2;
      this.ctx.shadowColor = "rgba(0,0,0,0.65)";
      this.ctx.shadowBlur = 28;
      titleLines.forEach((line, index) => this.ctx.fillText(line, w / 2, titleStart + index * 110));
      this.ctx.shadowColor = "transparent";

      this.ctx.fillStyle = "rgba(255,255,255,0.82)";
      this.ctx.font = '600 42px system-ui, -apple-system, sans-serif';
      this.ctx.fillText(this.strings.introCount(this.quiz.questions.length), w / 2, 690);
      this.ctx.fillStyle = activeTheme.light;
      this.ctx.fillRect(620, 765, 680, 8);
      this.ctx.restore();
      return;
    }

    if (this.phase === "outro") {
      this.ctx.fillStyle = "rgba(3,7,18,0.42)";
      this.ctx.fillRect(0, 0, w, h);
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillStyle = activeTheme.main;
      this.ctx.beginPath();
      this.ctx.arc(w / 2, 290, 70, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = "#fff";
      this.ctx.font = '900 72px system-ui, -apple-system, sans-serif';
      this.ctx.fillText(this.strings.outroTitle, w / 2, 475);
      this.ctx.fillStyle = "rgba(255,255,255,0.82)";
      this.ctx.font = '600 42px system-ui, -apple-system, sans-serif';
      this.ctx.fillText(this.strings.outroSubtitle, w / 2, 560);
      if (this.quiz.watermark) {
        this.ctx.fillStyle = "rgba(255,255,255,0.12)";
        this.drawRoundedRect(w / 2 - 260, 660, 520, 72, 36);
        this.ctx.fill();
        this.ctx.fillStyle = "#fff";
        this.ctx.font = '700 30px monospace';
        this.ctx.fillText(this.quiz.watermark, w / 2, 696);
      }
      return;
    }

    if (this.phase === "init") return;

    const badgeText = `${this.strings.questionBadge} ${this.currentQuestionIndex + 1}/${this.quiz.questions.length}`;
    this.ctx.font = '800 28px system-ui, -apple-system, sans-serif';
    const badgeWidth = this.ctx.measureText(badgeText).width + 92;
    this.ctx.fillStyle = "rgba(2,6,23,0.72)";
    this.drawRoundedRect(78, 54, badgeWidth, 58, 29);
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(255,255,255,0.14)";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.fillStyle = activeTheme.light;
    this.ctx.beginPath();
    this.ctx.arc(112, 83, 8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = "#fff";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(badgeText, 136, 84);

    this.ctx.fillStyle = "rgba(2,6,23,0.72)";
    this.drawRoundedRect(120, 145, 1680, 205, 34);
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(255,255,255,0.14)";
    this.ctx.stroke();
    this.ctx.fillStyle = "#fff";
    this.ctx.font = '900 58px system-ui, -apple-system, sans-serif';
    this.ctx.textAlign = "center";
    const questionLines = this.getWrappedLines(q.text, 1510, 2);
    const questionStart = 247 - ((questionLines.length - 1) * 68) / 2;
    questionLines.forEach((line, index) => this.ctx.fillText(line, w / 2, questionStart + index * 68));

    if (this.phase === "options" || this.phase === "timer" || this.phase === "reveal" || this.phase === "end") {
      q.options.forEach((option, index) => {
        const rowY = 390 + index * 132;
        const isCorrect = index === q.correctOptionIndex;
        const isReveal = this.phase === "reveal" || this.phase === "end";
        let opacity = 1;
        if (this.phase === "options") {
          opacity = Math.max(0, Math.min(1, (phaseTime - index * 140) / 280));
        }

        this.ctx.save();
        this.ctx.globalAlpha = opacity;
        this.ctx.fillStyle = isReveal
          ? (isCorrect ? activeTheme.main : "rgba(2,6,23,0.62)")
          : "rgba(15,23,42,0.86)";
        this.drawRoundedRect(290, rowY, 1340, 106, 28);
        this.ctx.fill();
        this.ctx.strokeStyle = isReveal && isCorrect ? activeTheme.light : "rgba(255,255,255,0.16)";
        this.ctx.lineWidth = isReveal && isCorrect ? 4 : 2;
        this.ctx.stroke();

        this.ctx.fillStyle = "rgba(0,0,0,0.25)";
        this.ctx.beginPath();
        this.ctx.arc(355, rowY + 53, 35, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = isReveal && !isCorrect ? "rgba(255,255,255,0.42)" : "#fff";
        this.ctx.font = '800 32px system-ui, -apple-system, sans-serif';
        this.ctx.textAlign = "center";
        this.ctx.fillText(["A", "B", "C", "D"][index], 355, rowY + 54);
        this.ctx.font = isReveal && isCorrect
          ? '800 38px system-ui, -apple-system, sans-serif'
          : '600 36px system-ui, -apple-system, sans-serif';
        this.ctx.textAlign = "left";
        this.ctx.fillText(option, 425, rowY + 54);
        this.ctx.restore();
      });
    }

    if ((this.phase === "reveal" || this.phase === "end") && q.explanation) {
      this.ctx.fillStyle = "rgba(2,6,23,0.82)";
      this.drawRoundedRect(290, 790, 1340, 112, 24);
      this.ctx.fill();
      this.ctx.strokeStyle = activeTheme.main;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.fillStyle = activeTheme.light;
      this.ctx.font = '800 24px system-ui, -apple-system, sans-serif';
      this.ctx.textAlign = "left";
      this.ctx.fillText("WHY?", 330, 826);
      this.ctx.fillStyle = "#fff";
      this.ctx.font = '600 30px system-ui, -apple-system, sans-serif';
      const explanationLines = this.getWrappedLines(q.explanation, 1120, 2);
      explanationLines.forEach((line, index) => this.ctx.fillText(line, 455, 820 + index * 38));
    }

    if (this.phase === "timer" || this.phase === "reveal" || this.phase === "end") {
      this.ctx.fillStyle = "rgba(255,255,255,0.88)";
      this.ctx.font = '900 23px system-ui, -apple-system, sans-serif';
      this.ctx.textAlign = "center";
      this.ctx.fillText(this.phase === "timer" ? this.strings.thinking : this.strings.correctAnswer, w / 2, 958);
      this.ctx.fillStyle = "rgba(255,255,255,0.14)";
      this.drawRoundedRect(290, 986, 1340, 24, 12);
      this.ctx.fill();
      if (this.phase === "timer") {
        const duration = this.quiz.timerDuration || 10;
        const progress = 1 - Math.min(1, phaseTime / (duration * 1000));
        if (progress > 0) {
          const timerGradient = this.ctx.createLinearGradient(290, 0, 1630, 0);
          timerGradient.addColorStop(0, activeTheme.light);
          timerGradient.addColorStop(1, activeTheme.main);
          this.ctx.fillStyle = timerGradient;
          this.drawRoundedRect(290, 986, 1340 * progress, 24, 12);
          this.ctx.fill();
        }
      }
    }

    if (this.quiz.watermark) {
      this.ctx.fillStyle = "rgba(255,255,255,0.48)";
      this.ctx.font = '700 23px monospace';
      this.ctx.textAlign = "right";
      this.ctx.fillText(this.quiz.watermark, w - 82, 84);
    }
  }

  drawFrame() {
    if (!this.isRecording || this.isPaused) return;

    // Dizayn koordinatalari doim 1080p bo'lib qoladi; mobil chiqishda
    // canvas ularni 720p ga proporsional kichraytiradi.
    this.ctx.setTransform(
      this.outputWidth / this.designWidth,
      0,
      0,
      this.outputHeight / this.designHeight,
      0,
      0,
    );
    const w = this.designWidth;
    const h = this.designHeight;

    if (this.quiz.videoFormat === "youtube") {
      this.drawYouTubeFrame();
      return;
    }
    
    // Background (Ken Burns: savol davomida sekin kattalashadi — statik his yo'qoladi)
    const bgImg = this.bgImages[this.currentQuestionIndex];
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      const kenBurns = 1 + 0.15 * Math.min(1, (performance.now() - this.qStartTime) / 22000);
      const scale = Math.max(w / bgImg.width, h / bgImg.height) * kenBurns;
      const x = (w / 2) - (bgImg.width / 2) * scale;
      const y = (h / 2) - (bgImg.height / 2) * scale;
      this.ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale);
    } else {
      this.ctx.fillStyle = '#111';
      this.ctx.fillRect(0, 0, w, h);
    }

    // Dark overlay (yangi dizayn: quyuqroq — oq matn aniq o'qiladi)
    const gradient = this.ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(0,0,0,0.65)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.35)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.92)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, w, h);

    const q = this.quiz.questions[this.currentQuestionIndex];
    if (!q) return;
    const activeTheme = THEME_COLORS[this.quiz.themeColor || "emerald"];
    const now = performance.now();
    const phaseTime = now - this.phaseStartTime;

    if (this.phase === 'outro') {
      // Outro screen
      this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
      this.ctx.fillRect(0, 0, w, h);
      
      this.ctx.fillStyle = '#f43f5e'; // rose-500 for heart
      this.ctx.font = '120px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText("♥️", w/2, h/2 - 150);
      
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '900 70px system-ui, -apple-system, sans-serif';
      this.ctx.fillText(this.strings.outroTitle, w/2, h/2 + 20);
      
      this.ctx.fillStyle = '#d4d4d8';
      this.ctx.font = '500 45px system-ui, -apple-system, sans-serif';
      this.ctx.fillText(this.strings.outroSubtitle, w/2, h/2 + 100);
      
      if (this.quiz.watermark) {
        this.ctx.fillStyle = 'rgba(255,255,255,0.15)';
        this.drawRoundedRect(w/2 - 300, h/2 + 200, 600, 80, 40);
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 36px monospace';
        this.ctx.fillText(this.quiz.watermark, w/2, h/2 + 240);
      }
      return;
    }

    if (this.phase === 'intro') {
      // Hook-intro: mavzu nomi + savollar soni (skroll to'xtatuvchi kirish)
      const p = Math.min(1, phaseTime / 400);
      this.ctx.save();
      this.ctx.translate(w / 2, h / 2);
      this.ctx.scale(0.92 + 0.08 * p, 0.92 + 0.08 * p);
      this.ctx.globalAlpha = p;

      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      // Tema rangli badge (matn uzunligiga moslashadi — har tilda toza turadi)
      this.ctx.font = '900 34px system-ui, -apple-system, sans-serif';
      const introBadgeW = Math.max(360, this.ctx.measureText(this.strings.introBadge).width + 90);
      this.ctx.fillStyle = activeTheme.main;
      this.drawRoundedRect(-introBadgeW / 2, -340, introBadgeW, 78, 39);
      this.ctx.fill();
      this.ctx.fillStyle = '#fff';
      this.ctx.fillText(this.strings.introBadge, 0, -301);

      // Sarlavha (mavzu)
      const title = (this.quiz.title || 'QUIZ').toUpperCase();
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '900 92px system-ui, -apple-system, sans-serif';
      this.ctx.shadowColor = 'rgba(0,0,0,0.7)';
      this.ctx.shadowBlur = 24;
      const words = title.split(' ');
      const lines: string[] = [];
      let line = '';
      for (let n = 0; n < words.length; n++) {
        const t = line + words[n] + ' ';
        if (this.ctx.measureText(t).width > 880 && n > 0) {
          lines.push(line.trim());
          line = words[n] + ' ';
        } else {
          line = t;
        }
      }
      lines.push(line.trim());
      const shown = lines.slice(0, 3);
      const lh = 108;
      const startY = -((shown.length - 1) * lh) / 2 - 30;
      shown.forEach((l, i) => this.ctx.fillText(l, 0, startY + i * lh));
      this.ctx.shadowColor = 'transparent';

      this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
      this.ctx.font = '600 44px system-ui, -apple-system, sans-serif';
      this.ctx.fillText(this.strings.introCount(this.quiz.questions.length), 0, startY + shown.length * lh + 40);

      this.ctx.restore();
      return;
    }

    // Progress badge (yangi dizayn: pulsli nuqta + "SAVOL n/N")
    const badgeText = `${this.strings.questionBadge} ${this.currentQuestionIndex + 1}/${this.quiz.questions.length}`;
    this.ctx.font = '800 30px system-ui, -apple-system, sans-serif';
    const badgeW = this.ctx.measureText(badgeText).width + 100;
    this.ctx.fillStyle = 'rgba(0,0,0,0.55)';
    this.drawRoundedRect(60, 80, badgeW, 64, 32);
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(now / 450));
    this.ctx.globalAlpha = pulse;
    this.ctx.fillStyle = activeTheme.light;
    this.ctx.beginPath();
    this.ctx.arc(96, 112, 9, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalAlpha = 1;

    this.ctx.fillStyle = 'rgba(255,255,255,0.95)';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(badgeText, 120, 114);
    this.ctx.textAlign = 'center';

    // Question Box
    if (this.phase !== 'init') {
      const boxY = 400;
      let boxScale = 1;
      let boxOpacity = 1;
      
      if (this.phase === 'question' && phaseTime < 500) {
        boxScale = 0.95 + (phaseTime / 500) * 0.05;
        boxOpacity = phaseTime / 500;
      }
      
      this.ctx.save();
      this.ctx.translate(w/2, boxY);
      this.ctx.scale(boxScale, boxScale);
      this.ctx.globalAlpha = boxOpacity;

      // Matnni oldindan o'lchaymiz — karta balandligi matnga moslashadi
      this.ctx.font = '900 55px system-ui, -apple-system, sans-serif';
      let lines = this.cachedLines[this.currentQuestionIndex];
      if (!lines) {
        const words = q.text.split(' ');
        lines = [];
        let line = '';
        for(let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          if (this.ctx.measureText(testLine).width > 740 && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
          } else {
            line = testLine;
          }
        }
        lines.push(line);
        this.cachedLines[this.currentQuestionIndex] = lines;
      }
      const lineHeight = 65;
      const cardH = Math.max(230, lines.length * lineHeight + 130);

      this.ctx.shadowColor = 'rgba(0,0,0,0.45)';
      this.ctx.shadowBlur = 40;
      this.ctx.shadowOffsetY = 15;

      // Dark glassmorphism karta (yangi Player dizayni bilan bir xil)
      this.ctx.fillStyle = 'rgba(10, 12, 18, 0.62)';
      this.drawRoundedRect(-440, -cardH / 2, 880, cardH, 45);
      this.ctx.fill();

      this.ctx.shadowColor = 'transparent';

      this.ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.shadowColor = 'rgba(0,0,0,0.6)';
      this.ctx.shadowBlur = 10;

      const startY = -((lines.length - 1) * lineHeight) / 2;
      lines.forEach((l, i) => {
        this.ctx.fillText(l, 0, startY + i * lineHeight);
      });
      this.ctx.shadowColor = 'transparent';

      this.ctx.restore();
    }

    // Options
    if (this.phase === 'options' || this.phase === 'timer' || this.phase === 'reveal') {
      const startY = 750;
      q.options.forEach((opt, idx) => {
        let optOpacity = 1;
        let optX = 0;
        let optScale = 1;
        
        if (this.phase === 'options') {
          const delay = idx * 150;
          if (phaseTime < delay) {
            optOpacity = 0;
          } else if (phaseTime < delay + 300) {
            const p = (phaseTime - delay) / 300;
            optOpacity = p;
            optX = -50 * (1 - p);
          }
        }
        
        if (optOpacity > 0) {
          this.ctx.save();
          this.ctx.globalAlpha = optOpacity;
          
          let bgColor = 'rgba(20, 20, 20, 0.85)'; // Darker solid background for better readability since Canvas blur does not work
          let textColor = '#fff';
          let borderColor = 'rgba(255, 255, 255, 0.3)';
          
          if (this.phase === 'reveal') {
            if (idx === q.correctOptionIndex) {
              bgColor = activeTheme.main;
              borderColor = activeTheme.light;
              // Yengil puls — to'g'ri javob "nafas oladi"
              optScale = 1.05 + 0.015 * Math.sin(phaseTime / 120);
            } else {
              bgColor = 'rgba(0, 0, 0, 0.6)';
              textColor = 'rgba(255,255,255,0.4)';
              borderColor = 'rgba(255,255,255,0.1)';
              optScale = 0.98;
            }
          }
          
          this.ctx.translate(w/2 + optX, startY + idx * 150);
          this.ctx.scale(optScale, optScale);

          // Shadow for options (to'g'ri javobda tema rangli nur)
          if (this.phase === 'reveal' && idx === q.correctOptionIndex) {
            this.ctx.shadowColor = activeTheme.main;
            this.ctx.shadowBlur = 32;
            this.ctx.shadowOffsetY = 0;
          } else {
            this.ctx.shadowColor = 'rgba(0,0,0,0.3)';
            this.ctx.shadowBlur = 15;
            this.ctx.shadowOffsetY = 5;
          }
          
          this.ctx.fillStyle = bgColor;
          this.drawRoundedRect(-420, 0, 840, 120, 30);
          this.ctx.fill();
          
          this.ctx.shadowColor = 'transparent';
          
          if (borderColor !== 'transparent') {
            this.ctx.strokeStyle = borderColor;
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
          }
          
          this.ctx.fillStyle = textColor;
          this.ctx.textBaseline = 'middle';

          const label = ['A', 'B', 'C', 'D'][idx];
          
          this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
          this.ctx.beginPath();
          this.ctx.arc(-330, 60, 45, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.fillStyle = textColor;
          this.ctx.font = 'bold 38px system-ui, -apple-system, sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(label, -330, 60);

          this.ctx.font = (this.phase === 'reveal' && idx === q.correctOptionIndex) ? 'bold 45px system-ui, -apple-system, sans-serif' : '500 42px system-ui, -apple-system, sans-serif';
          this.ctx.textAlign = 'left';
          this.ctx.fillText(opt, -250, 60);
          
          this.ctx.restore();
        }
      });
    }

    // Timer
    if (this.phase === 'timer' || this.phase === 'reveal') {
      this.ctx.save();
      // 1560: TikTok/Instagram caption zonasidan yuqorida (xavfsiz zona)
      this.ctx.translate(w/2, 1560);
      
      this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
      this.ctx.font = '900 24px system-ui, -apple-system, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.letterSpacing = '5px';
      this.ctx.fillText(this.phase === 'timer' ? this.strings.thinking : this.strings.correctAnswer, 0, -20);
      this.ctx.letterSpacing = '0px'; // reset
      
      // Timer background
      this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      this.drawRoundedRect(-420, 10, 840, 26, 13);
      this.ctx.fill();
      
      this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      let progress = 0;
      if (this.phase === 'timer') {
        const duration = this.quiz.timerDuration || 5;
        progress = 1 - Math.min(1, phaseTime / (duration * 1000));
      }
      
      if (progress > 0) {
        // Shine/Glow effect on the bar
        this.ctx.shadowColor = activeTheme.main;
        this.ctx.shadowBlur = 15;
        
        const gradient = this.ctx.createLinearGradient(-420, 0, 420, 0);
        gradient.addColorStop(0, activeTheme.light);
        gradient.addColorStop(1, activeTheme.main);
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.drawRoundedRect(-420, 10, 840 * progress, 26, 13);
        this.ctx.fill();
        
        this.ctx.shadowColor = 'transparent';
      }
      
      this.ctx.restore();
    }

    if (this.quiz.watermark) {
      // Xavfsiz zona: platforma UI (caption/tugmalar) ostida qolmasin
      this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
      this.drawRoundedRect(w/2 - 200, h - 215, 400, 60, 30);
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
      this.ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(this.quiz.watermark, w/2, h - 185);
    }
  }

  setPhase(p: string) {
    this.phase = p;
    this.phaseStartTime = performance.now();
  }

  pauseRendering() {
    if (this.isPaused || this.isCancelled || !this.isRecording) return;
    this.isPaused = true;
    this.pauseStartedAt = performance.now();
    this.onPauseChange?.(true);
    try { if (this.recorder.state === 'recording') this.recorder.pause(); } catch (e) {}
    this.audioCtx.suspend().catch(() => {});
  }

  resumeRendering() {
    if (!this.isPaused) return;
    // Pauza davomidagi vaqtni animatsiya soatlaridan chiqarib tashlaymiz —
    // qaytganda animatsiyalar sakramasdan davom etadi
    const pausedFor = performance.now() - this.pauseStartedAt;
    this.phaseStartTime += pausedFor;
    this.qStartTime += pausedFor;
    this.isPaused = false;
    this.onPauseChange?.(false);
    try { if (this.recorder.state === 'paused') this.recorder.resume(); } catch (e) {}
    this.audioCtx.resume().catch(() => {});
    this.resumeWaiters.splice(0).forEach((fn) => fn());
  }

  // Pauza paytida hisoblamaydigan sleep: tab yashirilganda qolgan vaqt "muzlaydi"
  async sleep(ms: number) {
    let remaining = ms;
    while (remaining > 0) {
      if (this.isCancelled) return;
      if (this.isPaused) {
        await new Promise<void>((r) => this.resumeWaiters.push(r));
        continue;
      }
      const chunk = Math.min(100, remaining);
      await new Promise((r) => setTimeout(r, chunk));
      remaining -= chunk;
    }
  }

  async runQuestionSequence(q: Question) {
    if (this.isCancelled) return;

    this.qStartTime = performance.now();
    this.setPhase('init');
    await this.sleep(300);
    if (this.isCancelled) return;

    this.setPhase('question');

    let audioPromise = Promise.resolve();
    if (q.audioBase64) {
      audioPromise = playPCMAsync(q.audioBase64, 24000, this.masterGain);
    }

    // Savolni o'qib olish uchun qisqa pauza (audio parallel boshlanadi)
    await this.sleep(1400);
    if (this.isCancelled) return;

    this.setPhase('options');
    for (let idx = 0; idx < q.options.length; idx++) {
      if (this.isCancelled) return;
      setTimeout(() => {
        if (!this.isCancelled) playPop(this.masterGain);
      }, idx * 120);
    }

    // Wait for options animation to finish
    await this.sleep(q.options.length * 120 + 400);
    if (this.isCancelled) return;

    // IMPORTANT: Wait for the audio to completely finish before starting the timer
    await audioPromise;
    if (this.isCancelled) return;

    // Small pause after audio finishes
    await this.sleep(350);
    if (this.isCancelled) return;

    this.setPhase('timer');
    const duration = this.quiz.timerDuration || 5;
    for (let i = 0; i < duration; i++) {
      if (this.isCancelled) return;
      playTick(this.masterGain);
      await this.sleep(1000);
    }
    if (this.isCancelled) return;

    this.setPhase('reveal');
    playSuccess(this.masterGain);
    let revealAudioPromise = Promise.resolve();
    if (q.correctAudioBase64) {
      revealAudioPromise = playPCMAsync(q.correctAudioBase64, 24000, this.masterGain);
    }

    const revealMinimumMs = this.quiz.videoFormat === "youtube" ? 5200 : 2400;
    await Promise.all([revealAudioPromise, this.sleep(revealMinimumMs)]);
    if (this.isCancelled) return;

    const targetQuestionMs = getTargetQuestionDurationMs(this.quiz);
    if (targetQuestionMs) {
      const remainingMs = targetQuestionMs - (performance.now() - this.qStartTime) - 350;
      if (remainingMs > 0) await this.sleep(remainingMs);
    }
    if (this.isCancelled) return;

    this.setPhase('end');
    await this.sleep(350);
    
    if (this.onProgress) {
      this.onProgress((this.currentQuestionIndex + 1) / this.quiz.questions.length);
    }
  }

  stop() {
    this.isRecording = false;
    this.isCancelled = true;
    // Pauzada kutayotgan sleep'larni bo'shatamiz — aks holda start() osilib qoladi
    this.isPaused = false;
    this.onPauseChange?.(false);
    this.resumeWaiters.splice(0).forEach((fn) => fn());
    if (this.handleVisibilityChange) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.handleVisibilityChange = undefined;
    }
    if (this.wakeLock) {
      try { this.wakeLock.release(); } catch (e) {}
      this.wakeLock = null;
    }
    this.worker.postMessage('stop');
    this.worker.terminate();
    this.bgImages.forEach((_, index) => this.releaseImage(index));
    stopPCM();
    if (this.silenceOscillator) {
      try { this.silenceOscillator.stop(); } catch(e) {}
    }
    if (this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    this.stream.getTracks().forEach(t => t.stop());
  }
}
