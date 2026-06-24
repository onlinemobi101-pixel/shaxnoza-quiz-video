export async function generateTTS(text: string, voiceName: string = "Kore"): Promise<string | null> {
  try {
    const response = await fetch("/api/generate-tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, voiceName }),
    });

    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }

    const data = await response.json();
    return data.audioBase64 || null;
  } catch (error) {
    console.error("TTS generation failed:", error);
    return null;
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
