/* eslint-disable @next/next/no-img-element */
import { Fragment } from "react";
import { getWorkspace } from "@/lib/db";
import { groupChaptersByVolume } from "@/lib/manuscript";
import { PrintActions } from "./print-button";
import styles from "./print.module.css";
import { convertChinese, safeExportName, scriptFrom } from "@/lib/chinese";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ script?: string }> }) {
  const { projectId } = await params;
  const workspace = getWorkspace(projectId);
  const script = scriptFrom((await searchParams).script);
  const safeTitle = safeExportName(convertChinese(workspace.project.title, script));
  return { title: safeTitle };
}

export default async function ExportPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ script?: string; toc?: string }> }) {
  const { projectId } = await params;
  const workspace = getWorkspace(projectId);
  const exportOptions = await searchParams;
  const script = scriptFrom(exportOptions.script);
  const includeToc = exportOptions.toc !== "false";
  const t = (value: string) => convertChinese(value || "", script);
  const groups = groupChaptersByVolume(workspace).map((group) => ({
    ...group,
    chapters: group.chapters.filter((chapter) => chapter.content.trim() || workspace.illustrations.some((image) => image.chapterId === chapter.id)),
  })).filter((group) => group.chapters.length);
  return <main className={styles.exportPage}>
    <PrintActions />
    <article className={styles.book}>
      <section className={styles.cover}>
        <span>STORY STUDIO MANUSCRIPT</span>
        <h1>{t(workspace.project.title)}</h1>
        {workspace.project.genre && <p className={styles.genre}>{t(workspace.project.genre)}</p>}
        {workspace.project.premise && <p className={styles.premise}>{t(workspace.project.premise)}</p>}
      </section>
      {includeToc && <section className={styles.toc}><span>CONTENTS</span><h1>{t("目录")}</h1>{groups.map((group) => <div className={styles.tocGroup} key={group.volume?.id || "unfiled-toc"}><strong>{t(group.volume?.title || "未归档章节")}</strong>{group.chapters.map((chapter) => <p key={chapter.id}>{t(chapter.title)}</p>)}</div>)}</section>}
      {groups.map((group, groupIndex) => <Fragment key={group.volume?.id || "unfiled"}>
        <section className={styles.cover}>
          <span>{group.volume ? `VOLUME ${groupIndex + 1}` : "APPENDIX"}</span>
          <h1>{t(group.volume?.title || "未归档章节")}</h1>
          {group.volume?.summary && <p className={styles.premise}>{t(group.volume.summary)}</p>}
        </section>
        {group.chapters.map((chapter) => {
          const illustrations = workspace.illustrations.filter((image) => image.chapterId === chapter.id);
          return <section className={styles.chapter} key={chapter.id}>
            <header><span>CHAPTER {chapter.position + 1}</span><h2>{t(chapter.title)}</h2></header>
            <div className={styles.prose}>{chapter.content.split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={index}>{t(paragraph)}</p>)}</div>
            {illustrations.map((image) => <figure key={image.id}><img src={`/api/assets/${image.id}`} alt={t(image.caption || image.fileName)} />{image.caption && <figcaption>{t(image.caption)}</figcaption>}</figure>)}
          </section>;
        })}
      </Fragment>)}
      <footer className={styles.colophon}>{t("由 Story Studio 导出")} · {new Date().toLocaleDateString("zh-CN")}</footer>
    </article>
  </main>;
}
