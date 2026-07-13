import fs from "node:fs/promises";
import path from "node:path";
import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, PageBreak, Paragraph, TableOfContents, TextRun } from "docx";
import { imageSize } from "image-size";
import { NextRequest, NextResponse } from "next/server";
import { dataDir, getIllustrationAsset, getWorkspace } from "@/lib/db";
import { convertChinese, safeExportName, scriptFrom } from "@/lib/chinese";
import { groupChaptersByVolume } from "@/lib/manuscript";
import { stripLeadingChapterHeading } from "@/lib/chapter-target";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const workspace = getWorkspace(request.nextUrl.searchParams.get("projectId") || undefined);
    const script = scriptFrom(request.nextUrl.searchParams.get("script"));
    const includeToc = request.nextUrl.searchParams.get("toc") !== "false";
    const t = (value: string) => convertChinese(value || "", script);
    const children: Array<Paragraph | TableOfContents> = [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2600, after: 500 }, children: [new TextRun({ text: t(workspace.project.title), bold: true, size: 44, font: "Microsoft YaHei" })] }),
      ...(workspace.project.genre ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t(workspace.project.genre), color: "777777", size: 22 })] })] : []),
      ...(workspace.project.premise ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 500 }, children: [new TextRun({ text: t(workspace.project.premise), size: 22 })] })] : []),
    ];
    if (includeToc) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: t("目录"), bold: true })] }));
      children.push(new TableOfContents(t("目录"), { hyperlink: true, headingStyleRange: "1-3" }));
    }

    const groups = groupChaptersByVolume(workspace).map((group) => ({ ...group, chapters: group.chapters.filter((chapter) => chapter.content.trim() || workspace.illustrations.some((image) => image.chapterId === chapter.id)) })).filter((group) => group.chapters.length);
    for (const group of groups) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t(group.volume?.title || "未归档章节"), bold: true })] }));
      if (group.volume?.summary) children.push(new Paragraph({ spacing: { after: 500 }, children: [new TextRun({ text: t(group.volume.summary), italics: true, color: "666666" })] }));
      for (let chapterIndex = 0; chapterIndex < group.chapters.length; chapterIndex += 1) {
        const chapter = group.chapters[chapterIndex];
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: chapterIndex > 0, children: [new TextRun({ text: t(chapter.title), bold: true })] }));
        stripLeadingChapterHeading(chapter.content).split(/\n+/).filter(Boolean).forEach((text) => children.push(new Paragraph({ spacing: { line: 360, after: 180 }, indent: { firstLine: 480 }, children: [new TextRun({ text: t(text), size: 24 })] })));
        for (const illustration of workspace.illustrations.filter((image) => image.chapterId === chapter.id)) {
          const asset = getIllustrationAsset(illustration.id);
          if (!asset || !["image/png", "image/jpeg"].includes(asset.mime_type)) continue;
          try {
            const bytes = await fs.readFile(path.join(dataDir, "uploads", path.basename(asset.stored_name)));
            const dimensions = imageSize(bytes);
            const ratio = Math.min(1, 560 / (dimensions.width || 560), 700 / (dimensions.height || 700));
            children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120 }, children: [new ImageRun({ data: bytes, type: asset.mime_type === "image/png" ? "png" : "jpg", transformation: { width: Math.round((dimensions.width || 560) * ratio), height: Math.round((dimensions.height || 420) * ratio) } })] }));
            if (illustration.caption) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t(illustration.caption), italics: true, color: "777777", size: 19 })] }));
          } catch { /* 缺失或不支持的图片不阻止正文导出。 */ }
        }
      }
    }

    const document = new Document({
      features: { updateFields: true },
      styles: { default: { document: { run: { font: "Microsoft YaHei", size: 24 }, paragraph: { spacing: { line: 360 } } } } },
      sections: [{ properties: { page: { margin: { top: 1100, right: 1100, bottom: 1100, left: 1100 } } }, children }],
    });
    const buffer = await Packer.toBuffer(document);
    const fileName = `${safeExportName(t(workspace.project.title))}.docx`;
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="manuscript.docx"; filename*=UTF-8''${encodeURIComponent(fileName)}` } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Word 导出失败" }, { status: 500 });
  }
}
