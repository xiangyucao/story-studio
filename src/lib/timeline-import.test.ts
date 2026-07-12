import { describe, expect, it } from "vitest";
import { normalizeTimelineImportData, parseTimelineImportJson } from "./timeline-import";

describe("timeline JSON import", () => {
  it("parses complete and partial events", () => {
    const result = parseTimelineImportJson(`{"events":[{"title":"钟表跳跃","storyTime":"深夜","causes":"共振"},{"title":"邻居消失"}]}`);
    expect(result.events[0]).toMatchObject({ title: "钟表跳跃", storyTime: "深夜", causes: "共振" });
    expect(result.events[1]).toMatchObject({ title: "邻居消失", description: "", consequences: "" });
  });

  it("rejects duplicate event titles", () => {
    expect(() => normalizeTimelineImportData({ events: [{ title: "邻居消失" }, { title: " 邻居消失 " }] })).toThrow("重复出现");
  });
});
