import type { WritingLanguage } from "./types";

export const projectBackupFormat = "story-studio-project-backup";
export const projectBackupVersion = 1;

export type ProjectBackup = {
  format: typeof projectBackupFormat;
  version: typeof projectBackupVersion;
  exportedAt: string;
  project: {
    sourceId: string; title: string; genre: string; premise: string; styleGuide: string;
    referenceTitle: string; referenceText: string; writingLanguage: WritingLanguage;
    createdAt: string; updatedAt: string;
  };
  outline: Array<{
    sourceId: string; sourceParentId: string | null; type: "volume" | "chapter" | "scene";
    title: string; summary: string; position: number; status: string; revision: number;
  }>;
  chapters: Array<{
    sourceId: string; sourceOutlineNodeId: string | null; title: string; content: string; summary: string;
    status: string; position: number; wordCount: number; targetWordCount: number; outlineStale: boolean;
    basedOnOutlineRevision: number; updatedAt: string;
  }>;
  characters: Array<{
    sourceId: string; name: string; role: string; description: string; goal: string; fear: string;
    secret: string; voice: string; status: string;
  }>;
  relationships: Array<{
    sourceId: string; sourceCharacterId: string; targetCharacterId: string; sourceName: string;
    targetName: string; type: string; description: string;
  }>;
  worldEntries: Array<{
    sourceId: string; category: string; name: string; description: string; isCanon: boolean;
  }>;
  events: Array<{
    sourceId: string; sourceChapterId: string | null; chapterTitle: string | null; title: string;
    storyTime: string; description: string; causes: string; consequences: string;
  }>;
  revisions: Array<{
    sourceId: string; entityType: string; sourceEntityId: string; beforeContent: string;
    afterContent: string; instruction: string; createdAt: string;
  }>;
  illustrations: Array<{
    sourceId: string; sourceChapterId: string; fileName: string; mimeType: string; caption: string;
    position: number; createdAt: string; dataBase64: string | null;
  }>;
};

const writingLanguages = new Set<WritingLanguage>(["auto", "zh-CN", "zh-TW", "en", "de", "es", "fr", "ja", "pt-BR", "it", "ko"]);

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} 必须是对象`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} 必须是数组`);
  return value;
}

function text(value: unknown, label: string, allowEmpty = true): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) throw new Error(`${label} 必须是字符串${allowEmpty ? "" : "且不能为空"}`);
  return value;
}

function nullableText(value: unknown, label: string): string | null {
  if (value === null) return null;
  return text(value, label);
}

function number(value: unknown, label: string, fallback = 0): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} 必须是有限数字`);
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} 必须是布尔值`);
  return value;
}

function uniqueIds(items: Array<{ sourceId: string }>, label: string) {
  const ids = new Set<string>();
  items.forEach((item) => {
    if (ids.has(item.sourceId)) throw new Error(`${label} 中存在重复 ID：${item.sourceId}`);
    ids.add(item.sourceId);
  });
  return ids;
}

function requireReference(id: string | null, ids: Set<string>, label: string) {
  if (id && !ids.has(id)) throw new Error(`${label} 引用了不存在的 ID：${id}`);
}

export function parseProjectBackup(input: string | unknown): ProjectBackup {
  let raw: unknown = input;
  if (typeof input === "string") {
    try { raw = JSON.parse(input); } catch { throw new Error("完整作品 JSON 无法解析，请检查文件是否损坏"); }
  }
  const root = object(raw, "备份文件");
  if (root.format !== projectBackupFormat) throw new Error("这不是 Story Studio 完整作品备份文件");
  if (root.version !== projectBackupVersion) throw new Error(`不支持的备份版本：${String(root.version)}`);
  const p = object(root.project, "project");
  const writingLanguage = text(p.writingLanguage ?? "auto", "project.writingLanguage") as WritingLanguage;
  if (!writingLanguages.has(writingLanguage)) throw new Error(`不支持的写作语言：${writingLanguage}`);

  const backup: ProjectBackup = {
    format: projectBackupFormat,
    version: projectBackupVersion,
    exportedAt: text(root.exportedAt, "exportedAt"),
    project: {
      sourceId: text(p.sourceId, "project.sourceId", false), title: text(p.title, "project.title", false),
      genre: text(p.genre, "project.genre"), premise: text(p.premise, "project.premise"), styleGuide: text(p.styleGuide, "project.styleGuide"),
      referenceTitle: text(p.referenceTitle, "project.referenceTitle"), referenceText: text(p.referenceText, "project.referenceText"),
      writingLanguage, createdAt: text(p.createdAt, "project.createdAt"), updatedAt: text(p.updatedAt, "project.updatedAt"),
    },
    outline: array(root.outline, "outline").map((value, index) => {
      const item = object(value, `outline[${index}]`);
      const type = text(item.type, `outline[${index}].type`) as "volume" | "chapter" | "scene";
      if (!["volume", "chapter", "scene"].includes(type)) throw new Error(`outline[${index}].type 无效`);
      return { sourceId: text(item.sourceId, `outline[${index}].sourceId`, false), sourceParentId: nullableText(item.sourceParentId, `outline[${index}].sourceParentId`), type, title: text(item.title, `outline[${index}].title`, false), summary: text(item.summary, `outline[${index}].summary`), position: number(item.position, `outline[${index}].position`), status: text(item.status, `outline[${index}].status`), revision: number(item.revision, `outline[${index}].revision`, 1) };
    }),
    chapters: array(root.chapters, "chapters").map((value, index) => {
      const item = object(value, `chapters[${index}]`);
      return { sourceId: text(item.sourceId, `chapters[${index}].sourceId`, false), sourceOutlineNodeId: nullableText(item.sourceOutlineNodeId, `chapters[${index}].sourceOutlineNodeId`), title: text(item.title, `chapters[${index}].title`, false), content: text(item.content, `chapters[${index}].content`), summary: text(item.summary, `chapters[${index}].summary`), status: text(item.status, `chapters[${index}].status`), position: number(item.position, `chapters[${index}].position`), wordCount: number(item.wordCount, `chapters[${index}].wordCount`), targetWordCount: number(item.targetWordCount, `chapters[${index}].targetWordCount`, 3000), outlineStale: boolean(item.outlineStale, `chapters[${index}].outlineStale`), basedOnOutlineRevision: number(item.basedOnOutlineRevision, `chapters[${index}].basedOnOutlineRevision`), updatedAt: text(item.updatedAt, `chapters[${index}].updatedAt`) };
    }),
    characters: array(root.characters, "characters").map((value, index) => {
      const item = object(value, `characters[${index}]`);
      return { sourceId: text(item.sourceId, `characters[${index}].sourceId`, false), name: text(item.name, `characters[${index}].name`, false), role: text(item.role, `characters[${index}].role`), description: text(item.description, `characters[${index}].description`), goal: text(item.goal, `characters[${index}].goal`), fear: text(item.fear, `characters[${index}].fear`), secret: text(item.secret, `characters[${index}].secret`), voice: text(item.voice, `characters[${index}].voice`), status: text(item.status, `characters[${index}].status`) };
    }),
    relationships: array(root.relationships, "relationships").map((value, index) => {
      const item = object(value, `relationships[${index}]`);
      return { sourceId: text(item.sourceId, `relationships[${index}].sourceId`, false), sourceCharacterId: text(item.sourceCharacterId, `relationships[${index}].sourceCharacterId`, false), targetCharacterId: text(item.targetCharacterId, `relationships[${index}].targetCharacterId`, false), sourceName: text(item.sourceName, `relationships[${index}].sourceName`), targetName: text(item.targetName, `relationships[${index}].targetName`), type: text(item.type, `relationships[${index}].type`), description: text(item.description, `relationships[${index}].description`) };
    }),
    worldEntries: array(root.worldEntries, "worldEntries").map((value, index) => {
      const item = object(value, `worldEntries[${index}]`);
      return { sourceId: text(item.sourceId, `worldEntries[${index}].sourceId`, false), category: text(item.category, `worldEntries[${index}].category`), name: text(item.name, `worldEntries[${index}].name`, false), description: text(item.description, `worldEntries[${index}].description`), isCanon: boolean(item.isCanon, `worldEntries[${index}].isCanon`) };
    }),
    events: array(root.events, "events").map((value, index) => {
      const item = object(value, `events[${index}]`);
      return { sourceId: text(item.sourceId, `events[${index}].sourceId`, false), sourceChapterId: nullableText(item.sourceChapterId, `events[${index}].sourceChapterId`), chapterTitle: nullableText(item.chapterTitle, `events[${index}].chapterTitle`), title: text(item.title, `events[${index}].title`, false), storyTime: text(item.storyTime, `events[${index}].storyTime`), description: text(item.description, `events[${index}].description`), causes: text(item.causes, `events[${index}].causes`), consequences: text(item.consequences, `events[${index}].consequences`) };
    }),
    revisions: array(root.revisions, "revisions").map((value, index) => {
      const item = object(value, `revisions[${index}]`);
      return { sourceId: text(item.sourceId, `revisions[${index}].sourceId`, false), entityType: text(item.entityType, `revisions[${index}].entityType`), sourceEntityId: text(item.sourceEntityId, `revisions[${index}].sourceEntityId`, false), beforeContent: text(item.beforeContent, `revisions[${index}].beforeContent`), afterContent: text(item.afterContent, `revisions[${index}].afterContent`), instruction: text(item.instruction, `revisions[${index}].instruction`), createdAt: text(item.createdAt, `revisions[${index}].createdAt`) };
    }),
    illustrations: array(root.illustrations, "illustrations").map((value, index) => {
      const item = object(value, `illustrations[${index}]`);
      const dataBase64 = nullableText(item.dataBase64, `illustrations[${index}].dataBase64`);
      if (dataBase64 && (dataBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(dataBase64))) throw new Error(`illustrations[${index}].dataBase64 不是有效的 Base64`);
      return { sourceId: text(item.sourceId, `illustrations[${index}].sourceId`, false), sourceChapterId: text(item.sourceChapterId, `illustrations[${index}].sourceChapterId`, false), fileName: text(item.fileName, `illustrations[${index}].fileName`, false), mimeType: text(item.mimeType, `illustrations[${index}].mimeType`, false), caption: text(item.caption, `illustrations[${index}].caption`), position: number(item.position, `illustrations[${index}].position`), createdAt: text(item.createdAt, `illustrations[${index}].createdAt`), dataBase64 };
    }),
  };

  const outlineIds = uniqueIds(backup.outline, "outline");
  const chapterIds = uniqueIds(backup.chapters, "chapters");
  const characterIds = uniqueIds(backup.characters, "characters");
  uniqueIds(backup.relationships, "relationships");
  uniqueIds(backup.worldEntries, "worldEntries");
  uniqueIds(backup.events, "events");
  uniqueIds(backup.revisions, "revisions");
  uniqueIds(backup.illustrations, "illustrations");
  uniqueIds([
    { sourceId: backup.project.sourceId }, ...backup.outline, ...backup.chapters, ...backup.characters,
    ...backup.relationships, ...backup.worldEntries, ...backup.events, ...backup.revisions, ...backup.illustrations,
  ], "完整备份");
  backup.outline.forEach((item) => {
    if (item.sourceId === item.sourceParentId) throw new Error(`大纲节点不能以自己为父节点：${item.title}`);
    requireReference(item.sourceParentId, outlineIds, `大纲节点“${item.title}”`);
  });
  const outlineParents = new Map(backup.outline.map((item) => [item.sourceId, item.sourceParentId]));
  backup.outline.forEach((item) => {
    const visited = new Set<string>();
    let cursor: string | null = item.sourceId;
    while (cursor) {
      if (visited.has(cursor)) throw new Error(`大纲中存在循环父子关系：${item.title}`);
      visited.add(cursor);
      cursor = outlineParents.get(cursor) || null;
    }
  });
  backup.chapters.forEach((item) => requireReference(item.sourceOutlineNodeId, outlineIds, `章节“${item.title}”`));
  backup.relationships.forEach((item) => {
    requireReference(item.sourceCharacterId, characterIds, `关系“${item.type}”`);
    requireReference(item.targetCharacterId, characterIds, `关系“${item.type}”`);
  });
  backup.events.forEach((item) => requireReference(item.sourceChapterId, chapterIds, `事件“${item.title}”`));
  backup.illustrations.forEach((item) => requireReference(item.sourceChapterId, chapterIds, `插画“${item.fileName}”`));
  return backup;
}
