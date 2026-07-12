import { describe, expect, it } from "vitest";
import { normalizeFoundationProposal } from "./foundation-proposal";

describe("normalizeFoundationProposal", () => {
  it("兼容本地模型把风格指南返回为数组", () => {
    expect(normalizeFoundationProposal({
      genre: "心理悬疑",
      premise: "观察者逐步失去现实锚点",
      styleGuide: ["限制视角", "短句", "减少解释"],
    })).toEqual({
      rationale: "AI 已根据参考范本提炼作品基石。",
      genre: "心理悬疑",
      premise: "观察者逐步失去现实锚点",
      styleGuide: "限制视角；短句；减少解释",
    });
  });

  it("兼容常见的英文替代字段", () => {
    const result = normalizeFoundationProposal({ analysis: "冷峻风格", type: "科幻", coreIdea: "新的构想", writingStyle: "克制" });
    expect(result).toEqual({ rationale: "冷峻风格", genre: "科幻", premise: "新的构想", styleGuide: "克制" });
  });
});
