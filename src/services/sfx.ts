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
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
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
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
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
      gain.gain.linearRampToValueAtTime(0.35, startTime + 0.05);
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
let bgmGain: GainNode | null = null;
let bgmInterval: any = null;

export const startProceduralBGM = (destination?: AudioNode, bgmType: 'calm' | 'happy' | 'tense' = 'calm') => {
  try {
    stopProceduralBGM();
    const ctx = destination ? (destination.context as AudioContext) : getAudioContext();
    bgmGain = ctx.createGain();
    bgmGain.gain.setValueAtTime(0.04, ctx.currentTime); // Very quiet & pleasant background level
    if (destination) {
      bgmGain.connect(destination);
    } else {
      bgmGain.connect(ctx.destination);
    }

    let chords = [
      [220.00, 261.63, 329.63], // Am
      [174.61, 220.00, 261.63], // F
      [196.00, 246.94, 293.66], // G
      [164.81, 196.00, 246.94], // Em
    ];
    let oscType: OscillatorType = 'sine';

    if (bgmType === 'happy') {
      chords = [
        [261.63, 329.63, 392.00], // C
        [174.61, 220.00, 261.63], // F
        [196.00, 246.94, 293.66], // G
        [220.00, 261.63, 329.63], // Am
      ];
      oscType = 'sine';
    } else if (bgmType === 'tense') {
      chords = [
        [220.00, 261.63, 311.13], // Adim (suspenseful)
        [233.08, 293.66, 349.23], // Bb
        [164.81, 207.65, 246.94], // E major
        [220.00, 261.63, 329.63], // Am
      ];
      oscType = 'triangle'; // triangle has sharper harmonics for suspense
    }

    let step = 0;

    const playChord = () => {
      // Clear old oscillators
      bgmOscillators.forEach(o => {try { o.stop(); } catch(e) {}});
      bgmOscillators = [];

      const chord = chords[step % chords.length];
      chord.forEach(freq => {
        const osc = ctx.createOscillator();
        osc.type = oscType;
        osc.frequency.value = freq;
        
        const oscGain = ctx.createGain();
        oscGain.gain.value = 0;
        oscGain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 1);
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
  if (bgmGain) {
    bgmGain.disconnect();
    bgmGain = null;
  }
};
