import { describe, it, expect } from "vitest";
import { generateViralSocialCopy } from "../src/services/socialCopy";
import { Quiz } from "../src/types";

describe("Viral Social Copy Generator", () => {
  it("Geografiya mavzusi uchun to'g'ri hashtaglar va sarlavhalar tuzadi", () => {
    const quiz: Quiz = {
      title: "Dunyo Geografiyasi va Davlatlar",
      questions: [
        { id: "1", text: "Savol 1", options: ["A", "B"], correctOptionIndex: 0, backgroundImage: "" }
      ],
      language: "uz",
    };

    const copy = generateViralSocialCopy(quiz);

    expect(copy.titles.challenge).toContain("99% odam");
    expect(copy.titles.engaging).toContain("Dunyo Geografiyasi");
    expect(copy.hashtags).toContain("#shorts");
    expect(copy.hashtags).toContain("#geografiya");
    expect(copy.hashtags).toContain("#davlatlar");
    expect(copy.fullCaption).toContain("Izohlarda");
  });

  it("Rus tili tanlanganda ruscha sarlavha va hashtaglar qaytaradi", () => {
    const quiz: Quiz = {
      title: "История Мира",
      questions: [],
      language: "ru",
    };

    const copy = generateViralSocialCopy(quiz);
    expect(copy.titles.challenge).toContain("99% людей");
    expect(copy.hashtags).toContain("#викторина");
  });
});
