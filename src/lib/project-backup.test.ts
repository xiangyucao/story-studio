import { describe, expect, it } from "vitest";
import { parseProjectBackup, projectBackupFormat, projectBackupVersion, type ProjectBackup } from "./project-backup";

function sample(): ProjectBackup {
  return {
    format: projectBackupFormat,
    version: projectBackupVersion,
    exportedAt: "2026-07-15T00:00:00.000Z",
    project: { sourceId: "p1", title: "测试作品", genre: "悬疑", premise: "", styleGuide: "", referenceTitle: "", referenceText: "", writingLanguage: "zh-CN", createdAt: "", updatedAt: "" },
    outline: [{ sourceId: "o1", sourceParentId: null, type: "chapter", title: "第一章", summary: "开端", position: 0, status: "planned", revision: 1 }],
    chapters: [{ sourceId: "c1", sourceOutlineNodeId: "o1", title: "第一章", content: "正文", summary: "开端", status: "draft", position: 0, wordCount: 2, targetWordCount: 3000, outlineStale: false, basedOnOutlineRevision: 1, updatedAt: "" }],
    characters: [{ sourceId: "a1", name: "林月", role: "主角", description: "", goal: "", fear: "", secret: "", voice: "", status: "active" }],
    relationships: [], worldEntries: [], events: [], revisions: [], illustrations: [],
  };
}

describe("project backup", () => {
  it("accepts a complete versioned backup", () => {
    const parsed = parseProjectBackup(JSON.stringify(sample()));
    expect(parsed.project.title).toBe("测试作品");
    expect(parsed.chapters[0].content).toBe("正文");
  });

  it("rejects files from another format", () => {
    expect(() => parseProjectBackup({ ...sample(), format: "other" })).toThrow("不是 Story Studio");
  });

  it("rejects broken cross references before import", () => {
    const value = sample();
    value.chapters[0].sourceOutlineNodeId = "missing";
    expect(() => parseProjectBackup(value)).toThrow("不存在的 ID");
  });

  it("rejects invalid illustration data", () => {
    const value = sample();
    value.illustrations.push({ sourceId: "i1", sourceChapterId: "c1", fileName: "x.png", mimeType: "image/png", caption: "", position: 0, createdAt: "", dataBase64: "not base64" });
    expect(() => parseProjectBackup(value)).toThrow("Base64");
  });

  it("rejects cyclic outline parents", () => {
    const value = sample();
    value.outline.push({ sourceId: "o2", sourceParentId: "o1", type: "scene", title: "场景", summary: "", position: 1, status: "planned", revision: 1 });
    value.outline[0].sourceParentId = "o2";
    expect(() => parseProjectBackup(value)).toThrow("循环父子关系");
  });
});
