import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getWorkspace } from "@/lib/db";
import { buildStoryContext } from "@/lib/context";
import { clearLocalModelContext, generateOutline, generateOutlineNode, generateReferenceSample, generateText, generateVolumeExpansion } from "@/lib/models";
import { writeAiLog } from "@/lib/ai-log";
import { hasWrongChapterHeading, stripLeadingChapterHeading } from "@/lib/chapter-target";
import { buildManualAiPrompt } from "@/lib/manual-ai";
import { resolveWritingLanguage } from "@/lib/writing-language";
import { aiPromptLocales } from "@/lib/ai-prompt-i18n";
import type { ModelSettings } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  let logBase: Record<string, unknown> = { requestId };
  try {
    const body = await request.json() as {
      action: "outline" | "outline-volume" | "outline-node" | "compact-reference" | "expand" | "continue" | "revise" | "logic";
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
    const language = resolveWritingLanguage(workspace.project, targetChapter
      ? [targetChapter.title, targetOutline?.summary || "", targetChapter.summary]
      : workspace.outline.flatMap((node) => [node.title, node.summary]));
    const count = Math.max(1, Math.min(20, Math.round(Number(body.count) || 7)));
    const locale = aiPromptLocales[language.code];
    const languageInstruction = language.directive;
    const effectiveInstruction = !["zh-CN", "zh-TW"].includes(language.code) && body.action === "outline-volume" && body.instruction.startsWith("根据以下本卷介绍展开章节")
      ? locale.volumeSystem(count)
      : body.instruction;
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
      instruction: effectiveInstruction,
      selectionLength: body.selection?.length || 0,
    };
    writeAiLog({ ...logBase, stage: "request" });
    const context = buildStoryContext(workspace, body.chapterId);
    const effectiveTargetWordCount = Math.max(300, Math.min(50000, Math.round(Number(body.targetWordCount) || targetChapter?.targetWordCount || 3000)));
    if (body.settings.provider === "manual") {
      const prompt = buildManualAiPrompt({
        action: body.action,
        context,
        instruction: `${effectiveInstruction}\n\n${languageInstruction}`,
        selection: body.selection,
        count,
        targetLength: body.referenceLength,
        outputLanguage: language.code,
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
    if (body.action === "outline") {
      const proposal = await generateOutline(body.settings, context, `${effectiveInstruction}\n\n${languageInstruction}`, count, language.code);
      writeAiLog({ ...logBase, stage: "complete", nodeCount: proposal.nodes.length });
      return NextResponse.json({ type: "outline", proposal, requestId });
    }
    if (body.action === "outline-volume") {
      const proposal = await generateVolumeExpansion(body.settings, context, body.selection || "", `${effectiveInstruction}\n\n${languageInstruction}`, count, language.code);
      writeAiLog({ ...logBase, stage: "complete", nodeCount: proposal.nodes.length });
      return NextResponse.json({ type: "outline-volume", proposal, requestId });
    }
    if (body.action === "outline-node") {
      const proposal = await generateOutlineNode(body.settings, context, body.selection || "", `${effectiveInstruction}\n\n${languageInstruction}`, language.code);
      writeAiLog({ ...logBase, stage: "complete" });
      return NextResponse.json({ type: "outline-node", proposal, requestId });
    }
    if (!targetChapter) throw new Error("当前目标章节不存在，请重新选择章节后再试");
    const targetBlock = `${locale.onlyTarget}\n${locale.chapterId}: ${targetChapter.id}\n${locale.chapterTitle}: ${targetChapter.title}\n${locale.chapterOutline}: ${targetOutline?.summary || targetChapter.summary || locale.notProvided}\n${locale.suggestedLength(effectiveTargetWordCount)}\n${locale.hardConstraint}`;
    const task = `${language.directive}\n${body.action === "expand" ? locale.expand(targetChapter.title) : body.action === "continue" ? locale.continue(targetChapter.title) : body.action === "logic" ? locale.logic : locale.revise(targetChapter.title)}`;
    const selected = body.selection?.trim() || targetChapter.content || "";
    const prompt = `${targetBlock}\n\n${context}\n\n${locale.textToProcess}:\n---\n${selected}\n---\n\n${locale.userRequest}:\n${effectiveInstruction}`;
    const result = await generateText(body.settings, task, prompt);
    const { returnedHeading, wrong } = hasWrongChapterHeading(result, targetChapter.title);
    if ((body.action === "expand" || body.action === "continue") && wrong) {
      writeAiLog({ ...logBase, stage: "rejected", returnedHeading, reason: "wrong-chapter-heading", resultLength: result.length, resultPreview: result.slice(0, 500) });
      throw new Error(`模型返回了“${returnedHeading}”，但当前目标是“${targetChapter.title}”。已阻止错误提案，请重试。日志编号：${requestId}`);
    }
    const cleanResult = body.action === "expand" || body.action === "continue" || body.action === "revise" ? stripLeadingChapterHeading(result) : result;
    writeAiLog({ ...logBase, stage: "complete", returnedHeading, strippedHeading: Boolean(returnedHeading && cleanResult !== result.trim()), resultLength: cleanResult.length, resultPreview: cleanResult.slice(0, 500) });
    return NextResponse.json({ type: "text", result: cleanResult, targetChapterId: targetChapter.id, requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型调用失败";
    writeAiLog({ ...logBase, stage: "error", error: message });
    return NextResponse.json({ error: message, requestId }, { status: 500 });
  }
}
