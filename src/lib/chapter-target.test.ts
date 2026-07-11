import { describe, expect, it } from "vitest";
import { hasWrongChapterHeading } from "./chapter-target";

describe("hasWrongChapterHeading", () => {
  it("拦截模型把第六章写成第五章", () => {
    expect(hasWrongChapterHeading("### 第5章：神经放电的真实\n正文", "第6章：桥梁的支撑")).toEqual({
      returnedHeading: "第5章：神经放电的真实",
      wrong: true,
    });
  });

  it("也拦截不带 Markdown 井号的错误标题", () => {
    expect(hasWrongChapterHeading("第5章：神经放电的真实\n正文", "第6章：桥梁的支撑").wrong).toBe(true);
  });

  it("允许目标章节或不带标题的正文", () => {
    expect(hasWrongChapterHeading("# 第6章：桥梁的支撑\n正文", "第6章：桥梁的支撑").wrong).toBe(false);
    expect(hasWrongChapterHeading("雨从凌晨一直落到傍晚。", "第6章：桥梁的支撑").wrong).toBe(false);
  });
});
