export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
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
  themePreset?: 'default' | 'cyberpunk' | 'retro' | 'sunset' | 'chalk' | 'kids' | 'neon';
  bgmEnabled?: boolean;
  bgmType?: 'calm' | 'happy' | 'tense' | 'custom';
  customBgmBase64?: string;
  customBgmName?: string;
  timerStyle?: 'circular' | 'line' | 'digital';
  transitionEffect?: 'slide' | 'zoom' | 'fade';
  language?: 'uz' | 'en' | 'ru' | 'tr';
  videoFormat?: 'vertical' | 'youtube';
  targetDuration?: 2 | 3 | 5 | 8 | 10 | 12;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  role: 'free' | 'premium' | 'pack10' | 'admin';
  videosCreated: number;
  premiumUntil: string | null;
  quotaCycle: string | null;
  quotaUsed: number;
  quotaLimit: number | null;
  referralsCount?: number;
  bonusVideos?: number;
}

