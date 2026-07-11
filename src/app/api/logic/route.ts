import { NextRequest, NextResponse } from "next/server";
import { searchLogic } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { projectId, query } = await request.json() as { projectId: string; query: string };
    if (!projectId || !query?.trim()) return NextResponse.json({ error: "请输入查询问题" }, { status: 400 });
    const evidence = searchLogic(projectId, query);
    const lines = [
      ...evidence.eventHits.map((e) => `${e.storyTime || "未标时间"}「${e.title}」：${e.description} 原因：${e.causes} 结果：${e.consequences}`),
      ...evidence.characterHits.map((c) => `人物「${c.name}」：目标=${c.goal}；秘密=${c.secret}`),
      ...evidence.worldHits.map((w) => `设定「${w.name}」：${w.description}`),
    ];
    return NextResponse.json({ evidence, answer: lines.length ? lines.join("\n") : "现有结构化资料中没有找到直接证据。可以补充人物、事件或世界观记录后再查询。" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "查询失败" }, { status: 400 });
  }
}
