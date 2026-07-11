import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const workspace = getWorkspace(projectId);
    const sections = [
      `# ${workspace.project.title}`,
      workspace.project.genre ? `> 类型：${workspace.project.genre}` : "",
      workspace.project.premise,
      ...workspace.chapters.filter((chapter) => chapter.content.trim() || workspace.illustrations.some((image) => image.chapterId === chapter.id)).flatMap((chapter) => {
        const images = workspace.illustrations.filter((image) => image.chapterId === chapter.id);
        return [
          `\n## ${chapter.title}`,
          chapter.content,
          ...images.map((image) => `\n![${image.caption || image.fileName}](/api/assets/${image.id})\n${image.caption ? `*${image.caption}*` : ""}`),
        ];
      }),
    ].filter(Boolean);
    return new NextResponse(sections.join("\n\n"), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": "attachment; filename=manuscript.md",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "导出失败" }, { status: 500 });
  }
}
