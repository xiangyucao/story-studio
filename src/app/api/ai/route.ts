import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/db";
import { buildStoryContext } from "@/lib/context";
import { generateOutline, generateOutlineNode, generateText } from "@/lib/models";
import type { ModelSettings } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      action: "outline" | "outline-node" | "expand" | "revise" | "logic";
      projectId: string;
      chapterId?: string;
      instruction: string;
      selection?: string;
      settings: ModelSettings;
    };
    if (!body.instruction?.trim()) return NextResponse.json({ error: "请输入对 AI 的要求" }, { status: 400 });
    const workspace = getWorkspace(body.projectId);
    const context = buildStoryContext(workspace, body.chapterId);
    if (body.action === "outline") {
      return NextResponse.json({ type: "outline", proposal: await generateOutline(body.settings, context, body.instruction) });
    }
    if (body.action === "outline-node") {
      return NextResponse.json({ type: "outline-node", proposal: await generateOutlineNode(body.settings, context, body.selection || "", body.instruction) });
    }
    const task = body.action === "expand"
      ? "根据资料展开当前章节。只输出可直接进入正文的中文文本，不解释过程。"
      : body.action === "logic"
        ? "作为连续性编辑，回答逻辑问题。必须区分已有证据、合理推断和资料缺口，并指出相关事件。"
        : "作为文字编辑改写指定文本。保持事实、人物动机和视角不变，只输出修改后的完整文本。";
    const selected = body.selection?.trim() || workspace.chapters.find((c) => c.id === body.chapterId)?.content || "";
    const prompt = `${context}\n\n待处理文本：\n---\n${selected}\n---\n\n用户要求：${body.instruction}`;
    const result = await generateText(body.settings, task, prompt);
    return NextResponse.json({ type: "text", result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "模型调用失败" }, { status: 500 });
  }
}
