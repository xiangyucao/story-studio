import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { dataDir, getIllustrationAsset } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/assets/[id]">) {
  const { id } = await context.params;
  const asset = getIllustrationAsset(id);
  if (!asset) return NextResponse.json({ error: "图片不存在" }, { status: 404 });
  try {
    const bytes = await fs.readFile(path.join(dataDir, "uploads", path.basename(asset.stored_name)));
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": asset.mime_type,
        "Content-Disposition": `inline; filename="${asset.file_name.replace(/["\\]/g, "_")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "图片文件已丢失" }, { status: 404 });
  }
}
