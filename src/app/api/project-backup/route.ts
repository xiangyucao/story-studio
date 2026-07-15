import { NextRequest, NextResponse } from "next/server";
import { createProjectBackup, importProjectBackup } from "@/lib/db";
import { safeExportName } from "@/lib/chinese";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") || "";
    if (!projectId) return NextResponse.json({ error: "缺少 projectId" }, { status: 400 });
    const backup = createProjectBackup(projectId);
    const fileName = `${safeExportName(backup.project.title)}-完整作品备份.json`;
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="project-backup.json"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "完整作品备份导出失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 300 * 1024 * 1024) return NextResponse.json({ error: "备份文件超过 300 MB，无法导入" }, { status: 413 });
    const raw = await request.text();
    if (!raw.trim()) return NextResponse.json({ error: "请选择完整作品备份 JSON 文件" }, { status: 400 });
    const result = importProjectBackup(raw);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "完整作品备份导入失败" }, { status: 400 });
  }
}
