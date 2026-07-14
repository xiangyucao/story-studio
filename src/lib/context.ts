import type { Workspace } from "./types";
import { resolveWritingLanguage } from "./writing-language";
import { promptLocales } from "./prompt-i18n";

export function buildStoryContext(workspace: Workspace, chapterId?: string) {
  const chapter = workspace.chapters.find((item) => item.id === chapterId);
  const chapterOutline = workspace.outline.find((item) => item.id === chapter?.outlineNodeId);
  const outlineById = new Map(workspace.outline.map((item) => [item.id, item]));
  let currentVolume = chapterOutline;
  while (currentVolume && currentVolume.type !== "volume" && currentVolume.parentId) {
    currentVolume = outlineById.get(currentVolume.parentId);
  }
  const belongsToCurrentVolume = (node: Workspace["outline"][number]) => {
    if (!currentVolume || currentVolume.type !== "volume") return true;
    let cursor: Workspace["outline"][number] | undefined = node;
    while (cursor?.parentId) {
      if (cursor.parentId === currentVolume.id) return true;
      cursor = outlineById.get(cursor.parentId);
    }
    return node.id === currentVolume.id;
  };
  const relevantOutline = chapter && currentVolume?.type === "volume"
    ? workspace.outline.filter((node) => node.type === "volume" || belongsToCurrentVolume(node))
    : workspace.outline;
  const chapterScenes = chapterOutline
    ? workspace.outline.filter((item) => item.type === "scene" && item.parentId === chapterOutline.id)
    : [];
  const chapterIndex = chapter ? workspace.chapters.findIndex((item) => item.id === chapter.id) : -1;
  const nearby = chapter
    ? workspace.chapters.slice(Math.max(0, chapterIndex - 1), chapterIndex + 2)
    : workspace.chapters.slice(0, 6);
  const language = resolveWritingLanguage(workspace.project, [chapter?.title || "", chapterOutline?.summary || "", chapter?.summary || ""]);
  const l = promptLocales[language.code];
  const inlineColon = ["zh-CN", "zh-TW", "ja"].includes(language.code) ? "：" : ": ";
  const quotedReferenceTitle = ["zh-CN", "zh-TW"].includes(language.code)
    ? `《${workspace.project.referenceTitle || l.untitledReference}》`
    : language.code === "ja"
      ? `『${workspace.project.referenceTitle || l.untitledReference}』`
      : `“${workspace.project.referenceTitle || l.untitledReference}”`;
  return [
    `${l.work}: ${workspace.project.title}`,
    `${l.writingLanguage}: ${language.label} (${workspace.project.writingLanguage === "auto" || !workspace.project.writingLanguage ? l.autoDetected : l.explicitlySelected})`,
    `${l.genre}: ${workspace.project.genre || l.notSpecified}`,
    `${l.premise}: ${workspace.project.premise || l.notSpecified}`,
    `${l.rules}: ${workspace.project.styleGuide || l.notSpecified}`,
    `${l.styleReference}: ${workspace.project.referenceText ? `${quotedReferenceTitle}\n${l.referenceWarning}\n${workspace.project.referenceText}` : l.noReference}`,
    `\n${chapter && currentVolume?.type === "volume" ? l.focusedOutline : l.outline}:\n${relevantOutline.map((n) => `- [${n.type}] ${n.title}: ${n.summary}`).join("\n")}`,
    `\n${l.characters}:\n${workspace.characters.map((c) => `- ${c.name} (${c.role}): ${l.personality}=${c.description}; ${l.goal}=${c.goal}; ${l.fear}=${c.fear}; ${l.secret}=${c.secret}; ${l.voice}=${c.voice}`).join("\n")}`,
    `\n${l.relationships}:\n${workspace.relationships.map((r) => `- ${r.sourceName} → ${r.targetName}: ${r.type}. ${r.description}`).join("\n")}`,
    `\n${l.hardSettings}:\n${workspace.worldEntries.filter((w) => w.isCanon).map((w) => `- [${w.category}] ${w.name}: ${w.description}`).join("\n")}`,
    `\n${l.events}:\n${workspace.events.map((e) => `- ${e.storyTime} ${e.title}${e.chapterTitle ? ` (${e.chapterTitle})` : ""}: ${e.description}; ${l.cause}${inlineColon}${e.causes}; ${l.consequence}${inlineColon}${e.consequences}`).join("\n")}`,
    `\n${l.scenes}:\n${chapterScenes.length ? chapterScenes.map((scene) => `- ${scene.title}: ${scene.summary}`).join("\n") : l.noScenes}`,
    chapter ? `\n${l.suggestedLength}: ${chapter.targetWordCount || 3000} ${l.lengthUnit}` : "",
    `\n${l.illustrations}:\n${workspace.illustrations.map((image) => `- ${workspace.chapters.find((item) => item.id === image.chapterId)?.title || l.chapter}: ${image.caption || image.fileName}`).join("\n")}`,
    `\n${l.relevantChapters}:\n${nearby.map((c) => `### [${!chapter ? l.referenceChapter : c.id === chapter.id ? l.targetChapter : c.position < chapter.position ? l.previousChapter : l.nextChapter}] ${c.title}\n${l.summary}: ${c.summary}\n${c.content.slice(-5000)}`).join("\n\n")}`,
  ].join("\n");
}
