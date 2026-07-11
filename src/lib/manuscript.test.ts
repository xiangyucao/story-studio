import { describe, expect, it } from "vitest";
import { groupChaptersByVolume } from "./manuscript";
import type { Workspace } from "./types";

describe("groupChaptersByVolume", () => {
  it("按卷归档章节并保留未归档章节", () => {
    const workspace = {
      outline: [
        { id: "v1", type: "volume", parentId: null, title: "第一卷", position: 0 },
        { id: "o1", type: "chapter", parentId: "v1", title: "第一章", position: 1 },
      ],
      chapters: [
        { id: "c1", outlineNodeId: "o1", title: "第一章", position: 0 },
        { id: "c2", outlineNodeId: null, title: "附录", position: 1 },
      ],
    } as unknown as Workspace;
    const groups = groupChaptersByVolume(workspace);
    expect(groups.map((group) => group.volume?.title || "未归档章节")).toEqual(["第一卷", "未归档章节"]);
    expect(groups[0].chapters[0].title).toBe("第一章");
    expect(groups[1].chapters[0].title).toBe("附录");
  });
});
