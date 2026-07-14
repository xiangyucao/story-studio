import type { ManuscriptGroup } from "./manuscript";

export const unfiledExportKey = "__unfiled__";

export function exportGroupKey(group: ManuscriptGroup) {
  return group.volume?.id || unfiledExportKey;
}

export function filterSelectedExportGroups(groups: ManuscriptGroup[], selection: string | null | undefined) {
  if (selection == null) return groups;
  const selected = new Set(selection.split(",").map((value) => value.trim()).filter(Boolean));
  return groups.filter((group) => selected.has(exportGroupKey(group)));
}
