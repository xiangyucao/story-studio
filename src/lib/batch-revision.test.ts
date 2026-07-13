import { describe, expect, it } from "vitest";
import { parseBatchRevisionJson, resolveBatchRevisionTargets } from "./batch-revision";
import type { Workspace } from "./types";

const workspace = {
  project: { id: "p" }, projects: [], characters: [], relationships: [], worldEntries: [], events: [], illustrations: [], revisions: [],
  outline: [
    { id: "v1", projectId: "p", parentId: null, type: "volume", title: "Volume One", summary: "", position: 0, status: "planned", revision: 1 },
    { id: "o1", projectId: "p", parentId: "v1", type: "chapter", title: "Chapter 1", summary: "", position: 0, status: "planned", revision: 1 },
  ],
  chapters: [{ id: "c1", projectId: "p", outlineNodeId: "o1", title: "Chapter 1", content: "Existing prose", summary: "", status: "draft", position: 0, wordCount: 2, targetWordCount: 3000, outlineStale: false, basedOnOutlineRevision: 1, updatedAt: "" }],
} as Workspace;

describe("batch chapter revision JSON", () => {
  it("parses tasks and removes external citation markers", () => {
    expect(parseBatchRevisionJson('[{"volume":1,"chapter":1,"instruction":"Tighten the ending[cite: 1]."}]')[0]).toEqual({ volume: 1, chapter: 1, instruction: "Tighten the ending." });
  });

  it("resolves one-based volume and chapter numbers", () => {
    const [target] = resolveBatchRevisionTargets(workspace, [{ volume: 1, chapter: 1, instruction: "Revise it." }]);
    expect(target.chapterRecord.id).toBe("c1");
    expect(target.volumeTitle).toBe("Volume One");
  });

  it("rejects missing and duplicate targets before any AI call", () => {
    expect(() => resolveBatchRevisionTargets(workspace, [{ volume: 2, chapter: 1, instruction: "Revise." }])).toThrow("找不到第 2 卷");
    expect(() => resolveBatchRevisionTargets(workspace, [{ volume: 1, chapter: 1, instruction: "A" }, { volume: 1, chapter: 1, instruction: "B" }])).toThrow("重复任务");
  });
});
