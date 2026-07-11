import { NextRequest, NextResponse } from "next/server";
import { createProject, getWorkspace, mutateWorkspace, repairLegacyVolumeStructure } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    repairLegacyVolumeStructure();
    return NextResponse.json(getWorkspace(request.nextUrl.searchParams.get("projectId") || undefined));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "读取失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { action: string; payload?: Record<string, unknown> };
    const result = body.action === "create-project"
      ? createProject(String(body.payload?.title || "未命名作品"))
      : mutateWorkspace(body.action, body.payload || {});
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 400 });
  }
}
