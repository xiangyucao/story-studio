import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getWorkspace } from "@/lib/db";
import { buildStoryContext } from "@/lib/context";
import { clearLocalModelContext, generateFoundationFromReference, generateOutline, generateOutlineNode, generateReferenceSample, generateText, generateVolumeExpansion } from "@/lib/models";
import { writeAiLog } from "@/lib/ai-log";
import { hasWrongChapterHeading } from "@/lib/chapter-target";
import { buildManualAiPrompt } from "@/lib/manual-ai";
import type { ModelSettings } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  let logBase: Record<string, unknown> = { requestId };
  try {
    const body = await request.json() as {
      action: "outline" | "outline-volume" | "outline-node" | "foundation" | "compact-reference" | "expand" | "revise" | "logic";
      projectId: string;
      chapterId?: string;
      instruction: string;
      selection?: string;
      count?: number;
      targetWordCount?: number;
      referenceLength?: number;
      settings: ModelSettings;
    };
    if (!body.instruction?.trim()) return NextResponse.json({ error: "请输入对 AI 的要求" }, { status: 400 });
    const workspace = getWorkspace(body.projectId);
    const targetChapter = body.chapterId ? workspace.chapters.find((chapter) => chapter.id === body.chapterId) : undefined;
    const targetOutline = targetChapter?.outlineNodeId ? workspace.outline.find((node) => node.id === targetChapter.outlineNodeId) : undefined;
    logBase = {
      requestId,
      action: body.action,
      projectId: body.projectId,
      projectTitle: workspace.project.title,
      chapterId: body.chapterId || null,
      chapterTitle: targetChapter?.title || null,
      outlineNodeId: targetOutline?.id || null,
      outlineTitle: targetOutline?.title || null,
      outlineSummary: targetOutline?.summary || null,
      provider: body.settings.provider,
      model: body.settings.model,
      instruction: body.instruction,
      selectionLength: body.selection?.length || 0,
    };
    writeAiLog({ ...logBase, stage: "request" });
    const context = buildStoryContext(workspace, body.chapterId);
    const count = Math.max(1, Math.min(20, Math.round(Number(body.count) || 7)));
    const effectiveTargetWordCount = Math.max(300, Math.min(50000, Math.round(Number(body.targetWordCount) || targetChapter?.targetWordCount || 3000)));
    if (body.settings.provider === "manual") {
      const prompt = buildManualAiPrompt({
        action: body.action,
        context,
        instruction: body.instruction,
        selection: body.selection,
        count,
        targetLength: body.referenceLength,
        targetChapter: targetChapter ? {
          id: targetChapter.id,
          title: targetChapter.title,
          summary: targetOutline?.summary || targetChapter.summary,
          targetWordCount: effectiveTargetWordCount,
        } : undefined,
      });
      writeAiLog({ ...logBase, stage: "manual-prompt", promptLength: prompt.length });
      return NextResponse.json({ type: "manual", action: body.action, prompt, targetChapterId: targetChapter?.id, targetChapterTitle: targetChapter?.title, requestId });
    }
    if (body.settings.provider === "openai-compatible") {
      const contextClear = await clearLocalModelContext(body.settings);
      writeAiLog({ ...logBase, stage: "local-context-clear", ...contextClear });
    }
    if (body.action === "compact-reference") {
      if (!workspace.project.referenceText.trim()) throw new Error("请先上传或粘贴参考范本");
      const result = await generateReferenceSample(body.settings, workspace.project.referenceText, body.referenceLength);
      writeAiLog({ ...logBase, stage: "complete", resultLength: result.length });
      return NextResponse.json({ type: "reference-sample", result, requestId });
    }
    if (body.action === "foundation") {
      if (!workspace.project.referenceText.trim()) throw new Error("请先上传或粘贴参考范本");
      const proposal = await generateFoundationFromReference(body.settings, context, body.instruction);
      writeAiLog({ ...logBase, stage: "complete" });
      return NextResponse.json({ type: "foundation", proposal, requestId });
    }
    if (body.action === "outline") {
      const proposal = await generateOutline(body.settings, context, body.instruction, count);
      writeAiLog({ ...logBase, stage: "complete", nodeCount: proposal.nodes.length });
      return NextResponse.json({ type: "outline", proposal, requestId });
    }
    if (body.action === "outline-volume") {
      const proposal = await generateVolumeExpansion(body.settings, context, body.selection || "", body.instruction, count);
      writeAiLog({ ...logBase, stage: "complete", nodeCount: proposal.nodes.length });
      return NextResponse.json({ type: "outline-volume", proposal, requestId });
    }
    if (body.action === "outline-node") {
      const proposal = await generateOutlineNode(body.settings, context, body.selection || "", body.instruction);
      writeAiLog({ ...logBase, stage: "complete" });
      return NextResponse.json({ type: "outline-node", proposal, requestId });
    }
    if (!targetChapter) throw new Error("当前目标章节不存在，请重新选择章节后再试");
    const targetBlock = `【唯一目标章节】\n章节 ID：${targetChapter.id}\n章节标题：${targetChapter.title}\n章节大纲：${targetOutline?.summary || targetChapter.summary || "未填写"}\n建议字数：约 ${effectiveTargetWordCount} 字（允许上下浮动约 15%）\n硬性要求：只能处理这一章。相邻章节仅供衔接，绝不能把上一章或下一章当成写作目标。`;
    const task = body.action === "expand"
      ? `根据资料展开《${targetChapter.title}》。只能写这一章；如果输出章节标题，必须与“${targetChapter.title}”一致。只输出可直接进入正文的中文文本，不解释过程。`
      : body.action === "logic"
        ? "作为连续性编辑，回答逻辑问题。必须区分已有证据、合理推断和资料缺口，并指出相关事件。"
        : `作为文字编辑改写《${targetChapter.title}》的指定文本。保持事实、人物动机和视角不变，只输出修改后的完整文本。`;
    const selected = body.selection?.trim() || targetChapter.content || "";
    const prompt = `${targetBlock}\n\n${context}\n\n${targetBlock}\n\n待处理文本：\n---\n${selected}\n---\n\n用户要求：${body.instruction}`;
    const result = await generateText(body.settings, task, prompt);
    const { returnedHeading, wrong } = hasWrongChapterHeading(result, targetChapter.title);
    if (body.action === "expand" && wrong) {
      writeAiLog({ ...logBase, stage: "rejected", returnedHeading, reason: "wrong-chapter-heading", resultLength: result.length, resultPreview: result.slice(0, 500) });
      throw new Error(`模型返回了“${returnedHeading}”，但当前目标是“${targetChapter.title}”。已阻止错误提案，请重试。日志编号：${requestId}`);
    }
    writeAiLog({ ...logBase, stage: "complete", returnedHeading, resultLength: result.length, resultPreview: result.slice(0, 500) });
    return NextResponse.json({ type: "text", result, targetChapterId: targetChapter.id, requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型调用失败";
    writeAiLog({ ...logBase, stage: "error", error: message });
    return NextResponse.json({ error: message, requestId }, { status: 500 });
  }
}
