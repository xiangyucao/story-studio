import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/db";
import { groupChaptersByVolume } from "@/lib/manuscript";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const workspace = getWorkspace(projectId);
    const groups = groupChaptersByVolume(workspace).map((group) => ({
      ...group,
      chapters: group.chapters.filter((chapter) => chapter.content.trim() || workspace.illustrations.some((image) => image.chapterId === chapter.id)),
    })).filter((group) => group.chapters.length);
    const sections = [
      `# ${workspace.project.title}`,
      workspace.project.genre ? `> 类型：${workspace.project.genre}` : "",
      workspace.project.premise,
      ...groups.flatMap((group) => [
        `\n## ${group.volume?.title || "未归档章节"}`,
        group.volume?.summary ? `> ${group.volume.summary}` : "",
        ...group.chapters.flatMap((chapter) => {
          const images = workspace.illustrations.filter((image) => image.chapterId === chapter.id);
          return [
            `\n### ${chapter.title}`,
            chapter.content,
            ...images.map((image) => `\n![${image.caption || image.fileName}](/api/assets/${image.id})\n${image.caption ? `*${image.caption}*` : ""}`),
          ];
        }),
      ]),
    ].filter(Boolean);
    const safeTitle = workspace.project.title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "") || "未命名作品";
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
