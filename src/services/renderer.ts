import { Quiz, Question } from "../types";
import { playPCMAsync, stopPCM } from "./tts";
import { playPop, playTick, playSuccess, startProceduralBGM, stopProceduralBGM } from "./sfx";

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
  
  // Assets
  bgImages: HTMLImageElement[] = [];
  cachedLines: { [key: number]: string[] } = {};
  silenceOscillator?: OscillatorNode;
  wakeLock: any = null;
  handleVisibilityChange?: () => void;

  // Tab yashirilganda render pauza bo'ladi — audio/video surilishi (desync) oldini oladi
  isPaused = false;
  pauseStartedAt = 0;
  private resumeWaiters: (() => void)[] = [];
  
  onProgress?: (progress: number) => void;
  onComplete?: (url: string, extension: string) => void;
  onError?: (err: any) => void;
  onBeforeRecording?: () => Promise<void>;

  constructor(quiz: Quiz) {
    this.quiz = quiz;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1080;
    this.canvas.height = 1920;
    this.ctx = this.canvas.getContext('2d')!;
    
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
        if (e.data === 'start') {
          intervalId = setInterval(() => self.postMessage('tick'), 1000 / 30);
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
    const canvasStream = this.canvas.captureStream(30); // 30 FPS for smoother video without overloading
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
      
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      options.videoBitsPerSecond = isMobile ? 2500000 : 8000000; // 2.5 Mbps for mobile, 8 Mbps for desktop
      
      this.recorder = new MediaRecorder(this.stream, options);
    } catch (e) {
      console.warn("MediaRecorder construction failed with options, trying basic initialization...", e);
      try {
        const options: MediaRecorderOptions = {};
        if (mimeType) {
          options.mimeType = mimeType;
        }
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
      const url = URL.createObjectURL(blob);
      if (this.onComplete) this.onComplete(url, this.extension);
    };
  }
  
  async loadImages() {
    for (const q of this.quiz.questions) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = q.backgroundImage;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      this.bgImages.push(img);
    }
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
    await this.loadImages();
    await this.onBeforeRecording?.();
    
    if (this.quiz.bgmEnabled) {
      startProceduralBGM(this.masterGain, this.quiz.bgmType);
    }
    
    this.isRecording = true;
    this.qStartTime = performance.now();
    this.drawFrame();
    this.recorder.start();
    this.worker.postMessage('start');

    // Hook-intro: skroll to'xtatish uchun 2 soniyalik kirish ekrani
    this.setPhase('intro');
    playPop(this.masterGain);
    await this.sleep(2000);

    for (let i = 0; i < this.quiz.questions.length; i++) {
      if (this.isCancelled) break;
      this.currentQuestionIndex = i;
      await this.runQuestionSequence(this.quiz.questions[i]);
    }

    if (!this.isCancelled) {
      this.setPhase('outro');
      playSuccess(this.masterGain);
      await this.sleep(3500);
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

  drawFrame() {
    if (!this.isRecording || this.isPaused) return;
    
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Background (Ken Burns: savol davomida sekin kattalashadi — statik his yo'qoladi)
    const bgImg = this.bgImages[this.currentQuestionIndex];
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      const kenBurns = 1 + 0.07 * Math.min(1, (performance.now() - this.qStartTime) / 22000);
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
      this.ctx.fillText("Videoga Like Bosing!", w/2, h/2 + 20);
      
      this.ctx.fillStyle = '#d4d4d8';
      this.ctx.font = '500 45px system-ui, -apple-system, sans-serif';
      this.ctx.fillText("Kanalga obuna bo'lishni unutmang", w/2, h/2 + 100);
      
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

      // Tema rangli badge
      this.ctx.fillStyle = activeTheme.main;
      this.drawRoundedRect(-270, -340, 540, 78, 39);
      this.ctx.fill();
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '900 34px system-ui, -apple-system, sans-serif';
      this.ctx.fillText("NECHTASINI TOPASIZ?", 0, -301);

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
      this.ctx.fillText(`${this.quiz.questions.length} ta savol • Javoblari ichida`, 0, startY + shown.length * lh + 40);

      this.ctx.restore();
      return;
    }

    // Progress badge (yangi dizayn: pulsli nuqta + "SAVOL n/N")
    const badgeText = `SAVOL ${this.currentQuestionIndex + 1}/${this.quiz.questions.length}`;
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
      this.ctx.fillText(this.phase === 'timer' ? "O'YLASH VAQTI..." : "TO'G'RI JAVOB", 0, -20);
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

    await Promise.all([revealAudioPromise, this.sleep(2400)]);
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
