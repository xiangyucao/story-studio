import { groupChaptersByVolume } from "./manuscript";
import type { Chapter, Workspace } from "./types";

export type BatchRevisionInstruction = { volume: number; chapter: number; instruction: string };
export type ResolvedBatchRevision = BatchRevisionInstruction & { volumeTitle: string; chapterRecord: Chapter };

export const batchRevisionExample: BatchRevisionInstruction[] = [
  { volume: 1, chapter: 7, instruction: "Remove the premature solution and leave one crucial variable unresolved." },
  { volume: 2, chapter: 5, instruction: "Consolidate the map-overlay discovery in this chapter." },
];

export function parseBatchRevisionJson(source: string): BatchRevisionInstruction[] {
  let value: unknown;
  try { value = JSON.parse(source); } catch { throw new Error("JSON 无法解析，请检查逗号、引号和括号"); }
  if (!Array.isArray(value) || value.length === 0) throw new Error("JSON 必须是包含至少一条修改任务的数组");
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`第 ${index + 1} 条任务必须是对象`);
    const record = item as Record<string, unknown>;
    const volume = Number(record.volume);
    const chapter = Number(record.chapter);
    const instruction = typeof record.instruction === "string" ? record.instruction.replace(/\[cite\s*:\s*[^\]]+\]/gi, "").replace(/\s{2,}/g, " ").trim() : "";
    if (!Number.isInteger(volume) || volume < 1) throw new Error(`第 ${index + 1} 条任务的 volume 必须是从 1 开始的整数`);
    if (!Number.isInteger(chapter) || chapter < 1) throw new Error(`第 ${index + 1} 条任务的 chapter 必须是从 1 开始的整数`);
    if (!instruction) throw new Error(`第 ${index + 1} 条任务缺少 instruction`);
    return { volume, chapter, instruction };
  });
}

export function resolveBatchRevisionTargets(workspace: Workspace, instructions: BatchRevisionInstruction[]): ResolvedBatchRevision[] {
  const volumes = groupChaptersByVolume(workspace).filter((group) => group.volume);
  const seen = new Set<string>();
  return instructions.map((item) => {
    const key = `${item.volume}:${item.chapter}`;
    if (seen.has(key)) throw new Error(`第 ${item.volume} 卷第 ${item.chapter} 章出现了重复任务`);
    seen.add(key);
    const group = volumes[item.volume - 1];
    if (!group?.volume) throw new Error(`找不到第 ${item.volume} 卷；当前作品共有 ${volumes.length} 卷`);
    const chapterRecord = group.chapters[item.chapter - 1];
    if (!chapterRecord) throw new Error(`《${group.volume.title}》找不到第 ${item.chapter} 章；本卷共有 ${group.chapters.length} 章`);
    if (!chapterRecord.content.trim()) throw new Error(`《${group.volume.title}》第 ${item.chapter} 章“${chapterRecord.title}”还没有正文，不能执行修改`);
    return { ...item, volumeTitle: group.volume.title, chapterRecord };
  });
}
