export type FoundationProposal = {
  rationale: string;
  genre: string;
  premise: string;
  styleGuide: string;
};

function readable(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(readable).filter(Boolean).join("；");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key}：${readable(item)}`)
      .filter((item) => !item.endsWith("："))
      .join("；");
  }
  return "";
}

export function normalizeFoundationProposal(value: unknown): FoundationProposal {
  if (!value || typeof value !== "object") throw new Error("作品基石提案必须是 JSON 对象");
  const record = value as Record<string, unknown>;
  const genre = readable(record.genre ?? record.type ?? record.category);
  const premise = readable(record.premise ?? record.coreIdea ?? record.coreConcept ?? record.concept);
  const styleGuide = readable(record.styleGuide ?? record.writingStyle ?? record.style ?? record.rules);
  const rationale = readable(record.rationale ?? record.analysis ?? record.reason) || "AI 已根据参考范本提炼作品基石。";
  if (!genre) throw new Error("AI 返回结果缺少 genre（类型）");
  if (!premise) throw new Error("AI 返回结果缺少 premise（核心构想）");
  if (!styleGuide) throw new Error("AI 返回结果缺少 styleGuide（写作风格）");
  return { rationale, genre, premise, styleGuide };
}
