import { describe, expect, it } from "vitest";
import { convertChinese, safeExportName, scriptFrom } from "./chinese";

describe("Chinese export helpers", () => {
  it("converts simplified Chinese to traditional Chinese", () => {
    expect(convertChinese("雾港来信与旧仓库", "traditional")).toBe("霧港來信與舊倉庫");
  });

  it("leaves simplified exports unchanged", () => {
    expect(convertChinese("雾港来信", "simplified")).toBe("雾港来信");
    expect(scriptFrom("unexpected")).toBe("simplified");
  });

  it("creates safe filenames", () => {
    expect(safeExportName("雾港:来信? ")).toBe("雾港_来信_");
  });
});
