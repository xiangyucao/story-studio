import type { Chapter, Character, OutlineNode, Relationship, StoryEvent, WorldEntry } from "./types";

export type LogicEvidence = {
  eventHits: StoryEvent[];
  characterHits: Character[];
  relationshipHits: Relationship[];
  worldHits: WorldEntry[];
  outlineHits: OutlineNode[];
  chapterHits: Chapter[];
};

export type LogicSource = {
  kind: "chapter" | "outline" | "character" | "relationship" | "world" | "event";
  id: string;
  label: string;
  excerpt: string;
};

export function parseLogicQueries(raw: string, originalQuery: string) {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) as { queries?: unknown } : {};
    const proposed = Array.isArray(parsed.queries) ? parsed.queries.filter((item): item is string => typeof item === "string" && item.trim().length > 1) : [];
    return [...new Set([originalQuery.trim(), ...proposed.map((item) => item.trim())])].slice(0, 3);
  } catch {
    return [originalQuery.trim()];
  }
}

export function mergeLogicEvidence(rounds: LogicEvidence[]): LogicEvidence {
  const merge = <T extends { id: string }>(items: T[][], limit: number) => Array.from(new Map(items.flat().map((item) => [item.id, item])).values()).slice(0, limit);
  return {
    eventHits: merge(rounds.map((round) => round.eventHits), 10),
    characterHits: merge(rounds.map((round) => round.characterHits), 8),
    relationshipHits: merge(rounds.map((round) => round.relationshipHits), 10),
    worldHits: merge(rounds.map((round) => round.worldHits), 8),
    outlineHits: merge(rounds.map((round) => round.outlineHits), 12),
    chapterHits: merge(rounds.map((round) => round.chapterHits), 8),
  };
}

export function buildLogicSources(evidence: LogicEvidence): LogicSource[] {
  return [
    ...evidence.chapterHits.map((item) => ({ kind: "chapter" as const, id: item.id, label: item.title, excerpt: item.summary || item.content.slice(0, 180) })),
    ...evidence.outlineHits.slice(0, 6).map((item) => ({ kind: "outline" as const, id: item.id, label: item.title, excerpt: item.summary })),
    ...evidence.characterHits.slice(0, 4).map((item) => ({ kind: "character" as const, id: item.id, label: item.name, excerpt: `${item.role}；目标：${item.goal}` })),
    ...evidence.relationshipHits.slice(0, 4).map((item) => ({ kind: "relationship" as const, id: item.id, label: `${item.sourceName} → ${item.targetName}`, excerpt: `${item.type}：${item.description}` })),
    ...evidence.worldHits.slice(0, 4).map((item) => ({ kind: "world" as const, id: item.id, label: item.name, excerpt: item.description })),
    ...evidence.eventHits.slice(0, 4).map((item) => ({ kind: "event" as const, id: item.id, label: item.title, excerpt: `${item.storyTime}；${item.description}` })),
  ];
}

export function formatLogicEvidence(evidence: LogicEvidence) {
  return [
    `## 人物\n${evidence.characterHits.map((item) => `- [人物：${item.name}] 角色=${item.role}；描述=${item.description}；目标=${item.goal}；恐惧=${item.fear}；秘密=${item.secret}`).join("\n") || "无"}`,
    `## 人物关系\n${evidence.relationshipHits.map((item) => `- [关系：${item.sourceName} → ${item.targetName}] ${item.type}；${item.description}`).join("\n") || "无"}`,
    `## 世界观\n${evidence.worldHits.map((item) => `- [设定：${item.name}] ${item.category}；${item.description}；${item.isCanon ? "硬设定" : "草稿"}`).join("\n") || "无"}`,
    `## 时间线\n${evidence.eventHits.map((item) => `- [事件：${item.title}] 时间=${item.storyTime}；经过=${item.description}；原因=${item.causes}；结果=${item.consequences}`).join("\n") || "无"}`,
    `## 大纲\n${evidence.outlineHits.map((item) => `- [大纲：${item.title}] ${item.summary}`).join("\n") || "无"}`,
    `## 相关章节原文\n${evidence.chapterHits.map((item) => `### [章节：${item.title}]\n摘要：${item.summary}\n---原文开始---\n${item.content.slice(0, 6500)}\n---原文结束---`).join("\n\n") || "无"}`,
  ].join("\n\n");
}
