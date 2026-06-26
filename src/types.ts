export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
  backgroundImage: string;
  audioBase64?: string;
  correctAudioBase64?: string;
}

export interface Quiz {
  title: string;
  questions: Question[];
  voiceName?: string;
  timerDuration?: number;
  watermark?: string;
  themeColor?: 'emerald' | 'cyan' | 'violet' | 'rose' | 'amber';
  themePreset?: 'default' | 'cyberpunk' | 'retro' | 'sunset' | 'chalk';
  bgmEnabled?: boolean;
  bgmType?: 'calm' | 'happy' | 'tense';
  timerStyle?: 'circular' | 'line' | 'digital';
  transitionEffect?: 'slide' | 'zoom' | 'fade';
}

export interface UserProfile {
  uid: string;
  email: string | null;
  role: 'free' | 'premium' | 'pack10';
  videosCreated: number;
  premiumUntil: string | null;
}

