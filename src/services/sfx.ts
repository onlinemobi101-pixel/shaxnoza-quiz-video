let audioCtx: AudioContext | null = null;

export const getAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

export const playPop = (destination?: AudioNode) => {
  try {
    const ctx = destination ? (destination.context as AudioContext) : getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    if (destination) {
      gain.connect(destination);
    } else {
      gain.connect(ctx.destination);
    }
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    console.error("SFX Error:", e);
  }
};

export const playTick = (destination?: AudioNode) => {
  try {
    const ctx = destination ? (destination.context as AudioContext) : getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    if (destination) {
      gain.connect(destination);
    } else {
      gain.connect(ctx.destination);
    }
    // Make tick louder and sharper
    osc.type = 'square';
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    console.error("SFX Error:", e);
  }
};

export const playSuccess = (destination?: AudioNode) => {
  try {
    const ctx = destination ? (destination.context as AudioContext) : getAudioContext();
    const playNote = (freq: number, startTime: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      if (destination) {
        gain.connect(destination);
      } else {
        gain.connect(ctx.destination);
      }
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.6);
      osc.start(startTime);
      osc.stop(startTime + 0.6);
    };
    const now = ctx.currentTime;
    playNote(523.25, now); // C5
    playNote(659.25, now + 0.1); // E5
    playNote(783.99, now + 0.2); // G5
    playNote(1046.50, now + 0.3); // C6
  } catch (e) {
    console.error("SFX Error:", e);
  }
};

let bgmOscillators: OscillatorNode[] = [];
let bgmSource: AudioBufferSourceNode | null = null;
let bgmGain: GainNode | null = null;
let bgmInterval: any = null;
let decodedBgmBuffer: AudioBuffer | null = null;
let lastBgmBase64 = "";

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export const startProceduralBGM = (destination?: AudioNode, customBgmBase64?: string) => {
  try {
    stopProceduralBGM();
    const ctx = destination ? (destination.context as AudioContext) : getAudioContext();
    bgmGain = ctx.createGain();
    bgmGain.gain.setValueAtTime(customBgmBase64 ? 0.08 : 0.015, ctx.currentTime); // Custom BGM slightly louder than quiet synth
    if (destination) {
      bgmGain.connect(destination);
    } else {
      bgmGain.connect(ctx.destination);
    }

    if (customBgmBase64) {
      const playCustom = async () => {
        try {
          if (lastBgmBase64 !== customBgmBase64 || !decodedBgmBuffer) {
            const arrayBuf = base64ToArrayBuffer(customBgmBase64);
            decodedBgmBuffer = await ctx.decodeAudioData(arrayBuf);
            lastBgmBase64 = customBgmBase64;
          }
          if (decodedBgmBuffer) {
            bgmSource = ctx.createBufferSource();
            bgmSource.buffer = decodedBgmBuffer;
            bgmSource.loop = true;
            if (bgmGain) {
              bgmSource.connect(bgmGain);
              bgmSource.start();
            }
          }
        } catch (err) {
          console.error("Custom BGM Playback Error:", err);
        }
      };
      playCustom();
      return;
    }

    const chords = [
      [220.00, 261.63, 329.63], // Am
      [174.61, 220.00, 261.63], // F
      [196.00, 246.94, 293.66], // G
      [164.81, 196.00, 246.94], // Em
    ];
    let step = 0;

    const playChord = () => {
      // Clear old oscillators
      bgmOscillators.forEach(o => {try { o.stop(); } catch(e) {}});
      bgmOscillators = [];

      const chord = chords[step % chords.length];
      chord.forEach(freq => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        const oscGain = ctx.createGain();
        oscGain.gain.value = 0;
        oscGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1);
        oscGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3.8); // fade out before next chord

        osc.connect(oscGain);
        if (bgmGain) oscGain.connect(bgmGain);
        
        osc.start();
        bgmOscillators.push(osc);
      });
      step++;
    };

    playChord();
    bgmInterval = setInterval(playChord, 4000); // New chord every 4 seconds

  } catch (e) {
    console.error("BGM Error:", e);
  }
};

export const stopProceduralBGM = () => {
  if (bgmInterval) clearInterval(bgmInterval);
  bgmInterval = null;
  bgmOscillators.forEach(o => {try { o.stop(); } catch(e) {}});
  bgmOscillators = [];
  if (bgmSource) {
    try { bgmSource.stop(); } catch(e) {}
    bgmSource = null;
  }
  if (bgmGain) {
    bgmGain.disconnect();
    bgmGain = null;
  }
};
