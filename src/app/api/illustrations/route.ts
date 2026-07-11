import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { createIllustration, dataDir } from "@/lib/db";

export const runtime = "nodejs";

const allowedTypes: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const projectId = String(form.get("projectId") || "");
    const chapterId = String(form.get("chapterId") || "");
    const caption = String(form.get("caption") || "");
    if (!(file instanceof File) || !projectId || !chapterId) {
      return NextResponse.json({ error: "缺少作品、章节或图片" }, { status: 400 });
    }
    const extension = allowedTypes[file.type];
    if (!extension) return NextResponse.json({ error: "仅支持 JPG、PNG 和 WebP 图片" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "单张图片不能超过 10MB" }, { status: 400 });

    const uploadDir = path.join(dataDir, "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const storedName = `${randomUUID()}${extension}`;
    await fs.writeFile(path.join(uploadDir, storedName), Buffer.from(await file.arrayBuffer()));
    const id = createIllustration({ projectId, chapterId, fileName: file.name, storedName, mimeType: file.type, caption });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "图片上传失败" }, { status: 500 });
  }
}
