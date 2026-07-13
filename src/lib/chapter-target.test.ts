import { describe, expect, it } from "vitest";
import { hasWrongChapterHeading, stripLeadingChapterHeading } from "./chapter-target";

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

  it("识别英文 Chapter 标题并统一中英文数字", () => {
    expect(hasWrongChapterHeading("Chapter 5: The Quiver\n正文", "第六章：桥梁").wrong).toBe(true);
    expect(hasWrongChapterHeading("Chapter 6: The Bridge\n正文", "第六章：桥梁").wrong).toBe(false);
  });

  it("移除模型在正文开头重复输出的中英文章节标题", () => {
    expect(stripLeadingChapterHeading("Chapter 1: The Quiver of Gears\n\nThe gears trembled.")).toBe("The gears trembled.");
    expect(stripLeadingChapterHeading("### 第一章：齿轮轻颤\n\n齿轮颤动起来。 ")).toBe("齿轮颤动起来。");
    expect(stripLeadingChapterHeading("雨落在旧窗上。\n第二段")).toBe("雨落在旧窗上。\n第二段");
  });
});
