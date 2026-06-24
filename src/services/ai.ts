import { Question } from "../types";

export async function generateQuizAI(topic: string): Promise<Question[] | null> {
  try {
    const response = await fetch("/api/generate-quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ topic }),
    });

    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("AI generation failed:", error);
    return null;
  }
}
