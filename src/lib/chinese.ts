import { Converter } from "opencc-js";

export type ChineseScript = "simplified" | "traditional";

const toTraditional = Converter({ from: "cn", to: "tw" });

export function convertChinese(text: string, script: ChineseScript) {
  return script === "traditional" ? toTraditional(text) : text;
}

export function scriptFrom(value: string | null | undefined): ChineseScript {
  return value === "traditional" ? "traditional" : "simplified";
}

export function safeExportName(title: string) {
  return title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "") || "未命名作品";
}
