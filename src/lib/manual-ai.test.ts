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
});
