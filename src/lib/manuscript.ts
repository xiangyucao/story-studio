import type { Chapter, OutlineNode, Workspace } from "./types";

export type ManuscriptGroup = {
  volume: OutlineNode | null;
  chapters: Chapter[];
};

export function groupChaptersByVolume(workspace: Workspace): ManuscriptGroup[] {
  const nodesById = new Map(workspace.outline.map((node) => [node.id, node]));
  const volumes = workspace.outline.filter((node) => node.type === "volume");
  const grouped = new Map(volumes.map((volume) => [volume.id, [] as Chapter[]]));
  const unfiled: Chapter[] = [];

  workspace.chapters.forEach((chapter) => {
    let node = chapter.outlineNodeId ? nodesById.get(chapter.outlineNodeId) : undefined;
    while (node && node.type !== "volume" && node.parentId) node = nodesById.get(node.parentId);
    if (node?.type === "volume" && grouped.has(node.id)) grouped.get(node.id)?.push(chapter);
    else unfiled.push(chapter);
  });

  const groups: ManuscriptGroup[] = volumes.map((volume) => ({ volume, chapters: grouped.get(volume.id) || [] }));
  if (unfiled.length) groups.push({ volume: null, chapters: unfiled });
  return groups;
}
