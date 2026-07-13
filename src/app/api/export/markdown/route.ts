import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/db";
import { groupChaptersByVolume } from "@/lib/manuscript";
import { stripLeadingChapterHeading } from "@/lib/chapter-target";
import { convertChinese, safeExportName, scriptFrom } from "@/lib/chinese";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const workspace = getWorkspace(projectId);
    const script = scriptFrom(request.nextUrl.searchParams.get("script"));
    const includeToc = request.nextUrl.searchParams.get("toc") !== "false";
    const t = (value: string) => convertChinese(value || "", script);
    const groups = groupChaptersByVolume(workspace).map((group) => ({
      ...group,
      chapters: group.chapters.filter((chapter) => chapter.content.trim() || workspace.illustrations.some((image) => image.chapterId === chapter.id)),
    })).filter((group) => group.chapters.length);
    const anchor = (value: string) => t(value).trim().toLocaleLowerCase().replace(/[\s]+/g, "-").replace(/[^\p{Letter}\p{Number}\-_]/gu, "");
    const toc = includeToc ? [
      `## ${t("目录")}`,
      ...groups.flatMap((group) => [`- [${t(group.volume?.title || "未归档章节")}](#${anchor(group.volume?.title || "未归档章节")})`, ...group.chapters.map((chapter) => `  - [${t(chapter.title)}](#${anchor(chapter.title)})`)]),
    ] : [];
    const sections = [
      `# ${t(workspace.project.title)}`,
      workspace.project.genre ? `> ${t("类型")}：${t(workspace.project.genre)}` : "",
      t(workspace.project.premise),
      ...toc,
      ...groups.flatMap((group) => [
        `\n## ${t(group.volume?.title || "未归档章节")}`,
        group.volume?.summary ? `> ${t(group.volume.summary)}` : "",
        ...group.chapters.flatMap((chapter) => {
          const images = workspace.illustrations.filter((image) => image.chapterId === chapter.id);
          return [
            `\n### ${t(chapter.title)}`,
            t(stripLeadingChapterHeading(chapter.content)),
            ...images.map((image) => `\n![${t(image.caption || image.fileName)}](/api/assets/${image.id})\n${image.caption ? `*${t(image.caption)}*` : ""}`),
          ];
        }),
      ]),
    ].filter(Boolean);
    const safeTitle = safeExportName(t(workspace.project.title));
    const fileName = `${safeTitle}.md`;
    return new NextResponse(sections.join("\n\n"), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="manuscript.md"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "导出失败" }, { status: 500 });
  }
}
