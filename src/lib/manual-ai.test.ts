import { describe, expect, it } from "vitest";
import { buildManualAiPrompt, parseManualAiResponse } from "./manual-ai";

describe("manual external AI workflow", () => {
  it("includes the only target chapter and suggested word count", () => {
    const prompt = buildManualAiPrompt({
      action: "expand", context: "人物与硬设定", instruction: "加强悬疑感", selection: "已有正文",
      targetChapter: { id: "c6", title: "第6章：桥梁", summary: "建立意识桥梁", targetWordCount: 3600 },
    });
    expect(prompt).toContain("第6章：桥梁");
    expect(prompt).toContain("约 3600 字");
    expect(prompt).toContain("人物与硬设定");
  });

  it("turns pasted chapter text into a guarded proposal", () => {
    expect(parseManualAiResponse("expand", "新的完整正文", "c6")).toEqual({ type: "text", result: "新的完整正文", targetChapterId: "c6" });
  });

  it("parses structured outline responses inside code fences", () => {
    const result = parseManualAiResponse("outline", '```json\n{"rationale":"七卷推进","nodes":[{"type":"volume","title":"第一卷","summary":"开端"}]}\n```');
    expect(result.type).toBe("outline");
  });

  it("builds and parses a reference foundation analysis", () => {
    const prompt = buildManualAiPrompt({ action: "foundation", context: "参考范本：冷峻短句", instruction: "反推作品基石" });
    expect(prompt).toContain("不得复制范本人物、剧情");
    const result = parseManualAiResponse("foundation", '{"rationale":"节奏克制","genre":"心理悬疑","premise":"陌生城市中的身份追索","styleGuide":"限制视角；短句；少用解释"}');
    expect(result).toEqual({
      type: "foundation",
      proposal: { rationale: "节奏克制", genre: "心理悬疑", premise: "陌生城市中的身份追索", styleGuide: "限制视角；短句；少用解释" },
    });
  });

  it("为外部模型生成基于全文判断的精简范本指令", () => {
    const prompt = buildManualAiPrompt({ action: "compact-reference", context: "作品资料", selection: "完整参考原文", instruction: "精简", targetLength: 10000 });
    expect(prompt).toContain("约 10000 个中文字");
    expect(prompt).toContain("不得改写、概括");
    expect(prompt).toContain("不要机械地只取开头、中段和结尾");
    expect(prompt).toContain("完整参考原文");
  });
});
