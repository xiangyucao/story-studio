import { describe, expect, it } from "vitest";
import { normalizeWorldImportData, parseWorldImportJson } from "./world-import";

describe("world JSON import", () => {
  it("parses complete and partial world entries", () => {
    const result = parseWorldImportJson(`{"worldEntries":[{"name":"翡翠城","category":"地点","isCanon":true},{"name":"零号冷库"}]}`);
    expect(result.worldEntries[0]).toMatchObject({ name: "翡翠城", category: "地点", isCanon: true });
    expect(result.worldEntries[1]).toMatchObject({ name: "零号冷库", description: "", isCanon: null });
  });

  it("rejects duplicate names and invalid canon values", () => {
    expect(() => normalizeWorldImportData({ worldEntries: [{ name: "翡翠城" }, { name: " 翡翠城 " }] })).toThrow("重复出现");
    expect(() => normalizeWorldImportData({ worldEntries: [{ name: "翡翠城", isCanon: "yes" }] })).toThrow("true 或 false");
  });
});
