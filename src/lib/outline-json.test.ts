import { describe, expect, it } from "vitest";
import { parseOutlineJson } from "./outline-json";

describe("parseOutlineJson", () => {
  it("解析卷章场景树", () => {
    const result = parseOutlineJson(JSON.stringify({ outline: [{ type: "volume", title: "卷一", children: [{ type: "chapter", title: "第一章", children: [] }] }] }));
    expect(result.outline[0].children[0].title).toBe("第一章");
  });
  it("拒绝无效层级", () => {
    expect(() => parseOutlineJson(JSON.stringify({ outline: [{ type: "chapter", title: "章", children: [{ type: "volume", title: "卷" }] }] }))).toThrow("层级无效");
  });
});
