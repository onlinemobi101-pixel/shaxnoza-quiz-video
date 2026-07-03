// TTS endi /api/ai serverless funksiyasi orqali chaqiriladi — API kaliti klientda saqlanmaydi.
export async function generateTTS(text: string, voiceName: string = "Kore", retryCount = 0): Promise<string | null> {
  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "tts", text, voiceName }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 429) {
      if (data?.error === "QUOTA_EXCEEDED") {
        throw new Error("QUOTA_EXCEEDED");
      }
      if (retryCount < 3) {
        console.warn(`TTS rate limited. Retrying in ${(retryCount + 1) * 5} seconds...`);
        await new Promise((r) => setTimeout(r, (retryCount + 1) * 5000));
        return generateTTS(text, voiceName, retryCount + 1);
      }
      throw new Error("RATE_LIMITED");
    }

    if (!response.ok) {
      throw new Error(data?.error || `TTS API xatosi (${response.status})`);
    }

    return data.audio || null;
  } catch (error: any) {
    if (error?.message === "QUOTA_EXCEEDED") throw error;
    console.error("TTS generation failed:", error);
    // Re-throw with detail so the UI can show the real reason
    throw new Error(error?.message || error?.toString() || "Noma'lum xatolik");
  }
}

let sharedAudioContext: AudioContext | null = null;
const getSharedAudioContext = () => {
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioContext = new AudioContextClass();
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
};

let currentSource: AudioBufferSourceNode | null = null;

export function stopPCM() {
  if (currentSource) {
    try { currentSource.stop(); } catch(e) {}
    currentSource = null;
  }
}

export function playPCM(
  base64Data: string,
  sampleRate = 24000,
  onEnded?: () => void,
  destination?: AudioNode
): AudioBufferSourceNode | null {
  try {
    stopPCM();
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const audioContext = destination ? (destination.context as AudioContext) : getSharedAudioContext();
    const buffer = audioContext.createBuffer(1, bytes.length / 2, sampleRate);
    const channelData = buffer.getChannelData(0);

    const dataView = new DataView(bytes.buffer);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    if (destination) {
      source.connect(destination);
    } else {
      source.connect(audioContext.destination);
    }
    source.onended = () => {
      if (currentSource === source) currentSource = null;
      if (onEnded) onEnded();
    };
    source.start();
    currentSource = source;
    return source;
  } catch (error) {
    console.error("Failed to play PCM:", error);
    if (onEnded) onEnded();
    return null;
  }
}

export function playPCMAsync(base64Data: string, sampleRate = 24000, destination?: AudioNode): Promise<void> {
  return new Promise((resolve) => {
    const source = playPCM(base64Data, sampleRate, resolve, destination);
    if (!source) resolve();
  });
}
