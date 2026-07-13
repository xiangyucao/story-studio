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
});
