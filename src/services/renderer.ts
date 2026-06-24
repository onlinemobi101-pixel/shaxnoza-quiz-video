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
  dest: MediaStreamAudioDestinationNode;
  worker: Worker;
  
  // State
  currentQuestionIndex = 0;
  phase = 'init';
  phaseStartTime = 0;
  phaseStartFrame = 0;
  frameCount = 0;
  isRecording = false;
  recordedChunks: Blob[] = [];
  isCancelled = false;
  extension = 'webm';
  activeSleepResolvers: (() => void)[] = [];
  
  // Assets
  bgImages: HTMLImageElement[] = [];
  cachedLines: { [key: number]: string[] } = {};
  silenceOscillator?: OscillatorNode;
  
  onProgress?: (progress: number) => void;
  onComplete?: (url: string, extension: string) => void;
  onError?: (err: any) => void;

  constructor(quiz: Quiz) {
    this.quiz = quiz;
    this.canvas = document.createElement('canvas');
    
    const ratio = quiz.aspectRatio || '9:16';
    if (ratio === '16:9') {
      this.canvas.width = 1920;
      this.canvas.height = 1080;
    } else if (ratio === '1:1') {
      this.canvas.width = 1080;
      this.canvas.height = 1080;
    } else {
      this.canvas.width = 1080;
      this.canvas.height = 1920;
    }
    this.ctx = this.canvas.getContext('2d')!;
    
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.audioCtx.createGain();
    this.dest = this.audioCtx.createMediaStreamDestination();
    
    this.masterGain.connect(this.dest);
    this.masterGain.connect(this.audioCtx.destination);
    
    this.silenceOscillator = this.audioCtx.createOscillator();
    this.silenceOscillator.type = 'sine';
    this.silenceOscillator.frequency.value = 0;
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
    const canvasStream = this.canvas.captureStream(30); 
    const tracks = [...canvasStream.getVideoTracks(), ...this.dest.stream.getAudioTracks()];
    this.stream = new MediaStream(tracks);
    
    let mimeType = 'video/webm; codecs=vp9';
    this.extension = 'webm';
    
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
      this.extension = 'mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm; codecs=h264')) {
      mimeType = 'video/webm; codecs=h264';
    }
    
    this.recorder = new MediaRecorder(this.stream, { 
      mimeType,
      videoBitsPerSecond: 8000000 
    });
    
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    this.recorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      if (this.onComplete) this.onComplete(url, this.extension);
    };
  }
  
  async loadImages() {
    const promises = this.quiz.questions.map((q) => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = q.backgroundImage;
        img.onload = () => resolve(img);
        img.onerror = () => {
          console.error("Failed to load image:", q.backgroundImage);
          resolve(img); // Resolve anyway to avoid blocking execution
        };
      });
    });
    this.bgImages = await Promise.all(promises);
  }

  async start() {
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    await this.loadImages();
    
    if (this.quiz.bgmEnabled) {
      startProceduralBGM(this.masterGain, this.quiz.customBgmBase64);
    }
    
    this.isRecording = true;
    this.recorder.start();
    this.worker.postMessage('start');
    
    for (let i = 0; i < this.quiz.questions.length; i++) {
      if (this.isCancelled) break;
      this.currentQuestionIndex = i;
      await this.runQuestionSequence(this.quiz.questions[i]);
    }
    
    if (!this.isCancelled) {
      this.setPhase('outro');
      playSuccess(this.masterGain);
      await this.sleep(4000);
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
    if (!this.isRecording) return;
    
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Background
    const bgImg = this.bgImages[this.currentQuestionIndex];
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      const scale = Math.max(w / bgImg.width, h / bgImg.height);
      const x = (w / 2) - (bgImg.width / 2) * scale;
      const y = (h / 2) - (bgImg.height / 2) * scale;
      this.ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale);
    } else {
      this.ctx.fillStyle = '#111';
      this.ctx.fillRect(0, 0, w, h);
    }
    
    // Dark overlay
    this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
    this.ctx.fillRect(0, 0, w, h);

    const q = this.quiz.questions[this.currentQuestionIndex];
    if (!q) return;

    const activeTheme = THEME_COLORS[this.quiz.themeColor || "emerald"];
    this.frameCount++;
    const phaseTime = (this.frameCount - this.phaseStartFrame) * (1000 / 30);

    const ratio = this.quiz.aspectRatio || "9:16";

    let transitionAlpha = 1;
    if (this.phase === 'init') {
      transitionAlpha = Math.min(1, phaseTime / 500);
    } else if (this.phase === 'end') {
      transitionAlpha = 1 - Math.min(1, phaseTime / 500);
    }

    // Layout configuration
    let topPillY = 180;
    let boxY = 400;
    let startY = 650;
    let optionGap = 160;
    let factY = 1580;
    let timerY = 1600;
    let watermarkY = h - 80 - 15;
    let watermarkBoxY = h - 80 - 45;

    let optWidth = 840;
    let optHeight = 130;
    let optFontSize = 46;
    let letterFontSize = 42;
    let letterBoxSize = 90;
    let letterBoxOffset = 20;
    
    let factWidth = 840;
    let factHeight = 260;
    let factFontSize = 36;
    let factTitleFontSize = 32;
    let factTitleY = -90;
    let factTextY = -30;
    let factWrapWidth = 760;
    let factLineHeight = 50;

    let wrapWidth = 800;
    let titleFontSize = 65;
    let titleLineHeight = 80;

    if (ratio === '16:9') {
      topPillY = 100;
      boxY = h * 0.22;
      startY = h * 0.42;
      optionGap = 130;
      factY = 780;
      timerY = 820;
      watermarkY = h - 45;
      watermarkBoxY = h - 75;

      optWidth = 800;
      optHeight = 100;
      optFontSize = 38;
      letterFontSize = 34;
      letterBoxSize = 70;
      letterBoxOffset = 15;

      factWidth = 1600;
      factHeight = 190;
      factFontSize = 32;
      factTitleFontSize = 28;
      factTitleY = -55;
      factTextY = -5;
      factWrapWidth = 1500;
      factLineHeight = 42;

      wrapWidth = 1400;
      titleFontSize = 55;
      titleLineHeight = 70;
    } else if (ratio === '1:1') {
      topPillY = 100;
      boxY = 240;
      startY = 390;
      optionGap = 130;
      factY = 940;
      timerY = 950;
      watermarkY = h - 40;
      watermarkBoxY = h - 70;

      optWidth = 800;
      optHeight = 105;
      optFontSize = 38;
      letterFontSize = 34;
      letterBoxSize = 75;
      letterBoxOffset = 15;

      factWidth = 800;
      factHeight = 190;
      factFontSize = 32;
      factTitleFontSize = 28;
      factTitleY = -55;
      factTextY = -5;
      factWrapWidth = 720;
      factLineHeight = 45;

      wrapWidth = 800;
      titleFontSize = 50;
      titleLineHeight = 65;
    }

    if (this.phase === 'outro') {
      this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
      this.ctx.fillRect(0, 0, w, h);
      
      this.ctx.fillStyle = '#f43f5e'; 
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
      
      // Draw transition overlay
      if (transitionAlpha < 1) {
        this.ctx.fillStyle = `rgba(0,0,0,${1 - transitionAlpha})`;
        this.ctx.fillRect(0, 0, w, h);
      }
      return;
    }

    // Top Pill
    if (this.phase !== 'init') {
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      
      let pillText = "JAVOBINI TOP";
      let pillBg = 'rgba(0,0,0,0.4)';
      let pillBorder = 'rgba(255,255,255,0.2)';
      let pillTextColor = activeTheme.light;
      
      if (this.phase === 'reveal') {
        pillText = `TO'G'RI JAVOB: ${['A', 'B', 'C', 'D'][q.correctOptionIndex]}`;
        pillBg = 'rgba(16, 185, 129, 0.1)';
        pillBorder = 'rgba(16, 185, 129, 0.5)';
        pillTextColor = '#34d399'; // emerald-400
      }
      
      this.ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
      const textWidth = this.ctx.measureText(pillText).width;
      const pillWidth = textWidth + 80;
      
      this.ctx.fillStyle = pillBg;
      this.drawRoundedRect(w/2 - pillWidth/2, topPillY - 35, pillWidth, 70, 35);
      this.ctx.fill();
      
      this.ctx.strokeStyle = pillBorder;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      this.ctx.fillStyle = pillTextColor;
      this.ctx.letterSpacing = '2px';
      this.ctx.fillText(pillText, w/2, topPillY);
      this.ctx.letterSpacing = '0px';
    }

    // Question Title Box (Transparent, no bg)
    if (this.phase !== 'init') {
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
      
      this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
      this.ctx.shadowBlur = 10;
      this.ctx.shadowOffsetY = 5;
      
      this.ctx.fillStyle = '#fff'; 
      this.ctx.font = `900 ${titleFontSize}px system-ui, -apple-system, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      
      // Measure and wrap text
      let lines = this.cachedLines[this.currentQuestionIndex];
      if (!lines) {
        const words = q.text.split(' ');
        lines = [];
        let line = '';
        for(let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          if (this.ctx.measureText(testLine).width > wrapWidth && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
          } else {
            line = testLine;
          }
        }
        lines.push(line);
        this.cachedLines[this.currentQuestionIndex] = lines;
      }
      
      const startYText = -((lines.length - 1) * titleLineHeight) / 2;
      lines.forEach((l, i) => {
        this.ctx.fillText(l, 0, startYText + i * titleLineHeight);
      });
      
      this.ctx.restore();
    }

    // Options
    if (this.phase === 'options' || this.phase === 'timer' || this.phase === 'reveal') {
      q.options.forEach((opt, idx) => {
        let optOpacity = 1;
        let optX = 0;
        
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
          
          let containerBgColor = 'rgba(26, 26, 26, 0.8)';
          let letterBgColor = '#fff';
          let letterTextColor = '#000';
          let textFillColor = '#fff';
          let borderColor = 'rgba(255, 255, 255, 0.1)';
          let letterBorderColor = 'rgba(255, 255, 255, 0.1)';
          
          if (this.phase === 'reveal') {
            if (idx === q.correctOptionIndex) {
              containerBgColor = 'rgba(6, 78, 59, 0.8)'; // emerald-900/80
              borderColor = '#10b981'; // emerald-500
              letterBgColor = '#10b981'; // emerald-500
              letterTextColor = '#fff';
              textFillColor = '#34d399'; // emerald-400
              letterBorderColor = '#34d399';
            } else {
              optOpacity *= 0.5;
            }
          }
          
          this.ctx.globalAlpha = optOpacity;

          if (ratio === '16:9') {
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            const colX = col === 0 ? -430 : 430;
            const rowY = startY + row * optionGap;
            this.ctx.translate(w/2 + colX + optX, rowY);
          } else {
            this.ctx.translate(w/2 + optX, startY + idx * optionGap);
          }

          this.ctx.fillStyle = containerBgColor;
          this.drawRoundedRect(-optWidth/2, 0, optWidth, optHeight, 30);
          this.ctx.fill();
          
          this.ctx.strokeStyle = borderColor;
          this.ctx.lineWidth = 2;
          this.ctx.stroke();
          
          // Letter Box
          this.ctx.fillStyle = letterBgColor;
          this.drawRoundedRect(-optWidth/2 + 30, letterBoxOffset, letterBoxSize, letterBoxSize, 24);
          this.ctx.fill();
          this.ctx.strokeStyle = letterBorderColor;
          this.ctx.stroke();

          this.ctx.fillStyle = letterTextColor;
          this.ctx.font = `bold ${letterFontSize}px system-ui, -apple-system, sans-serif`;
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          const label = ['A', 'B', 'C', 'D'][idx];
          this.ctx.fillText(label + '.', -optWidth/2 + 30 + letterBoxSize/2, optHeight/2);

          // Option Text
          this.ctx.fillStyle = textFillColor;
          this.ctx.font = `bold ${optFontSize}px system-ui, -apple-system, sans-serif`;
          this.ctx.textAlign = 'left';
          this.ctx.fillText(opt, -optWidth/2 + 160, optHeight/2);
          
          this.ctx.restore();
        }
      });
    }

    // Timer / Fact Box
    if (this.phase === 'timer') {
      this.ctx.save();
      this.ctx.translate(w/2, timerY);
      
      // Large Timer Text
      const duration = this.quiz.timerDuration || 5;
      const timeLeft = Math.ceil(duration - phaseTime / 1000);
      if (timeLeft > 0) {
        this.ctx.fillStyle = '#f59e0b'; // amber-500
        this.ctx.font = `900 ${ratio === '16:9' ? 140 : 200}px system-ui, -apple-system, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
        this.ctx.shadowBlur = 30;
        this.ctx.fillText(timeLeft.toString(), 0, ratio === '16:9' ? -40 : -60);
        this.ctx.shadowColor = 'transparent';

        // Progress bar
        this.ctx.fillStyle = 'rgba(255,255,255,0.1)';
        this.drawRoundedRect(-300, 60, 600, 16, 8);
        this.ctx.fill();
        
        let progress = 1 - Math.min(1, phaseTime / (duration * 1000));
        
        this.ctx.fillStyle = '#f59e0b';
        this.ctx.beginPath();
        this.drawRoundedRect(-300, 60, 600 * progress, 16, 8);
        this.ctx.fill();
      }
      this.ctx.restore();
    } else if (this.phase === 'reveal' && q.fact) {
        this.ctx.save();
        this.ctx.translate(w/2, factY);
        
        this.ctx.fillStyle = 'rgba(30, 41, 59, 0.9)'; // slate-800
        this.drawRoundedRect(-factWidth/2, -factHeight/2, factWidth, factHeight, 30);
        this.ctx.fill();
        
        this.ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)'; // cyan-500/50
        this.ctx.lineWidth = 4;
        this.ctx.stroke();

        this.ctx.shadowColor = 'rgba(6, 182, 212, 0.2)';
        this.ctx.shadowBlur = 40;
        this.drawRoundedRect(-factWidth/2, -factHeight/2, factWidth, factHeight, 30);
        this.ctx.shadowColor = 'transparent';
        
        this.ctx.fillStyle = '#22d3ee'; // cyan-400
        this.ctx.font = `bold ${factTitleFontSize}px system-ui, -apple-system, sans-serif`;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText("💡 BILASIZMI?", -factWidth/2 + 40, factTitleY);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `500 ${factFontSize}px system-ui, -apple-system, sans-serif`;
        this.wrapText(q.fact, -factWidth/2 + 40, factTextY, factWrapWidth, factLineHeight);
        
        this.ctx.restore();
    }

    if (this.quiz.watermark) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
      this.drawRoundedRect(w/2 - 200, watermarkBoxY, 400, 60, 30);
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
      this.ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(this.quiz.watermark, w/2, watermarkY);
    }

    // Draw transition overlay
    if (transitionAlpha < 1) {
      this.ctx.fillStyle = `rgba(0,0,0,${1 - transitionAlpha})`;
      this.ctx.fillRect(0, 0, w, h);
    }
  }

  setPhase(p: string) {
    this.phase = p;
    this.phaseStartFrame = this.frameCount;
    this.phaseStartTime = performance.now();
  }

  async sleep(ms: number) {
    if (this.isCancelled) return Promise.resolve();
    const ticksNeeded = Math.ceil(ms / (1000 / 30));
    let ticksReceived = 0;
    return new Promise<void>((resolve) => {
      const listener = (e: MessageEvent) => {
        if (e.data === 'tick') {
          ticksReceived++;
          if (ticksReceived >= ticksNeeded || this.isCancelled) {
            this.worker.removeEventListener('message', listener);
            this.activeSleepResolvers = this.activeSleepResolvers.filter(r => r !== resolve);
            resolve();
          }
        }
      };
      this.worker.addEventListener('message', listener);
      this.activeSleepResolvers.push(resolve);
    });
  }

  async runQuestionSequence(q: Question) {
    if (this.isCancelled) return;
    
    this.setPhase('init');
    await this.sleep(500);
    if (this.isCancelled) return;

    this.setPhase('question');
    
    let audioPromise = Promise.resolve();
    if (q.audioBase64) {
      audioPromise = playPCMAsync(q.audioBase64, 24000, this.masterGain);
    }

    await this.sleep(2000);
    if (this.isCancelled) return;

    this.setPhase('options');
    for (let idx = 0; idx < q.options.length; idx++) {
      if (this.isCancelled) return;
      setTimeout(() => {
        if (!this.isCancelled) playPop(this.masterGain);
      }, idx * 150);
    }
    
    await this.sleep(q.options.length * 150 + 500);
    if (this.isCancelled) return;

    await audioPromise;
    if (this.isCancelled) return;

    await this.sleep(500);
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
    
    const revealWait = q.fact ? Math.max(5000, 3000) : 3000;
    await Promise.all([revealAudioPromise, this.sleep(revealWait)]);
    if (this.isCancelled) return;

    this.setPhase('end');
    await this.sleep(500);
    
    if (this.onProgress) {
      this.onProgress((this.currentQuestionIndex + 1) / this.quiz.questions.length);
    }
  }

  stop() {
    this.isRecording = false;
    this.isCancelled = true;
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
    
    // Resolve all pending sleeps
    this.activeSleepResolvers.forEach(resolve => resolve());
    this.activeSleepResolvers = [];
  }
}
