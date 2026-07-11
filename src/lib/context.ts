import type { Workspace } from "./types";

export function buildStoryContext(workspace: Workspace, chapterId?: string) {
  const chapter = workspace.chapters.find((item) => item.id === chapterId);
  const nearby = chapter
    ? workspace.chapters.filter((item) => Math.abs(item.position - chapter.position) <= 1)
    : workspace.chapters.slice(0, 6);
  return [
    `作品：${workspace.project.title}`,
    `类型：${workspace.project.genre || "未设定"}`,
    `核心构想：${workspace.project.premise || "未设定"}`,
    `写作规则：${workspace.project.styleGuide || "未设定"}`,
    `\n大纲：\n${workspace.outline.map((n) => `- [${n.type}] ${n.title}：${n.summary}`).join("\n")}`,
    `\n人物：\n${workspace.characters.map((c) => `- ${c.name}（${c.role}）：目标=${c.goal}；恐惧=${c.fear}；秘密=${c.secret}；口吻=${c.voice}`).join("\n")}`,
    `\n人物关系：\n${workspace.relationships.map((r) => `- ${r.sourceName} → ${r.targetName}：${r.type}。${r.description}`).join("\n")}`,
    `\n硬设定：\n${workspace.worldEntries.filter((w) => w.isCanon).map((w) => `- [${w.category}] ${w.name}：${w.description}`).join("\n")}`,
    `\n事件链：\n${workspace.events.map((e) => `- ${e.storyTime} ${e.title}；原因：${e.causes}；结果：${e.consequences}`).join("\n")}`,
    `\n插画说明：\n${workspace.illustrations.map((image) => `- ${workspace.chapters.find((chapter) => chapter.id === image.chapterId)?.title || "章节"}：${image.caption || image.fileName}`).join("\n")}`,
    `\n相关章节：\n${nearby.map((c) => `### ${c.title}\n摘要：${c.summary}\n${c.content.slice(-5000)}`).join("\n\n")}`,
  ].join("\n");
}
