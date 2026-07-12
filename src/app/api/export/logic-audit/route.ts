import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/db";
import { groupChaptersByVolume } from "@/lib/manuscript";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const workspace = getWorkspace(request.nextUrl.searchParams.get("projectId") || undefined);
    const groups = groupChaptersByVolume(workspace);
    const sections = [
      `# 《${workspace.project.title}》逻辑审计包`,
      `> 建议交给支持长上下文的外部模型，并使用下面的审校要求。`,
      `## 建议给外部模型的任务\n请检查人物动机、人物所知信息、时间顺序、事件因果、物品与地点状态、世界观规则、伏笔铺设与回收是否前后一致。请区分明确矛盾、合理推断和资料缺口；每个问题引用卷名、章名和原文证据，并给出尽量少改动正文的修订建议。最后可在不改变事实的前提下提出语言润色建议。`,
      `## 作品基石\n- 类型：${workspace.project.genre || "未设定"}\n- 核心构想：${workspace.project.premise || "未设定"}\n- 写作规则：${workspace.project.styleGuide || "未设定"}`,
      `## 完整大纲\n${workspace.outline.map((item) => `- [${item.type}] ${item.title}：${item.summary}`).join("\n")}`,
      `## 人物\n${workspace.characters.map((item) => `### ${item.name}\n- 角色：${item.role}\n- 描述：${item.description}\n- 目标：${item.goal}\n- 恐惧：${item.fear}\n- 秘密：${item.secret}\n- 说话风格：${item.voice}`).join("\n\n")}`,
      `## 人物关系\n${workspace.relationships.map((item) => `- ${item.sourceName} → ${item.targetName}｜${item.type}：${item.description}`).join("\n")}`,
      `## 世界观与背景\n${workspace.worldEntries.map((item) => `- [${item.isCanon ? "硬设定" : "草稿"} / ${item.category}] ${item.name}：${item.description}`).join("\n")}`,
      `## 事件时间线\n${workspace.events.map((item) => `### ${item.storyTime || "时间待定"}｜${item.title}\n- 经过：${item.description}\n- 原因：${item.causes}\n- 结果：${item.consequences}`).join("\n\n")}`,
      `# 正文\n${groups.map((group) => [
        `## ${group.volume?.title || "未归档章节"}`,
        group.volume?.summary ? `> ${group.volume.summary}` : "",
        ...group.chapters.map((chapter) => `### ${chapter.title}\n> 章节摘要：${chapter.summary || "未填写"}\n\n${chapter.content || "（尚无正文）"}`),
      ].filter(Boolean).join("\n\n")).join("\n\n")}`,
    ];
    return new NextResponse(sections.join("\n\n"), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": "attachment; filename=logic-audit.md",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "导出失败" }, { status: 500 });
  }
}
