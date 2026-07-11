import { describe, expect, it } from "vitest";
import { buildStoryContext } from "./context";
import type { Workspace } from "./types";

const workspace: Workspace = {
  projects: [],
  project: { id: "p", title: "测试作品", genre: "悬疑", premise: "寻找失踪者", styleGuide: "限制视角", createdAt: "", updatedAt: "" },
  outline: [
    { id: "o", projectId: "p", parentId: null, type: "chapter", title: "第二章", summary: "取得钥匙", position: 0, status: "planned", revision: 1 },
    { id: "s", projectId: "p", parentId: "o", type: "scene", title: "修理铺试探", summary: "林月观察陈叔的回避", position: 1, status: "planned", revision: 1 },
  ],
  chapters: [
    { id: "c1", projectId: "p", outlineNodeId: null, title: "第一章", content: "旧内容", summary: "收到信", status: "draft", position: 0, wordCount: 3, outlineStale: false, basedOnOutlineRevision: 1, updatedAt: "" },
    { id: "c2", projectId: "p", outlineNodeId: "o", title: "第二章", content: "当前内容", summary: "找到钥匙", status: "draft", position: 1, wordCount: 4, outlineStale: false, basedOnOutlineRevision: 1, updatedAt: "" },
  ],
  characters: [{ id: "a", projectId: "p", name: "林月", role: "主角", description: "记者", goal: "找父亲", fear: "记忆错误", secret: "见过仓库", voice: "短句", status: "active" }],
  relationships: [],
  worldEntries: [
    { id: "w1", projectId: "p", category: "规则", name: "潮汐", description: "低潮开启通道", isCanon: true },
    { id: "w2", projectId: "p", category: "草案", name: "废弃设定", description: "不应进入提示", isCanon: false },
  ],
  events: [{ id: "e", projectId: "p", chapterId: "c2", chapterTitle: "第二章", title: "取得钥匙", storyTime: "第二天", description: "获得钥匙", causes: "受人委托", consequences: "可以进入仓库" }],
  illustrations: [],
  revisions: [],
};

describe("buildStoryContext", () => {
  it("包含相关人物、硬设定和事件因果", () => {
    const context = buildStoryContext(workspace, "c2");
    expect(context).toContain("林月");
    expect(context).toContain("个性与经历=记者");
    expect(context).toContain("低潮开启通道");
    expect(context).toContain("获得钥匙");
    expect(context).toContain("原因：受人委托");
    expect(context).toContain("结果：可以进入仓库");
    expect(context).toContain("修理铺试探");
  });

  it("排除未标记为硬设定的条目", () => {
    expect(buildStoryContext(workspace, "c2")).not.toContain("废弃设定");
  });
});
