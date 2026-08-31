import { Quiz } from "../types";

export type LongVideoDuration = NonNullable<Quiz["targetDuration"]>;

export interface LongVideoPreset {
  durationMinutes: LongVideoDuration;
  questionCount: number;
  timerSeconds: number;
}

export const LONG_VIDEO_PRESETS: readonly LongVideoPreset[] = [
  { durationMinutes: 2, questionCount: 5, timerSeconds: 6 },
  { durationMinutes: 3, questionCount: 8, timerSeconds: 8 },
  { durationMinutes: 5, questionCount: 12, timerSeconds: 8 },
  { durationMinutes: 8, questionCount: 20, timerSeconds: 8 },
  { durationMinutes: 10, questionCount: 25, timerSeconds: 10 },
  { durationMinutes: 12, questionCount: 30, timerSeconds: 12 },
] as const;

export function getLongVideoPreset(duration: Quiz["targetDuration"] = 3): LongVideoPreset {
  return LONG_VIDEO_PRESETS.find((preset) => preset.durationMinutes === duration) || LONG_VIDEO_PRESETS[1];
}

export function getIntroDurationMs(quiz: Quiz): number {
  return quiz.videoFormat === "youtube" ? 6000 : 2000;
}

export function getOutroDurationMs(quiz: Quiz): number {
  return quiz.videoFormat === "youtube" ? 6000 : 3500;
}

export function getTargetQuestionDurationMs(quiz: Quiz): number | null {
  if (quiz.videoFormat !== "youtube" || !quiz.questions.length) return null;
  const targetMs = (quiz.targetDuration || 8) * 60 * 1000;
  const reservedMs = getIntroDurationMs(quiz) + getOutroDurationMs(quiz);
  return Math.max(1000, (targetMs - reservedMs) / quiz.questions.length);
}
