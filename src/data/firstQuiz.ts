import type { Quiz } from "../types";

const SPACE_IMAGE =
  "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=1600&auto=format&fit=crop";
const LEARNING_IMAGE =
  "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=1600&auto=format&fit=crop";
const SCIENCE_IMAGE =
  "https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=1600&auto=format&fit=crop";
const WORLD_IMAGE =
  "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?q=80&w=1600&auto=format&fit=crop";
const NATURE_IMAGE =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop";

export const firstQuiz: Quiz = {
  title: "5 General Knowledge Questions | Can You Score 5/5?",
  themeColor: "violet",
  themePreset: "default",
  timerStyle: "line",
  transitionEffect: "slide",
  language: "en",
  videoFormat: "vertical",
  timerDuration: 5,
  watermark: "@EnglishQuizArena",
  bgmEnabled: true,
  bgmType: "tense",
  voiceName: "Kore",
  questions: [
    {
      id: "gk-01",
      text: "Which planet is the largest in our solar system?",
      options: ["Mars", "Jupiter", "Venus"],
      correctOptionIndex: 1,
      explanation: "Jupiter is the largest planet and is more massive than all the others combined.",
      backgroundImage: SPACE_IMAGE,
    },
    {
      id: "gk-02",
      text: "What is the capital city of Australia?",
      options: ["Sydney", "Melbourne", "Canberra"],
      correctOptionIndex: 2,
      explanation: "Canberra was selected as the capital as a compromise between Sydney and Melbourne.",
      backgroundImage: WORLD_IMAGE,
    },
    {
      id: "gk-03",
      text: "Which gas do plants absorb during photosynthesis?",
      options: ["Carbon dioxide", "Oxygen", "Nitrogen"],
      correctOptionIndex: 0,
      explanation: "Plants absorb carbon dioxide and use sunlight to produce glucose and oxygen.",
      backgroundImage: NATURE_IMAGE,
    },
    {
      id: "gk-04",
      text: "Who wrote the novel \"1984\"?",
      options: ["George Orwell", "Charles Dickens", "Mark Twain"],
      correctOptionIndex: 0,
      explanation: "George Orwell published the dystopian novel 1984 in 1949.",
      backgroundImage: LEARNING_IMAGE,
    },
    {
      id: "gk-05",
      text: "What is the smallest prime number?",
      options: ["0", "1", "2"],
      correctOptionIndex: 2,
      explanation: "Two is the smallest prime and the only even prime number.",
      backgroundImage: SCIENCE_IMAGE,
    },
  ],
};
