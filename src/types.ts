export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
  backgroundImage: string;
  audioBase64?: string;
  correctAudioBase64?: string;
  fact?: string;
}

export interface Quiz {
  title: string;
  questions: Question[];
  voiceName?: string;
  timerDuration?: number;
  watermark?: string;
  themeColor?: 'emerald' | 'cyan' | 'violet' | 'rose' | 'amber';
  bgmEnabled?: boolean;
  customBgmBase64?: string;
  customBgmName?: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
}
