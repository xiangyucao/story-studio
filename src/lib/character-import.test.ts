import { describe, expect, it } from "vitest";
import { normalizeCharacterImportData, parseCharacterImportJson } from "./character-import";

describe("character JSON import", () => {
  it("parses characters and relationships with optional fields", () => {
    const result = parseCharacterImportJson(`{
      "characters": [{"name":"林弦", "role":"主角"}, {"name":"父亲", "secret":"跌入逻辑漏洞"}],
      "relationships": [{"sourceName":"父亲", "targetName":"林弦", "type":"父子"}]
    }`);
    expect(result.characters[0]).toMatchObject({ name: "林弦", role: "主角", goal: "" });
    expect(result.relationships[0]).toMatchObject({ sourceName: "父亲", targetName: "林弦", description: "" });
  });

  it("rejects duplicate people and self relationships", () => {
    expect(() => normalizeCharacterImportData({ characters: [{ name: "林弦" }, { name: " 林弦 " }] })).toThrow("重复出现");
    expect(() => normalizeCharacterImportData({ characters: [], relationships: [{ sourceName: "林弦", targetName: "林弦", type: "自己" }] })).toThrow("同一个人物");
  });

  it("reports malformed JSON clearly", () => {
    expect(() => parseCharacterImportJson('{"characters": [}')).toThrow("不是有效的 JSON");
  });
});
