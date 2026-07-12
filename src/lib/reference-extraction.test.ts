import { describe, expect, it } from "vitest";
import { buildReferenceCandidates, selectReferenceCandidates } from "./reference-extraction";

describe("reference extraction", () => {
  it("把原文切成稳定编号的完整候选块", () => {
    const candidates = buildReferenceCandidates("第一段。\n\n第二段。\n\n第三段。", 10);
    expect(candidates.map((item) => item.id)).toEqual(["R0001", "R0002"]);
    expect(candidates.map((item) => item.text).join("\n\n")).toContain("第三段。");
  });

  it("忽略模型附加格式并按编号取回原文", () => {
    const candidates = buildReferenceCandidates(`${"甲。".repeat(100)}\n\n${"乙。".repeat(100)}\n\n${"丙。".repeat(100)}`, 220);
    const result = selectReferenceCandidates('```json\n{"selectedIds":["R0003","R0001"]}\n```', candidates, 500);
    expect(result).toContain("甲。");
    expect(result).toContain("丙。");
    expect(result.indexOf("甲。")).toBeLessThan(result.indexOf("丙。"));
  });

  it("没有有效编号时保留原范本", () => {
    const candidates = buildReferenceCandidates("原文段落。", 100);
    expect(() => selectReferenceCandidates("我建议选择第一段", candidates, 1000)).toThrow("没有返回有效");
  });
});
