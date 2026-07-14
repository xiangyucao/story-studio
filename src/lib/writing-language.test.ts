import { describe, expect, it } from "vitest";
import { resolveWritingLanguage } from "./writing-language";
import type { Project } from "./types";

const project = (writingLanguage: Project["writingLanguage"], premise = ""): Project => ({
  id: "p", title: "Story", genre: "", premise, styleGuide: "", referenceTitle: "", referenceText: "",
  writingLanguage, createdAt: "", updatedAt: "",
});

describe("resolveWritingLanguage", () => {
  it("自动从当前章节标题和大纲识别英文", () => {
    expect(resolveWritingLanguage(project("auto"), ["Chapter 3: The Last Signal", "Mara crosses the frozen harbor and finds the transmitter."]).code).toBe("en");
  });

  it("手动设置优先于大纲语言", () => {
    expect(resolveWritingLanguage(project("zh-TW"), ["Chapter 3: The Last Signal"]).code).toBe("zh-TW");
  });

  it("没有足够信息时保持简体中文默认值", () => {
    expect(resolveWritingLanguage(project("auto")).code).toBe("zh-CN");
  });

  it.each([
    ["de", "Der Mann geht in die Stadt und findet das alte Haus."],
    ["es", "La mujer entra en la ciudad y encuentra una carta que nadie esperaba."],
    ["fr", "La femme entre dans la ville et trouve une lettre que personne n’attendait."],
    ["ja", "彼女は古い駅に入り、誰も知らない手紙を見つけた。"],
    ["pt-BR", "A mulher entra na cidade com uma carta que não deveria existir."],
    ["it", "La donna entra nella città con una lettera che non dovrebbe esistere."],
    ["ko", "그녀는 오래된 역에 들어가 아무도 모르는 편지를 발견했다."],
  ] as const)("自动识别 %s", (expected, sample) => {
    expect(resolveWritingLanguage(project("auto"), [sample]).code).toBe(expected);
  });
});
