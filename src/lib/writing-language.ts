import type { Project, WritingLanguage } from "./types";

export type ResolvedWritingLanguage = Exclude<WritingLanguage, "auto">;

const labels: Record<ResolvedWritingLanguage, string> = {
  en: "English",
  "zh-CN": "Simplified Chinese（简体中文）",
  "zh-TW": "Traditional Chinese（繁體中文）",
};

function inferFromText(text: string): ResolvedWritingLanguage | null {
  const cjk = text.match(/[\u3400-\u9fff]/g)?.length || 0;
  const latinWords = text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length || 0;
  if (latinWords >= 3 && latinWords >= cjk * 0.65) return "en";
  if (cjk >= 2) {
    const traditionalHints = text.match(/[體與為這個來時會說書後裡還點開關係寫實應該讓]/g)?.length || 0;
    return traditionalHints >= 3 ? "zh-TW" : "zh-CN";
  }
  return null;
}

export function resolveWritingLanguage(project: Project, priorityText: string[] = []) {
  const configured = project.writingLanguage || "auto";
  const code = configured === "auto"
    ? inferFromText(priorityText.filter(Boolean).join("\n"))
      || inferFromText([project.title, project.genre, project.premise, project.styleGuide, project.referenceText.slice(0, 5000)].join("\n"))
      || "zh-CN"
    : configured;
  const label = labels[code];
  return {
    code,
    label,
    directive: `The required writing language is ${label}. All creative prose, titles, summaries, dialogue, and narrative text must be written only in ${label}. Do not switch languages because the instructions or metadata labels use another language.`,
  };
}
