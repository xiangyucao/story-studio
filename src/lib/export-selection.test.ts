import { describe, expect, it } from "vitest";
import { exportGroupKey, filterSelectedExportGroups, unfiledExportKey } from "./export-selection";
import type { ManuscriptGroup } from "./manuscript";

const groups = [
  { volume: { id: "v1" }, chapters: [] },
  { volume: { id: "v2" }, chapters: [] },
  { volume: null, chapters: [] },
] as ManuscriptGroup[];

describe("export volume selection", () => {
  it("defaults to every group when no selection is supplied", () => {
    expect(filterSelectedExportGroups(groups, null)).toHaveLength(3);
  });

  it("filters volumes and unfiled chapters by stable keys", () => {
    expect(filterSelectedExportGroups(groups, `v2,${unfiledExportKey}`).map(exportGroupKey)).toEqual(["v2", unfiledExportKey]);
  });
});
