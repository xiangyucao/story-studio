import { describe, expect, it } from "vitest";
import { mergeLogicEvidence, parseLogicQueries, type LogicEvidence } from "./logic-analysis";

const empty = (): LogicEvidence => ({ eventHits: [], characterHits: [], relationshipHits: [], worldHits: [], outlineHits: [], chapterHits: [] });

describe("AI logic analysis helpers", () => {
  it("parses and limits retrieval queries", () => {
    expect(parseLogicQueries('{"queries":["父亲 笔记 坐标","林弦 信任 转变","额外查询"]}', "林弦为什么相信父亲？")).toEqual([
      "林弦为什么相信父亲？", "父亲 笔记 坐标", "林弦 信任 转变",
    ]);
    expect(parseLogicQueries("not json", "原问题")).toEqual(["原问题"]);
  });

  it("deduplicates evidence across rounds", () => {
    const first = empty();
    const second = empty();
    first.chapterHits = [{ id: "c1" } as LogicEvidence["chapterHits"][number]];
    second.chapterHits = [{ id: "c1" } as LogicEvidence["chapterHits"][number], { id: "c2" } as LogicEvidence["chapterHits"][number]];
    expect(mergeLogicEvidence([first, second]).chapterHits.map((item) => item.id)).toEqual(["c1", "c2"]);
  });
});
